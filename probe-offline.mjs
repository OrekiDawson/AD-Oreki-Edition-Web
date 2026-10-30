// 离线结算探针（只读测量，不改机制）
//
// 目的：回答「离线结算到底吃不吃 F」，以及"×F / ÷F 相互抵消"的代码外观是否等于最终结果与 F 无关。
//
// 做法：固定存档 + 固定离线秒数 + 指定 F，调用真实的 simulateTime(seconds, real, fast)，
//       测：Δ游戏时间、Δ现实时间、Δ资源、Δ无限/永恒次数、结算前后的 speedup。
//
// 注意：fast=true 时固定 50 tick（确定性好、快）；fast=false 时走离线 tick 上限与异步弹窗。
//       两种都测，避免只测一条分支。
//
// 用法: node probe-offline.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8250);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";

// 两份代表性存档：一份「无黑洞」（走 :946 分支），一份「有黑洞」（走 :944/:987 分支）
const SAVES = [
  { key: "pre-bh", file: "29._2AG+9DB+1e50AM.txt", desc: "2 AG / 9 DB / 1e50 AM（无黑洞）" },
  { key: "with-bh", file: "132._9.1e137IP.txt", desc: "9.1e137 IP（应已解锁黑洞）" },
];

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

const FS = [1, 137, 10000];
const SECS = [60, 600, 3600];

console.log("离线结算探针：Δ游戏时间 / Δ现实时间 / Δ资源");
console.log("固定存档 + 固定离线秒数 + 指定 F，调用真实 simulateTime()\n");

const all = [];
for (const s of SAVES) {
  const saveText = fs.readFileSync(path.join(SAVE_DIR, s.file), "utf-8");
  console.log(`\n========== 存档 ${s.key}：${s.desc} ==========`);
  for (const fast of [true, false]) {
    console.log(`\n--- 模式 ${fast ? "fast=true（固定 50 tick）" : "fast=false（走离线 tick 上限）"} ---`);
    console.log("     F   离线(s)   Δ游戏时间(ms)     Δ现实(ms)   游戏/现实    ×F/?       Δlog10(IP)   Δ无限      Δ永恒");
    for (const F of FS) {
      for (const secs of SECS) {
        const r = await page.evaluate(async (text, F, secs, fast) => {
          try { GameIntervals.stop(); } catch (e) { /* ignore */ }
          GameStorage.offlineEnabled = true;
          const obj = GameSaveSerializer.deserialize(text);
          player = obj;
          player.lastUpdate = Date.now();
          GameStorage.loadPlayerObject(player);
          player.lastUpdate = Date.now();
          try { GameIntervals.stop(); } catch (e) { /* ignore */ }
          GameSpeed.set(F);
          const lg = v => {
            const n = v && v.toNumber ? v.toNumber() : Number(v);
            return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
          };
          const read = () => ({
            game: player.records.totalTimePlayed,
            real: player.records.realTimePlayed,
            ip: lg(Currency.infinityPoints.value),
            inf: Currency.infinities.value.toNumber ? Currency.infinities.value.toNumber() : Number(Currency.infinities.value),
            eter: Currency.eternities.value.toNumber ? Currency.eternities.value.toNumber() : Number(Currency.eternities.value),
            speedup: getGameSpeedupFactor(),
            bhUnlocked: BlackHoles.areUnlocked,
          });
          const before = read();
          simulateTime(secs, false, fast);
          const after = read();
          GameSpeed.set(1);
          const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? a - b : NaN;
          return {
            F, secs, bh: before.bhUnlocked, speedup: before.speedup,
            dGame: d(after.game, before.game),
            dReal: d(after.real, before.real),
            dIp: d(after.ip, before.ip),
            dInf: d(after.inf, before.inf),
            dEter: d(after.eter, before.eter),
          };
        }, saveText, F, secs, fast);
        all.push({ save: s.key, mode: fast ? "fast" : "limit", ...r });
        const ratio = r.dGame / (r.dReal || 1);
        console.log(`  ${String(F).padStart(6)} ${String(secs).padStart(8)} ${r.dGame.toExponential(3).padStart(14)} ${r.dReal.toFixed(0).padStart(12)} ${ratio.toExponential(3).padStart(11)} ${(ratio / F).toExponential(2).padStart(9)}  ${(Number.isFinite(r.dIp) ? r.dIp.toExponential(2) : "—").padStart(11)} ${(Number.isFinite(r.dInf) ? r.dInf.toExponential(2) : "—").padStart(8)} ${(Number.isFinite(r.dEter) ? r.dEter.toExponential(2) : "—").padStart(8)}`);
      }
    }
  }
}

// 汇总：同一 (save, mode, secs) 下，Δ游戏时间 随 F 的倍率
console.log("\n\n========== 汇总：Δ游戏时间 相对 F=1 的倍率 ==========");
console.log("存档    模式   离线(s)   F=137/F=1     F=10000/F=1");
for (const s of SAVES) {
  for (const mode of ["fast", "limit"]) {
    for (const secs of SECS) {
      const g = F => {
        const row = all.find(r => r.save === s.key && r.mode === mode && r.secs === secs && r.F === F);
        return row ? row.dGame : NaN;
      };
      const b = g(1);
      console.log(`${s.key.padEnd(8)}${mode.padEnd(6)} ${String(secs).padStart(7)}   ${(g(137) / b).toExponential(3).padStart(12)} ${(g(10000) / b).toExponential(3).padStart(13)}`);
    }
  }
}

console.log("\n========== 判读 ==========");
console.log("· 若 F=10000/F=1 ≈ 10000 → 离线进度被 F 线性加速，与在线一致。");
console.log("· 若 ≈ 1 → 离线进度与 F 无关（「先乘后除」真的抵消了）。");
console.log("· 若介于两者之间 → 存在与 tick 数/黑洞路径相关的部分抵消，需要按存档类型分别说明。");
console.log("· Δ现实时间 应恒 ≈ 离线秒数（现实时间不得被 F 放大）。");

await browser.close();
server.close();
