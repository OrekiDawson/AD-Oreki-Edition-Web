// 诊断：Web 真新档的 IP 增长引擎与 Eternity 时间墙（v2 · 高信息量采样）。
// 目的：定位「ID1 已解锁后，IP 为何停在远低于 Eternity 门槛的水平」。
// 采集：每个 ID 的解锁/数量/产出、ipMult 购买数、totalIPMult、totalEPMult、
//       每次坍缩的 IP 增量、Replicanti、自动购买器状态、真实永恒门槛。
// 用法：node diag-ip-engine.mjs <root> <port> <秒> [fresh|break]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8680);
const SEC = Number(process.argv[4] || 600);
const MODE = process.argv[5] || "fresh";

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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 驱动：只做玩家在界面上会做的点击；不改任何状态字段。
const installErr = await page.evaluate(() => {
  try {
    const st = { bot: 0, buys: 0, boosts: 0, galaxies: 0, crunches: 0, ipMultBuys: 0, errs: [] };
    globalThis.__st = st;
    const step = () => {
      st.bot++;
      try {
        for (let t = 8; t >= 1; t--) {
          const d = AntimatterDimension(t);
          if (d.isAvailableForPurchase) { buyMaxDimension(t); st.buys++; }
        }
        if (typeof buyTickSpeed === "function") buyTickSpeed();
        if (DimBoost.canBeBought && typeof requestDimensionBoost === "function") { requestDimensionBoost(1); st.boosts++; }
        if (Galaxy.canBeBought && typeof requestGalaxyReset === "function") { requestGalaxyReset(1); st.galaxies++; }
        try {
          for (let t = 1; t <= 8; t++) {
            const d = InfinityDimension(t);
            if (!d.isUnlocked) { if (d.canUnlock) d.unlock(); }
            else if (d.isAvailableForPurchase) d.buyMax();
          }
        } catch (e) { /* ignore */ }
        for (const u of InfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
        // ipMult 是可重复升级，走它自己的 purchase 路径
        try {
          const ipm = InfinityUpgrade.ipMult;
          if (ipm.canBeBought) { ipm.purchase(); st.ipMultBuys++; }
        } catch (e) { /* ignore */ }
        try {
          const bc = Autobuyer.bigCrunch;
          for (let i = 0; i < 20 && !bc.hasMaxedInterval; i++) {
            if (Currency.infinityPoints.value.lt(bc.cost)) break;
            bc.upgradeInterval(false);
          }
          if (bc.hasMaxedInterval && !player.break && typeof breakInfinity === "function") breakInfinity();
        } catch (e) { /* ignore */ }
        try { for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); } } catch (e) { /* ignore */ }
        try {
          if (!player.break && Player.canCrunch && gainedInfinityPoints().gte(1)) { bigCrunchReset(); st.crunches++; }
          else if (player.break && !player.auto.bigCrunch.isActive) player.auto.bigCrunch.isActive = true;
        } catch (e) { /* ignore */ }
      } catch (e) { if (st.errs.length < 5) st.errs.push(String(e && e.message || e)); }
    };
    setInterval(step, 8);
    setTimeout(step, 0);
    return null;
  } catch (e) { return String(e && e.message || e); }
});
if (installErr) { console.log("驱动安装失败:", installErr); process.exit(1); }

const T0 = Date.now();
const marks = {};
const T0ISO = new Date(T0).toISOString();
const JSONL = process.env.OREKI_JSONL || "";
const NL = String.fromCharCode(10);
if (JSONL) { try { fs.appendFileSync(JSONL, JSON.stringify({ event: "start", at: T0ISO, mode: MODE }) + NL); } catch (e) {} }
let printed = -1;
let prevIp = null;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => { try { if (v === null || v === undefined) return null; if (typeof v.mantissa !== "number") return null; return +(v.exponent + Math.log10(v.mantissa)).toFixed(2); } catch (e) { return null; } };
    const st = globalThis.__st || {};
    let goalL = null, canEt = null, ipMultL = null, epMultL = null;
    try { goalL = L(Player.eternityGoal); canEt = Player.canEternity; } catch (e) {}
    try { ipMultL = L(GameCache.totalIPMult.value); } catch (e) {}
    try { epMultL = L(totalEPMult()); } catch (e) {}
    const ids = [];
    try {
      for (let t = 1; t <= 8; t++) {
        const d = InfinityDimension(t);
        ids.push({ t, u: d.isUnlocked, amtL: L(d.amount), prodL: L(d.productionPerSecond), multL: L(d.multiplier), costL: L(d.cost) });
      }
    } catch (e) { /* ignore */ }
    let id1 = null;
    try {
      const d = InfinityDimension(1);
      id1 = { u: d.isUnlocked, canUnlock: d.canUnlock, costL: L(d.cost), amReqL: L(d.amRequirement), amReached: d.antimatterRequirementReached, ipReached: d.ipRequirementReached, affordable: d.isAffordable };
    } catch (e) { id1 = null; }
    let bc = null;
    try {
      bc = { active: player.auto.bigCrunch.isActive, mode: player.auto.bigCrunch.mode, xHighest: L(player.auto.bigCrunch.xHighest), interval: player.auto.bigCrunch.interval, willInf: Autobuyer.bigCrunch.willInfinity, waiting: Autobuyer.bigCrunch.waitingForId1Peak, highestPrev: L(Autobuyer.bigCrunch.highestPrevPrestige), gainedL: L(gainedInfinityPoints()) };
    } catch (e) { bc = null; }
    let rep = null;
    try { rep = { amountL: L(Replicanti.amount), galaxies: player.replicanti.galaxies, unl: player.replicanti.unl }; } catch (e) { /* ignore */ }
    return {
      real: Date.now(), totalGame: player.records.totalTimePlayed,
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      maxIPL: L(player.records.thisEternity.maxIP),
      etGoalL: goalL, canEt, ipMultL, epMultL,
      inf: player.infinities.toNumber ? player.infinities.toNumber() : Number(player.infinities),
      et: player.eternities.toNumber ? player.eternities.toNumber() : 0,
      boosts: player.dimensionBoosts, galaxies: player.galaxies, brk: player.break,
      ipMultPurchases: player.IPMultPurchases,
      ids, id1, bc, rep,
      bot: st.bot, buys: st.buys, crunches: st.crunches, ipMultBuys: st.ipMultBuys, cerr: st.errs,
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) { await new Promise(r => setTimeout(r, 1200)); continue; }
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1?.u === true);
  mark("ID2解锁", s.ids?.[1]?.u === true);
  mark("ID3解锁", s.ids?.[2]?.u === true);
  mark("首次永恒", s.et >= 1);
  if (t % 20 === 0 && t !== printed) {
    printed = t;
    const unlockedIds = (s.ids || []).filter(x => x.u).map(x => `ID${x.t}(量1e${x.amtL}/产1e${x.prodL})`).join(" ");
    console.log(`t=${String(t).padStart(4)}s IP=1e${s.ipL} maxIP=1e${s.maxIPL} 永恒目标=1e${s.etGoalL} canEt=${s.canEt} | maxEt=1e${s.maxEtL} ipMult=1e${s.ipMultL} 购买${s.ipMultPurchases} | ${unlockedIds} | 坍缩=${s.crunches} 等待=${s.bc?.waiting} willInf=${s.bc?.willInf} 单次=1e${s.bc?.gainedL} | 提升=${s.boosts} 星系=${s.galaxies} inf=${Math.round(s.inf)}`);
  }
  if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, wall: new Date().toISOString(), elapsedMs: Date.now() - T0,
        amL: s.amL, maxInfL: s.maxInfL, maxEtL: s.maxEtL,
        ipL: s.ipL, maxIPL: s.maxIPL, etGoalL: s.etGoalL, canEt: s.canEt,
        ipMultL: s.ipMultL, epMultL: s.epMultL, ipMultPurchases: s.ipMultPurchases,
        inf: s.inf, et: s.et, boosts: s.boosts, galaxies: s.galaxies, brk: s.brk,
        ids: s.ids, id1: s.id1, bc: s.bc, rep: s.rep, crunches: s.crunches,
      }) + NL);
    } catch (e) { /* ignore */ }
  }
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => globalThis.__st);
console.log(`\n===== ${MODE} / ${SEC}s =====`);
console.log(`驱动心跳=${fin.bot} 维度购买=${fin.buys} 坍缩=${fin.crunches} ipMult购买调用=${fin.ipMultBuys}`);
console.log(`里程碑=${JSON.stringify(marks)}`);
if (errs.length) console.log(`页面异常=${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
