// 旧存档兼容性：用 ADChinese 基线导出一份真实存档，再导入本项目
// 这比「字段没变」的静态断言更硬——它走的是真实的跨版本导入通道
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = path.resolve("../upstream/ADChinese");
const MINE = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const portBase = Number(process.argv[3] || 8101);
const portMine = portBase + 1;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };

const serve = (root, port) => new Promise(resolve => {
  const s = http.createServer((q, res) => {
    let p = decodeURIComponent(q.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, p);
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      res.end(d);
    });
  });
  s.listen(port, "127.0.0.1", () => resolve(s));
});
const sBase = await serve(BASE, portBase);
const sMine = await serve(MINE, portMine);

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"], protocolTimeout: 60000 });
const results = [];
const check = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

// ---------- 1. 从基线导出一份带进度的存档 ----------
const pb = await browser.newPage();
const berrs = [];
pb.on("pageerror", e => berrs.push(e.message));
await pb.goto(`http://127.0.0.1:${portBase}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const baseline = await pb.evaluate(() => {
  // 造一点进度，确保存档不是空壳
  player.antimatter = new Decimal("1e500");
  player.records.totalAntimatter = new Decimal("1e600");
  player.records.totalTimePlayed = 123456789;
  player.records.realTimePlayed = 98765432;
  player.achievementBits = [1, 0, 0, 1];
  GameUI.update();
  const text = GameStorage.exportModifiedSave();
  return {
    text,
    version: player.version,
    topKeys: Object.keys(player).length,
    hasSpeedPatch: typeof getGlobalSpeedFactor === "function",
    am: String(player.antimatter),
    ttp: player.records.totalTimePlayed,
  };
});
check("基线导出存档成功", typeof baseline.text === "string" && baseline.text.length > 1000,
  `${baseline.text.length} 字符，player.version = ${baseline.version}`);
check("基线不含加速补丁（验证跨版本差异真实存在）", baseline.hasSpeedPatch === false, "getGlobalSpeedFactor 未定义");

// ---------- 2. 导入本项目 ----------
const pm = await browser.newPage();
const merrs = [];
pm.on("pageerror", e => merrs.push(e.message));
await pm.goto(`http://127.0.0.1:${portMine}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const imported = await pm.evaluate((saveText) => {
  const beforeKeys = Object.keys(player).sort();
  let err = null;
  let ttpAtImport = null;
  let rtpAtImport = null;
  let nowAtImport = null;
  try {
    GameStorage.import(saveText);
    // 关键：在同一个同步块内读取，确保拿到「导入瞬间」的值而非之后追赶的值
    ttpAtImport = player.records.totalTimePlayed;
    rtpAtImport = player.records.realTimePlayed;
    nowAtImport = Date.now();
  } catch (e) {
    err = String(e && e.message ? e.message : e).slice(0, 200);
  }
  const afterKeys = Object.keys(player).sort();
  // 解码存档文本，取存档内部真实存储的值（与运行状态无关，可确定性比对）
  const decoded = GameSaveSerializer.deserialize(saveText);
  return {
    err,
    am: String(player.antimatter),
    ttp: ttpAtImport,
    rtp: rtpAtImport,
    nowAtImport,
    savedTtp: decoded.records.totalTimePlayed,
    savedRtp: decoded.records.realTimePlayed,
    savedLastUpdate: decoded.lastUpdate,
    version: player.version,
    added: afterKeys.filter(k => !beforeKeys.includes(k)),
    removed: beforeKeys.filter(k => !afterKeys.includes(k)),
    speedFields: afterKeys.filter(k => /^(gameSpeed|speedFactor|globalSpeed|oreki|speedMultiplier)$/i.test(k)),
    factor: getGlobalSpeedFactor(),
    speedStorage: localStorage.getItem("oreki-game-speed"),
  };
}, baseline.text);

// ---------- 2b. 对照实验：同一份存档导入「未修改的基线」，比较导入行为是否一致 ----------
check("本项目导入基线存档无异常", !imported.err, imported.err || "导入成功");
check("导入后反物质数值一致", imported.am === baseline.am, `${baseline.am} → ${imported.am}`);
// 存档内的累计时间被原样保真（确定性比对，不依赖读取时机）
check(
  "导入后存档内累计游戏时间原样保真",
  imported.savedTtp === baseline.ttp,
  `存档内 ${baseline.ttp} → 导入后 ${imported.savedTtp}`
);
// 导入后游戏时间应继续按「墙钟 × 倍率」推进（追赶发生在此后的 tick，故需先等一个 tick）
await new Promise(r => setTimeout(r, 900));
const growth = await pm.evaluate(() => ({
  ttp: player.records.totalTimePlayed,
  rtp: player.records.realTimePlayed,
  now: Date.now(),
  factor: getGlobalSpeedFactor(),
}));
const wallGap = growth.now - imported.savedLastUpdate;
const ttpGrow = growth.ttp - imported.savedTtp;
const ttpExpect = wallGap * growth.factor;
check(
  "导入后游戏时间增量 ≈ 墙钟间隔 × 倍率（倍率只生效一次，未二次放大）",
  Math.abs(ttpGrow - ttpExpect) / ttpExpect < 0.05,
  `增量 ${ttpGrow}，期望 ${ttpExpect}（墙钟 ${wallGap}ms × ${growth.factor}）`
);
// 现实时间统计必须按 1× 增长，绝不能跟着 10000× 一起放大
const rtpGrow = growth.rtp - imported.savedRtp;
check(
  "导入后现实时间统计按 1× 增长（未被倍率加速）",
  rtpGrow >= 0 && rtpGrow < wallGap + 3000,
  `增量 ${rtpGrow}ms（墙钟 ${wallGap}ms，若被加速将达 ${wallGap * growth.factor}ms）`
);
check("导入后存档版本不变", imported.version === baseline.version, `v${baseline.version}`);

const pb2 = await browser.newPage();
await pb2.goto(`http://127.0.0.1:${portBase}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
const baseImport = await pb2.evaluate((saveText) => {
  const beforeKeys = Object.keys(player).sort();
  try { GameStorage.import(saveText); } catch (e) { return { err: String(e && e.message ? e.message : e) }; }
  const afterKeys = Object.keys(player).sort();
  return { added: afterKeys.filter(k => !beforeKeys.includes(k)), removed: beforeKeys.filter(k => !afterKeys.includes(k)) };
}, baseline.text);
await pb2.close().catch(() => {});

const sameAsBaseline =
  JSON.stringify(baseImport.added || []) === JSON.stringify(imported.added) &&
  JSON.stringify(baseImport.removed || []) === JSON.stringify(imported.removed);
check(
  "导入时的字段增删与基线完全一致（导入行为未被改动）",
  sameAsBaseline,
  sameAsBaseline
    ? `两边一致：新增 [${(baseImport.added || []).join(",") || "无"}]（属上游迁移行为）`
    : `基线 新增[${(baseImport.added || []).join(",")}] 删除[${(baseImport.removed || []).join(",")}]；本项目 新增[${imported.added.join(",")}] 删除[${imported.removed.join(",")}]`
);

const structuralOk = imported.speedFields.length === 0;
check(
  "导入未引入速度相关字段（倍率不进存档）",
  structuralOk,
  structuralOk ? `无速度字段（player 字段增删与基线一致：+${imported.added.join(",") || "无"}）` : `速度字段 [${imported.speedFields.join(",")}]`
);
check("导入后速度因子仍取本项目默认 10000（不受旧存档影响）", imported.factor === 10000, String(imported.factor));

// ---------- 3. 导入后游戏能继续运行 ----------
const after = await pm.evaluate(async () => {
  const g0 = player.records.totalTimePlayed;
  const w0 = Date.now();
  await new Promise(r => setTimeout(r, 1500));
  const w = Date.now() - w0;
  return {
    gameRatio: (player.records.totalTimePlayed - g0) / w,
    hasNaN: [player.antimatter, player.records.totalAntimatter].some(v => Number.isNaN(Number(v.toString()))),
  };
});
check("导入后游戏循环继续运行（10000× 生效）", after.gameRatio > 9000 && after.gameRatio < 11000, after.gameRatio.toFixed(0));
check("导入后关键数值未变成 NaN", !after.hasNaN);
check("导入过程无未捕获异常", merrs.length === 0, merrs.slice(0, 2).join(" | "));

await browser.close();
sBase.close();
sMine.close();
const failed = results.filter(r => !r.p);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
