// Imports IMC Enniskillen listings from imc.ie into data/imc.json.
// Runs in GitHub Actions (see .github/workflows/import-imc.yml). No secrets needed.
// imc.ie's markup isn't documented, so each page is parsed with several strategies,
// and the raw HTML is kept in data/raw/ so the parser can be checked and tuned.
import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "https://imc.ie";
const CINEMA = "enniskillen";
const OUT = "data";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 IMC-Enniskillen-Hub/1.0 (+https://github.com/popcorn483/imc)";
const PAGES = {
  home: `${BASE}/${CINEMA}`,
  today: `${BASE}/film-times/${CINEMA}/today/`,
  advance: `${BASE}/advance-bookings/${CINEMA}/`,
  kids: `${BASE}/kids-club/${CINEMA}/`,
  luxx: `${BASE}/luxx/${CINEMA}/`,
};
const log = [];
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

async function saveRaw(name, html) {
  await fs.mkdir(path.join(OUT, "raw"), { recursive: true });
  await fs.writeFile(path.join(OUT, "raw", `${name}.html`), html);
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

const result = { cinema: "IMC Enniskillen", source: `${BASE}/${CINEMA}`, updated: new Date().toISOString(), today: [], days: [], comingSoon: [], kidsClub: [], luxx: [], banners: [], log };
const used = new Set();
for (const [key, url] of Object.entries(PAGES)) {
  let html;
  try { html = await get(url); } catch (e) { note(`page failed: ${key} ${e.message}`); continue; }
  await saveRaw(key, html);
  const { films, $ } = parseFilms(html);
  note(`${key}: ${films.length} films parsed`);
  if (key === "home") {
    for (const u of banners($).slice(0, 12)) { const f = await download(u, "banners"); if (f) { result.banners.push({ url: u, file: f }); used.add(f); } }
  }
  if (key === "today") {
    result.today = await withPosters(films);
    for (const [href, label] of dayLinks($)) {
      try {
        const h = await get(href);
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
for (const list of [result.today, result.comingSoon, result.kidsClub, result.luxx, ...result.days.map((d) => d.films)]) for (const f of list) if (f.posterFile) used.add(f.posterFile);
// prune old images no longer listed
for (const dir of ["posters", "banners"]) {
  try { for (const f of await fs.readdir(path.join(OUT, dir))) if (!used.has(`${OUT}/${dir}/${f}`)) await fs.unlink(path.join(OUT, dir, f)); } catch {}
}
await fs.writeFile(path.join(OUT, "imc.json"), JSON.stringify(result, null, 2));
note("done");
