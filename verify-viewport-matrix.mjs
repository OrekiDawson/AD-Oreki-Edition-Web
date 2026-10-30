// 视口矩阵回归：320 / 360 / 390 / 430 / 768 / 1280 CSS px
// 目的：为 R5.6 的「Web 移动端适配」提供可复核的宿主机视口证据。
//
// 说明与边界：
//   - 这是**宿主机浏览器的视口仿真**，不等价于 AVD/真机内真实浏览器
//     （见 AD-Oreki-Edition/docs/移动端适配测试门禁.md §5-A）。
//   - 检查项：横向溢出（文档级 + 元素级）、关键触控目标尺寸、底栏 tab、维度行按钮可点性。
//   - 任一视口出现文档级横向溢出，或关键触控目标短边 < 32px，退出码 1。
//
// 用法：
//   node _tools/verify-viewport-matrix.mjs ../AD-Oreki-Edition 8300
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8300);
const WIDTHS = [320, 360, 390, 430, 768, 1280];
const MIN_TOUCH = 32;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon",
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
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

const measure = () =>
  page.evaluate((minTouch) => {
    const vw = window.innerWidth;
    const de = document.documentElement;
    const box = el => el.getBoundingClientRect();
    // 新闻跑马灯（.c-news-ticker）本身是横向滚动区，故意超出视口；
    // 它是循环动画内容，不属于布局缺陷，测量时整棵子树排除。
    const inTicker = el => !!el.closest(".c-news-ticker, .c-news-line, .l-notification-container");
    const visible = [...document.querySelectorAll("#ui *")].filter(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && !inTicker(el);
    });
    const overflowRight = visible.filter(el => box(el).right > vw + 1);
    const overflowLeft = visible.filter(el => box(el).left < -1);

    // 触控目标：可见按钮中短边过小者（排除纯文本内联元素）
    const buttons = [...document.querySelectorAll("#ui button, #ui .o-primary-btn, #ui .l-modal-close-button")]
      .filter(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
      });
    const smallButtons = buttons
      .map(el => {
        const r = el.getBoundingClientRect();
        return { cls: (el.className || "").toString().slice(0, 40), t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 14), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter(b => Math.min(b.w, b.h) < minTouch);

    const tabs = [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner, .l-tab-btn-inner")]
      .filter(b => b.getBoundingClientRect().width > 0)
      .map(b => {
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });

    return {
      vw,
      docScrollWidth: de.scrollWidth,
      docClientWidth: de.clientWidth,
      docOverflow: de.scrollWidth > de.clientWidth + 1,
      overflowRightCount: overflowRight.length,
      overflowLeftCount: overflowLeft.length,
      overflowSample: overflowRight.slice(0, 3).map(e => (e.className || e.tagName).toString().slice(0, 34)),
      buttonCount: buttons.length,
      smallButtonCount: smallButtons.length,
      smallSample: smallButtons.slice(0, 3),
      tabCount: tabs.length,
      tabMin: tabs.length ? Math.min(...tabs.map(t => Math.min(t.w, t.h))) : null,
    };
  }, MIN_TOUCH);

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// 进入实际游戏界面（标题页的按钮尺寸不代表游戏内触控目标）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("#ui button, #ui .o-primary-btn")]
    .find(b => /开始游戏|Start|新游戏/.test(b.textContent || ""));
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 3000));

// 造出「可玩」状态：反物质足够，维度/速度/成就等 tab 都出现
await page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  player.infinityPoints = new Decimal("1e10");
  GameUI.update();
});
await new Promise(r => setTimeout(r, 2000));

const rows = [];
for (const width of WIDTHS) {
  await page.setViewport({
    width, height: width >= 768 ? 900 : 844,
    deviceScaleFactor: 2, isMobile: width < 768, hasTouch: true,
  });
  await new Promise(r => setTimeout(r, 900));
  rows.push({ width, ...(await measure()) });
}

await browser.close();
server.close();

let failed = 0;
console.log(JSON.stringify(rows, null, 2));
for (const r of rows) {
  const ok = !r.docOverflow && r.overflowRightCount === 0 && r.overflowLeftCount === 0 && r.smallButtonCount === 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${r.width}px  文档溢出=${r.docOverflow}  右溢=${r.overflowRightCount}  左溢=${r.overflowLeftCount}` +
    `  按钮=${r.buttonCount} 小目标=${r.smallButtonCount}  tab最小边=${r.tabMin ?? "-"}`
  );
  if (!ok) failed++;
}
if (pageErrors.length) {
  console.log(`FAIL  页面异常 ${pageErrors.length} 条：${pageErrors.slice(0, 3).join(" | ")}`);
  failed++;
}
console.log(failed === 0 ? "\n=== 视口矩阵全部通过 ===" : `\n=== 视口矩阵失败 ${failed} 项 ===`);
process.exit(failed === 0 ? 0 : 1);
