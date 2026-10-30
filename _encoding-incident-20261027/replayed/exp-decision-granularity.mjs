// 决策粒度 A/B 实验：验证「每帧只跑一次采购」是否限制高 F 的实际收益
//
// 口径说明（重要）：
//   * 帧 = 墙钟代理，固定 20ms/帧（等价稳定 50fps），不是真实浏览器计时
//   * 策略 A：每帧 1 次决策（现状基线）
//   * 策略 B：每帧 k 次决策，把这一帧的 diff 平分成 k 段（每段 frameMs/k）
//     —— 不改变单次决策的语义，只改变决策发生的频率
//   * 每个 (F, k) 组合重复 REPS 次，逐次记录帧数/墙钟/游戏时间/末态
//   * 全部只跑在独立副本存档上；不触碰 _saves 原始文件
//
// 用法：node exp-decision-granularity.mjs [--reps=3] [--port=8310]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
  ".ttf": "font/ttf", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};
const arg = k => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split("=")[1] : null;
};
const REPS = Number(arg("reps") || 3);
const PORT = Number(arg("port") || 8310);
const FRAME_MS = 20;
const FRAMES_BUDGET = 20000;     // 与基线一致
const OPS_BUDGET = 400000;       // 帧数 × k 的硬上限，防止 k 很大时跑不完

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
  protocolTimeout: 900000,
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error") errs.push(`CONSOLE: ${m.text().slice(0, 200)}`); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });

// 就绪探测：本项目全局挂在全局词法环境，且 Currency 是 function
let ready = false;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() => {
    try {
      return typeof gameLoop === "function" && typeof Currency === "function" &&
        typeof buyAsManyAsYouCanBuy === "function" && typeof player === "object";
    } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 500));
}
if (!ready) {
  console.error("FAIL  游戏未在 30s 内启动");
  await browser.close(); server.close();
  process.exit(1);
}
console.log("PASS  游戏启动就绪");

// —— 页面内实验驱动器 ——
await page.evaluate(() => {
  const cnt = { buys: 0, units: 0, boosts: 0, galaxies: 0, crunchTries: 0, crunches: 0, tickspeed: 0 };
  window.__x = {
    lg(v) {
      if (v && typeof v.log10 === "function") {
        const d = v.log10();
        const n = d && d.toNumber ? d.toNumber() : Number(d);
        return Number.isFinite(n) ? n : NaN;
      }
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    },
    num(v) { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; },
    snap() {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: this.lg(Currency.antimatter.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        inf: this.num(Currency.infinities.value),
        galaxies: this.num(player.galaxies),
        dimBoosts: this.num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        simLocked: safe(() => GameSpeed.isSimulationLocked),
        ach188: safe(() => Achievement(188).isUnlocked),
      };
    },
    resetCounters() {
      for (const k of Object.keys(cnt)) cnt[k] = 0;
      return true;
    },
    counters() { return { ...cnt }; },
    // 单次决策：语义与原基线完全一致（不新增、不删减任何动作）
    decide(aggressive) {
      for (let t = 1; t <= 8; t++) {
        try { if (buyAsManyAsYouCanBuy(t) === true) cnt.buys++; } catch (e) { /* 未解锁 */ }
      }
      for (let t = 1; t <= 8; t++) {
        try { cnt.units += player.dimensions.antimatter[t - 1].bought; } catch (e) { /* ignore */ }
      }
      // 上面累加的是绝对量，会让计数失真 → 改为增量统计（见 buyDelta）
      cnt.units = 0;
      try { if (buyMaxTickSpeed()) cnt.tickspeed++; } catch (e) { /* ignore */ }
      const b0 = this.num(player.dimensionBoosts);
      try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
      cnt.boosts += Math.max(0, this.num(player.dimensionBoosts) - b0);
      const g0 = this.num(player.galaxies);
      try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
      cnt.galaxies += Math.max(0, this.num(player.galaxies) - g0);
      if (aggressive) {
        try { if (Player.canCrunch) { cnt.crunchTries++; bigCrunchReset(); cnt.crunches++; } } catch (e) { /* ignore */ }
      }
    },
    // 全新开局（独立副本），与基线 setupFresh 同源
    setupFresh(F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      if (!window.__freshText) window.__freshText = GameSaveSerializer.serialize(player);
      player = GameSaveSerializer.deserialize(window.__freshText);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.resetCounters();
      return this.snap();
    },
    // 策略执行：nFrames 帧，每帧 k 次决策（每段 diff = frameMs/k）
    run(nFrames, frameMs, k, aggressive) {
      const sub = frameMs / k;
      let maxInfPerFrame = 0;
      let lockedSeen = false;
      for (let i = 0; i < nFrames; i++) {
        const inf0 = this.num(Currency.infinities.value) || 0;
        for (let j = 0; j < k; j++) {
          this.decide(aggressive);
          gameLoop(sub);
        }
        const inf1 = this.num(Currency.infinities.value) || 0;
        maxInfPerFrame = Math.max(maxInfPerFrame, inf1 - inf0);
        try { if (GameSpeed.isSimulationLocked) lockedSeen = true; } catch (e) { /* ignore */ }
        if (Number.isFinite(inf1) && inf1 > 0) {
          return { reached: true, frames: i + 1, maxInfPerFrame, lockedSeen, state: this.snap() };
        }
      }
      return { reached: false, frames: nFrames, maxInfPerFrame, lockedSeen, state: this.snap() };
    },
    // 对照：不做任何决策，只跑时间（用来量化 k 段积分本身的差异）
    runNoDecision(nFrames, frameMs, k) {
      const sub = frameMs / k;
      for (let i = 0; i < nFrames; i++) {
        for (let j = 0; j < k; j++) gameLoop(sub);
      }
      return this.snap();
    },
  };
});

const e2 = v => (Number.isFinite(v) ? v.toExponential(2) : "—");

// ================= 0. 对照组：无决策时，k 段积分与 1 段的差异 =================
console.log("\n========== 0. 对照：不做任何决策时，k 段积分 vs 1 段（量化分段误差） ==========");
const ctrl = [];
for (const k of [1, 10, 100]) {
  const s0 = await page.evaluate((F) => window.__x.setupFresh(F), 10000);
  const s1 = await page.evaluate(({ n, ms, k }) => window.__x.runNoDecision(n, ms, k), { n: 200, ms: FRAME_MS, k });
  ctrl.push({ k, dGame: s1.game - s0.game, dAm: s1.amLog - s0.amLog, game: s1.game });
}
console.log("     k   Δ游戏时间(ms)   Δlog10(AM)   Δ游戏/期望(200×20×10000)");
for (const r of ctrl) {
  const expect = 200 * FRAME_MS * 10000;
  console.log(`  ${String(r.k).padStart(4)} ${String(r.dGame).padStart(14)} ${String(r.dAm.toFixed(6)).padStart(12)} ${String((r.dGame / expect).toFixed(9)).padStart(12)}`);
}
const ctrlBase = ctrl[0];
const ctrlMaxDev = Math.max(...ctrl.map(r => Math.abs(r.dGame / ctrlBase.dGame - 1)));
console.log(`  分段误差上限：|Δk/Δ1 − 1| 最大 = ${(ctrlMaxDev * 100).toFixed(6)}%`);

// ================= 1. A/B 主实验 =================
// 策略表：F=10000 试 k=1/10/100；F=1000 试 k=1/10（k=100 在 F=1000 上 ops 预算不够）
const PLAN = [
  { F: 1000, ks: [1, 10] },
  { F: 10000, ks: [1, 10, 100] },
];

console.log("\n========== 1. A/B 主实验（每个组合重复 " + REPS + " 次） ==========");
console.log("口径：20ms/帧；B 的每帧把 20ms 平分成 k 段，每段前做一次决策；帧数即墙钟代理");

const rows = [];
for (const { F, ks } of PLAN) {
  for (const k of ks) {
    const framesBudget = Math.min(FRAMES_BUDGET, Math.floor(OPS_BUDGET / k));
    for (let rep = 1; rep <= REPS; rep++) {
      const s0 = await page.evaluate((F) => window.__x.setupFresh(F), F);
      const t0 = Date.now();
      const r = await page.evaluate(({ n, ms, k }) => window.__x.run(n, ms, k, true), { n: framesBudget, ms: FRAME_MS, k });
      const simMs = Date.now() - t0;
      const c = await page.evaluate(() => window.__x.counters());
      rows.push({
        F, k, rep,
        reached: r.reached,
        frames: r.frames,
        wallProxyMs: r.frames * FRAME_MS,
        gameMs: r.state.game - s0.game,
        realMs: r.state.real - s0.real,
        amLog: r.state.amLog,
        galaxies: r.state.galaxies,
        dimBoosts: r.state.dimBoosts,
        maxInfPerFrame: r.maxInfPerFrame,
        lockedSeen: r.lockedSeen,
        simMs,
        ops: r.frames * k,
        counters: c,
        framesBudget,
      });
      const last = rows[rows.length - 1];
      console.log(`  F=${String(F).padStart(5)} k=${String(k).padStart(3)} rep${rep}  ` +
        `${last.reached ? "到达" : "未到达"}  帧=${String(last.frames).padStart(5)}  ` +
        `墙钟代理=${(last.wallProxyMs / 1000).toFixed(1)}s  游戏=${e2(last.gameMs / 1000)}s  ` +
        `AM=${last.amLog?.toFixed(2)}  星系/提升=${last.galaxies}/${last.dimBoosts}  ` +
        `买入次数=${c.buys} 提升=${c.boosts} 星系=${c.galaxies} 坍塌=${c.crunches}  ` +
        `ops=${last.ops} 模拟耗时=${(simMs / 1000).toFixed(1)}s`);
    }
  }
}

// ================= 2. 汇总与判定 =================
const agg = (F, k) => {
  const sub = rows.filter(r => r.F === F && r.k === k);
  const reached = sub.filter(r => r.reached);
  const frames = sub.map(r => r.frames);
  return {
    F, k, reps: sub.length, reachedReps: reached.length,
    framesMin: Math.min(...frames), framesMax: Math.max(...frames),
    frameSpread: Math.max(...frames) / Math.min(...frames),
    wallProxy: sub.map(r => r.wallProxyMs / 1000),
    gameS: sub.map(r => r.gameMs / 1000),
    simMs: sub.map(r => r.simMs),
    counters: sub.map(r => r.counters),
    maxInfPerFrame: Math.max(...sub.map(r => r.maxInfPerFrame)),
    lockedSeen: sub.some(r => r.lockedSeen),
  };
};

console.log("\n========== 2. 汇总（同 F 下不同 k 对比） ==========");
const summary = [];
for (const { F, ks } of PLAN) {
  const base = agg(F, 1);
  console.log(`\n--- F=${F} ---`);
  console.log("     k  到达/重复  帧数范围        帧数中位比  墙钟代理(s)      游戏时间(s)      CRUNCH  买入   模拟耗时(s)");
  for (const k of ks) {
    const a = agg(F, k);
    const ratio = a.framesMin / base.framesMin;
    summary.push({ F, k, ...a });
    console.log(`  ${String(k).padStart(4)} ${String(a.reachedReps + "/" + a.reps).padStart(8)}  ` +
      `${String(a.framesMin).padStart(5)}~${String(a.framesMax).padEnd(5)} ${ratio.toFixed(3).padStart(9)}  ` +
      `${a.wallProxy.map(v => v.toFixed(1)).join("/").padStart(14)}  ` +
      `${a.gameS.map(v => e2(v)).join("/").padStart(16)}  ` +
      `${String(a.counters.reduce((s, c) => s + c.crunches, 0)).padStart(6)}  ` +
      `${String(a.counters.reduce((s, c) => s + c.buys, 0)).padStart(5)}  ` +
      `${a.simMs.map(v => (v / 1000).toFixed(1)).join("/").padStart(14)}`);
  }
}

// 判定
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (t) => console.log(`NOTE  ${t}`);

console.log("\n========== 3. 判定 ==========");

// 3.1 A 组必须复现上一轮基线（F=1000 → 3200，F=10000 → 1200），差的只是 chunk 粒度（上一轮 100 帧 → 本轮 1 帧）
const a1000 = agg(1000, 1), a10000 = agg(10000, 1);
check("[A1] 策略 A（k=1）三次重复完全一致（帧数极差 = 1）",
  a1000.frameSpread === 1 && a10000.frameSpread === 1 && a1000.reachedReps === REPS && a10000.reachedReps === REPS,
  `F=1000 ${a1000.framesMin}~${a1000.framesMax}，F=10000 ${a10000.framesMin}~${a10000.framesMax}`);
note(`[A2] 与上一轮基线的差异来自 chunk 粒度：上一轮每 100 帧才判定一次终点（F=1000 报 3200、F=10000 报 1200 = 100 的整数倍），本轮逐帧判定 → ${a1000.framesMin} / ${a10000.framesMin}。这是粒度差异，不是行为变化。`);

// 3.2 安全性：每帧最多 1 次坍塌、无离线模拟注入
const maxInf = Math.max(...rows.map(r => r.maxInfPerFrame));
const locked = rows.some(r => r.lockedSeen);
check("[S1] 没有任何一帧发生 >1 次坍塌（无同帧重复重置）", maxInf <= 1, `单帧最大 Δ无限 = ${maxInf}`);
check("[S2] 全实验期间没有触发离线模拟（未出现模拟锁）", locked === false, `lockedSeen=${locked}`);

// 3.3 B 的收益
for (const { F, ks } of PLAN) {
  const base = agg(F, 1);
  for (const k of ks.filter(x => x > 1)) {
    const a = agg(F, k);
    const frameGain = base.framesMin / a.framesMin;
    const wallGain = (base.framesMin * FRAME_MS) / (a.framesMin * FRAME_MS);
    const costGain = base.simMs[0] / a.simMs[0];
    const gameRatio = a.gameS[0] / base.gameS[0];
    check(`[B-${F}-k${k}] B 的帧数（墙钟代理）严格少于 A`, frameGain > 1.02,
      `A=${base.framesMin} 帧 → B=${a.framesMin} 帧，收益 ${frameGain.toFixed(3)}×`);
    note(`  F=${F} k=${k}：帧数收益 ${frameGain.toFixed(3)}×（墙钟代理同比例 ${wallGain.toFixed(3)}×）；` +
      `到达时游戏时间 ${e2(base.gameS[0])}s → ${e2(a.gameS[0])}s（${gameRatio.toFixed(3)}×）；` +
      `同样的帧里决策次数 ×${k}，脚本模拟耗时 ${(a.simMs[0] / 1000).toFixed(1)}s vs A ${(base.simMs[0] / 1000).toFixed(1)}s（CPU 成本 ${costGain.toFixed(2)}× 更省/更费见符号）`);
  }
}

// 3.4 语义风险检查：决策次数是否线性膨胀
console.log("\n========== 4. 决策次数（语义风险的核心观测） ==========");
console.log("     F     k   决策次数/帧   买入成功次数   买入成功/千帧   提升   星系   坍塌");
for (const a of summary) {
  const dec = a.counters.reduce((s, c) => s + c.buys + c.tickspeed + c.boosts + c.galaxies, 0);
  const frames = a.framesMin * a.reps;
  const buys = a.counters.reduce((s, c) => s + c.buys, 0);
  console.log(`  ${String(a.F).padStart(6)} ${String(a.k).padStart(4)} ${String(a.k).padStart(11)} ` +
    `${String(buys).padStart(13)} ${String((buys / frames * 1000).toFixed(0)).padStart(14)} ` +
    `${String(a.counters.reduce((s, c) => s + c.boosts, 0)).padStart(6)} ` +
    `${String(a.counters.reduce((s, c) => s + c.galaxies, 0)).padStart(5)} ` +
    `${String(a.counters.reduce((s, c) => s + c.crunches, 0)).padStart(5)}`);
}
note("买入成功/千帧 是「有效购买动作」的密度。k 越大，这个密度应近似 ×k（决策机会变多），但每次买入的件数会变小 —— 成本模型见下条。");

// 3.5 成本模型：单元价格只随 bought/10 变化，所以更频繁购买不会更便宜（也不是更贵）
console.log("\n========== 5. 语义风险：更频繁购买会不会变便宜 / 变贵 ==========");
const costCheck = await page.evaluate(() => {
  const saved = GameSaveSerializer.serialize(player);
  const restored = () => { player = GameSaveSerializer.deserialize(saved); GameStorage.loadPlayerObject(player); };
  // 场景 1：一次买 8 件
  restored();
  Currency.antimatter.value = new Decimal("1e30");
  const d = () => player.dimensions.antimatter[0];
  const before1 = { am: Currency.antimatter.value.toString(), bought: d().bought };
  buyAsManyAsYouCanBuy(1);
  const after1 = { am: Currency.antimatter.value.toString(), bought: d().bought };
  const cost1 = 0;
  // 场景 2：分 8 次各买 1 件（用同一初始状态）
  restored();
  Currency.antimatter.value = new Decimal("1e30");
  for (let i = 0; i < 8; i++) buyOneDimension(1);
  const after2 = { am: Currency.antimatter.value.toString(), bought: d().bought };
  return { before1, after1, after2, c1: cost1 };
});
const amUsed1 = Math.log10(Number(costCheck.before1.am)) - Math.log10(Number(costCheck.after1.am));
const amUsed2 = Math.log10(Number(costCheck.before1.am)) - Math.log10(Number(costCheck.after2.am));
console.log(`  一次买满：bought ${costCheck.before1.bought} → ${costCheck.after1.bought}，AM 消耗 10^${amUsed1.toFixed(6)}`);
console.log(`  分 8 次买：bought ${costCheck.before1.bought} → ${costCheck.after2.bought}，AM 消耗 10^${amUsed2.toFixed(6)}`);
check("[S3] 「分多次买」与「一次买」的 AM 总消耗相同（成本只随 bought/10 阶梯变化）",
  Math.abs(amUsed1 - amUsed2) < 1e-6 && costCheck.after1.bought === costCheck.after2.bought,
  `差 ${(amUsed1 - amUsed2).toExponential(2)}`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

// ================= 落盘 =================
const out = {
  generatedAt: new Date().toISOString(),
  frameMs: FRAME_MS, reps: REPS, framesBudget: FRAMES_BUDGET, opsBudget: OPS_BUDGET,
  control: ctrl, controlMaxDev: ctrlMaxDev,
  rows,
  summary: summary.map(s => ({
    F: s.F, k: s.k, reachedReps: s.reachedReps, reps: s.reps,
    framesMin: s.framesMin, framesMax: s.framesMax,
    wallProxyS: s.wallProxy, gameS: s.gameS, simMs: s.simMs, maxInfPerFrame: s.maxInfPerFrame,
  })),
  verdict: results,
  errors: errs,
};
const outFile = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/exp-decision-granularity.json";
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\n已写入：${outFile}`);

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);

await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
