// [Oreki R27] 诊断：A147 卡在哪些 RU；符文库存与膨胀解锁状态
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const ROOT = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const PORT = Number(process.argv[3] || 8281);
const SECONDS = Number(process.argv[4] || 60);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" }); res.end(data); });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const { browser, cleanup } = await launchBrowser({ port: PORT + 100, headless: true });
const { page, errors } = await openGame(browser, { port: PORT, url: "http://127.0.0.1" });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) { const ok = await page.evaluate(() => typeof player === "object" && typeof gameLoop === "function").catch(() => false); if (ok) break; await new Promise(r => setTimeout(r, 400)); }
await page.evaluate(() => { try { player.auto.autobuyersOn = true; } catch (e) {} try { GameSpeed.set(10000); } catch (e) {} });

await new Promise(r => setTimeout(r, SECONDS * 1000));

const diag = await page.evaluate(() => {
  const out = { ru: [], dilation: null, epLog: null, rmLog: null, glyphs: null, realities: player.realities };
  try { out.dilation = PlayerProgress.dilationUnlocked(); } catch (e) {}
  try { out.epLog = Currency.eternityPoints.value.toNumber ? Math.log10(Currency.eternityPoints.value.toNumber()) : null; } catch (e) {}
  try { out.rmLog = Currency.realityMachines.value.toNumber ? (()=>{const n=Currency.realityMachines.value.toNumber(); return Number.isFinite(n)?Math.log10(n):"INF";})() : null; } catch (e) {}
  const inv = [];
  try {
    for (const g of Glyphs.inventoryList) { if (g && g.type !== "companion") inv.push({ type: g.type, level: g.level, strength: Math.round(g.strength*100)/100, effects: g.effects }); }
  } catch (e) {}
  out.glyphCount = inv.length;
  out.glyphMaxLevel = inv.length ? Math.max(...inv.map(g=>g.level)) : 0;
  out.glyphs = inv.slice(0, 12);
  try {
    for (let id = 1; id <= 25; id++) {
      const u = RealityUpgrade(id);
      let req = null;
      try { req = u.config.checkRequirement ? u.config.checkRequirement() : null; } catch (e) { req = "ERR"; }
      out.ru.push({ id, bought: u.isBought, avail: u.isAvailableForPurchase, req });
    }
  } catch (e) { out.ruErr = String(e); }
  return out;
});
console.log("realities:", diag.realities, "dilationUnlocked:", diag.dilation, "epLog:", diag.epLog, "rmLog:", diag.rmLog);
console.log("glyphCount:", diag.glyphCount, "maxLevel:", diag.glyphMaxLevel);
console.log("RU 状态 (id bought avail reqMet):");
for (const r of diag.ru) console.log(`  RU${String(r.id).padStart(2)}  bought=${String(r.bought).padStart(5)}  avail=${String(r.avail).padStart(5)}  reqMet=${String(r.req).padStart(5)}`);
console.log("glyphs sample:", JSON.stringify(diag.glyphs));
console.log("errors:", errors.length, errors.slice(0,3).join(" | "));
await cleanup(); server.close();
