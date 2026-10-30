// 一次性探针：读出 Eternity 门槛的真实构成（totalEPMult / cursedEP / ShopPurchase / requiredIPForEP）。
// 目的：确认「永恒门槛为何是 1e308.25 而不是公式算出的 1e215.6」。
// 不修改任何游戏状态，纯读取。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8690);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const out = await page.evaluate(() => {
  const L = v => { try { if (v === null || v === undefined) return null; if (typeof v === "number") return v; const s = v.toString(); const i = s.indexOf("e"); if (i >= 0) { const m = Number(s.slice(0, i)); const e = Number(s.slice(i + 1)); return +(Math.log10(Math.abs(m)) + e).toFixed(3); } return Number(s); } catch (e) { return "ERR:" + e.message; } };
  const N = v => { try { return Number(v.toString()); } catch (e) { return "ERR:" + e.message; } };
  const res = {};
  res.eternityGoalL = L(Player.eternityGoal);
  res.requiredIPForEP_1 = L(requiredIPForEP(1));
  res.numberMaxValue = Math.log10(Number.MAX_VALUE);
  try { res.numberMaxValue = Math.log10(Number.MAX_VALUE); } catch (e) { /* ignore */ }
  try { res.cursedEP = L(getAdjustedGlyphEffect("cursedEP")); } catch (e) { res.cursedEP = "ERR:" + e.message; }
  try { res.shopEPMult = L(ShopPurchase.EPPurchases.currentMult); } catch (e) { res.shopEPMult = "ERR:" + e.message; }
  try { res.epMultEffect = L(EternityUpgrade.epMult.effectOrDefault(1)); } catch (e) { res.epMultEffect = "ERR:" + e.message; }
  try { res.glyphEffectEP = L(GlyphEffect.epMult); } catch (e) { res.glyphEffectEP = "ERR:" + e.message; }
  // 手算 totalEPMult（与 game.js 同式）
  try {
    let m = getAdjustedGlyphEffect("cursedEP")
      .times(ShopPurchase.EPPurchases.currentMult)
      .timesEffectsOf(EternityUpgrade.epMult, TimeStudy(61), TimeStudy(122), TimeStudy(121), TimeStudy(123), RealityUpgrade(12), GlyphEffect.epMult);
    res.manualEPMultL = L(m);
    res.manualRequiredIP = L(Decimal.pow10(Decimal.add(Decimal.mul(Decimal.log(Decimal.divide(1, m), 5), 308), 215.6)).clampMin(Number.MAX_VALUE));
  } catch (e) { res.manualEPMultL = "ERR:" + e.message; }
  // Decimal.log 的直接行为
  try { res.decimalLog_1 = L(Decimal.log(1, 5)); } catch (e) { res.decimalLog_1 = "ERR:" + e.message; }
  try { res.decimalLog_div = L(Decimal.log(Decimal.divide(1, 1), 5)); } catch (e) { res.decimalLog_div = "ERR:" + e.message; }
  try { res.decimalLog10_1 = L(Decimal.log(1)); } catch (e) { res.decimalLog10_1 = "ERR:" + e.message; }
  // raw 字符串形式（Decimal.toString 不走 valueOf）
  try { res.raw_log1_5 = Decimal.log(1, 5).toString(); } catch (e) { res.raw_log1_5 = "ERR:" + e.message; }
  try { res.raw_log10_1 = Decimal.log(1).toString(); } catch (e) { res.raw_log10_1 = "ERR:" + e.message; }
  // 玩家当前状态
  res.ip = L(player.infinityPoints);
  res.maxIP = L(player.records.thisEternity.maxIP);
  res.maxAM_et = L(player.records.thisEternity.maxAM);
  res.infinities = Number(player.infinities);
  res.break = player.break;
  res.eternityUnlocked = PlayerProgress.eternityUnlocked();
  res.gameSpeed = (() => { try { return getGlobalSpeedFactor(); } catch (e) { return "ERR:" + e.message; } })();
  return res;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
