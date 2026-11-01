/* IMC priceboards: a full-screen menu of shop items and prices, drawn the same way on the foyer TVs and in the hub's preview.
   IMCPrice.render(el, board, {cur:"£"}) then IMCPrice.fit(el) once el is on screen (it picks the column count and text size
   that fill the space best). Light enough for a slow PC: plain HTML and CSS, a few dozen layout checks per board.
   board = {title, sub, col, imgs (up to 4 pictures: web addresses, or paths that o.asset turns into them), isz (picture size 10-60), ipos (r, l or b), sections:[{name, sizes:[...], items:[{n, note, p:[...]}]}]}  */
(function () {
  const css = `
.pbx{position:absolute;inset:0;container-type:size;color:#fff;font-family:Figtree,"Segoe UI",system-ui,sans-serif;overflow:hidden;display:flex;flex-direction:column;padding:4.2cqh 4.4cqw 3.6cqh}
.pbx.col-navy{background:radial-gradient(circle at 80% 0%,#ffffff12,transparent 45%),linear-gradient(150deg,#1a2160,#0d1240 55%,#05071a)}
.pbx.col-red{background:radial-gradient(circle at 80% 0%,#ff8a6e2e,transparent 45%),linear-gradient(150deg,#b3261e,#6b0f12 60%,#2a0507)}
.pbx.col-gold{background:radial-gradient(circle at 80% 0%,#fff3,transparent 45%),linear-gradient(150deg,#c98a12,#7a4f06 60%,#2e1c02)}
.pbx.col-purple{background:radial-gradient(circle at 80% 0%,#d6a8ff2e,transparent 45%),linear-gradient(150deg,#4a1d7a,#2a0f4a 60%,#120621)}
.pbx.col-green{background:radial-gradient(circle at 80% 0%,#a8ffcc2e,transparent 45%),linear-gradient(150deg,#0f6b46,#073d28 60%,#021a10)}
.pbx.col-black{background:radial-gradient(circle at 80% 0%,#ffc23d18,transparent 45%),linear-gradient(150deg,#16161c,#08080b)}
.pbx .pbh{display:flex;align-items:baseline;gap:2.4cqw;border-bottom:.45cqh solid #ffc23d;padding-bottom:1.6cqh;margin-bottom:2.6cqh;flex:none}
.pbx .pbt{font:900 calc(10.5cqh * var(--hs,1))/.9 "Big Shoulders Display",Impact,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.01em}
.pbx .pbs{font:600 3cqh/1.2 Figtree,sans-serif;color:#ffd77a}
.pbx .pbc{flex:1;min-height:0;column-gap:4.4cqw;column-fill:auto;font-size:calc(3.3cqh * var(--s,1))}
.pbx .pbsec{break-inside:avoid;margin:0 0 1.5em}
.pbx .pbhd{display:flex;align-items:flex-end;gap:.6em;margin:0 0 .4em}
.pbx .pbsec h3{flex:1;min-width:0;white-space:nowrap;margin:0;font:800 1.18em/1 "Big Shoulders Display",Impact,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#ffc23d}
.pbx .pbsz{display:flex;gap:.48em;flex:none}.pbx .pbp b{width:4.6em;text-align:right;flex:none}
.pbx .pbsz i{font:600 .62em/1.2 Figtree,sans-serif;font-style:normal;letter-spacing:.06em;color:#ffd77acc;text-transform:uppercase;width:7.42em;text-align:right;white-space:nowrap;overflow:hidden}
.pbx .pbi{display:flex;align-items:baseline;gap:.5em;padding:.22em 0;break-inside:avoid}
.pbx .pbn{font-weight:700;line-height:1.15;min-width:0;white-space:nowrap;overflow:hidden}
.pbx .pbn small{display:block;white-space:normal;font-weight:500;font-size:.66em;color:#ffffffb3;line-height:1.25;margin-top:.1em}
.pbx .pbd{flex:1;min-width:1em;border-bottom:.12em dotted #ffffff4d;transform:translateY(-.3em)}
.pbx .pbp{display:flex;gap:.3em;flex:none}.pbx .pbp b{font-weight:800;font-variant-numeric:tabular-nums}
.pbx .pbp b.e{color:#ffffff40}
.pbx .pbbody{flex:1;min-height:0;display:flex;gap:4cqw}.pbx .pbbody .pbc{flex:1;min-width:0}
.pbx .pbbody.pos-l{flex-direction:row-reverse}.pbx .pbbody.pos-b{flex-direction:column;gap:2.4cqh}
.pbx .pbimg{flex:none;display:grid;grid-auto-rows:minmax(0,1fr);gap:2cqh 2cqw;min-height:0;align-self:center}.pbx .pos-b .pbimg{width:100%}
.pbx .pbim{flex:1 1 0;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center}
.pbx .pbim img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 1.6cqh 2.4cqh rgba(0,0,0,.45))}
.pbx .pbempty{color:#ffffff99;font-size:3cqh}
`;
  function addCss() { if (document.getElementById("imc-pb-css")) return; const s = document.createElement("style"); s.id = "imc-pb-css"; s.textContent = css; document.head.appendChild(s); }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* "4.5" → "£4.50"; anything else ("2 for £5", "Free") stays as typed */
  function price(p, cur) { p = String(p || "").trim(); if (/^\d{1,4}([.,]\d{1,2})?$/.test(p)) return cur + Number(p.replace(",", ".")).toFixed(2); return p; }
  function render(el, b, o) {
    addCss(); const cur = (o && o.cur) || "£", A = (u) => (o && o.asset ? o.asset(u) : u);
    const pics = (Array.isArray(b.imgs) ? b.imgs : b.img ? [b.img] : []).filter(Boolean).slice(0, 4).map(A), pos = ["l", "b"].includes(b.ipos) ? b.ipos : "r", sz = Math.max(10, Math.min(60, +b.isz || 30));
        const gc = pos === "b" ? pics.length : pics.length > 1 && sz >= 35 ? 2 : 1;   /* a wide picture area puts pictures side by side */
    const pbox = pics.length ? `<div class="pbimg" style="grid-template-columns:repeat(${gc},minmax(0,1fr));${pos === "b" ? `height:${(sz * 0.8).toFixed(1)}cqh` : `width:${sz}cqw;height:${pics.length > gc ? "100%" : Math.min(100, sz * 1.9).toFixed(0) + "%"}`}">${pics.map((u) => `<div class="pbim"><img src="${esc(u)}" alt="" onerror="this.parentNode.remove()"></div>`).join("")}</div>` : "";
    const secs = (b.sections || []).map((s) => ({ ...s, items: (s.items || []).filter((x) => x.n && x.n.trim()) })).filter((s) => s.items.length || s.name);
    const body = secs.map((s) => {
      const n = Math.max(1, (s.sizes || []).length, ...s.items.map((x) => (x.p || []).length));
      const sz = (s.sizes || []).filter(Boolean).length ? `<span class="pbsz">${Array.from({ length: n }, (_, i) => `<i>${esc((s.sizes || [])[i] || "")}</i>`).join("")}</span>` : "";
      const nm = s.name && s.name.trim().toLowerCase() !== String(b.title || "").trim().toLowerCase() ? s.name : "";   /* no "Deals" under a "Deals" heading */
      return `<section class="pbsec">${nm || sz ? `<div class="pbhd"><h3>${esc(nm)}</h3>${sz}</div>` : ""}${s.items.map((x) => `<div class="pbi"><div class="pbn">${esc(x.n)}${x.note ? `<small>${esc(x.note)}</small>` : ""}</div><span class="pbd"></span><div class="pbp">${Array.from({ length: n }, (_, i) => { const v = price((x.p || [])[i], cur); return `<b class="${v ? "" : "e"}">${v ? esc(v) : "–"}</b>`; }).join("")}</div></div>`).join("")}</section>`;
    }).join("");
    el.innerHTML = `<div class="pbx col-${esc(String(b.col || "navy").replace(/[^a-z]/g, ""))}"><div class="pbh"><div class="pbt">${esc(b.title || "Price list")}</div>${b.sub ? `<div class="pbs">${esc(b.sub)}</div>` : ""}</div><div class="pbbody pos-${pos}"><div class="pbc">${body || '<p class="pbempty">Add some items to see them here.</p>'}</div>${pbox}</div></div>`;
  }
  /* the biggest text that fits, trying 1, 2 and 3 columns */
  function fit(el) {
    const box = el.querySelector(".pbc"); if (!box || !box.clientHeight) return;
    const t = el.querySelector(".pbt"); if (t) { t.style.setProperty("--hs", 1); for (let hs = 1; hs > 0.45 && t.scrollWidth > t.clientWidth + 1; hs -= 0.08) t.style.setProperty("--hs", hs.toFixed(2)); }
    /* fits: nothing runs off the bottom, and on every line the name, the dots and the prices all fit across */
    const rows = [...box.querySelectorAll(".pbi,.pbhd")], cells = [...box.querySelectorAll(".pbn,.pbhd h3")];
    const fits = () => box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1 && rows.every((r) => r.scrollWidth <= r.clientWidth + 1) && cells.every((c) => c.scrollWidth <= c.clientWidth + 1);
    let best = { s: 0, n: 1 };
    const nSec = box.querySelectorAll(".pbsec").length || 1;
    for (let n = 1; n <= Math.min(3, nSec + 1); n++) {
      box.style.columnCount = n; let lo = 0.3, hi = 2.3;
      for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2; box.style.setProperty("--s", m); if (fits()) lo = m; else hi = m; }
      if (lo > best.s * 1.06) best = { s: lo, n };   /* an extra column only if it makes the text clearly bigger */
    }
    box.style.columnCount = best.n; box.style.setProperty("--s", best.s.toFixed(3));
  }
  window.IMCPrice = { render, fit, price };
})();
