// 同帧诊断：大坍缩自动器到底卡在哪一道门（R13.1）
// 在真实游戏帧里读门控值，并给 tick() / bigCrunchResetRequest() 装计数器。
// 用法：node probe-crunch-gate.mjs <root> <port> <秒>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8595);
const SEC = Number(process.argv[4] || 45);
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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 受控 Break 起点（不注入越界 maxAM）
await page.evaluate(() => {
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
  GameUI.update();
});

// 装计数器 + 驱动（只买，不手动坍缩）
const inst = await page.evaluate(() => {
  const st = { bot: 0, tickCalls: 0, tickEntered: 0, requestCalls: 0, willTrue: 0, canTickTrue: 0, samples: 0, errs: [] };
  globalThis.__g = st;
  try {
    const proto = Object.getPrototypeOf(Autobuyer.bigCrunch);
    const origTick = proto.tick;
    proto.tick = function(...a) {
      st.tickEntered++;
      try { if (this.willInfinity) st.willTrue++; } catch (e) { /* ignore */ }
      return origTick.apply(this, a);
    };
    if (typeof bigCrunchResetRequest === "function") {
      // 不能直接改写模块导出；改用定时比较 infinities 变化来计数（下方采样里做）
    }
    const step = () => {
      st.bot++;
      try {
        for (let t = 8; t >= 1; t--) { const d = AntimatterDimension(t); if (d.isAvailableForPurchase) buyMaxDimension(t); }
        buyTickSpeed();
        if (DimBoost.canBeBought) requestDimensionBoost(1);
        if (Galaxy.canBeBought) requestGalaxyReset(1);
        for (const u of InfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
        for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); }
        Autobuyers.tick();
        st.tickCalls++;
      } catch (e) { if (st.errs.length < 5) st.errs.push(String(e && e.message || e)); }
    };
    setInterval(step, 8);
    return null;
  } catch (e) { return String(e && e.message || e); }
});
if (inst) { console.log("装驱动失败:", inst); process.exit(1); }

const T0 = Date.now();
let lastInf = null;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => (v && typeof v.mantissa === "number") ? +(v.exponent + Math.log10(v.mantissa)).toFixed(2) : null;
    const ab = Autobuyer.bigCrunch;
    const g = (f) => { try { return f(); } catch (e) { return "ERR:" + (e && e.message || e); } };
    const base = (() => { try { return Object.getPrototypeOf(Object.getPrototypeOf(ab)).canTick; } catch (e) { return null; } })();
    return {
      autobuyersOn: player.auto.autobuyersOn,
      isUnlocked: g(() => ab.isUnlocked),
      isActive: g(() => ab.data.isActive),
      canTick: g(() => ab.canTick),
      canCrunch: g(() => Player.canCrunch),
      mode: g(() => ab.mode), amount: g(() => String(ab.amount)), xHighest: g(() => String(ab.xHighest)),
      timeSinceLastTick: g(() => ab.timeSinceLastTick),
      effectiveInterval: g(() => ab.effectiveInterval),
      interval: g(() => ab.interval),
      gainedL: g(() => L(gainedInfinityPoints())),
      highestPrevPrestigeL: g(() => L(ab.highestPrevPrestige)),
      willInfinity: g(() => ab.willInfinity),
      maxIPL: g(() => L(player.records.thisEternity.maxIP)),
      ipL: g(() => L(player.infinityPoints)),
      infNum: g(() => player.infinities.toNumber()),
      maxInfL: g(() => L(player.records.thisInfinity.maxAM)),
      st: { ...globalThis.__g },
    };
  }).catch(e => ({ err: String(e) }));
  if (s.err) { console.log("采样失败:", s.err); break; }
  if (lastInf !== null && s.infNum > lastInf) console.log(`  ★ infinities ${lastInf} → ${s.infNum}（坍缩真实发生）`);
  lastInf = s.infNum;
  const t = +((Date.now() - T0) / 1000).toFixed(0);
  if (t % 10 === 0) {
    console.log(`t=${String(t).padStart(3)}s canTick=${s.canTick} willInf=${s.willInfinity} canCrunch=${s.canCrunch} unlocked=${s.isUnlocked} active=${s.isActive} 收益=1e${s.gainedL} 历史maxIP=1e${s.highestPrevPrestigeL} xH=${s.xHighest} mode=${s.mode} 间隔=${s.timeSinceLastTick}>=${s.effectiveInterval} inf=${s.infNum} tick进入=${s.st.tickEntered} will真=${s.st.willTrue}`);
  }
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => {
  const s = globalThis.__g;
  const ab = Autobuyer.bigCrunch;
  const g = (f) => { try { return f(); } catch (e) { return "ERR:" + String(e && e.message || e); } };
  return { st: { ...s }, willInfinity: g(() => ab.willInfinity), gained: g(() => String(gainedInfinityPoints())), highest: g(() => String(ab.highestPrevPrestige)), xHighest: g(() => String(ab.xHighest)), mode: g(() => ab.mode) };
});
console.log("\n===== 结束快照 =====");
console.log(JSON.stringify(fin, null, 2));
await browser.close();
server.close();
