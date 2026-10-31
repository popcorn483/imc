// Recommended trailers: the newest public trailers from the film distributors' official UK YouTube channels.
// Reads each channel's public feed (no account or key needed) and writes data/recommended.json for the hub's
// Foyer trailers page. Run by import-imc.mjs; can also be run on its own: node tools/recommended.mjs
import fs from "node:fs/promises";
import path from "node:path";

// name shown in the hub, and the channel's @handle (or a channel id starting UC)
export const DISTRIBUTORS = [
  ["Warner Bros.", "@warnerbrosuktrailers"],
  ["Disney", "@DisneyUK"],
  ["Universal", "@UniversalPicturesUK"],
  ["Sony Pictures", "UCJJap_3RGZ2UxqLTLz0K39g"],
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
const NOT_TRAILER = /reaction|review|breakdown|recap|featurette|behind[\s-]the[\s-]scenes|interview|in conversation|\bclip\b|\bspot\b|#shorts|tomorrow|countdown|first look at|\bvlog\b|soundtrack|lyric|premiere live|livestream/i;
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
    const lv = o.lockupViewModel;
    if (lv && /VIDEO/.test(lv.contentType || "") && /^[\w-]{11}$/.test(lv.contentId || "") && !seen.has(lv.contentId)) {
      seen.add(lv.contentId);
      const md = lv.metadata?.lockupMetadataViewModel, rows = (md?.metadata?.contentMetadataViewModel?.metadataRows || []).flatMap((r) => (r.metadataParts || []).map((p) => p.text?.content || ""));
      out.push({ id: lv.contentId, title: md?.title?.content || "", ago: rows.find((t) => /ago/.test(t)) || "", views: +((rows.find((t) => /views?/.test(t)) || "").replace(/[^\d]/g, "") || 0), desc: "" });
    }
    for (const k in o) if (k !== "videoRenderer" && k !== "lockupViewModel") walk(o[k], d + 1);
  };
  walk(data, 0);
  return out;
}
// a trailer's own page: exact upload date and the full description (for "In cinemas 14 November")
async function watchInfo(id) {
  const html = await text(`https://www.youtube.com/watch?v=${id}`);
  if (!html) return null;
  const date = /"uploadDate":"([^"]+)"/.exec(html)?.[1] || /itemprop="uploadDate" content="([^"]+)"/.exec(html)?.[1] || /"publishDate":"([^"]+)"/.exec(html)?.[1];
  let desc = /"shortDescription":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1] || "";
  try { desc = JSON.parse(`"${desc}"`); } catch {}
  return { published: date ? new Date(date).toISOString() : null, desc };
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
  const known = prev.known || {}, knownNow = {};
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
    const rss = found.size, diag = [];
    for (const u of [`${base}/videos`, `${base}/search?query=trailer`]) {
      await sleep(700);
      const html = await text(u), vs = pageVideos(html);
      diag.push(`${html ? html.length : 0}b/${html && html.includes("ytInitialData") ? "data" : "nodata"}/${vs.length}v${html && /consent\.youtube|before you continue/i.test(html) ? "/consent" : ""}`);
      for (const v of vs) if (!found.has(v.id)) found.set(v.id, { ...v, published: agoDate(v.ago), approx: true });
    }
    /* trailers found on the pages: look up their real date and description once (remembered on later runs) */
    let looked = 0;
    for (const v of found.values()) {
      if (!v.approx || !/trailer|teaser/i.test(v.title) || NOT_TRAILER.test(v.title) || NOT_CINEMA.test(v.title)) continue;
      const old = (prev.items || []).find((x) => x.id === v.id);
      if (old && !old.approx) { Object.assign(v, { published: old.published, approx: false, desc: old.release ? old.release : v.desc }); continue; }
      if (v.id in known) { knownNow[v.id] = known[v.id]; if (known[v.id]) Object.assign(v, { published: known[v.id], approx: false }); else v.checked = true; continue; }
      if (v.published && Date.parse(v.published) < since - 45 * 864e5) continue;   /* clearly older than we list */
      if (looked >= 20) continue;
      looked++; await sleep(600);
      const w = await watchInfo(v.id);
      if (w && w.published) Object.assign(v, { published: w.published, desc: w.desc || v.desc, approx: false });
      else v.checked = true;
      knownNow[v.id] = v.checked ? null : v.published;
    }
    let n = 0;
    for (const v of found.values()) {
      const { title, desc = "", published } = v;
      if (!/trailer|teaser/i.test(title) || NOT_TRAILER.test(title) || RED.test(title + " " + desc.slice(0, 300)) || NOT_CINEMA.test(title)) continue;
      if (!published || Date.parse(published) < since) continue;
      const rel = releaseHint(desc, published) || releaseHint(title, published);
      items.push({ id: v.id, title, film: filmName(title), dist: name, published, ...(v.approx ? { approx: true } : {}), ...(v.checked ? { checked: true } : {}), views: v.views || 0, ...(rel ? { release: rel.text, ...(rel.date ? { releaseDate: rel.date } : {}), ...(rel.now ? { out: true } : {}) } : {}) });
      n++;
    }
    dists.push({ name, handle, id, ok: found.size > 0, count: n, rss, pages: diag.join(" "), looked, ...(found.size ? {} : { why: "nothing could be read" }) });
  }
  /* keep trailers found on earlier runs (the channels only show their newest videos), unless they're now too old */
  const fresh = new Set(items.map((x) => x.id));
  for (const x of keepOld) if (!fresh.has(x.id) && Date.parse(x.published) >= since && !NOT_CINEMA.test(x.title) && !NOT_TRAILER.test(x.title)) items.push(x);
  const seen = new Set(), byFilm = new Map();
  items.sort((a, b) => String(b.published).localeCompare(String(a.published)));
  const list = [];
  for (const x of items) {
    if (seen.has(x.id)) continue; seen.add(x.id);
    const k = x.dist + "|" + x.film.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), o = byFilm.get(k);
    if (o) { if (!o.releaseDate && x.releaseDate) Object.assign(o, { release: x.release, releaseDate: x.releaseDate }); continue; }
    byFilm.set(k, x); list.push(x);
  }
  /* temporary: see how bbfc.co.uk's search page is built, so ratings can be read from it */
  let bbfcProbe = null;
  try {
    const html = await text("https://www.bbfc.co.uk/search?q=" + encodeURIComponent(list[0] ? list[0].film : "Dune Part Three"));
    if (html) {
      const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      const links = [...new Set([...html.matchAll(/href="(\/release\/[^"]+)"/g)].map((m) => m[1]))].slice(0, 8);
      const ri = html.search(/"(?:ageRating|rating|classification|certificate)"/i);
      bbfcProbe = { q: list[0] && list[0].film, len: html.length, next: !!nd, nextKeys: nd ? Object.keys(JSON.parse(nd[1]).props?.pageProps || {}) : [], links, ratingSnippet: ri >= 0 ? html.slice(Math.max(0, ri - 300), ri + 500) : "", apis: [...new Set([...html.matchAll(/https?:\/\/[a-z0-9.-]*bbfc[a-z0-9./_-]*/gi)].map((m) => m[0]))].slice(0, 15), head: html.slice(0, 1500), mid: html.slice(html.indexOf("<main") > 0 ? html.indexOf("<main") : 20000, (html.indexOf("<main") > 0 ? html.indexOf("<main") : 20000) + 4000) };
    }
  } catch (e) { bbfcProbe = { error: e.message }; }
  await fs.writeFile(file, JSON.stringify({ updated: new Date().toISOString(), bbfcProbe, known: knownNow, channels, distributors: dists, items: list }, null, 1));
  console.log(`recommended: ${list.length} trailers from ${dists.filter((d) => d.ok).length}/${dists.length} distributors` + dists.filter((d) => !d.ok).map((d) => `; ${d.name}: ${d.why}`).join(""));
}

if (import.meta.url === `file://${process.argv[1]}`) await buildRecommended(path.resolve("data"));
