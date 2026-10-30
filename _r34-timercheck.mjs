// 连到正在冻结中的页面，做定时器存活判定（不重启游戏）
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9450", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
console.log("url:", page.url());

const out = await page.evaluate(() => {
  const R = globalThis.__r34 || {};
  return {
    vis: document.visibilityState,
    hidden: document.hidden,
    hasFocus: document.hasFocus(),
    age: Date.now() - player.lastUpdate,
    glStarted: GameIntervals.gameLoop.isStarted,
    loop: R.loop,
    saveIvStarted: GameIntervals.save.isStarted,
    checkIvStarted: GameIntervals.checkEverySecond.isStarted,
  };
}).catch(e => ({ err: String(e) }));
console.log("状态:", JSON.stringify(out));

// 1) setTimeout 是否还会触发（300ms）
const toOk = await Promise.race([
  page.evaluate(() => new Promise(r => { const t0 = Date.now(); setTimeout(() => r(Date.now() - t0), 300); })),
  new Promise(r => setTimeout(() => r("TIMEOUT>4000ms"), 4000)),
]).catch(e => "ERR:" + e.message);
console.log("setTimeout(300ms) 结果:", toOk);

// 2) rAF 是否还会触发
const rafOk = await Promise.race([
  page.evaluate(() => new Promise(r => { const t0 = Date.now(); requestAnimationFrame(() => r(Date.now() - t0)); })),
  new Promise(r => setTimeout(() => r("TIMEOUT>4000ms"), 4000)),
]).catch(e => "ERR:" + e.message);
console.log("requestAnimationFrame 结果:", rafOk);

// 3) 直接重启 gameLoop 间隔器，看是否能恢复（诊断用，不写存档）
const beforeTick = await page.evaluate(() => globalThis.__r34.loop.enter);
const restartRes = await page.evaluate(() => {
  try { GameIntervals.gameLoop.restart(); return "restarted"; } catch (e) { return "ERR:" + e.message; }
});
console.log("gameLoop.restart():", restartRes);
await new Promise(r => setTimeout(r, 1500));
const afterTick = await page.evaluate(() => globalThis.__r34.loop.enter);
console.log(`重启后 1.5s 内 GAME_TICK_BEFORE: ${beforeTick} -> ${afterTick}（增量 ${afterTick - beforeTick}）`);

await browser.disconnect();
process.exit(0);
