// NC10–12 → 间隔升级 → Break Infinity → Eternity 全链实测（R5.11）
//
// 做什么：从一个「刚完成首次无限」的隔离状态出发，用**自动化最优操作**依次
//   1) 攒 16 次无限（解锁 NC10–12）
//   2) 进入 NC10 / NC11 / NC12（本 Mod 有「进入即完成」补丁，因此只测真实进入与结算）
//   3) 买满非重复 Infinity Upgrade + 反复买 ipMult
//   4) 买满大坍缩自动器间隔升级（interval ≤ 100）
//   5) Break Infinity
//   6) 冲 maxIP ≥ 1.79e308 并实际执行 Eternity
// 并记录每一步的现实耗时。
//
// 用法：node verify-nc-to-eternity.mjs [项目目录] [端口] [总时长秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8490);
const DURATION = Number(process.argv[4] || 180) * 1000;
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

const init = await page.evaluate(() => {
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
  try { GameIntervals.start(); } catch (e) { /* ok */ }
  GameUI.update();
  return { ip: "1", inf: String(player.infinities), interval: 150000 };
});
console.log("起点:", JSON.stringify(init));

const T0 = Date.now();
const stages = {};
const samples = [];
let eternityDone = false;

const tick = () => page.evaluate(() => {
  const fmt = v => (v && typeof v.mantissa === "number") ? `${v.mantissa.toFixed(2)}e${v.exponent}` : String(v);
  const log = { act: [] };

  // 1) 挑战：未完成且已解锁 → 进入（本 Mod 进入即完成）
  const nc = [10, 11, 12].map(id => {
    try {
      const c = NormalChallenge(id);
      return { id, done: c.isCompleted, unlocked: c.isUnlocked };
    } catch (e) { return { id, done: null, unlocked: null, err: true }; }
  });
  if (player.challenge.normal.current === 0) {
    const target = nc.find(c => c.unlocked && !c.done);
    if (target) { try { NormalChallenge(target.id).start(); log.act.push("enterNC" + target.id); } catch (e) { log.act.push("NCERR" + target.id); } }
  }

  // 2) 升级
  for (const u of InfinityUpgrade.all) {
    try { if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); log.act.push("upg"); } } catch (e) { /* ignore */ }
  }
  try { if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.purchase(); log.act.push("ipMult"); } } catch (e) { /* ignore */ }

  // 3) 间隔升级 / Break
  try {
    if (!Autobuyer.bigCrunch.hasMaxedInterval && Autobuyer.bigCrunch.canBeUpgraded) {
      Autobuyer.bigCrunch.upgradeInterval();
      log.act.push("interval");
    }
  } catch (e) { /* ignore */ }
  try { if (!player.break && Autobuyer.bigCrunch.hasMaxedInterval) { breakInfinity(); log.act.push("BREAK"); } } catch (e) { /* ignore */ }

  // 4) Eternity（真正执行，不只是看按钮）
  try {
    if (Player.canEternity) {
      log.canEternity = true;
      if (typeof eternity === "function") { eternity(false); log.act.push("ETERNITY"); }
    }
  } catch (e) { /* ignore */ }

  return {
    log,
    st: {
      t: Date.now(),
      ip: fmt(player.infinityPoints),
      maxIP: fmt(player.records.thisEternity.maxIP),
      inf: fmt(player.infinities),
      et: fmt(player.eternities),
      interval: Autobuyer.bigCrunch.interval,
      brk: player.break,
      upg: player.infinityUpgrades.size,
      ipMult: player.IPMultPurchases,
      gain: fmt(gainedInfinityPoints()),
      ncCur: player.challenge.normal.current,
      ncDone: [10, 11, 12].map(id => { try { return NormalChallenge(id).isCompleted; } catch (e) { return null; } }),
      canUpInt: (() => { try { return Autobuyer.bigCrunch.canBeUpgraded; } catch (e) { return null; } })(),
      canEternity: (() => { try { return Player.canEternity; } catch (e) { return false; } })(),
    },
  };
});

while (Date.now() - T0 < DURATION) {
  const r = await tick().catch(e => ({ st: null, err: String(e) }));
  if (r.st) {
    const t = +((r.st.t - T0) / 1000).toFixed(1);
    const s = r.st;
    const mark = (k, cond) => { if (cond && stages[k] === undefined) stages[k] = t; };
    mark("inf16", Number(s.inf.replace(/e.*/, "")) >= 1 && Number(s.inf.split("e")[1]) >= 1 && Number(s.inf.split("e")[0]) * Math.pow(10, Number(s.inf.split("e")[1])) >= 16);
    mark("nc10", s.ncDone[0] === true);
    mark("nc11", s.ncDone[1] === true);
    mark("nc12", s.ncDone[2] === true);
    mark("upg16", s.upg >= 16);
    mark("ipMult1", s.ipMult >= 1);
    mark("intervalMaxed", s.interval <= 100);
    mark("break", s.brk === true);
    mark("canEternity", s.canEternity === true);
    mark("eternity", s.et && s.et !== "0.00e0");
    if (r.log.act.includes("ETERNITY")) eternityDone = true;
    if (samples.length === 0 || t - samples[samples.length - 1].t >= 6) {
      samples.push({ ...s, t });
    }
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log("\n阶段时间线（秒，自起点算起）：");
console.log(JSON.stringify(stages, null, 2));
console.log("\n采样（每 ~6 s）：");
for (const s of samples) {
  console.log(`t=${String(s.t).padStart(6)}s IP=${String(s.ip).padEnd(10)} maxIP=${String(s.maxIP).padEnd(11)} inf=${String(s.inf).padEnd(9)} 升级=${s.upg} ipMult=${s.ipMult} 单次IP=${String(s.gain).padEnd(9)} 间隔=${String(s.interval).padStart(6)} 可升间隔=${s.canUpInt} Break=${s.brk ? "Y" : "n"} NC=${JSON.stringify(s.ncDone)} 挑战中=${s.ncCur} E=${s.et}`);
}
if (errs.length) console.log(`\n页面异常 ${errs.length} 条：${errs.slice(0, 3).join(" | ")}`);
console.log(`\n总运行 ${((Date.now() - T0) / 1000).toFixed(0)} s；Eternity 实际执行=${eternityDone}`);

await browser.close();
server.close();
