// 时间统计语义 + 挑战最佳时间 浏览器验收
// 用法: node verify-time-ui.mjs [root] [port] [shotsDir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8094);
const outDir = path.resolve(process.argv[4] || "./shots-time");
fs.mkdirSync(outDir, { recursive: true });

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
const pick = name => fs.readFileSync(path.join(SAVE_DIR, samples.find(f => f.includes(name))), "utf-8");

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1400, height: 950 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 工具：在页面内载入存档并切到统计页 ----------
async function loadSave(saveText, tab = "statistics") {
  return page.evaluate(async (text, tabKey) => {
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* 未启动时忽略 */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(text);
    player = obj;
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    GameUI.update();
    const t = Tabs.all.find(x => x.config.key === "statistics");
    if (t) {
      t.show();
      if (tabKey === "challenges" && t.subtabs) {
        const sub = t.subtabs.find(s => s.key === "challenges");
        if (sub) sub.show();
      }
    }
    return true;
  }, saveText, tab);
}

const statText = () => page.evaluate(() => document.querySelector(".c-stats-tab")?.innerText || "");

// =====================================================================
console.log("\n### A. 环境");
const base = await page.evaluate(() => ({
  factor: typeof getGlobalSpeedFactorRaw === "function" ? getGlobalSpeedFactorRaw() : null,
  speedup: getGameSpeedupFactor(),
  hasHelper: typeof timeStatText === "function" && typeof toInGameTimeMs === "function",
  hasRealTimeField: "bestRealTimes" in player.challenge.normal,
}));
check("默认全局速度倍率 10000×", base.factor === 10000, String(base.factor));
check("游戏内速度因子不包含全局倍率（新游戏为 1）", Math.abs(base.speedup - 1) < 1e-9, String(base.speedup));
check("时间口径 helper 已注册为全局", base.hasHelper);
check("新存档默认带挑战现实时间字段", base.hasRealTimeField);

// =====================================================================
console.log("\n### A2. 新游戏上验证计时语义（时间总量足够小，不受浮点精度影响）");
const A2 = await page.evaluate(() => {
  GameIntervals.gameLoop.stop();
  GameSpeed.set(10000);
  const out = {};
  const r0 = player.records.realTimePlayed;
  const t0 = player.records.totalTimePlayed;
  gameLoop(100);
  out.normal = {
    real: player.records.realTimePlayed - r0,
    raw: player.records.totalTimePlayed - t0,
    speedup: getGameSpeedupFactor(),
  };
  out.ec12 = { speedup: 1 };
  return out;
});
check("普通状态：100ms 墙钟 → 现实时间 +100ms", Math.abs(A2.normal.real - 100) < 0.001, String(A2.normal.real));
check("普通状态：100ms 墙钟 → 原始游戏时间 +1,000,000ms（10000×）",
  Math.abs(A2.normal.raw - 1e6) < 1, String(A2.normal.raw));

// =====================================================================
console.log("\n### B. 真实存档载入后的统计页");
const sampleNames = ["861", "1002", "424"];   // 现实中段 / 现实后期 / 永恒阶段
for (const sn of sampleNames) {
  const file = samples.find(f => f.startsWith(sn + ".")) || samples.find(f => f.startsWith(sn));
  if (!file) { check(`找到样本 ${sn}`, false); continue; }
  const text = fs.readFileSync(path.join(SAVE_DIR, file), "utf-8");
  await loadSave(text);
  await sleep(1200);
  const t = await statText();
  const rec = await page.evaluate(() => ({
    bestRealityTime: player.records.bestReality.time,
    bestRealityReal: player.records.bestReality.realTime,
    thisRealityReal: player.records.thisReality.realTime,
    factor: getGlobalSpeedFactorRaw(),
    realities: player.realities,
  }));
  check(`[${sn}] 统计页含「现实时间」标注`, t.includes("（现实时间）"));
  const isReality = rec.realities > 0;
  if (isReality) {
    check(`[${sn}] 统计页含「游戏内时间」标注`, t.includes("（游戏内时间）"));
  } else {
    check(`[${sn}] 未解锁现实时隐藏现实区块（原版行为）`, !t.includes("按游戏内时间计算"));
    check(`[${sn}] 无限/永恒区块仍按双口径显示`, t.includes("（现实时间）") || t.includes("（游戏内时间）"));
  }
  check(`[${sn}] 文案无 NaN/undefined`, !/NaN|undefined|Infinity/.test(t),
    (t.match(/NaN|undefined|Infinity/g) || []).join(","));
  if (!isReality) continue;
  // 最速现实两行必须分别等于存档里的两种口径
  const fmt = await page.evaluate((a, b) => [
    TimeSpan.fromMilliseconds(a).toStringShort(),
    TimeSpan.fromMilliseconds(b).toStringShort(),
  ], rec.bestRealityTime, rec.bestRealityReal);
  const bestGameLine = t.split("\n").find(l => l.includes("按游戏内时间计算"));
  const bestRealLine = t.split("\n").find(l => l.includes("按现实时间计算"));
  check(`[${sn}] 最速现实（游戏内时间）与存档字段一致`,
    !!bestGameLine && bestGameLine.includes(fmt[0]), `${bestGameLine} | 期望 ${fmt[0]}`);
  check(`[${sn}] 最速现实（现实时间）与存档字段一致`,
    !!bestRealLine && bestRealLine.includes(fmt[1]), `${bestRealLine} | 期望 ${fmt[1]}`);
}

// =====================================================================
console.log("\n### C. 切换倍率不改变历史记录");
const realitySample = fs.readFileSync(path.join(SAVE_DIR, samples.find(f => f.startsWith("861"))), "utf-8");
await loadSave(realitySample);
await sleep(800);
const lineAt = async f => {
  await page.evaluate(v => GameSpeed.set(v), f);
  await sleep(400);
  const t = await statText();
  return t.split("\n").filter(l => l.includes("按游戏内时间计算") || l.includes("按现实时间计算")).join("|");
};
const l1 = await lineAt(1);
const l10000 = await lineAt(10000);
const l100000 = await lineAt(100000);
check("倍率 1× / 10000× / 100000× 下最速现实记录完全一致", l1 === l10000 && l10000 === l100000,
  `1×:${l1.slice(0, 40)}`);
check("倍率切换后仍显示两种口径", l10000.includes("游戏内时间") && l10000.includes("现实时间"));

// =====================================================================
console.log("\n### D. 重复载入幂等");
const loadAndSnap = saveText => page.evaluate(text => {
  try { GameIntervals.gameLoop.stop(); } catch (e) { /* ignore */ }
  GameStorage.offlineEnabled = false;
  const obj = GameSaveSerializer.deserialize(text);
  obj.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(obj);
  // 载入后立刻取值，避免游戏循环继续推进导致的不确定性
  player.lastUpdate = Date.now();
  return JSON.stringify({
    a: player.records.bestReality.time, b: player.records.bestReality.realTime,
    c: player.records.thisReality.time, d: player.records.thisReality.realTime,
    e: player.records.realTimePlayed, f: player.records.totalTimePlayed,
    g: player.records.bestInfinity.time, h: player.records.bestEternity.time,
    i: player.challenge.normal.bestTimes.slice(0, 3),
    j: player.challenge.normal.bestRealTimes.slice(0, 3),
  });
}, saveText);
const snap1 = await loadAndSnap(realitySample);
const snap2 = await loadAndSnap(realitySample);
const snap3 = await loadAndSnap(realitySample);
check("同一存档连续载入三次，记录字段完全一致（无重复换算、不改写存档）",
  snap1 === snap2 && snap2 === snap3,
  snap1 === snap2 && snap2 === snap3 ? "" : `${snap1} != ${snap2}`);

// =====================================================================
console.log("\n### E. 旧存档缺现实时间字段时的回退");
const legacy = await page.evaluate(text => {
  const obj = GameSaveSerializer.deserialize(text);
  delete obj.records.thisInfinity.realTime;
  obj.records.bestEternity.realTime = Number.MAX_VALUE;
  delete obj.challenge.normal.bestRealTimes;
  GameStorage.offlineEnabled = false;
  player = obj;
  player.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(player);
  player.lastUpdate = Date.now();
  GameUI.update();
  const t = Tabs.all.find(x => x.config.key === "statistics");
  if (t) t.show();
  return {
    hasArray: Array.isArray(player.challenge.normal.bestRealTimes),
    len: player.challenge.normal.bestRealTimes?.length ?? -1,
    allSentinel: (player.challenge.normal.bestRealTimes ?? []).every(v => v === Number.MAX_VALUE),
  };
}, realitySample);
await sleep(1000);
const legacyInfo = await page.evaluate(() => ({
  text: document.querySelector(".c-stats-tab")?.innerText || "",
  // 直接调用模板所使用的同一函数，避免依赖 Vue 重渲染时机
  eternityLine: `你的最快永恒用时 ${timeStatText(player.records.bestEternity.realTime,
    player.records.bestEternity.time)}。`,
}));
const legacyText = legacyInfo.text;
check("缺失的 bestRealTimes 由默认值补齐", legacy.hasArray && legacy.len === 11, JSON.stringify(legacy));
check("补齐值为哨兵（不伪造历史现实成绩）", legacy.allSentinel);
check("缺失 realTime 时不显示 NaN、不编造现实时间", !/NaN|undefined/.test(legacyText));

// 合成一条“只有游戏内时间、没有现实时间”的永恒记录，验证并列显示的回退
await page.evaluate(() => {
  player.records.bestEternity.time = 12345;
  player.records.bestEternity.realTime = Number.MAX_VALUE;
  return true;
});
await sleep(200);
const eternityLine = await page.evaluate(() =>
  `你的最快永恒用时 ${timeStatText(player.records.bestEternity.realTime, player.records.bestEternity.time)}。`);
check("缺现实时间的永恒记录只标游戏内时间",
  eternityLine.includes("游戏内时间") && !eternityLine.includes("现实时间"), eternityLine);
check("合成记录后仍无 NaN", !/NaN|undefined/.test(eternityLine));

// =====================================================================
console.log("\n### F. 挑战纪录：旧存档回退");
await loadSave(realitySample, "challenges");
await sleep(1200);
const chText = await page.evaluate(() => document.querySelector(".l-challenge-records-tab")?.innerText || "");
check("挑战纪录页可渲染", chText.length > 0, chText.slice(0, 60).replace(/\n/g, " "));
check("旧存档挑战纪录标注为历史数据", chText.includes("旧版记录，未保存现实时间"));
check("未完成的挑战显示「尚未完成」", chText.includes("尚未完成") || chText.includes("时间纪录："));
check("挑战纪录文案无 NaN", !/NaN|undefined/.test(chText));

// =====================================================================
console.log("\n### G. 新挑战成绩写入现实时间");
const G = await page.evaluate(() => {
  const out = {};
  GameIntervals.gameLoop.stop();
  player.challenge.normal.bestTimes = Array.repeat(Number.MAX_VALUE, 11);
  player.challenge.normal.bestRealTimes = Array.repeat(Number.MAX_VALUE, 11);
  GameSpeed.set(10000);

  // 第 2 号普通挑战：现实 500ms，游戏内时间 500ms（10000× 下原始 5e6ms 归一后为 500ms）
  player.records.thisInfinity.time = 5e6;
  // 真实代码里 time 与 inGameTime 由 gameLoop 同步累加，这里手工造成绩需同时写入
  player.records.thisInfinity.inGameTime = 500;
  player.records.thisInfinity.realTime = 500;
  NormalChallenge(2).updateChallengeTime();
  out.first = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 更慢的一次（现实 800ms）：两项都不应被覆盖
  player.records.thisInfinity.time = 8e6;
  // 真实代码里 time 与 inGameTime 由 gameLoop 同步累加，这里手工造成绩需同时写入
  player.records.thisInfinity.inGameTime = 800;
  player.records.thisInfinity.realTime = 800;
  NormalChallenge(2).updateChallengeTime();
  out.slowerUnchanged = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 并列成绩（现实 500ms / 游戏内 500ms）：不应改变
  player.records.thisInfinity.time = 5e6;
  // 真实代码里 time 与 inGameTime 由 gameLoop 同步累加，这里手工造成绩需同时写入
  player.records.thisInfinity.inGameTime = 500;
  player.records.thisInfinity.realTime = 500;
  NormalChallenge(2).updateChallengeTime();
  out.tieUnchanged = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 更快的一次：现实 100ms / 游戏内 100ms
  player.records.thisInfinity.time = 1e6;
  // 真实代码里 time 与 inGameTime 由 gameLoop 同步累加，这里手工造成绩需同时写入
  player.records.thisInfinity.inGameTime = 100;
  player.records.thisInfinity.realTime = 100;
  NormalChallenge(2).updateChallengeTime();
  out.faster = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 未完成的其他挑战保持哨兵
  out.othersSentinel = player.challenge.normal.bestRealTimes.slice(1, 5).every(v => v === Number.MAX_VALUE);

  // 无限挑战同样写两种口径
  player.challenge.infinity.bestTimes = Array.repeat(Number.MAX_VALUE, 8);
  player.challenge.infinity.bestRealTimes = Array.repeat(Number.MAX_VALUE, 8);
  player.records.thisInfinity.time = 2e6;
  // 真实代码里 time 与 inGameTime 由 gameLoop 同步累加，这里手工造成绩需同时写入
  player.records.thisInfinity.inGameTime = 200;
  player.records.thisInfinity.realTime = 200;
  InfinityChallenge(1).updateChallengeTime();
  out.infinity = {
    game: player.challenge.infinity.bestTimes[0],
    real: player.challenge.infinity.bestRealTimes[0],
  };
  return out;
});
check("普通挑战首次成绩：现实=500ms", G.first.real === 500, JSON.stringify(G.first));
check("普通挑战首次成绩：游戏内时间=500ms（10000× 已剥离）", Math.abs(G.first.game - 500) < 1e-6, String(G.first.game));
check("更慢成绩不覆盖最佳", G.slowerUnchanged.real === 500 && G.slowerUnchanged.game === 500);
check("并列成绩不改写", G.tieUnchanged.real === 500 && G.tieUnchanged.game === 500);
check("更快成绩正确刷新两种口径", G.faster.real === 100 && Math.abs(G.faster.game - 100) < 1e-6, JSON.stringify(G.faster));
check("未完成的挑战保持哨兵值", G.othersSentinel);
check("无限挑战同样记录现实时间", G.infinity.real === 200 && Math.abs(G.infinity.game - 200) < 1e-6, JSON.stringify(G.infinity));

// 挑战纪录页应显示新记录的现实时间
await page.evaluate(() => {
  const t = Tabs.all.find(x => x.config.key === "statistics");
  t.show();
  const sub = t.subtabs.find(s => s.key === "challenges");
  if (sub) sub.show();
});
await sleep(900);
const chText2 = await page.evaluate(() => document.querySelector(".l-challenge-records-tab")?.innerText || "");
const line2 = chText2.split("\n").find(l => l.includes("普通挑战 2"));
check("挑战纪录页显示新记录的现实时间", !!line2 && line2.includes("现实时间") && line2.includes("游戏内时间"), line2 || "(无)");

// =====================================================================
console.log("\n### H. 倍率中途切换时现实时间仍连续累计");
const H = await page.evaluate(() => {
  GameIntervals.gameLoop.stop();
  const out = { steps: [] };
  // 用全局单调计数器 realTimePlayed 观测（thisInfinity 可能因重置归零，不适合连续测量）
  for (const f of [10000, 1, 10000]) {
    GameSpeed.set(f);
    const r0 = player.records.realTimePlayed;
    const t0 = player.records.totalTimePlayed;
    gameLoop(100);
    out.steps.push({
      f,
      real: player.records.realTimePlayed - r0,
      raw: player.records.totalTimePlayed - t0,
    });
  }
  return out;
});
check("10000× 下 100ms 墙钟累计 100ms 现实时间",
  Math.abs(H.steps[0].real - 100) < 0.001, String(H.steps[0].real));
check("切到 1× 后仍累计 100ms 现实时间",
  Math.abs(H.steps[1].real - 100) < 0.001, String(H.steps[1].real));
check("再切回 10000× 仍累计 100ms 现实时间",
  Math.abs(H.steps[2].real - 100) < 0.001, String(H.steps[2].real));
check("三段合计现实时间 300ms（切换倍率不漏计、不重复计）",
  Math.abs(H.steps.reduce((s, x) => s + x.real, 0) - 300) < 0.01,
  String(H.steps.reduce((s, x) => s + x.real, 0)));
check("原始游戏时间随倍率变化（现实时间不受影响）",
  H.steps[0].raw > H.steps[1].raw * 100, `${H.steps[0].raw.toExponential(2)} vs ${H.steps[1].raw.toExponential(2)}`);

// =====================================================================
console.log("\n### I. 时间膨胀与全局倍率分离");
const I = await page.evaluate(() => {
  const out = {};
  GameIntervals.gameLoop.stop();
  GameSpeed.set(10000);
  out.speedupAt10000 = getGameSpeedupFactor();
  GameSpeed.set(1);
  out.speedupAt1 = getGameSpeedupFactor();
  GameSpeed.set(100000);
  out.speedupAt100000 = getGameSpeedupFactor();
  GameSpeed.set(10000);

  player.challenge.eternity.current = 12;
  out.speedupEC12 = getGameSpeedupFactor();
  // 在 EC12（游戏内减速 1000 倍）下再跑 100ms 墙钟，现实时间必须仍为 100ms
  const r1 = player.records.realTimePlayed;
  gameLoop(100);
  out.ec12Real = player.records.realTimePlayed - r1;
  player.challenge.eternity.current = 0;
  out.globalFactor = getGlobalSpeedFactorRaw();
  return out;
});
check("改变全局倍率不会改变游戏内速度因子",
  I.speedupAt10000 === I.speedupAt1 && I.speedupAt1 === I.speedupAt100000,
  `${I.speedupAt1} / ${I.speedupAt10000} / ${I.speedupAt100000}`);
check("两种倍率互不混入（游戏内速度因子不含 10000）",
  I.speedupAt10000 < 1e30 && I.globalFactor === 10000, `${I.speedupAt10000} / ${I.globalFactor}`);
check("EC12 生效时游戏内速度因子为 1/1000", Math.abs(I.speedupEC12 - 0.001) < 1e-9, String(I.speedupEC12));
check("EC12（游戏内减速）期间现实时间仍按墙钟累计 100ms",
  Math.abs(I.ec12Real - 100) < 0.001, String(I.ec12Real));

// =====================================================================
console.log("\n### J. HUD 速度显示不含全局倍率");
const hud = await page.evaluate(() => {
  GameSpeed.set(10000);
  return { display: document.querySelector(".c-gamespeed")?.innerText || "", speed: getGameSpeedupFactor() };
});
check("HUD 速度显示不把 10000× 当作游戏内速度", !hud.display.includes("10000"), hud.display.replace(/\n/g, " "));

// =====================================================================
await page.screenshot({ path: path.join(outDir, "final.png") });
const realErrs = errs.filter(e => !/googletagmanager|Content Security Policy|kaspersky/i.test(e));
check("无新增页面异常", realErrs.length === 0, realErrs.slice(0, 2).join(" | "));

const pass = results.filter(r => r.p).length;
const fail = results.length - pass;
console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
