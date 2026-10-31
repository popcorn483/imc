// Recommended trailers: the newest public trailers from the film distributors' official UK YouTube channels.
// Reads each channel's public feed (no account or key needed) and writes data/recommended.json for the hub's
// Foyer trailers page. Run by import-imc.mjs; can also be run on its own: node tools/recommended.mjs
import fs from "node:fs/promises";
import path from "node:path";

// name shown in the hub, and the channel's @handle (or a channel id starting UC)
export const DISTRIBUTORS = [
  ["Warner Bros.", "@WarnerBrosUK"],
  ["Disney", "@DisneyUK"],
  ["Universal", "@UniversalPicturesUK"],
  ["Sony Pictures", "@SonyPicturesUK"],
  ["Paramount", "@ParamountPicturesUK"],
  ["StudioCanal", "@StudiocanalUK"],
  ["Lionsgate", "@LionsgateUK"],
  ["Searchlight", "@SearchlightUK"],
  ["Pathé", "@PatheUK"],
  ["Altitude", "@AltitudeFilms"],
  ["Vertigo", "@VertigoReleasing"],
];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const RED = /red[\s-]?band|uncensored|unrated|explicit|nsfw|restricted|\b18\+|age[\s-]?restricted/i;
const NOT_CINEMA = /on digital|digital now|disney\+|streaming|netflix|prime video|apple tv|now on|blu-?ray|dvd|disney vault/i;
const NOT_TRAILER = /reaction|review|breakdown|recap|featurette|behind[\s-]the[\s-]scenes|interview|in conversation|\bclip\b|\bspot\b|#shorts|first look at|\bvlog\b|soundtrack|lyric|premiere live|livestream/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unxml = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function text(url) {
  for (let i = 0; i < 3; i++) {
    if (i) await sleep(3000 * i);
    try { const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-GB,en;q=0.9" } }); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {}
  }
  return null;
}
async function channelId(handle, cache) {
  if (/^UC[\w-]{22}$/.test(handle)) return handle;
  if (cache[handle]) return cache[handle];
  const html = await text(`https://www.youtube.com/${handle}`);
  const m = html && (/"externalId":"(UC[\w-]{22})"/.exec(html) || /channel\/(UC[\w-]{22})"/.exec(html) || /"channelId":"(UC[\w-]{22})"/.exec(html));
  return m ? m[1] : null;
}
// the channel's Videos tab and its "trailer" search, read from the page's built-in data (lists far more than the 15-video feed)
function pageVideos(html) {
  const m = html && /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch { return []; }
  const out = [], seen = new Set(), txt = (o) => !o ? "" : o.simpleText || (o.runs || []).map((r) => r.text).join("") || o.content || "";
  const walk = (o, d) => {
    if (!o || typeof o !== "object" || d > 40) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
    const v = o.videoRenderer || o.gridVideoRenderer;
    if (v && /^[\w-]{11}$/.test(v.videoId || "") && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      out.push({ id: v.videoId, title: txt(v.title), ago: txt(v.publishedTimeText), views: +(txt(v.viewCountText).replace(/[^\d]/g, "") || 0), desc: txt(v.descriptionSnippet) || (v.detailedMetadataSnippets || []).map((x) => txt(x.snippetText)).join(" ") });
    }
    for (const k in o) if (k !== "videoRenderer") walk(o[k], d + 1);
  };
  walk(data, 0);
  return out;
}
// "3 weeks ago" → an ISO date that far back
function agoDate(t) {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(t || "");
  if (!m) return null;
  const ms = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[m[2].toLowerCase()];
  return new Date(Date.now() - +m[1] * ms).toISOString();
}
// "Wicked: For Good | Official Trailer 2" → "Wicked: For Good"
export function filmName(title) {
  let t = String(title).replace(/\[[^\]]*\]|\((?:official|uk|new|final|teaser|trailer)[^)]*\)/gi, " ");
  const parts = t.split(/(\s[|–—]\s|\s-\s|\s\/\/\s)/), keep = [parts[0]];
  for (let i = 2; i < parts.length; i += 2) { if (/trailer|teaser|official|\bhd\b|\b4k\b|\buk\b|disney|warner|universal|pictures|paramount|sony|lionsgate|studiocanal|in cinemas|\b(19|20)\d\d\b/i.test(parts[i]) || parts[i - 1].includes("|")) break; keep.push(parts[i - 1], parts[i]); }
  t = keep.join("");
  t = t.replace(/\b(?:the\s+)?(?:official|final|new|main|uk|international|global|first|teaser|exclusive|extended)?\s*(?:uk\s+)?(?:teaser\s+)?trailer\b.*$/i, "").replace(/\b(?:official\s+)?teaser\b.*$/i, "");
  return t.replace(/[\s:–—|-]+$/, "").trim() || String(title).trim();
}
// "In cinemas 14 November" → { text: "In cinemas 14 November", date: "2026-11-14" }
export function releaseHint(desc, published) {
  const d = String(desc || "");
  const m = /(?:only |exclusively |coming |out )?in\s+(?:uk\s*(?:and|&)\s*irish\s+|uk\s+)?(?:cinemas|theatres|theaters)(?:\s+(?:from|on|this|nationwide))?\s+([^.\n!#|]{2,40})/i.exec(d);
  if (!m) return null;
  const rest = m[1].trim(), out = { text: ("In cinemas " + rest).replace(/\s+/g, " ").slice(0, 48) };
  const dm = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?|(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i").exec(rest);
  if (dm) {
    const day = +(dm[1] || dm[5]), mon = MONTHS.indexOf((dm[2] || dm[4]).toLowerCase()), base = new Date(published || Date.now());
    let y = +(dm[3] || dm[6]) || base.getUTCFullYear();
    if (!(dm[3] || dm[6]) && Date.UTC(y, mon, day) < base.getTime() - 30 * 864e5) y++;
    out.date = new Date(Date.UTC(y, mon, day)).toISOString().slice(0, 10);
  } else if (/^now\b/i.test(rest)) out.now = true;
  return out;
}

export async function buildRecommended(outDir) {
  const file = path.join(outDir, "recommended.json");
  const prev = await fs.readFile(file, "utf8").then(JSON.parse).catch(() => ({}));
  const cache = prev.channels || {}, channels = {}, dists = [], items = [], since = Date.now() - 150 * 864e5;
  const keepOld = (prev.items || []).filter((x) => DISTRIBUTORS.some(([n]) => n === x.dist));
  for (const [name, handle] of DISTRIBUTORS) {
    const id = await channelId(handle, cache);
    if (!id) { dists.push({ name, handle, ok: false, why: "channel not found" }); continue; }
    channels[handle] = id;
    const found = new Map();
    await sleep(500);
    const xml = await text(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
    for (const e of (xml || "").split("<entry>").slice(1)) {
      const vid = /<yt:videoId>([\w-]{11})</.exec(e)?.[1];
      if (vid) found.set(vid, { id: vid, title: unxml(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1]), published: /<published>([^<]+)</.exec(e)?.[1], desc: unxml(/<media:description>([\s\S]*?)<\/media:description>/.exec(e)?.[1]), views: +(/<media:statistics views="(\d+)"/.exec(e)?.[1] || 0) });
    }
    const base = /^UC/.test(handle) ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle}`;
    for (const u of [`${base}/videos`, `${base}/search?query=trailer`]) {
      await sleep(700);
      for (const v of pageVideos(await text(u))) if (!found.has(v.id)) found.set(v.id, { ...v, published: agoDate(v.ago), approx: true });
    }
    let n = 0;
    for (const v of found.values()) {
      const { title, desc = "", published } = v;
      if (!/trailer|teaser/i.test(title) || NOT_TRAILER.test(title) || RED.test(title + " " + desc.slice(0, 300)) || NOT_CINEMA.test(title)) continue;
      if (!published || Date.parse(published) < since) continue;
      const rel = releaseHint(desc, published) || releaseHint(title, published);
      items.push({ id: v.id, title, film: filmName(title), dist: name, published, ...(v.approx ? { approx: true } : {}), views: v.views || 0, ...(rel ? { release: rel.text, ...(rel.date ? { releaseDate: rel.date } : {}), ...(rel.now ? { out: true } : {}) } : {}) });
      n++;
    }
    dists.push({ name, handle, id, ok: found.size > 0, count: n, ...(found.size ? {} : { why: "nothing could be read" }) });
  }
  /* keep trailers found on earlier runs (the channels only show their newest videos), unless they're now too old */
  const fresh = new Set(items.map((x) => x.id));
  for (const x of keepOld) if (!fresh.has(x.id) && Date.parse(x.published) >= since) items.push(x);
  const seen = new Set(), byFilm = new Map();
  items.sort((a, b) => String(b.published).localeCompare(String(a.published)));
  const list = [];
  for (const x of items) {
    if (seen.has(x.id)) continue; seen.add(x.id);
    const k = x.dist + "|" + x.film.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), o = byFilm.get(k);
    if (o) { if (!o.releaseDate && x.releaseDate) Object.assign(o, { release: x.release, releaseDate: x.releaseDate }); continue; }
    byFilm.set(k, x); list.push(x);
  }
  await fs.writeFile(file, JSON.stringify({ updated: new Date().toISOString(), channels, distributors: dists, items: list }, null, 1));
  console.log(`recommended: ${list.length} trailers from ${dists.filter((d) => d.ok).length}/${dists.length} distributors` + dists.filter((d) => !d.ok).map((d) => `; ${d.name}: ${d.why}`).join(""));
}

if (import.meta.url === `file://${process.argv[1]}`) await buildRecommended(path.resolve("data"));
