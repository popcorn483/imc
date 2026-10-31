// Imports IMC listings from imc.ie for every IMC cinema.
// Enniskillen goes to data/imc.json (as before); the others to data/cinemas/<id>.json.
// data/cinemas.json lists every cinema, which imc.ie address worked and whether listings came in.
// Run one cinema with:  ONLY=galway node tools/import-imc.mjs
// Runs in GitHub Actions (see .github/workflows/import-imc.yml). No secrets needed.
// imc.ie's markup isn't documented, so each page is parsed with several strategies,
// and the raw HTML is kept in data/raw/ so the parser can be checked and tuned.
import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "https://imc.ie";
const OUT = "data";
// ids match SITES in index.html; slugs are the imc.ie addresses to try, first match is remembered
const CINEMAS = [
  { id: "enniskillen", name: "IMC Enniskillen", slugs: ["enniskillen"] },
  { id: "ballymena", name: "IMC Ballymena", slugs: ["ballymena"] },
  { id: "banbridge", name: "IMC Banbridge", slugs: ["banbridge"] },
  { id: "newtownards", name: "IMC Newtownards", slugs: ["newtownards"] },
  { id: "athlone", name: "IMC Athlone", slugs: ["athlone"] },
  { id: "ballina", name: "IMC Ballina", slugs: ["ballina"] },
  { id: "ballincollig", name: "IMC Ballincollig", slugs: ["ballincollig"] },
  { id: "blackpool", name: "IMC Blackpool", slugs: ["blackpool"] },
  { id: "carlow", name: "IMC Carlow", slugs: ["carlow"] },
  { id: "clonmel", name: "IMC Clonmel", slugs: ["clonmel"] },
  { id: "dundalk", name: "IMC Dundalk", slugs: ["dundalk"] },
  { id: "dunlaoghaire", name: "IMC Dún Laoghaire", slugs: ["dun-laoghaire", "dunlaoghaire"] },
  { id: "galway", name: "IMC Galway", slugs: ["galway-headford-road", "galway"] },
  { id: "oranmore", name: "IMC Oranmore", slugs: ["galway-oranmore", "oranmore"] },
  { id: "kilkenny", name: "IMC Kilkenny", slugs: ["kilkenny-barrack-street", "kilkenny"] },
  { id: "mullingar", name: "IMC Mullingar", slugs: ["mullingar"] },
  { id: "santry", name: "IMC Santry", slugs: ["santry"] },
  { id: "savoy", name: "Savoy Cinema", slugs: ["savoy", "savoy-cinema", "dublin-savoy"] },
  { id: "thurles", name: "IMC Thurles", slugs: ["thurles"] },
  { id: "tullamore", name: "IMC Tullamore", slugs: ["tullamore"] },
];
let CINEMA = "enniskillen";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 IMC-Hub/1.0 (+https://github.com/popcorn483/imc)";
const pagesFor = (c) => ({
  home: `${BASE}/${c}`,
  today: `${BASE}/film-times/${c}/today/`,
  advance: `${BASE}/advance-bookings/${c}/`,
  kids: `${BASE}/kids-club/${c}/`,
  luxx: `${BASE}/luxx/${c}/`,
});
let log = [];
let blocked = false;
const isBotCheck = (html) => /sgcaptcha|captcha|cf-challenge|are you a human/i.test(html) && html.length < 20000;
// imc.ie answers an unknown or unavailable cinema address with its "choose your cinema" page
const isPicker = (html) => html.length < 20000 && /booking\/\?cinema=ATHLONE/i.test(html) && /btn-block/i.test(html);
const note = (m) => { log.push(m); console.log(m); };

async function get(url, binary = false) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 4000 * attempt));
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: binary ? "image/*,*/*" : "text/html,application/xhtml+xml" }, redirect: "follow" });
      if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
      last = new Error(`${r.status} ${url}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e; }
  }
  throw last;
}
// some cinemas' pages load their times afterwards with this request (the same one the browser makes)
async function schedules(cinemaName, daysAhead, extra = {}) {
  const body = new URLSearchParams({ action: "fetch_movie_schedules", cinema: cinemaName, daysAhead: String(daysAhead), viewMode: "singleDay", ...extra });
  const r = await fetch(`${BASE}/wp-admin/admin-ajax.php`, { method: "POST", headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" }, body });
  if (!r.ok) throw new Error(`${r.status} schedules ${cinemaName}`);
  return await r.text();
}
// booking page tables: a row with a name and a £/€ price; rows with an image under /products/ or /tickets/ are snacks or bundles
function pricesOf(html) {
  const $ = cheerio.load(html), out = { tickets: [], bundles: [], products: [] };
  $("tr").each((_, tr) => {
    const tds = $(tr).children("td");
    if (tds.length < 2) return;
    let price = null, name = null, details = null, image = null;
    tds.each((_, td) => {
      const $td = $(td), t = clean($td.clone().find("select,option,script").remove().end().text());
      const m = /^([£€])\s?(\d{1,3}(?:\.\d{2})?)$/.exec(t);
      if (m) { price = m[1] + m[2]; return; }
      const img = $td.find("img").attr("src");
      if (img) { image = abs(new URL(img, "https://booking.imc.ie/").href); return; }
      if (!name && t && t.length < 120) { const d = /^(.*?)\s*Bundle\s*(Luxx)?\s*Details\s*(.*)$/i.exec(t); if (d) { name = d[1] + (d[2] ? " LUXX" : ""); details = d[3]; } else name = t; }
    });
    if (!price || !name) return;
    const item = { name, price, ...(details ? { details } : {}), ...(image ? { image } : {}) };
    if (/\/tickets\//i.test(image || "") || details) out.bundles.push(item);
    else if (image) out.products.push(item);
    else out.tickets.push(item);
  });
  return out;
}
const abs = (u) => { if (!u || u.startsWith("data:")) return null; try { return new URL(u.trim(), BASE).href; } catch { return null; } };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const slug = (s) => clean(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const TIME = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm)?\b/gi;
const CERT = /^(U|PG|12A|12|15|15A|16|18|TBC|G|IFCO.*)$/i;
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const DATE_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})[a-z]*\\.?,?\\s*(\\d{4})?`, "i");

function bestImg($, el) {
  const $el = $(el);
  const cands = [];
  $el.find("img, source").each((_, i) => {
    const $i = $(i);
    const ss = $i.attr("data-srcset") || $i.attr("srcset");
    if (ss) {
      const best = ss.split(",").map((s) => s.trim().split(/\s+/)).sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))[0];
      if (best) cands.push(best[0]);
    }
    cands.push($i.attr("data-src"), $i.attr("data-lazy-src"), $i.attr("data-original"), $i.attr("src"));
  });
  $el.find("[style*='background']").addBack("[style*='background']").each((_, b) => {
    const m = /url\(['"]?([^'")]+)/i.exec($(b).attr("style") || "");
    if (m) cands.push(m[1]);
  });
  for (const c of cands) {
    const u = abs(c);
    if (u && !/\.svg(\?|$)/i.test(u) && !/(logo|icon|favicon|spinner|placeholder|cert|rating)/i.test(u)) return u;
  }
  return null;
}
function titleOf($, el) {
  const $el = $(el);
  const sels = ["h1", "h2", "h3", "h4", "h5", "[class*='title']", "[class*='name']", "strong"];
  for (const s of sels) {
    const t = clean($el.find(s).first().text());
    if (t && t.length > 1 && t.length < 90 && !TIME.test(t)) { TIME.lastIndex = 0; return t; }
    TIME.lastIndex = 0;
  }
  const alt = clean($el.find("img").first().attr("alt"));
  if (alt && alt.length < 90) return alt;
  const at = clean($el.find("a[title]").first().attr("title"));
  return at || null;
}
function certOf($, el) {
  let cert = null;
  $(el).find("*").each((_, n) => {
    if (cert) return;
    const $n = $(n);
    const t = clean($n.clone().children().remove().end().text());
    const cls = ($n.attr("class") || "") + " " + ($n.attr("alt") || "") + " " + ($n.attr("src") || "");
    if (CERT.test(t) && /(cert|rating|classif|age|badge)/i.test(cls + ($n.parent().attr("class") || ""))) cert = t.toUpperCase();
    else { const m = /cert[-_ ]?(u|pg|12a|12|15a|15|16|18)\b/i.exec(cls); if (m) cert = m[1].toUpperCase(); }
  });
  if (!cert) { const m = /\((U|PG|12A|15A|15|16|18)\)/.exec($(el).text()); if (m) cert = m[1]; }
  return cert;
}
function timesOf($, el) {
  const out = [];
  const text = $(el).find("a, button, span, li, time").map((_, n) => $(n).text()).get().join(" ") || $(el).text();
  for (const m of text.matchAll(TIME)) {
    let h = parseInt(m[1]), mi = m[2], ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const t = `${String(h).padStart(2, "0")}:${mi}`;
    if (!out.includes(t)) out.push(t);
  }
  return out.sort();
}
function runtimeOf(text) {
  let m = /(\d)\s*h(?:rs?|ours?)?\s*(\d{1,2})\s*m/i.exec(text);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = /(\d{2,3})\s*(?:mins?|minutes)\b/i.exec(text);
  return m ? parseInt(m[1]) : null;
}
const DATE_US = new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`, "i");
function dateOf(text) {
  const us = DATE_US.exec(text || "");
  const m = DATE_RE.exec(text) || (us ? [us[0], us[2], us[1], us[3]] : null);
  if (!m) return null;
  const mon = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].toLowerCase().slice(0, 3));
  const now = new Date();
  let y = m[3] ? parseInt(m[3]) : now.getFullYear();
  const d = new Date(Date.UTC(y, mon, parseInt(m[1])));
  if (!m[3] && d < new Date(now.getTime() - 60 * 864e5)) d.setUTCFullYear(y + 1);
  return d.toISOString().slice(0, 10);
}

// Strategy 1: JSON-LD Movie / ScreeningEvent
function fromJsonLd($) {
  const films = new Map();
  $("script[type='application/ld+json']").each((_, s) => {
    let j; try { j = JSON.parse($(s).html()); } catch { return; }
    const walk = (o) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      const type = [].concat(o["@type"] || []).join(" ");
      if (/ScreeningEvent/i.test(type) && o.workPresented) {
        const w = o.workPresented, t = clean(w.name);
        if (!t) return;
        const f = films.get(t) || { title: t, poster: abs([].concat(w.image || [])[0]), cert: w.contentRating || null, runtime: null, times: [], url: abs(w.url), luxx: false };
        if (o.startDate) { const tm = /T(\d{2}:\d{2})/.exec(o.startDate); if (tm && !f.times.includes(tm[1])) f.times.push(tm[1]); }
        if (/luxx/i.test(JSON.stringify(o.location || ""))) f.luxx = true;
        films.set(t, f);
      } else if (/\bMovie\b/i.test(type) && o.name) {
        const t = clean(o.name);
        if (!films.has(t)) films.set(t, { title: t, poster: abs([].concat(o.image || [])[0]), cert: o.contentRating || null, runtime: null, times: [], url: abs(o.url), luxx: false, date: o.datePublished ? String(o.datePublished).slice(0, 10) : null });
      }
      Object.values(o).forEach(walk);
    };
    walk(j);
  });
  return [...films.values()];
}
// Strategy 2: blocks that contain a poster image and a heading, near booking links / film links
function fromBlocks($) {
  const seeds = new Set();
  $("a[href*='booking'], a[href*='/film/'], a[href*='/films/'], a[href*='/movie/'], a[href*='/movies/'], a[href*='showtime'], a[href*='film-info']").each((_, a) => seeds.add(a));
  $("article, .film, .movie, [class*='film'], [class*='movie'], [class*='poster']").each((_, a) => seeds.add(a));
  const blocks = new Set();
  for (const s of seeds) {
    let el = s;
    for (let i = 0; i < 7 && el; i++) {
      const $el = $(el);
      const imgs = $el.find("img").length + ($el.is("img") ? 1 : 0);
      const big = $el.text().length > 2500 || $el.find("img").length > 6;
      if (big) break;
      if (imgs >= 1 && titleOf($, el)) { blocks.add(el); break; }
      el = el.parent;
    }
  }
  // keep the outermost distinct blocks (drop blocks nested in another chosen block with the same title)
  const arr = [...blocks];
  const keep = arr.filter((b) => !arr.some((o) => o !== b && $(o).find(b).length && titleOf($, o) === titleOf($, b)));
  const films = new Map();
  for (const b of keep) {
    const title = titleOf($, b);
    if (!title || /^(book|buy|view|more|showtimes?|trailer|today|tomorrow)\b/i.test(title)) continue;
    const text = clean($(b).text());
    const link = $(b).find("a[href]").filter((_, a) => !/booking\./.test($(a).attr("href") || "")).first().attr("href");
    const book = $(b).find("a[href*='booking']").first().attr("href");
    const f = films.get(title) || { title, poster: null, cert: null, runtime: null, times: [], url: null, book: null, luxx: false, date: null };
    f.poster ||= bestImg($, b);
    f.cert ||= certOf($, b);
    f.runtime ||= runtimeOf(text);
    f.url ||= abs(link);
    f.book ||= abs(book);
    f.date ||= dateOf(text);
    f.luxx ||= /luxx/i.test($(b).html() || "");
    for (const t of timesOf($, b)) if (!f.times.includes(t)) f.times.push(t);
    f.times.sort();
    films.set(title, f);
  }
  return [...films.values()];
}
// Strategy 0: imc.ie's own film cards (.film_card)
function dayToIso(label) {
  const m = /(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/.exec(label || "");
  if (!m) return null;
  const mon = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].toLowerCase().slice(0, 3));
  if (mon < 0) return null;
  const now = new Date();
  let y = m[3] ? parseInt(m[3]) : now.getUTCFullYear();
  let d = new Date(Date.UTC(y, mon, parseInt(m[1])));
  if (!m[3] && d < new Date(now.getTime() - 45 * 864e5)) d = new Date(Date.UTC(y + 1, mon, parseInt(m[1])));
  return d.toISOString().slice(0, 10);
}
function fromFilmCards($) {
  const out = [];
  $(".film_card").each((_, card) => {
    const $c = $(card);
    const raw = clean($c.find(".film_card_content h2, .film_card_content h1").first().text());
    if (!raw) return;
    const luxx = /\bluxx$/i.test(raw);
    const title = raw.replace(/\s+luxx$/i, "").trim();
    const icons = $c.find(".ratings img").map((_, i) => $(i).attr("src") || "").get().filter((u) => !/BBFC\.svg|IFCO\.svg/i.test(u));
    const certFile = icons.map((u) => (/\/([^/]+)\.svg/i.exec(u) || [])[1]).find(Boolean);
    const certSystem = (icons.map((u) => (/rating\/([a-z]+)\//i.exec(u) || [])[1]).find(Boolean) || "").toLowerCase() || null;
    const details = {};
    $c.find(".film_card_details b").each((_, b) => { const k = clean($(b).text()).replace(/:$/, "").toLowerCase(); const v = clean(($(b)[0].nextSibling && $(b)[0].nextSibling.data) || ""); if (k) details[k] = v; });
    const sessions = [];
    let day = null;
    $c.find(".film_card_times").children().each((_, el) => {
      const $el = $(el);
      if (/^h\d$/i.test(el.name || el.tagName || "")) { day = clean($el.text()); return; }
      if ($el.is("a")) {
        const cls = $el.attr("class") || "", time = clean($el.text());
        if (!/^\d{1,2}[:.]\d{2}$/.test(time)) return;
        sessions.push({ day, date: dayToIso(day), time: time.replace(".", ":"), book: clean($el.attr("href")), luxx: luxx || /f_seating-lux/i.test(cls), screen: (/f_hallCode-(\d+)/.exec(cls) || [])[1] || null, threeD: /f_3D\b/i.test(cls), tags: cls.split(/\s+/).filter((c) => /^f_/.test(c) && !/f_hallCode|f_allocated|f_screen-standard|f_2D/.test(c)).map((c) => c.slice(2)) });
      }
    });
    const first = sessions.find((x) => x.date) || null;
    out.push({
      certSystem, certFile: certFile || null,
      title, luxx, sensory: /^sensory\b/i.test(title), status: clean($c.find(".poster_header").first().text()) || null,
      poster: abs($c.find("img.poster_image").attr("src")), cert: certFile && !/tbc/i.test(certFile) ? certFile.toUpperCase().replace("_", "") : certFile ? "TBC" : null,
      runtime: runtimeOf(details["runtime"] || ""), release: details["release date"] || null, releaseDate: details["release date"] ? dateOf(details["release date"]) : null,
      director: details["director"] || null, synopsis: clean($c.find(".film_card_text").first().text()).slice(0, 600) || null,
      trailer: (() => { const t = $c.find("iframe[src*='youtube']").attr("src"); const id = t && (/embed\/([\w-]{6,})/.exec(t) || [])[1]; return id ? `https://www.youtube.com/watch?v=${id}` : null; })(),
      date: first ? first.date : null, times: first ? sessions.filter((x) => x.date === first.date).map((x) => x.time) : [], book: first ? first.book : null, sessions,
    });
  });
  return out;
}
const JUNK = /^(facebook|instagram|tiktok|x|twitter|imc logo|logo|poster|menu|close|book now|view showtimes)$/i;
function parseFilms(html) {
  const $ = cheerio.load(html);
  if ($(".film_card").length) return { films: fromFilmCards($), $ };
  const a = fromJsonLd($), b = fromBlocks($).filter((f) => !JUNK.test(f.title) && (f.poster || f.times.length));
  const byTitle = new Map();
  for (const f of [...a, ...b]) {
    const k = f.title.toLowerCase();
    const prev = byTitle.get(k);
    byTitle.set(k, prev ? { ...f, ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v && (!Array.isArray(v) || v.length))) } : f);
  }
  return { films: [...byTitle.values()], $ };
}
function dayLinks($) {
  const out = new Map();
  $("a[href*='/film-times/']").each((_, a) => {
    const href = abs($(a).attr("href"));
    if (href && href.includes(`/${CINEMA}/`) && !/\/today\/?$/.test(href)) out.set(href, clean($(a).text()));
  });
  return [...out.entries()].slice(0, 8);
}
function banners($) {
  const out = [];
  $("img").each((_, i) => {
    const u = abs($(i).attr("data-src") || $(i).attr("src"));
    if (u && /wp-content\/uploads/.test(u) && !/favicon|logo/i.test(u) && !out.includes(u)) out.push(u);
  });
  return out;
}

let RAWDIR = path.join(OUT, "raw");
async function saveRaw(name, html) {
  await fs.mkdir(RAWDIR, { recursive: true });
  await fs.writeFile(path.join(RAWDIR, `${name}.html`), html);
}
async function download(url, dir, base) {
  if (!url) return null;
  const ext = (/\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url) || [, "jpg"])[1].toLowerCase().replace("jpeg", "jpg");
  const name = `${base || crypto.createHash("md5").update(url).digest("hex").slice(0, 10)}.${ext}`;
  const file = path.join(OUT, dir, name);
  try { await fs.access(file); return `${OUT}/${dir}/${name}`; } catch {}
  try {
    const buf = await get(url, true);
    await fs.mkdir(path.join(OUT, dir), { recursive: true });
    await fs.writeFile(file, buf);
    return `${OUT}/${dir}/${name}`;
  } catch (e) { note(`image failed: ${url} (${e.message})`); return null; }
}
async function withPosters(films) {
  for (const f of films) {
    f.slug = slug(f.title);
    f.posterFile = await download(f.poster, "posters", f.slug);
  }
  return films;
}

const used = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function importCinema(cin, file, prev, knownSlug) {
log = [];
const result = { id: cin.id, cinema: cin.name, source: null, updated: new Date().toISOString(), today: [], days: [], comingSoon: [], kidsClub: [], luxx: [], banners: [], log };
const fresh = new Set();
// find this cinema's imc.ie address: the remembered one first, then each candidate
let PAGES = null;
for (const c of [...new Set([...cin.slugs.slice(0, 1), knownSlug, ...cin.slugs].filter(Boolean))]) {
  if (blocked) break;
  let html;
  try { html = await get(pagesFor(c).today); } catch (e) { note(`${c}: ${e.message}`); await sleep(1500); continue; }
  await sleep(1500);
  if (isBotCheck(html)) { blocked = true; note(`imc.ie showed a browser check on ${cin.id}; stopping this run and keeping the previous listings`); break; }
  if (isPicker(html)) { note(`${c}: imc.ie showed its choose-a-cinema page`); continue; }
  // a real film-times page lists films; a generic page for a wrong address doesn't
  if (!parseFilms(html).films.length) { note(`${c}: no films on the film-times page`); if (!PAGES) { CINEMA = c; PAGES = pagesFor(c); result.source = `${BASE}/${c}`; } continue; }
  CINEMA = c; PAGES = pagesFor(c); result.source = `${BASE}/${c}`; break;
}
if (!PAGES) note(`no working imc.ie address for ${cin.id}`);
for (const [key, url] of Object.entries(PAGES || {})) {
  if (blocked) break;
  let html;
  try { html = await get(url); } catch (e) { note(`page failed: ${key} ${e.message}`); continue; }
  if (isBotCheck(html)) { blocked = true; note(`imc.ie showed a browser check on ${key}; stopping this run and keeping the previous listings`); break; }
  if (isPicker(html)) { note(`${key}: imc.ie showed its choose-a-cinema page; keeping the previous ${key}`); continue; }
  fresh.add(key);
  await saveRaw(key, html);
  await new Promise((r) => setTimeout(r, 1500));
  const { films, $ } = parseFilms(html);
  note(`${key}: ${films.length} films parsed`);
  if (key === "home") {
    for (const u of banners($).slice(0, 12)) { const f = await download(u, "banners"); if (f) { result.banners.push({ url: u, file: f }); used.add(f); } }
  }
  if (key === "today") {
    result.today = await withPosters(films);
    for (const [href, label] of dayLinks($)) {
      if (blocked) break;
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const h = await get(href);
        if (isBotCheck(h)) { blocked = true; note("imc.ie showed a browser check; stopping"); break; }
        if (isPicker(h)) { note(`day skipped: ${href} showed the choose-a-cinema page`); continue; }
        const name = "day-" + slug(href.split(`/${CINEMA}/`)[1] || label || "x");
        await saveRaw(name, h);
        const d = parseFilms(h).films;
        note(`${name}: ${d.length} films parsed`);
        result.days.push({ label: label || href, url: href, date: dateOf(label) || null, films: await withPosters(d) });
      } catch (e) { note(`day failed: ${href} ${e.message}`); }
    }
  }
  if (key === "advance") result.comingSoon = await withPosters(films);
  if (key === "kids") result.kidsClub = await withPosters(films);
  if (key === "luxx") result.luxx = await withPosters(films);
}
// pages with no film cards: ask for the times directly, today and the next 7 days, plus advance bookings
if (PAGES && !blocked && !result.today.length && !result.days.some((d) => d.films.length)) {
  result.days = [];
  const name = cin.ajaxName || CINEMA.replace(/-/g, " ");
  for (let i = 0; i < 8 && !blocked; i++) {
    try {
      await sleep(1500);
      const h = await schedules(name, i);
      if (isBotCheck(h)) { blocked = true; break; }
      const d = parseFilms(`<html><body>${h}</body></html>`).films;
      note(`schedules day +${i}: ${d.length} films`);
      if (!d.length) continue;
      await saveRaw(`ajax-day-${i}`, h);
      const films = await withPosters(d), date = films.flatMap((f) => f.sessions || []).map((x) => x.date).find(Boolean) || null;
      if (i === 0) result.today = films;
      result.days.push({ label: date || `+${i}`, url: null, date, films });
      fresh.add("today");
    } catch (e) { note(`schedules failed: ${e.message}`); break; }
  }
  if (!result.comingSoon.length && !blocked) {
    try { await sleep(1500); const h = await schedules(name, 0, { viewMode: "ALL", filterType: "advance-bookings" }); const d = parseFilms(`<html><body>${h}</body></html>`).films; note(`schedules advance: ${d.length} films`); if (d.length) { result.comingSoon = await withPosters(d); fresh.add("advance"); } } catch (e) { note(`schedules advance failed: ${e.message}`); }
  }
}
// prices: imc.ie's booking page for a showing lists ticket types, ticket + snack bundles and snacks (with photos).
// Some offers only show on certain days (e.g. a Wednesday meal deal), so read one showing for every day of the coming week,
// plus a matinee, an evening, a Kids Club and a LUXX showing, and note the weekdays each ticket type and bundle appeared on.
if (PAGES && !blocked) {
  const now = new Date(), nowDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" }), nowHM = now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const lists = [...result.today, ...result.days.flatMap((d) => d.films), ...result.kidsClub, ...result.luxx];
  const upcoming = lists.flatMap((f) => f.sessions || []).filter((x) => x.book && x.date && (x.date > nowDate || (x.date === nowDate && x.time > nowHM)))
    .filter((x, i, a) => a.findIndex((y) => y.book === x.book) === i).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const tags = (x) => x.tags || [], plain = (x) => !tags(x).includes("kidsclub") && !x.luxx && !tags(x).includes("seating-lux");
  const picks = [];
  const add = (x) => { if (x && !picks.includes(x)) picks.push(x); };
  for (const d of [...new Set(upcoming.map((x) => x.date))].slice(0, 7)) add(upcoming.find((x) => x.date === d && plain(x) && x.time >= "17:00") || upcoming.find((x) => x.date === d && plain(x)) || upcoming.find((x) => x.date === d));
  add(upcoming.find((x) => plain(x) && x.time < "17:00"));
  add(upcoming.find((x) => tags(x).includes("kidsclub")));
  add(upcoming.find((x) => x.luxx || tags(x).includes("seating-lux")));
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], dow = (d) => DOW[new Date(d + "T12:00:00Z").getUTCDay()];
  const merged = { tickets: [], bundles: [], products: [], checked: new Date().toISOString(), sampledDays: [] };
  for (const [i, x] of picks.entries()) {
    try {
      await sleep(1200);
      const h = await get(x.book);
      if (isBotCheck(h)) { blocked = true; break; }
      if (i < 2) await saveRaw(`booking-${i}`, h);
      const pr = pricesOf(h), day = dow(x.date), kind = tags(x).includes("kidsclub") ? "kids" : (x.luxx || tags(x).includes("seating-lux")) ? "luxx" : x.time < "17:00" ? "matinee" : "evening";
      if (kind !== "kids" && kind !== "luxx" && !merged.sampledDays.includes(day)) merged.sampledDays.push(day);
      for (const k of ["tickets", "bundles", "products"]) for (const it of pr[k]) {
        let m = merged[k].find((m) => m.name === it.name);
        if (!m) { m = { ...it, days: [], seenOn: [] }; merged[k].push(m); }
        if (!m.days.includes(day)) m.days.push(day);
        if (!m.seenOn.includes(kind)) m.seenOn.push(kind);
        if (m.price !== it.price) { m.prices = m.prices || { [m.days[0]]: m.price }; m.prices[day] = it.price; }
      }
    } catch (e) { note(`booking page failed: ${e.message}`); }
  }
  note(`booking pages read: ${picks.length} (${merged.sampledDays.join(", ")})`);
  for (const it of merged.products.concat(merged.bundles)) if (it.image) it.file = await download(it.image, "products", slug(it.image.split("/").pop().replace(/\.\w+$/, "")));
  if (merged.tickets.length + merged.products.length) result.prices = merged;
  note(`prices: ${merged.tickets.length} ticket types, ${merged.bundles.length} bundles, ${merged.products.length} products`);
}
// a blocked or failed run keeps the last prices (and their photos) rather than dropping them
if (!result.prices && prev && prev.prices && !Array.isArray(prev.prices)) result.prices = prev.prices;
if (result.prices) for (const it of (result.prices.products || []).concat(result.prices.bundles || [])) if (it.file) used.add(it.file);
// keep the last good data for anything this run couldn't refresh
if (prev) {
  const keep = (k, ok) => { if (!ok && Array.isArray(prev[k]) && prev[k].length) { result[k] = prev[k]; note(`kept previous ${k}`); } };
  keep("today", fresh.has("today") && result.today.length);
  keep("days", fresh.has("today") && result.days.length);
  keep("comingSoon", fresh.has("advance") && result.comingSoon.length);
  keep("kidsClub", fresh.has("kids") && result.kidsClub.length);
  keep("luxx", fresh.has("luxx") && result.luxx.length);
  keep("banners", fresh.has("home") && result.banners.length);
  if (!fresh.size) result.updated = prev.updated || null;
}
// banners kept from the last run must not be pruned below
for (const b of result.banners) if (b.file) used.add(b.file);
result.checked = new Date().toISOString();
result.blocked = blocked;
// official rating symbols, as used on imc.ie (BBFC for Northern Ireland, IFCO for the Republic)
const RATING_BASE = `${BASE}/wp-content/themes/A1cinemachain/img/rating`;
const RATING_SETS = { bbfc: ["U", "PG", "12A", "12", "15", "18", "R18", "TBC", "BBFC"], ifco: ["G", "PG", "12A", "15A", "16", "18", "TBC", "IFCO"] };
result.ratings = { bbfc: {}, ifco: {} };
const seenFiles = new Set();
for (const list of [result.today, result.comingSoon, result.kidsClub, result.luxx, ...result.days.map((d) => d.films)]) for (const f of list) if (f.certSystem && f.certFile) { (RATING_SETS[f.certSystem] ||= []); if (!RATING_SETS[f.certSystem].includes(f.certFile)) RATING_SETS[f.certSystem].push(f.certFile); }
for (const [sys, certs] of Object.entries(RATING_SETS)) {
  for (const cert of certs) {
    const file = path.join(OUT, "ratings", `${sys}-${cert}.svg`);
    try {
      try { await fs.access(file); } catch {
        if (blocked) throw new Error("skipped");
        const buf = await get(`${RATING_BASE}/${sys}/${cert}.svg`, true);
        if (!/<svg/i.test(buf.toString("utf8", 0, 2000))) throw new Error("not an svg");
        await fs.mkdir(path.join(OUT, "ratings"), { recursive: true });
        await fs.writeFile(file, buf);
      }
      (result.ratings[sys] ||= {})[cert.toUpperCase()] = `${OUT}/ratings/${sys}-${cert}.svg`;
      seenFiles.add(cert);
    } catch (e) { /* not every symbol exists for every system */ }
  }
}
for (const list of [result.today, result.comingSoon, result.kidsClub, result.luxx, ...result.days.map((d) => d.films)]) for (const f of list) {
  const sys = f.certSystem || "bbfc", c = (f.certFile || f.cert || "").toUpperCase();
  f.certIcon = (sys && result.ratings[sys] && result.ratings[sys][c]) || null;
  f.certLogo = (sys && result.ratings[sys] && result.ratings[sys][sys.toUpperCase()]) || null;
}
note(`ratings: bbfc ${Object.keys(result.ratings.bbfc || {}).join(",")} · ifco ${Object.keys(result.ratings.ifco || {}).join(",")}`);
for (const list of [result.today, result.comingSoon, result.kidsClub, result.luxx, ...result.days.map((d) => d.films)]) for (const f of list) if (f.posterFile) used.add(f.posterFile);
result.slug = PAGES ? CINEMA : knownSlug || null;
await fs.mkdir(path.dirname(file), { recursive: true });
await fs.writeFile(file, JSON.stringify(result, null, 2));
const n = new Set([...result.today, ...result.days.flatMap((d) => d.films)].map((f) => f.title)).size;
note(`done: ${n} films`);
return { id: cin.id, name: cin.name, slug: result.slug, file, ok: n + result.comingSoon.length > 0, films: n, updated: result.updated, checked: result.checked };
}

// ---------- run every cinema ----------
const index = await fs.readFile(path.join(OUT, "cinemas.json"), "utf8").then(JSON.parse).catch(() => ({ cinemas: [] }));
const only = (process.env.ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
const summary = [];
for (const cin of CINEMAS) {
  const file = cin.id === "enniskillen" ? path.join(OUT, "imc.json") : path.join(OUT, "cinemas", `${cin.id}.json`);
  const before = index.cinemas.find((c) => c.id === cin.id);
  const prev = await fs.readFile(file, "utf8").then(JSON.parse).catch(() => null);
  if ((only.length && !only.includes(cin.id)) || blocked) {
    // not refreshed this run: keep its images and its row
    if (prev) for (const list of [prev.today || [], prev.comingSoon || [], prev.kidsClub || [], prev.luxx || [], ...(prev.days || []).map((d) => d.films || [])]) for (const f of list) if (f.posterFile) used.add(f.posterFile);
    if (prev) for (const b of prev.banners || []) used.add(b.file);
    summary.push(before || { id: cin.id, name: cin.name, slug: null, file, ok: false, films: 0 });
    continue;
  }
  console.log(`\n=== ${cin.name} ===`);
  RAWDIR = cin.id === "enniskillen" ? path.join(OUT, "raw") : path.join(OUT, "raw", cin.id);
  try { summary.push(await importCinema(cin, file, prev, before && before.slug)); }
  catch (e) { console.log(`${cin.id} failed: ${e.message}`); summary.push(before || { id: cin.id, name: cin.name, slug: null, file, ok: false, films: 0 }); }
}
// trailer titles from YouTube's oEmbed service, so the hub can keep red-band / uncensored trailers off the foyer TVs.
// Cached in data/trailers.json; only new trailers are looked up.
{
  const file = path.join(OUT, "trailers.json");
  const known = await fs.readFile(file, "utf8").then(JSON.parse).catch(() => ({}));
  const urls = new Set();
  for (const c of summary) {
    const d = await fs.readFile(c.file, "utf8").then(JSON.parse).catch(() => null);
    if (d) for (const list of [d.today || [], d.comingSoon || [], d.kidsClub || [], d.luxx || [], ...(d.days || []).map((x) => x.films || [])]) for (const f of list) if (f.trailer) urls.add(f.trailer);
  }
  const RED = /red[\s-]?band|uncensored|unrated|explicit|nsfw|restricted|\b18\+|age[\s-]?restricted/i;
  let n = 0;
  for (const u of urls) {
    if (known[u] && known[u].title) continue;
    try {
      await sleep(400);
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`, { headers: { "user-agent": UA } });
      if (r.ok) { const j = await r.json(); known[u] = { title: j.title || "", channel: j.author_name || "", red: RED.test(j.title || ""), checked: new Date().toISOString() }; n++; }
      else known[u] = { title: "", channel: "", red: false, unavailable: r.status === 404 || r.status === 401 || r.status === 403, checked: new Date().toISOString() };
    } catch (e) { /* try again next run */ }
  }
  await fs.writeFile(file, JSON.stringify(known, null, 2));
  console.log(`trailers: ${urls.size} listed, ${n} newly checked`);
}
// film shots for the editor: the trailer's thumbnail and two frames from the video, from YouTube's image server.
// Saved as data/stills/<youtube id>-<n>.jpg with data/stills/index.json listing what exists. Only new trailers are fetched;
// shots for trailers no longer listed are removed so the repo stays small.
{
  const dir = path.join(OUT, "stills"), idxFile = path.join(dir, "index.json");
  const idx = await fs.readFile(idxFile, "utf8").then(JSON.parse).catch(() => ({}));
  const ids = new Set();
  for (const c of summary) {
    const d = await fs.readFile(c.file, "utf8").then(JSON.parse).catch(() => null);
    if (d) for (const list of [d.today || [], d.comingSoon || [], d.kidsClub || [], d.luxx || [], ...(d.days || []).map((x) => x.films || [])]) for (const f of list) {
      const m = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(f.trailer || ""); if (m) ids.add(m[1]);
    }
  }
  await fs.mkdir(dir, { recursive: true });
  let added = 0;
  const grab = async (url) => { try { const r = await fetch(url, { headers: { "user-agent": UA } }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length > 6000 ? b : null; } catch { return null; } };
  for (const id of ids) {
    if (idx[id] && idx[id].length) continue;
    const files = [];
    const tries = [["maxresdefault", "sddefault", "hqdefault"], ["maxres1", "sd1"], ["maxres2", "sd2"]];
    for (let n = 0; n < tries.length; n++) {
      for (const name of tries[n]) { const b = await grab(`https://i.ytimg.com/vi/${id}/${name}.jpg`); if (b) { const f = `${id}-${n}.jpg`; await fs.writeFile(path.join(dir, f), b); files.push(`${OUT}/stills/${f}`); break; } }
      await sleep(150);
    }
    idx[id] = files; if (files.length) added++;
  }
  for (const id of Object.keys(idx)) if (!ids.has(id)) { for (const f of idx[id]) await fs.rm(path.join(dir, path.basename(f)), { force: true }); delete idx[id]; }
  await fs.writeFile(idxFile, JSON.stringify(idx, null, 1));
  console.log(`stills: ${ids.size} trailers, ${added} newly saved`);
}
// newest public trailers from the distributors' official YouTube channels, for the hub's "Recommended" list
try { const { buildRecommended } = await import("./recommended.mjs"); await buildRecommended(OUT); } catch (e) { console.log("recommended failed: " + e.message); }
// cinema building photos from imc.ie's cinema list (used for LUXX and "visit us" designs): data/sites/<id>.<ext>
const SITE_PICS = {};
{
  const MATCH = [["athlone", /atl?hl?one/], ["ballina", /bal+ina/], ["ballymena", /ballymena/], ["banbridge", /banbridge/], ["carlow", /carlow/], ["clonmel", /clonmel/],
    ["ballincollig", /ballincollig/], ["blackpool", /blackpool/], ["dundalk", /dundalk/], ["dunlaoghaire", /dun-?laoghaire/], ["enniskillen", /enniskillen/], ["oranmore", /oranmore/],
    ["galway", /^galway/], ["kilkenny", /kil+ken+y/], ["mullingar", /mullingar/], ["newtownards", /newtownards/], ["santry", /santry/], ["savoy", /savoy/], ["thurles", /thurles/], ["tullamore", /tullamore/]];
  try {
    const urls = new Set();
    for (const page of ["https://imc.ie/luxx/", "https://imc.ie/"]) { let $; try { $ = cheerio.load(await get(page)); } catch { continue; }
    $("img").each((_, i) => { const u = abs($(i).attr("data-src") || $(i).attr("src")); if (u && /wp-content\/uploads\/\d{4}\/\d{2}\//.test(u)) urls.add(u); }); }
    for (const u of urls) {
      const name = decodeURIComponent(u.split("/").pop()).toLowerCase();
      const hit = MATCH.find(([, re]) => re.test(name)); if (!hit || SITE_PICS[hit[0]]) continue;
      const f = await download(u, "sites", hit[0]); if (f) SITE_PICS[hit[0]] = f;
    }
    if (Object.keys(SITE_PICS).length) await fs.writeFile(path.join(OUT, "sites", "index.json"), JSON.stringify(SITE_PICS, null, 1));
    console.log(`site photos: ${Object.keys(SITE_PICS).length}`);
  } catch (e) { console.log("site photos: " + e.message); }
}
// photo library: IMC's own images only, gathered from every cinema's listings: imc.ie banners and cinema photos,
// plus product and deal photos from the booking pages. Written to data/library/index.json for the editor.
{
  const lib = [], seen = new Set();
  for (const c of summary) {
    const d = await fs.readFile(c.file, "utf8").then(JSON.parse).catch(() => null); if (!d) continue;
    const sp = SITE_PICS[c.id]; if (sp && !seen.has(sp)) { seen.add(sp); lib.push({ id: sp, cat: "imc", title: (d.cinema || "IMC") + " cinema building", file: sp }); }
    for (const b of d.banners || []) if (b.file && !seen.has(b.file)) { seen.add(b.file); lib.push({ id: b.file, cat: "imc", title: "imc.ie image (" + (d.cinema || "IMC") + ")", file: b.file }); }
    const P = d.prices && !Array.isArray(d.prices) ? d.prices : {};
    for (const [k, cat] of [["products", "food"], ["bundles", "deals"]]) for (const x of P[k] || []) if (x.file && !/flexi/i.test(x.file) && !seen.has(x.file)) { seen.add(x.file); lib.push({ id: x.file, cat, title: x.name, file: x.file }); }
  }
  await fs.mkdir(path.join(OUT, "library"), { recursive: true });
  await fs.writeFile(path.join(OUT, "library", "index.json"), JSON.stringify(lib, null, 1));
  console.log(`library: ${lib.length} IMC images`);
}
// files are written relative to the repo root; the site reads them the same way
for (const c of summary) c.file = String(c.file).split(path.sep).join("/");
await fs.writeFile(path.join(OUT, "cinemas.json"), JSON.stringify({ updated: new Date().toISOString(), blocked, cinemas: summary }, null, 2));
// prune old images no longer listed
for (const dir of ["posters", "banners"]) {
  try { for (const f of await fs.readdir(path.join(OUT, dir))) if (!used.has(`${OUT}/${dir}/${f}`)) await fs.unlink(path.join(OUT, dir, f)); } catch {}
}
console.log("all done");
