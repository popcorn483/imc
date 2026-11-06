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
    const t = e.find(".film-title").first().text().replace(/\s+/g, " ").trim(); if (!t) return;
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
  const seen = new Set(), list = items.filter((x) => !seen.has(x.id + x.d) && seen.add(x.id + x.d)).sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
  await fs.writeFile("data/releases.json", JSON.stringify({ updated: new Date().toISOString(), source: "Film Distributors' Association UK release schedule", items: list }));
  console.log("wrote", list.length, "releases");
}
if (import.meta.url === `file://${process.argv[1]}`) main();
