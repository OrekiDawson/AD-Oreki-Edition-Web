// A/B：星系自动器 开/关 对「Break 后 maxAM 成长 → ID 解锁」的影响（R5.12）
// 同一受控起点，同一 30 s 窗口，比较 maxAM / IP / 大坍缩次数 / ID1 是否解锁。
// 用法：node diag-galaxy-ab.mjs [项目目录] [端口] [每段秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8498);
const SEG = Number(process.argv[4] || 30);
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
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const snap = () => page.evaluate(() => {
  const L = v => (v && typeof v.mantissa === "number") ? (v.exponent + Math.log10(v.mantissa)) : null;
  return {
    amL: L(Currency.antimatter.value),
    maxAML: L(player.records.thisInfinity.maxAM),
    maxAML_et: L(player.records.thisEternity.maxAM),
    ipL: L(player.infinityPoints),
    gainL: (() => { try { return L(gainedInfinityPoints()); } catch (e) { return null; } })(),
    inf: (() => { try { return L(player.infinities); } catch (e) { return null; } })(),
    boosts: player.dimensionBoosts, galaxies: player.galaxies,
    id1: (() => { try { const d = InfinityDimension(1); return { unlocked: d.isUnlocked, can: d.canUnlock, cost: L(d.cost) }; } catch (e) { return null; } })(),
    galaxyAuto: player.auto.galaxy.isActive,
    totalIP: (() => { try { return L(player.infinityPoints); } catch (e) { return null; } })(),
  };
});

async function seg(name, galaxyOn, seconds, boostOn = true, bigInterval = false) {
  await page.evaluate((galaxyOn, boostOn, bigInterval) => {
    player.break = true;
    player.infinities = new Decimal(16);
    player.infinityPoints = new Decimal(1e4);
    player.IPMultPurchases = 6;
    player.challenge.normal.current = 0;
    player.dimensionBoosts = 0;
    player.galaxies = 0;
    player.records.thisInfinity.maxAM = new Decimal(10);
    player.records.thisEternity.maxAM = new Decimal(10);
    player.auto.autobuyersOn = true;
    player.auto.galaxy.isActive = !!galaxyOn;
    player.auto.dimBoost.isActive = !!boostOn;
    player.auto.tickspeed.isActive = true;
    player.auto.bigCrunch.isActive = true;
    player.auto.bigCrunch.mode = 1;
    player.auto.bigCrunch.xHighest = 10;
    const F = (() => { try { return getGlobalSpeedFactor(); } catch (e) { return 1; } })();
    player.auto.bigCrunch.interval = bigInterval ? 150000 : 100;
    if (bigInterval) {
      // 模拟「重置类购买器不除以倍率」：interval 直接给现实毫秒，再乘 F 抵消现实现除法
      player.auto.dimBoost.interval = 4000 * F;
      player.auto.galaxy.interval = 20000 * F;
      player.auto.dimBoost.lastTick = 0;
      player.auto.galaxy.lastTick = 0;
      player.auto.bigCrunch.lastTick = 0;
    }
    player.auto.bigCrunch.cost = 1;
    AntimatterDimensions.reset();
    Currency.antimatter.value = new Decimal(10);
  }, galaxyOn, boostOn, bigInterval);
  await new Promise(r => setTimeout(r, 1200));
  const t0 = Date.now();
  let last = null;
  const rows = [];
  while (Date.now() - t0 < seconds * 1000) {
    const s = await snap().catch(e => ({ err: String(e) }));
    if (s.err) { console.log("快照失败:", s.err); break; }
    rows.push({ t: +((Date.now() - t0) / 1000).toFixed(0), ...s });
    last = s;
    await new Promise(r => setTimeout(r, 1000));
  }
  const first = rows[0];
  console.log(`\n===== ${name}（${seconds}s）=====`);
  for (const r of rows.filter((_, i) => i % Math.max(1, Math.round(rows.length / 10)) === 0)) {
    console.log(`  t=${String(r.t).padStart(3)}s maxAM=10^${r.maxAML?.toFixed(1).padStart(8)} IP=10^${r.ipL?.toFixed(2).padStart(6)} 单次IP=10^${r.gainL?.toFixed(2)} inf=10^${r.inf?.toFixed(2)} 提升=${r.boosts} 星系=${r.galaxies} ID1=${r.id1?.unlocked ? "已解锁" : (r.id1?.can ? "可解锁" : "未解锁")}`);
  }
  console.log(`  → maxAM 10^${first.maxAML?.toFixed(1)} → 10^${last.maxAML?.toFixed(1)}  Δ=${(last.maxAML - first.maxAML).toFixed(1)}`);
  console.log(`  → infinities 10^${first.inf?.toFixed(2)} → 10^${last.inf?.toFixed(2)}  IP 10^${first.ipL?.toFixed(2)} → 10^${last.ipL?.toFixed(2)}`);
  console.log(`  → 星系 ${first.galaxies} → ${last.galaxies}；ID1 成本 10^${last.id1?.cost?.toFixed(1)}；可解锁=${last.id1?.can}`);
  return last;
}

await seg("A · 现状：星系/提升/坍缩 interval=100（每帧重置）", true, SEG);
await seg("D · 重置类按现实间隔（提升4s/星系20s，坍缩150s）", true, SEG, true, true);

if (errs.length) console.log(`\n页面异常 ${errs.length}：${errs.slice(0, 3).join(" | ")}`);
await browser.close();
server.close();
