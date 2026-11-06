// UK release calendar for the hub's Foyer trailers page: the Film Distributors' Association's public release
// schedule (the UK industry's own list: dates, distributor, BBFC certificate, trailer link, how wide the release is).
// Reads last month, this month and the next four, and writes data/releases.json. Run daily by .github/workflows/releases.yml.
//   node tools/releases.mjs            (or with a saved page: node tools/releases.mjs page.html)
// (IMDb's release calendar can't be used: IMDb doesn't allow automatic reading of it.)
import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const BASE = "https://filmdistributorsassociation.com/release-schedule/past-present-and-future-releases/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 (IMC Enniskillen foyer TVs; daily)";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const slug = (t) => String(t).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ytId = (u) => { const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(u || ""); return m ? m[1] : "" };
const iso = (s) => { const m = /(\d{1,2}) (\w+) (\d{4})/.exec(s || ""); if (!m) return ""; const mo = MONTHS.indexOf(m[2]); return mo < 0 ? "" : `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` };

export function parse(html) {
  const $ = cheerio.load(html), out = []; let day = "";
  $(".films-container").first().children().each((_, el) => {
    const e = $(el);
    if (e.hasClass("release-date-row")) { day = iso(e.text().trim()); return }
    if (!e.hasClass("film-summary-row") || !day) return;
    const t = e.find(".film-title").first().text().replace(/\s+/g, " ").trim().replace(/^(.*), (The|A)$/i, "$2 $1"); if (!t) return;   // "Hunger Games: ..., The" → "The Hunger Games: ..."
    const certImg = e.find(".title img").attr("alt") || "", cert = (/bbfc_([a-z0-9]+)/i.exec(certImg) || [])[1] || "";
    const dImg = e.find(".distributor img").attr("alt"), dist = (dImg ? dImg.replace(/\s*Logo$/i, "") : e.find(".distributor").text()).replace(/\s+/g, " ").trim();
    let yt = ""; e.find(".title-links a").each((_, a) => { if (/trailer/i.test($(a).text()) && !yt) yt = ytId($(a).attr("href")) });
    const poster = e.find(".poster img").attr("src") || "", txt = e.find(".people").text().replace(/\s+/g, " ");
    const loc = (/Locations:\s*([^A-Z]*?\+|Less than 25)/.exec(txt) || [])[1] || "";
    out.push({ id: slug(t) + "-" + day.slice(0, 4), t, d: day, dist, cert: cert.toUpperCase(), yt,
      poster: /PosterComingSoon/i.test(poster) ? "" : poster.replace(/^\//, "https://filmdistributorsassociation.com/"),
      loc: loc.trim(), event: e.hasClass("event-cinema") || /\((concert|theatre|opera|ballet|live)\)|nt live|met opera|royal ballet/i.test(t) || undefined,
      oneDay: /one day only/i.test(txt) || undefined });
  });
  return out;
}

async function main() {
  const local = process.argv[2];
  if (local) { console.log(JSON.stringify(parse(await fs.readFile(local, "utf8")).slice(0, 5), null, 1)); return }
  const now = new Date(), items = [], months = [];
  for (let k = -1; k <= 4; k++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1)); months.push([d.getUTCFullYear(), MONTHS[d.getUTCMonth()]]) }
  let ok = 0;
  for (const [y, m] of months) {
    try {
      const r = await fetch(`${BASE}?showYear=${y}&showMonth=${m}`, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const got = parse(await r.text()); items.push(...got); ok++; console.log(m, y, got.length, "films");
    } catch (e) { console.log(m, y, "failed:", e.message) }
    await new Promise((res) => setTimeout(res, 1500));
  }
  if (ok < 3 || items.length < 20) { console.log("Too little came back; keeping the last calendar"); return }
  const seen0 = new Set(), list0 = items.filter((x) => !seen0.has(x.id + x.d) && seen0.add(x.id + x.d));
  await addGenres(list0);
  const seen = new Set(), list = items.filter((x) => !seen.has(x.id + x.d) && seen.add(x.id + x.d)).sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
  await fs.writeFile("data/releases.json", JSON.stringify({ updated: new Date().toISOString(), source: "Film Distributors' Association UK release schedule", items: list }));
  console.log("wrote", list.length, "releases");
}
/* genres from Wikidata (free, no key): the film whose English name matches and whose release year is close.
   Kept in data/genres.json so each film is looked up once (films with none found are tried again after a week). */
const WD = "https://www.wikidata.org/w/api.php", WUA = { "User-Agent": "IMC-Enniskillen-foyer/1.0 (https://github.com/popcorn483/imc)" };
const GMAP = [[/animat/i, "Animation"], [/famil|children/i, "Family"], [/comedy/i, "Comedy"], [/action|superhero|martial/i, "Action"], [/adventure/i, "Adventure"],
  [/horror|slasher|supernatural/i, "Horror"], [/thriller|suspense/i, "Thriller"], [/science fiction|sci-fi/i, "Sci-fi"], [/fantasy/i, "Fantasy"], [/romanc|romantic/i, "Romance"],
  [/crime|gangster|heist|detective/i, "Crime"], [/musical|music film|concert/i, "Music"], [/documentary/i, "Documentary"], [/war film/i, "War"], [/western/i, "Western"],
  [/biographical|biopic/i, "Biopic"], [/sports/i, "Sport"], [/drama/i, "Drama"]];
const wd = async (q) => { const r = await fetch(WD + "?format=json&" + q, { headers: WUA }); if (!r.ok) throw new Error("wikidata " + r.status); return r.json() };
const norm = (t) => String(t).toLowerCase().replace(/[’']/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
async function addGenres(list) {
  let cache = {}; try { cache = JSON.parse(await fs.readFile("data/genres.json", "utf8")) } catch (e) {}
  const now = Date.now(), labels = {};
  const todo = list.filter((x) => !x.event && !/anniversary|re-?issue|restoration|\(concert|\(theatre|nt live|live in /i.test(x.t) && (!cache[x.id] || (!cache[x.id].g.length && now - Date.parse(cache[x.id].at) > 7 * 864e5))).slice(0, 120);
  for (const x of todo) {
    try {
      const name = x.t.replace(/\(.*?\)/g, "").replace(/^(disney|pixar|dreamworks)[’']s\s+/i, "").trim(), yr = +x.d.slice(0, 4);
      const s = await wd("action=wbsearchentities&language=en&type=item&limit=7&search=" + encodeURIComponent(name));
      const ids = (s.search || []).map((h) => h.id); let g = [];
      if (ids.length) {
        const e = await wd("action=wbgetentities&props=claims|labels&languages=en&ids=" + ids.join("|"));
        const pick = ids.map((id) => e.entities[id]).find((en) => { if (!en || !en.claims) return false;
          const isFilm = (en.claims.P31 || []).some((c) => ["Q11424", "Q202866", "Q24862", "Q506240", "Q229390", "Q93204"].includes(c.mainsnak?.datavalue?.value?.id));
          const yrs = (en.claims.P577 || []).map((c) => +String(c.mainsnak?.datavalue?.value?.time || "").slice(1, 5)).filter(Boolean);
          const lab = norm(en.labels?.en?.value || "");
          return isFilm && (lab === norm(name) || lab.startsWith(norm(name))) && (!yrs.length || yrs.some((y) => Math.abs(y - yr) <= 1)) });
        if (pick) {
          const gq = (pick.claims.P136 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
          const need = gq.filter((q) => !labels[q]);
          if (need.length) { const ge = await wd("action=wbgetentities&props=labels&languages=en&ids=" + need.slice(0, 50).join("|")); for (const q of need) labels[q] = ge.entities?.[q]?.labels?.en?.value || "" }
          const L = gq.map((q) => labels[q]).join(" | ");
          g = GMAP.filter(([re]) => re.test(L)).map(([, n]) => n);
          if (g.includes("Animation") && !g.includes("Family")) g.push("Family");
          g = [...new Set(g)].slice(0, 4);
        }
      }
      cache[x.id] = { g, at: new Date().toISOString() };
    } catch (e) { console.log("genre lookup failed for", x.t, e.message) }
    await new Promise((r) => setTimeout(r, 250));
  }
  for (const x of list) {
    let g = (cache[x.id] && cache[x.id].g) || [];
    if (x.event) g = [/concert|live in|music/i.test(x.t) ? "Concert" : "Event"];
    else if (/anniversary|re-?issue|restoration/i.test(x.t)) g = ["Re-release", ...g];
    if (g.length) x.g = g;
  }
  await fs.writeFile("data/genres.json", JSON.stringify(cache));
  console.log("genres:", todo.length, "looked up,", list.filter((x) => x.g).length, "of", list.length, "have one");
}
if (import.meta.url === `file://${process.argv[1]}`) main();
