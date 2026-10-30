// IP 经济实测：从「首次无限后」出发，按最优顺序自动买升级，记录现实时间线。
//
// 目的（R5.10 任务 A）：把 R5.9 的源码推算换成真实数字——
//   1) 未 Break 时是否真的 1 IP/次；
//   2) 买满非重复升级 + ipMult 后，每次坍缩 IP 怎么涨；
//   3) 攒到 32,767 IP 把坍缩自动器间隔拉满、并 Break Infinity，需要多少现实秒；
//   4) 达到 Eternity 门槛（maxIP ≥ 1.79e308）需要多少现实秒。
//
// 用法：node verify-ip-economy.mjs [项目目录] [端口] [总时长秒]
// 说明：这是**自动化玩家**的最优操作，不代表普通玩家；但能给出这条链的现实下界。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8480);
const DURATION = Number(process.argv[4] || 180) * 1000;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
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
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof GameUI === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 起点：刚完成第一次无限（IP=1、无升级、未 Break）
const init = await page.evaluate(() => {
  try { GameIntervals.stop(); } catch (e) { /* 允许失败 */ }
  player.infinities = new Decimal(1);
  player.infinityPoints = new Decimal(1);
  player.break = false;
  player.infinityUpgrades.clear();
  player.infinityRebuyables = [0, 0, 0];
  player.IPMultPurchases = 0;
  player.records.thisInfinity.maxAM = new Decimal(1.8e308);
  player.auto.autobuyersOn = true;
  player.auto.bigCrunch.isActive = true;
  player.auto.bigCrunch.mode = 0;
  player.auto.bigCrunch.amount = new Decimal(1);
  player.auto.bigCrunch.interval = 150000;
  player.auto.bigCrunch.cost = 1;
  try { GameIntervals.start(); } catch (e) { /* 允许失败 */ }
  GameUI.update();
  return {
    ip: String(player.infinityPoints),
    interval: player.auto.bigCrunch.interval,
    upgrades: player.infinityUpgrades.size,
  };
});
console.log("起点:", JSON.stringify(init));

const T0 = Date.now();
const samples = [];
const stages = {};
let breakAt = null, eternityAt = null, maxedAt = null;

const step = () => page.evaluate(() => {
  const out = { bought: 0, ipMultBought: 0, intervalUpgraded: 0 };
  // 1. 买可买得起的非重复 Infinity Upgrade
  for (const u of InfinityUpgrade.all) {
    try {
      if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); out.bought++; }
    } catch (e) { /* 单条失败不影响整体 */ }
  }
  // 2. 买 ipMult（可重复，×2/次）
  try {
    if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.purchase(); out.ipMultBought++; }
  } catch (e) { /* ignore */ }
  // 3. 拉满坍缩自动器间隔（Break Infinity 的唯一硬前置）
  try {
    if (!Autobuyer.bigCrunch.hasMaxedInterval && Autobuyer.bigCrunch.canBeUpgraded) {
      Autobuyer.bigCrunch.upgradeInterval();
      out.intervalUpgraded++;
    }
  } catch (e) { /* ignore */ }
  // 4. Break Infinity（前置满足时）
  try {
    if (!player.break && Autobuyer.bigCrunch.hasMaxedInterval) breakInfinity();
  } catch (e) { /* ignore */ }
  const fmt = v => {
    try {
      if (v && typeof v.mantissa === "number") return `${v.mantissa.toFixed(2)}e${v.exponent}`;
      return String(v);
    } catch (e) { return "?"; }
  };
  const st = {
    t: Date.now(),
    ip: player.infinityPoints,
    maxIP: player.records.thisEternity.maxIP,
    infinities: player.infinities,
    interval: Autobuyer.bigCrunch.interval,
    breakFlag: player.break,
    upg: player.infinityUpgrades.size,
    ipMult: player.IPMultPurchases,
    canEternity: Player.canEternity,
    gained: gainedInfinityPoints(),
    canUpgradeInterval: (() => { try { return Autobuyer.bigCrunch.canBeUpgraded; } catch (e) { return null; } })(),
  };
  for (const k of ["ip", "maxIP", "infinities", "gained"]) st[k] = fmt(st[k]);
  return { out, st };
});

while (Date.now() - T0 < DURATION) {
  const r = await step().catch(e => ({ st: null, err: String(e) }));
  if (r.st) {
    const t = (r.st.t - T0) / 1000;
    const rec = {
      t: +t.toFixed(1),
      ip: r.st.ip.toString(),
      maxIP: r.st.maxIP.toString(),
      inf: r.st.infinities.toString(),
      interval: r.st.interval,
      brk: r.st.breakFlag,
      upg: r.st.upg,
      ipMult: r.st.ipMult,
      gain: r.st.gained,
      ci: r.st.canUpgradeInterval,
    };
    if (samples.length === 0 || t - samples[samples.length - 1].t >= 5) samples.push(rec);
    if (rec.upg >= 16 && !stages.upg16) stages.upg16 = t;
    if (rec.ipMult >= 1 && !stages.ipMult1) stages.ipMult1 = t;
    if (rec.interval <= 100 && maxedAt === null) { maxedAt = t; stages.maxed = t; }
    if (rec.brk && breakAt === null) { breakAt = t; stages.breakInfinity = t; }
    if (r.st.canEternity && eternityAt === null) { eternityAt = t; stages.eternity = t; }
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log("\n阶段时间线（秒，自起点算起）：");
console.log(JSON.stringify(stages, null, 2));
console.log("\n采样（每 ~5 s）：");
for (const s of samples) {
  console.log(`t=${String(s.t).padStart(6)}s  IP=${s.ip.padEnd(12)} maxIP=${s.maxIP.padEnd(12)} inf=${s.inf.padEnd(6)} 间隔=${String(s.interval).padStart(6)} Break=${s.brk ? "Y" : "n"} 升级=${s.upg} ipMult=${s.ipMult} 单次IP=${s.gain} 可升间隔=${s.ci}`);
}
if (errs.length) console.log(`\n页面异常 ${errs.length} 条：${errs.slice(0, 3).join(" | ")}`);

await browser.close();
server.close();
console.log(`\n总运行 ${((Date.now() - T0) / 1000).toFixed(0)} s；Break=${breakAt ?? "未达成"}；Eternity=${eternityAt ?? "未达成"}`);
