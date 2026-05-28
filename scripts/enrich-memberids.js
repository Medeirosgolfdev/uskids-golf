#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * USKids — enriquece batches existentes com memberIds (Node 18+)
 * --------------------------------------------------------------
 * Os batches scrapados pelo PowerShell antigo só têm o `pid` local ao
 * flight (chave do `flight_players`). Este script chama GetTournamentPlayers
 * para cada flight e ADICIONA dois campos in place:
 *
 *   flight.memberIds        : ["591440", "591441", ...]  ← PlayerNodeId raw
 *   flight.pid_to_member_id : { "3112": "591440", ... }   ← matches directos
 *
 * NÃO refaz GetPlayerTeeTimes (não toca em data.flight_players). É puramente
 * aditivo. Idempotente: flights já enriquecidos são saltados (a menos que
 * passes --force).
 *
 * USO:
 *   cd C:\uskids-golf
 *
 *   # tudo (todos os batches que ainda têm flights sem memberIds)
 *   node scripts/enrich-memberids.js
 *
 *   # só um batch (para testar)
 *   node scripts/enrich-memberids.js --batches 18,19
 *
 *   # só torneios desde 2024
 *   node scripts/enrich-memberids.js --since 2024
 *
 *   # forçar refresh de flights já enriquecidos
 *   node scripts/enrich-memberids.js --force
 *
 *   # ver o que ia fazer
 *   node scripts/enrich-memberids.js --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const BACKENDS = [
  "https://www.signupanytime.com/plugins/links/admin/LinksAJAX.aspx",
  "https://tourcaddiepro.com/plugins/links/admin/LinksAJAX.aspx",
];

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

const ONLY_BATCHES = (flag("batches", "") || "")
  .toString()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => parseInt(s, 10))
  .filter((n) => !isNaN(n));

const SINCE_YEAR = parseInt(flag("since", "0"), 10);
const FORCE = bool("force");
const DRY_RUN = bool("dry-run");
const CONCURRENCY = parseInt(flag("concurrency", "3"), 10);
const DELAY_MS = parseInt(flag("delay", "200"), 10);
const TCODE_FILTER = (flag("tcodes", "") || "")
  .toString()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- Helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJSONsafe(p) {
  const t = await fs.readFile(p, "utf-8");
  return JSON.parse(t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
}

async function fetchJSON(url, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 (compatible; uskids-enrich/1.0)",
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
      if (attempt < retries - 1) await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function getTournamentPlayers(tcode, fid) {
  // Tenta cada backend até obter algo não-vazio
  for (const api of BACKENDS) {
    try {
      const r = await fetchJSON(`${api}?op=GetTournamentPlayers&t=${tcode}&f=${fid}`);
      const ids = r && Array.isArray(r.PlayerNodeId) ? r.PlayerNodeId.map(String) : [];
      if (ids.length > 0) return { ids, backend: api };
    } catch {}
  }
  return { ids: [], backend: null };
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
      pid,
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

// ---------- Concurrency ----------
async function pool(items, fn, concurrency) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx], idx);
      } catch (e) {
        console.error(`  ⚠ worker err em #${idx}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ---------- Main ----------
(async () => {
  const files = (await fs.readdir(PUBLIC_DIR))
    .filter((f) => /^batch_\d+\.json$/.test(f))
    .sort();
  if (!files.length) {
    console.error("❌ Nenhum batch_*.json encontrado em public/");
    process.exit(1);
  }

  console.log(
    `Batches encontrados: ${files.length}  |  filtros: batches=[${ONLY_BATCHES.join(
      ","
    )}], since=${SINCE_YEAR}, tcodes=[${TCODE_FILTER.join(
      ","
    )}], force=${FORCE}, concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms`
  );

  let totalTorn = 0;
  let totalFlightsCandidate = 0;
  let totalFlightsEnriched = 0;
  let totalFlightsSkipped = 0;
  let totalFlightsEmpty = 0;
  let totalBatchesWritten = 0;
  const t0 = Date.now();

  for (const fn of files) {
    const m = fn.match(/^batch_(\d+)\.json$/);
    const batchNum = parseInt(m[1], 10);
    if (ONLY_BATCHES.length && !ONLY_BATCHES.includes(batchNum)) continue;

    const fp = path.join(PUBLIC_DIR, fn);
    const data = await readJSONsafe(fp);
    if (!Array.isArray(data)) {
      console.log(`  ⚠ ${fn}: formato inesperado, skip`);
      continue;
    }

    let batchDirty = false;
    let batchFlightsEnriched = 0;
    let batchFlightsSkipped = 0;
    let batchFlightsEmpty = 0;

    // Filtra torneios deste batch que interessam
    const tornJobs = [];
    for (const t of data) {
      const year = t.year || (t.meta && t.meta.tournament && parseInt(String(t.meta.tournament.start_date || "").match(/(\d{4})/)?.[1] || "0", 10)) || 0;
      if (SINCE_YEAR && year && year < SINCE_YEAR) continue;
      const tcode = String(t.signupanytime_t || "");
      if (!tcode) continue;
      if (TCODE_FILTER.length && !TCODE_FILTER.includes(tcode)) continue;

      const flights = Array.isArray(t.flights) ? t.flights : [];
      for (const fl of flights) {
        const fid = String(fl.flight_id || "");
        if (!fid) continue;
        const has = Array.isArray(fl.memberIds) && fl.memberIds.length > 0;
        if (has && !FORCE) {
          batchFlightsSkipped++;
          continue;
        }
        tornJobs.push({ t, tcode, fl, fid });
      }
    }

    totalFlightsCandidate += tornJobs.length;

    if (DRY_RUN) {
      console.log(
        `  ${fn}: ${data.length} torneios  |  ${tornJobs.length} flights a enriquecer  |  ${batchFlightsSkipped} skip (já têm)`
      );
      totalFlightsSkipped += batchFlightsSkipped;
      continue;
    }

    if (!tornJobs.length) {
      console.log(
        `  ${fn}: ${data.length} torneios  |  0 a enriquecer  |  ${batchFlightsSkipped} já enriquecidos`
      );
      totalFlightsSkipped += batchFlightsSkipped;
      continue;
    }

    let doneInBatch = 0;
    await pool(
      tornJobs,
      async (job) => {
        await sleep(DELAY_MS);
        const { ids } = await getTournamentPlayers(job.tcode, job.fid);
        const flightPlayers =
          (job.fl.data && job.fl.data.flight_players) || {};
        job.fl.memberIds = ids;
        job.fl.pid_to_member_id = tryMatchPidToMid(flightPlayers, ids);
        if (ids.length > 0) batchFlightsEnriched++;
        else batchFlightsEmpty++;
        batchDirty = true;
        doneInBatch++;
      },
      CONCURRENCY
    );

    if (batchDirty) {
      // Compacto — batches indentados inflam ~3x. Preserva formato original.
      await fs.writeFile(fp, JSON.stringify(data), "utf-8");
      totalBatchesWritten++;
      console.log(
        `  ✅ ${fn}: ${doneInBatch} flights enriquecidos (${batchFlightsEnriched} com memberIds, ${batchFlightsEmpty} vazios) + ${batchFlightsSkipped} skip — gravado`
      );
    }

    totalTorn += data.length;
    totalFlightsEnriched += batchFlightsEnriched;
    totalFlightsEmpty += batchFlightsEmpty;
    totalFlightsSkipped += batchFlightsSkipped;
  }

  const min = Math.round((Date.now() - t0) / 60000);
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Total: ${totalTorn} torneios analisados, ${totalFlightsCandidate} flights candidatos`
  );
  console.log(
    `  ✅ ${totalFlightsEnriched} flights enriquecidos (memberIds não-vazios)`
  );
  console.log(
    `  ⚠  ${totalFlightsEmpty} flights vazios (GetTournamentPlayers devolveu [])`
  );
  console.log(
    `  ⏭️  ${totalFlightsSkipped} flights já tinham memberIds (usa --force para refazer)`
  );
  console.log(`  💾 ${totalBatchesWritten} batches gravados em ${min} min`);
})();
