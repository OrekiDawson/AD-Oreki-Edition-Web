// A/B：固定「现实时间预算」下，刷新率（每帧推进的游戏时间）对进度的影响
// 前提：Autobuyers.tick 每帧只跑一次 → 帧数 = 复利（采购→生产）轮数
// 用法：node exp-refresh-rate.mjs [--save=...] [--F=10000] [--wall=8000]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const SAVES = argStr("saves", "132._9.1e137IP.txt").split(",");
const F = argNum("F", 10000);
const WALL = argNum("wall", 8000);
const RATES = (argStr("rates", "33,20,16,8")).split(",").map(Number);

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
await new Promise(r => server.listen(8497, "127.0.0.1", r));
const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
await page.goto("http://127.0.0.1:8497/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return +Number(n).toFixed(2); } catch (e) { return null; } };
  window.__r = {
    lg,
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      GameSpeed.setScaleAutobuyerInterval(true);
      GameSpeed.setScaleTickspeedAutobuyerInterval(true);
      player.auto.autobuyersOn = true;
      for (const k of ["dimboost", "galaxy"]) {
        const b = Autobuyer[k];
        if (!b.isBought) b.data.isBought = true;
        b.isActive = true;
      }
      Autobuyer.bigCrunch.isActive = false;
    },
    snap() {
      return {
        maxAmLog: this.lg(player.records.thisInfinity.maxAM),
        amLog: this.lg(Currency.antimatter.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        gal: player.galaxies,
        boost: DimBoost.purchasedBoosts,
        bought1: AntimatterDimension(1).bought,
        gameS: +(player.records.totalTimePlayed / 1000).toFixed(1),
      };
    },
    // 用指定帧长跑满 wall 毫秒墙钟
    run(ms, wall) {
      const n = Math.round(wall / ms);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) gameLoop(ms);
      const cpu = performance.now() - t0;
      return { frames: n, cpuMs: +cpu.toFixed(1), cpuPerFrame: +(cpu / n).toFixed(3) };
    },
  };
});

const rows = [];
for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  for (const rate of RATES) {
    await page.evaluate(({ t, F }) => window.__r.setup(t, F), { t: text, F });
    const s0 = await page.evaluate(() => window.__r.snap());
    const run = await page.evaluate(({ ms, wall }) => window.__r.run(ms, wall), { ms: rate, wall: WALL });
    const s1 = await page.evaluate(() => window.__r.snap());
    const row = {
      saveFile, rate, ...run, s0, s1,
      dMaxAm: +(s1.maxAmLog - s0.maxAmLog).toFixed(2),
      dGal: s1.gal - s0.gal, dBoost: s1.boost - s0.boost,
      dIP: +(s1.ipLog - s0.ipLog).toFixed(3),
      dGameS: +(s1.gameS - s0.gameS).toFixed(1),
      dBought1: s1.bought1 - s0.bought1,
    };
    rows.push(row);
    console.log(`  ${saveFile.slice(0, 22).padEnd(24)} 帧长=${String(rate).padStart(3)}ms 帧数=${String(run.frames).padStart(4)} ` +
      `Δ游戏=${String(row.dGameS).padStart(9)}s | Δlog10(maxAM)=${String(row.dMaxAm).padStart(9)} Δd1买入=${String(row.dBought1).padStart(8)} ` +
      `Δgal=${String(row.dGal).padStart(3)} Δboost=${String(row.dBoost).padStart(5)} ΔIP=${row.dIP} | CPU=${run.cpuMs}ms (${run.cpuPerFrame}ms/帧)`);
  }
}

const out = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/exp-refresh-rate.json";
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), F, wall: WALL, rates: RATES, rows, errors: errs }, null, 2));
console.log(`\n已写入 ${out}`);
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
