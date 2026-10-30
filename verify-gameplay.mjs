// 加速下的核心玩法回归：生产、自动购买器、Big Crunch、离线模拟
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8086);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errs = [];
page.on("pageerror", e => errs.push(e.message));
const results = [];
const check = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// 1. 生产在 10000× 下正常推进
const prod = await page.evaluate(async () => {
  player.antimatter = new Decimal("1e6");
  GameUI.update();
  for (let t = 1; t <= 4; t++) buyMaxDimension(t);
  const before = player.antimatter;
  await new Promise(r => setTimeout(r, 2000));
  return { before: String(before), after: String(player.antimatter), increased: player.antimatter.gt(before) };
});
check("购买维度后反物质持续增长", prod.increased, `${prod.before} → ${prod.after}`);

// 2. 自动购买器可正常运转（不因加速而卡死）
// 走真实通道：写 player.auto.antimatterDims.all[i]（即 ab.data），而不是给只读 getter 赋值
const auto = await page.evaluate(async () => {
  player.auto.autobuyersOn = true;
  player.auto.antimatterDims.isActive = true;
  player.auto.antimatterDims.collapseDisplay = false;
  for (let t = 1; t <= 4; t++) {
    const ab = Autobuyer.antimatterDimension(t);
    ab.data.isBought = true;
    ab.data.isUnlocked = true;
    ab.data.isActive = true;
    ab.data.bulk = Math.min(ab.data.bulk, 1);
    ab.data.lastTick = 0;
  }
  Currency.antimatter.bumpTo(new Decimal("1e500"));
  GameUI.update();

  const before = [];
  for (let t = 1; t <= 4; t++) before.push(String(AntimatterDimension(t).bought));
  const realBefore = player.records.realTimePlayed;
  const wall0 = Date.now();

  await new Promise(r => setTimeout(r, 2500));

  const after = [];
  for (let t = 1; t <= 4; t++) after.push(String(AntimatterDimension(t).bought));
  const realDelta = player.records.realTimePlayed - realBefore;
  const wallDelta = Date.now() - wall0;
  const ticked = [];
  for (let t = 1; t <= 4; t++) ticked.push(Autobuyer.antimatterDimension(t).data.lastTick > 0);
  return {
    before, after, ticked,
    anyTicked: ticked.some(Boolean),
    realDelta: Math.round(realDelta),
    wallDelta: Math.round(wallDelta),
    ratio: realDelta / wallDelta,
  };
});
// 自动购买器计时器按「现实毫秒」走（interval 500~800ms），若被 10000× 二次放大，
// realTimePlayed 会暴涨到 2500 万毫秒级；这里要求它贴合墙钟
check(
  "自动购买器计时器按现实时间走（未被倍率二次放大）",
  auto.ratio > 0.7 && auto.ratio < 1.6,
  `realTimePlayed 增加 ${auto.realDelta}ms / 墙钟 ${auto.wallDelta}ms（比值 ${auto.ratio.toFixed(2)}）`
);
check(
  "自动购买器在 10000× 下正常触发",
  auto.anyTicked,
  `lastTick 已推进：${auto.ticked.map(v => (v ? "是" : "否")).join("/")}`
);
check(
  "自动购买器在 10000× 下正常购买",
  auto.after.some((v, i) => v !== auto.before[i]),
  `购买次数 ${auto.before.join("/")} → ${auto.after.join("/")}`
);

// 3. Big Crunch / Infinity 可用（走真实 bigCrunchReset 通道）
const crunch = await page.evaluate(() => {
  const before = Currency.infinities.value;
  const ipBefore = Currency.infinityPoints.value;
  // canCrunch 判的是本无限内历史最高反物质（maxAM），必须一起抬到阈值之上
  player.antimatter = new Decimal("1e400");
  player.records.thisInfinity.maxAM = new Decimal("1e400");
  GameUI.update();
  const canCrunch = Player.canCrunch;
  try {
    if (!canCrunch) return { ok: false, err: "Player.canCrunch 为 false（1e400 反物质不足）", canCrunch };
    bigCrunchReset();
  } catch (e) {
    return { ok: false, err: String(e && e.stack ? e.stack.split("\n")[0] : e), canCrunch };
  }
  return {
    ok: Currency.infinities.value.gt(before) && Currency.infinityPoints.value.gt(ipBefore),
    canCrunch,
    before: String(before),
    after: String(Currency.infinities.value),
    ip: `${String(ipBefore)} → ${String(Currency.infinityPoints.value)}`,
    amReset: player.antimatter.lt(1e100),
  };
});
check(
  "Big Crunch 正常结算（无限次数 + 无限点数增长、反物质归零）",
  crunch.ok && crunch.amReset,
  crunch.err ? crunch.err : `无限 ${crunch.before} → ${crunch.after}，IP ${crunch.ip}`
);

// 4. 离线模拟：不卡死、不无限循环、时间正确放大
const sim = await page.evaluate(async () => {
  const t0 = performance.now();
  const before = player.records.totalTimePlayed;
  // 600 真实秒，fast=true 走 50 tick 的快速路径
  simulateTime(600, false, true);
  const elapsed = performance.now() - t0;
  const after = player.records.totalTimePlayed;
  return {
    ms: Math.round(elapsed),
    gameGainSec: (after - before) / 1000,
    factor: getGlobalSpeedFactor(),
    simLockReleased: !OrekiSpeed.isSimulationLocked,
  };
});
check("离线模拟在合理时间内完成（无死循环）", sim.ms < 20000, `耗时 ${sim.ms}ms`);
check("离线模拟按倍率放大游戏时间", sim.gameGainSec > 600 * 10000 * 0.5, `增加 ${Math.round(sim.gameGainSec)} 秒游戏时间（10000× × 600s）`);
check("模拟结束后倍率解冻", sim.simLockReleased);

// 5. 倍率可在模拟后再修改
const post = await page.evaluate(() => {
  const r = OrekiSpeed.set(500);
  return { ok: r.ok, factor: getGlobalSpeedFactor() };
});
check("模拟结束后仍可修改倍率", post.ok && post.factor === 500, `= ${post.factor}`);

check("无未捕获异常", errs.length === 0, errs.slice(0, 2).join(" | "));

await browser.close();
server.close();
const failed = results.filter(r => !r.p);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
