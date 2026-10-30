// 时间语义（三）：bestInfinity 直接断言 + Enslaved 释放帧 + 现实时间储存上限
//
// 只读式核验：不改游戏代码、不改平衡。
//
// 用法: node verify-time-enslaved.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8230);

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
const notes = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const note = (n, d) => { notes.push({ n, d }); console.log(`NOTE  ${n}${d ? "  — " + d : ""}`); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

await page.evaluate(() => {
  try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
  window.__t = {
    read() {
      const r = player.records;
      return {
        iTime: r.thisInfinity.time,
        iInGame: r.thisInfinity.inGameTime,
        iReal: r.thisInfinity.realTime,
        totalRaw: r.totalTimePlayed,
        totalInGame: r.totalInGameTime,
        totalReal: r.realTimePlayed,
        bestInf: r.bestInfinity.time,
        bestInfReal: r.bestInfinity.realTime,
        stored: player.celestials.enslaved.stored,
        storedReal: player.celestials.enslaved.storedReal,
      };
    },
    delta(a, b) { const o = {}; for (const k of Object.keys(a)) o[k] = b[k] - a[k]; return o; },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
    unlockEnslaved() {
      if (!Enslaved.isUnlocked) player.celestials.effarig.unlockBits |= (1 << EffarigUnlock.eternity.id);
      return Enslaved.isUnlocked;
    },
  };
});

console.log("\n环境: 全新开局，已停掉所有 interval\n");

// ================= A. bestInfinity.time 直接断言 =================
console.log("=== A. bestInfinity.time 直接断言（不经 UI）===");
const bestInf = await page.evaluate(() => {
  const t = window.__t;
  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    const R = 90000;                       // 现实 90 秒
    player.records.thisInfinity.time = R * F;
    player.records.thisInfinity.inGameTime = R;
    player.records.thisInfinity.realTime = R;
    player.records.thisInfinity.maxAM = Decimal.NUMBER_MAX_VALUE;   // 让 Player.canCrunch 成立
    player.records.bestInfinity.time = 999999999999;
    player.records.bestInfinity.realTime = 999999999999;
    const expectGame = inGameTimeOf(player.records.thisInfinity);
    bigCrunchReset(true);
    out.push({
      F: t.F(), R,
      expectGame,
      bestTime: player.records.bestInfinity.time,
      bestReal: player.records.bestInfinity.realTime,
      // 重置后本次记录应清零
      afterResetTime: player.records.thisInfinity.time,
      afterResetInGame: player.records.thisInfinity.inGameTime,
    });
  }
  t.setF(1);
  return out;
});
for (const x of bestInf) {
  console.log(`  F=${String(x.F).padStart(6)}: bestInfinity.time=${x.bestTime}  bestInfinity.realTime=${x.bestReal}  期望 ${x.expectGame}`);
}
check("[A1] F=1 时 bestInfinity.time = inGameTimeOf(thisInfinity)（= 官方 time）",
  near(bestInf[0].bestTime, bestInf[0].expectGame, 1e-6), String(bestInf[0].bestTime));
check("[A2] F=10000 时 bestInfinity.time 同样等于 inGameTime，不被倍率污染",
  near(bestInf[1].bestTime, bestInf[1].expectGame, 1e-6) && near(bestInf[1].bestTime, 90000, 1e-6),
  String(bestInf[1].bestTime));
check("[A3] 两种 F 下 bestInfinity.time 完全相同（同一段现实时间）",
  near(bestInf[0].bestTime, bestInf[1].bestTime, 1e-6),
  `${bestInf[0].bestTime} vs ${bestInf[1].bestTime}`);
check("[A4] bestInfinity.realTime 记录的是现实时间，两种 F 下都是 90000",
  near(bestInf[0].bestReal, 90000, 1e-6) && near(bestInf[1].bestReal, 90000, 1e-6),
  `${bestInf[0].bestReal} / ${bestInf[1].bestReal}`);
check("[A5] Big Crunch 后本次计时的 time 与 inGameTime 一起归零",
  bestInf.every(x => x.afterResetTime === 0 && x.afterResetInGame === 0));

// ================= B. Enslaved 释放帧（真实走 useStoredTime → gameLoop）=================
console.log("\n=== B. Enslaved 释放储存的游戏时间（F=1 / F=10000）===");
const release = await page.evaluate(() => {
  const t = window.__t;
  // 注意：释放路径不校验 Enslaved.isUnlocked（canRelease 只看储存/挑战/末日状态），
  // 所以这里不强行解锁 Effarig，避免触发 upstream 的 eternitiedGain 类型问题（见报告 §6 附注）。
  player.challenge.eternity.current = 0;
  player.celestials.enslaved.isStoringReal = false;
  player.celestials.enslaved.isStoring = false;
  player.celestials.pelle.doomed = false;

  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    const S = 1e9;                                     // 储存的游戏时间（毫秒）
    player.celestials.enslaved.stored = S;
    const canRelease = Enslaved.canRelease(false);
    Enslaved.useStoredTime(false);                     // 真实释放入口
    const nextTick = Enslaved.nextTickDiff;
    const isRelease = Enslaved.isReleaseTick;
    const storedAfterRelease = player.celestials.enslaved.stored;
    const before = t.read();
    gameLoop(1);                                       // 释放帧：passDiff=1 → realDiff = 1×F
    const after = t.read();
    out.push({
      F: t.F(), S, canRelease, nextTick, isRelease, storedAfterRelease,
      d: t.delta(before, after),
      releasedStillPending: Enslaved.isReleaseTick,
    });
  }
  t.setF(1);
  return { skipped: false, out };
});

if (release.skipped) {
  check("[B] Enslaved 释放帧（无法解锁 Enslaved，测试跳过）", false, "unlock 失败");
} else {
  for (const x of release.out) {
    console.log(`  F=${String(x.F).padStart(6)}: nextTickDiff=${x.nextTick}  Δtime=${x.d.time || x.d.iTime}  ΔinGame=${x.d.iInGame}  Δreal=${x.d.iReal}`);
  }
  check("[B1] 释放入口把储存量原样放进 nextTickDiff（clampMax 1e300 不生效）",
    release.out.every(x => x.nextTick === x.S), release.out.map(x => x.nextTick).join(" / "));
  check("[B2] 释放后 stored 被清空", release.out.every(x => x.storedAfterRelease === 0));
  check("[B3] 释放帧本身不再被标记为 release（帧末复位）", release.out.every(x => x.releasedStillPending === false));
  check("[B4] ΔthisInfinity.time = 储存的游戏时间（F=1 与 F=10000 都是 1e9）",
    release.out.every(x => near(x.d.iTime, 1e9, 1e-3)),
    release.out.map(x => x.d.iTime).join(" / "));
  check("[B5] ΔthisInfinity.inGameTime = 储存量 / F（F=1 得 1e9，F=10000 得 1e5）",
    near(release.out[0].d.iInGame, 1e9, 1e-3) && near(release.out[1].d.iInGame, 1e5, 1e-3),
    release.out.map(x => x.d.iInGame).join(" / "));
  check("[B6] 释放帧的现实时间只按墙钟 1ms 累计，不被倍率放大",
    release.out.every(x => near(x.d.iReal, 1, 1e-6)),
    release.out.map(x => x.d.iReal).join(" / "));
  check("[B7] 存档级 totalTimePlayed / totalInGameTime 与本次口径一致",
    near(release.out[0].d.totalRaw, 1e9, 1e-3) && near(release.out[1].d.totalRaw, 1e9, 1e-3) &&
    near(release.out[1].d.totalInGame, 1e5, 1e-3));
  note("[B-结论] 释放量是「游戏时间」单位：Δtime 与 F 无关；而 inGameTime（= 官方 time 等价量）在 F=10000 下是 1e5，"
    + "这与「1e9 储存是在 F=10000 下攒出来的（等价于官方的 1e5）」完全自洽");
}

// ================= C. 现实时间储存：上限与 F 无关 =================
console.log("\n=== C. 储存现实时间：上限常量与填充是否受 F 影响 ===");
const realStore = await page.evaluate(() => {
  const t = window.__t;
  // 储存现实时间要求 Enslaved 已解锁；解锁 Effarig.eternity 后，upstream 的 passivePrestigeGen
  // 会走 eternitiedGain 分支（变量初值是 Number 0，只有买到 RUPG14 才会变成 Decimal），
  // 因此这里同时把 RUPG14 的位打开，保持运行环境自洽（不改任何时间逻辑）。
  t.unlockEnslaved();
  player.reality.upgradeBits |= (1 << RealityUpgrade(14).id);
  const caps = {
    timeCap: Enslaved.timeCap,
    storedRealTimeCap: Enslaved.storedRealTimeCap,
    efficiency: Enslaved.storedRealTimeEfficiency,
  };
  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    player.celestials.enslaved.storedReal = 0;
    player.celestials.enslaved.isStoring = false;
    player.celestials.enslaved.isStoringReal = true;
    const storing = Enslaved.isStoringRealTime;
    player.lastUpdate = Date.now() - 200;             // 真实墙钟 200ms
    const before = t.read();
    gameLoop();
    const after = t.read();
    player.celestials.enslaved.isStoringReal = false;
    player.lastUpdate = Date.now();
    out.push({ F: t.F(), storing, d: t.delta(before, after) });
  }
  t.setF(1);
  return { caps, out };
});
console.log("  上限常量:", JSON.stringify(realStore.caps));
for (const x of realStore.out) {
  console.log(`  F=${String(x.F).padStart(6)}: ΔstoredReal=${x.d.storedReal.toFixed(1)}  Δreal=${x.d.totalReal.toFixed(1)}  Δraw=${x.d.totalRaw}`);
}
check("[C1] 游戏时间储存上限 timeCap = 1e300（游戏毫秒常量，不是时长）",
  realStore.caps.timeCap === 1e300, String(realStore.caps.timeCap));
check("[C2] 现实时间储存上限 = 8 小时（28,800,000 现实毫秒）+ Ra 加成",
  realStore.caps.storedRealTimeCap === 1000 * 3600 * 8, String(realStore.caps.storedRealTimeCap));
check("[C3] 现实时间储存效率 0.7", realStore.caps.efficiency === 0.7);
check("[C4] 填充按墙钟：F=1 与 F=10000 下 200ms 都得到 ≈140ms 储存（0.7 效率）",
  realStore.out.every(x => near(x.d.storedReal, 140, 12)),
  realStore.out.map(x => x.d.storedReal.toFixed(1)).join(" / "));
check("[C5] 现实时间储存期间不产生游戏时间（两种 F 下 ΔtotalTimePlayed 都 = 0）",
  realStore.out.every(x => near(x.d.totalRaw, 0, 1e-6)),
  realStore.out.map(x => x.d.totalRaw).join(" / "));
check("[C6] 现实时间按墙钟 200ms 累计，不被倍率放大",
  realStore.out.every(x => near(x.d.totalReal, 200, 25)),
  realStore.out.map(x => x.d.totalReal.toFixed(1)).join(" / "));

check("[D] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 结果: ${pass} 通过 / ${results.length - pass} 失败 / ${notes.length} 条结论备注 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
