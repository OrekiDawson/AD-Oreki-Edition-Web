// P0/P2 只读探针：Async.run 三条路径的清理行为 + 自动购买器的计时语义
// 不改 src；所有插桩都在页面运行时做（包装函数，调用后还原）
//
// 用法：node probe-async-cadence.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
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
await new Promise(r => server.listen(8450, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8450/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS 就绪");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };

  const sim = { entry: 0, exit: 0, then: 0, bars: [], maxTicks: null };
  const ab = { attempts: 0, purchases: 0, perBuyer: {} };
  let abWrapped = false;

  window.__p = {
    lg, num,
    resetSim() { sim.entry = 0; sim.exit = 0; sim.then = 0; sim.bars = []; sim.maxTicks = null; },
    simState() {
      return {
        ...sim,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        gameLoopRunning: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
      };
    },
    // 包装 Async.run：记录 three 回调是否被调用，并记录进度条 max（= 被接受的 tick 数）
    hookAsync() {
      if (window.Async.__hooked) return true;
      const orig = Async.run.bind(Async);
      const wrapped = (fun, maxIter, config = {}) => {
        const c = { ...config };
        c.asyncEntry = (...a) => { sim.entry++; try { const b = ui.$viewModel.modal.progressBar; if (b && b.max != null) sim.maxTicks = b.max; } catch (e) { /* ignore */ } return config.asyncEntry && config.asyncEntry(...a); };
        c.asyncExit = (...a) => { sim.exit++; return config.asyncExit && config.asyncExit(...a); };
        c.then = config.then ? (...a) => { sim.then++; return config.then(...a); } : undefined;
        return orig(fun, maxIter, c);
      };
      Async.run = wrapped;
      window.Async.__hooked = true;
      return true;
    },
    // 包装每个自动购买器的 tick，统计"尝试"和"真正花了资源"的次数
    hookAutobuyers() {
      if (abWrapped) return true;
      for (const b of Autobuyers.all) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        const key = b.constructor && b.constructor.name || "anon";
        b.__origTick = orig;
        b.tick = (...args) => {
          ab.attempts++;
          ab.perBuyer[key] = (ab.perBuyer[key] || 0) + 1;
          return orig(...args);
        };
      }
      abWrapped = true;
      return true;
    },
    abState() { return { ...ab, perBuyer: { ...ab.perBuyer } }; },
    resetAb() { ab.attempts = 0; ab.purchases = 0; ab.perBuyer = {}; return true; },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      return this.snap();
    },
    snap() {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: lg(Currency.antimatter.value),
        ipLog: lg(Currency.infinityPoints.value),
        epLog: lg(Currency.eternityPoints.value),
        inf: num(Currency.infinities.value),
        eter: num(Currency.eternities.value),
        speedup: safe(() => getGameSpeedupFactor()),
        locked: safe(() => GameSpeed.isSimulationLocked),
        intervals: safe(() => GameIntervals.gameLoop.isStarted),
      };
    },
    // 直接调 simulateTime（与 storage.js:506 完全相同的参数形状）
    sim(sec, real, fast) { simulateTime(sec, real, fast); return true; },
    // 自动购买器：只启用指定几个 + 采样 interval / timeSinceLastTick
    probeAutobuyers() {
      const out = [];
      for (const b of Autobuyers.all) {
        if (!b) continue;
        out.push({
          name: (b.constructor && b.constructor.name) || "anon",
          isBought: (() => { try { return !!b.isBought; } catch (e) { return null; } })(),
          isEnabled: (() => { try { return !!b.isEnabled; } catch (e) { return null; } })(),
          interval: (() => { try { return b.interval; } catch (e) { return null; } })(),
          since: (() => { try { return b.timeSinceLastTick; } catch (e) { return null; } })(),
          canTick: (() => { try { return !!b.canTick; } catch (e) { return null; } })(),
        });
      }
      return out;
    },
    runFrames(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__p.hookAsync();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");

// ================= A. Async.run 三条路径 =================
console.log("\n========== A. Async.run 路径与清理行为 ==========");
const A = {};

// A1 正常异步（tick 足够多，必然分批）
{
  await page.evaluate(({ text }) => { window.__p.load(text, 10000); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  await page.evaluate(() => window.__p.sim(300, false, false));
  // 等模拟真正结束（锁释放）
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__p.simState());
    if (!st.locked) break;
    await new Promise(r => setTimeout(r, 100));
  }
  A.normal = await page.evaluate(() => window.__p.simState());
  console.log(`  A1 正常异步：entry=${A.normal.entry} exit=${A.normal.exit} then=${A.normal.then} ticks=${A.normal.maxTicks} 锁=${A.normal.locked} intervals=${A.normal.gameLoopRunning} asyncEnabled=${A.normal.asyncEnabled}`);
}
check("[A1] 正常异步路径：asyncEntry / asyncExit / then 三者都触发，锁释放、计时器重启",
  A.normal.entry >= 1 && A.normal.exit === 1 && A.normal.then === 1 && A.normal.locked === false && A.normal.gameLoopRunning === true,
  `entry=${A.normal.entry} exit=${A.normal.exit} then=${A.normal.then} locked=${A.normal.locked} intervals=${A.normal.gameLoopRunning}`);

// A2 单批完成（_run 的 `if (!remaining) return;` 早退）→ asyncExit 应当不触发
{
  await page.evaluate(({ text }) => { window.__p.load(text, 1); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  // S 小 → ticks 小 → 可能 60ms 内跑完
  await page.evaluate(() => window.__p.sim(1, false, false));
  await new Promise(r => setTimeout(r, 800));
  A.small = await page.evaluate(() => window.__p.simState());
  console.log(`  A2 单批(1s 离线)：entry=${A.small.entry} exit=${A.small.exit} then=${A.small.then} ticks=${A.small.maxTicks} 锁=${A.small.locked} intervals=${A.small.gameLoopRunning}`);
}
note(`[A2] 1 秒离线的 tick 数=${A.small.maxTicks}，entry=${A.small.entry}（0=首段就跑完，没进异步循环）、exit=${A.small.exit}。` +
  `这正是 src/core/async-utils.js:73 \`if (!config.progress.remaining) return;\` 的早退分支。`);

// A3 同步回退（Async.enabled=false 时再跑一次）
{
  await page.evaluate(({ text }) => { window.__p.load(text, 10000); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  await page.evaluate(() => { Async.enabled = false; window.__p.sim(60, false, false); });
  await new Promise(r => setTimeout(r, 500));
  A.sync = await page.evaluate(() => window.__p.simState());
  console.log(`  A3 同步回退：entry=${A.sync.entry} exit=${A.sync.exit} then=${A.sync.then} 锁=${A.sync.locked} intervals=${A.sync.gameLoopRunning} asyncEnabled=${A.sync.asyncEnabled}`);
  // 清理（不改 src，只是把运行时状态复位，避免污染后续用例）
  await page.evaluate(() => { try { GameSpeed.endSimulation(); } catch (e) { } Async.enabled = true; });
}
check("[A3] 同步回退路径：then 触发，但 asyncEntry/asyncExit 都不触发（清理被跳过）",
  A.sync.then >= 1 && A.sync.entry === 0 && A.sync.exit === 0,
  `entry=${A.sync.entry} exit=${A.sync.exit} then=${A.sync.then}`);
check("[A3b] 同步回退后倍率仍被冻结（OrekiSpeed.endSimulation 未执行 → 令牌泄漏）",
  A.sync.locked === true, `locked=${A.sync.locked}`);
note(`[A3-风险] 同步回退同时跳过 \`GameStorage.postLoadStuff()\`（重启 GameIntervals）与 \`OrekiSpeed.endSimulation\`：` +
  `intervals=${A.sync.gameLoopRunning}（false = 游戏停摆）、锁=${A.sync.locked}（true = 倍率设置改不动，直到刷新）。`);

// A4 异常路径：fun 抛错 → promise reject → then 不执行 → enabled 永久 false
{
  A.exc = await page.evaluate(async () => {
    const before = Async.enabled;
    let exitCalled = 0, thenCalled = 0, rejected = false;
    try {
      await Async.run(() => { throw new Error("probe"); }, 5, {
        maxTime: 1, batchSize: 1,
        asyncExit: () => { exitCalled++; },
        then: () => { thenCalled++; },
      });
    } catch (e) { rejected = true; }
    const after = Async.enabled;
    try { Async.enabled = true; } catch (e) { /* ignore */ }
    return { before, after, rejected, exitCalled, thenCalled };
  });
  console.log(`  A4 异常：rejected=${A.exc.rejected} asyncExit=${A.exc.exitCalled} then=${A.exc.thenCalled} Async.enabled ${A.exc.before} → ${A.exc.after}`);
}
check("[A4] 异常退出后 Async.enabled 不会恢复（永久 false），且 asyncExit/then 都不触发",
  A.exc.rejected === true && A.exc.after === false && A.exc.exitCalled === 0 && A.exc.thenCalled === 0,
  `enabled ${A.exc.before}→${A.exc.after}，exit=${A.exc.exitCalled} then=${A.exc.thenCalled}`);
note("[A4-后果] enabled 一旦变 false，此进程内**后续所有** Async.run（含每次离线结算）都会走同步回退 → 每次都跳过 restart intervals + 解冻。");

// A5 重复获取令牌
{
  A.token = await page.evaluate(() => {
    const t1 = GameSpeed.beginSimulation();
    const t2 = GameSpeed.beginSimulation();
    const lockedAfterTwo = GameSpeed.isSimulationLocked;
    GameSpeed.endSimulation(t1);                 // 用旧令牌释放
    const lockedAfterOld = GameSpeed.isSimulationLocked;
    GameSpeed.endSimulation(t2);                 // 用当前令牌释放
    return { lockedAfterTwo, lockedAfterOld, lockedAfterNew: GameSpeed.isSimulationLocked };
  });
  console.log(`  A5 令牌：两次 begin 后 locked=${A.token.lockedAfterTwo}；用旧令牌 end 后 locked=${A.token.lockedAfterOld}；用新令牌 end 后 locked=${A.token.lockedAfterNew}`);
}
check("[A5] 令牌只能被「当前那一个」释放：旧令牌释放被静默忽略（重复加锁 = 泄漏路径）",
  A.token.lockedAfterTwo === true && A.token.lockedAfterOld === true && A.token.lockedAfterNew === false,
  `two=${A.token.lockedAfterTwo} old=${A.token.lockedAfterOld} new=${A.token.lockedAfterNew}`);

// ================= B. 自动购买器节奏 =================
console.log("\n========== B. 自动购买器：计时语义与高 F 下的频率 ==========");
await page.evaluate(() => window.__p.hookAutobuyers());
const SAVE_AB = "1000._9.73e14iM+Cel6+1.84e45SG.txt";
const abInfo = await page.evaluate(({ text }) => { window.__p.load(text, 1); return window.__p.probeAutobuyers(); }, { text: save(SAVE_AB) });
const enabledAB = abInfo.filter(x => x.isEnabled && x.interval != null);
console.log(`  存档 ${SAVE_AB}：自动购买器共 ${abInfo.length} 个，其中已启用 ${enabledAB.length} 个`);
console.log(`  已启用样例（interval 单位观察）：`);
for (const x of enabledAB.slice(0, 6)) console.log(`    ${x.name.padEnd(32)} interval=${x.interval}ms since=${x.since?.toFixed?.(0) ?? x.since} canTick=${x.canTick}`);
const intervalSample = enabledAB[0]?.interval;

// B1：同样 200 帧，F=1 vs F=10000，看"自动购买器触发次数 / 游戏时间"
const B = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__p.load(text, F); window.__p.resetAb(); }, { text: save(SAVE_AB), F });
  const s0 = await page.evaluate(() => window.__p.snap());
  const r = await page.evaluate(() => window.__p.runFrames(200, 20));
  const abState = await page.evaluate(() => window.__p.abState());
  B.push({ F, s0, s1: r, ab: abState, dGame: r.game - s0.game, dReal: r.real - s0.real, dAm: r.amLog - s0.amLog, dIp: r.ipLog - s0.ipLog });
  console.log(`  F=${String(F).padStart(5)}：帧 200，Δ游戏时间=${e(B[1 - B.indexOf(B[0])] ? 0 : 0) || ""}${e(B[B.length - 1].dGame)}ms，Δ现实=${B[B.length - 1].dReal.toFixed(0)}ms，` +
    `自动购买器 tick 调用=${abState.attempts}，Δlog10(AM)=${(B[B.length - 1].dAm).toFixed(4)}，Δlog10(IP)=${(B[B.length - 1].dIp).toFixed(4)}`);
}
const b1 = B[0], b2 = B[1];
console.log(`  每 1 个"游戏小时"的购买器 tick 数：F=1 ${(b1.ab.attempts / (b1.dGame / 3600000)).toFixed(3)}，F=10000 ${(b2.ab.attempts / (b2.dGame / 3600000)).toFixed(6)}`);
check("[B1] 自动购买器的触发由「自身计时器 + 现实时间」决定，不随 F 缩放",
  Math.abs(b2.ab.attempts - b1.ab.attempts) / Math.max(b1.ab.attempts, 1) < 0.25,
  `同样 200 帧：F=1 ${b1.ab.attempts} 次 vs F=10000 ${b2.ab.attempts} 次（游戏时间差 ${(b2.dGame / b1.dGame).toFixed(0)}×）`);
note(`[B1-结论] 同样的 200 帧（= 4s 现实时间代理），F=1 推进 ${e(b1.dGame)}ms 游戏时间、购买器触发 ${b1.ab.attempts} 次；` +
  `F=10000 推进 ${e(b2.dGame)}ms（${(b2.dGame / b1.dGame).toFixed(0)}× 游戏时间），购买器触发次数几乎不变（${b2.ab.attempts} 次）。` +
  `→ 单位游戏时间内的购买决策密度随 F 线性下降；这就是 k 实验里 3.64× 缺口在生产自动购买器上的对应表现。`);
note(`[B1-机制] 源码：\`timeSinceLastTick = player.records.realTimePlayed - data.lastTick\`（autobuyer.js:100），` +
  `而 \`realTimePlayed\` 累加的是 \`realDiff / F\` = 墙钟。所以 interval（样例 ${intervalSample}ms）是**现实毫秒**，与 F 无关。`);

// ================= C. 离线模拟中的自动购买器 =================
console.log("\n========== C. 离线模拟（fast=false）里的自动购买器频率 ==========");
const C = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__p.load(text, F); window.__p.resetAb(); window.__p.resetSim(); }, { text: save(SAVE_AB), F });
  const s0 = await page.evaluate(() => window.__p.snap());
  await page.evaluate(() => window.__p.sim(300, false, false));
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__p.simState());
    if (!st.locked) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const s1 = await page.evaluate(() => window.__p.snap());
  const abState = await page.evaluate(() => window.__p.abState());
  const sim = await page.evaluate(() => window.__p.simState());
  C.push({ F, ticks: sim.maxTicks, attempts: abState.attempts, dGame: s1.game - s0.game, dReal: s1.real - s0.real });
  console.log(`  F=${String(F).padStart(5)}：离线 300s，ticks=${sim.maxTicks}，Δ游戏=${e(s1.game - s0.game)}ms，Δ现实=${(s1.real - s0.real).toFixed(0)}ms，购买器 tick=${abState.attempts}`);
}
const c1 = C[0], c2 = C[1];
check("[C1] 离线模拟的 tick 数与 F 无关（同一现实秒数 → 同一批次数）",
  Math.abs((c2.ticks || 0) - (c1.ticks || 0)) <= Math.max(2, c1.ticks * 0.02),
  `F=1 ${c1.ticks} vs F=10000 ${c2.ticks}`);
check("[C2] 离线时购买器只按 tick 触发（tick 数与 F 无关）→ 高 F 下单位游戏时间的决策密度同样被稀释",
  Math.abs((c2.attempts || 0) - (c1.attempts || 0)) <= Math.max(0.05 * c1.attempts, 5),
  `F=1 ${c1.attempts} 次 vs F=10000 ${c2.attempts} 次（游戏时间差 ${(c2.dGame / c1.dGame).toFixed(0)}×）`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/probe-async-cadence.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), A, B, C, abInfo: abInfo.filter(x => x.isEnabled).slice(0, 8), verdict: results, errors: errs }, null, 2));
console.log("\n已写入 _research/probe-async-cadence.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
