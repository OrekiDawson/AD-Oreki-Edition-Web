// 追踪：一次星系重置后的「重建」过程，逐帧看时间花在哪
// 用法：node trace-rebuild.mjs [--save=...] [--frames=300] [--F=10000]
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
const SAVE = argStr("save", "132._9.1e137IP.txt");
const FRAMES = argNum("frames", 300);
const F = argNum("F", 10000);
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
await new Promise(r => server.listen(8495, "127.0.0.1", r));
const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
await page.goto("http://127.0.0.1:8495/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return +Number(n).toFixed(2); } catch (e) { return null; } };
  window.__t = {
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
    // 强制做一次与 galaxyReset 等价的状态重置：星系数 +1，然后 softReset(0)
    resetOneGalaxy() {
      const before = {
        am: this.lg(Currency.antimatter.value),
        maxAm: this.lg(player.records.thisInfinity.maxAM),
        gal: player.galaxies,
        boost: DimBoost.purchasedBoosts,
        d1: this.lg(AntimatterDimension(1).totalAmount),
        d8: this.lg(AntimatterDimension(8).totalAmount),
      };
      player.galaxies++;
      player.dimensionBoosts = 0;
      softReset(0);
      return before;
    },
    trace(n, ms) {
      const out = [];
      let prevBought = Array.from({ length: 9 }, (_, t) => t === 0 ? 0 : AntimatterDimension(t).bought);
      for (let i = 0; i < n; i++) {
        gameLoop(ms);
        const bought = Array.from({ length: 9 }, (_, t) => t === 0 ? 0 : AntimatterDimension(t).bought);
        const delta = bought.map((v, t) => t === 0 ? 0 : v - prevBought[t]);
        prevBought = bought;
        out.push({
          f: i + 1,
          am: this.lg(Currency.antimatter.value),
          d1: this.lg(AntimatterDimension(1).totalAmount),
          d8: this.lg(AntimatterDimension(8).totalAmount),
          boost: DimBoost.purchasedBoosts,
          gal: player.galaxies,
          bought: delta.slice(1),
          dbGate: DimBoost.canBeBought && DimBoost.requirement.isSatisfied,
          galGate: Galaxy.canBeBought && Galaxy.requirement.isSatisfied,
          dbIv: +Autobuyer.dimboost.interval,
          dbSince: +(player.records.realTimePlayed - Autobuyer.dimboost.data.lastTick).toFixed(1),
        });
      }
      return out;
    },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
await page.evaluate(({ t, F }) => window.__t.setup(t, F), { t: text, F });
const pre = await page.evaluate(() => window.__t.resetOneGalaxy());
console.log(`存档 ${SAVE} @ F=${F}`);
console.log("星系重置前：", JSON.stringify(pre));
const rows = await page.evaluate(({ n, ms }) => window.__t.trace(n, ms), { n: FRAMES, ms: FRAME_MS });
console.log("\n帧 |      AM |    d1 |    d8 | boost gal | 各 tier 本帧买入 | DB门槛 DB间隔余量");
for (const r of rows) {
  if (r.f <= 40 || r.f % 10 === 0 || r.dbGate) {
    console.log(`${String(r.f).padStart(3)} | 1e${String(r.am).padStart(7)} | ${String(r.d1).padStart(5)} | ${String(r.d8).padStart(5)} | ` +
      `${String(r.boost).padStart(5)} ${String(r.gal).padStart(3)} | ${r.bought.map(v => String(v).padStart(6)).join(" ")} | ` +
      `${r.dbGate ? "Y" : "."} ${r.dbSince}/${r.dbIv} gal=${r.galGate ? "Y" : "."}`);
  }
}
// 汇总：每帧有多少 tier 真的买到了东西
const active = rows.filter(r => r.bought.some(v => v > 0)).length;
const galBuy = rows.filter(r => r.galGate).length;
console.log(`\n${FRAMES} 帧中：有购买动作 ${active} 帧；星系门槛满足 ${galBuy} 帧；` +
  `boost ${rows[rows.length - 1].boost}；gal ${rows[rows.length - 1].gal}；AM 1e${rows[rows.length - 1].am}`);
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
