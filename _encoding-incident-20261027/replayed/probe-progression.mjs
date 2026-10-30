// 推进速度探针（只读测量，不改任何机制）
//
// 目的：回答「某个倍率变大，是否真的缩短了现实通关时间」。
// 方法：同一份存档、同一段固定墙钟（用固定 passDiff 手动驱动，排除真实计时抖动），
//       比较 F=1 / 10 / 1000 / 10000 下的
//         - 游戏时间推进量（游戏时钟）
//         - 关键资源增量（AM / IP / EP / RM）
//         - 单位游戏时间产出（效率，应基本不随 F 变化）
//       由此区分「时钟被压缩」与「效率被提高」。
//
// 用法: node probe-progression.mjs [存档名] [root] [port]
//   例: node probe-progression.mjs 132._9.1e137IP
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const SAVE_NAME = process.argv[2] || "132._9.1e137IP";
const root = path.resolve(process.argv[3] || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition");
const port = Number(process.argv[4] || 8240);

const files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const saveFile = files.find(f => f.replace(/\.txt$/, "") === SAVE_NAME) || files.find(f => f.includes(SAVE_NAME));
if (!saveFile) {
  console.error(`找不到存档样本: ${SAVE_NAME}`);
  process.exit(2);
}
const saveText = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");

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
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

console.log(`\n存档样本: ${saveFile}`);
console.log("测量方式: 固定 60 帧 × 20ms 墙钟（手动驱动 gameLoop，排除真实计时抖动）\n");

const F_LIST = [1, 10, 1000, 10000];
const FRAMES = 60;
const WALL_MS = 20;

const rows = [];
for (const F of F_LIST) {
  const r = await page.evaluate(async (text, F, frames, wallMs) => {
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(text);
    player = obj;
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameSpeed.set(F);

    const lg = v => {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    };
    const read = () => ({
      game: player.records.totalTimePlayed,
      real: player.records.realTimePlayed,
      am: lg(Currency.antimatter.value),
      ip: lg(Currency.infinityPoints.value),
      ep: lg(Currency.eternityPoints.value),
      rm: lg(Currency.realityMachines.value),
      // 离散机制的直接计数：无限/永恒次数（自动购买器每触发一次 +1 左右）
      inf: Currency.infinities.value.toNumber ? Currency.infinities.value.toNumber() : Number(Currency.infinities.value),
      eter: Currency.eternities.value.toNumber ? Currency.eternities.value.toNumber() : Number(Currency.eternities.value),
      speedup: getGameSpeedupFactor(),
    });
    const before = read();
    for (let i = 0; i < frames; i++) gameLoop(wallMs);
    const after = read();
    const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? a - b : NaN;
    // 复原倍率，避免影响后续循环
    GameSpeed.set(1);
    return {
      F,
      eff: before.speedup,
      dGame: d(after.game, before.game),
      dReal: d(after.real, before.real),
      dAm: d(after.am, before.am),
      dIp: d(after.ip, before.ip),
      dEp: d(after.ep, before.ep),
      dRm: d(after.rm, before.rm),
      dInf: d(after.inf, before.inf),
      dEter: d(after.eter, before.eter),
    };
  }, saveText, F, FRAMES, WALL_MS);
  rows.push(r);
  process.stdout.write(`  F=${String(F).padStart(6)} 完成\n`);
}

const wallTotal = FRAMES * WALL_MS;
const fmt = (v, d = 3) => Number.isFinite(v) ? v.toExponential(d) : "—";
console.log("\n=== 结果 ===");
console.log("     F  游戏内膨胀    Δ游戏时间(ms)  Δ现实(ms)  游戏时间/墙钟   Δlog10(AM)  Δlog10(IP)  Δlog10(EP)");
for (const x of rows) {
  console.log(`  ${String(x.F).padStart(6)} ${fmt(x.eff, 2).padStart(10)}  ${fmt(x.dGame).padStart(13)}  ${(Number.isFinite(x.dReal) ? x.dReal.toFixed(0) : "—").padStart(8)}  ${fmt(x.dGame / wallTotal).padStart(12)}  ${fmt(x.dAm, 2).padStart(10)}  ${fmt(x.dIp, 2).padStart(10)}  ${fmt(x.dEp, 2).padStart(10)}`);
}

const base = rows[0];
console.log("\n=== 相对 F=1 的倍数 ===");
console.log("     F   游戏时间倍率   现实时间倍率   AM 增量倍率   IP 增量倍率");
for (const x of rows) {
  const gr = x.dGame / base.dGame;
  const rr = x.dReal / (base.dReal || 1);
  const ar = base.dAm === 0 ? NaN : x.dAm / base.dAm;
  const ir = base.dIp === 0 ? NaN : x.dIp / base.dIp;
  console.log(`  ${String(x.F).padStart(6)} ${fmt(gr).padStart(13)} ${fmt(rr).padStart(13)} ${fmt(ar).padStart(13)} ${fmt(ir).padStart(13)}`);
}

console.log("\n=== 效率分解（每 1 个游戏小时）===");
console.log("     F    AM/游戏小时   IP/游戏小时   EP/游戏小时   无限次数/游戏小时   永恒次数/游戏小时");
for (const x of rows) {
  const hours = x.dGame / 3600000;
  const per = v => (Number.isFinite(v) && hours > 0) ? v / hours : NaN;
  console.log(`  ${String(x.F).padStart(6)} ${fmt(per(x.dAm), 2).padStart(13)} ${fmt(per(x.dIp), 2).padStart(13)} ${fmt(per(x.dEp), 2).padStart(13)} ${fmt(per(x.dInf), 2).padStart(19)} ${fmt(per(x.dEter), 2).padStart(19)}`);
}

console.log("\n=== 判读 ===");
console.log("  · 「游戏时间倍率 ≈ F」而「现实时间倍率 ≈ 1」→ F 确实压缩了时钟，且没有放大现实时间。");
console.log("  · 「无限次数/游戏小时」是离散机制（自动购买器/重置触发）的频率检验：");
console.log("    该值若不随 F 变化，说明自动化没有因为高倍率而掉队；");
console.log("    若它按 1/F 下降，说明自动化成了瓶颈（提高 F 的边际收益会被吃掉）。");
console.log("  · Δlog10(资源)/游戏小时 只在**同一个游戏时间窗口**之间可比；不同 F 推进的游戏时间长度不同，");
console.log("    该比值天然不可比，不能据此判断效率高低。");
console.log("  · 真正缩短通关时间的两条杠杆：①提高 F（压缩时钟）②提高单位游戏时间效率（倍率/成本改动）。");

// —— 追加实验：自动购买器间隔按 F 缩放后，效率是否回到 F=1 水平 ——
// 只在测试内存里改 player 数据，不改代码。
const scaled = await page.evaluate(async (text, F, frames, wallMs, baseRate) => {
  const run = (scaleIntervals) => {
    GameIntervals.all.forEach(i => i.stop());
    GameStorage.offlineEnabled = false;
    player = GameSaveSerializer.deserialize(text);
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    GameIntervals.all.forEach(i => i.stop());
    GameSpeed.set(F);
    if (scaleIntervals) {
      const visit = o => {
        if (!o) return;
        if (Array.isArray(o)) { o.forEach(visit); return; }
        if (o.data && typeof o.data.interval === "number") {
          o.data.interval = Math.max(1, o.data.interval / F);
        }
      };
      visit(Autobuyers.all);
    }
    const lg = v => {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    };
    const g0 = player.records.totalTimePlayed;
    const ip0 = lg(Currency.infinityPoints.value);
    for (let i = 0; i < frames; i++) gameLoop(wallMs);
    const g1 = player.records.totalTimePlayed;
    const ip1 = lg(Currency.infinityPoints.value);
    GameSpeed.set(1);
    return { dGame: g1 - g0, dIp: Number.isFinite(ip1 - ip0) ? ip1 - ip0 : NaN };
  };
  const plain = run(false);
  const fixed = run(true);
  const rate = r => r.dIp / (r.dGame / 3600000);
  return {
    F,
    plainRate: rate(plain), fixedRate: rate(fixed),
    plainIp: plain.dIp, fixedIp: fixed.dIp,
    baseRate,
  };
}, saveText, 10000, FRAMES, WALL_MS, (rows[0].dIp / (rows[0].dGame / 3600000)));

console.log("\n=== 瓶颈对照：F=10000 时把自动购买器间隔按 F 缩短（仅改内存数据）===");
const fmt2 = v => Number.isFinite(v) ? v.toExponential(2) : "—";
console.log(`  F=1     每游戏小时 Δlog10(IP) = ${fmt2(scaled.baseRate)}`);
console.log(`  F=10000 原样              = ${fmt2(scaled.plainRate)}（相对 F=1 效率 ${fmt2(scaled.plainRate / scaled.baseRate)}）`);
console.log(`  F=10000 间隔/F            = ${fmt2(scaled.fixedRate)}（相对 F=1 效率 ${fmt2(scaled.fixedRate / scaled.baseRate)}）`);
console.log(`  → 单窗口 IP 增量：原样 ${fmt2(scaled.plainIp)} vs 间隔/F ${fmt2(scaled.fixedIp)}`);

await browser.close();
server.close();
