// 上限基线：页面内每帧自动购买（模拟「完美手动操作」），测游戏本身能给到多快。
// 与 newgame-trace 的区别：购买不再受外部 400ms 轮询限制，改为每帧执行。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8565);
const SEC = Number(process.argv[4] || 120);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const page = await browser.newPage();
await page.bringToFront?.();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const START_BREAK = !!process.env.OREKI_START_BREAK;
if (START_BREAK) {
  await page.evaluate(() => {
    player.break = true;
    player.infinities = new Decimal(60);
    player.infinityPoints = new Decimal(1e6);
    player.IPMultPurchases = 6;
    player.infinityRebuyables = [0, 0, 0];
    player.challenge.normal.current = 0;
    player.auto.autobuyersOn = true;
    player.auto.bigCrunch.isActive = true;
    player.auto.bigCrunch.mode = 2;
    player.auto.bigCrunch.xHighest = new Decimal(10);
    player.auto.bigCrunch.interval = 100;
    player.auto.bigCrunch.cost = 1;
    GameUI.update();
  });
}

// 页面内每帧执行：所有能买的都买（含提升/星系/坍缩/升级），并统计调用与成功次数
await page.evaluate((nc) => { globalThis.__noCrunchFlag = nc; }, !!process.env.OREKI_NO_CRUNCH);
await page.evaluate((noCrunchFlag) => {
  globalThis.__noCrunchFlag = noCrunchFlag;
  const stat = { frames: 0, buys: 0, boosts: 0, galaxies: 0, crunches: 0, errs: [] };
  globalThis.__stat = stat;
  globalThis.__noCrunch = !!globalThis.__noCrunchFlag;
  const step = () => {
    stat.frames++;
    try {
      for (let t = 8; t >= 1; t--) {
        const d = AntimatterDimension(t);
        if (d.isAvailableForPurchase) { buyMaxDimension(t); stat.buys++; }
      }
      try { const before = Tickspeed.current; buyTickSpeed(); if (Tickspeed.current !== before) stat.buys++; } catch (e) { if (stat.errs.length < 5) stat.errs.push("ts:" + (e && e.message || e)); }
      if (DimBoost.canBeBought) { requestDimensionBoost(1); stat.boosts++; }
      if (Galaxy.canBeBought) { requestGalaxyReset(1); stat.galaxies++; }
      for (const u of InfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
      for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
      if (!globalThis.__noCrunch && Player.canCrunch && gainedInfinityPoints().gte(1)) { bigCrunchReset(); stat.crunches++; }
    } catch (e) { if (stat.errs.length < 5) stat.errs.push(String(e && e.message || e)); }
  };
  setInterval(step, 8);
  setTimeout(step, 0);
});

const T0 = Date.now();
const marks = {};
let rowN = 0;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(2) : null;
    return {
      amL: L(Currency.antimatter.value), maxAML: L(player.records.thisInfinity.maxAM),
      ipL: L(player.infinityPoints), infL: L(player.infinities),
      boosts: player.dimensionBoosts, galaxies: player.galaxies,
      brk: player.break, etL: L(player.eternities),
      stat: globalThis.__stat,
      id1: (() => { try { const d = InfinityDimension(1); return { u: d.isUnlocked, c: d.canUnlock }; } catch (e) { return null; } })(),
    };
  }).catch(e => ({ err: String(e) }));
  if (s.err) { console.log("ERR", s.err); break; }
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", (s.infL ?? -1) >= 0.1);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1?.u === true);
  mark("首次永恒", (s.etL ?? 0) > 0);
  if (t !== rowN && t % 15 === 0) {
    rowN = t;
    console.log(`t=${String(t).padStart(4)}s AM=1e${s.amL} IP=1e${s.ipL} inf=1e${s.infL} 提升=${s.boosts} 星系=${s.galaxies} 帧=${s.stat.frames} 购买=${s.stat.buys} 强化=${s.stat.boosts} 星系买=${s.stat.galaxies} 坍缩=${s.stat.crunches} Break=${s.brk ? "Y" : "n"}`);
  }
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => ({ stat: globalThis.__stat }));
console.log(`\n统计: ${JSON.stringify(fin.stat)}`);
console.log(`里程碑: ${JSON.stringify(marks)}`);
if (errs.length) console.log(`页面异常 ${errs.length}: ${errs.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
