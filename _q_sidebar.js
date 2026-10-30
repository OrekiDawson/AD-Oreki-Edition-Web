(() => {
  const t = s => (s || "").replace(/\s+/g, " ").trim();
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const wrap = document.querySelector("[class*=sidebar]");
  const items = Array.from(document.querySelectorAll(".l-tab-btn-inner"));
  const rows = items.map(n => {
    const r = n.getBoundingClientRect();
    const host = n.closest("[class*=sidebar], .l-tab-btn") || n;
    const hr = host.getBoundingClientRect();
    return { text: t(n.innerText || n.textContent), x: Math.round(hr.x), y: Math.round(hr.y),
      w: Math.round(hr.width), h: Math.round(hr.height), visible: vis(host) };
  }).filter(r => r.text && r.text.length <= 16);
  return { sidebarClass: wrap ? String(wrap.className) : null,
    count: rows.length, rows,
    sidebarScrollTop: wrap ? wrap.scrollTop : null,
    sidebarScrollH: wrap ? wrap.scrollHeight : null,
    sidebarClientH: wrap ? wrap.clientHeight : null };
})()
