// 干净驱动：真实新档 / 受控检查点，每帧购买；心跳分离；支持禁坍缩。
// 用法：
//   node exp-clean.mjs <root> <port> <秒> fresh|break none|crunch
// 例：node exp-clean.mjs ../AD-Oreki-Edition 8580 240 break none
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8580);
const SEC = Number(process.argv[4] || 240);
const MODE = process.argv[5] || "fresh";     // fresh | break
const CRUNCH = process.argv[6] || "crunch";  // crunch=驱动强制 | none=都不坍缩 | auto=交给自动器

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

const cfg = { mode: MODE, crunch: CRUNCH, noId: !!process.env.OREKI_NO_ID };
const setupErr = await page.evaluate((cfg) => {
  try {
    if (cfg.mode === "break") {
      player.break = true;
      player.infinities = new Decimal(60);
      player.infinityPoints = new Decimal("1e6");
      player.IPMultPurchases = 6;
      player.infinityRebuyables = [0, 0, 0];
      player.challenge.normal.current = 0;
      player.auto.autobuyersOn = true;
      player.auto.bigCrunch.isActive = true;
      player.auto.bigCrunch.mode = 2;
      player.auto.bigCrunch.xHighest = new Decimal(10);
      player.auto.bigCrunch.interval = 100;
      player.auto.bigCrunch.cost = 1;
    }
    GameUI.update();
    return null;
  } catch (e) { return String(e && e.message || e); }
}, cfg);
if (setupErr) { console.log("设置失败:", setupErr); }

// 安装驱动：全部参数走同一个 evaluate，避免跨上下文丢参
const installErr = await page.evaluate((cfg) => {
  try {
    const st = { bot: 0, buys: 0, boosts: 0, galaxies: 0, crunches: 0, errs: [], crunchOn: cfg.crunch === "crunch", autoCrunch: cfg.crunch === "auto" };
    globalThis.__st = st;
    const has = (o, m) => typeof o?.[m] === "function";
    const step = () => {
      st.bot++;
      try {
        for (let t = 8; t >= 1; t--) {
          const d = AntimatterDimension(t);
          if (d.isAvailableForPurchase) { buyMaxDimension(t); st.buys++; }
        }
        if (typeof buyTickSpeed === "function") { buyTickSpeed(); }
        if (DimBoost.canBeBought && typeof requestDimensionBoost === "function") { requestDimensionBoost(1); st.boosts++; }
        if (Galaxy.canBeBought && typeof requestGalaxyReset === "function") { requestGalaxyReset(1); st.galaxies++; }
        // 玩家在 ID 页会点的「全部购买」：先解锁再买
        if (!cfg.noId) { try { for (let t = 1; t <= 8; t++) { const d = InfinityDimension(t); if (!d.isUnlocked) { if (d.canUnlock) d.unlock(); } else if (d.isAvailableForPurchase) d.buyMax(); } } catch (e) { /* ignore */ } }
        for (const u of InfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
        // 玩家在「无限」页会做的事：把大坍缩自动器间隔升满，然后点 Break Infinity。
        // 之前驱动漏了这两步，所以真新档永远停在 brk=false（不是游戏墙，是驱动缺口）。
        try {
          const bc = Autobuyer.bigCrunch;
          for (let i = 0; i < 20 && !bc.hasMaxedInterval; i++) {
            if (Currency.infinityPoints.value.lt(bc.cost)) break;
            bc.upgradeInterval(false);
          }
          if (bc.hasMaxedInterval && !player.break && typeof breakInfinity === "function") { breakInfinity(); }
        } catch (e) { /* ignore */ }
        try { for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); } } catch (e) { /* ignore */ }
        if (st.autoCrunch) {
          // Break 之前大坍缩自动器还没解锁（原版就要手动点），由驱动代玩家点；
          // Break 之后完全交给自动器（含 AD3b 的「攒够峰值再坍缩」规则）。
          try {
            if (!player.break && Player.canCrunch && gainedInfinityPoints().gte(1)) { bigCrunchReset(); st.crunches++; }
            else if (player.break && !player.auto.bigCrunch.isActive) { player.auto.bigCrunch.isActive = true; }
          } catch (e) { /* ignore */ }
        }
        if (st.crunchOn && Player.canCrunch && gainedInfinityPoints().gte(1)) { bigCrunchReset(); st.crunches++; }
      } catch (e) { if (st.errs.length < 5) st.errs.push(String(e && e.message || e)); }
    };
    setInterval(step, 8);
    setTimeout(step, 0);
    return null;
  } catch (e) { return String(e && e.message || e); }
}, cfg);
if (installErr) { console.log("驱动安装失败:", installErr); process.exit(1); }

const T0 = Date.now();
const marks = {};
let errCount = 0;
const T0ISO = new Date(T0).toISOString();
const JSONL = process.env.OREKI_JSONL || "";
const NL = String.fromCharCode(10);
if (JSONL) { try { fs.appendFileSync(JSONL, JSON.stringify({ event: "start", at: T0ISO, mode: MODE, crunch: CRUNCH }) + NL); } catch (e) {} }
let printed = -1;
let prevTotal = null;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(2) : null;
    const st = globalThis.__st || {};
    return {
      real: Date.now(),
      totalGame: player.records.totalTimePlayed,
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      inf: player.infinities.toNumber ? player.infinities.toNumber() : Number(player.infinities),
      boosts: player.dimensionBoosts, galaxies: player.galaxies,
      brk: player.break, et: player.eternities.toNumber ? player.eternities.toNumber() : 0,
      gainedL: (() => { try { return L(gainedInfinityPoints()); } catch (e) { return null; } })(),
      id1: (() => { try { const d = InfinityDimension(1); return { u: d.isUnlocked, c: d.canUnlock, costL: L(d.cost), afford: d.isAffordable }; } catch (e) { return null; } })(),
      willInf: (() => { try { return Autobuyer.bigCrunch.willInfinity; } catch (e) { return null; } })(),
      bot: st.bot, buys: st.buys, boostsC: st.boosts, galaxiesC: st.galaxies, crunches: st.crunches, cerr: st.errs,
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) {
    // 页面重载 / Frame 分离：不缓存任何 handle，等待后重试；不重置起点时间
    errCount++;
    if (errCount === 1) console.log(`[恢复] 采样异常：${s.err.slice(0, 80)}`);
    if (errCount > 40) { console.log("采样连续失败 40 次，终止"); break; }
    await new Promise(r => setTimeout(r, 1200));
    continue;
  }
  errCount = 0;
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const gameDelta = prevTotal === null ? 0 : (s.totalGame - prevTotal);
  prevTotal = s.totalGame;
  const mark = (k, c) => { if (c && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1?.u === true);
  if (t % 15 === 0 && t !== printed) {
    printed = t;
    console.log(`t=${String(t).padStart(4)}s AM=1e${s.amL} 本轮max=1e${s.maxInfL} 本纪max=1e${s.maxEtL} IP=1e${s.ipL} 单次=1e${s.gainedL} inf=${s.inf} 提升=${s.boosts} 星系=${s.galaxies} 坍缩=${s.crunches} 驱动=${s.bot} 游戏时间增量=${gameDelta} ID1=${s.id1?.u ? "Y" : "n"} willInf=${s.willInf}${s.cerr && s.cerr.length ? " ERR=" + s.cerr[0] : ""}`);
  }
    if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, wall: new Date().toISOString(), elapsedMs: Date.now() - T0,
        amL: s.amL, maxInfL: s.maxInfL, maxEtL: s.maxEtL, ipL: s.ipL, inf: s.inf,
        boosts: s.boosts, galaxies: s.galaxies, brk: s.brk, id1: s.id1, willInf: s.willInf
      }) + NL);
    } catch (e) { /* 落盘失败不影响主流程 */ }
  }
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => globalThis.__st);
console.log(`\n===== 模式 ${MODE} / 坍缩 ${CRUNCH} / ${SEC}s =====`);
console.log(`驱动心跳=${fin.bot} 购买=${fin.buys} 提升调用=${fin.boostsC} 星系调用=${fin.galaxiesC} 坍缩=${fin.crunches}`);
console.log(`驱动异常=${JSON.stringify(fin.errs)}`);
console.log(`里程碑=${JSON.stringify(marks)}`);
if (errs.length) console.log(`页面异常=${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
