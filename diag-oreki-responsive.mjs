// 候选修复预验证：在浏览器里注入候选 CSS，测量是否真的修好（改文件前的验证）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8487);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof GameUI === "object" && GameUI.initialized; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1500);

const CANDIDATE_CSS = `
/* C1 教程弹窗：去掉上游 .c-modal-message 的 min-width:50rem（500px）下限 */
.c-modal:has(.c-oreki-tut) .c-modal-message,
.c-modal:has(.c-oreki-tool) .c-modal-message { min-width: 0; }
/* C2 教程章节按钮抬高到 3.6rem = 36px（与底部翻章按钮一致） */
.c-oreki-tut__nav-btn { min-height: 3.6rem; }
/* C3 教程弹窗底部按钮（含「关闭教程」）抬高到 3.2rem = 32px */
.c-modal:has(.c-oreki-tut) .l-modal-buttons .o-primary-btn { min-height: 3.2rem; }
/* C4 倍率输入框抬高到 3.2rem = 32px */
.c-oreki-speed__field { min-height: 3.2rem; }
/* C5 窄屏下允许长开关文案换行，解除 287px 的 min-content 下限 */
@media screen and (max-width: 900px) {
  .c-oreki-speed__autobuyer-toggle { white-space: normal; }
}
`;

const measure = async label => {
  const tut = await page.evaluate(() => {
    Modal.hideAll();
    Modal.orekiTutorial.show();
    return true;
  });
  await wait(700);
  const t = await page.evaluate(() => {
    const panel = document.querySelector(".c-modal");
    const body = document.querySelector(".c-oreki-tut");
    const scroll = document.querySelector(".c-oreki-tut__scroll");
    const btns = document.querySelector(".l-modal-buttons");
    const r = el => el?.getBoundingClientRect();
    const inside = (a, c) => !!a && !!c && a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && a.left >= c.left - 1 && a.right <= c.right + 1;
    const p = r(panel), b = r(body), s = r(scroll), q = r(btns);
    const targets = [...document.querySelectorAll(".c-oreki-tut button, .l-modal-buttons button, .l-modal-close-button")]
      .filter(el => { const cs = getComputedStyle(el); const rr = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && rr.width > 0 && rr.height > 0; })
      .map(el => { const rr = el.getBoundingClientRect(); return { t: (el.textContent || "").trim().slice(0, 10), w: Math.round(rr.width), h: Math.round(rr.height) }; });
    return {
      panel: p && [Math.round(p.left), Math.round(p.right)],
      body: b && [Math.round(b.left), Math.round(b.right)],
      bodyInside: inside(b, p), scrollInside: inside(s, p), buttonsInside: inside(q, p),
      scrollable: s ? s.scrollHeight > s.clientHeight + 1 : false,
      minTarget: targets.length ? Math.min(...targets.map(x => Math.min(x.w, x.h))) : null,
      small: targets.filter(x => Math.min(x.w, x.h) < 32),
    };
  });
  await page.evaluate(() => Modal.hideAll());
  await wait(300);

  await page.evaluate(() => { Modal.hideAll(); Tab.options.show(true, Tab.options.gameplay); });
  await wait(700);
  const o = await page.evaluate(() => {
    const inTicker = el => !!el.closest(".c-news-ticker, .c-news-line, .l-notification-container");
    const vis = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && !inTicker(el); };
    const over = [...document.querySelectorAll("#ui *")].filter(el => vis(el) && el.getBoundingClientRect().right > window.innerWidth + 1);
    const grid = document.querySelector(".l-options-grid");
    const f = document.querySelector(".c-oreki-speed__field");
    const fr = f?.getBoundingClientRect();
    return {
      gridRight: grid ? Math.round(grid.getBoundingClientRect().right) : null,
      overflowCount: over.length,
      overflowCls: [...new Set(over.map(e => (e.className || e.tagName).toString().split(" ")[0].slice(0, 30)))],
      fieldH: fr ? Math.round(fr.height) : null,
    };
  });
  console.log(`\n--- ${label} ---`);
  console.log("  教程:", JSON.stringify(t));
  console.log("  选项:", JSON.stringify(o));
};

await measure("【修复前】");
await page.addStyleTag({ content: CANDIDATE_CSS });
await wait(500);
await measure("【修复后·注入候选 CSS】");

for (const width of [320, 360, 390, 430, 768, 1280]) {
  await page.setViewport({ width, height: width >= 768 ? 900 : 844, deviceScaleFactor: 2, isMobile: width < 768, hasTouch: true });
  await wait(400);
  await measure(`【修复后 @${width}】`);
}

await browser.close();
server.close();
