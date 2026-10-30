// Break Infinity → Infinity Dimensions → Eternity 真实成长曲线实测（R5.12）
//
// 目标：不复用「伪造 maxAM」的起点，而是从「刚完成首次无限」的状态出发，
//   阶段 1：攒 16 次无限 → NC10/11/12 → 买 16 个非重复升级 + ipMult → 间隔拉满 → Break Infinity
//   阶段 2：Break 后按游戏正常顺序解锁并购买 ID1..ID8，持续大坍缩，直到 canEternity
//   阶段 3：实际调用 eternity() 完成转换
// 记录每一步现实墙钟、IP 指数、log10(maxAM)、ID 数量与成本、单次 IP 收益。
//
// 用法：node verify-id-to-eternity.mjs [项目目录] [端口] [总时长秒] [--no-break]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8491);
const DURATION = Number(process.argv[4] || 300) * 1000;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof NormalChallenge === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const NO_RESET_AB = !!process.env.OREKI_NO_RESET_AB;
const init = await page.evaluate((noResetAb) => {
  try { GameIntervals.stop(); } catch (e) { /* ok */ }
  player.infinities = new Decimal(1);
  player.infinityPoints = new Decimal(1);
  player.break = false;
  player.infinityUpgrades.clear();
  player.infinityRebuyables = [0, 0, 0];
  player.IPMultPurchases = 0;
  player.challenge.normal.current = 0;
  player.records.thisInfinity.maxAM = new Decimal(1.8e308);
  player.auto.autobuyersOn = true;
  player.auto.bigCrunch.isActive = true;
  player.auto.bigCrunch.mode = 0;
  player.auto.bigCrunch.amount = new Decimal(1);
  player.auto.bigCrunch.interval = 150000;
  player.auto.bigCrunch.cost = 1;
  if (noResetAb) {
    player.auto.galaxy.isActive = false;
    player.auto.dimBoost.isActive = false;
  }
  try { GameIntervals.start(); } catch (e) { /* ok */ }
  GameUI.update();
  return { ip: "1", inf: String(player.infinities), interval: 150000, noResetAb };
}, NO_RESET_AB);
console.log("起点:", JSON.stringify(init));

const T0 = Date.now();
const stages = {};
const samples = [];
const actions = [];
let eternityDone = false;
let lastSig = "";

const tick = () => page.evaluate(() => {
  const fmt = v => (v && typeof v.mantissa === "number") ? `${v.mantissa.toFixed(2)}e${v.exponent}` : String(v);
  const log10 = v => (v && typeof v.mantissa === "number") ? (v.exponent + Math.log10(v.mantissa)) : null;
  const log = { act: [] };

  // 阶段 1：挑战（进入即完成）
  if (player.challenge.normal.current === 0) {
    for (const id of [10, 11, 12]) {
      try {
        const c = NormalChallenge(id);
        if (c.isUnlocked && !c.isCompleted) { c.start(); log.act.push("enterNC" + id); break; }
      } catch (e) { /* ignore */ }
    }
  }
  // 升级
  for (const u of InfinityUpgrade.all) {
    try { if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); log.act.push("upg"); } } catch (e) { /* ignore */ }
  }
  try { if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.purchase(); log.act.push("ipMult"); } } catch (e) { /* ignore */ }
  // 间隔 / Break
  try {
    if (!Autobuyer.bigCrunch.hasMaxedInterval && Autobuyer.bigCrunch.canBeUpgraded) {
      Autobuyer.bigCrunch.upgradeInterval(); log.act.push("interval");
    }
  } catch (e) { /* ignore */ }
  try { if (!player.break && Autobuyer.bigCrunch.hasMaxedInterval) { breakInfinity(); log.act.push("BREAK"); } } catch (e) { /* ignore */ }

  // 阶段 2：ID 解锁 + 购买（游戏正常顺序：先 unlock，再 buyMax）
  const ids = [];
  for (let t = 1; t <= 8; t++) {
    try {
      const d = InfinityDimension(t);
      if (!d.isUnlocked) {
        if (d.canUnlock) { d.unlock(); log.act.push("unlockID" + t); }
      } else if (d.isAvailableForPurchase) {
        const before = d.amount;
        if (d.buyMax()) log.act.push("buyID" + t);
        if (!before.eq(d.amount)) log.act.push("+ID" + t);
      }
      ids.push({ t, unlocked: d.isUnlocked, amt: fmt(d.amount), cost: fmt(d.cost), mult: fmt(d.multiplier) });
    } catch (e) { ids.push({ t, err: true }); }
  }

  // 阶段 3：Eternity
  let canEt = false;
  try { canEt = Player.canEternity; } catch (e) { /* ignore */ }
  if (canEt) {
    try { eternity(false); log.act.push("ETERNITY"); } catch (e) { log.act.push("ETERR"); }
  }

  return {
    log,
    st: {
      t: Date.now(),
      ip: fmt(player.infinityPoints),
      ipL: log10(player.infinityPoints),
      maxAM: fmt(player.records.thisEternity.maxAM),
      maxAML: log10(player.records.thisEternity.maxAM),
      inf: fmt(player.infinities),
      et: fmt(player.eternities),
      interval: Autobuyer.bigCrunch.interval,
      brk: player.break,
      upg: player.infinityUpgrades.size,
      ipMult: player.IPMultPurchases,
      gain: fmt(gainedInfinityPoints()),
      gainL: log10(gainedInfinityPoints()),
      canEternity: canEt,
      reqIP: (() => { try { return fmt(requiredIPForEP(1)); } catch (e) { return null; } })(),
      real: (() => { try { return Math.round(player.records.realTimePlayed); } catch (e) { return null; } })(),
      ncCur: player.challenge.normal.current,
      bcInterval: (() => { try { return player.auto.bigCrunch.interval; } catch (e) { return null; } })(),
      bcMode: (() => { try { return player.auto.bigCrunch.mode; } catch (e) { return null; } })(),
      bcAmt: (() => { try { return fmt(player.auto.bigCrunch.amount); } catch (e) { return null; } })(),
      ids,
    },
  };
});

while (Date.now() - T0 < DURATION) {
  const r = await tick().catch(e => ({ st: null, err: String(e) }));
  if (r.st) {
    const t = +((r.st.t - T0) / 1000).toFixed(1);
    const s = r.st;
    const mark = (k, cond) => { if (cond && stages[k] === undefined) stages[k] = t; };
    mark("nc10", (() => { try { return NormalChallenge(10).isCompleted === true; } catch (e) { return false; } })());
    mark("nc12", (() => { try { return NormalChallenge(12).isCompleted === true; } catch (e) { return false; } })());
    mark("upg16", s.upg >= 16);
    mark("intervalMaxed", s.interval <= 100);
    mark("break", s.brk === true);
    mark("id1", s.ids && s.ids[0] && s.ids[0].unlocked === true);
    mark("id8", s.ids && s.ids[7] && s.ids[7].unlocked === true);
    mark("canEternity", s.canEternity === true);
    mark("eternity", s.et && s.et !== "0.00e0");
    if (r.log.act.length) {
      for (const a of r.log.act) {
        if (a === "upg" || a === "ipMult") continue; // 高频，单独统计
        if (actions.length === 0 || actions[actions.length - 1].a !== a) actions.push({ t, a });
        else if (t - actions[actions.length - 1].t > 3) actions.push({ t, a });
      }
    }
    if (r.log.act.includes("ETERNITY")) eternityDone = true;

    const sig = `${s.ip}|${s.maxAML && s.maxAML.toFixed(1)}|${s.brk}|${(s.ids || []).map(i => i.amt).join(",")}`;
    const needSample = samples.length === 0 || t - samples[samples.length - 1].t >= 5 || sig !== lastSig;
    if (needSample) { samples.push({ ...s, t }); lastSig = sig; }
  }
  if (eternityDone) break;
  await new Promise(r => setTimeout(r, 250));
}

const fmtRow = s => `t=${String(s.t).padStart(7)}s IP=${String(s.ip).padEnd(11)}(10^${s.ipL === null ? "-" : s.ipL.toFixed(1).padStart(7)}) maxAM=10^${s.maxAML === null ? "-" : s.maxAML.toFixed(1).padStart(9)} 单次IP=10^${s.gainL === null ? "-" : s.gainL.toFixed(1).padStart(7)} inf=${String(s.inf).padEnd(8)} 升级=${s.upg} ipMult=${String(s.ipMult).padEnd(4)} 间隔=${String(s.interval).padStart(6)} Break=${s.brk ? "Y" : "n"} ID=[${(s.ids || []).map(i => i.amt).join(" ")}]`;

console.log("\n阶段时间线（秒，自起点算起）：");
console.log(JSON.stringify(stages, null, 2));
console.log("\n关键动作（去重后）：");
for (const a of actions.slice(0, 80)) console.log(`  ${String(a.t).padStart(7)}s  ${a.a}`);
console.log("\n采样：");
for (const s of samples) console.log(fmtRow(s));
if (errs.length) console.log(`\n页面异常 ${errs.length} 条：${errs.slice(0, 3).join(" | ")}`);
console.log(`\n总运行 ${((Date.now() - T0) / 1000).toFixed(0)} s；Eternity 实际执行=${eternityDone}`);
console.log(`结论：${stages.eternity !== undefined ? "到达 Eternity，用时 " + stages.eternity + " s" : "未到达 Eternity"}`);

await browser.close();
server.close();
process.exit(eternityDone ? 0 : 1);
