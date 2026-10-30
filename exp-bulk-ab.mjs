// A/B：AD 自动购买器的「单次批量上限 bulk」是否是重建速度瓶颈
// 存档：早期无限（成就61 未解锁 → bulk 未无限，默认 bulk=1，mode=10 → 每次最多买 10 个）
// 用法：node exp-bulk-ab.mjs --saves=52._1.9e3IP.txt,53._9.1e3IP.txt [--F=10000] [--frames=120]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const SAVES = argStr("saves", "52._1.9e3IP.txt").split(",");
const F = argNum("F", 10000);
const FRAMES = argNum("frames", 120);
const FRAME_MS = 20;
const TEST_BULK = argNum("bulk", 500); // 低于 bulkCap=512，避免顺带满足成就 61

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
await new Promise(r => server.listen(8499, "127.0.0.1", r));
const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
await page.goto("http://127.0.0.1:8499/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return +Number(n).toFixed(3); } catch (e) { return null; } };
  window.__b = {
    lg,
    // bulk = null 表示保持存档原值
    setup(text, F, bulk) {
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
      if (bulk !== null) for (const b of Autobuyer.antimatterDimension.zeroIndexed) b.data.bulk = bulk;
      return {
        bulk: Autobuyer.antimatterDimension.zeroIndexed.map(b => b.bulk),
        mode: Autobuyer.antimatterDimension.zeroIndexed.map(b => b.mode),
        ach61: Achievement(61).isUnlocked,
        eff: Autobuyer.antimatterDimension.zeroIndexed[0].effectiveInterval,
      };
    },
    hardReset() {
      const s = this.snap();
      player.galaxies++;
      player.dimensionBoosts = 0;
      softReset(0);
      return s;
    },
    snap() {
      return {
        amLog: this.lg(Currency.antimatter.value),
        d1: this.lg(AntimatterDimension(1).totalAmount),
        d4: this.lg(AntimatterDimension(4).totalAmount),
        d8: this.lg(AntimatterDimension(8).totalAmount),
        boost: DimBoost.purchasedBoosts,
        gal: player.galaxies,
        ipLog: this.lg(Currency.infinityPoints.value),
        gameS: +(player.records.totalTimePlayed / 1000).toFixed(1),
      };
    },
    run(n, ms) {
      const t0 = performance.now();
      let buyFrames = 0;
      for (let i = 0; i < n; i++) {
        const before = AntimatterDimension(1).bought;
        gameLoop(ms);
        if (AntimatterDimension(1).bought > before) buyFrames++;
      }
      return { buyFrames, cpu: +(performance.now() - t0).toFixed(1) };
    },
  };
});

const rows = [];
for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  for (const arm of [{ label: "A 存档 bulk", bulk: null }, { label: `B bulk=${TEST_BULK}`, bulk: TEST_BULK }]) {
    const info = await page.evaluate(({ t, F, bulk }) => window.__b.setup(t, F, bulk), { t: text, F, bulk: arm.bulk });
    await page.evaluate(() => window.__b.hardReset());
    const s0 = await page.evaluate(() => window.__b.snap());
    const run = await page.evaluate(({ n, ms }) => window.__b.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const s1 = await page.evaluate(() => window.__b.snap());
    const row = { saveFile, arm: arm.label, info, s0, s1, run };
    rows.push(row);
    console.log(`  ${saveFile.slice(0, 16).padEnd(18)} ${arm.label.padEnd(12)} bulk=${JSON.stringify(info.bulk)} ` +
      `ACH61=${info.ach61} eff=${String(info.eff).slice(0, 8)}ms | 重置后 ${FRAMES} 帧: ` +
      `Δlog10(AM)=${(s1.amLog - s0.amLog).toFixed(2)} d1 1e${s0.d1}→1e${s1.d1} d8 1e${s0.d8}→1e${s1.d8} ` +
      `Δboost=${s1.boost - s0.boost} Δgal=${s1.gal - s0.gal} 有购买帧=${run.buyFrames}/${FRAMES} CPU=${run.cpu}ms`);
  }
}

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-bulk-ab.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), F, frames: FRAMES, rows, errors: errs }, null, 2));
console.log("\n已写入 _research/exp-bulk-ab.json");
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
