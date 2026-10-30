// 离线结算深挖：正式异步路径（fast=false）、黑洞激活分支、以及 S4 溢出读数的归因
//
// 只读测量，不改机制。所有"完成"判定都用**可观测的完成条件**（模拟锁释放），
// 不用"读一次看数变了没"来猜。
//
// 用法: node probe-offline-deep.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8300);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const note = (n, d = "") => console.log(`NOTE  ${n}${d ? "  — " + d : ""}`);
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });

// 就绪探测（裸标识符；Currency 是 function）
let ready = false;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof Currency === "function" && typeof player === "object"; }
    catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 500));
}
check("[R] 游戏启动就绪", ready);
if (!ready) { await browser.close(); server.close(); process.exit(1); }

// 注入读取器
await page.evaluate(() => {
  window.__d = {
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
        ip: this.lg(Currency.infinityPoints.value),
        ep: this.lg(Currency.eternityPoints.value),
        inf: this.num(Currency.infinities.value),
        eter: this.num(Currency.eternities.value),
        real2: safe(() => this.num(Currency.realities.value)),
        speedup: safe(() => getGameSpeedupFactor()),
        simLocked: safe(() => GameSpeed.isSimulationLocked),
        modalBar: safe(() => ui && ui.$viewModel && ui.$viewModel.modal && ui.$viewModel.modal.progressBar !== undefined),
      };
    },
    load(text, F, bhActive) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameStorage.offlineEnabled = true;
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      if (bhActive) {
        player.blackHolePause = false;
        player.blackHole = player.blackHole || [];
        player.blackHole[0] = player.blackHole[0] || {};
        player.blackHole[0].unlocked = true;
        player.blackHole[0].active = true;
        player.blackHole[0].phase = 0;
      }
      GameSpeed.set(F);
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      const bh = {
        unlocked: (() => { try { return BlackHoles.areUnlocked; } catch (e) { return undefined; } })(),
        paused: (() => { try { return BlackHoles.arePaused; } catch (e) { return undefined; } })(),
        active1: (() => { try { return !!BlackHole(1).isActive; } catch (e) { return undefined; } })(),
        speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return undefined; } })(),
      };
      return { bh, state: this.snap() };
    },
    startSim(S, fast) { simulateTime(S, false, fast); return true; },
  };
});

const SAVE = "132._9.1e137IP.txt";
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
console.log(`\n存档样本：${SAVE}`);
console.log("口径：Δ游戏时间/Δ现实 与 F 比较；Δ现实 应等于离线秒数\n");

// 等待模拟真正完成：模拟锁释放 + 进度条消失
async function waitSimDone(timeoutMs = 180000) {
  const t0 = Date.now();
  let sawLocked = false;
  while (Date.now() - t0 < timeoutMs) {
    const st = await page.evaluate(() => {
      try {
        return {
          locked: GameSpeed.isSimulationLocked,
          bar: !!(ui && ui.$viewModel && ui.$viewModel.modal && ui.$viewModel.modal.progressBar !== undefined),
        };
      } catch (e) { return { locked: false, bar: false }; }
    }).catch(() => ({ locked: false, bar: false }));
    if (st.locked) sawLocked = true;
    if (sawLocked && !st.locked) return { done: true, ms: Date.now() - t0 };
    if (!sawLocked && Date.now() - t0 > 3000) {
      // 第一次轮询就没锁 → 可能已瞬间完成（tick 极少）
      if (!st.bar) return { done: true, ms: Date.now() - t0, instant: true };
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { done: false, ms: Date.now() - t0 };
}

// ================= A. 正式异步路径 fast=false =================
console.log("=== A. 正式路径 simulateTime(S, false, false)（Async.run 分片） ===");
console.log("     F   离线(s)  tick数  完成耗时(ms)   Δ游戏时间(ms)     Δ现实(ms)   Δ游戏/Δ现实  /F      Δ无限     Δ永恒");
const asyncRows = [];
for (const F of [1, 137, 10000]) {
  for (const S of [60, 300]) {
    const pre = await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, F);
    await page.evaluate((S) => window.__d.startSim(S, false), S);
    const w = await waitSimDone();
    const post = await page.evaluate(() => window.__d.snap());
    const d = {
      F, S, ticks: Math.floor(S * 20), done: w.done, ms: w.ms,
      dGame: post.game - pre.state.game,
      dReal: post.real - pre.state.real,
      dInf: post.inf - pre.state.inf,
      dEter: post.eter - pre.state.eter,
    };
    asyncRows.push(d);
    const ratio = d.dGame / (d.dReal || 1);
    console.log(`  ${String(F).padStart(6)} ${String(S).padStart(7)} ${String(d.ticks).padStart(6)} ${String(d.ms).padStart(11)} ${d.dGame.toExponential(3).padStart(14)} ${d.dReal.toFixed(0).padStart(11)} ${ratio.toExponential(3).padStart(12)} ${(ratio / F).toExponential(2).padStart(7)} ${d.dInf.toExponential(2).padStart(9)} ${d.dEter.toExponential(2).padStart(9)}`);
  }
}
check("[A1] 正式路径全部在超时内完成（用模拟锁释放判定，非猜测）",
  asyncRows.every(r => r.done), asyncRows.map(r => `${r.F}/${r.S}s:${r.done}`).join(" "));
check("[A2] Δ现实时间 = 离线秒数（现实时间不被倍率放大）",
  asyncRows.every(r => rel(r.dReal, r.S * 1000) < 0.02),
  asyncRows.map(r => `${r.F}/${r.S}s:${r.dReal.toFixed(0)}`).join(" "));
check("[A3] Δ游戏时间/Δ现实 = F（正式路径同样吃 F）",
  asyncRows.every(r => rel(r.dGame / (r.dReal || 1), r.F) < 0.02),
  asyncRows.map(r => `${r.F}:${(r.dGame / (r.dReal || 1)).toFixed(0)}`).join(" "));

// ================= B. 黑洞激活分支 =================
console.log("\n=== B. 黑洞激活分支（强制 player.blackHole[0].active = true）===");
const bhPre = await page.evaluate((text) => window.__d.load(text, 1, true), saveText);
console.log(`  强制后：unlocked=${bhPre.bh.unlocked} paused=${bhPre.bh.paused} active1=${bhPre.bh.active1} speedup=${bhPre.bh.speedup?.toExponential?.(3)}`);
check("[B1] 黑洞确实处于激活状态（active1 = true 且 speedup > 1）",
  bhPre.bh.active1 === true && Number(bhPre.bh.speedup) > 1,
  `active1=${bhPre.bh.active1} speedup=${bhPre.bh.speedup}`);

console.log("     F   离线(s)  方式   Δ游戏时间(ms)     Δ现实(ms)   Δ游戏/Δ现实   Δ游戏/(Δ现实×speedup)");
const bhRows = [];
for (const F of [1, 10000]) {
  for (const S of [60]) {
    for (const fast of [true, false]) {
      const pre = await page.evaluate(({ text, F }) => window.__d.load(text, F, true), { text: saveText, F });
      await page.evaluate(({ S, fast }) => window.__d.startSim(S, fast), { S, fast });
      if (!fast) await waitSimDone();
      const post = await page.evaluate(() => window.__d.snap());
      const d = {
        F, S, fast,
        dGame: post.game - pre.state.game,
        dReal: post.real - pre.state.real,
        speedup: pre.bh.speedup,
      };
      bhRows.push(d);
      const r1 = d.dGame / (d.dReal || 1);
      const r2 = r1 / (d.speedup || 1);
      console.log(`  ${String(F).padStart(6)} ${String(S).padStart(7)}  ${(fast ? "fast" : "async").padEnd(5)} ${d.dGame.toExponential(3).padStart(14)} ${d.dReal.toFixed(0).padStart(11)} ${r1.toExponential(3).padStart(12)} ${r2.toExponential(3).padStart(16)}`);
    }
  }
}
check("[B2] 黑洞激活下仍满足 Δ游戏/Δ现实 = F × speedup（无重复倍率）",
  bhRows.every(r => rel(r.dGame / (r.dReal || 1), r.F * (r.speedup || 1)) < 0.05),
  bhRows.map(r => `${r.F}/${r.fast ? "f" : "a"}: ${(r.dGame / (r.dReal || 1)).toExponential(2)} vs ${(r.F * (r.speedup || 1)).toExponential(2)}`).join(" | "));
const extreme = bhRows.some(r => r.dGame / (r.dReal || 1) > 1e6);
note(`[B3] 旧报告中「1 秒离线产生 3.2e14ms 游戏时间」的合理性：本次黑洞激活下 Δ游戏/Δ现实 最大 ${Math.max(...bhRows.map(r => r.dGame / (r.dReal || 1))).toExponential(2)}，` +
  `${extreme ? "已达到同量级 → 支持「那是黑洞 speedup 的正常结果」" : "未达到 1e11 量级 → 该异常另有来源，仍未解释"}`);

// ================= C. S4 溢出读数归因 =================
console.log("\n=== C. S4 的 ±1e12 读数归因（是否有重置发生）===");
const S4 = "1123._Endgame.txt";
const s4Text = fs.readFileSync(path.join(SAVE_DIR, S4), "utf-8");
const s4 = await page.evaluate(async (text) => {
  const d = window.__d;
  const pre = d.load(text, 10000, false);
  // 手动推进 500 帧（与基线同预算），逐帧记录是否发生重置
  const before = d.snap();
  let resetSeen = false;
  for (let i = 0; i < 500; i++) {
    gameLoop(20);
    const s = d.snap();
    if (Number.isFinite(s.ip) && Number.isFinite(before.ip) && s.ip < before.ip - 100) resetSeen = true;
  }
  const after = d.snap();
  return { before, after, resetSeen };
}, s4Text);
console.log(`  IP(log10): ${s4.before.ip} → ${s4.after.ip}`);
console.log(`  EP(log10): ${s4.before.ep} → ${s4.after.ep}`);
console.log(`  无限: ${s4.before.inf} → ${s4.after.inf}   永恒: ${s4.before.eter} → ${s4.after.eter}`);
check("[C1] S4 的负 Δlog10(IP) 由重置（无限/永恒次数增加）解释，而非浮点溢出",
  (s4.after.inf - s4.before.inf > 0 || s4.after.eter - s4.before.eter > 0 || s4.resetSeen) &&
  Number.isFinite(s4.before.ip) && Number.isFinite(s4.after.ip),
  `Δ无限=${(s4.after.inf - s4.before.inf).toExponential(2)} Δ永恒=${(s4.after.eter - s4.before.eter).toExponential(2)}`);

check("[D] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 结果: ${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
