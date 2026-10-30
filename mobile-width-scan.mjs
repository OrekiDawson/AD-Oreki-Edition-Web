// 窄屏宽度扫描：在真实设备浏览器的同一页面里，用 CDP Emulation 依次套用
// 360 / 375 / 411 CSS px 视口，测量横向溢出与关键控件尺寸。
//
// 注意：这是**视口仿真**，不是真机分辨率。真机物理分辨率无法通过该方式改变。
// 用途是补足「约 360 CSS px」这一档的布局回归。
//
// 用法：OREKI_CDP=http://127.0.0.1:9222 node _tools/mobile-width-scan.mjs
const CDP = process.env.OREKI_CDP || "http://127.0.0.1:9222";
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288/index.html"));
if (!page) {
  console.error("找不到 8288 页面");
  process.exit(2);
}

const measure = () =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const de = document.documentElement;
    const visible = [...document.querySelectorAll("#ui *")].filter(el => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
    });
    const right = visible.filter(el => el.getBoundingClientRect().right > vw + 1);
    const left = visible.filter(el => el.getBoundingClientRect().left < -1);
    const btn = document.querySelector(".c-dimension-row .o-primary-btn--new");
    const br = btn ? btn.getBoundingClientRect() : null;
    const tabs = [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].filter(
      b => b.getBoundingClientRect().width > 0
    );
    return {
      vw,
      docOverflow: de.scrollWidth > de.clientWidth,
      rightCount: right.length,
      leftCount: left.length,
      rightSample: right.slice(0, 3).map(e => (e.className || "").toString().slice(0, 28)),
      buyBtn: br ? { w: Math.round(br.width), h: Math.round(br.height), right: Math.round(br.right) } : null,
      sidebarTabW: tabs[0] ? Math.round(tabs[0].getBoundingClientRect().width) : null,
    };
  });

const rows = [];
for (const width of [360, 375, 411]) {
  await page.setViewport({ width, height: 780, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 600));
  rows.push({ width, ...(await measure()) });
}

await page.setViewport(null);
console.log(JSON.stringify(rows, null, 2));
await browser.disconnect();
