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
  ["Entertainment Film", "@EntertainmentFilmDist"],
];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const RED = /red[\s-]?band|uncensored|unrated|explicit|nsfw|restricted|\b18\+|age[\s-]?restricted/i;
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
  for (const [name, handle] of DISTRIBUTORS) {
    const id = await channelId(handle, cache);
    if (!id) { dists.push({ name, handle, ok: false, why: "channel not found" }); continue; }
    channels[handle] = id;
    await sleep(500);
    const xml = await text(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
    if (!xml) { dists.push({ name, handle, id, ok: false, why: "feed not available" }); const old = (prev.items || []).filter((x) => x.dist === name); items.push(...old); continue; }
    let n = 0;
    for (const e of xml.split("<entry>").slice(1)) {
      const vid = /<yt:videoId>([\w-]{11})</.exec(e)?.[1], title = unxml(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1]), published = /<published>([^<]+)</.exec(e)?.[1];
      const desc = unxml(/<media:description>([\s\S]*?)<\/media:description>/.exec(e)?.[1]), views = +(/<media:statistics views="(\d+)"/.exec(e)?.[1] || 0);
      if (!vid || !/trailer|teaser/i.test(title) || NOT_TRAILER.test(title) || RED.test(title + " " + desc.slice(0, 300))) continue;
      if (published && Date.parse(published) < since) continue;
      const rel = releaseHint(desc, published);
      items.push({ id: vid, title, film: filmName(title), dist: name, published, views, ...(rel ? { release: rel.text, ...(rel.date ? { releaseDate: rel.date } : {}), ...(rel.now ? { out: true } : {}) } : {}) });
      n++;
    }
    dists.push({ name, handle, id, ok: true, count: n });
  }
  const seen = new Set(), list = items.filter((x) => !seen.has(x.id) && seen.add(x.id)).sort((a, b) => String(b.published).localeCompare(String(a.published)));
  await fs.writeFile(file, JSON.stringify({ updated: new Date().toISOString(), channels, distributors: dists, items: list }, null, 1));
  console.log(`recommended: ${list.length} trailers from ${dists.filter((d) => d.ok).length}/${dists.length} distributors` + dists.filter((d) => !d.ok).map((d) => `; ${d.name}: ${d.why}`).join(""));
}

if (import.meta.url === `file://${process.argv[1]}`) await buildRecommended(path.resolve("data"));
