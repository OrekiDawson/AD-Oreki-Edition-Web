// P0 关键问题：正式离线路径（diff ≥ 50s → fast=false，ticks ≥ 1000）会不会落进
//            `_run` 的「单批早退」分支（entry=0/exit=0 → 不清进度条、不解冻、不重启 intervals）？
// P2 补充：换成中期存档 + 手动启用自动购买器，量高 F 下的购买节奏。
// 不改 src。
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
await new Promise(r => server.listen(8460, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|progress\.info is not a function|ModalProgressBar|Vue warn/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8460/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS 就绪");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const st = { entry: 0, exit: 0, then: 0, maxTicks: null, exitIntervalState: null };
  const ab = { calls: 0 };
  window.__q = {
    lg, num, st,
    reset() { st.entry = 0; st.exit = 0; st.then = 0; st.maxTicks = null; st.exitIntervalState = null; return true; },
    hook() {
      if (window.Async.__hooked2) return true;
      const orig = Async.run.bind(Async);
      Async.run = (fun, maxIter, config = {}) => {
        const c = { ...config };
        c.asyncEntry = (...a) => { st.entry++; try { const b = ui.$viewModel.modal.progressBar; if (b && b.max != null) st.maxTicks = b.max; } catch (e) { } return config.asyncEntry && config.asyncEntry(...a); };
        c.asyncExit = (...a) => { st.exit++; st.exitIntervalState = (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(); return config.asyncExit && config.asyncExit(...a); };
        c.then = config.then ? (...a) => { st.then++; return config.then(...a); } : undefined;
        return orig(fun, maxIter, c);
      };
      window.Async.__hooked2 = true;
      return true;
    },
    state() {
      return { ...st,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        intervals: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        bar: (() => { try { return ui.$viewModel.modal.progressBar !== undefined; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
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
    cleanup() { try { GameSpeed.endSimulation(); } catch (e) { } try { ui.$viewModel.modal.progressBar = undefined; } catch (e) { } try { Async.enabled = true; } catch (e) { } return true; },
    snap() {
      return { game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })() };
    },
    // 自动购买器：启用前 N 个维度购买器（若存档里没买过则跳过），只读统计调用
    enableAB() {
      const out = [];
      for (const b of Autobuyers.all) {
        if (!b) continue;
        try {
          if (b.isBought) { b.isEnabled = true; out.push((b.constructor && b.constructor.name) || "anon"); }
        } catch (e) { /* ignore */ }
      }
      return out;
    },
    abCount() {
      let n = 0, enabled = 0;
      for (const b of Autobuyers.all) { if (!b) continue; n++; try { if (b.isEnabled) enabled++; } catch (e) { } }
      return { total: n, enabled };
    },
    hookAB() {
      if (window.__abHooked) return true;
      for (const b of Autobuyers.all) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        b.tick = (...a) => { ab.calls++; return orig(...a); };
      }
      window.__abHooked = true;
      return true;
    },
    resetAB() { ab.calls = 0; return true; },
    abCalls() { return ab.calls; },
    runFrames(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__q.hook();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");
const MID = "132._9.1e137IP.txt";

// ================= A. 生产阈值附近：diff 50s 起 fast=false =================
console.log("\n========== A. 正式离线阈值附近（fast=false，ticks=20×秒） ==========");
console.log("   秒数   ticks   entry  exit   then   锁     intervals  进度条");
const A = [];
for (const S of [50, 55, 60, 90, 120, 300]) {
  await page.evaluate(({ text }) => { window.__q.load(text, 10000); window.__q.reset(); }, { text: save(MID) });
  await page.evaluate((S) => window.__q.sim(S, false, false), S);
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__q.state());
    if (!st.locked && st.then > 0) break;
    await new Promise(r => setTimeout(r, 80));
  }
  const st = await page.evaluate(() => window.__q.state());
  A.push({ S, ticks: S * 20, ...st });
  console.log(`  ${String(S).padStart(6)} ${String(S * 20).padStart(7)} ${String(st.entry).padStart(6)} ${String(st.exit).padStart(5)} ${String(st.then).padStart(6)} ${String(st.locked).padStart(6)} ${String(st.intervals).padStart(11)} ${String(st.bar)}`);
  await page.evaluate(() => window.__q.cleanup());
}
const singleBatch = A.filter(r => r.entry === 0 && r.exit === 0);
check("[A1] 正式阈值（≥50s → fast=false）下存在「单批早退」：entry=0 且 exit=0",
  singleBatch.length > 0,
  singleBatch.length ? `命中秒数：${singleBatch.map(r => r.S).join("/")}（ticks ${singleBatch.map(r => r.ticks).join("/")}）` : "全部走分批路径");
check("[A2] 单批早退时，退出的确有副作用：锁未释放 / intervals 未重启 / 进度条残留",
  singleBatch.length > 0 && singleBatch.some(r => r.locked === true || r.intervals === false),
  singleBatch.map(r => `S=${r.S}: lock=${r.locked} intervals=${r.intervals} bar=${r.bar}`).join(" | ") || "无样本");
note(`[A1-机制] async-utils.js:73 \`if (!config.progress.remaining) return;\` —— 第一段 60ms 内跑完全部 tick 就直接 return，` +
  `\`asyncExit\`（＝\`GameStorage.postLoadStuff()\` + \`OrekiSpeed.endSimulation\`）不会执行。` +
  `本机在 ${singleBatch.map(r => r.S + "s").join("/") || "（无）"} 命中；这是**机器速度相关**的边界，不是固定秒数。`);

// ================= B. 自动购买器节奏（中期存档 + 手动启用） =================
console.log("\n========== B. 自动购买器节奏（中期存档 132） ==========");
await page.evaluate(({ text }) => { window.__q.load(text, 1); window.__q.hookAB(); }, { text: save(MID) });
const abBefore = await page.evaluate(() => window.__q.abCount());
const abEnabled = await page.evaluate(() => window.__q.enableAB());
console.log(`  自动购买器总数 ${abBefore.total}，原本启用 ${abBefore.enabled} 个；本次手动启用（已购买者）${abEnabled.length} 个`);
const B = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__q.load(text, F); window.__q.enableAB(); window.__q.resetAB(); }, { text: save(MID), F });
  const s0 = await page.evaluate(() => window.__q.snap());
  const s1 = await page.evaluate(() => window.__q.runFrames(200, 20));
  const calls = await page.evaluate(() => window.__q.abCalls());
  const r = { F, calls, dGame: s1.game - s0.game, dReal: s1.real - s0.real, dIp: s1.ipLog - s0.ipLog, dInf: s1.inf - s0.inf };
  B.push(r);
  console.log(`  F=${String(F).padStart(5)}：200 帧，Δ游戏=${e(r.dGame)}ms，Δ现实=${r.dReal.toFixed(0)}ms，购买器 tick=${r.calls}，Δlog10(IP)=${r.dIp.toFixed(4)}，Δ无限=${e(r.dInf)}`);
}
const b1 = B[0], b2 = B[1];
const density1 = b1.calls / (b1.dGame / 1e3), density2 = b2.calls / (b2.dGame / 1e3);
console.log(`  决策密度（购买器 tick / 游戏秒）：F=1 ${density1.toExponential(3)}，F=10000 ${density2.toExponential(3)}（比 ${(density1 / density2).toFixed(0)}×）`);
check("[B1] 同样 200 帧，购买器触发次数与 F 无关（差异 <5%）",
  Math.abs(b2.calls - b1.calls) / Math.max(b1.calls, 1) < 0.05,
  `F=1 ${b1.calls} 次 vs F=10000 ${b2.calls} 次`);
check("[B2] 单位游戏时间的决策密度随 F 线性下降（F=1 至少是 F=10000 的 100 倍）",
  density1 / Math.max(density2, 1e-12) > 100,
  `${(density1 / density2).toFixed(0)}×`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/probe-async-singlebatch.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), A, B, abBefore, abEnabled, verdict: results, errors: errs }, null, 2));
console.log("\n已写入 _research/probe-async-singlebatch.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
