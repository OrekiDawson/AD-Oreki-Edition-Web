// 定点探针：Break 后卡住时的完整状态快照（R5.13）
// 跑与主脚本一致的流程，到指定秒数时一次性 dump，不做连续采样干扰。
// 用法：node probe-stall.mjs [项目目录] [端口] [秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8525);
const SEC = Number(process.argv[4] || 175);
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
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof NormalChallenge === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
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
  player.auto.bigCrunch.mode = 2;          // X_HIGHEST（= AU4b 真实策略）
  player.auto.bigCrunch.xHighest = new Decimal(10);
  player.auto.bigCrunch.interval = 150000;
  player.auto.bigCrunch.cost = 1;
  GameUI.update();
});

const T0 = Date.now();
const act = () => page.evaluate(() => {
  if (player.challenge.normal.current === 0) {
    for (const id of [10, 11, 12]) {
      try { const c = NormalChallenge(id); if (c.isUnlocked && !c.isCompleted) { c.start(); break; } } catch (e) { /* ignore */ }
    }
  }
  for (const u of InfinityUpgrade.all) { try { if (u.isAvailableForPurchase && u.canBeBought) u.purchase(); } catch (e) { /* ignore */ } }
  try { if (InfinityUpgrade.ipMult.canBeBought) InfinityUpgrade.ipMult.purchase(); } catch (e) { /* ignore */ }
  try { if (!Autobuyer.bigCrunch.hasMaxedInterval && Autobuyer.bigCrunch.canBeUpgraded) Autobuyer.bigCrunch.upgradeInterval(); } catch (e) { /* ignore */ }
  try { if (!player.break && Autobuyer.bigCrunch.hasMaxedInterval) breakInfinity(); } catch (e) { /* ignore */ }
});
while (Date.now() - T0 < SEC * 1000) { await act(); await new Promise(r => setTimeout(r, 400)); }

const dump = await page.evaluate(() => {
  const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(1) : null;
  const out = {
    am: L(Currency.antimatter.value),
    maxAM: L(player.records.thisInfinity.maxAM),
    ip: L(player.infinityPoints),
    gain: L((() => { try { return gainedInfinityPoints(); } catch (e) { return null; } })()),
    inf: L(player.infinities),
    break: player.break,
    bc: { mode: player.auto.bigCrunch.mode, xHighest: String(player.auto.bigCrunch.xHighest), interval: player.auto.bigCrunch.interval, lastTick: player.auto.bigCrunch.lastTick, active: player.auto.bigCrunch.isActive },
    F: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return null; } })(),
    boosts: player.dimensionBoosts, galaxies: player.galaxies,
    boostReq: (() => { try { return L(DimBoost.requirement); } catch (e) { return null; } })(),
    galaxyReq: (() => { try { return L(Galaxy.requirement); } catch (e) { return null; } })(),
    ts: L(Tickspeed.current), tsCost: (() => { try { return L(Tickspeed.cost); } catch (e) { return null; } })(),
    prod1: (() => { try { return L(AntimatterDimension(1).productionPerSecond); } catch (e) { return null; } })(),
    ad: [],
    gates: (() => {
      const ab = (() => { try { return Autobuyer.bigCrunch; } catch (e) { return null; } })();
      if (!ab) return { err: "no Autobuyer.bigCrunch" };
      const g = (k, fn) => { try { return fn(); } catch (e) { return "ERR:" + (e && e.message || e); } };
      return {
        isUnlocked: g("a", () => ab.isUnlocked),
        isActive: g("b", () => ab.isActive),
        autobuyersOn: g("c", () => player.auto.autobuyersOn),
        g_unlockGate: g("d", () => (ab.isUnlocked ? "true" : "false")),
        canTick: g("e", () => ab.canTick),
        canBeUpgraded: g("f", () => ab.canBeUpgraded),
        interval: g("g", () => ab.interval),
        effectiveInterval: g("h", () => ab.effectiveInterval),
        timeSinceLastTick: g("i", () => ab.timeSinceLastTick),
        mode: g("j", () => ab.mode),
        canCrunch: g("k", () => Player.canCrunch),
        gain: g("l", () => String(gainedInfinityPoints())),
        highestIP: g("m", () => String(player.records.thisEternity.maxIP)),
        infinityGoal: g("n", () => String(Player.infinityGoal)),
        maxAM: g("o", () => String(player.records.thisEternity.maxAM)),
      };
    })(),
  };
  for (let t = 1; t <= 8; t++) {
    try {
      const d = AntimatterDimension(t);
      out.ad.push({
        t, bought: d.bought, amount: L(d.amount), cost: L(d.cost),
        capped: (() => { try { return d.isCapped; } catch (e) { return null; } })(),
        avail: (() => { try { return d.isAvailableForPurchase; } catch (e) { return null; } })(),
        cap: (() => { try { return L(d.purchaseCap); } catch (e) { return null; } })(),
        costScale: (() => { try { return d.costScalingMultiplier ?? null; } catch (e) { return null; } })(),
      });
    } catch (e) { out.ad.push({ t, err: true }); }
  }
  return out;
});

console.log(`\n===== ${SEC}s 后状态快照 =====`);
console.log(`反物质=10^${dump.am}  maxAM=10^${dump.maxAM}  IP=10^${dump.ip}  单次IP=10^${dump.gain}`);
console.log(`Break=${dump.break}  infinities=10^${dump.inf}  F=${dump.F}`);
console.log(`大坍缩自动器: ${JSON.stringify(dump.bc)}`);
console.log(`提升=${dump.boosts}（需求 AD8 10^${dump.boostReq}）  星系=${dump.galaxies}（需求 AD8 10^${dump.galaxyReq}）`);
console.log(`Tickspeed=10^${dump.ts} 其成本=10^${dump.tsCost}   AD1 产量/秒=10^${dump.prod1}`);
console.log(`\n维度明细（bought / amount / 下次成本 / 是否封顶 / 可购买 / purchaseCap / costScale）：`);
for (const a of dump.ad) {
  if (a.err) { console.log(`  AD${a.t}: 读取失败`); continue; }
  console.log(`  AD${a.t}: ${String(a.bought).padStart(5)} / 10^${a.amount} / 10^${a.cost} / capped=${a.capped} / avail=${a.avail} / cap=10^${a.cap} / scale=${a.costScale}`);
}
await browser.close();
server.close();
