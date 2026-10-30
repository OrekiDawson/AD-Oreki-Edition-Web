// A/B 实验：验证「未 Break 时坍缩收益随 maxAM 增长」能否把 Break 拉到可接受时长。
// 背景（R19 实测）：Break 需要把大坍缩自动器间隔从 150000 降到 100，成本序列 1,2,4,... 累计 32767 IP。
// 原版未 Break 时 gainedInfinityPoints() 恒返回 308/308 = 1 IP/次 → 至少 32767 次坍缩。
// 本实验在**测试层**改写收益公式，测量 Break 达成墙钟时间。
// 用法：node exp-prebreak-ip.mjs <root> <port> <秒> [base|boost]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8750);
const SEC = Number(process.argv[4] || 300);
const ARM = process.argv[5] || "boost";

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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
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

// 测试层注入：让驱动在未 Break 时也按「实际反物质量」给 IP（模拟 AD5）。
const setupErr = await page.evaluate((arm) => {
  try {
    if (arm === "boost") {
      // 不改生产代码；改的是驱动里的坍缩判定：
      // 未 Break 时额外把「本纪最大反物质」折算成 IP，让间隔升级能买到。
      // 这里用一个独立的计数：每帧按 (maxAM 的对数) 折算，避免改游戏公式。
      globalThis.__preBreakIPBoost = true;
    }
    return null;
  } catch (e) { return String(e && e.message || e); }
}, ARM);
if (setupErr) { console.log("注入失败:", setupErr); process.exit(1); }

const installErr = await page.evaluate(() => {
  try {
    const st = { bot: 0, buys: 0, crunches: 0, errs: [] };
    globalThis.__st = st;
    const step = () => {
      st.bot++;
      try {
        for (let t = 8; t >= 1; t--) {
          const d = AntimatterDimension(t);
          if (d.isAvailableForPurchase) { buyMaxDimension(t); st.buys++; }
        }
        if (typeof buyTickSpeed === "function") buyTickSpeed();
        if (DimBoost.canBeBought && typeof requestDimensionBoost === "function") requestDimensionBoost(1);
        if (Galaxy.canBeBought && typeof requestGalaxyReset === "function") requestGalaxyReset(1);
        try {
          for (let t = 1; t <= 8; t++) {
            const d = InfinityDimension(t);
            if (!d.isUnlocked) { if (d.canUnlock) d.unlock(); }
            else if (d.isAvailableForPurchase) d.buyMax();
          }
        } catch (e) { /* ignore */ }
        for (const u of InfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
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
let printed = -1;
const JSONL = process.env.OREKI_JSONL || "";
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => { try { if (v === null || v === undefined) return null; const t = v.toString(); const i = t.indexOf("e"); if (i >= 0) return +(Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1))).toFixed(2); return Number(t); } catch (e) { return null; } };
    const st = globalThis.__st || {};
    return {
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      maxIPL: L(player.records.thisEternity.maxIP),
      canCrunch: Player.canCrunch,
      inf: Number(player.infinities), et: Number(player.eternities),
      brk: player.break,
      boosts: player.dimensionBoosts, galaxies: player.galaxies,
      bcInterval: player.auto.bigCrunch.interval,
      bcCost: player.auto.bigCrunch.cost,
      ipMultPurchases: player.IPMultPurchases,
      id1u: (() => { try { return InfinityDimension(1).isUnlocked; } catch (e) { return null; } })(),
      bot: st.bot, crunches: st.crunches, cerr: st.errs,
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) { await new Promise(r => setTimeout(r, 1200)); continue; }
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && marks[k] === undefined) { marks[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1u === true);
  mark("首次永恒", s.et >= 1);
  if (t % 10 === 0 && t !== printed) {
    printed = t;
    console.log(`t=${String(t).padStart(4)}s am=1e${s.amL} maxInf=1e${s.maxInfL} maxEt=1e${s.maxEtL} IP=1e${s.ipL} maxIP=1e${s.maxIPL} inf=${Math.round(s.inf)} 坍缩=${s.crunches} 间隔=${s.bcInterval} 间隔成本=${s.bcCost} ipMult买=${s.ipMultPurchases} brk=${s.brk}`);
  }
  if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, amL: s.amL, maxInfL: s.maxInfL, maxEtL: s.maxEtL, ipL: s.ipL, maxIPL: s.maxIPL,
        inf: s.inf, et: s.et, brk: s.brk, crunches: s.crunches, bcInterval: s.bcInterval, bcCost: s.bcCost,
        ipMultPurchases: s.ipMultPurchases, id1u: s.id1u, boosts: s.boosts, galaxies: s.galaxies,
      }) + "\n");
    } catch (e) { /* ignore */ }
  }
  await new Promise(r => setTimeout(r, 1000));
}
const fin = await page.evaluate(() => globalThis.__st);
console.log(`\n===== ARM=${ARM} / ${SEC}s =====`);
console.log(`驱动心跳=${fin.bot} 坍缩=${fin.crunches} 异常=${JSON.stringify(fin.errs)}`);
console.log(`里程碑=${JSON.stringify(marks)}`);
if (errs.length) console.log(`页面异常=${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
