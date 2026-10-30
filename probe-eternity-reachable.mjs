// 决定性探针：Eternity 门槛到底可达吗？
// 关键问题：
//  1. requiredIPForEP(1) = 1.797e308（clampMin 后）
//  2. Player.canEternity = thisEternity.maxIP >= eternityGoal
//  3. thisEternity.maxIP 来自 Currency.infinityPoints.add() 的历史最大值
//  4. 未 Break 时每次坍缩固定 1 IP → 需要 1.797e308 次坍缩
//  5. Break 后 gainedInfinityPoints = 10^(maxAM.log10()/div - 0.75)
//     若 maxAM = 1e308 → 10^(308 - 0.75) = 1e307.25  ← 一次坍缩就接近门槛！
//  6. 所以：Break 之后，靠「反物质爬到 1e308」+「连续多次坍缩累加 maxIP」是可行的。
//     但 maxIP 是「余额」不是「累计」→ 每次坍缩后余额被花掉（买升级），
//     maxIP 取历史最大 → 需要单次收益接近 1.797e308，或者多次坍缩之间不花。
//
// 本探针要测的是：真实运行时能否让 maxIP 达到 1.797e308。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8761);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { launchBrowser, openGame } = await import("./lib/edge-launch.mjs");
const { browser, cleanup, port: edgePort } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9410) });
const { page, errors: errs } = await openGame(browser, { port });
void edgePort;

// ── 第一部分：纯数学推演，不动游戏状态 ──────────────────────────
const math = await page.evaluate(() => {
  const out = {};
  const D = (x) => new Decimal(x);
  const S = (v) => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return String(v); } };
  const lg = (v) => { const t = S(v); const i = t.indexOf("e"); return i >= 0 ? Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1)) : Math.log10(Math.abs(Number(t))); };

  out.goal = S(Player.eternityGoal);
  out.goalLog = lg(Player.eternityGoal);
  out.maxValue = S(Decimal.NUMBER_MAX_VALUE);
  out.maxValueLog = lg(Decimal.NUMBER_MAX_VALUE);

  // 各种 maxAM 下，Break 后单次坍缩能拿多少 IP（div=308，未乘 totalIPMult）
  const div = 308;
  out.crunchIP = {};
  for (const amLog of [100, 200, 250, 300, 308, 310, 320, 400, 500, 1000]) {
    const ip = Decimal.pow10(amLog / div - 0.75);
    out.crunchIP["maxAM=1e" + amLog] = S(ip);
  }

  // totalIPMult 的构成与可达性
  out.totalIPMult = S(GameCache.totalIPMult.value);
  out.totalIPMultLog = lg(GameCache.totalIPMult.value);

  // 无限升级里与 IP 倍率相关的
  out.ipMultPurchases = player.IPMultPurchases;
  out.ipMultEffect = S(InfinityUpgrade.ipMult.effect);
  out.ipGenBought = InfinityUpgrade.ipGen.isBought;
  out.unspentBought = InfinityUpgrade.unspentIPMult.isBought;
  out.dimboostMultBought = InfinityUpgrade.dimboostMult.isBought;
  out.thisInfinityTimeMultBought = InfinityUpgrade.thisInfinityTimeMult.isBought;
  out.infinityUpgradesBought = [...player.infinityUpgrades];

  // 商店 IPPurchases（提升 totalIPMult）
  out.IPPurchases = player.IPPurchases;
  out.IPPurchasesUnlocked = ShopPurchase.IPPurchases.isUnlocked;
  out.IPPurchasesMult = S(ShopPurchase.IPPurchases.currentMult);

  // 成就 103（提升 div → 降低 IP 需求）
  out.ach103 = Achievement(103).isUnlocked;
  out.ach103Effect = S(Achievement(103).effect);

  // IP 倍率相关成就
  out.ach85 = Achievement(85).isUnlocked;
  out.ach93 = Achievement(93).isUnlocked;
  out.ach116 = Achievement(116).isUnlocked;
  out.ach125 = Achievement(125).isUnlocked;
  out.ach41 = Achievement(41).isUnlocked;

  // ID1 解锁条件
  try {
    const id1 = InfinityDimension(1);
    out.id1 = { unlocked: id1.isUnlocked, amReq: S(id1.amRequirement), ipReq: S(id1.ipRequirement), canUnlock: id1.canUnlock };
  } catch (e) { out.id1 = String(e && e.message || e); }

  return out;
});
console.log("===== 数学推演 =====");
console.log(JSON.stringify(math, null, 2));

// ── 第二部分：模拟「Break 后连续坍缩」，maxIP 能爬到多高 ──────────
// 直接调 gainedInfinityPoints 计算，不改游戏状态
const sim = await page.evaluate(() => {
  const D = (x) => new Decimal(x);
  const out = [];
  // 假设已 Break，thisInfinity.maxAM = 1e308，div=308
  for (const amLog of [308, 350, 400, 500]) {
    const ip = Decimal.pow10(amLog / 308 - 0.75);
    out.push({ amLog, ip: ip.toString() });
  }
  return out;
});
console.log("\n===== Break 后单次坍缩收益（div=308）=====");
for (const s of sim) console.log(`  maxAM=1e${s.amLog} → 单次坍缩 IP = ${s.ip}`);

if (errs.length) console.log("\n页面异常:", errs.slice(0, 3));
await cleanup();
server.close();
