// 诊断：Web 首次 Eternity 的真实时间墙。
// 目的：区分「当前 IP」「本纪最高 IP(maxIP)」「真正的永恒需求(eternityGoal)」「ID1 反物质门槛」。
// 采样字段全部为真实运行时字段，不做任何状态注入。
// 用法：node diag-eternity-wall.mjs <root> <port> <秒> [fresh|break]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8670);
const SEC = Number(process.argv[4] || 180);
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

// 驱动：只做「玩家在界面上会做的点击」，全部走生产 API；不改任何状态字段。
const installErr = await page.evaluate((mode) => {
  try {
    const st = { bot: 0, buys: 0, boosts: 0, galaxies: 0, crunches: 0, errs: [] };
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
        // IP 倍率升级（真实购买路径，走 canBeBought/purchase）
        try { if (InfinityUpgrade.ipMult.canBeBought) InfinityUpgrade.ipMult.purchase(); } catch (e) { /* ignore */ }
        try {
          const bc = Autobuyer.bigCrunch;
          for (let i = 0; i < 20 && !bc.hasMaxedInterval; i++) {
            if (Currency.infinityPoints.value.lt(bc.cost)) break;
            bc.upgradeInterval(false);
          }
          if (bc.hasMaxedInterval && !player.break && typeof breakInfinity === "function") breakInfinity();
        } catch (e) { /* ignore */ }
        try { for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); } } catch (e) { /* ignore */ }
        // 自动坍缩：Break 前由驱动代点，Break 后交给自动器（AD3b 规则）
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
}, MODE);
if (installErr) { console.log("驱动安装失败:", installErr); process.exit(1); }

const T0 = Date.now();
const marks = {};
const T0ISO = new Date(T0).toISOString();
const JSONL = process.env.OREKI_JSONL || "";
const NL = String.fromCharCode(10);
if (JSONL) { try { fs.appendFileSync(JSONL, JSON.stringify({ event: "start", at: T0ISO, mode: MODE }) + NL); } catch (e) {} }
let printed = -1;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(2) : null;
    const st = globalThis.__st || {};
    let goalL = null, canEt = null;
    try { goalL = L(Player.eternityGoal); canEt = Player.canEternity; } catch (e) {}
    let id1 = null;
    try {
      const d = InfinityDimension(1);
      id1 = {
        u: d.isUnlocked,
        canUnlock: d.canUnlock,
        costL: L(d.cost),
        amReqL: L(d.amRequirement),
        amReached: d.antimatterRequirementReached,
        ipReached: d.ipRequirementReached,
        affordable: d.isAffordable,
      };
    } catch (e) { id1 = null; }
    let bc = null;
    try {
      bc = {
        active: player.auto.bigCrunch.isActive,
        mode: player.auto.bigCrunch.mode,
        xHighest: L(player.auto.bigCrunch.xHighest),
        interval: player.auto.bigCrunch.interval,
        willInf: Autobuyer.bigCrunch.willInfinity,
        waiting: Autobuyer.bigCrunch.waitingForId1Peak,
        highestPrev: L(Autobuyer.bigCrunch.highestPrevPrestige),
      };
    } catch (e) { bc = null; }
    return {
      real: Date.now(),
      totalGame: player.records.totalTimePlayed,
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      maxIPL: L(player.records.thisEternity.maxIP),
      etGoalL: goalL,
      canEt,
      inf: player.infinities.toNumber ? player.infinities.toNumber() : Number(player.infinities),
      et: player.eternities.toNumber ? player.eternities.toNumber() : 0,
      boosts: player.dimensionBoosts, galaxies: player.galaxies,
      brk: player.break,
      ipMultPurchases: player.IPMultPurchases,
      gainedL: (() => { try { return L(gainedInfinityPoints()); } catch (e) { return null; } })(),
      id1, bc,
      bot: st.bot, buys: st.buys, boostsC: st.boosts, galaxiesC: st.galaxies, crunches: st.crunches, cerr: st.errs,
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) { await new Promise(r => setTimeout(r, 1200)); continue; }
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1?.u === true);
  mark("首次永恒", s.et >= 1);
  if (t % 15 === 0 && t !== printed) {
    printed = t;
    console.log(`t=${String(t).padStart(4)}s IP=1e${s.ipL} maxIP=1e${s.maxIPL} 目标=1e${s.etGoalL} canEt=${s.canEt} | maxEt=1e${s.maxEtL} ID1{解锁:${s.id1?.u} 反物质达标:${s.id1?.amReached} IP达标:${s.id1?.ipReached}} | 坍缩等待=${s.bc?.waiting} willInf=${s.bc?.willInf} 坍缩数=${s.crunches} | 提升=${s.boosts} 星系=${s.galaxies} inf=${Math.round(s.inf)} ipMult购买=${s.ipMultPurchases}`);
  }
  if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, wall: new Date().toISOString(), elapsedMs: Date.now() - T0,
        amL: s.amL, maxInfL: s.maxInfL, maxEtL: s.maxEtL,
        ipL: s.ipL, maxIPL: s.maxIPL, etGoalL: s.etGoalL, canEt: s.canEt,
        inf: s.inf, et: s.et, boosts: s.boosts, galaxies: s.galaxies, brk: s.brk,
        ipMultPurchases: s.ipMultPurchases, gainedL: s.gainedL, id1: s.id1, bc: s.bc,
      }) + NL);
    } catch (e) { /* ignore */ }
  }
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => globalThis.__st);
console.log(`\n===== ${MODE} / ${SEC}s =====`);
console.log(`驱动心跳=${fin.bot} 购买=${fin.buys} 提升=${fin.boostsC} 星系=${fin.galaxiesC} 坍缩=${fin.crunches}`);
console.log(`里程碑=${JSON.stringify(marks)}`);
if (errs.length) console.log(`页面异常=${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
