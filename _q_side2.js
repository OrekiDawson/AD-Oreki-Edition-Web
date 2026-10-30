(() => {
  const t = s => (s || "").replace(/\s+/g, " ").trim();
  const items = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .filter(n => { const tx = t(n.innerText || n.textContent); return tx && tx.length <= 16; });
  const names = items.map(n => t(n.innerText || n.textContent));
  const rects = items.map(n => { const r = n.getBoundingClientRect();
    return { t: t(n.innerText || n.textContent), x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height) }; });
  const bar = document.querySelector(".l-sidebar") || document.querySelector("[class*='sidebar']:not([class*='glyph'])");
  const br = bar ? bar.getBoundingClientRect() : null;
  return { count: names.length, names,
    distinctY: [...new Set(rects.map(r => r.y))].sort((a, b) => a - b),
    rects: rects.slice(0, 12),
    bar: bar ? { cls: String(bar.className), x: Math.round(br.x), y: Math.round(br.y),
      w: Math.round(br.width), h: Math.round(br.height),
      scrollH: bar.scrollHeight, clientH: bar.clientHeight, scrollTop: bar.scrollTop } : null };
})()
