// 真实新档轨迹（R9）：不做任何状态注入，从 index.html 全新开始，
// 用与玩家等价的简单操作（每 400ms 买所有买得起的）推进，记录里程碑与首个阻塞点。
// 用法：node newgame-trace.mjs [项目目录] [端口] [秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8550);
const SEC = Number(process.argv[4] || 900);
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

// 全新存档：显式清空（等价于「新游戏」入口之后的初始状态）
await page.evaluate(() => {
  try { GameSave.loadNewSave?.(); } catch (e) { /* 不存在则忽略 */ }
  if (typeof player !== "object") return;
  try { player.auto.autobuyersOn = true; } catch (e) { /* ignore */ }
});

const T0 = Date.now();
const marks = {};
let lastAct = "";
const rows = [];
const tick = () => page.evaluate(() => {
  const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(2) : null;
  const act = [];
  // 与玩家等价的通用操作：所有买得起的都买
  for (let t = 8; t >= 1; t--) {
    try {
      const d = AntimatterDimension(t);
      if (d.isAvailableForPurchase) { buyMaxDimension(t); act.push("ad" + t); }
      else if (d.isAffordable && d.isUnlocked !== false) { d.buy(1); act.push("ad1x" + t); }
    } catch (e) { /* ignore */ }
  }
  try { if (Tickspeed.isAvailableForPurchase) { Tickspeed.buyMax(); act.push("ts"); } } catch (e) { /* ignore */ }
  try { if (DimBoost.canBeBought) { requestDimensionBoost(1); act.push("boost"); } } catch (e) { /* ignore */ }
  try { if (Galaxy.canBeBought) { requestGalaxyReset(1); act.push("galaxy"); } } catch (e) { /* ignore */ }
  try { if (Player.canCrunch && gainedInfinityPoints().gte(1)) { bigCrunchReset(); act.push("crunch"); } } catch (e) { /* ignore */ }
  for (const u of InfinityUpgrade.all) { try { if (u.canBeBought) { u.purchase(); act.push("infUpg"); } } catch (e) { /* ignore */ } }
  for (const u of BreakInfinityUpgrade.all) { try { if (u.canBeBought) { u.purchase(); act.push("biUpg"); } } catch (e) { /* ignore */ } }
  return {
    act,
    amL: L(Currency.antimatter.value), maxAML: L(player.records.thisInfinity.maxAM),
    ipL: L(player.infinityPoints), inf: L(player.infinities),
    boosts: player.dimensionBoosts, galaxies: player.galaxies,
    brk: player.break, et: L(player.eternities),
    ad: (() => { const a = []; for (let t = 1; t <= 8; t++) { try { a.push(AntimatterDimension(t).bought); } catch (e) { a.push(-1); } } return a; })(),
    gainL: (() => { try { return L(gainedInfinityPoints()); } catch (e) { return null; } })(),
    id1: (() => { try { const d = InfinityDimension(1); return { u: d.isUnlocked, c: d.canUnlock }; } catch (e) { return null; } })(),
  };
});

while (Date.now() - T0 < SEC * 1000) {
  const s = await tick().catch(e => ({ err: String(e) }));
  if (s.err) { console.log("ERR", s.err); break; }
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, cond) => { if (cond && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次维度提升", s.boosts >= 1);
  mark("首次星系", s.galaxies >= 1);
  mark("首次无限", (s.inf ?? 0) >= 1);
  mark("无限10次", (s.inf ?? 0) >= 1 && s.inf >= 1);   // 占位，细看下面
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1 && s.id1.u === true);
  rows.push({ t, ...s });
  if (t % 20 === 0) {
    console.log(`t=${String(t).padStart(4)}s AM=10^${s.amL} IP=10^${s.ipL} inf=10^${s.inf} 提升=${s.boosts} 星系=${s.galaxies} AD=[${s.ad.join(",")}] 单次IP=10^${s.gainL} Break=${s.brk ? "Y" : "n"} ID1=${s.id1?.u ? "Y" : "n"}`);
  }
  await new Promise(r => setTimeout(r, 400));
}

const last = rows[rows.length - 1];
console.log(`\n===== 真实新档 ${SEC}s 结论 =====`);
console.log(`里程碑: ${JSON.stringify(marks)}`);
console.log(`终点: AM=10^${last.amL} maxAM=10^${last.maxAML} IP=10^${last.ipL} inf=10^${last.inf} 提升=${last.boosts} 星系=${last.galaxies} AD=[${last.ad.join(",")}]`);
console.log(`ID1: 解锁=${last.id1?.u} 可解锁=${last.id1?.c}`);
if (errs.length) console.log(`页面异常 ${errs.length}: ${errs.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
