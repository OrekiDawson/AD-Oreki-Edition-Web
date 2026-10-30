// 璇婃柇锛欰D 璐拱鍣ㄧ殑 bulk 閰嶇疆涓庛€屾壒閲忎笂闄愭槸鍚︾湡鐨勫崱浣忚喘涔般€?import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const SAVES = (process.argv.find(a => a.startsWith("--saves="))?.split("=")[1]
  ?? "132._9.1e137IP.txt,729._2R+6.9e19EP+167TT.txt,861._92R+1.0e11RM.txt").split(",");

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
await page.goto("http://127.0.0.1:8493/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  const info = await page.evaluate((t) => {
    try { GameIntervals.stop(); } catch (e) { }
    player = GameSaveSerializer.deserialize(t);
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    try { GameIntervals.stop(); } catch (e) { }
    const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return +Number(n).toFixed(2); } catch (e) { return null; } };
    return {
      galaxies: player.galaxies,
      boosts: DimBoost.purchasedBoosts,
      ach61: Achievement(61).isUnlocked,
      autos: Autobuyer.antimatterDimension.zeroIndexed.map(b => ({
        tier: b.tier,
        mode: b.mode,
        bulk: b.bulk === 1e100 ? "unlimited" : b.bulk,
        hasUnlimited: b.hasUnlimitedBulk,
        interval: b.interval,
        active: b.isActive,
        affordability: (() => { const d = AntimatterDimension(b.tier); return { avail: d.isAvailableForPurchase, afford: d.isAffordable, count: lg(d.totalAmount) }; })(),
      })),
      am: lg(Currency.antimatter.value),
    };
  }, text);
  console.log(`\n== ${saveFile} ==  galaxies=${info.galaxies} boosts=${info.boosts} Ach61(鏃犻檺bulk)=${info.ach61} AM=1e${info.am}`);
  for (const a of info.autos) {
    console.log(`  t${a.tier} mode=${a.mode} bulk=${a.bulk} unlimited=${a.hasUnlimited} iv=${a.interval} active=${a.active} ` +
      `avail=${a.affordability.avail} afford=${a.affordability.afford} count=1e${a.affordability.count}`);
  }
}
await browser.close();
server.close();
