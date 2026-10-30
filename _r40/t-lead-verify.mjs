// team-lead 自验：执行层接进 gameLoop 之后，游戏还能不能正常加载与运行。
//
// 为什么需要这一份：agent-a 声称执行层已接线，但接线之后的"整页是否还能起来"
// 只有它自己报过。我作为集成方必须自己看一帧，否则打包上线就是把未验的东西推给玩家。
//
// 做法：headless Edge + puppeteer-core，加载本地 serve，等 GameUI 初始化，
// 跑 20 s，收集控制台错误与智能层状态，再打开教程弹窗看它能不能停住。
//
// 用法：node _tools/_r40/t-lead-verify.mjs

import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://127.0.0.1:8123/index.html";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const RUN_MS = Number(process.argv[3] || 20000);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});

const page = await browser.newPage();
const errors = [];
const pageErrors = [];
page.on("console", msg => {
  if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
});
page.on("pageerror", err => pageErrors.push(String(err).slice(0, 300)));

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

// 等游戏初始化（GameUI.initialized 由 main.js 在加载完成后置真）
let initOk = false;
try {
  await page.waitForFunction("window.GameUI && window.GameUI.initialized === true", { timeout: 60000 });
  initOk = true;
} catch (e) {
  initOk = false;
}

const line = o => JSON.stringify(o);

if (!initOk) {
  console.log(line({ initOk, note: "GameUI 未初始化", errors: errors.slice(0, 5), pageErrors: pageErrors.slice(0, 5) }));
  await browser.close();
  process.exit(1);
}

const before = await page.evaluate(() => ({
  hasStrategy: Boolean(window.OrekiSmartStrategy),
  hasExecutor: Boolean(window.OrekiSmartExecutor),
  antimatter: window.player ? String(window.player.antimatter) : null,
  gameEnd: window.GameEnd ? window.GameEnd.endState : null,
}));

// 让它真跑一段
await sleep(RUN_MS);

const after = await page.evaluate(() => {
  const w = window;
  const out = {
    amE: w.player ? Math.log10(Math.max(1, Number(w.player.antimatter.mantissa) || 1)) + w.player.antimatter.exponent : null,
    endState: w.GameEnd ? w.GameEnd.endState : null,
    strategy: null,
    executor: null,
  };
  try {
    out.strategy = w.OrekiSmartStrategy && w.OrekiSmartStrategy.debugState ? w.OrekiSmartStrategy.debugState() : "no debugState";
  } catch (e) {
    out.strategy = "throw: " + String(e).slice(0, 200);
  }
  try {
    out.executor = w.OrekiSmartExecutor && w.OrekiSmartExecutor.debugState ? w.OrekiSmartExecutor.debugState() : "no debugState";
  } catch (e) {
    out.executor = "throw: " + String(e).slice(0, 200);
  }
  return out;
});

// 教程弹窗：打开后连测 6 秒，看它是否还在、章节数对不对
const tutorial = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const res = { opened: false, presentAt: [], chapters: null, title: null };
  try {
    window.Modal.orekiTutorial.show();
  } catch (e) {
    res.error = String(e).slice(0, 200);
    return res;
  }
  await sleep(200);
  for (let i = 0; i < 12; i++) {
    const el = document.querySelector(".c-oreki-tut__layout");
    res.presentAt.push(el ? 1 : 0);
    if (el && !res.title) {
      const t = document.querySelector(".c-oreki-tut__chapter-title, .c-oreki-tut__title");
      res.title = t ? t.textContent.trim().slice(0, 40) : null;
    }
    await sleep(500);
  }
  res.opened = res.presentAt.some(v => v === 1);
  res.stayed = res.presentAt.slice(-3).every(v => v === 1);
  try {
    res.chapters = window.Modal?.orekiTutorial?._props?.chapters?.length ?? null;
  } catch (e) { /* 忽略 */ }
  // 关掉，避免影响后续
  try { window.Modal.hideAll(); } catch (e) { /* 忽略 */ }
  return res;
});

const smartErrors = errors.filter(e => /oreki|smart|executor|strategy/i.test(e));

console.log(line({
  initOk,
  before,
  after,
  strategyOk: after.strategy && after.strategy.ok !== undefined ? after.strategy.ok : null,
  strategyDegraded: after.strategy && after.strategy.degraded !== undefined ? after.strategy.degraded : null,
  strategyErr: after.strategy && after.strategy.lastError !== undefined ? after.strategy.lastError : null,
  tutorial,
  consoleErrorCount: errors.length,
  smartRelatedErrors: smartErrors.slice(0, 5),
  pageErrorCount: pageErrors.length,
  pageErrors: pageErrors.slice(0, 5),
  consoleErrorSample: errors.slice(0, 5),
}));

await browser.close();
