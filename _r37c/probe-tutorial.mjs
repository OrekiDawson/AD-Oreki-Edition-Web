// R37-C · 教程页验收：页签顺序 / 「你现在该做什么」/ 高亮步骤 / 窄屏与桌面截图
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const ROOT = path.resolve("../AD-Oreki-Edition");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".ico": "image/x-icon", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(9353, "127.0.0.1", r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
const { browser, cleanup } = await launchBrowser({ port: 9352 });
try {
  const { page, errors } = await openGame(browser, { port: 9353, url: "http://127.0.0.1", waitMs: 90000 });
  out.pageErrors = errors.slice(0, 8);
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0);
    const t = cands.find(c => /开始|Start|进入|继续/i.test(c.innerText || "")) || cands[0];
    if (t) t.click();
  });
  await sleep(2500);

  const probe = async () => page.evaluate(async () => {
    try { window.Modal.h2p.show(); } catch (e) { return { error: String(e) }; }
    let m = null;
    for (let i = 0; i < 12 && !m; i++) {
      await new Promise(r => setTimeout(r, 250));
      m = document.querySelector(".l-h2p-modal");
    }
    if (!m) return { error: "no modal" };
    const tabs = Array.from(m.querySelectorAll(".o-h2p-tab-button")).map(n => n.innerText.trim());
    const body = document.getElementById("h2p-body");
    const now = m.querySelector(".c-oreki-tut__now");
    const nowNext = m.querySelector(".c-oreki-tut__now-next");
    const steps = Array.from(m.querySelectorAll(".c-oreki-tut__step"));
    const h3 = Array.from(m.querySelectorAll(".c-oreki-tut__h3")).map(n => n.innerText.trim());
    const mr = m.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    return {
      tabCount: tabs.length,
      firstTabs: tabs.slice(0, 5),
      title: m.querySelector(".c-h2p-body--title")?.innerText,
      hasNowBlock: !!now,
      nowStage: m.querySelector(".c-oreki-tut__now-stage")?.innerText,
      nowNext: nowNext?.innerText,
      nowRect: now ? (() => { const r = now.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
      nowColor: now ? getComputedStyle(now).borderLeftColor : null,
      stepCount: steps.length,
      stepsDone: steps.filter(s => s.className.includes("--done")).length,
      stepsNow: steps.filter(s => s.className.includes("--now")).length,
      stepsNowText: steps.filter(s => s.className.includes("--now")).map(s => s.innerText.trim())[0] || null,
      chapters: h3,
      bodyTextLen: body.innerText.length,
      bodyHasPlaceholderToken: body.innerText.includes("{{INF}}") || body.innerText.includes("${"),
      bodyOverflowX: body.scrollWidth > body.clientWidth + 1,
      modalRect: { x: Math.round(mr.x), w: Math.round(mr.width), h: Math.round(mr.height), right: Math.round(mr.right) },
      bodyRect: { w: Math.round(br.width), h: Math.round(br.height) },
      fits: mr.x >= -1 && mr.right <= innerWidth + 1
    };
  });

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await sleep(600);
  out.desktop = await probe();
  await page.screenshot({ path: path.join(process.cwd(), "_r37c", "tut_1280.png") });
  await page.evaluate(() => window.Modal.hideAll());
  await sleep(300);

  await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(600);
  out.mobile320 = await probe();
  await page.screenshot({ path: path.join(process.cwd(), "_r37c", "tut_320.png") });
  await page.evaluate(() => window.Modal.hideAll());
  await sleep(300);

  await page.setViewport({ width: 392, height: 676, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(600);
  out.mobile392 = await probe();
  await page.screenshot({ path: path.join(process.cwd(), "_r37c", "tut_392.png") });

  // 搜索命中：输入「教程」应仍能看到教程页
  out.search = await page.evaluate(async () => {
    const input = document.querySelector(".c-h2p-search-bar");
    if (!input) return { error: "no input" };
    input.value = "教程";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { tabs: Array.from(document.querySelectorAll(".o-h2p-tab-button")).slice(0, 4).map(n => n.innerText.trim()) };
  });
  // 切到下一章（点击第 2 个页签）确认切换不报错
  out.switchTab = await page.evaluate(async () => {
    const tabs = Array.from(document.querySelectorAll(".o-h2p-tab-button"));
    const target = tabs[1];
    if (!target) return { error: "no second tab" };
    const name = target.innerText.trim();
    target.click();
    await new Promise(r => setTimeout(r, 400));
    return { clicked: name, titleNow: document.querySelector(".c-h2p-body--title")?.innerText };
  });
} finally {
  await cleanup();
  server.close();
}
fs.writeFileSync(path.join(process.cwd(), "_r37c", "tut-probe.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
