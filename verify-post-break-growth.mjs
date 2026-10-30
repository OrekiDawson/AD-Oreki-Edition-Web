// Break 之后的成长实测（R5.12）：看 maxAM / IP 在自动化下能涨多快，据此判断 Eternity 的现实距离。
// 用法：node verify-post-break-growth.mjs [项目目录] [端口] [秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8500);
const DURATION = Number(process.argv[4] || 120) * 1000;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof InfinityDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 起点 = 刚 Break 完成的状态（R5.11 实测终点）
const init = await page.evaluate(() => {
  try { GameIntervals.stop(); } catch (e) { /* ok */ }
  player.break = true;
  player.infinities = new Decimal(20);
  player.infinityPoints = new Decimal(10);
  player.infinityUpgrades.clear();
  player.infinityRebuyables = [0, 0, 0];
  player.IPMultPurchases = 0;
  player.challenge.normal.current = 0;
  player.records.thisInfinity.maxAM = new Decimal(1.8e308);
  player.records.thisEternity.maxIP = new Decimal(1);
  player.auto.autobuyersOn = true;
  player.auto.bigCrunch.isActive = true;
  player.auto.bigCrunch.mode = 0;
  player.auto.bigCrunch.amount = new Decimal(1);
  player.auto.bigCrunch.interval = 100;
  try { GameIntervals.start(); } catch (e) { /* ok */ }
  GameUI.update();
  return { break: player.break, ip: "10", maxAM: "1.8e308" };
});
console.log("起点:", JSON.stringify(init));

const T0 = Date.now();
const rows = [];

const tick = () => page.evaluate(() => {
  const log = (v) => {
    try {
      const l = v.log10();
      const n = (l && typeof l.toNumber === "function") ? l.toNumber() : Number(l);
      return Number.isFinite(n) ? +n.toFixed(1) : null;
    } catch (e) { return null; }
  };
  const acts = [];
  // 买可买的非重复升级 / ipMult
  for (const u of InfinityUpgrade.all) {
    try { if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); acts.push("upg"); } } catch (e) { /* ignore */ }
  }
  try { if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.purchase(); acts.push("ipMult"); } } catch (e) { /* ignore */ }
  // 买 Infinity Dimension（1..8），能买就买
  for (let t = 0; t < 8; t++) {
    try {
      const d = InfinityDimensions.all[t];
      if (d.isAvailableForPurchase && d.canBeBought) { d.buy(); acts.push("ID" + (t + 1)); }
    } catch (e) { /* ignore */ }
  }
  return {
    t: Date.now(),
    ipLog: log(player.infinityPoints),
    maxAMLog: log(player.records.thisInfinity.maxAM),
    maxIPLog: log(player.records.thisEternity.maxIP),
    infs: log(player.infinities),
    ipMult: player.IPMultPurchases,
    id1: (() => { try { return InfinityDimensions.all[0].amount.toString(); } catch (e) { return "?"; } })(),
    idBought: (() => { try { return InfinityDimensions.all.slice(0, 3).map(d => d.bought); } catch (e) { return null; } })(),
    idUnlocked: (() => { try { return InfinityDimensions.all[0].isAvailableForPurchase; } catch (e) { return null; } })(),
    gainLog: log(gainedInfinityPoints()),
    canEternity: (() => { try { return Player.canEternity; } catch (e) { return false; } })(),
    acts: acts.length,
  };
});

let eternityAt = null;
while (Date.now() - T0 < DURATION) {
  const r = await tick().catch(e => ({ err: String(e) }));
  if (r.err && !globalThis.__firstErrLogged) { globalThis.__firstErrLogged = true; console.log("首次 tick 异常：", r.err.slice(0, 300)); }
  if (!r.err) {
    const t = +((r.t - T0) / 1000).toFixed(1);
    if (rows.length === 0 || t - rows[rows.length - 1].t >= 5) rows.push({ ...r, t });
    if (r.err === undefined && rows.length === 0) rows.push({ ...r, t });
    if (r.canEternity && eternityAt === null) eternityAt = t;
  }
  await new Promise(r2 => setTimeout(r2, 300));
}

console.log("\n采样：t | IP(10^x) | maxAM(10^x) | maxIP(10^x) | 无限(10^x) | ipMult | ID1 | ID1-3 bought | 单次IP(10^x)");
for (const r of rows) {
  console.log(`t=${String(r.t).padStart(6)} | ${String(r.ipLog).padStart(7)} | ${String(r.maxAMLog).padStart(9)} | ${String(r.maxIPLog).padStart(9)} | ${String(r.infs).padStart(6)} | ${String(r.ipMult).padStart(2)} | ${String(r.id1).slice(0, 10).padStart(10)} | ${JSON.stringify(r.idBought)} | ${r.gainLog} | ID1可用=${r.idUnlocked}`);
}
if (errs.length) console.log(`\n页面异常 ${errs.length} 条：${errs.slice(0, 3).join(" | ")}`);
console.log(`\n总运行 ${((Date.now() - T0) / 1000).toFixed(0)} s；Eternity 可执行=${eternityAt ?? "否"}`);

await browser.close();
server.close();
