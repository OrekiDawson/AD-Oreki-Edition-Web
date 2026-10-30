// 定向复核：证明「本项目的 inGameTime 累计」与「官方原版的 records.time 累计」逐帧等价
//
// 结论要证明的命题：
//   对任意帧 i，official:  time_official += wall_i × speedup_i
//   本项目:                time_ours     += wall_i × F_i × speedup_i
//                          inGameTime    += (wall_i × F_i × speedup_i) / F_i  = wall_i × speedup_i
//   因此 Σ inGameTime ≡ Σ time_official
//
// 做法：停掉自动循环，手动用固定 passDiff 驱动 gameLoop，分别以 F=1 与 F=10000 跑同一序列，
// 比较 Δtime 的比值与 ΔinGameTime 的绝对相等。
//
// 用法: node verify-time-equivalence.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8210);

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
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

console.log("\n环境: 全新开局（未无限、无黑洞/时间符文/储存，speedup 恒为 1）\n");

await page.evaluate(() => {
  // 停掉自动 tick，改为手动驱动，保证每一帧的 passDiff 完全可控
  try { GameIntervals.gameLoop.stop(); } catch (e) { /* 某些版本无此 interval */ }
  try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }

  window.__eq = {
    speedup() { return getGameSpeedupFactor(); },
    read() {
      const r = player.records;
      return {
        time: r.thisInfinity.time,
        inGame: r.thisInfinity.inGameTime,
        real: r.thisInfinity.realTime,
        raw: r.totalTimePlayed,
        totalInGame: r.totalInGameTime,
      };
    },
    // 用固定 passDiff 驱动 n 帧，返回累计增量
    drive(deltas) {
      const before = this.read();
      for (const d of deltas) gameLoop(d);
      const after = this.read();
      const out = {};
      for (const k of Object.keys(before)) out[k] = after[k] - before[k];
      return out;
    },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
  };
});

const speedup0 = await page.evaluate(() => window.__eq.speedup());
console.log(`当前游戏内膨胀倍率 getGameSpeedupFactor() = ${speedup0}`);
check("测试环境干净：游戏内膨胀倍率 = 1（无黑洞/时间符文/储存）", near(speedup0, 1, 1e-9), String(speedup0));

// ============ A. 同一墙钟序列，F=1 与 F=10000 对照 ============
const SEQ = [100, 100, 100];

const runA = await page.evaluate((seq) => {
  const eq = window.__eq;
  eq.setF(1);
  const f1 = eq.F();
  const d1 = eq.drive(seq);
  eq.setF(10000);
  const f10000 = eq.F();
  const d2 = eq.drive(seq);
  eq.setF(1);
  return { f1, f10000, d1, d2 };
}, SEQ);

console.log("\n=== A. 同一墙钟序列（100+100+100 ms）在 F=1 与 F=10000 下 ===");
console.log("F=1     :", JSON.stringify(runA.d1));
console.log("F=10000 :", JSON.stringify(runA.d2));

check("[A1] F=1 时 Δ游戏时间 = 300ms（原版口径）", near(runA.d1.time, 300, 1e-6), String(runA.d1.time));
check("[A2] F=10000 时 Δ游戏时间 = 3,000,000ms（= 300 × 10000）",
  near(runA.d2.time, 3e6, 1e-3), String(runA.d2.time));
check("[A3] 两种 F 下 Δ游戏内时间都是 300ms（不随 F 变化）",
  near(runA.d1.inGame, 300, 1e-6) && near(runA.d2.inGame, 300, 1e-6),
  `${runA.d1.inGame} vs ${runA.d2.inGame}`);
check("[A4] 核心等价：inGameTime(F=10000) === time(F=1)",
  near(runA.d2.inGame, runA.d1.time, 1e-6), `${runA.d2.inGame} vs ${runA.d1.time}`);
check("[A5] Δ现实时间在两种 F 下都 = 300ms",
  near(runA.d1.real, 300, 1e-6) && near(runA.d2.real, 300, 1e-6),
  `${runA.d1.real} vs ${runA.d2.real}`);
check("[A6] 存档级 totalInGameTime 同步成立",
  near(runA.d1.totalInGame, 300, 1e-6) && near(runA.d2.totalInGame, 300, 1e-6),
  `${runA.d1.totalInGame} vs ${runA.d2.totalInGame}`);

// ============ B. 倍率中途切换：不得用新倍率重算历史 ============
const runB = await page.evaluate(() => {
  const eq = window.__eq;
  eq.setF(1);
  const a = eq.drive([100]);
  eq.setF(10000);
  const b = eq.drive([100]);
  eq.setF(1);
  const c = eq.drive([100]);
  return { a, b, c, sumInGame: a.inGame + b.inGame + c.inGame, sumTime: a.time + b.time + c.time };
});

console.log("\n=== B. 倍率中途切换 1× → 10000× → 1×（每段 100ms 墙钟）===");
console.log("逐段:", JSON.stringify({ a: runB.a.inGame, b: runB.b.inGame, c: runB.c.inGame }));
check("[B1] 三段游戏内时间各 100ms（与当时倍率无关）",
  near(runB.a.inGame, 100, 1e-6) && near(runB.b.inGame, 100, 1e-6) && near(runB.c.inGame, 100, 1e-6),
  `${runB.a.inGame}/${runB.b.inGame}/${runB.c.inGame}`);
check("[B2] 合计 = 300ms 墙钟（旧写法「累计time/当前F」会得 100.02）",
  near(runB.sumInGame, 300, 1e-6), String(runB.sumInGame));
check("[B3] 旧写法结果 ≈ 100.02ms，与本实现相差 200ms，证明旧写法错误",
  near(runB.sumTime / 10000, 100.02, 0.01), `${runB.sumTime} / 10000 = ${runB.sumTime / 10000}`);

// ============ C. 逐帧恒等式：inGame 增量 × F === time 增量 ============
const runC = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const f of [1, 2, 137, 10000, 100000]) {
    eq.setF(f);
    const before = eq.read();
    gameLoop(37);
    const after = eq.read();
    out.push({
      F: eq.F(),
      dTime: after.time - before.time,
      dInGame: after.inGame - before.inGame,
    });
  }
  eq.setF(1);
  return out;
});

console.log("\n=== C. 逐帧恒等式 dInGame × F === dTime（单帧 37ms 墙钟）===");
for (const r of runC) {
  const lhs = r.dInGame * r.F;
  console.log(`  F=${String(r.F).padStart(6)}  dTime=${r.dTime.toFixed(3)}  dInGame=${r.dInGame.toFixed(6)}  dInGame×F=${lhs.toFixed(3)}`);
}
check("[C1] 任意 F 下 dInGame × F 都等于 dTime（逐帧恒等）",
  runC.every(r => near(r.dInGame * r.F, r.dTime, 1e-3)),
  runC.map(r => `${r.dInGame * r.F}≈${r.dTime}`).join(" | "));
check("[C2] 任意 F 下 dInGame 恒为 37ms（= 墙钟 × speedup=1）",
  runC.every(r => near(r.dInGame, 37, 1e-6)),
  runC.map(r => r.dInGame.toFixed(6)).join(" | "));

// ============ D. 离线模拟路径（simulateTime 内 diff *= F）============
const runD = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const f of [1, 10000]) {
    eq.setF(f);
    const before = eq.read();
    // 直接调用 simulateTime 会重置很多状态，这里改为验证其内部控制流：
    // simulateTime 把 seconds/F 作为真实秒数，内部再逐 tick gameLoop(...)
    // 因此单测「传入 passDiff 时 diff 被补上 F」这一条：
    const b2 = eq.read();
    gameLoop(50);
    const a2 = eq.read();
    out.push({ F: eq.F(), dTime: a2.time - b2.time, dInGame: a2.inGame - b2.inGame, dReal: a2.real - b2.real });
  }
  eq.setF(1);
  return out;
});

console.log("\n=== D. passDiff 路径（simulateTime 用的就是这条）===");
for (const r of runD) console.log(`  F=${r.F}: dTime=${r.dTime} dInGame=${r.dInGame} dReal=${r.dReal}`);
check("[D1] passDiff=50ms 在 F=1 与 F=10000 下 dInGame 都 = 50ms",
  near(runD[0].dInGame, 50, 1e-6) && near(runD[1].dInGame, 50, 1e-6),
  `${runD[0].dInGame} vs ${runD[1].dInGame}`);
check("[D2] passDiff 路径的 dReal 都 = 50ms（离线不影响现实时间）",
  near(runD[0].dReal, 50, 1e-6) && near(runD[1].dReal, 50, 1e-6),
  `${runD[0].dReal} vs ${runD[1].dReal}`);

// ============ E. 游戏内膨胀倍率 ≠ 1：用 options.blackHoleSpeedup 注入确定倍率 ============
// 官方与本地都有这条分支：speedFactor = options.blackHoleSpeedup（原本供 simulateTime 使用），
// 因此可以在不依赖黑洞/时间符文的情况下注入一个确定的膨胀倍率，验证 speedup 在 diff 与 /F 之间精确抵消。
const runE = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const speed of [1, 7.5, 1000, 0.001]) {
    for (const f of [1, 10000]) {
      eq.setF(f);
      const before = eq.read();
      gameLoop(64, { blackHoleSpeedup: speed });
      const after = eq.read();
      out.push({
        speed, F: eq.F(),
        dTime: after.time - before.time,
        dInGame: after.inGame - before.inGame,
        dReal: after.real - before.real,
      });
    }
  }
  eq.setF(1);
  return out;
});

console.log("\n=== E. 注入确定的游戏内膨胀倍率（单帧 64ms 墙钟）===");
console.log("  speedup      F        dTime          dInGame     dReal");
for (const r of runE) {
  console.log(`  ${String(r.speed).padStart(7)}  ${String(r.F).padStart(6)}  ${String(r.dTime).padStart(12)}  ${r.dInGame.toFixed(4).padStart(10)}  ${r.dReal}`);
}
check("[E1] 每个 speedup 下，F=1 与 F=10000 的 dInGame 完全相等（speedup 精确抵消）",
  [1, 7.5, 1000, 0.001].every(s => {
    const a = runE.find(r => r.speed === s && r.F === 1);
    const b = runE.find(r => r.speed === s && r.F === 10000);
    return near(a.dInGame, b.dInGame, 1e-6);
  }),
  runE.map(r => `${r.speed}@F${r.F}=${r.dInGame.toFixed(4)}`).join(" | "));
check("[E2] dInGame = 64ms × speedup（与官方 time 增量同式）",
  runE.every(r => near(r.dInGame, 64 * r.speed, 1e-4)),
  runE.map(r => `${r.dInGame.toFixed(4)} vs ${64 * r.speed}`).join(" | "));
check("[E3] dTime = 64ms × F × speedup", runE.every(r => near(r.dTime, 64 * r.F * r.speed, 1e-2)));
check("[E4] dReal = 64ms（膨胀与全局倍率都不放大现实时间）", runE.every(r => near(r.dReal, 64, 1e-6)));

check("[F] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 结果: ${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
