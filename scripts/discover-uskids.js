#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * USKids Golf — discovery de torneios novos (Node 18+, sem dependências)
 * --------------------------------------------------------------------
 * Refaz a Fase 1+2 do pipeline original SEM browser console: fetch das
 * páginas de cada categoria em tournaments.uskidsgolf.com, parse do
 * dropdown <select id="edit-jump"> via regex, fetch das páginas
 * individuais e extracção do parâmetro signupanytime t= do iframe.
 *
 * Output: actualiza public/arquivo/all_tournaments_consolidated.json com
 * tcodes novos (preservando os existentes). Faz backup automático
 * (.bak-{timestamp}) antes de escrever.
 *
 * USO:
 *   cd C:\uskids-golf
 *
 *   # default: 2025+2026, todas as categorias relevantes (sem teen)
 *   node scripts/discover-uskids.js
 *
 *   # anos específicos
 *   node scripts/discover-uskids.js --years 2024,2025,2026
 *
 *   # incluir Teen Series (13-18)
 *   node scripts/discover-uskids.js --include-teen
 *
 *   # categorias específicas
 *   node scripts/discover-uskids.js --slugs world,regional
 *
 *   # ver o que ia descobrir sem chamar a API
 *   node scripts/discover-uskids.js --dry-run
 *
 * DEPOIS:
 *   node scripts/update-uskids.js --since 2026     # scrapar os novos
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

const BASE = "https://tournaments.uskidsgolf.com/tournaments";

// Mapeamento slug → category. Os 7 slugs documentados em RESUMO_PROJETO_USKIDS_v4.md.
const SLUG_MAP = {
  world: "world",
  regional: "regional",
  "teen-world": "teen-world",
  state: "state",
  "girls-invitationals": "girls-invitationals",
  "teen-series": "teen-series",
  "local-tours": "local-tours",
  international: "international",
};

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

const thisYear = new Date().getFullYear();
const YEARS = (flag("years", `${thisYear - 1},${thisYear}`) || "")
  .toString()
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((y) => y >= 2000 && y <= 2100);

const INCLUDE_TEEN = bool("include-teen");
const SLUGS = (flag("slugs", null) || "")
  .toString()
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

let targetSlugs = SLUGS.length ? SLUGS : Object.keys(SLUG_MAP);
if (!INCLUDE_TEEN && !SLUGS.length) {
  targetSlugs = targetSlugs.filter(
    (s) => s !== "teen-series" && s !== "teen-world"
  );
}

const CONCURRENCY = parseInt(flag("concurrency", "5"), 10);
const DELAY_MS = parseInt(flag("delay", "200"), 10);
const DRY_RUN = bool("dry-run");

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

async function fetchText(url, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; uskids-discover/1.0)",
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries - 1) await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr;
}

// Extrair tournament_ids do <select id="edit-jump">
function parseEditJump(html) {
  const selMatch = html.match(
    /<select[^>]*id=["']edit-jump["'][^>]*>([\s\S]*?)<\/select>/i
  );
  if (!selMatch) return [];
  const block = selMatch[1];
  const out = [];
  const optRe =
    /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = optRe.exec(block)) !== null) {
    const value = m[1];
    const text = m[2]
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "")
      .trim();
    const idMatch = value.match(/tournament_id=(\d+)/);
    if (idMatch && text) {
      out.push({ tournament_id: idMatch[1], name: text });
    }
  }
  return out;
}

// Extrair signupanytime/tourcaddiepro t= do iframe da página individual.
// A USKids migrou o front-end de www.signupanytime.com (ax=1129) para
// tourcaddiepro.com (ax=1661) algures em 2025. O backend (LinksAJAX.aspx) é
// o mesmo. Aqui basta procurar pelo path linksviews.aspx — funciona em
// ambos os domínios e em qualquer novo que apareça.
function parseSignupT(html) {
  const m =
    html.match(/linksviews\.aspx[^"']*[?&]t=(\d+)/) ||
    html.match(/(?:signupanytime\.com|tourcaddiepro\.com)[^"']*[?&]t=(\d+)/);
  return m ? m[1] : null;
}

// Também queremos saber o host do iframe para guardar (ax= e domínio),
// para o update-uskids saber a qual backend chamar.
function parseIframeHost(html) {
  const m = html.match(
    /<iframe[^>]+src=["']https?:\/\/([^/"']+)\/plugins\/links\/front\/linksviews\.aspx[^"']*[?&](?:ax=(\d+))?/i
  );
  if (!m) return null;
  return { host: m[1], ax: m[2] || null };
}

// ---------- Pool ----------
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
  console.log(
    `Slugs: ${targetSlugs.join(", ")}  |  Anos: ${YEARS.join(
      ", "
    )}  |  concurrency: ${CONCURRENCY}, delay: ${DELAY_MS}ms`
  );

  const master = await readJSONsafe(MASTER_LIST, []);

  // Indexar a master por tid. Para cada tid temos: o entry original + o seu
  // index na lista (para update in place quando re-fetch trouxer um t= novo).
  const masterByTid = new Map();
  master.forEach((t, idx) => {
    const tid = String(t.tournament_id || "");
    if (tid) masterByTid.set(tid, { entry: t, idx });
  });

  const knownTcodes = new Set(
    master.map((t) => String(t.signupanytime_t || "")).filter(Boolean)
  );
  console.log(
    `Master list actual: ${master.length} torneios (${knownTcodes.size} com t=)`
  );

  // ---- FASE 1: descobrir tournament_ids por (slug, ano) ----
  const phase1Jobs = [];
  for (const slug of targetSlugs) {
    for (const year of YEARS) {
      phase1Jobs.push({ slug, year });
    }
  }
  console.log(`\n[Fase 1] ${phase1Jobs.length} páginas listagem a apanhar...`);

  const discovered = []; // {slug, category, year, tournament_id, name}
  let p1done = 0;
  await pool(
    phase1Jobs,
    async ({ slug, year }) => {
      await sleep(DELAY_MS);
      const url = `${BASE}/${slug}/past-results?date%5Bvalue%5D%5Byear%5D=${year}`;
      try {
        const html = await fetchText(url);
        const items = parseEditJump(html);
        for (const it of items) {
          discovered.push({
            slug,
            category: SLUG_MAP[slug] || slug,
            year,
            tournament_id: it.tournament_id,
            name: it.name,
          });
        }
        p1done++;
        console.log(
          `  [${p1done}/${phase1Jobs.length}] ${slug}/${year}  →  ${items.length} torneios`
        );
      } catch (e) {
        p1done++;
        console.log(
          `  [${p1done}/${phase1Jobs.length}] ${slug}/${year}  ⚠ ${e.message}`
        );
      }
    },
    CONCURRENCY
  );

  console.log(
    `\n[Fase 1] Total descoberto: ${discovered.length} entradas (com duplicados entre anos)`
  );

  // Dedup por tournament_id, ficando com a entrada mais recente (ano maior)
  const byTid = new Map();
  for (const d of discovered) {
    const prev = byTid.get(d.tournament_id);
    if (!prev || (d.year || 0) > (prev.year || 0)) byTid.set(d.tournament_id, d);
  }
  const uniq = [...byTid.values()];

  // Candidatos a Fase 2 = entries que ainda não têm t= na master
  //   - tid novo (não está na master) → "novo"
  //   - tid existente mas master.entry.signupanytime_t == null → "re-fetch"
  // Ignoramos tids cujo master.entry.signupanytime_t já está preenchido —
  // assumimos que t= não muda ao longo do tempo para o mesmo torneio.
  const newTids = [];
  for (const d of uniq) {
    const cached = masterByTid.get(d.tournament_id);
    if (!cached) {
      d._kind = "new";
      newTids.push(d);
    } else if (!cached.entry.signupanytime_t) {
      d._kind = "refetch";
      d._existingIdx = cached.idx;
      newTids.push(d);
    }
  }
  const nNew = newTids.filter((d) => d._kind === "new").length;
  const nRefetch = newTids.filter((d) => d._kind === "refetch").length;
  console.log(
    `[Fase 1] Únicos: ${uniq.length}  |  Fase 2: ${newTids.length} (${nNew} novos + ${nRefetch} re-fetch de entries sem t=)`
  );

  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    newTids.slice(0, 40).forEach((d) =>
      console.log(
        `  ${d.year}  [${d.category}]  tid=${d.tournament_id}  ${d.name}`
      )
    );
    if (newTids.length > 40)
      console.log(`  ... +${newTids.length - 40} mais`);
    return;
  }

  if (!newTids.length) {
    console.log("\nNada novo. Master list já está actualizada para estes filtros.");
    return;
  }

  // ---- FASE 2: mapear tournament_id → signupanytime t= ----
  console.log(
    `\n[Fase 2] A apanhar signupanytime t= das ${newTids.length} páginas individuais...`
  );
  let p2done = 0;
  let p2hit = 0;
  await pool(
    newTids,
    async (d) => {
      await sleep(DELAY_MS);
      const url = `${BASE}/${d.slug}/past-results?date%5Bvalue%5D%5Byear%5D=${d.year}&tournament_id=${d.tournament_id}`;
      try {
        const html = await fetchText(url);
        d.signupanytime_t = parseSignupT(html);
        const iframe = parseIframeHost(html);
        if (iframe) {
          d.iframe_host = iframe.host;
          if (iframe.ax) d.ax = iframe.ax;
        }
        if (d.signupanytime_t) p2hit++;
      } catch (e) {
        d.signupanytime_t = null;
        d._error = e.message;
      }
      p2done++;
      if (p2done % 20 === 0 || p2done === newTids.length) {
        console.log(
          `  [${p2done}/${newTids.length}] com t=: ${p2hit}`
        );
      }
    },
    CONCURRENCY
  );

  console.log(
    `\n[Fase 2] Mapeados: ${p2hit}/${newTids.length} têm signupanytime t=`
  );

  // ---- Merge na master list ----
  // Novos → append; re-fetch → update in place (preserva ordem da master).
  const merged = master.slice();
  let appended = 0;
  let updated = 0;
  let updatedWithT = 0;
  for (const d of newTids) {
    const patch = {
      category: d.category,
      year: d.year,
      tournament_id: d.tournament_id,
      name: d.name,
      signupanytime_t: d.signupanytime_t,
    };
    if (d.iframe_host) patch.iframe_host = d.iframe_host;
    if (d.ax) patch.ax = d.ax;

    if (d._kind === "refetch") {
      const idx = d._existingIdx;
      const prev = merged[idx] || {};
      // Mantém campos antigos que possam ter valor (ex: tournament_id)
      merged[idx] = { ...prev, ...patch };
      updated++;
      if (d.signupanytime_t) updatedWithT++;
    } else {
      merged.push(patch);
      appended++;
    }
  }

  // Backup antes de escrever
  const backupPath = `${MASTER_LIST}.bak-${Date.now()}`;
  if (master.length) {
    await fs.writeFile(backupPath, JSON.stringify(master, null, 2), "utf-8");
    console.log(`Backup: ${path.basename(backupPath)}`);
  }

  await fs.writeFile(MASTER_LIST, JSON.stringify(merged, null, 2), "utf-8");

  const newWithT = newTids.filter(
    (d) => d._kind === "new" && d.signupanytime_t
  ).length;
  console.log(
    `\n✅ Master list: ${master.length} → ${merged.length}  (+${appended} novos, ${updated} actualizados)`
  );
  console.log(
    `   Com t= utilizável: ${newWithT} dos novos + ${updatedWithT} dos actualizados = ${newWithT + updatedWithT} prontos a scrapar.`
  );
  console.log(`\nPróximo passo:`);
  console.log(`   node scripts/update-uskids.js --since ${Math.min(...YEARS)}`);
})();
