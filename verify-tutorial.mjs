// 定向断言：Web 端「内置教程」（选项 → 游戏性 → 内置教程 / Modal.orekiTutorial）
//
// 目的：
//   ① 新档能打开教程（DOM 真的渲染出来）；
//   ② 章节数量与标题与 src/core/oreki-tutorial.js 一致；
//   ③ 关闭教程后游戏没有暂停（反物质/现实游玩时间继续推进）；
//   ④ 已进入永恒时，阶段建议切到「永恒期」，且未解锁阶段仍标未解锁；
//   ⑤ 未解锁阶段的内容一律带「现在无法使用」前缀，不会被写成已可用；
//     + 「条件已满足但尚未进入」与「已进入」能区分；
//   ⑥ 全程没有未捕获异常。
//
// 用法（必须带 patch-launch，否则 Edge 无头启动会 Code: 0 失败）：
//   NODE_OPTIONS="--import=file:///C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/lib/patch-launch.mjs" \
//     node verify-tutorial.mjs ../AD-Oreki-Edition 8471
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8471);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
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
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
// 本地静态服务器下 Google Analytics（gtag）必然被 index.html 的 CSP 拦掉，
// 这是既有环境噪声，与被测功能无关；只过滤这一条，其余 console error 一律算失败。
const isKnownExternalNoise = text => /googletagmanager|Content Security Policy/iu.test(text);
page.on("pageerror", e => errs.push(e.message));
page.on("console", m => {
  if (m.type() === "error" && !isKnownExternalNoise(m.text())) errs.push(`console: ${m.text()}`);
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const openTutorial = async () => {
  await page.evaluate(() => Modal.orekiTutorial.show());
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => !!document.querySelector(".c-oreki-tut"));
    if (has) return true;
    await wait(100);
  }
  return false;
};
const closeTutorial = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find(b => b.textContent.trim() === "关闭教程");
    if (btn) btn.click();
  });
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => !!document.querySelector(".c-oreki-tut"));
    if (!has) return true;
    await wait(100);
  }
  return false;
};
const gotoChapter = async (n) => {
  await page.evaluate((idx) => {
    const btns = document.querySelectorAll(".c-oreki-tut__nav-btn");
    if (btns[idx]) btns[idx].click();
  }, n);
  await wait(200);
};
const readRows = () => page.$$eval(".c-oreki-tut__stage-row", els => els.map(el => {
  const statusEl = el.querySelector(".c-oreki-tut__stage-status");
  const nameEl = el.querySelector(".c-oreki-tut__stage-name");
  return {
    name: nameEl ? nameEl.textContent.trim() : "",
    status: statusEl ? statusEl.textContent.trim() : "",
    hasLockPrefix: !!el.querySelector(".c-oreki-tut__lock"),
    text: el.textContent.replace(/\s+/gu, " ").trim(),
  };
}));

// ① 新档能打开
const opened = await openTutorial();
check("新档能打开内置教程", opened, `modal=${await page.evaluate(() => Modal.orekiTutorial.isOpen)}`);

// ② 章节数量与标题
const source = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  return {
    titles: mod.TUTORIAL_CHAPTERS.map(c => c.title),
    keys: mod.TUTORIAL_CHAPTERS.map(c => c.key),
    lockedPrefix: mod.TUTORIAL_LOCKED_PREFIX,
    emptySectionChapters: mod.TUTORIAL_CHAPTERS.filter(c => !c.sections.length).map(c => c.key),
  };
});
const domTitles = await page.$$eval(".c-oreki-tut__nav-title", els => els.map(e => e.textContent.trim()));
// 章节数不再写死：以源码 TUTORIAL_CHAPTERS 为唯一来源，只校验 DOM 与源码一致且不少于 6 章
// （R21 起新增「阶段突破」一章，写死会误报）
check("章节数量与源码一致（≥ 6）",
  source.titles.length >= 6 && domTitles.length === source.titles.length,
  `源码 ${source.titles.length} 章 / DOM ${domTitles.length} 章`);
check("章节标题顺序一致",
  JSON.stringify(source.titles) === JSON.stringify(domTitles),
  `DOM=[${domTitles.join(" / ")}]`);
check("每章都有内容（仅阶段指南例外）",
  source.emptySectionChapters.length === 1 && source.emptySectionChapters[0] === "stages",
  `空 section 章节=[${source.emptySectionChapters.join(",")}]`);

// ⑤ 新档：未解锁阶段必须显式标注「现在无法使用」
await gotoChapter(3);
const freshRows = await readRows();
const freshLocked = freshRows.filter(r => r.status === "未解锁");
check("新档阶段表为 6 行", freshRows.length === 6, `rows=${freshRows.length}`);
check("新档只有「开局」是已进入 + 5 个阶段未解锁",
  freshRows[0].status === "已进入" && freshLocked.length === 5,
  `开局=${freshRows[0].status}，未解锁=${freshLocked.length}（${freshLocked.map(r => r.name).join(",")}）`);
check("未解锁阶段全部带「现在无法使用」前缀",
  freshLocked.length > 0 && freshLocked.every(r => r.hasLockPrefix && r.text.includes("本阶段功能现在无法使用")),
  freshLocked.map(r => `${r.name}:${r.hasLockPrefix}`).join(" "));
check("未解锁阶段没有被写成已可用",
  freshLocked.every(r => !r.text.includes("已进入")) &&
    freshRows.filter(r => r.status !== "未解锁").every(r => !r.hasLockPrefix),
  `非解锁行带前缀=${freshRows.filter(r => r.status !== "未解锁" && r.hasLockPrefix).length}`);
const freshStageName = await page.$eval(".c-oreki-tut__current-name", e => e.textContent.trim());
check("新档当前阶段为「开局（未无限）」", freshStageName === "开局（未无限）", `current=${freshStageName}`);

// 布局：弹窗内容不能溢出到弹窗面板外（1280×800）
const layout = await page.evaluate(() => {
  const panel = document.querySelector(".c-modal");
  const body = document.querySelector(".c-oreki-tut");
  const btns = document.querySelector(".l-modal-buttons");
  const rect = el => el.getBoundingClientRect();
  const p = rect(panel);
  const b = rect(body);
  const q = rect(btns);
  return {
    bodyInside: b.top >= p.top - 1 && b.bottom <= p.bottom + 1 && b.left >= p.left - 1 && b.right <= p.right + 1,
    buttonsInside: q.bottom <= p.bottom + 1 && q.top >= p.top - 1,
    panel: [p.top, p.bottom].map(Math.round),
    bodyRect: [b.top, b.bottom].map(Math.round),
    buttonsRect: [q.top, q.bottom].map(Math.round),
    hScroll: document.documentElement.scrollWidth - window.innerWidth,
  };
});
check("教程正文与底部按钮都在弹窗面板内，且无横向溢出",
  layout.bodyInside && layout.buttonsInside && layout.hScroll <= 0,
  `panel=${layout.panel} body=${layout.bodyRect} buttons=${layout.buttonsRect} hScroll=${layout.hScroll}`);

// ③ 关闭后游戏不暂停
const beforeClose = await page.evaluate(() => ({
  realTime: player.records.realTimePlayed,
  am: String(player.antimatter),
}));
const closed = await closeTutorial();
await wait(2500);
const afterClose = await page.evaluate(() => ({
  realTime: player.records.realTimePlayed,
  am: String(player.antimatter),
  modalOpen: Modal.orekiTutorial.isOpen,
  running: GameUI.initialized,
}));
check("教程能关闭且 DOM 已移除", closed && !afterClose.modalOpen, `closed=${closed} isOpen=${afterClose.modalOpen}`);
check("关闭后游戏继续运行（现实游玩时间推进）",
  afterClose.realTime - beforeClose.realTime > 500,
  `realTimePlayed ${beforeClose.realTime} → ${afterClose.realTime}（+${afterClose.realTime - beforeClose.realTime}ms）`);

// ④ 已进入永恒：阶段建议切换
await openTutorial();
await gotoChapter(3);
await page.evaluate(() => {
  player.infinities = new Decimal(1);
  player.eternities = new Decimal(1);
  GameUI.update();
});
await wait(1200);
const eternalStage = await page.$eval(".c-oreki-tut__current-name", e => e.textContent.trim());
const eternalSteps = await page.$$eval(".c-oreki-tut__current .c-oreki-tut__points li", els => els.map(e => e.textContent.trim()));
const eternalRows = await readRows();
const eternalRow = eternalRows.find(r => r.name === "永恒期");
const realityRow = eternalRows.find(r => r.name === "现实期");
check("进入永恒后当前阶段切换为「永恒期」", eternalStage === "永恒期", `current=${eternalStage}`);
check("永恒期建议出现在当前阶段（含时间研究）",
  eternalSteps.some(s => s.includes("时间研究")),
  `steps=${eternalSteps.length}，首条=${eternalSteps[0] || ""}`);
check("永恒行标「已进入」，现实行仍「未解锁」",
  eternalRow && eternalRow.status === "已进入" && realityRow && realityRow.status === "未解锁",
  `永恒=${eternalRow && eternalRow.status}，现实=${realityRow && realityRow.status}`);

// ⑤-b 「条件已满足但尚未进入」与「已进入」要能区分
await page.evaluate(() => {
  player.realities = 1;
  Achievement(147).unlock(true, true);
  GameUI.update();
});
await wait(1200);
const mixedRows = await readRows();
const realityRow2 = mixedRows.find(r => r.name === "现实期");
const celRow = mixedRows.find(r => r.name === "天神期");
check("现实行转「已进入」", realityRow2 && realityRow2.status === "已进入", `现实=${realityRow2 && realityRow2.status}`);
check("天神行区分「条件已满足，尚未进入」",
  celRow && celRow.status === "条件已满足，尚未进入" && !celRow.hasLockPrefix,
  `天神=${celRow && celRow.status}，带锁前缀=${celRow && celRow.hasLockPrefix}`);

// 入口挂载点：选项页确实有「内置教程」按钮
await page.evaluate(() => {
  Modal.hideAll();
  Tab.options.show(true, Tab.options.gameplay);
});
await wait(600);
const entryButton = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "内置教程");
  return btn ? btn.textContent.trim() : null;
});
check("选项 → 游戏性 页有「内置教程」入口按钮", entryButton === "内置教程", `button=${entryButton}`);

// ⑥ 无未捕获异常
check("无未捕获异常", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n===== ${results.length - failed}/${results.length} 通过 =====`);
if (failed) process.exitCode = 1;
