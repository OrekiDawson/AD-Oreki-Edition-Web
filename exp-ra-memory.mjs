// Ra 宠物记忆增速：F=1 vs F=10000 运行时对照（Web 版）
//
// 目的：给 Android 同类测试（Teresa/V 记忆增量比 ≈1.0008 / 1.0007）做跨端对照。
//
// 口径：
//   * 现实时间窗口 = 帧数 × 20ms（固定帧长，等价稳定 50fps）；30s 窗口 = 1500 帧
//   * 同一存档、同一状态（Ra.run=true、黑洞暂停、无名氏未在储存现实时间），每个条件重复 REPS 次
//   * 不做任何购买/晋升决策（纯时间推进），排除自动化与购买策略干扰
//   * 记录：Teresa / V 的记忆与记忆块前后值、增量、真实字段增量 vs 逐帧公式累加、memoryTick 入参
//
// 用法：node exp-ra-memory.mjs [--reps=3] [--window=30]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_FILE = "1000._9.73e14iM+Cel6+1.84e45SG.txt";   // Ra 已解锁、Teresa/V 满级且有记忆进度
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };

const argNum = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  const v = hit ? Number(hit.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : d;
};
const REPS = argNum("reps", 3);
const WINDOW_S = argNum("window", 30);
const FRAME_MS = 20;
const FRAMES = Math.round(WINDOW_S * 1000 / FRAME_MS);

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
await new Promise(r => server.listen(8430, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 180000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });

await page.goto("http://127.0.0.1:8430/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => {
    try {
      return typeof gameLoop === "function" && typeof Ra === "object" && typeof buyAsManyAsYouCanBuy === "function";
    } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) {
  console.log("FAIL  游戏未启动");
  await browser.close(); server.close();
  process.exit(1);
}
console.log("PASS  游戏启动就绪");

await page.evaluate(() => {
  const PETS = ["teresa", "v"];
  const ctrl = { calls: 0, argSum: 0, generateChunksTrue: 0, perPet: {} };
  const petOf = key => Ra.pets.all.find(p => p.key === key);

  window.__ra = {
    num(v) { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : NaN; },
    resetCtrl() {
      ctrl.calls = 0; ctrl.argSum = 0; ctrl.generateChunksTrue = 0;
      for (const k of PETS) {
        ctrl.perPet[k] = { calls: 0, argSum: 0, memSum: 0, chunkSum: 0, secondsSum: 0, firstArg: null, lastArg: null };
      }
    },
    ctrl() { return JSON.parse(JSON.stringify(ctrl)); },
    // 同一存档、同一状态；只改 F
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      // —— 固定条件（两侧完全一致）——
      player.celestials.ra.run = true;                 // Ra 处于运行状态 → 允许产生记忆块
      player.blackHolePause = true;                    // 冻结黑洞，speedup 稳定，排除相位抖动
      player.celestials.enslaved.isStoringReal = false; // 允许 generateChunks
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.installHooks();
      this.resetCtrl();
      return this.snap();
    },
    installHooks() {
      for (const k of PETS) {
        const pet = petOf(k);
        if (!pet || pet.__wrapped) continue;
        const orig = pet.tick.bind(pet);
        pet.__origTick = orig;
        pet.tick = (realDiff, generateChunks) => {
          const before = { m: pet.memories, c: pet.memoryChunks };
          const p = ctrl.perPet[k];
          p.calls++;
          p.argSum += realDiff;
          if (p.firstArg === null) p.firstArg = realDiff;
          p.lastArg = realDiff;
          p.secondsSum += realDiff / 1000;
          const ret = orig(realDiff, generateChunks);
          p.memSum += pet.memories - before.m;
          p.chunkSum += pet.memoryChunks - before.c;
          ctrl.calls++;
          ctrl.argSum += realDiff;
          if (generateChunks) ctrl.generateChunksTrue++;
          return ret;
        };
        pet.__wrapped = true;
      }
    },
    snap() {
      const out = { F: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return NaN; } })() };
      for (const k of PETS) {
        const pet = petOf(k);
        out[k] = pet ? {
          level: pet.level,
          memories: this.num(pet.memories),
          chunks: this.num(pet.memoryChunks),
          chunkPS: (() => { try { return this.num(pet.memoryChunksPerSecond); } catch (e) { return NaN; } })(),
          memMult: (() => { try { return this.num(pet.memoryUpgradeCurrentMult); } catch (e) { return NaN; } })(),
          hasRemembrance: !!pet.hasRemembrance,
        } : null;
      }
      out.momentumTime = (() => { try { return this.num(player.celestials.ra.momentumTime); } catch (e) { return NaN; } })();
      out.productionPerChunk = (() => { try { return this.num(Ra.productionPerMemoryChunk); } catch (e) { return NaN; } })();
      out.raRunning = (() => { try { return !!Ra.isRunning; } catch (e) { return null; } })();
      out.raUnlocked = (() => { try { return !!Ra.isUnlocked; } catch (e) { return null; } })();
      out.enslavedStoringReal = (() => { try { return !!Enslaved.isStoringRealTime; } catch (e) { return null; } })();
      out.bhPaused = (() => { try { return !!BlackHoles.arePaused; } catch (e) { return null; } })();
      out.bhActive = (() => { try { return BlackHoles.list.map(h => !!h.isActive); } catch (e) { return null; } })();
      out.speedup = (() => { try { return this.num(getGameSpeedupFactor()); } catch (e) { return NaN; } })();
      return out;
    },
    // 纯时间推进：不做任何决策，固定帧长
    run(frames, frameMs) {
      for (let i = 0; i < frames; i++) gameLoop(frameMs);
      return this.snap();
    },
  };
});

const e = (v, d = 6) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");
console.log(`存档：${SAVE_FILE}`);
console.log(`窗口：${WINDOW_S}s 现实时间 = ${FRAMES} 帧 × ${FRAME_MS}ms（固定帧长，不做任何购买决策）`);
console.log(`每个条件重复 ${REPS} 次\n`);

const rows = [];
for (const F of [1, 10000]) {
  for (let rep = 1; rep <= REPS; rep++) {
    const s0 = await page.evaluate(({ text, F }) => window.__ra.setup(text, F), { text: saveText, F });
    const t0 = Date.now();
    const s1 = await page.evaluate(({ n, ms }) => window.__ra.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const realMs = Date.now() - t0;
    const c = await page.evaluate(() => window.__ra.ctrl());
    const row = {
      F, rep, realMs,
      teresa: { dMem: s1.teresa.memories - s0.teresa.memories, dChunk: s1.teresa.chunks - s0.teresa.chunks, before: s0.teresa, after: s1.teresa },
      v: { dMem: s1.v.memories - s0.v.memories, dChunk: s1.v.chunks - s0.v.chunks, before: s0.v, after: s1.v },
      dMomentum: s1.momentumTime - s0.momentumTime,
      ctrl: c,
      state: { s0: { raRunning: s0.raRunning, bhPaused: s0.bhPaused, bhActive: s0.bhActive, enslaved: s0.enslavedStoringReal, speedup: s0.speedup, prod: s0.productionPerChunk },
               s1: { raRunning: s1.raRunning, bhPaused: s1.bhPaused, enslaved: s1.enslavedStoringReal, speedup: s1.speedup, prod: s1.productionPerChunk } },
    };
    rows.push(row);
    console.log(`  F=${String(F).padStart(5)} rep${rep}  Teresa Δmem=${e(row.teresa.dMem)} (+${e(row.teresa.dMem / row.teresa.before.memories, 3)} 相对)  ` +
      `Δchunk=${e(row.teresa.dChunk)} | V Δmem=${e(row.v.dMem)} (+${e(row.v.dMem / row.v.before.memories, 3)} 相对)  Δchunk=${e(row.v.dChunk)} | ` +
      `Δmomentum=${e(row.dMomentum)} | tick 调用=${c.calls} 入参和=${e(c.argSum)} | 墙钟=${(realMs / 1000).toFixed(2)}s`);
  }
}

// —— 汇总：比值 ——
const agg = (F, key) => {
  const sub = rows.filter(r => r.F === F);
  return {
    dMem: sub.map(r => r[key].dMem),
    dChunk: sub.map(r => r[key].dChunk),
    argSum: sub.map(r => r.ctrl.argSum),
    calls: sub.map(r => r.ctrl.calls),
  };
};
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = t => console.log(`NOTE  ${t}`);

console.log("\n========== 汇总 ==========");
console.log("     指标        F=1 增量(3 次)                     F=10000 增量(3 次)                  比值(每次)");
const summary = {};
for (const [label, key] of [["Teresa 记忆", "teresa"], ["V 记忆", "v"]]) {
  const a = agg(1, key), b = agg(10000, key);
  summary[key] = { avg1: a.dMem.reduce((x, y) => x + y, 0) / a.dMem.length,
    avg2: b.dMem.reduce((x, y) => x + y, 0) / b.dMem.length, ratios: a.dMem.map((x, i) => b.dMem[i] / x) };
  console.log(`  ${label.padEnd(10)} ${a.dMem.map(v => e(v, 3)).join(" / ")}`.padEnd(58) +
    `${b.dMem.map(v => e(v, 3)).join(" / ")}`.padEnd(36) +
    summary[key].ratios.map(v => v.toFixed(2)).join(" / "));
}
const rT = summary.teresa.ratios, rV = summary.v.ratios;

console.log("\n========== 判定 ==========");

// 1) 状态固定检查
const st = rows[0].state.s0;
check("[S1] 两个 F 的初始状态一致（Ra 运行 / 黑洞暂停 / 无名氏未储存 / 同一存档）",
  rows.every(r => r.state.s0.raRunning === true && r.state.s0.bhPaused === true && r.state.s0.enslaved === false),
  `Ra.run=${st.raRunning} BH暂停=${st.bhPaused} ENSLAVED储存=${st.enslaved} prod/chunk=${e(st.prod, 3)}`);
check("[S2] 全程 Ra 一直处于运行状态（记忆块允许产生）",
  rows.every(r => r.state.s1.raRunning === true && r.state.s1.enslaved === false),
  "s1 全部 run=true / 未储存");

// 2) F=1 必须有非零增量
const nzT = summary.teresa.avg1 > 0, nzV = summary.v.avg1 > 0;
check("[S3] F=1 下 Teresa / V 的记忆都有非零增量（先证明可测，再谈比值）",
  nzT && nzV, `Teresa Δ=${e(summary.teresa.avg1)}，V Δ=${e(summary.v.avg1)}`);

// 3) 浮点精度：增量相对量级必须远大于 double 分辨率（2^-52 ≈ 2.2e-16）
const relT = summary.teresa.avg1 / rows.find(r => r.F === 1).teresa.before.memories;
const relV = summary.v.avg1 / rows.find(r => r.F === 1).v.before.memories;
check("[S4] 增量相对量级远大于 double 分辨率（>1e-9），排除浮点精度把增量吃掉",
  relT > 1e-9 && relV > 1e-9, `Teresa Δ/mem=${e(relT, 3)}，V Δ/mem=${e(relV, 3)}`);

// 4) 重复一致性
const spread = arr => {
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return mx / mn - 1;
};
check("[S5] 同一 F 下 3 次重复的增量一致（离散度 <0.1%）",
  spread(summary.teresa.ratios.map((_, i) => rows.filter(r => r.F === 1)[i].teresa.dMem)) < 1e-3 &&
  spread(rows.filter(r => r.F === 10000).map(r => r.teresa.dMem)) < 1e-3,
  `Teresa F=1 离散 ${(spread(rows.filter(r => r.F === 1).map(r => r.teresa.dMem)) * 100).toFixed(4)}%`);

// 5) 字段增量 vs 公式累加（区分"源码公式"与"最终字段"）
const t1 = rows.find(r => r.F === 1);
const teresaFormula = rows.map(r => r.ctrl.perPet.teresa.memSum);
check("[S6] 字段增量 == 逐帧公式累加的 Δmemories（同一口径，非两次独立测量）",
  rows.every((r, i) => Math.abs(r.teresa.dMem / teresaFormula[i] - 1) < 1e-9),
  `样例 F=1: 字段 ${e(t1.teresa.dMem)} vs 逐帧累加 ${e(t1.ctrl.perPet.teresa.memSum)}`);

// 6) memoryTick 入参：验证 sqrt(F) 路径
const arg1 = agg(1, "teresa").argSum[0], arg2 = agg(10000, "teresa").argSum[0];
const call1 = agg(1, "teresa").calls[0], call2 = agg(10000, "teresa").calls[0];
const argPerCall1 = arg1 / call1, argPerCall2 = arg2 / call2;
const sqrtF = Math.sqrt(10000);
console.log(`  memoryTick 入参：F=1 每次调用 ${argPerCall1.toFixed(3)}ms；F=10000 每次 ${argPerCall2.toFixed(3)}ms；比值 ${(argPerCall2 / argPerCall1).toFixed(3)}（sqrt(F)=${sqrtF}）`);
check("[S7] memoryTick 的入参比值 == sqrt(F)（证明走的是 realDiff/√F 路径，而不是纯墙钟或整 F）",
  Math.abs(argPerCall2 / argPerCall1 / sqrtF - 1) < 0.02,
  `实测 ${(argPerCall2 / argPerCall1).toFixed(2)}×，理论 ${sqrtF}×`);

// 7) 记忆增量比值
console.log(`\n  Teresa 记忆增量比（F=10000 / F=1）：${rT.map(v => v.toFixed(2)).join(" / ")}（均值 ${(rT.reduce((a, b) => a + b, 0) / rT.length).toFixed(2)}）`);
console.log(`  V      记忆增量比（F=10000 / F=1）：${rV.map(v => v.toFixed(2)).join(" / ")}（均值 ${(rV.reduce((a, b) => a + b, 0) / rV.length).toFixed(2)}）`);
const meanT = rT.reduce((a, b) => a + b, 0) / rT.length;
const meanV = rV.reduce((a, b) => a + b, 0) / rV.length;
check("[S8] Web 的记忆增量随 F 显著放大（远大于 1）",
  meanT > 10 && meanV > 10, `Teresa ${meanT.toFixed(2)}×，V ${meanV.toFixed(2)}×`);
note(`[对照] Android 同条件实测比值为 Teresa≈1.0008、V≈1.0007（基本不受 F 影响）；` +
  `Web 本机实测 Teresa≈${meanT.toFixed(1)}×、V≈${meanV.toFixed(1)}×（≈√F=${sqrtF}）。`);

// 8) momentumTime 也记录（不当作主要证据，但它是另一条被 F 放大的路径）
const mom1 = rows.find(r => r.F === 1).dMomentum, mom2 = rows.find(r => r.F === 10000).dMomentum;
console.log(`  momentumTime 增量：F=1 ${e(mom1)} ms；F=10000 ${e(mom2)} ms；比值 ${(mom2 / mom1).toFixed(2)}`);
note(`momentumTime 比值 ≈F（${(mom2 / mom1).toFixed(0)}×）说明它走的是 realDiff 整倍放大；` +
  `该字段量级 ${e(mom1)} ms 远大于窗口增量，本报告只作旁证，不作为记忆成长的主证据。`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const out = {
  generatedAt: new Date().toISOString(),
  save: SAVE_FILE, windowS: WINDOW_S, frames: FRAMES, frameMs: FRAME_MS, reps: REPS,
  rows, summary: {
    teresa: { avg1: summary.teresa.avg1, avg2: summary.teresa.avg2, ratios: rT },
    v: { avg1: summary.v.avg1, avg2: summary.v.avg2, ratios: rV },
    argPerCall1, argPerCall2, sqrtF,
  },
  verdict: results, errors: errs,
};
fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-ra-memory.json", JSON.stringify(out, null, 2));
console.log("\n已写入 _research/exp-ra-memory.json");

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
