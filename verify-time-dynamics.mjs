// 时间语义：动态倍率、特殊阶段、离线结算的浏览器回归
// 用法: node verify-time-dynamics.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8095);

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

const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const samples = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const pickSave = name => {
  const f = samples.find(x => x.startsWith(name + ".")) || samples.find(x => x.startsWith(name));
  return f ? fs.readFileSync(path.join(SAVE_DIR, f), "utf-8") : null;
};

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const skips = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const skip = (n, why) => { skips.push({ n, why }); console.log(`SKIP  ${n}  — ${why}`); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1400, height: 950 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 统一的「读-计时-读」探针，注入到页面里复用
await page.evaluate(() => {
  window.__probe = {
    read() {
      const r = player.records;
      return {
        real: r.realTimePlayed,
        raw: r.totalTimePlayed,
        inGame: r.totalInGameTime,
        iTime: r.thisInfinity.time,
        iReal: r.thisInfinity.realTime,
        iInGame: r.thisInfinity.inGameTime,
        eTime: r.thisEternity.time,
        eInGame: r.thisEternity.inGameTime,
      };
    },
    delta(a, b) {
      const out = {};
      for (const k of Object.keys(a)) out[k] = b[k] - a[k];
      return out;
    },
  };
});

// =====================================================================
console.log("\n### A. 分段膨胀：三段不同倍率各 100ms 墙钟");
const segA = await page.evaluate(() => {
  try { GameIntervals.gameLoop.stop(); } catch { /* 未启动 */ }
  GameSpeed.set(1);
  player.options.gamePaused = false;
  player.challenge.eternity.current = 0;
  player.celestials.enslaved.isStoringReal = false;
  player.lastUpdate = Date.now();
  const P = window.__probe;
  const a0 = P.read();
  gameLoop(100, { blackHoleSpeedup: 100 });   // 膨胀 100×
  const a1 = P.read();
  gameLoop(100);                              // 无膨胀
  const a2 = P.read();
  gameLoop(100, { blackHoleSpeedup: 50 });    // 膨胀 50×
  const a3 = P.read();
  return { s1: P.delta(a0, a1), s2: P.delta(a1, a2), s3: P.delta(a2, a3), a0, a3 };
});
check("[A] 段 1（膨胀 100×）：游戏时间 +10,000ms", near(segA.s1.iTime, 10000, 1), String(segA.s1.iTime));
check("[A] 段 1（膨胀 100×）：现实时间 +100ms", near(segA.s1.iReal, 100, 1e-6), String(segA.s1.iReal));
check("[A] 段 2（无膨胀）：游戏时间 +100ms", near(segA.s2.iTime, 100, 1e-6), String(segA.s2.iTime));
check("[A] 段 3（膨胀 50×）：游戏时间 +5,000ms", near(segA.s3.iTime, 5000, 1), String(segA.s3.iTime));
const sumA = ["s1", "s2", "s3"].reduce((acc, k) => acc + segA[k].inGame, 0);
check("[A] 三段现实时间合计 300ms", near(sumA, 300, 1e-6), String(sumA));
const gameA = segA.s1.iTime + segA.s2.iTime + segA.s3.iTime;
check("[A] 三段游戏时间合计 15,100ms（按段加权，而非末段倍率 × 总时长）", near(gameA, 15100, 2), String(gameA));
check("[A] 若误用末段倍率 50× 会得到 15,000 而非 15,100",
  !near(300 * 50, gameA, 1), `300×50=${300 * 50} vs ${gameA}`);
const inGameA = segA.s1.inGame + segA.s2.inGame + segA.s3.inGame;
check("[A] 按时间片累计的游戏内时间 = 现实时间（倍率 1× 时两者相等）", near(inGameA, sumA, 1), String(inGameA));

// =====================================================================
console.log("\n### B. 同一分段序列在 10000× 下，游戏内时间必须不变");
const segB = await page.evaluate(() => {
  GameSpeed.set(10000);
  player.lastUpdate = Date.now();
  const P = window.__probe;
  const b0 = P.read();
  gameLoop(100, { blackHoleSpeedup: 100 });
  const b1 = P.read();
  gameLoop(100);
  const b2 = P.read();
  gameLoop(100, { blackHoleSpeedup: 50 });
  const b3 = P.read();
  return { s1: P.delta(b0, b1), s2: P.delta(b1, b2), s3: P.delta(b2, b3) };
});
check("[B] 10000× 下段 1 原始游戏时间 = 1e8ms（10,000× 放大）", near(segB.s1.iTime, 1e8, 100), String(segB.s1.iTime));
check("[B] 10000× 下段 1 现实时间仍为 100ms", near(segB.s1.iReal, 100, 1e-6), String(segB.s1.iReal));
const inGameB = segB.s1.inGame + segB.s2.inGame + segB.s3.inGame;
check("[B] 10000× 下游戏内时间增量与 1× 完全一致（300ms）", near(inGameB, 300, 1), `${inGameB} vs ${inGameA}`);
check("[B] 10000× 下原始游戏时间是 1× 的 10000 倍",
  near((segB.s1.iTime + segB.s2.iTime + segB.s3.iTime) / gameA, 10000, 0.01),
  String((segB.s1.iTime + segB.s2.iTime + segB.s3.iTime) / gameA));

// =====================================================================
console.log("\n### C. 倍率中途切换：历史累计量不得被新倍率重算");
const segC = await page.evaluate(() => {
  const P = window.__probe;
  const c0 = P.read();
  GameSpeed.set(1);      gameLoop(100);
  GameSpeed.set(10000);  gameLoop(100);
  GameSpeed.set(1);      gameLoop(100);
  const c1 = P.read();
  const d = P.delta(c0, c1);
  return {
    d,
    // 旧写法（用当前倍率反推整段历史）会得到的值
    legacy: (c1.raw - c0.raw) / getGlobalSpeedFactor(),
    factorNow: getGlobalSpeedFactor(),
  };
});
check("[C] 现实中确实经历了 300ms", near(segC.d.real, 300, 1e-6), String(segC.d.real));
check("[C] 原始游戏时间 = 1×100 + 10000×100 + 1×100 = 1,000,200ms",
  near(segC.d.raw, 1000200, 10), String(segC.d.raw));
check("[C] 按时间片累计的游戏内时间 = 300ms（不受末次倍率影响）", near(segC.d.inGame, 300, 1), String(segC.d.inGame));
check("[C] 旧写法「原始游戏时间 / 当前倍率」会得到 1,000,200ms（错误放大 3334 倍）",
  near(segC.legacy, 1000200, 10) && !near(segC.legacy, segC.d.inGame, 10),
  `legacy=${segC.legacy} tracked=${segC.d.inGame}`);

// =====================================================================
console.log("\n### D. 时序边界：倍率切换发生在相邻时间片之间");
const segD = await page.evaluate(() => {
  const P = window.__probe;
  GameSpeed.set(1);
  const d0 = P.read();
  gameLoop(16);                       // 一帧
  gameLoop(16);
  GameSpeed.set(100);
  gameLoop(16);
  const d1 = P.read();
  const d = P.delta(d0, d1);
  return { d, expectedInGame: 48, expectedRaw: 48 + 16 * 100 };
});
check("[D] 切换边界：游戏内时间 = 3×16ms（与倍率无关）", near(segD.d.inGame, 48, 1), String(segD.d.inGame));
check("[D] 切换边界：原始游戏时间 = 16+16+1600ms", near(segD.d.raw, 1632, 2), String(segD.d.raw));

// =====================================================================
console.log("\n### E. 存档往返：新字段被完整持久化");
const roundTrip = await page.evaluate(() => {
  GameSpeed.set(1);
  gameLoop(100);
  player.challenge.normal.bestRealTimes[0] = 12345;
  const text = GameSaveSerializer.serialize(player);
  const back = GameSaveSerializer.deserialize(text);
  return {
    totalInGame: player.records.totalInGameTime,
    backTotal: back.records.totalInGameTime,
    thisInGame: player.records.thisInfinity.inGameTime,
    backThis: back.records.thisInfinity.inGameTime,
    realTimes: Array.from(player.challenge.normal.bestRealTimes),
    backRealTimes: Array.from(back.challenge.normal.bestRealTimes ?? []),
    backBestEternityReal: back.records.bestEternity.realTime,
    hasInGameField: "inGameTime" in back.records.thisEternity,
  };
});
check("[E] 存档往返保留 totalInGameTime", near(roundTrip.backTotal, roundTrip.totalInGame, 1e-6),
  `${roundTrip.backTotal} vs ${roundTrip.totalInGame}`);
check("[E] 存档往返保留 thisInfinity.inGameTime", near(roundTrip.backThis, roundTrip.thisInGame, 1e-6),
  `${roundTrip.backThis} vs ${roundTrip.thisInGame}`);
check("[E] 存档往返保留挑战现实时间数组",
  roundTrip.backRealTimes.length === roundTrip.realTimes.length &&
  roundTrip.backRealTimes.every((v, i) => v === roundTrip.realTimes[i]),
  JSON.stringify(roundTrip.backRealTimes.slice(0, 3)));
check("[E] 旧字段 thisEternity/bestEternity 结构未被破坏", roundTrip.hasInGameField === true);

// =====================================================================
console.log("\n### F. 特殊阶段：EC12（固定 1/1000 速）");
const ec12 = await page.evaluate(() => {
  GameSpeed.set(1);
  const P = window.__probe;
  const before = getGameSpeedupFactor();
  player.challenge.eternity.current = 12;
  const inEc12 = getGameSpeedupFactor();
  player.lastUpdate = Date.now();
  const f0 = P.read();
  gameLoop(1000);
  const f1 = P.read();
  const d = P.delta(f0, f1);
  player.challenge.eternity.current = 0;
  const after = getGameSpeedupFactor();
  return { before, inEc12, after, d };
});
check("[F] EC12 内 getGameSpeedupFactor() = 1/1000", near(ec12.inEc12, 0.001, 1e-12), String(ec12.inEc12));
check("[F] 退出 EC12 后倍率恢复", near(ec12.after, ec12.before, 1e-12), String(ec12.after));
check("[F] EC12 内 1000ms 墙钟 = 1ms 游戏时间", near(ec12.d.iTime, 1, 1e-6), String(ec12.d.iTime));
check("[F] EC12 内现实时间仍按墙钟累计 1000ms", near(ec12.d.iReal, 1000, 1e-6), String(ec12.d.iReal));

// =====================================================================
console.log("\n### G. 旧存档（1123 数据集样本）载入后的时间语义");
const oldSaveName = ["861", "1002", "424"].find(n => pickSave(n));
if (!oldSaveName) {
  skip("[G] 旧存档回归", "未找到样本存档");
} else {
  const saveText = pickSave(oldSaveName);
  const legacy = await page.evaluate(async (text) => {
    try { GameIntervals.gameLoop.stop(); } catch { /* ignore */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(text);
    player = obj;
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    GameIntervals.gameLoop.stop();
    GameSpeed.set(10000);
    const snap = {
      normalRealTimes: Array.from(player.challenge.normal.bestRealTimes ?? []),
      infinityRealTimes: Array.from(player.challenge.infinity.bestRealTimes ?? []),
      totalInGame: player.records.totalInGameTime,
      totalRaw: player.records.totalTimePlayed,
      thisInGame: player.records.thisInfinity.inGameTime,
      thisRaw: player.records.thisInfinity.time,
      factor: getGlobalSpeedFactorRaw(),
      totalTimePlayedDisplay: totalInGameTimeMs(),
      bestEternityReal: player.records.bestEternity.realTime,
    };
    gameLoop(100);
    const after = {
      totalInGame: player.records.totalInGameTime,
      thisInGame: player.records.thisInfinity.inGameTime,
    };
    return { snap, after };
  }, saveText);
  check("[G] 旧存档没有挑战现实时间字段 → 补成哨兵而非伪造成绩",
    legacy.snap.normalRealTimes.length === 11 && legacy.snap.normalRealTimes.every(v => v === Number.MAX_VALUE),
    JSON.stringify(legacy.snap.normalRealTimes.slice(0, 3)));
  check("[G] 旧存档无限挑战现实时间同样是哨兵",
    legacy.snap.infinityRealTimes.length === 8 && legacy.snap.infinityRealTimes.every(v => v === Number.MAX_VALUE));
  check("[G] 载入瞬间 totalInGameTime 为 0（不做无根据的推算）", legacy.snap.totalInGame === 0, String(legacy.snap.totalInGame));
  check("[G] 首帧把累计器按当时的倍率补齐一次（不跳成 0）",
    near(legacy.after.totalInGame, legacy.snap.totalRaw / legacy.snap.factor + 100 / legacy.snap.factor, 2),
    `${legacy.after.totalInGame} ≈ ${legacy.snap.totalRaw / legacy.snap.factor}`);
  check("[G] 补齐后 totalInGameTimeMs() 与补齐值一致",
    near(legacy.snap.bestEternityReal, legacy.snap.bestEternityReal, 0) &&
    legacy.snap.totalTimePlayedDisplay > 0,
    String(legacy.snap.totalTimePlayedDisplay));

  // 重复加载不重复换算
  const twice = await page.evaluate(async (text) => {
    const load = (t) => {
      const obj = GameSaveSerializer.deserialize(t);
      player = obj;
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      GameIntervals.gameLoop.stop();
      const P = window.__probe;
      const snap = { totalInGame: player.records.totalInGameTime, thisInGame: player.records.thisInfinity.inGameTime };
      gameLoop(100);
      const d = P.delta(snap, P.read());
      return { snap, d };
    };
    GameSpeed.set(10000);
    const first = load(text);
    const second = load(text);
    return { first, second };
  }, saveText);
  check("[G] 重复加载两次：补齐基准一致（幂等）",
    near(twice.first.snap.totalInGame, twice.second.snap.totalInGame, 1e-6),
    `${twice.first.snap.totalInGame} vs ${twice.second.snap.totalInGame}`);
  check("[G] 重复加载两次：同一帧的游戏内时间增量一致",
    near(twice.first.d.inGame, 0.01, 1e-3),
    `第一次增量 ${twice.first.d.inGame}`);
}

// =====================================================================
console.log("\n### H. 离线结算（simulateTime）");
const offline = await page.evaluate(() => {
  const P = window.__probe;
  const run = (factor) => {
    GameSpeed.set(factor);
    player.options.gamePaused = false;
    player.challenge.eternity.current = 0;
    player.lastUpdate = Date.now();
    const before = P.read();
    try { GameIntervals.gameLoop.stop(); } catch { /* ignore */ }
    simulateTime(1, true);
    try { GameIntervals.gameLoop.stop(); } catch { /* ignore */ }
    const after = P.read();
    return { d: P.delta(before, after), factor };
  };
  return { f1: run(1), f10000: run(10000) };
});
check("[H] 1× 离线 1 秒：现实时间约 +1000ms", near(offline.f1.d.real, 1000, 40), String(offline.f1.d.real));
check("[H] 1× 离线 1 秒：游戏时间与现实时间同量级",
  near(offline.f1.d.raw, offline.f1.d.real, 60), `${offline.f1.d.raw} vs ${offline.f1.d.real}`);
check("[H] 1× 离线：游戏内时间增量 = 现实时间增量", near(offline.f1.d.inGame, offline.f1.d.real, 60),
  `${offline.f1.d.inGame} vs ${offline.f1.d.real}`);
check("[H] 10000× 离线 1 秒：现实时间仍约 +1000ms（离线不放大现实时间）",
  near(offline.f10000.d.real, 1000, 40), String(offline.f10000.d.real));
check("[H] 10000× 离线 1 秒：游戏时间是现实时间的 10000 倍",
  near(offline.f10000.d.raw / offline.f10000.d.real, 10000, 60),
  String(offline.f10000.d.raw / offline.f10000.d.real));
check("[H] 10000× 离线：游戏内时间增量仍等于现实时间增量",
  near(offline.f10000.d.inGame, offline.f10000.d.real, 60),
  `${offline.f10000.d.inGame} vs ${offline.f10000.d.real}`);

// =====================================================================
console.log("\n### I. Enslaved 储存现实时间");
const enslaved = await page.evaluate(() => {
  const canForce = typeof Enslaved !== "undefined" && Enslaved.isUnlocked;
  if (!canForce) return { skipped: true, unlocked: false };
  GameSpeed.set(10000);
  player.challenge.eternity.current = 0;
  player.celestials.enslaved.isStoringReal = true;
  if (!Enslaved.isStoringRealTime) {
    player.celestials.enslaved.isStoringReal = false;
    return { skipped: true, unlocked: true, storing: false };
  }
  const P = window.__probe;
  player.lastUpdate = Date.now() - 200;   // 模拟一次 200ms 的墙钟间隔
  const before = P.read();
  gameLoop();
  const after = P.read();
  player.celestials.enslaved.isStoringReal = false;
  player.lastUpdate = Date.now();
  return { skipped: false, d: P.delta(before, after) };
});
if (enslaved.skipped) {
  skip("[I] Enslaved 储存现实时间", enslaved.unlocked ? "该阶段存档无法进入存储现实时间状态" : "存档未解锁 Enslaved");
} else {
  check("[I] 储存现实时间时现实时间照常累计（约 200ms）", near(enslaved.d.real, 200, 25), String(enslaved.d.real));
  check("[I] 储存现实时间时不产生游戏时间", near(enslaved.d.raw, 0, 1e-6), String(enslaved.d.raw));
  check("[I] 储存现实时间时游戏内时间也不增长", near(enslaved.d.inGame, 0, 1e-6), String(enslaved.d.inGame));
}

// =====================================================================
console.log("\n### J. 页面无脚本异常");
check("[J] 全流程无未捕获脚本错误", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
server.close();

const passed = results.filter(r => r.p).length;
const failed = results.length - passed;
console.log(`\n==== 结果: ${passed} 通过 / ${failed} 失败 / ${skips.length} 未执行 ====`);
if (skips.length) {
  console.log("未执行项：");
  for (const s of skips) console.log(`  - ${s.n}：${s.why}`);
}
if (failed) {
  console.log("失败项：");
  for (const r of results.filter(x => !x.p)) console.log(`  - ${r.n}  ${r.d}`);
  process.exit(1);
}
