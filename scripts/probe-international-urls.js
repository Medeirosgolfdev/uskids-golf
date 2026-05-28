#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * Probe de URLs do international-local (USKids)
 * ---------------------------------------------
 * Testa várias formas plausíveis de aceder à listagem de torneios por região
 * e reporta qual funciona, e qual o padrão do listing/dropdown.
 *
 * USO:
 *   node scripts/probe-international-urls.js
 */

const REGIONS_KNOWN = [
  // slug, id, label
  ["quito-ec", "504801", "Quito"],
  ["buenos-aires-ar", "498534", "Buenos Aires"],
  ["southern-italy-it", null, "Southern Italy"],
  ["rome-it", null, "Rome"],
  ["casablanca-ma", null, "Casablanca"],
  ["nairobi-ke", null, "Nairobi"],
  ["puerto-rico-pr", null, "Puerto Rico"],
  ["honduras-hn", "511520", "Honduras"],
];

const BASE = "https://tournaments.uskidsgolf.com";

// Padrões candidatos. {slug}, {id} são placeholders.
const PATTERNS = [
  `${BASE}/local-tours/{slug}/past-results`,
  `${BASE}/local-tours/{slug}`,
  `${BASE}/tournaments/local-tours/{slug}/past-results`,
  `${BASE}/tournaments/local-tours/{slug}`,
  `${BASE}/tournaments/international-local/{slug}/past-results`,
  `${BASE}/tournaments/international/{slug}/past-results`,
  `${BASE}/local-tours?region={id}`,
  `${BASE}/tournaments/local-tours?region={id}`,
];

// Também testar uma página "índice" possível
const INDEX_CANDIDATES = [
  `${BASE}/local-tours`,
  `${BASE}/tournaments/local-tours`,
  `${BASE}/tournaments/international-local`,
  `${BASE}/tournaments/international`,
];

async function probe(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; uskids-probe/1.0)" },
      redirect: "follow",
    });
    const txt = await r.text();
    const finalUrl = r.url;
    const hasEditJump = /<select[^>]*id=["']edit-jump["']/i.test(txt);
    const hasIframe = /<iframe[^>]+linksviews\.aspx/i.test(txt);
    const tournIdsCount = (txt.match(/tournament_id=\d+/g) || []).length;
    const regionDropdown = /<select[^>]*(?:region|location|country)[^>]*>/i.test(txt);
    return {
      ok: r.ok,
      status: r.status,
      bytes: txt.length,
      finalUrl: finalUrl !== url ? finalUrl : "",
      hasEditJump,
      hasIframe,
      tournIdsCount,
      regionDropdown,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  console.log("== ÍNDICES POSSÍVEIS ==");
  for (const url of INDEX_CANDIDATES) {
    const r = await probe(url);
    if (!r.ok) {
      console.log(`  ❌ ${url}  →  HTTP ${r.status || "ERR"}${r.error ? " " + r.error : ""}`);
      continue;
    }
    const flag = r.hasEditJump || r.tournIdsCount > 0 || r.regionDropdown ? "✅" : "⚠ ";
    console.log(
      `  ${flag} ${url}  →  HTTP ${r.status} (${r.bytes} bytes)  editJump=${r.hasEditJump} iframe=${r.hasIframe} tournIds=${r.tournIdsCount} regionDD=${r.regionDropdown}${
        r.finalUrl ? "  → " + r.finalUrl : ""
      }`
    );
  }

  console.log("\n== PADRÕES POR REGIÃO ==");
  for (const pattern of PATTERNS) {
    console.log(`\n--- pattern: ${pattern} ---`);
    for (const [slug, id, label] of REGIONS_KNOWN) {
      if (pattern.includes("{id}") && !id) continue; // skip se não tens id
      const url = pattern.replace("{slug}", slug).replace("{id}", id || "");
      const r = await probe(url);
      if (!r.ok) {
        console.log(`  ❌ ${label.padEnd(18)}  HTTP ${r.status || "ERR"}`);
      } else {
        const flag = r.hasEditJump || r.tournIdsCount > 0 ? "✅" : "⚠ ";
        console.log(
          `  ${flag} ${label.padEnd(18)}  HTTP ${r.status} (${String(r.bytes).padStart(6)} bytes)  editJump=${r.hasEditJump} iframe=${r.hasIframe} tournIds=${r.tournIdsCount}${
            r.finalUrl ? "  →  " + r.finalUrl : ""
          }`
        );
      }
      await new Promise((res) => setTimeout(res, 100));
    }
  }
})();
