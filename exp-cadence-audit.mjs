// 自动购买器吞吐审计（Web 端）：购买节奏 × 全局倍率
// 与 Android build/ab_audit/ab_cadence.py 同口径：只改「存档里的 interval」与「F」，不改任何 src/。
//
// 观测：
//   1) 机制断言：records.realTimePlayed 每帧只走 20ms（与 F 无关）；totalTimePlayed 走 20ms×F×glyph
//   2) 节拍断言：interval 决定「多少次游戏循环里才会触发一次」
//   3) 吞吐：Δ(dim.bought)（真实购买件数）、Δlog10(AM)、Δinfinities、Δlog10(IP)
//
// 用法：node _tools/exp-cadence-audit.mjs [--frames=1200] [--save=132._9.1e137IP.txt]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argVal = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };
const argNum = (k, d) => { const v = Number(argVal(k, NaN)); return Number.isFinite(v) && v > 0 ? v : d; };
const FRAMES = argNum("frames", 1200);
const FRAME_MS = 20;
const SAVE_FILE = argVal("save", "132._9.1e137IP.txt");
const OUT_TAG = argVal("tag", "");

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
await new Promise(r => server.listen(8481, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8481/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 就绪");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const dims = () => AntimatterDimensions.all;

  window.__c = {
    lg, num,
    setup(text, F, interval) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      GameSpeed.setScaleAutobuyerInterval(false);
      GameSpeed.setScaleTickspeedAutobuyerInterval(false);
      const ad = Autobuyer.antimatterDimension.zeroIndexed;
      const applied = [];
      const autoOn = interval > 0;
      ad.forEach(b => {
        try {
          if (!b.isBought) b.data.isBought = true;
          b.data.interval = autoOn ? interval : b.data.interval;
          b.data.isActive = autoOn;
          b.data.lastTick = player.records.realTimePlayed;
          applied.push({ interval: b.interval, eff: b.effectiveInterval });
        } catch (e) { applied.push(null); }
      });
      try {
        const t = Autobuyer.tickspeed;
        if (!t.isBought) t.data.isBought = true;
        if (autoOn) t.data.interval = interval;
        t.data.isActive = autoOn;
        t.data.lastTick = player.records.realTimePlayed;
      } catch (e) { }
      return { applied, gameSpeed: GameSpeed.factor };
    },
    snap() {
      const ad = Autobuyer.antimatterDimension.zeroIndexed;
      return {
        amLog: lg(Currency.antimatter.value),
        dimBought: dims().map(d => num(d.bought)),
        dimAmount: dims().map(d => lg(d.amount)),
        inf: num(Currency.infinities.value),
        ipLog: lg(Currency.infinityPoints.value),
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        tickBought: (() => { try { return num(Autobuyer.tickspeed.data.bought ?? 0); } catch (e) { return NaN; } })(),
        adLastTick: ad.map(b => b.data.lastTick),
        dimBoosts: (() => { try { return num(player.dimBoosts ?? 0); } catch (e) { return NaN; } })(),
      };
    },
    run(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
    // 机制断言用：只推进 1 帧，返回真实时间与游戏时间各自走了多少
    stepOne(ms) {
      const r0 = player.records.realTimePlayed, g0 = player.records.totalTimePlayed;
      gameLoop(ms);
      return { dReal: player.records.realTimePlayed - r0, dGame: player.records.totalTimePlayed - g0 };
    },
  };
});

const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");
const cadences = (argVal("cadences", "1,100,1000")).split(",").map(Number).filter(v => Number.isFinite(v) && v >= 0);
const Fs = (argVal("Fs", "1,2,10000")).split(",").map(Number).filter(v => Number.isFinite(v) && v > 0);
const rows = [];

for (const F of Fs) {
  for (const interval of cadences) {
    const info = await page.evaluate(({ text, F, interval }) => window.__c.setup(text, F, interval), { text: saveText, F, interval });
    const step = await page.evaluate(({ ms }) => window.__c.stepOne(ms), { ms: FRAME_MS });
    const s0 = await page.evaluate(() => window.__c.snap());
    const t0 = Date.now();
    const s1 = await page.evaluate(({ n, ms }) => window.__c.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const cpuMs = Date.now() - t0;
    const row = {
      F, interval, cpuMs,
      dReal: s1.real - s0.real, dGame: s1.game - s0.game,
      stepReal: step.dReal, stepGame: step.dGame,
      amLog: s1.amLog - s0.amLog,
      bought: s1.dimBought.map((v, i) => v - s0.dimBought[i]),
      boughtTotal: s1.dimBought.reduce((a, v, i) => a + (v - s0.dimBought[i]), 0),
      dInf: s1.inf - s0.inf,
      ipLog: s1.ipLog - s0.ipLog,
      dDimBoost: s1.dimBoosts - s0.dimBoosts,
      effInterval: info.applied.map(x => (x ? x.eff : null)),
    };
    row.boughtPerSecReal = row.boughtTotal / (row.dReal / 1000);
    rows.push(row);
    console.log(`F=${String(F).padStart(5)} interval=${String(interval).padStart(4)}ms | ` +
      `Δreal=${row.dReal.toFixed(0)}ms Δgame=${row.dGame.toExponential(3)}ms | ` +
      `每帧 real/game=${row.stepReal.toFixed(3)}/${row.stepGame.toExponential(3)} | ` +
      `Δbought=${String(row.boughtTotal).padStart(7)} (${row.boughtPerSecReal.toFixed(1)}/s) | ` +
      `Δlog10(AM)=${row.amLog.toFixed(1)} Δinf=${row.dInf} Δlog10(IP)=${row.ipLog.toFixed(3)} ΔDB=${row.dDimBoost}`);
  }
}

fs.writeFileSync(`C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-cadence-audit${OUT_TAG}.json`,
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, out: OUT_TAG, frameMs: FRAME_MS, rows, errors: errs }, null, 2));
console.log(`\n已写入 _research/exp-cadence-audit${OUT_TAG}.json  errors=`, errs.length);
await browser.close();
server.close();
process.exit(errs.length ? 1 : 0);
