#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * USKids Golf — incremental scraper (Node 18+, sem dependências)
 * --------------------------------------------------------------
 * Substitui o antigo public/arquivo/uskids_scrape.ps1.
 *
 * Melhorias vs. script PS1 original:
 *   1. POST a GetPlayerTeeTimes com t=1 + jbgr + c=1
 *      (o endpoint legacy GET t=0 devolve {} para torneios encerrados)
 *   2. Chama GetTournamentPlayers e grava o memberId global de cada flight
 *      (o flight_players só tem o pid local — sem isto, os miúdos ficam
 *      anónimos no cross-ref com o golf-fpg)
 *   3. Incremental por defeito: salta torneios já presentes nos batch_*.json
 *   4. Filtros úteis: --since YYYY, --tcodes a,b,c, --force, --dry-run
 *   5. Concorrência controlada (default 3 workers)
 *
 * USO (no PC):
 *   cd C:\uskids-golf
 *   node scripts/update-uskids.js                       # default: --since 2025, salta existentes
 *   node scripts/update-uskids.js --since 2024
 *   node scripts/update-uskids.js --tcodes 21080,18242  # ad-hoc
 *   node scripts/update-uskids.js --force --since 2026  # re-scrapar tudo de 2026
 *   node scripts/update-uskids.js --dry-run             # só lista candidatos
 *
 * OUTPUT: public/batch_NNN.json (continua a numeração a partir do último)
 *
 * Cada flight no output passa a ter:
 *   memberIds: ["591440", "591441", ...]          // PlayerNodeId raw
 *   pid_to_member_id: { "3112": "591440", ... }   // só matches directos
 *
 * Para nomes em torneios onde o pid != mid, o cross-ref tem de ser feito
 * downstream (matching por strokes fingerprint dentro de tcode+ageGroup).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const ARCHIVE_DIR = path.join(PUBLIC_DIR, "arquivo");
const MASTER_LIST = path.join(ARCHIVE_DIR, "all_tournaments_consolidated.json");

// A USKids tem dois front-ends em paralelo. Os torneios mais antigos usam
// www.signupanytime.com (ax=1129); os mais recentes (alguns regionais 2026)
// usam tourcaddiepro.com (ax=1661). Ambos servem o mesmo LinksAJAX.aspx.
// Estratégia: por torneio, tentar o backend "preferido" (do master se tiver
// iframe_host, senão signupanytime); se vier vazio, fallback ao outro.
const BACKENDS = [
  "https://www.signupanytime.com/plugins/links/admin/LinksAJAX.aspx",
  "https://tourcaddiepro.com/plugins/links/admin/LinksAJAX.aspx",
];
function backendsFor(t) {
  const host = (t && t.iframe_host) || "";
  if (host.includes("tourcaddiepro")) return [BACKENDS[1], BACKENDS[0]];
  return BACKENDS; // signupanytime primeiro por defeito
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
function flag(name, def = null) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = argv[i + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}
function bool(name) {
  return argv.includes(`--${name}`);
}

const SINCE_YEAR = parseInt(flag("since", "2025"), 10);
const ONLY_TCODES = (flag("tcodes", "") || "")
  .toString()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FORCE = bool("force");
const SKIP_EXISTING = !FORCE;
const CONCURRENCY = parseInt(flag("concurrency", "3"), 10);
const DELAY_MS = parseInt(flag("delay", "300"), 10);
const DRY_RUN = bool("dry-run");
const OUT_BATCH_SIZE = parseInt(flag("batch-size", "10"), 10);
const MAX_TOURNAMENTS = parseInt(flag("max", "0"), 10); // 0 = sem limite

// Filtros de categoria. Por defeito EXCLUI teen-series e teen-world
// (são divisões 13-18 anos, não relevantes para o tracker do Manuel).
const ONLY_CATS = (flag("only-cat", "") || "")
  .toString()
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const EXCLUDE_CATS_RAW = flag("exclude-cat", null);
const EXCLUDE_CATS = (EXCLUDE_CATS_RAW === null
  ? "teen-series,teen-world"
  : EXCLUDE_CATS_RAW.toString()
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJSONsafe(p, fallback) {
  try {
    const t = await fs.readFile(p, "utf-8");
    return JSON.parse(t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
  } catch {
    return fallback;
  }
}

async function fetchJSON(url, { method = "GET", retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        method,
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 (compatible; uskids-update/1.0)",
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      if (!txt.trim()) return null;
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function getMeta(t, apis) {
  // Tenta cada backend até obter um meta com flights
  for (const api of apis) {
    try {
      const r = await fetchJSON(`${api}?op=GetMeta&t=${t}`);
      if (r && r.flights && Object.keys(r.flights).length > 0) {
        return { meta: r, api };
      }
    } catch {}
  }
  // Devolve o último resultado mesmo que sem flights (para reportar erro)
  try {
    return { meta: await fetchJSON(`${apis[0]}?op=GetMeta&t=${t}`), api: apis[0] };
  } catch {
    return { meta: null, api: apis[0] };
  }
}

async function getPlayerTeeTimes(api, fid, round = 2, pageNum = 1) {
  // POST moderno (t=1 + jbgr + c=1) — funciona para torneios encerrados
  const jbgr = Date.now();
  const urlModern =
    `${api}?op=GetPlayerTeeTimes&f=${fid}&r=${round}&p=${pageNum}` +
    `&t=1&pt=undefined&jbgr=${jbgr}&c=1`;
  let d = await fetchJSON(urlModern, { method: "POST" }).catch(() => null);
  if (d && d.flight_players && Object.keys(d.flight_players).length > 0) return d;

  // Fallback ao legacy GET t=0 (alguns torneios abertos respondem só aqui)
  const urlLegacy = `${api}?op=GetPlayerTeeTimes&f=${fid}&r=${round}&p=${pageNum}&t=0`;
  d = await fetchJSON(urlLegacy).catch(() => null);
  return d;
}

async function getTournamentPlayers(api, tcode, fid) {
  const r = await fetchJSON(`${api}?op=GetTournamentPlayers&t=${tcode}&f=${fid}`);
  return r && Array.isArray(r.PlayerNodeId) ? r.PlayerNodeId.map(String) : [];
}

function tryMatchPidToMid(playersObj, memberIds) {
  const midSet = new Set(memberIds.map(String));
  const map = {};
  for (const [pid, pl] of Object.entries(playersObj || {})) {
    const candidates = [
      pl.node_id,
      pl.member_id,
      pl.member_node_id,
      pl.memberId,
      pl.nodeId,
      pl.mid,
      pid, // fallback: o próprio pid (raro mas testado em fetch-uskids-member-history.js)
    ]
      .filter((v) => v !== null && v !== undefined)
      .map(String);
    for (const cid of candidates) {
      if (midSet.has(cid)) {
        map[pid] = cid;
        break;
      }
    }
  }
  return map;
}

// ---------- Inventário dos batches existentes ----------
async function loadExisting() {
  const files = await fs.readdir(PUBLIC_DIR).catch(() => []);
  const batches = files.filter((f) => /^batch_\d+\.json$/.test(f)).sort();
  const tcodes = new Set();
  let maxBatchNum = 0;
  for (const fn of batches) {
    const m = fn.match(/^batch_(\d+)\.json$/);
    if (m) maxBatchNum = Math.max(maxBatchNum, parseInt(m[1], 10));
    const data = await readJSONsafe(path.join(PUBLIC_DIR, fn), []);
    for (const t of data) {
      const tc = String(t.signupanytime_t || t.tournament_id || "");
      if (tc) tcodes.add(tc);
    }
  }
  return { tcodes, maxBatchNum };
}

// ---------- Scrape de 1 torneio ----------
async function scrapeTournament(t) {
  const tcode = String(t.signupanytime_t);
  const result = {
    category: t.category,
    name: t.name,
    year: t.year,
    tournament_id: t.tournament_id,
    signupanytime_t: tcode,
    method: null,
    meta: null,
    flights: [],
    flight_count: 0,
    player_count: 0,
    error: null,
    scraped_at: new Date().toISOString(),
  };

  try {
    const apis = backendsFor(t);
    const { meta, api } = await getMeta(tcode, apis);
    if (!meta || !meta.flights || Object.keys(meta.flights).length === 0) {
      result.error = "no_flights_in_meta";
      result.method = "none";
      return result;
    }
    result.backend = api.includes("tourcaddiepro") ? "tourcaddiepro" : "signupanytime";

    result.meta = {
      tournament: meta.tournament,
      courses: meta.courses,
      age_groups: meta.age_groups,
      start_date: meta.start_date,
      end_date: meta.end_date,
      rounds: meta.rounds,
    };
    result.method = "meta";

    // Back-fill quando o tcode veio sem contexto (--tcodes com tcode ausente
    // da master list). Tira do GetMeta o nome e o ano para o registo ficar
    // consistente com os batches antigos.
    const metaName =
      (meta.tournament && (meta.tournament.name || meta.tournament.tournament_name)) ||
      null;
    const metaStart =
      meta.start_date ||
      (meta.tournament && meta.tournament.start_date) ||
      null;
    if (metaName && (!result.name || /^Unknown \(t=/.test(result.name))) {
      result.name = metaName;
    }
    if (metaStart && !result.year) {
      const m = String(metaStart).match(/(\d{4})/);
      if (m) result.year = parseInt(m[1], 10);
    }

    const flightIds = Object.keys(meta.flights);
    for (const fid of flightIds) {
      const agId = String(meta.flights[fid].age_group);
      const agName =
        (meta.age_groups[agId] && meta.age_groups[agId].name) || "Unknown";

      await sleep(DELAY_MS);
      const ptt = await getPlayerTeeTimes(api, fid).catch(() => null);
      const fpRaw = (ptt && ptt.flight_players) || {};

      await sleep(DELAY_MS);
      const memberIds = await getTournamentPlayers(api, tcode, fid).catch(() => []);
      const pidToMid = tryMatchPidToMid(fpRaw, memberIds);

      result.flights.push({
        flight_id: fid,
        flight_name: agName,
        age_group_id: agId,
        player_count: Object.keys(fpRaw).length,
        memberIds, // raw PlayerNodeId — para cross-ref downstream
        pid_to_member_id: pidToMid, // só matches directos
        data: ptt || { flight_players: {} },
      });

      result.player_count += Object.keys(fpRaw).length;
    }
    result.flight_count = result.flights.length;
  } catch (e) {
    result.error = e.message || String(e);
  }
  return result;
}

// ---------- Pool de concorrência ----------
async function pool(items, fn, concurrency) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch (e) {
        out[idx] = { error: e.message };
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

// ---------- Main ----------
(async () => {
  const master = await readJSONsafe(MASTER_LIST, []);
  if (!master.length) {
    console.error(`❌ Não encontrei a master list em ${MASTER_LIST}`);
    process.exit(1);
  }

  const { tcodes: doneTcodes, maxBatchNum } = await loadExisting();
  console.log(`Master list: ${master.length} torneios`);
  console.log(
    `Já scrapados (em batch_*.json): ${doneTcodes.size}  |  último batch: ${String(
      maxBatchNum
    ).padStart(3, "0")}`
  );

  let candidates;
  if (ONLY_TCODES.length) {
    // --tcodes BYPASSA o master list. Se um tcode não estiver lá, criamos
    // um registo mínimo — o GetMeta preenche o nome/categoria/ano depois.
    const knownByTcode = new Map(
      master
        .filter((t) => t.signupanytime_t)
        .map((t) => [String(t.signupanytime_t), t])
    );
    candidates = ONLY_TCODES.map((tc) => {
      const known = knownByTcode.get(tc);
      if (known) return known;
      return {
        signupanytime_t: tc,
        name: `Unknown (t=${tc})`,
        year: null,
        category: "unknown",
        tournament_id: null,
      };
    });
  } else {
    candidates = master.filter((t) => t.signupanytime_t);
    if (SINCE_YEAR)
      candidates = candidates.filter((t) => (t.year || 0) >= SINCE_YEAR);
    if (SKIP_EXISTING)
      candidates = candidates.filter(
        (t) => !doneTcodes.has(String(t.signupanytime_t))
      );
  }

  // Filtros de categoria (aplicam-se mesmo com --tcodes; passar
  // --exclude-cat "" desactiva todas as exclusões)
  if (ONLY_CATS.length) {
    candidates = candidates.filter((t) =>
      ONLY_CATS.includes((t.category || "").toLowerCase())
    );
  }
  if (EXCLUDE_CATS.length) {
    candidates = candidates.filter(
      (t) => !EXCLUDE_CATS.includes((t.category || "").toLowerCase())
    );
  }

  if (MAX_TOURNAMENTS > 0) candidates = candidates.slice(0, MAX_TOURNAMENTS);

  console.log(
    `Candidatos: ${candidates.length}  |  filtros: since=${SINCE_YEAR}, skip-existing=${SKIP_EXISTING}, tcodes=[${ONLY_TCODES.join(
      ","
    )}], only-cat=[${ONLY_CATS.join(",")}], exclude-cat=[${EXCLUDE_CATS.join(
      ","
    )}], concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms`
  );

  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    candidates
      .slice(0, 40)
      .forEach((t) =>
        console.log(
          `  ${t.year}  [${t.category}]  ${t.name}  (t=${t.signupanytime_t})`
        )
      );
    if (candidates.length > 40)
      console.log(`  ... +${candidates.length - 40} mais`);
    return;
  }

  if (!candidates.length) {
    console.log(
      "Nada a scrapar. Alarga a janela com --since 2024 ou força com --force --tcodes 21080,..."
    );
    return;
  }

  let processed = 0;
  let batchBuffer = [];
  let nextBatchNum = maxBatchNum + 1;
  let flushPromise = Promise.resolve();

  const flush = () => {
    flushPromise = flushPromise.then(async () => {
      if (!batchBuffer.length) return;
      const toSave = batchBuffer.slice();
      batchBuffer = [];
      const fn = `batch_${String(nextBatchNum).padStart(3, "0")}.json`;
      nextBatchNum++;
      // Formato COMPACTO — batches indentados inflam ~3x (5 MB → 15 MB).
      // Para inspecção use: node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('public/batch_NNN.json')),null,2))"
      await fs.writeFile(
        path.join(PUBLIC_DIR, fn),
        JSON.stringify(toSave),
        "utf-8"
      );
      console.log(`>>> Gravado ${fn} (${toSave.length} torneios)`);
    });
    return flushPromise;
  };

  const t0 = Date.now();
  await pool(
    candidates,
    async (t) => {
      const r = await scrapeTournament(t);
      processed++;
      const sec = Math.round((Date.now() - t0) / 1000);
      const tag = r.error ? ` ⚠ ${r.error}` : "";
      const be = r.backend ? ` via ${r.backend}` : "";
      console.log(
        `[${processed}/${candidates.length}] ${sec}s  ${t.year} [${t.category}] ${t.name}  →  ${r.flight_count} flights / ${r.player_count} jogadores${be}${tag}`
      );
      batchBuffer.push(r);
      if (batchBuffer.length >= OUT_BATCH_SIZE) await flush();
    },
    CONCURRENCY
  );

  await flush();
  await flushPromise;
  const min = Math.round((Date.now() - t0) / 60000);
  console.log(`\n✅ Concluído. ${processed} torneios em ${min} min.`);
})();
