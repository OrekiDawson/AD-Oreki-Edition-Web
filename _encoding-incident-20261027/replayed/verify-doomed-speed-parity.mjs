// 毁灭现实（Pelle）倍率一致性探针
//
// 目的：确认 `getGlobalSpeedFactor()` 在毁灭现实中是否仍是全额倍率。
// 方法：同一存档分别用 F=1 与 F=10000 各跑固定帧数，比较「游戏时间 / 现实时间」之比，
//       再看 F=10000 相对 F=1 的放大倍数。
//       —— 该比值与存档自身的官方游戏速度因子无关（同一存档内相互抵消）。
// 期望：
//   非毁灭存档：F 放大倍数 = 10000（回归保护，不应变化）
//   毁灭存档  ：修复前 = 100（sqrt），修复后 = 10000
//
// 用法：node verify-doomed-speed-parity.mjs [--frames=80] [--warm=30]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

const argNum = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  const v = h ? Number(h.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : d;
};
const FRAMES = argNum("frames", 80);
const WARM = argNum("warm", 30);
const FRAME_MS = 20;

const CASES = [
  { label: "非毁灭 / 92R", file: "861._92R+1.0e11RM.txt", expectDoomed: false },
  { label: "毁灭现实 / 终局", file: "1123._Endgame.txt", expectDoomed: true },
];
const FACTORS = [1, 10000];

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8493, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`);
});
await page.goto("http://127.0.0.1:8493/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof GameSpeed === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  window.__p = {
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      // 全部自动购买器关闭：避免采购把时间/资源搅进测量
      const walk = o => {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && typeof v === "object") {
            if ("isActive" in v) v.isActive = false;
            walk(v);
          }
        }
      };
      walk(player.auto);
      player.auto.autobuyersOn = false;
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      return {
        F: GameSpeed.factor,
        eff: getGlobalSpeedFactor(),
        raw: getGlobalSpeedFactorRaw(),
        doomed: Boolean(Pelle.isDoomed),
        realityTime: player.records.thisReality.time,
        realityReal: player.records.thisReality.realTime,
      };
    },
    step(n, ms) {
      for (let i = 0; i < n; i++) gameLoop(ms);
      return {
        time: player.records.thisReality.time,
        real: player.records.thisReality.realTime,
        infTime: player.records.thisInfinity.time,
        infReal: player.records.thisInfinity.realTime,
        am: String(Currency.antimatter.value),
      };
    },
  };
});

const out = [];
for (const c of CASES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, c.file), "utf-8");
  const perF = {};
  for (const F of FACTORS) {
    const info = await page.evaluate(({ t, f }) => window.__p.setup(t, f), { t: text, f: F });
    await page.evaluate(({ n, ms }) => window.__p.step(n, ms), { n: WARM, ms: FRAME_MS });
    const a = await page.evaluate(() => window.__p.step(0, 0));
    const b = await page.evaluate(({ n, ms }) => window.__p.step(n, ms), { n: FRAMES, ms: FRAME_MS });
    const dt = b.time - a.time;
    const dr = b.real - a.real;
    perF[F] = {
      doomed: info.doomed,
      effAtSetup: info.eff,
      ratio: dr > 0 ? dt / dr : NaN,
      dt, dr,
      amStable: a.am === b.am,
    };
    if (info.doomed !== c.expectDoomed) {
      errs.push(`CASE:${c.label} doomed 状态与预期不符（${info.doomed} != ${c.expectDoomed}）`);
    }
  }
  const scale = perF[10000].ratio / perF[1].ratio;
  out.push({
    case: c.label, file: c.file,
    doomed: perF[10000].doomed,
    ratioF1: +perF[1].ratio.toFixed(4),
    ratioF10k: +perF[10000].ratio.toFixed(4),
    fScaling: +scale.toFixed(2),
    effAtSetupF10k: perF[10000].effAtSetup,
  });
}

const table = out
  .map(r => `${r.case}\t doomed=${r.doomed}\t ratio(F=1)=${r.ratioF1}\t ratio(F=10000)=${r.ratioF10k}\t 放大=${r.fScaling}×`)
  .join("\n");
console.log("---- 时钟比（游戏时间 / 现实时间） ----");
console.log(table);

const doomed = out.find(r => r.doomed);
const normal = out.find(r => !r.doomed);
const okDoomed = doomed && Math.abs(doomed.fScaling - 10000) / 10000 < 0.02;
const okNormal = normal && Math.abs(normal.fScaling - 10000) / 10000 < 0.02;
console.log(`\n[判定] 毁灭现实全额倍率: ${okDoomed ? "PASS" : "FAIL"}（${doomed ? doomed.fScaling : "n/a"}×）`);
console.log(`[判定] 非毁灭回归保护    : ${okNormal ? "PASS" : "FAIL"}（${normal ? normal.fScaling : "n/a"}×）`);
console.log(`[判定] 控制台/页面错误    : ${errs.length === 0 ? "PASS（0 条）" : `FAIL（${errs.length} 条）`}`);
if (errs.length) console.log(errs.slice(0, 8).join("\n"));

fs.writeFileSync(
  path.join(ROOT, "..", "_research", "doomed-speed-parity.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), frames: FRAMES, warm: WARM, rows: out, errors: errs }, null, 1),
  "utf-8"
);

await browser.close();
server.close();
process.exit(okDoomed && okNormal && errs.length === 0 ? 0 : 1);
