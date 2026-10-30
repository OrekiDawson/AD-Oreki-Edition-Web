// 找出真实设备视口下横向溢出的元素（含滚动容器归属判断）
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288")) || pages[pages.length - 1];
const r = await page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false;
    if (e.getClientRects().length === 0) return false;
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  for (const e of document.querySelectorAll("*")) {
    if (!vis(e)) continue;
    const b = e.getBoundingClientRect();
    if (b.right <= vw + 1) continue;
    // 找最近的横向滚动/裁剪祖先
    let scroller = null;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") { scroller = p; break; }
    }
    out.push({
      tag: e.tagName,
      cls: String(e.className || "").slice(0, 60),
      id: e.id || "",
      right: Math.round(b.right),
      width: Math.round(b.width),
      over: Math.round(b.right - vw),
      scroller: scroller ? `${scroller.tagName}.${String(scroller.className||"").slice(0,30)}` : "NONE(body)",
      text: (e.textContent || "").trim().slice(0, 30),
    });
  }
  out.sort((a, b) => b.over - a.over);
  return {
    vw, iw: window.innerWidth, cw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth, bodySw: document.body.scrollWidth,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    count: out.length,
    top: out.slice(0, 25),
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.disconnect();
