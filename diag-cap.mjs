// 诊断：Break 后产量上限是否为真瓶颈（R5.12）
// 只做观测，不改状态机、不 stop/start 游戏循环。
// 记录 AD1 每秒产量、上限、反物质、maxAM 的 log10，以及 AD 各阶数量。
// 用法：node diag-cap.mjs [项目目录] [端口] [秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8497);
const SEC = Number(process.argv[4] || 30);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 让游戏自己跑起来（不 stop/start），只做一次状态注入
await page.evaluate(() => {
  player.break = true;
  player.infinities = new Decimal(60);
  player.infinityPoints = new Decimal(1e6);
  player.IPMultPurchases = 6;
  player.auto.autobuyersOn = true;
  player.auto.bigCrunch.isActive = true;
  player.auto.bigCrunch.mode = 1;
  player.auto.bigCrunch.xHighest = 10;
  player.auto.bigCrunch.interval = 100;
  player.auto.bigCrunch.cost = 1;
});
await new Promise(r => setTimeout(r, 1500));

const t0 = Date.now();
let prev = null;
while (Date.now() - t0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => (v && typeof v.mantissa === "number") ? (v.exponent + Math.log10(v.mantissa)) : null;
    let prod = null, cap = null;
    try {
      const d1 = AntimatterDimension(1);
      prod = L(d1.productionPerSecond);
      cap = L(d1.cappedProductionInNormalChallenges);
    } catch (e) { /* ignore */ }
    const ads = [];
    for (let t = 1; t <= 8; t++) { try { ads.push(+(AntimatterDimension(t).bought || 0)); } catch (e) { ads.push(-1); } }
    return {
      amL: L(Currency.antimatter.value),
      maxAML: L(player.records.thisInfinity.maxAM),
      prodL: prod, capL: cap,
      adBought: ads,
      boosts: player.dimensionBoosts, galaxies: player.galaxies,
      ts: (() => { try { return L(Tickspeed.current); } catch (e) { return null; } })(),
      inf: (() => { try { return L(player.infinities); } catch (e) { return null; } })(),
      ipL: L(player.infinityPoints),
      fps: null,
      diff: (() => { try { return GameUI.lastDiff ?? null; } catch (e) { return null; } })(),
    };
  }).catch(e => ({ err: String(e) }));
  if (s.err) { console.log("快照失败:", s.err); break; }
  const t = +((Date.now() - t0) / 1000).toFixed(1);
  const dAM = prev ? (s.amL - prev.amL) : 0;
  console.log(`t=${String(t).padStart(5)}s AM=10^${s.amL?.toFixed(2).padStart(8)} (Δ${dAM >= 0 ? "+" : ""}${dAM.toFixed(2)}) maxAM=10^${s.maxAML?.toFixed(2).padStart(8)} 产量/秒=10^${s.prodL?.toFixed(2)} 上限=10^${s.capL?.toFixed(2)} AD=[${s.adBought.join(",")}] 提升=${s.boosts} 星系=${s.galaxies} tickspeed=10^${s.ts?.toFixed(1)} inf=10^${s.inf?.toFixed(1)}`);
  prev = s;
  await new Promise(r => setTimeout(r, 1000));
}
if (errs.length) console.log(`页面异常 ${errs.length}：${errs.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
