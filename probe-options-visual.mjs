// 专项探针（轻量版）：选项 → 视觉效果 子页在 620/700/768/820/900/1280 的右溢出
// 目标：确认「选项行允许换行（flex-wrap）」能否把残余 7px 溢出清零，且不引入新溢出。
//
// 用法：
//   NODE_OPTIONS="--import=file:///C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/lib/patch-launch.mjs" \
//     node probe-options-visual.mjs ../AD-Oreki-Edition 8481
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8481);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));

const CANDIDATE = `
@media screen and (max-width: 900px) {
  .l-options-grid__row { flex-wrap: wrap; }
}
`;
const WIDTHS = [620, 700, 768, 820, 900, 1280];

const measure = () => page.evaluate(() => {
  const de = document.documentElement;
  const inTicker = el => !!el.closest(".c-news-ticker, .c-news-line, .l-notification-container");
  const vis = el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && !inTicker(el);
  };
  const all = [...document.querySelectorAll("#ui *")];
  const over = all.filter(el => vis(el) && el.getBoundingClientRect().right > window.innerWidth + 1);
  // 视觉裁切：溢出部分被某个 overflow!=visible 的祖先裁掉
  const clipped = over.filter(el => {
    let p = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== "visible" || cs.overflowX !== "visible") {
        if (p.getBoundingClientRect().right < el.getBoundingClientRect().right - 1) return true;
      }
      p = p.parentElement;
    }
    return false;
  }).slice(0, 3).map(el => ({
    cls: (el.className || el.tagName).toString().split(" ").slice(0, 3).join("."),
    txt: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22),
    right: Math.round(el.getBoundingClientRect().right),
  }));
  // 选项页里所有可点按钮是否仍在视口内
  const btns = all.filter(el => vis(el) && (el.tagName === "BUTTON" || el.tagName === "INPUT"));
  const btnOut = btns.filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > window.innerWidth + 1 || r.left < -1;
  }).map(el => ({
    cls: (el.className || el.tagName).toString().split(" ").slice(0, 3).join("."),
    txt: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 18),
  }));
  return {
    docOverflow: de.scrollWidth > de.clientWidth + 1,
    overCount: over.length,
    overCls: [...new Set(over.map(e => (e.className || e.tagName).toString().split(" ").slice(0, 3).join(".")))],
    clippedCount: clipped.length, clipped,
    btnOutCount: btnOut.length, btnOut,
  };
});

for (const width of WIDTHS) {
  await page.setViewport({ width, height: width >= 768 ? 900 : 844, deviceScaleFactor: 2, isMobile: width < 768, hasTouch: true });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    ready = await page.evaluate(() => {
      try {
        return typeof GameUI === "object" && GameUI.initialized && typeof player === "object" &&
          typeof Modal !== "undefined" && typeof Tab !== "undefined";
      } catch { return false; }
    }).catch(() => false);
    if (ready) break;
    await wait(400);
  }
  if (!ready) { console.log(`  @${width}: 游戏未就绪，跳过`); continue; }
  await wait(1200);
  // 每次改视口都可能触发重载，样式必须重新注入
  await page.addStyleTag({ content: CANDIDATE });
  await wait(300);
  await page.evaluate(() => { Modal.hideAll(); Tab.options.show(true, Tab.options.visual); });
  await wait(800);
  const m = await measure();
  console.log(`@${width}: docOverflow=${m.docOverflow} 右溢=${m.overCount} 裁切=${m.clippedCount} 按钮出界=${m.btnOutCount} ${JSON.stringify(m.overCls)}`);
  if (m.clipped.length) console.log(`    被裁: ${JSON.stringify(m.clipped)}`);
  if (m.btnOut.length) console.log(`    按钮出界: ${JSON.stringify(m.btnOut)}`);
}

await browser.close();
server.close();
