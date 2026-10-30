// A/B：无限维度 / 时间维度自动购买器的 interval 缩放（同类「纯采购型」购买器）
// 固定现实时间窗口，比较最终进度（EP/IP/星系数/maxAM），不看触发次数
// 用法：node exp-idtd-ab.mjs --saves=424....txt [--F=10000] [--frames=600]
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
const SAVES = argStr("saves", "424._8.4e1412EP+4.9e10DT.txt").split(",");
const F = argNum("F", 10000);
const FRAMES = argNum("frames", 600);
const FRAME_MS = 20;

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
await new Promise(r => server.listen(8501, "127.0.0.1", r));
const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
await page.goto("http://127.0.0.1:8501/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return +Number(n).toFixed(3); } catch (e) { return null; } };
  window.__a = {
    lg,
    setup(text, F, scaleIds) {
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
      // 无限维度 / 时间维度：实例级覆盖模拟开关
      for (const arr of [Autobuyer.infinityDimension.zeroIndexed, Autobuyer.timeDimension.zeroIndexed]) {
        for (const b of arr) {
          Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => scaleIds });
          b.isActive = true;
        }
      }
      return {
        scaleIds,
        idIntervals: Autobuyer.infinityDimension.zeroIndexed.map(b => b.interval),
        idEffective: Autobuyer.infinityDimension.zeroIndexed.map(b => b.effectiveInterval),
        tdIntervals: Autobuyer.timeDimension.zeroIndexed.map(b => b.interval),
        tdEffective: Autobuyer.timeDimension.zeroIndexed.map(b => b.effectiveInterval),
        idActive: Autobuyer.infinityDimension.zeroIndexed.map(b => b.isActive),
        tdActive: Autobuyer.timeDimension.zeroIndexed.map(b => b.isActive),
      };
    },
    snap() {
      return {
        epLog: this.lg(Currency.eternityPoints.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        amLog: this.lg(Currency.antimatter.value),
        maxAmLog: this.lg(player.records.thisInfinity.maxAM),
        gal: player.galaxies,
        boost: DimBoost.purchasedBoosts,
        eternities: this.lg(Currency.eternities.value),
        id8: this.lg(AntimatterDimension(8).totalAmount),
        idDim: (() => { try { return this.lg(InfinityDimension(8).totalAmount); } catch (e) { return null; } })(),
        tdDim: (() => { try { return this.lg(TimeDimension(8).totalAmount); } catch (e) { return null; } })(),
        gameS: +(player.records.totalTimePlayed / 1000).toFixed(1),
      };
    },
    run(n, ms) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) gameLoop(ms);
      return +(performance.now() - t0).toFixed(1);
    },
  };
});

const rows = [];
for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  for (const arm of [{ label: "A 不缩放", scale: false }, { label: "B 缩放ID+TD", scale: true }]) {
    const info = await page.evaluate(({ t, F, s }) => window.__a.setup(t, F, s), { t: text, F, s: arm.scale });
    const s0 = await page.evaluate(() => window.__a.snap());
    const cpu = await page.evaluate(({ n, ms }) => window.__a.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const s1 = await page.evaluate(() => window.__a.snap());
    const row = { saveFile, arm: arm.label, info, s0, s1, cpu };
    rows.push(row);
    console.log(`  ${saveFile.slice(0, 18).padEnd(20)} ${arm.label.padEnd(12)} | ` +
      `Δlog10(EP)=${(s1.epLog - s0.epLog).toFixed(2)} Δlog10(IP)=${(s1.ipLog - s0.ipLog).toFixed(2)} ` +
      `Δlog10(AM)=${(s1.amLog - s0.amLog).toFixed(1)} Δgal=${s1.gal - s0.gal} Δboost=${s1.boost - s0.boost} ` +
      `Δ永恒=${(s1.eternities - s0.eternities).toFixed(2)} | CPU=${cpu}ms`);
  }
}
fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-idtd-ab.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), F, frames: FRAMES, rows, errors: errs }, null, 2));
console.log("\n已写入 _research/exp-idtd-ab.json");
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
