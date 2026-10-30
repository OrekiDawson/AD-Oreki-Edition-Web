// 诊断：Break 之后 maxAM 为何增长缓慢（R5.12）
// 构造「已 Break」的受控起点（不冒充通关，只用于测增长速率），
// 分别测：A 不坍缩的纯爬升速率；B 自动坍缩 X_HIGHEST×10 的实际周期；C 手工全买（最优操作）爬升速率。
// 用法：node diag-break-climb.mjs [项目目录] [端口] [每段秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8492);
const SEG = Number(process.argv[4] || 25);
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
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof NormalChallenge === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 受控起点：已 Break、16 升级、ipMult×64、间隔拉满、无 ID
async function setup(crunchOn, opts = {}) {
  return page.evaluate((crunchOn, gal, boost) => {
    try { GameIntervals.stop(); } catch (e) { /* ok */ }
    player.break = true;
    player.infinities = new Decimal(60);
    player.infinityPoints = new Decimal(1e6);
    player.infinityUpgrades.clear();
    for (let i = 0; i < 16; i++) { try { player.infinityUpgrades.add(i); } catch (e) { /* ignore */ } }
    player.infinityRebuyables = [10, 10, 10];
    player.IPMultPurchases = 6;
    player.challenge.normal.current = 0;
    player.records.thisInfinity.maxAM = new Decimal(10);
    player.records.thisEternity.maxAM = new Decimal(10);
    player.dimensionBoosts = 0;
    player.galaxies = 0;
    player.auto.autobuyersOn = true;
    player.auto.bigCrunch.isActive = !!crunchOn;
    player.auto.bigCrunch.mode = 1;           // X_HIGHEST
    player.auto.bigCrunch.xHighest = 10;
    player.auto.bigCrunch.interval = 100;
    player.auto.bigCrunch.cost = 1;
    player.auto.bigCrunch.lastTick = 0;
    for (const k of ["tickspeed", "antimatterDims"]) {
      try { player.auto[k].isActive = true; } catch (e) { /* ignore */ }
    }
    try { player.auto.galaxy.isActive = !!gal; } catch (e) { /* ignore */ }
    try { player.auto.dimBoost.isActive = !!boost; } catch (e) { /* ignore */ }
    for (const d of player.auto.antimatterDims.all) { d.isActive = true; }
    try { GameIntervals.start(); } catch (e) { /* ok */ }
    return { break: player.break, ip: String(player.infinityPoints) };
  }, crunchOn, opts.galaxy !== false, opts.dimBoost !== false);
}

const snap = (manual) => page.evaluate((manual) => {
 try {
  const fmt = v => (v && typeof v.mantissa === "number") ? `${v.mantissa.toFixed(2)}e${v.exponent}` : String(v);
  const L = v => (v && typeof v.mantissa === "number") ? (v.exponent + Math.log10(v.mantissa)) : null;
  if (manual) {
    // 玩家最优操作：每帧把所有能买的都买了
    for (let t = 8; t >= 1; t--) { try { const d = AntimatterDimension(t); if (d.isAvailableForPurchase) d.buyMax(); } catch (e) { /* ignore */ } }
    try { Tickspeed.buyMax(); } catch (e) { /* ignore */ }
    try { if (DimBoost.canBeBought) DimBoost.buy(); } catch (e) { /* ignore */ }
    try { if (Galaxy.canBeBought) Galaxy.buy(); } catch (e) { /* ignore */ }
  }
  const ads = [];
  for (let t = 1; t <= 8; t++) { try { ads.push(fmt(AntimatterDimension(t).amount)); } catch (e) { ads.push("?"); } }
  return {
    amL: L(Currency.antimatter.value), maxAML: L(player.records.thisInfinity.maxAM),
    ipL: L(player.infinityPoints), gainL: L(gainedInfinityPoints()),
    inf: fmt(player.infinities), ads, ts: fmt(Tickspeed.current), boosts: player.dimensionBoosts ?? null,
    galaxies: player.galaxies, F: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return null; } })(),
    autoOn: { dims: player.auto.antimatterDims.isActive, ts: player.auto.tickspeed.isActive, boost: player.auto.dimBoost.isActive, gal: player.auto.galaxy.isActive, bc: player.auto.bigCrunch.isActive },
  };
 } catch (e) { return { err: String(e && e.message || e) }; }
}, manual);

async function runSeg(name, manual, seconds) {
  const t0 = Date.now();
  const rows = [];
  while (Date.now() - t0 < seconds * 1000) {
    const s = await snap(manual).catch(e => ({ err: String(e) }));
    rows.push({ t: +((Date.now() - t0) / 1000).toFixed(1), ...s });
    await new Promise(r => setTimeout(r, 500));
  }
  const first = rows[0], last = rows[rows.length - 1];
  if (last.err || !last.ads) { console.log(`\n===== ${name} =====\n快照失败: ${last.err || JSON.stringify(last)}`); return { first, last }; }
  console.log(`\n===== ${name} (${seconds}s) =====`);
  console.log(`起点: maxAM=10^${first.maxAML?.toFixed(1)} IP=10^${first.ipL?.toFixed(2)} inf=${first.inf} F=${first.F}`);
  console.log(`终点: maxAM=10^${last.maxAML?.toFixed(1)} IP=10^${last.ipL?.toFixed(2)} inf=${last.inf} 单次IP=10^${last.gainL?.toFixed(2)}`);
  console.log(`Δlog10(maxAM)=${(last.maxAML - first.maxAML).toFixed(1)}  → 速率 ${((last.maxAML - first.maxAML) / seconds).toFixed(2)} 数量级/秒`);
  console.log(`AD: ${last.ads.join(" / ")}  tickspeed=${last.ts}  boosts=${last.boosts} galaxies=${last.galaxies}`);
  console.log(`自动器: ${JSON.stringify(last.autoOn)}`);
  for (const r of rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 8)) === 0)) {
    console.log(`  t=${String(r.t).padStart(5)}s maxAM=10^${r.maxAML?.toFixed(1).padStart(8)} AM=10^${r.amL?.toFixed(1).padStart(8)} IP=10^${r.ipL?.toFixed(2).padStart(7)} inf=${String(r.inf).padEnd(7)} AD8=${r.ads[7]}`);
  }
  return { first, last };
}

// 对照矩阵：星系自动器开/关 × 坍缩开/关
await setup(false, { galaxy: true, dimBoost: true });
await runSeg("A1 全自动器 · 星系ON · 不坍缩", false, SEG);

await setup(false, { galaxy: false, dimBoost: true });
await runSeg("A2 星系OFF · 提升ON · 不坍缩", false, SEG);

await setup(false, { galaxy: false, dimBoost: false });
await runSeg("A3 星系OFF · 提升OFF · 不坍缩（纯维度增长）", false, SEG);

await setup(true, { galaxy: false, dimBoost: true });
await runSeg("B1 星系OFF · 提升ON · 自动坍缩", false, SEG);

await setup(true, { galaxy: true, dimBoost: true });
await runSeg("B2 星系ON · 提升ON · 自动坍缩", false, SEG);

if (errs.length) console.log(`\n页面异常 ${errs.length} 条：${errs.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
