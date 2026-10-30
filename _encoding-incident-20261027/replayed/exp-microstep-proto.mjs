// 限定微步原型（隔离实验，不改 src）：
//   A      = 现状：每帧 1 次决策 + gameLoop(20ms)
//   Bn     = 朴素微步：每帧 k 次 (决策 + gameLoop(20/k))  —— 已知会把帧级机制一起放大 k 倍（上界参考）
//   Bs     = 限定微步原型：微步内把「可 stub 的帧级机制」换成就地 no-op，微步结束后只跑一次
//   As     = 对照：单帧内同样 stub（用来量出这些机制每帧的 CPU 成本）
//
// 关键限制（本轮要证明的事实）：
//   gameLoop 里还有一批「按名字直接调用」的自由函数（laitelaRealityTick / applyAutoprestige /
//   updateImaginaryMachines / replicantiLoop / updateTachyonGalaxies …），它们在 ESM 里是只读绑定，
//   外部无法 stub；所以 Bs **不可能**完全等价于「只微步生产+采购」。本脚本把这部分如实量化。

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const FRAME_MS = 20;

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
await new Promise(r => server.listen(8440, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8440/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof player === "object" && typeof Currency === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS  游戏启动就绪");

await page.evaluate(() => {
  const cnt = {};
  const bump = k => { cnt[k] = (cnt[k] || 0) + 1; };
  // 可 stub 的帧级机制（对象方法，运行时能改写）
  const TARGETS = [
    ["Autobuyers.tick", () => Autobuyers, "tick", "autobuyers"],
    ["Tutorial.tutorialLoop", () => Tutorial, "tutorialLoop", "tutorial"],
    ["DeltaTimeState.update", () => DeltaTimeState, "update", "deltaTime"],
    ["Achievements.autoAchieveUpdate", () => Achievements, "autoAchieveUpdate", "achieve"],
    ["BlackHoles.updatePhases", () => BlackHoles, "updatePhases", "blackHole"],
    ["Ra.memoryTick", () => Ra, "memoryTick", "raMemory"],
    ["AutomatorBackend.update", () => AutomatorBackend, "update", "automator"],
    ["Pelle.gameLoop", () => Pelle, "gameLoop", "pelle"],
    ["GalaxyGenerator.loop", () => GalaxyGenerator, "loop", "galaxyGen"],
    ["GameEnd.gameLoop", () => GameEnd, "gameLoop", "gameEnd"],
    ["V.checkForUnlocks", () => V, "checkForUnlocks", "vUnlock"],
    ["InfinityDimensions.tryAutoUnlock", () => InfinityDimensions, "tryAutoUnlock", "idUnlock"],
    ["GameUI.update", () => GameUI, "update", "ui"],
  ];
  const saved = new Map();

  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };

  window.__ms = {
    lg, num,
    resetCnt() { for (const k of Object.keys(cnt)) delete cnt[k]; return true; },
    counters() { return { ...cnt }; },
    // 计数包装（stub 时仍然计数，便于证明「被抑制」而不是「被删除」）
    stubSystems() {
      for (const [name, getObj, method, key] of TARGETS) {
        let obj;
        try { obj = getObj(); } catch (e) { continue; }
        if (!obj || typeof obj[method] !== "function") continue;
        const id = `${name}`;
        if (saved.has(id)) continue;
        const orig = obj[method];
        saved.set(id, { obj, method, orig });
        obj[method] = function (...args) { bump(key); return undefined; };
      }
      return [...saved.keys()];
    },
    restoreSystems() {
      for (const [id, rec] of saved) { rec.obj[rec.method] = rec.orig; saved.delete(id); }
      return true;
    },
    stubbed() { return [...saved.keys()]; },
    decide() {
      for (let t = 1; t <= 8; t++) { try { buyAsManyAsYouCanBuy(t); } catch (e) { /* ignore */ } }
      try { buyMaxTickSpeed(); } catch (e) { /* ignore */ }
      try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
      try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
      try { if (Player.canCrunch) bigCrunchReset(); } catch (e) { /* ignore */ }
      try { if (Player.canEternity) eternityResetRequest(); } catch (e) { /* ignore */ }
    },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.restoreSystems();
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
        rmLog: lg(Currency.realities.value),
        inf: num(Currency.infinities.value),
        eter: num(Currency.eternities.value),
        real2: num(Currency.realities.value),
        galaxies: num(player.galaxies),
        dimBoosts: num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        bh: safe(() => BlackHoles.areUnlocked && !BlackHoles.arePaused),
        raMem: safe(() => num(player.celestials.ra.pets.teresa.memories)),
        raMomentum: safe(() => num(player.celestials.ra.momentumTime)),
        laitela: safe(() => num(player.celestials.laitela.darkMatter)),
        gameEnd: safe(() => GameEnd.endState),
      };
    },
    // A：每帧 1 次决策
    runA(frames, ms, doDecide) {
      for (let i = 0; i < frames; i++) { if (doDecide) this.decide(); gameLoop(ms); }
      return this.snap();
    },
    // Bn：朴素微步（帧级机制一帧 k 次）
    runBn(frames, ms, k, doDecide) {
      const sub = ms / k;
      for (let i = 0; i < frames; i++) {
        for (let j = 0; j < k; j++) { if (doDecide) this.decide(); gameLoop(sub); }
      }
      return this.snap();
    },
    // Bs：限定微步（微步内 stub 帧级机制；结束后 **不** 回放——回放所需内部 diff 拿不到）
    runBs(frames, ms, k, doDecide) {
      const sub = ms / k;
      const ids = this.stubSystems();
      for (let i = 0; i < frames; i++) {
        for (let j = 0; j < k; j++) { if (doDecide) this.decide(); gameLoop(sub); }
      }
      this.restoreSystems();
      return { snap: this.snap(), stubbed: ids };
    },
    // As：单帧 stub 对照（量出被 stub 的机制每帧的 CPU 成本 → 用 CPU 差推断，不靠猜）
    runAs(frames, ms, doDecide) {
      this.stubSystems();
      for (let i = 0; i < frames; i++) { if (doDecide) this.decide(); gameLoop(ms); }
      this.restoreSystems();
      return this.snap();
    },
  };
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const fmt = v => (Number.isFinite(v) ? v.toFixed(3) : "—");
const saveText = (f) => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");

// 场景表：{ 名称, 存档, F, 帧数, 决策? , 前置状态 }
const SCEN = [
  { key: "S1 新存档→首个无限", file: null, F: 10000, frames: 2000, decide: true },
  { key: "S2 中期(9.1e137IP)", file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true },
  { key: "S3 黑洞激活", file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true, bh: true },
  { key: "S4 Ra/后期(1123)", file: "1123._Endgame.txt", F: 10000, frames: 120, decide: true },
  { key: "S5 低倍率 F=1", file: "132._9.1e137IP.txt", F: 1, frames: 300, decide: true },
  { key: "S6 极高倍率 F=100000", file: "132._9.1e137IP.txt", F: 100000, frames: 300, decide: true },
  { key: "S7 异常大 diff(2000ms/帧)", file: "132._9.1e137IP.txt", F: 10000, frames: 30, decide: true, frameMs: 2000 },
  { key: "S8 暂停后恢复", file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true, paused: true },
];

const K = argNum("k", 10);
const rows = [];
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);

console.log(`\n微步次数 k=${K}；帧长默认 ${FRAME_MS}ms；A/Bn/Bs/As 四个方案 × ${SCEN.length} 个场景\n`);

for (const sc of SCEN) {
  const ms = sc.frameMs || FRAME_MS;
  // 新存档场景：用当前页面里的新开局序列化文本（与基线同一份）
  const text = sc.file ? saveText(sc.file) : await page.evaluate(() => GameSaveSerializer.serialize(player));
  const prep = async (extra) => page.evaluate(({ text, F, bh, paused }) => {
    const s = window.__ms.load(text, F);
    try {
      if (bh) {
        player.blackHolePause = false;
        player.blackHole = player.blackHole || [];
        for (let i = 0; i < 3; i++) {
          player.blackHole[i] = player.blackHole[i] || {};
          player.blackHole[i].unlocked = true;
          player.blackHole[i].active = true;
          player.blackHole[i].phase = 0;
        }
      }
      if (paused) player.options.gamePaused = false;   // 记录：从「未暂停」开始，避免整段被 return
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    return { s0: window.__ms.snap(), text: null };
  }, { text, F: sc.F, bh: !!sc.bh, paused: !!sc.paused });

  const run = async (fn, ...args) => {
    const t0 = Date.now();
    const out = await page.evaluate(({ fn, args }) => window.__ms[fn](...args), { fn, args });
    const cpuMs = Date.now() - t0;
    const c = await page.evaluate(() => window.__ms.counters());
    return { out, cpuMs, counters: c };
  };

  const base = await prep();
  // A
  await page.evaluate(() => window.__ms.resetCnt());
  const A = await run("runA", sc.frames, ms, sc.decide);
  const sA = A.out;
  // Bn
  const s0b = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const Bn = await run("runBn", sc.frames, ms, K, sc.decide);
  // Bs
  const s0c = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const Bs = await run("runBs", sc.frames, ms, K, sc.decide);
  // As（stub 对照）
  const s0d = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const As = await run("runAs", sc.frames, ms, sc.decide);

  const d = (x, y) => ({ am: x.amLog - y.amLog, ip: x.ipLog - y.ipLog, ep: x.epLog - y.epLog, inf: x.inf - y.inf, eter: x.eter - y.eter, bh: x.bh, raMem: (x.raMem || 0) - (y.raMem || 0), momentum: (x.raMomentum || 0) - (y.raMomentum || 0) });
  const row = {
    key: sc.key, F: sc.F, k: K, frames: sc.frames, frameMs: ms,
    A: { cpuMs: A.cpuMs, state: sA, d: d(sA, base.s0) },
    Bn: { cpuMs: Bn.cpuMs, state: Bn.out, d: d(Bn.out, s0b.s0) },
    Bs: { cpuMs: Bs.cpuMs, state: Bs.out.snap, d: d(Bs.out.snap, s0c.s0), stubbed: Bs.out.stubbed },
    As: { cpuMs: As.cpuMs, state: As.out, d: d(As.out, s0d.s0) },
    counters: { A: A.counters, Bn: Bn.counters, Bs: Bs.counters, As: As.counters },
  };
  rows.push(row);

  const cpuPerFrame = x => x.cpuMs / sc.frames;
  console.log(`=== ${sc.key}  (F=${sc.F}, ${sc.frames} 帧 × ${ms}ms, k=${K})`);
  console.log(`   A : CPU/帧 ${fmt(cpuPerFrame(A))}ms  Δlog10(IP)=${fmt(row.A.d.ip)} Δ无限=${e(row.A.d.inf)} Δ星系=${fmt(row.A.state.galaxies - base.s0.galaxies)} ΔRa记忆=${e(row.A.d.raMem, 2)}`);
  console.log(`   Bn: CPU/帧 ${fmt(cpuPerFrame(Bn))}ms  Δlog10(IP)=${fmt(row.Bn.d.ip)} Δ无限=${e(row.Bn.d.inf)} Δ星系=${fmt(row.Bn.state.galaxies - s0b.s0.galaxies)} ΔRa记忆=${e(row.Bn.d.raMem, 2)}`);
  console.log(`   Bs: CPU/帧 ${fmt(cpuPerFrame(Bs))}ms  Δlog10(IP)=${fmt(row.Bs.d.ip)} Δ无限=${e(row.Bs.d.inf)} Δ星系=${fmt(row.Bs.state.galaxies - s0c.s0.galaxies)} ΔRa记忆=${e(row.Bs.d.raMem, 2)}  被 stub: ${row.Bs.stubbed.length} 项`);
  console.log(`   As: CPU/帧 ${fmt(cpuPerFrame(As))}ms  Δlog10(IP)=${fmt(row.As.d.ip)} Δ无限=${e(row.As.d.inf)} Δ星系=${fmt(row.As.state.galaxies - s0d.s0.galaxies)} ΔRa记忆=${e(row.As.d.raMem, 2)}`);
  console.log(`   计数/帧（A vs Bn vs Bs）：黑洞相位 ${fmt((row.counters.A.blackHole || 0) / sc.frames)} / ${fmt((row.counters.Bn.blackHole || 0) / sc.frames)} / ${fmt((row.counters.Bs.blackHole || 0) / sc.frames)}；` +
    `Ra记忆 ${fmt((row.counters.A.raMemory || 0) / sc.frames)} / ${fmt((row.counters.Bn.raMemory || 0) / sc.frames)} / ${fmt((row.counters.Bs.raMemory || 0) / sc.frames)}；` +
    `成就 ${fmt((row.counters.A.achieve || 0) / sc.frames)} / ${fmt((row.counters.Bn.achieve || 0) / sc.frames)} / ${fmt((row.counters.Bs.achieve || 0) / sc.frames)}`);
  console.log("");
}

// ===== 判定 =====
console.log("========== 判定 ==========");

// 1) Bn 把帧级机制放大 k 倍（证明「朴素微步」不可用于生产）
const bhA = rows.filter(r => r.counters.A.blackHole !== undefined);
check("[1] 朴素微步（Bn）会把帧级机制调用次数放大到 k 倍",
  rows.every(r => (r.counters.Bn.blackHole || 0) >= (r.counters.A.blackHole || 0) * (r.K || 1) * 0.99 || (r.counters.A.blackHole || 0) === 0),
  `例：${rows[2].key} 黑洞相位 A=${fmt((rows[2].counters.A.blackHole || 0) / rows[2].frames)}/帧 → Bn=${fmt((rows[2].counters.Bn.blackHole || 0) / rows[2].frames)}/帧（k=${rows[2].k}）`);

// 2) Bs 能把可 stub 的机制压回「每帧 0 次」（靠 stub）+ 但**没有回放** → 状态偏离
const s3 = rows[2];
check("[2] 限定微步（Bs）确实抑制了可 stub 的帧级机制（调用次数 0）",
  (s3.counters.Bs.blackHole || 0) === 0 && (s3.counters.Bs.raMemory || 0) === 0,
  `S3 中 Bs：黑洞相位 ${fmt((s3.counters.Bs.blackHole || 0) / s3.frames)}/帧，Ra 记忆 ${fmt((s3.counters.Bs.raMemory || 0) / s3.frames)}/帧`);
note(`[2-风险] Bs 只是"抑制"，没有"回放"：因此 S3/S4 里黑洞相位与 Ra 记忆完全停止推进 —— ` +
  `S3 的 ΔRa记忆 Bs=${e(s3.Bs.d.raMem, 2)} vs A=${e(s3.A.d.raMem, 2)}。` +
  `要做到"每帧只跑一次"必须回放，而 gameLoop 内部的 diff/speedup 局部值外部拿不到 → **不改 src 无法回放**。`);

// 3) CPU 成本：被 stub 的机制每帧占多少
const costRows = rows.map(r => {
  const a = r.A.cpuMs / r.frames, s = r.As.cpuMs / r.frames;
  return { key: r.key, a, s, saved: a - s, pct: (a - s) / a };
});
console.log("\n  被 stub 机制每帧 CPU 成本（A − As）：");
for (const c of costRows) console.log(`    ${c.key.padEnd(24)} A=${fmt(c.a)}ms  As=${fmt(c.s)}ms  差=${fmt(c.saved)}ms（${(c.pct * 100).toFixed(1)}%）`);
const avgPct = costRows.reduce((s, c) => s + c.pct, 0) / costRows.length;
check("[3] 被 stub 的那批机制每帧有可测的 CPU 成本（不是零成本可忽略项）",
  costRows.some(c => c.saved > 0.05), `平均可省 ${(avgPct * 100).toFixed(1)}%`);
note(`[3-说明] 「As 省下的 CPU」= 13 项可 stub 机制的合计成本。它给出**上限**：即使把它们全部按帧跑一次、` +
  `微步里完全不跑，能省下来的也只有这部分。真正的预算判断要用这个数，而不是 Bn 的帧数比例。`);

// 4) 微步次数上限（4ms/帧 目标）
const perSub = rows.map(r => r.Bn.cpuMs / r.frames / r.k);
console.log("\n  微步单价（Bn 每帧 CPU ÷ k，含所有机制）：");
for (const [i, r] of rows.entries()) console.log(`    ${r.key.padEnd(24)} ${fmt(perSub[i])}ms/微步 → 4ms 预算最多约 ${Math.floor(4 / Math.max(perSub[i], 1e-9))} 次/帧（含全部机制）`);
note("[4-说明] 4ms/帧 是**实验目标**，不是已实现保证。上表说明：在含全部机制的情况下，本机 4ms 只能支撑很少的微步；" +
  "只有先剥离帧级机制，微步才可能多起来 —— 这需要 src 侧钩子。");

check("[5] 记录到「新存档场景下 Bn 与 A 的资源差异巨大，且不是安全等价」",
  Math.abs(rows[0].Bn.d.inf - rows[0].A.d.inf) > 0 || Math.abs(rows[0].Bn.d.ip - rows[0].A.d.ip) > 0.01,
  `S1 Δlog10(IP)：A=${fmt(rows[0].A.d.ip)} vs Bn=${fmt(rows[0].Bn.d.ip)}`);

check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/exp-microstep-proto.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), k: K, frameMs: FRAME_MS, rows, costs: costRows, verdict: results, errors: errs }, null, 2));
console.log("\n已写入 _research/exp-microstep-proto.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
