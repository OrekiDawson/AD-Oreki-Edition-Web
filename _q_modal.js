(() => {
  const t = s => (s || "").replace(/\s+/g, " ").trim();
  const mods = Array.from(document.querySelectorAll("[class*=modal]"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
  return mods.map(m => ({
    cls: String(m.className),
    html: m.outerHTML.slice(0, 1200),
    buttons: Array.from(m.querySelectorAll("button, [role=button], .o-primary-btn, [class*=btn]"))
      .map(b => { const r = b.getBoundingClientRect();
        return { tag: b.tagName, cls: String(b.className).slice(0, 60),
          text: t(b.innerText).slice(0, 20),
          x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
          w: Math.round(r.width), h: Math.round(r.height) }; })
  }));
})()
