// 回归测试：Async.run 三条路径（正常异步 / 同步回退 / 单批早退 / 异常）的清理契约
// 断言口径：asyncExit 必须在这四条路径下都被调用一次；OrekiSpeed 冻结令牌必须被释放；
//           GameIntervals 必须被重启；Async.enabled 不得被永久置 false。
//
// 用法：node verify-async-cleanup.mjs   （退出码 0 = 全部通过）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const ROOT_ABS = path.resolve(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT_ABS, "." + p);
  const rel = path.relative(ROOT_ABS, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8470, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|progress\.info is not a function|ModalProgressBar|Vue warn/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8470/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL  游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS  就绪");

await page.evaluate(() => {
  const st = { entry: 0, exit: 0, then: 0 };
  window.__t = {
    st,
    reset() { st.entry = 0; st.exit = 0; st.then = 0; return true; },
    hook() {
      if (window.Async.__hookedT) return true;
      const orig = Async.run.bind(Async);
      Async.run = (fun, maxIter, config = {}) => {
        const c = { ...config };
        if (config.asyncEntry) c.asyncEntry = (...a) => { st.entry++; return config.asyncEntry(...a); };
        if (config.asyncExit) c.asyncExit = (...a) => { st.exit++; return config.asyncExit(...a); };
        if (config.then) c.then = (...a) => { st.then++; return config.then(...a); };
        return orig(fun, maxIter, c);
      };
      window.Async.__hookedT = true;
      return true;
    },
    state() {
      return { ...st,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        intervals: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        bar: (() => { try { return ui.$viewModel.modal.progressBar !== undefined; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
        eff: (() => { try { return GameSpeed.effectiveFactor; } catch (e) { return null; } })(),
        factor: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
      };
    },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      return true;
    },
    sim(sec, real, fast) { simulateTime(sec, real, fast); return true; },
    cleanup() {
      try { GameSpeed.endSimulation(); } catch (e) { }
      try { ui.$viewModel.modal.progressBar = undefined; } catch (e) { }
      try { Async.enabled = true; } catch (e) { }
      return true;
    },
  };
  window.__t.hook();
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const MID = "132._9.1e137IP.txt";
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");
async function waitIdle(timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await page.evaluate(() => window.__t.state());
    if (st.then > 0 && !st.locked) return st;
    await new Promise(r => setTimeout(r, 80));
  }
  return page.evaluate(() => window.__t.state());
}

// ---------- T1 正常异步 ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(300, false, false));
await waitIdle();
const t1 = await page.evaluate(() => window.__t.state());
console.log(`  T1 正常异步：entry=${t1.entry} exit=${t1.exit} then=${t1.then} locked=${t1.locked} intervals=${t1.intervals} enabled=${t1.asyncEnabled}`);
check("[T1] 正常异步：asyncExit 调用 1 次、锁释放、intervals 重启、Async.enabled 恢复",
  t1.entry >= 1 && t1.exit === 1 && t1.then === 1 && t1.locked === false && t1.intervals === true && t1.asyncEnabled === true,
  `entry=${t1.entry} exit=${t1.exit} then=${t1.then} locked=${t1.locked} intervals=${t1.intervals}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T2 同步回退（Async.enabled=false） ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => { Async.enabled = false; window.__t.sim(60, false, false); });
await new Promise(r => setTimeout(r, 400));
const t2 = await page.evaluate(() => window.__t.state());
console.log(`  T2 同步回退：entry=${t2.entry} exit=${t2.exit} then=${t2.then} locked=${t2.locked} intervals=${t2.intervals}`);
check("[T2] 同步回退也执行 asyncExit（锁释放 + intervals 重启），而不是只跑 then",
  t2.exit === 1 && t2.then === 1 && t2.locked === false && t2.intervals === true,
  `exit=${t2.exit} then=${t2.then} locked=${t2.locked} intervals=${t2.intervals}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T3 单批早退（ticks 少到一段内跑完） ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(1, false, false));
await new Promise(r => setTimeout(r, 400));
const t3 = await page.evaluate(() => window.__t.state());
console.log(`  T3 单批早退：entry=${t3.entry} exit=${t3.exit} then=${t3.then} locked=${t3.locked} intervals=${t3.intervals} bar=${t3.bar}`);
check("[T3] 单批早退（_run 第一段就跑完）也执行 asyncExit：锁释放、intervals 重启、进度条清除",
  t3.exit === 1 && t3.locked === false && t3.intervals === true && t3.bar === false,
  `entry=${t3.entry} exit=${t3.exit} locked=${t3.locked} intervals=${t3.intervals} bar=${t3.bar}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T4 异常退出 ----------
const t4 = await page.evaluate(async () => {
  const before = Async.enabled;
  let exit = 0, then = 0, rejected = false;
  try {
    await Async.run(() => { throw new Error("probe-throw"); }, 5, {
      maxTime: 1, batchSize: 1,
      asyncExit: () => { exit++; },
      then: () => { then++; },
    });
  } catch (e) { rejected = true; }
  const out = { before, after: Async.enabled, rejected, exit, then };
  try { Async.enabled = true; } catch (e) { }
  return out;
});
console.log(`  T4 异常：rejected=${t4.rejected} exit=${t4.exit} then=${t4.then} enabled ${t4.before}→${t4.after}`);
check("[T4] 异常退出：asyncExit 仍被调用（fail-safe 清理），Async.enabled 恢复为 true，then 不执行",
  t4.rejected === true && t4.exit === 1 && t4.then === 0 && t4.after === true,
  `exit=${t4.exit} then=${t4.then} enabled=${t4.after}`);

// ---------- T5 重复清理安全 ----------
const t5 = await page.evaluate(() => {
  let err = null;
  try {
    GameSpeed.endSimulation();          // 无参：强制解冻
    GameSpeed.endSimulation();          // 再来一次
    const tok = GameSpeed.beginSimulation();
    GameSpeed.endSimulation(tok);
    GameSpeed.endSimulation(tok);       // 用已失效令牌再释放一次
  } catch (e) { err = e.message; }
  return { err, locked: GameSpeed.isSimulationLocked, eff: GameSpeed.effectiveFactor };
});
check("[T5] 重复清理安全：多次 endSimulation / 失效令牌释放都不抛错，最终为解锁状态",
  t5.err === null && t5.locked === false, `err=${t5.err || "无"} locked=${t5.locked} eff=${t5.eff}`);

// ---------- T6 连续两次结算 + 中途改倍率 ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(60, false, false));
await waitIdle();
const afterFirst = await page.evaluate(() => window.__t.state());
await page.evaluate(() => { GameSpeed.set(2); window.__t.reset(); });
await page.evaluate(() => window.__t.sim(60, false, false));
await new Promise(r => setTimeout(r, 400));
const t6b = await page.evaluate(() => window.__t.state());
console.log(`  第一次后 eff=${afterFirst.eff}；改倍率=2 后 eff=${t6b.eff}（存值 ${t6b.factor}），第二次 exit=${t6b.exit}`);
check("[T6] 结算后可正常修改倍率（无令牌泄漏），且第二次结算按新倍率执行",
  afterFirst.locked === false && t6b.eff === 2 && t6b.exit === 1 && t6b.locked === false,
  `eff ${afterFirst.eff} → ${t6b.eff}，第二次 exit=${t6b.exit} locked=${t6b.locked}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T7 模拟期间倍率冻结（修复不得破坏原有语义） ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(300, false, false));
await new Promise(r => setTimeout(r, 300));
const t7mid = await page.evaluate(() => {
  const before = GameSpeed.effectiveFactor;
  GameSpeed.set(3);
  const after = GameSpeed.effectiveFactor;
  GameSpeed.set(10000);
  return { before, after, locked: GameSpeed.isSimulationLocked };
});
await waitIdle();
const t7end = await page.evaluate(() => window.__t.state());
check("[T7] 模拟进行中倍率仍被冻结（改设置不影响生效值），结束后正常解冻",
  t7mid.locked === true && t7mid.after === t7mid.before && t7end.locked === false,
  `locked=${t7mid.locked} eff ${t7mid.before}→${t7mid.after}；结束后 locked=${t7end.locked}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T8 无 then 的调用也必须恢复 enabled ----------
const t8 = await page.evaluate(async () => {
  const before = Async.enabled;
  await Async.run(() => { }, 3, { maxTime: 1, batchSize: 1 });
  const after = Async.enabled;
  try { Async.enabled = true; } catch (e) { }
  return { before, after };
});
check("[T8] 未提供 then 的 Async.run 也会恢复 Async.enabled（不再永久失效）",
  t8.before === true && t8.after === true, `enabled ${t8.before}→${t8.after}`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
