// 定点诊断：维度购买在 bought=240 处停住的真实原因（R8）
// 直接调用购买函数 vs 自动购买器，分别看 bought 是否推进。
// 用法：node diag-buy240.mjs [项目目录] [端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8541);
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 构造「已 Break、有大量反物质」的可控起点，只测购买机制
await page.evaluate(() => {
  player.break = true;
  player.infinities = new Decimal(60);
  player.infinityPoints = new Decimal(1e10);
  player.challenge.normal.current = 0;
  Currency.antimatter.value = new Decimal("1e400");
  for (let t = 1; t <= 8; t++) {
    try { AntimatterDimension(t).amount = new Decimal("1e50"); AntimatterDimension(t).bought = 240; } catch (e) { /* ignore */ }
  }
  GameUI.update();
});
await new Promise(r => setTimeout(r, 800));

const out = await page.evaluate(() => {
  const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(1) : null;
  const res = { before: {}, direct: {}, auto: {} };
  const snap = (t) => {
    const d = AntimatterDimension(t);
    return {
      bought: d.bought, amountL: L(d.amount), costL: L(d.cost),
      affordable: d.isAffordable, avail: d.isAvailableForPurchase,
      baseAmount: d.baseAmount ?? null,
    };
  };
  res.before.AD1 = snap(1);
  res.before.AD8 = snap(8);
  // 自动器的门
  const ab = player.auto.antimatterDims.all[0];
  res.autoGate = { isActive: ab.isActive, isUnlocked: ab.isUnlocked, mode: ab.mode, bulk: ab.bulk, interval: ab.interval, lastTick: ab.lastTick };
  // 1) 直接调用购买函数
  let directErr = null;
  try {
    const before1 = AntimatterDimension(1).bought;
    buyMaxDimension(1);
    res.direct.AD1 = { beforeBought: before1, afterBought: AntimatterDimension(1).bought, afterCost: L(AntimatterDimension(1).cost) };
  } catch (e) { directErr = String(e && e.message || e); }
  res.direct.err = directErr;
  // 2) 直接调用 buyUntil10
  try {
    const before8 = AntimatterDimension(8).bought;
    buyUntil10(8);
    res.direct.AD8 = { beforeBought: before8, afterBought: AntimatterDimension(8).bought };
  } catch (e) { res.direct.err8 = String(e && e.message || e); }
  // 3) 调自动器 tick
  let autoErr = null;
  try {
    const before1 = AntimatterDimension(1).bought;
    Autobuyers.tick();
    res.auto.afterTickBought = AntimatterDimension(1).bought;
    res.auto.beforeBought = before1;
  } catch (e) { autoErr = String(e && e.message || e); }
  res.auto.err = autoErr;
  res.after = { AD1: snap(1), AD8: snap(8) };
  return res;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
