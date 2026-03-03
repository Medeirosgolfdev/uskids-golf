import { useState, useMemo, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line, CartesianGrid } from "recharts";

/* DATA PROCESSING */
function extractAgeRange(category) {
  if (!category) return null;
  const c = category.replace(/\s+/g, " ").trim();
  const underM = c.match(/(\d+)\s*[&]?\s*Under/i);
  if (underM) return { min: 5, max: parseInt(underM[1]) };
  const rangeM = c.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeM) return { min: parseInt(rangeM[1]), max: parseInt(rangeM[2]) };
  const singleM = c.match(/\b(\d{1,2})\b/);
  if (singleM) { const age = parseInt(singleM[1]); if (age >= 5 && age <= 18) return { min: age, max: age }; }
  return null;
}
function extractGender(cat) { if (!cat) return "?"; if (/Girls/i.test(cat)) return "F"; if (/Boys/i.test(cat)) return "M"; return "?"; }
function estimateBirth(appearances) {
  const estimates = [];
  for (const a of appearances) { const range = extractAgeRange(a.category); if (range && a.year) { estimates.push(a.year - range.max); estimates.push(a.year - range.min); } }
  if (!estimates.length) return null;
  return Math.round(estimates.reduce((a, b) => a + b, 0) / estimates.length);
}
function canMerge(person, app) {
  if (person.gender !== "?" && app.gender !== "?" && person.gender !== app.gender) return false;
  if (person.appearances.some(a => a.tournKey === app.tournKey && a.category !== app.category)) return false;
  const appRange = extractAgeRange(app.category);
  if (appRange) {
    for (const prev of person.appearances) {
      const prevRange = extractAgeRange(prev.category); if (!prevRange) continue;
      const yearDiff = app.year - prev.year;
      if (yearDiff > 0) {
        if (appRange.max < prevRange.min - 1) return false;
        if (appRange.min > prevRange.max + yearDiff + 1) return false;
        const pb = prev.year - prevRange.max, ab = app.year - appRange.max;
        if (Math.abs(pb - ab) > 1) return false;
      } else if (yearDiff < 0) {
        if (prevRange.max < appRange.min - 1) return false;
        if (prevRange.min > appRange.max + Math.abs(yearDiff) + 1) return false;
        const pb = prev.year - prevRange.max, ab = app.year - appRange.max;
        if (Math.abs(pb - ab) > 1) return false;
      } else {
        if (appRange.min > prevRange.max + 1 || appRange.max < prevRange.min - 1) return false;
      }
    }
  }
  return true;
}

function processData(raw) {
  console.time("processData");
  const srcTournaments = raw.tournaments || [];
  const tournIndex = [], allApps = [];
  for (let ti = 0; ti < srcTournaments.length; ti++) {
    const t = srcTournaments[ti], flights = t.flights || {}, flightCats = t.flight_categories || {}, meta = t.meta || {}, ageGroups = meta.age_groups || {};
    const tKey = (t.tournament_id || t.name) + "_" + t.year;
    const tInfo = { key: tKey, name: t.name, year: t.year, date: meta.start_date || t.date || "", endDate: meta.end_date || "", courses: meta.courses || "", rounds: meta.rounds || null, numPlayers: t.num_players || 0, iframeUrl: t.iframe_url || null, tournamentId: t.tournament_id || null, categories: [] };
    const fKeys = Object.keys(flights); fKeys.sort((a, b) => { const na = parseInt(a), nb = parseInt(b); if (!isNaN(na) && !isNaN(nb)) return na - nb; return a.localeCompare(b); });
    for (const fId of fKeys) {
      const fl = flights[fId], fp = fl.flight_players || fl.players || {}, catName = flightCats[fId] || "Unknown", gender = extractGender(catName);
      let hpr = null; for (const ag of Object.values(ageGroups)) { if (ag.name === catName) { hpr = ag.holes_per_round; break; } }
      if (!hpr) { const ar = extractAgeRange(catName); hpr = (ar && ar.max <= 8) ? 9 : 18; }
      const catPlayers = [];
      for (const [pid, pd] of Object.entries(fp)) {
        const first = (pd.first || "").trim(), last = (pd.last || "").trim(), name = (first + " " + last).trim();
        if (!name || name === "Unknown Player") continue;
        const country = (pd.country || "").toUpperCase(), place = (pd.place || "").trim();
        const rnds = []; let totStrokes = 0;
        for (const [rn, rd] of Object.entries(pd.rounds || {})) { const strokes = (rd.strokes || []).filter(s => s > 0); const total = rd.num_strokes || strokes.reduce((a, b) => a + b, 0); rnds.push({ round: parseInt(rn), total, strokes, holes: rd.num_holes || strokes.length }); totStrokes += total; }
        rnds.sort((a, b) => a.round - b.round); const isWD = pd.status !== 1 || totStrokes === 0;
        const app = { first, last, name, country, place, gender, tournKey: tKey, tournament: t.name, year: t.year, date: meta.start_date || t.date || "", category: catName, hpr, course: meta.courses || "", iframeUrl: t.iframe_url || null, totalStrokes: isWD ? null : totStrokes, score: isWD ? null : pd.score, status: isWD ? "WD" : "OK", rounds: rnds };
        allApps.push(app);
        catPlayers.push({ name, country, place, gender, totalStrokes: isWD ? null : totStrokes, score: isWD ? null : pd.score, status: isWD ? "WD" : "OK", rounds: rnds });
      }
      catPlayers.sort((a, b) => { if (a.status !== b.status) return a.status === "OK" ? -1 : 1; if (a.totalStrokes == null) return 1; if (b.totalStrokes == null) return -1; return a.totalStrokes - b.totalStrokes; });
      let pos = 1; catPlayers.forEach((p, i) => { if (p.status !== "OK") { p.pos = "WD"; return; } p.pos = (i > 0 && p.totalStrokes === catPlayers[i - 1].totalStrokes) ? catPlayers[i - 1].pos : pos; pos = i + 2; });
      if (catPlayers.length > 0) tInfo.categories.push({ id: fId, name: catName, gender, hpr, players: catPlayers });
    }
    if (tInfo.categories.length > 0) tournIndex.push(tInfo);
  }
  const groups = new Map();
  for (const app of allApps) { const k = app.first.toLowerCase() + "|" + app.last.toLowerCase() + "|" + app.country.toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(app); }
  const players = []; let pid = 0;
  for (const [, apps] of groups) {
    const persons = []; apps.sort((a, b) => a.year - b.year || (a.date || "").localeCompare(b.date || ""));
    for (const app of apps) { let merged = false; for (const p of persons) { if (canMerge(p, app)) { p.appearances.push(app); if (p.gender === "?" && app.gender !== "?") p.gender = app.gender; merged = true; break; } } if (!merged) persons.push({ gender: app.gender, appearances: [app] }); }
    for (const p of persons) {
      const a0 = p.appearances[0]; let bestPlace = "";
      for (const a of p.appearances) if (a.place && a.place.length > bestPlace.length) bestPlace = a.place;
      p.appearances.sort((a, b) => a.year - b.year || (a.date || "").localeCompare(b.date || ""));
      const cats = [...new Set(p.appearances.map(a => a.category))], yrs = [...new Set(p.appearances.map(a => a.year))].sort(), tNames = [...new Set(p.appearances.map(a => a.tournament))];
      const okApps = p.appearances.filter(a => a.status === "OK" && a.totalStrokes); let bestScore = null, bestYear = null;
      if (okApps.length) { const best = okApps.reduce((b, a) => a.score < b.score ? a : b); bestScore = best.score; bestYear = best.year; }
      players.push({ id: pid++, name: a0.name, country: a0.country, place: bestPlace, gender: p.gender, birth: estimateBirth(p.appearances), appearances: p.appearances, categories: cats, years: yrs, tournNames: tNames, numT: tNames.length, bestScore, bestYear });
    }
  }
  players.sort((a, b) => b.numT - a.numT || a.name.localeCompare(b.name));
  const yrs = [...new Set(srcTournaments.map(t => t.year))].sort();
  const cc = {}; players.forEach(p => { cc[p.country] = (cc[p.country] || 0) + 1; });
  const topC = Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const tNames = [...new Set(srcTournaments.map(t => t.name))].sort();
  console.timeEnd("processData");
  return { players, tournaments: tournIndex, years: yrs, topCountries: topC, countryStats: cc, tournNames: tNames };
}

/* THEME & HELPERS */
const T = {
  bg: "#0a0f1a", card: "#141b2d", surface: "#f7f8fa", surfaceAlt: "#eef0f4",
  border: "#1e2a45", borderLight: "#e2e5eb",
  accent: "#22c55e", accentDark: "#15803d", accentSoft: "#dcfce7",
  gold: "#f59e0b", silver: "#94a3b8", bronze: "#d97706",
  text: "#e2e8f0", textMuted: "#64748b", textDark: "#1e293b", textBody: "#475569",
  blue: "#3b82f6", red: "#ef4444", pink: "#ec4899",
};
const flag = c => { if (!c || c.length !== 2) return ""; return String.fromCodePoint(...[...c.toUpperCase()].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)); };
const fmtS = s => s == null ? "-" : s === 0 ? "E" : s > 0 ? "+" + s : "" + s;
const sClr = s => { if (s == null) return {}; if (s <= 0) return { color: T.accent, fontWeight: 700 }; if (s <= 5) return { color: T.gold, fontWeight: 600 }; return { color: T.red }; };
function catStyle(cat) {
  if (!cat) return { background: "#f3f4f6", color: "#374151" };
  const g = /girl/i.test(cat);
  const ar = extractAgeRange(cat);
  const age = ar ? ar.min : 0;
  if (g) {
    if (age <= 7) return { background: "#fdf2f8", color: "#9d174d" };
    if (age <= 8) return { background: "#fce7f3", color: "#be185d" };
    if (age <= 9) return { background: "#fbcfe8", color: "#9d174d" };
    if (age <= 10) return { background: "#f9a8d4", color: "#831843" };
    if (age <= 11) return { background: "#f472b6", color: "#fff" };
    if (age <= 12) return { background: "#ec4899", color: "#fff" };
    if (age <= 14) return { background: "#db2777", color: "#fff" };
    return { background: "#be185d", color: "#fff" };
  }
  if (age <= 7) return { background: "#eff6ff", color: "#1d4ed8" };
  if (age <= 8) return { background: "#dbeafe", color: "#1e40af" };
  if (age <= 9) return { background: "#bfdbfe", color: "#1e3a8a" };
  if (age <= 10) return { background: "#93c5fd", color: "#1e3a8a" };
  if (age <= 11) return { background: "#60a5fa", color: "#fff" };
  if (age <= 12) return { background: "#3b82f6", color: "#fff" };
  if (age <= 14) return { background: "#2563eb", color: "#fff" };
  return { background: "#1d4ed8", color: "#fff" };
}

/* SCORE CELL: eagle=gold circle, birdie=red circle, par=neutral, bogey+=blue squares */
const _sc = (bg, fg, round) => ({ background: bg, color: fg, borderRadius: round ? "50%" : 0, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, lineHeight: 1 });
function scoreCell(stroke, parEst) {
  if (!stroke || stroke <= 0) return { text: "\u2013", style: { color: "#d1d5db" } };
  const diff = parEst ? stroke - parEst : null;
  if (diff !== null) {
    if (diff <= -2) return { text: stroke, style: _sc("#f59e0b", "#fff", true) };
    if (diff === -1) return { text: stroke, style: _sc("#ef4444", "#fff", true) };
    if (diff === 0) return { text: stroke, style: { fontWeight: 600, color: "#1e293b" } };
    if (diff === 1) return { text: stroke, style: _sc("#93c5fd", "#1e3a5f", false) };
    if (diff === 2) return { text: stroke, style: _sc("#60a5fa", "#fff", false) };
    return { text: stroke, style: _sc("#3b82f6", "#fff", false) };
  }
  if (stroke <= 2) return { text: stroke, style: _sc("#ef4444", "#fff", true) };
  if (stroke === 3) return { text: stroke, style: { fontWeight: 600, color: "#1e293b" } };
  if (stroke === 4) return { text: stroke, style: { fontWeight: 500, color: "#475569" } };
  if (stroke === 5) return { text: stroke, style: _sc("#93c5fd", "#1e3a5f", false) };
  if (stroke === 6) return { text: stroke, style: _sc("#60a5fa", "#fff", false) };
  return { text: stroke, style: _sc("#3b82f6", "#fff", false) };
}
function estPar(hpr) { return hpr && hpr <= 9 ? 3 : 4; }

const F = "'Outfit','DM Sans',-apple-system,sans-serif";
const FL = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap";
const pill = { fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 600, display: "inline-block", letterSpacing: 0.3 };
const pillSm = { fontSize: 9, padding: "2px 7px", borderRadius: 12, fontWeight: 600 };
const thS = { padding: "8px 10px", fontSize: 10, fontWeight: 700, color: T.textMuted, borderBottom: "2px solid " + T.borderLight, position: "sticky", top: 0, background: T.surface, zIndex: 1, textTransform: "uppercase", letterSpacing: 0.8 };
const tdS = { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid " + T.borderLight };
const inpS = { width: "100%", padding: "9px 12px", fontSize: 12, borderRadius: 10, border: "1px solid " + T.borderLight, outline: "none", boxSizing: "border-box", fontFamily: F, background: "#fff" };

/* DASHBOARD */
function Dashboard({ data, onNavigate }) {
  const stats = useMemo(() => {
    const tournByYear = {}, playersByYear = {};
    for (const t of data.tournaments) { (tournByYear[t.year] ||= []).push(t); }
    for (const p of data.players) { for (const y of p.years) { (playersByYear[y] ||= new Set()).add(p.id); } }
    const yearData = data.years.map(y => ({ year: y, tournaments: (tournByYear[y] || []).length, players: (playersByYear[y] || new Set()).size }));
    const topCountries = Object.entries(data.countryStats).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => ({ country: c, flag: flag(c), count: n }));
    const genderCount = { M: 0, F: 0 }; data.players.forEach(p => { if (p.gender === "M" || p.gender === "F") genderCount[p.gender]++; });
    const veterans = [...data.players].sort((a, b) => b.numT - a.numT).slice(0, 10);
    const bestScorers = data.players.filter(p => p.bestScore != null).sort((a, b) => a.bestScore - b.bestScore).slice(0, 10);
    const catCount = {}; data.players.forEach(p => p.categories.forEach(c => { catCount[c] = (catCount[c] || 0) + 1; }));
    const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => ({ name: c, count: n }));
    return { yearData, topCountries, genderCount, veterans, bestScorers, topCats };
  }, [data]);
  const CL = [T.accent, T.blue, T.gold, T.pink, "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#e11d48", "#6366f1"];
  const StatCard = ({ label, value, sub, icon }) => (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.textDark, fontFamily: F, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textBody, marginTop: 4 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", background: T.surface, padding: "24px 28px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.textDark, fontFamily: F }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textBody }}>Visao global dos dados USKids Golf International</p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard icon="\u{1F3C6}" label="Torneios" value={data.tournaments.length} sub={data.years[0] + " \u2014 " + data.years[data.years.length-1]} />
          <StatCard icon="\u{1F464}" label="Jogadores" value={data.players.length.toLocaleString()} sub={stats.genderCount.M + " rapazes \u00B7 " + stats.genderCount.F + " raparigas"} />
          <StatCard icon="\u{1F30D}" label="Paises" value={Object.keys(data.countryStats).length} sub={"Top: " + data.topCountries.slice(0, 3).map(c => flag(c)).join(" ")} />
          <StatCard icon="\u2B50" label="Veterano" value={stats.veterans[0] ? stats.veterans[0].numT + "T" : "-"} sub={stats.veterans[0] ? stats.veterans[0].name : "-"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Torneios por ano</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.yearData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }} />
                <Bar dataKey="tournaments" fill={T.accent} radius={[4, 4, 0, 0]} name="Torneios" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Jogadores ativos por ano</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.yearData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={T.blue} stopOpacity={0.02} /></linearGradient></defs>
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }} />
                <Area type="monotone" dataKey="players" stroke={T.blue} fill="url(#gP)" strokeWidth={2} name="Jogadores" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Top paises</div>
            {stats.topCountries.map((c, i) => (
              <div key={c.country} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < stats.topCountries.length - 1 ? "1px solid " + T.borderLight : "none" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, width: 18, textAlign: "right" }}>{i + 1}</span>
                <span style={{ fontSize: 16 }}>{c.flag}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark, flex: 1 }}>{c.country}</span>
                <div style={{ width: 120, height: 6, background: T.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: (c.count / stats.topCountries[0].count * 100) + "%", height: "100%", background: CL[i % CL.length], borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textBody, minWidth: 36, textAlign: "right" }}>{c.count}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Mais torneios disputados</div>
            {stats.veterans.map((p, i) => (
              <div key={p.id} onClick={() => onNavigate("players", p.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < 9 ? "1px solid " + T.borderLight : "none", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? [T.gold, T.silver, T.bronze][i] : T.textMuted, width: 18, textAlign: "right" }}>{i + 1}</span>
                <span style={{ fontSize: 14 }}>{flag(p.country)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark, flex: 1 }}>{p.name}</span>
                <span style={{ ...pillSm, background: p.gender === "F" ? "#fce7f3" : "#dbeafe", color: p.gender === "F" ? "#9d174d" : "#1d4ed8" }}>{p.gender === "F" ? "\u2640" : "\u2642"}</span>
                <span style={{ ...pillSm, background: T.accentSoft, color: T.accentDark }}>{p.numT}T</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Melhores scores (vs par)</div>
            {stats.bestScorers.map((p, i) => (
              <div key={p.id} onClick={() => onNavigate("players", p.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < 9 ? "1px solid " + T.borderLight : "none", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? [T.gold, T.silver, T.bronze][i] : T.textMuted, width: 18, textAlign: "right" }}>{i + 1}</span>
                <span style={{ fontSize: 14 }}>{flag(p.country)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textDark, flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, ...sClr(p.bestScore) }}>{fmtS(p.bestScore)}</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>{p.bestYear}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid " + T.borderLight }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textDark, marginBottom: 14 }}>Categorias mais populares</div>
            {stats.topCats.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < stats.topCats.length - 1 ? "1px solid " + T.borderLight : "none" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, width: 18, textAlign: "right" }}>{i + 1}</span>
                <span style={{ ...pillSm, ...catStyle(c.name) }}>{c.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textBody }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* RANKINGS */
function Rankings({ data, onNavigate }) {
  const [mode, setMode] = useState("country");
  const [limit, setLimit] = useState(20);
  const rankings = useMemo(() => {
    if (mode === "country") {
      return Object.entries(data.countryStats).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([c, n], i) => {
        const pls = data.players.filter(p => p.country === c);
        const avgT = pls.length ? (pls.reduce((s, p) => s + p.numT, 0) / pls.length).toFixed(1) : 0;
        const topPlayer = [...pls].sort((a, b) => b.numT - a.numT)[0];
        return { rank: i + 1, key: c, label: c, flag: flag(c), count: n, avgT, top: topPlayer ? topPlayer.name : "" };
      });
    }
    if (mode === "veterans") {
      return [...data.players].sort((a, b) => b.numT - a.numT).slice(0, limit).map((p, i) => ({
        rank: i + 1, key: p.id, id: p.id, label: p.name, flag: flag(p.country), country: p.country, gender: p.gender,
        numT: p.numT, years: p.years[0] + "\u2013" + p.years[p.years.length-1], bestScore: p.bestScore, categories: p.categories,
      }));
    }
    if (mode === "scores") {
      return data.players.filter(p => p.bestScore != null).sort((a, b) => a.bestScore - b.bestScore).slice(0, limit).map((p, i) => ({
        rank: i + 1, key: p.id, id: p.id, label: p.name, flag: flag(p.country), country: p.country, gender: p.gender,
        bestScore: p.bestScore, bestYear: p.bestYear, numT: p.numT, categories: p.categories,
      }));
    }
    if (mode === "tournament") {
      const tCount = {}; data.players.forEach(p => p.tournNames.forEach(t => { tCount[t] = (tCount[t] || 0) + 1; }));
      return Object.entries(tCount).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t, n], i) => {
        const editions = data.tournaments.filter(x => x.name === t).length;
        return { rank: i + 1, key: t, label: t, count: n, editions };
      });
    }
    return [];
  }, [data, mode, limit]);
  const tabs = [["country", "\u{1F30D} Pais"], ["veterans", "\u{1F3C5} Veteranos"], ["scores", "\u26F3 Scores"], ["tournament", "\u{1F3C6} Torneios"]];
  return (
    <div style={{ flex: 1, overflowY: "auto", background: T.surface, padding: "24px 28px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: T.textDark, fontFamily: F }}>Rankings</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textBody }}>Top classificacoes por diferentes criterios</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: mode === k ? T.accent : "#fff", color: mode === k ? "#fff" : T.textBody, borderRadius: 10, fontFamily: F, boxShadow: mode === k ? "0 2px 12px " + T.accent + "40" : "0 1px 3px rgba(0,0,0,0.06)" }}>{l}</button>
          ))}
          <select value={limit} onChange={e => setLimit(+e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid " + T.borderLight, fontSize: 11, fontFamily: F, background: "#fff" }}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid " + T.borderLight, overflow: "hidden" }}>
          {mode === "country" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ ...thS, width: 40, textAlign: "center" }}>#</th>
                <th style={{ ...thS, textAlign: "left" }}>Pais</th>
                <th style={{ ...thS, textAlign: "right" }}>Jogadores</th>
                <th style={{ ...thS, textAlign: "right" }}>Media T/Jog</th>
                <th style={{ ...thS, textAlign: "left" }}>Top jogador</th>
              </tr></thead>
              <tbody>{rankings.map((r, i) => (
                <tr key={r.key} style={{ background: i % 2 ? T.surfaceAlt : "#fff" }}>
                  <td style={{ ...tdS, textAlign: "center", fontWeight: 800, color: i < 3 ? [T.gold, T.silver, T.bronze][i] : T.textMuted }}>{r.rank}</td>
                  <td style={{ ...tdS, fontWeight: 700 }}>{r.flag} {r.label}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{r.count}</td>
                  <td style={{ ...tdS, textAlign: "right", color: T.textMuted }}>{r.avgT}</td>
                  <td style={{ ...tdS, color: T.textBody }}>{r.top}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {(mode === "veterans" || mode === "scores") && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ ...thS, width: 40, textAlign: "center" }}>#</th>
                <th style={{ ...thS, width: 30 }}></th>
                <th style={{ ...thS, textAlign: "left" }}>Jogador</th>
                <th style={{ ...thS, textAlign: "center", width: 30 }}></th>
                <th style={{ ...thS, textAlign: "right" }}>{mode === "veterans" ? "Torneios" : "Score"}</th>
                <th style={{ ...thS, textAlign: "right" }}>{mode === "veterans" ? "Anos" : "Torneios"}</th>
                <th style={{ ...thS, textAlign: "left" }}>Categorias</th>
              </tr></thead>
              <tbody>{rankings.map((r, i) => (
                <tr key={r.key} onClick={() => onNavigate("players", r.id)} style={{ background: i % 2 ? T.surfaceAlt : "#fff", cursor: "pointer" }}>
                  <td style={{ ...tdS, textAlign: "center", fontWeight: 800, color: i < 3 ? [T.gold, T.silver, T.bronze][i] : T.textMuted }}>{r.rank}</td>
                  <td style={{ ...tdS, fontSize: 15 }}>{r.flag}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: T.textDark }}>{r.label}</td>
                  <td style={{ ...tdS, textAlign: "center" }}><span style={{ ...pillSm, background: r.gender === "F" ? "#fce7f3" : "#dbeafe", color: r.gender === "F" ? "#9d174d" : "#1d4ed8" }}>{r.gender === "F" ? "\u2640" : "\u2642"}</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, ...(mode === "scores" ? sClr(r.bestScore) : { color: T.accent }) }}>{mode === "veterans" ? r.numT : fmtS(r.bestScore)}</td>
                  <td style={{ ...tdS, textAlign: "right", color: T.textMuted }}>{mode === "veterans" ? r.years : r.numT + "T"}</td>
                  <td style={{ ...tdS }}><div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{(r.categories || []).slice(0, 3).map(c => <span key={c} style={{ ...pillSm, ...catStyle(c) }}>{c}</span>)}{(r.categories || []).length > 3 && <span style={{ ...pillSm, background: "#f3f4f6", color: T.textMuted }}>+{r.categories.length - 3}</span>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {mode === "tournament" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ ...thS, width: 40, textAlign: "center" }}>#</th>
                <th style={{ ...thS, textAlign: "left" }}>Torneio</th>
                <th style={{ ...thS, textAlign: "right" }}>Jogadores (total)</th>
                <th style={{ ...thS, textAlign: "right" }}>Edicoes</th>
              </tr></thead>
              <tbody>{rankings.map((r, i) => (
                <tr key={r.key} style={{ background: i % 2 ? T.surfaceAlt : "#fff" }}>
                  <td style={{ ...tdS, textAlign: "center", fontWeight: 800, color: i < 3 ? [T.gold, T.silver, T.bronze][i] : T.textMuted }}>{r.rank}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: T.textDark }}>{r.label}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{r.count}</td>
                  <td style={{ ...tdS, textAlign: "right", color: T.textMuted }}>{r.editions}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const tabSt = a => ({ padding: "10px 18px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: a ? "#fff" : "transparent", color: a ? T.accent : T.textMuted, borderBottom: a ? "2px solid " + T.accent : "2px solid transparent", fontFamily: F });

/* TOURNAMENT DETAIL */
function TournDetail({ tourn, onPlayerClick }) {
  const [ci, setCi] = useState(0);
  const cat = tourn.categories[ci] || tourn.categories[0];
  const [showHBH, setShowHBH] = useState(false);

  if (!cat) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: T.textMuted }}>Sem categorias</div>;

  const hbhPlayers = cat.players.filter(p => p.rounds.some(r => r.strokes?.length > 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg,#f8fafc,#eff6ff)", flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{tourn.name}</h2>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>📅 {tourn.date}{tourn.endDate ? " → " + tourn.endDate : ""}</span>
          <span>📍 {tourn.courses || "–"}</span>
          {tourn.rounds && <span>🔄 {tourn.rounds}R</span>}
          <span>👤 {tourn.numPlayers} jog</span>
          <span>{tourn.categories.length} cats</span>
        </div>
        {(tourn.iframeUrl || tourn.tournamentId) && (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {tourn.iframeUrl && <a href={tourn.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.blue, textDecoration: "none", fontWeight: 600 }}>📊 Resultados ↗</a>}
            {tourn.tournamentId && <a href={`https://www.uskidsgolf.com/tournaments/${tourn.tournamentId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.blue, textDecoration: "none", fontWeight: 600 }}>⛳ USKids ↗</a>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 3, padding: "6px 10px", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", background: "#fafafa", flexShrink: 0 }}>
        {tourn.categories.map((c, i) => {
          const s = catStyle(c.name); const act = ci === i;
          return <button key={c.id} onClick={() => { setCi(i); setShowHBH(false); }} style={{ ...pillSm, ...s, border: "none", cursor: "pointer", opacity: act ? 1 : 0.5, boxShadow: act ? `0 0 0 2px ${s.color}40` : "none", padding: "3px 10px" }}>{c.name} ({c.players.length})</button>;
        })}
      </div>
      <div style={{ padding: "4px 14px", fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
        {cat.name} · {cat.hpr || "?"}h · {cat.players.length} jogadores
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...thS, textAlign: "center", width: 36 }}>Pos</th>
            <th style={{ ...thS, width: 22 }}></th>
            <th style={{ ...thS, textAlign: "left" }}>Jogador</th>
            <th style={{ ...thS, textAlign: "left", width: 90 }}>Local</th>
            {(cat.players[0]?.rounds || []).map((_, i) => <th key={i} style={{ ...thS, textAlign: "center", width: 42 }}>R{i + 1}</th>)}
            <th style={{ ...thS, textAlign: "center", width: 46 }}>Tot</th>
            <th style={{ ...thS, textAlign: "center", width: 40 }}>±</th>
          </tr></thead>
          <tbody>
            {cat.players.map((p, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={{ ...tdS, textAlign: "center", fontWeight: 700, color: typeof p.pos === "number" && p.pos <= 3 ? T.blue : T.textDark }}>{p.pos}</td>
                <td style={{ ...tdS, fontSize: 13 }}>{flag(p.country)}</td>
                <td style={{ ...tdS, fontWeight: 600 }}><span style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }} onClick={() => onPlayerClick?.(p.name, p.country, p.gender || cat.gender)}>{p.name}</span></td>
                <td style={{ ...tdS, color: T.textMuted, fontSize: 11 }}>{p.place}</td>
                {p.rounds.map((r, ri) => <td key={ri} style={{ ...tdS, textAlign: "center", color: T.textMuted }}>{r.total || "–"}</td>)}
                <td style={{ ...tdS, textAlign: "center", fontWeight: 700 }}>{p.totalStrokes || "–"}</td>
                <td style={{ ...tdS, textAlign: "center", ...sClr(p.score) }}>{fmtS(p.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hbhPlayers.length > 0 && <>
          <button onClick={() => setShowHBH(!showHBH)} style={{ width: "100%", padding: "8px 14px", border: "none", borderTop: "1px solid #e5e7eb", cursor: "pointer", background: "#f9fafb", textAlign: "left", fontSize: 12, fontWeight: 600, color: T.textDark }}>
            {showHBH ? "▼" : "▶"} Scorecards ({hbhPlayers.length})
          </button>
          {showHBH && <div style={{ overflowX: "auto", padding: "0 8px 12px" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, color: T.textMuted, position: "sticky", left: 0, background: "#f8fafc", zIndex: 2, minWidth: 120 }}>Jogador</th>
                <th style={{ padding: "4px 3px", fontSize: 9, color: T.textMuted }}>R</th>
                {Array.from({ length: cat.hpr || 9 }, (_, i) => <th key={i} style={{ padding: "4px 3px", textAlign: "center", fontSize: 10, color: T.textMuted, minWidth: 22 }}>{i + 1}</th>)}
                <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Tot</th>
              </tr></thead>
              <tbody>
                {hbhPlayers.map((p, pi) => {
                  const validRnds = p.rounds.filter(r => r.strokes?.length > 0);
                  return validRnds.map((r, ri) => (
                    <tr key={`${pi}-${ri}`} style={{ borderBottom: ri === validRnds.length - 1 ? "2px solid #e5e7eb" : "1px solid #f3f4f6" }}>
                      {ri === 0 && <td rowSpan={validRnds.length} style={{ padding: "3px 8px", fontWeight: 600, fontSize: 11, position: "sticky", left: 0, background: pi % 2 ? "#f9fafb" : "#fff", zIndex: 1, verticalAlign: "top" }}>{flag(p.country)} {p.name}</td>}
                      <td style={{ padding: "3px 3px", textAlign: "center", color: T.textMuted, fontSize: 10 }}>R{r.round}</td>
                      {r.strokes.map((s, si) => { const sc = scoreCell(s, estPar(cat ? cat.hpr : 18)); return <td key={si} style={{ padding: "3px 2px", textAlign: "center", verticalAlign: "middle" }}><span style={{ ...sc.style, margin: "0 auto" }}>{sc.text}</span></td>; })}
                      {Array.from({ length: Math.max(0, (cat.hpr || 9) - r.strokes.length) }, (_, i) => <td key={`p${i}`} style={{ padding: "3px 3px", textAlign: "center", color: "#e5e7eb" }}>–</td>)}
                      <td style={{ padding: "3px 6px", textAlign: "right", fontWeight: 700 }}>{r.total}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>}
        </>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PLAYER DETAIL
   ═══════════════════════════════════════════ */

/* PLAYER DETAIL */
function PDetail({ player }) {
  const [tab, setTab] = useState("history");
  const byYear = useMemo(() => {
    const m = {};
    for (const a of player.appearances) { (m[a.year] ||= []).push(a); }
    return m;
  }, [player]);
  const yrs = Object.keys(byYear).sort((a, b) => b - a);
  const hist = useMemo(() => player.appearances.filter(a => a.status === "OK" && a.totalStrokes), [player]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg,#f8fafc,#eff6ff)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 24 }}>{flag(player.country)}</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{player.name}</h2>
            <div style={{ fontSize: 11, color: T.textMuted }}>{player.place} · {player.country}</div>
          </div>
          <span style={{ ...pill, background: player.gender === "F" ? "#fce7f3" : "#dbeafe", color: player.gender === "F" ? "#9d174d" : "#1d4ed8" }}>{player.gender === "F" ? "♀ Girls" : "♂ Boys"}</span>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {player.birth && <span style={{ ...pill, background: "#f3e8ff", color: "#7c3aed" }}>~{player.birth}</span>}
          <span style={{ ...pill, background: "#dbeafe", color: "#1d4ed8" }}>{player.numT}T</span>
          <span style={{ ...pill, background: "#d1fae5", color: "#065f46" }}>{player.years[0]}–{player.years[player.years.length - 1]}</span>
          {player.bestScore != null && <span style={{ ...pill, background: "#fef3c7", color: "#92400e" }}>Best: {fmtS(player.bestScore)} ({player.bestYear})</span>}
          {player.categories.map(c => <span key={c} style={{ ...pillSm, ...catStyle(c) }}>{c}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        {[["history", "📋 Histórico"], ["evolution", "📈 Evolução"], ["hbh", "⛳ Hole-by-Hole"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={tabSt(tab === k)}>{l}</button>)}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {tab === "history" && yrs.map(yr => (
          <div key={yr} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.accentDark, borderBottom: "2px solid #dbeafe", marginBottom: 5, paddingBottom: 3 }}>
              {yr} <span style={{ fontSize: 11, fontWeight: 400, color: T.textMuted }}>{byYear[yr].length}T</span>
            </div>
            {byYear[yr].map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: i % 2 ? "#fff" : "#f9fafb", borderRadius: 4, fontSize: 12, flexWrap: "wrap", marginBottom: 1 }}>
                <span style={{ ...pillSm, ...catStyle(a.category), minWidth: 65, textAlign: "center" }}>{a.category}</span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 130 }}>{a.tournament}{a.iframeUrl && <a href={a.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, fontSize: 10, color: T.blue, textDecoration: "none" }}>↗</a>}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>{a.hpr}h×{a.rounds.length}R</span>
                {a.status === "OK" ? <>
                  <span style={{ fontWeight: 700, minWidth: 32, textAlign: "right" }}>{a.totalStrokes}</span>
                  <span style={{ ...sClr(a.score), minWidth: 32, textAlign: "right" }}>{fmtS(a.score)}</span>
                  {a.rounds.map((r, ri) => <span key={ri} style={{ fontSize: 10, color: T.textMuted }}>R{r.round}:{r.total}</span>)}
                </> : <span style={{ color: "#ef4444", fontWeight: 600 }}>WD</span>}
              </div>
            ))}
          </div>
        ))}
        {tab === "evolution" && (!hist.length ? <div style={{ fontSize: 11, color: T.textMuted }}>Sem dados</div> : <div>
          {hist.length > 1 && <div style={{ marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={hist.map(a => ({ label: a.tournament.substring(0, 12) + " " + a.year, score: a.score }))} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: T.textMuted }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: T.textMuted }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }} />
                <Line type="monotone" dataKey="score" stroke={T.accent} strokeWidth={2} dot={{ r: 4, fill: T.accent }} name="Score vs Par" />
              </LineChart>
            </ResponsiveContainer>
          </div>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={{ ...thS, textAlign: "left" }}>Torneio</th>
              <th style={{ ...thS, textAlign: "center" }}>Cat</th>
              <th style={{ ...thS, textAlign: "right" }}>Total</th>
              <th style={{ ...thS, textAlign: "right" }}>±</th>
            </tr></thead>
            <tbody>{hist.map((a, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={{ ...tdS, fontWeight: 500 }}>{a.tournament} {a.year}{a.iframeUrl && <a href={a.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, fontSize: 10, color: T.blue, textDecoration: "none" }}>↗</a>}</td>
                <td style={{ ...tdS, textAlign: "center" }}><span style={{ ...pillSm, ...catStyle(a.category) }}>{a.category}</span></td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{a.totalStrokes}</td>
                <td style={{ ...tdS, textAlign: "right", ...sClr(a.score) }}>{fmtS(a.score)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>)}
        {tab === "hbh" && (() => {
          const wh = player.appearances.filter(a => a.status === "OK" && a.rounds.some(r => r.strokes?.length > 0));
          if (!wh.length) return <div style={{ fontSize: 11, color: T.textMuted }}>Sem dados hole-by-hole</div>;
          return wh.map((a, ai) => (
            <div key={ai} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ ...pillSm, ...catStyle(a.category) }}>{a.category}</span> {a.tournament} ({a.year}){a.iframeUrl && <a href={a.iframeUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, fontSize: 10, color: T.blue, textDecoration: "none" }}>↗</a>}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "3px 8px", textAlign: "left", fontSize: 10, color: T.textMuted }}>R</th>
                    {Array.from({ length: a.hpr || 9 }, (_, i) => <th key={i} style={{ padding: "3px 3px", textAlign: "center", fontSize: 10, color: T.textMuted, minWidth: 22 }}>{i + 1}</th>)}
                    <th style={{ padding: "3px 8px", textAlign: "right", fontWeight: 700, fontSize: 10 }}>Tot</th>
                  </tr></thead>
                  <tbody>{a.rounds.filter(r => r.strokes?.length > 0).map((r, ri) => (
                    <tr key={ri}>
                      <td style={{ padding: "3px 8px", fontWeight: 600 }}>R{r.round}</td>
                      {r.strokes.map((s, si) => { const sc = scoreCell(s, estPar(a.hpr)); return <td key={si} style={{ padding: "3px 2px", textAlign: "center", verticalAlign: "middle" }}><span style={{ ...sc.style, margin: "0 auto" }}>{sc.text}</span></td>; })}
                      {Array.from({ length: Math.max(0, (a.hpr || 9) - r.strokes.length) }, (_, i) => <td key={`p${i}`} style={{ padding: "3px", textAlign: "center", color: "#e5e7eb" }}>–</td>)}
                      <td style={{ padding: "3px 8px", textAlign: "right", fontWeight: 700 }}>{r.total}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

/* MAIN APP */
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selTourn, setSelTourn] = useState(null);
  const [selPlayer, setSelPlayer] = useState(null);
  const [search, setSearch] = useState("");
  const [countryF, setCountryF] = useState("all");
  const [tournF, setTournF] = useState("all");
  const [genderF, setGenderF] = useState("all");
  const [sortBy, setSortBy] = useState("tournaments");
  const [tSearch, setTSearch] = useState("");
  const [tYearF, setTYearF] = useState("all");
  const fileRef = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError(null); setStatus("A ler ficheiro...");
    try {
      const text = await file.text();
      setStatus("A processar JSON...");
      await new Promise(r => setTimeout(r, 50));
      const raw = JSON.parse(text);
      setStatus("A indexar torneios e jogadores...");
      await new Promise(r => setTimeout(r, 50));
      const result = processData(raw);
      setData(result); setSelTourn(null); setSelPlayer(null); setView("dashboard");
    } catch (err) { setError("Erro: " + err.message); }
    setLoading(false); setStatus("");
  }, []);

  const filteredTourns = useMemo(() => {
    if (!data) return [];
    let list = data.tournaments;
    if (tYearF !== "all") list = list.filter(t => t.year === parseInt(tYearF));
    if (tSearch) { const q = tSearch.toLowerCase(); list = list.filter(t => t.name.toLowerCase().includes(q) || (t.courses || "").toLowerCase().includes(q)); }
    return list.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  }, [data, tYearF, tSearch]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    let list = data.players;
    if (search) { const q = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.place.toLowerCase().includes(q) || p.country.toLowerCase().includes(q)); }
    if (countryF !== "all") list = list.filter(p => p.country === countryF);
    if (genderF !== "all") list = list.filter(p => p.gender === genderF);
    if (tournF !== "all") list = list.filter(p => p.tournNames.includes(tournF));
    if (sortBy === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "country") return [...list].sort((a, b) => (a.country || "").localeCompare(b.country || ""));
    if (sortBy === "recent") return [...list].sort((a, b) => b.years[b.years.length - 1] - a.years[a.years.length - 1]);
    return list;
  }, [data, search, countryF, genderF, tournF, sortBy]);

  const findPlayer = useCallback((name, country, gender) => {
    if (!data) return;
    const p = data.players.find(pl => pl.name === name && pl.country.toLowerCase() === country.toLowerCase() && pl.gender === gender);
    if (p) { setSelPlayer(p.id); setView("players"); setSearch(""); setCountryF("all"); setGenderF("all"); setTournF("all"); }
  }, [data]);

  const navigate = useCallback((v, id) => {
    setView(v);
    if (v === "players" && id != null) setSelPlayer(id);
  }, []);

  const selTournData = useMemo(() => data?.tournaments.find(t => t.key === selTourn), [data, selTourn]);
  const selPlayerData = useMemo(() => data?.players.find(p => p.id === selPlayer), [data, selPlayer]);

  if (!data) return (
    <>
      <link href={FL} rel="stylesheet" />
      <div style={{ fontFamily: F, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, " + T.bg + " 0%, #0d2137 40%, #0a3026 100%)", color: "#fff", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg, " + T.accent + ", #16a34a)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 38, marginBottom: 16, boxShadow: "0 8px 32px " + T.accent + "30" }}>&#9971;</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 4px", letterSpacing: -0.5 }}>USKids Golf</h1>
          <p style={{ fontSize: 14, color: T.textMuted, margin: "0 0 32px" }}>Analytics &middot; Torneios &middot; Jogadores &middot; Scorecards</p>
          {error && <div style={{ background: "#7f1d1d90", color: "#fca5a5", padding: "12px 18px", borderRadius: 12, marginBottom: 16, fontSize: 12, border: "1px solid #991b1b" }}>{error}</div>}
          {status && <div style={{ color: T.accent, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{status}</div>}
          <button onClick={() => fileRef.current?.click()} disabled={loading} style={{ background: loading ? "#475569" : "linear-gradient(135deg, " + T.accent + ", #16a34a)", color: "#fff", border: "none", padding: "16px 36px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 24px " + T.accent + "40", fontFamily: F }}>
            {loading ? "A processar..." : "Carregar JSON"}
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: "none" }} />
          <p style={{ fontSize: 11, color: "#4a6070", marginTop: 16 }}>uskids_complete.json ou qualquer backup</p>
        </div>
      </div>
    </>
  );

  const navItems = [
    { key: "dashboard", icon: "\ud83d\udcca", label: "Dashboard" },
    { key: "tournaments", icon: "\ud83c\udfc6", label: "Torneios" },
    { key: "players", icon: "\ud83d\udc64", label: "Jogadores" },
    { key: "rankings", icon: "\ud83e\udd47", label: "Rankings" },
  ];

  return (
    <>
      <link href={FL} rel="stylesheet" />
      <div style={{ fontFamily: F, height: "100vh", display: "flex", background: T.surface }}>
        <div style={{ width: 64, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", flexShrink: 0, gap: 2 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, " + T.accent + ", #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 16, boxShadow: "0 2px 12px " + T.accent + "30" }}>&#9971;</div>
          {navItems.map(n => (
            <button key={n.key} onClick={() => setView(n.key)} style={{ width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: view === n.key ? T.card : "transparent", color: view === n.key ? T.accent : T.textMuted, fontSize: 16 }} title={n.label}>
              <span>{n.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>{n.label.substring(0, 4)}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => setData(null)} style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: T.textMuted, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }} title="Fechar">&times;</button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {view === "dashboard" && <Dashboard data={data} onNavigate={navigate} />}
          {view === "rankings" && <Rankings data={data} onNavigate={navigate} />}

          {view === "tournaments" && <>
            <div style={{ width: 320, minWidth: 260, borderRight: "1px solid " + T.borderLight, display: "flex", flexDirection: "column", flexShrink: 0, background: "#fff" }}>
              <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid " + T.borderLight }}>
                <input value={tSearch} onChange={e => setTSearch(e.target.value)} placeholder="Pesquisar torneio..." style={inpS} />
                <div style={{ display: "flex", gap: 3, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setTYearF("all")} style={{ ...pillSm, background: tYearF === "all" ? T.accent : T.surfaceAlt, color: tYearF === "all" ? "#fff" : T.textMuted, border: "none", cursor: "pointer", fontFamily: F }}>Todos</button>
                  {[...data.years].reverse().slice(0, 14).map(y => <button key={y} onClick={() => setTYearF(String(y))} style={{ ...pillSm, background: tYearF === String(y) ? T.accent : T.surfaceAlt, color: tYearF === String(y) ? "#fff" : T.textMuted, border: "none", cursor: "pointer", fontFamily: F }}>{y}</button>)}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, fontWeight: 600 }}>{filteredTourns.length} torneios</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filteredTourns.map(t => (
                  <button key={t.key} onClick={() => setSelTourn(t.key)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid " + T.surfaceAlt, cursor: "pointer", background: selTourn === t.key ? T.accentSoft : "transparent", borderLeft: selTourn === t.key ? "3px solid " + T.accent : "3px solid transparent", fontFamily: F }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: T.textDark }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{t.date} &middot; {t.categories.length} cats &middot; {t.numPlayers} jog</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: T.surface }}>
              {selTournData ? <TournDetail key={selTournData.key} tourn={selTournData} onPlayerClick={findPlayer} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: T.textMuted, fontSize: 14 }}>Seleciona um torneio</div>}
            </div>
          </>}

          {view === "players" && <>
            <div style={{ width: 320, minWidth: 260, borderRight: "1px solid " + T.borderLight, display: "flex", flexDirection: "column", flexShrink: 0, background: "#fff" }}>
              <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid " + T.borderLight }}>
                <input value={search} onChange={e => { setSearch(e.target.value); setSelPlayer(null); }} placeholder="Pesquisar jogador..." style={inpS} />
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  <select value={countryF} onChange={e => { setCountryF(e.target.value); setSelPlayer(null); }} style={{ ...inpS, width: "auto", padding: "5px 8px", fontSize: 11 }}><option value="all">Pais</option>{data.topCountries.slice(0, 25).map(c => <option key={c} value={c}>{flag(c)} {c}</option>)}</select>
                  <select value={genderF} onChange={e => { setGenderF(e.target.value); setSelPlayer(null); }} style={{ ...inpS, width: "auto", padding: "5px 8px", fontSize: 11 }}><option value="all">Todos</option><option value="M">Boys</option><option value="F">Girls</option></select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inpS, width: "auto", padding: "5px 8px", fontSize: 11 }}><option value="tournaments">+Torneios</option><option value="name">A-Z</option><option value="country">Pais</option><option value="recent">Recente</option></select>
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, fontWeight: 600 }}>{filteredPlayers.length} jogadores</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filteredPlayers.slice(0, 500).map(p => (
                  <button key={p.id} onClick={() => setSelPlayer(p.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", borderBottom: "1px solid " + T.surfaceAlt, cursor: "pointer", background: selPlayer === p.id ? T.accentSoft : "transparent", borderLeft: selPlayer === p.id ? "3px solid " + T.accent : "3px solid transparent", fontFamily: F }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{flag(p.country)}</span>
                      <span style={{ fontWeight: 700, fontSize: 12, color: T.textDark }}>{p.name}</span>
                      {p.gender === "F" && <span style={{ ...pillSm, background: "#fce7f3", color: "#9d174d" }}>&female;</span>}
                      <span style={{ ...pillSm, background: T.accentSoft, color: T.accentDark, marginLeft: "auto" }}>{p.numT}T</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.birth && <span style={{ color: "#7c3aed", fontWeight: 600 }}>~{p.birth}</span>}
                      <span>{p.years[0]}&ndash;{p.years[p.years.length - 1]}</span>
                      {p.place && <span>{p.place}</span>}
                    </div>
                  </button>
                ))}
                {filteredPlayers.length > 500 && <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: T.textMuted }}>A mostrar 500 de {filteredPlayers.length}</div>}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: T.surface }}>
              {selPlayerData ? <PDetail key={selPlayerData.id} player={selPlayerData} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: T.textMuted, fontSize: 14 }}>Seleciona um jogador</div>}
            </div>
          </>}
        </div>
      </div>
    </>
  );
}