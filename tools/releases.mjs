// probe (temporary): save the FDA schedule pages so the parser can be written against the real HTML
import fs from "node:fs/promises";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
await fs.mkdir("data/raw/fda", { recursive: true });
for (const [n, u] of [["print-nov", "https://filmdistributorsassociation.com/print-release-schedule/?showYear=2026&showMonth=November"], ["main", "https://filmdistributorsassociation.com/release-schedule/past-present-and-future-releases/"], ["main-dec", "https://filmdistributorsassociation.com/release-schedule/past-present-and-future-releases/?showYear=2026&showMonth=December"]]) {
  try { const r = await fetch(u, { headers: { "User-Agent": UA } }); const t = await r.text(); await fs.writeFile(`data/raw/fda/${n}.html`, t); console.log(n, r.status, t.length); } catch (e) { console.log(n, "fail", e.message); }
}
