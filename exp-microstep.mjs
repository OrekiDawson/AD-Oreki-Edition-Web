// 受控 A/B：每帧微步上限（MICRO_STEP_MAX）对 Break 后 maxAM 成长速率的影响（R5.13）
//
// 单实例、不 stop/start 游戏循环、同一起点与同一自动化设置。
// 用法：node exp-microstep.mjs [项目目录] [端口] [总秒数] [标签]
// 输出：Break 时刻、窗口 [W1,W2] 内的 Δlog10(maxAM)/秒、ID1 状态、提升/星系变化。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8520);
const DURATION = Number(process.argv[4] || 240) * 1000;
const LABEL = process.argv[5] || "run";
const MODE = process.env.OREKI_BC_MODE === undefined ? 0 : Number(process.env.OREKI_BC_MODE);
const XHIGH = Number(process.env.OREKI_BC_XHIGH || 10);
const BUY_BI = !!process.env.OREKI_BUY_BI;
const STALL_CRUNCH = !!process.env.OREKI_STALL_CRUNCH;
const FORCE_MODE = process.env.OREKI_FORCE_MODE;
const MAXREB = !!process.env.OREKI_MAXREB;   // "0"=AMOUNT/1 频繁坍缩
const W1 = 150, W2 = 240;
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
  const ok = await page.evaluate((mode, xhigh) => { try { return typeof player === "object" && typeof NormalChallenge === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 与 verify-id-to-eternity 完全一致的起点
await page.evaluate((mode, xhigh) => {
  player.infinities = new Decimal(1);
  player.infinityPoints = new Decimal(1);
  player.break = false;
  player.infinityUpgrades.clear();
  player.infinityRebuyables = [0, 0, 0];
  player.IPMultPurchases = 0;
  player.challenge.normal.current = 0;
  player.records.thisInfinity.maxAM = new Decimal(1.8e308);
  player.auto.autobuyersOn = true;
  player.auto.bigCrunch.isActive = true;
  player.auto.bigCrunch.mode = mode;
  player.auto.bigCrunch.amount = new Decimal(1);
  player.auto.bigCrunch.xHighest = new Decimal(xhigh);
  player.auto.bigCrunch.interval = 150000;
  player.auto.bigCrunch.cost = 1;
  GameUI.update();
}, MODE, XHIGH);

const T0 = Date.now();
let breakAt = null;
const rows = [];
const tick = () => page.evaluate((buyBI, stallCrunch, forceMode, maxreb) => {
  const L = v => (v && typeof v.mantissa === "number") ? (v.exponent + Math.log10(v.mantissa)) : null;
  const log = { act: [] };
  // 与主脚本一致的操作序列
  if (player.challenge.normal.current === 0) {
    for (const id of [10, 11, 12]) {
      try { const c = NormalChallenge(id); if (c.isUnlocked && !c.isCompleted) { c.start(); break; } } catch (e) { /* ignore */ }
    }
  }
  for (const u of InfinityUpgrade.all) {
    try { if (u.isAvailableForPurchase && u.canBeBought) u.purchase(); } catch (e) { /* ignore */ }
  }
  try { if (InfinityUpgrade.ipMult.canBeBought) InfinityUpgrade.ipMult.purchase(); } catch (e) { /* ignore */ }
  if (buyBI) {
    for (const u of BreakInfinityUpgrade.all) {
      try { if (u.isAvailableForPurchase) u.purchase(); } catch (e) { /* ignore */ }
    }
  }
  try { if (!Autobuyer.bigCrunch.hasMaxedInterval && Autobuyer.bigCrunch.canBeUpgraded) Autobuyer.bigCrunch.upgradeInterval(); } catch (e) { /* ignore */ }
  try { if (!player.break && Autobuyer.bigCrunch.hasMaxedInterval) breakInfinity(); } catch (e) { /* ignore */ }
  for (let t = 1; t <= 8; t++) {
    try { const d = InfinityDimension(t); if (!d.isUnlocked) { if (d.canUnlock) d.unlock(); } else if (d.isAvailableForPurchase) d.buyMax(); } catch (e) { /* ignore */ }
  }
  if (maxreb && player.break) {
    // 模拟「成本缩放升级已满级」（玩家可购买状态），验证它是否是突破点
    player.infinityRebuyables = [8, 8, 8];
  }
  if (forceMode !== null && forceMode !== undefined && player.break) {
    // 覆盖 AU4b 的策略归一化，用于测试「频繁坍缩累积 IP」
    player.auto.bigCrunch.mode = Number(forceMode);
    // amount=10 可绕开 AU4b 的 (mode==AMOUNT && amount<10) 归一化，测「频繁坍缩累积 IP」
    player.auto.bigCrunch.amount = new Decimal(10);
  }
  if (stallCrunch && player.break) {
    // 停滞检测：所有反物质维度都买不起 = 产量无法再复利，只能线性累积
    let anyAffordable = false;
    for (let t = 1; t <= 8; t++) {
      try { if (AntimatterDimension(t).isAvailableForPurchase) { anyAffordable = true; break; } } catch (e) { /* ignore */ }
    }
    if (!anyAffordable) {
      let gain = new Decimal(0);
      try { gain = gainedInfinityPoints(); } catch (e) { /* ignore */ }
      if (gain.gte(1)) {
        try { bigCrunchReset(); } catch (e) { /* ignore */ }
      }
    }
  }
  return {
    real: (() => { try { return Math.round(player.records.realTimePlayed); } catch (e) { return null; } })(),
    maxAML: L(player.records.thisInfinity.maxAM),
    ipL: L(player.infinityPoints),
    infL: L(player.infinities),
    brk: player.break,
    boosts: player.dimensionBoosts, galaxies: player.galaxies,
    id1: (() => { try { const d = InfinityDimension(1); return { unlocked: d.isUnlocked, can: d.canUnlock }; } catch (e) { return null; } })(),
    nc: player.challenge.normal.current,
    gainL: (() => { try { return L(gainedInfinityPoints()); } catch (e) { return null; } })(),
  };
});

while (Date.now() - T0 < DURATION) {
  const s = await tick().catch(e => ({ err: String(e) }));
  if (s.err) { console.log("快照失败:", s.err); break; }
  const t = +((Date.now() - T0) / 1000).toFixed(1);
  s.t = t;
  rows.push(s);
  if (s.brk && breakAt === null) breakAt = t;
  if (Math.round(t) % 60 === 0 && Math.round(t) !== Math.round(t - 0.5)) {
    console.log(`  t=${String(Math.round(t)).padStart(4)}s maxAM=10^${s.maxAML?.toFixed(1)} IP=10^${s.ipL?.toFixed(2)} inf=10^${s.infL?.toFixed(2)} 提升=${s.boosts} 星系=${s.galaxies} ID1=${s.id1?.unlocked ? "Y" : "n"}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

const at = (target) => rows.reduce((best, r) => Math.abs(r.t - target) < Math.abs(best.t - target) ? r : best, rows[0]);
const a = at(W1), b = at(W2);
const rate = (b.maxAML - a.maxAML) / (b.t - a.t);
const last = rows[rows.length - 1];
console.log(`\n===== 实验 ${LABEL} =====`);
console.log(`Break 时刻: ${breakAt === null ? "未 Break" : breakAt + " s"}`);
console.log(`窗口 ${a.t}s → ${b.t}s：maxAM 10^${a.maxAML?.toFixed(1)} → 10^${b.maxAML?.toFixed(1)}`);
console.log(`**Δlog10(maxAM)/秒 = ${rate.toFixed(3)}**`);
console.log(`终点: IP=10^${last.ipL?.toFixed(2)} inf=10^${last.infL?.toFixed(2)} 单次IP=10^${last.gainL?.toFixed(2)} 提升=${last.boosts} 星系=${last.galaxies} 挑战=${last.nc}`);
console.log(`ID1: 解锁=${last.id1?.unlocked} 可解锁=${last.id1?.can}；游戏现实时间=${last.real}ms（应≈${Math.round(last.t * 1000)}）`);
if (errs.length) console.log(`页面异常 ${errs.length}：${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
