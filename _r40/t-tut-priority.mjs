// 验收：教程弹窗 priority 0 -> 4 之后，还能不能被提示积压顶掉。
//
// 被测的真实路径：`OptionsGameplayTab.js:362` 的按钮就是
//   onclick="Modal.orekiTutorial.show()"
// 所以探针直接调 show() 等于玩家点按钮，不是绕过 UI 的作弊调用。
//
// 判据（用户要求）：跑满 20 s 让提示堆起来 -> 点教程 -> 1 s 内出现 -> 之后 6 s 一直在。
// 逐 100 ms 采样，统计 "首帧出现时刻" 与 "连续可见时长"，任何一次跌落都记下来。
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://127.0.0.1:8123/index.html";
const WARMUP_MS = Number(process.argv[3] || 20000);
const WATCH_MS = 6000;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror:" + String(e).slice(0, 300)));
page.on("console", m => { if (m.type() === "error") errs.push("console:" + m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction("window.GameUI && window.GameUI.initialized === true", { timeout: 60000 });

// 1) 空跑 WARMUP_MS，让成就/无限等提示自然堆积到队列里
await page.evaluate(ms => new Promise(r => setTimeout(r, ms)), WARMUP_MS);

// 2) 记录点教程瞬间的现场
const before = await page.evaluate(() => ({
  queueLen: (window.ui?.view?.modal?.queue ?? []).length,
  queueNames: (window.ui?.view?.modal?.queue ?? []).map(m => m?._component?.name ?? "?"),
  current: window.ui?.view?.modal?.current?._component?.name ?? null,
  gameEnd: Boolean(window.player?.isGameEnd),
  realities: window.player?.realities,
  tSec: Math.round(performance.now()),
}));

// 3) 走真实入口
await page.evaluate(() => window.Modal.orekiTutorial.show());

// 4) 逐 100 ms 采样 6 s
const samples = await page.evaluate(async WATCH_MS => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const t0 = performance.now();
  while (performance.now() - t0 < WATCH_MS) {
    rows.push({
      dt: Math.round(performance.now() - t0),
      tut: document.querySelectorAll("[class*='oreki-tut']").length,
      cur: window.ui?.view?.modal?.current?._component?.name ?? null,
      q: (window.ui?.view?.modal?.queue ?? []).length,
      // 章节从 DOM 读，不从 `_component` 读：Vue 3 挂载后 `_component` 上拿不到 data 字段，
      // 上一版读出来全程 null，等于没判（`chapterStable` 会因为「只有 null」而永远为真）。
      chapter: (() => {
        const el = document.querySelector("[class*='oreki-tut'][class*='title']")
          ?? document.querySelector("[class*='oreki-tut'] h1, [class*='oreki-tut'] h2");
        return el ? el.textContent.trim().slice(0, 40) : null;
      })(),
    });
    await sleep(100);
  }
  return rows;
}, WATCH_MS);

// 5) 复原，别把游戏留在弹窗态
await page.evaluate(() => { try { window.Modal.hideAll(); } catch { /* 忽略 */ } });

// ---- 判定 ----
const firstVisible = samples.find(r => r.tut > 0)?.dt ?? null;
const lost = samples.filter(r => r.tut === 0).map(r => r.dt);
let longestZeroRun = 0, run = 0;
for (const r of samples) { if (r.tut === 0) { run++; longestZeroRun = Math.max(longestZeroRun, run); } else run = 0; }
const chapterHistory = [...new Set(samples.map(r => r.chapter))];

const verdict = {
  appearedWithin1s: firstVisible !== null && firstVisible <= 1000,
  stayedFull6s: lost.length === 0,
  // 章节不能中途被重建拉回去（FACTS C.37 的真伤害）
  chapterStable: chapterHistory.filter(Boolean).length <= 1,
};

console.log(JSON.stringify({
  warmupMs: WARMUP_MS,
  before,
  firstVisibleMs: firstVisible,
  zeroSamples: lost.length,
  zeroAt: lost.slice(0, 20),
  longestZeroRun100ms: longestZeroRun,
  chapterHistory,
  currentSeen: [...new Set(samples.map(r => r.cur))],
  verdict,
  pass: verdict.appearedWithin1s && verdict.stayedFull6s && verdict.chapterStable,
  pageErrors: errs.slice(0, 5),
}, null, 1));

await browser.close();
