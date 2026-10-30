// [R38-C] 终局口径 UI 截图 + 触控尺寸扫描（只跑本地副本，不写存档）
// 用法：node _tools/_r38c/shots.mjs        （HTTP 8871，避开长跑占用的 8862）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.env.R38C_HTTP_PORT || 8871);
const out = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r38c");
fs.mkdirSync(out, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", `--remote-debugging-port=${process.env.R38C_CDP_PORT || 9371}`],
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = [];

async function prepare(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await sleep(7000);
  // 只在这个一次性无痕 profile 里伪造「已进入佩勒」的界面状态，用于截终局相关界面。
  // 不导出、不写入任何存档文件；停掉主循环，避免伪造状态触发真实结算。
  await page.evaluate(() => {
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* 忽略 */ }
    player.celestials.pelle.doomed = true;
    player.celestials.pelle.records.totalAntimatter = new Decimal("1e316");
    const cel = Tabs.all.find(t => t.config.key === "celestials");
    const pelle = cel && cel.subtabs.find(s => s.key === "pelle");
    if (pelle) pelle.config.condition = () => true;
    if (cel) cel.config.condition = () => true;
  });
  await sleep(600);
  return errors;
}

async function clearModals(page) {
  await page.evaluate(() => {
    try {
      for (let i = 0; i < 12; i++) {
        if (!ui.view.modal.queue.length) break;
        if (ui.view.modal.queue[0].hide) ui.view.modal.queue[0].hide();
        else ui.view.modal.queue.shift();
      }
    } catch (e) { /* 忽略 */ }
    ui.view.modal.queue.length = 0;
    ui.view.modal.current = undefined;
  });
  await sleep(400);
}

async function shotPelleTab(page, tag) {
  await clearModals(page);
  await page.evaluate(() => {
    const cel = Tabs.all.find(t => t.config.key === "celestials");
    cel.subtabs.find(s => s.key === "pelle").show();
    GameUI.update();
  });
  await sleep(1200);
  const info = await page.evaluate(() => {
    const el = document.querySelector(".c-oreki-pelle-goal");
    const box = el && el.getBoundingClientRect();
    const vw = window.innerWidth;
    const docW = document.documentElement.scrollWidth;
    // 触控尺寸扫描（§19 口径：可点元素 <44 的列出来）
    const clickable = Array.from(document.querySelectorAll(
      "button, .o-primary-btn, select, input[type=number], input[type=checkbox], .c-pelle-upgrade, .o-pelle-button"));
    const small = clickable.map(e => {
      const r = e.getBoundingClientRect();
      return {
        cls: (e.className || e.tagName).toString().slice(0, 48),
        text: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    }).filter(x => x.w > 0 && (x.w < 44 || x.h < 44));
    return {
      vw, docW, overflowX: docW > vw,
      goalText: el ? el.textContent.trim().replace(/\s+/g, " ") : null,
      goalBox: box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null,
      clickableCount: clickable.length,
      smallCount: small.length,
      small: small.slice(0, 12),
    };
  });
  await page.screenshot({ path: path.join(out, `pelle-${tag}.png`) });
  report.push({ view: `pelle-${tag}`, ...info });
}

async function shotTutorialModal(page, tag) {
  await clearModals(page);
  await page.evaluate(() => {
    Modal.orekiTutorial.show();
  });
  await sleep(1000);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"));
    const stageBtn = btns.find(b => (b.textContent || "").includes("阶段指南"));
    if (stageBtn) stageBtn.click();
  });
  await sleep(900);
  const info = await page.evaluate(() => {
    const head = document.querySelector(".c-oreki-tut__head-title");
    const main = document.querySelector(".c-oreki-tut__main");
    const docW = document.documentElement.scrollWidth;
    const txt = main ? main.textContent.replace(/\s+/g, " ").trim() : null;
    return {
      vw: window.innerWidth, docW, overflowX: docW > window.innerWidth,
      activeChapter: head ? head.textContent.trim() : null,
      hasGoalText: txt ? txt.includes("1×10^1000") : false,
      mainText: txt ? txt.slice(0, 500) : null,
    };
  });
  await page.screenshot({ path: path.join(out, `tut-stages-${tag}.png`) });
  report.push({ view: `tut-stages-${tag}`, ...info });
  await page.evaluate(() => Modal.hide());
  await sleep(500);
}

async function shotH2PChapter7(page, tag) {
  await clearModals(page);
  await page.evaluate(() => Modal.h2p.show());
  await sleep(1200);
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll(".o-h2p-tab-button"))
      .find(b => (b.textContent || "").includes("Oreki 新手教程"));
    if (tab) tab.click();
  });
  await sleep(900);
  const found = await page.evaluate(() => {
    const body = document.querySelector(".l-h2p-body");
    const h3 = Array.from(body.querySelectorAll("h3")).find(h => (h.textContent || "").includes("七位天神"));
    if (h3) h3.scrollIntoView({ block: "start" });
    const all = body ? body.textContent.replace(/\s+/g, " ").trim() : "";
    return {
      hasChapter: Boolean(h3),
      hasGoalText: all.includes("1×10^1000"),
      hasOldWording: all.includes("通关「天神」页"),
      text: all.slice(0, 300),
    };
  });
  await sleep(600);
  await page.screenshot({ path: path.join(out, `tut-chapter7-${tag}.png`) });
  report.push({ view: `tut-chapter7-${tag}`, vw: await page.evaluate(() => window.innerWidth), ...found });
  await page.evaluate(() => Modal.hide());
  await sleep(500);
}

// ── 桌面端 ─────────────────────────────────────────────
const desktop = await browser.newPage();
await desktop.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const deskErrors = await prepare(desktop);
await shotPelleTab(desktop, "desktop");
await shotTutorialModal(desktop, "desktop");
await shotH2PChapter7(desktop, "desktop");
report.push({ desktopConsoleErrors: deskErrors });
await desktop.close();

// ── 移动端 375 宽 ───────────────────────────────────────
const mobile = await browser.newPage();
await mobile.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mobErrors = await prepare(mobile);
await shotPelleTab(mobile, "mobile375");
await shotTutorialModal(mobile, "mobile375");
await shotH2PChapter7(mobile, "mobile375");
report.push({ mobileConsoleErrors: mobErrors });
await mobile.close();

await browser.close();
server.close();

fs.writeFileSync(path.join(out, "shots-report.json"), JSON.stringify(report, null, 2));
for (const r of report) console.log(JSON.stringify(r));
