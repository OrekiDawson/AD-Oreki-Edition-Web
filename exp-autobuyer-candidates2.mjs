// 实验 v2：候选购买器（Tick Speed / 大坍塌）在受控隔离状态下的 off/on 对比
//
// 上一版两个缺陷已修：
// 1. effectiveInterval 有两道门（实例 usesSpeedScaledInterval + 全局 GameSpeed.scaleAutobuyerInterval），
//    只开前者不会生效；本版两个都开，并把非目标实例（含 AD）显式压回 false，保证一次只缩放一个。
// 2. 多种重置购买器同时活跃会让状态在几帧内崩塌（Δgalaxy 为负），无法比较；
//    本版只保留目标购买器，其余 prestige 购买器关闭，且 arm 之间状态完全一致。
//
// 场景：maxed = 存档现状（间隔已满级）；default = 目标购买器间隔重置为初始值（刚解锁的玩家）
// 用法：node exp-autobuyer-candidates2.mjs [--reps=2] [--frames=300]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_FILE = "132._9.1e137IP.txt";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const REPS = argNum("reps", 2);
const FRAMES = argNum("frames", 300);
const FRAME_MS = 20;

const ROOT_ABS = path.resolve(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT_ABS, "." + p);
  const rel = path.relative(ROOT_ABS, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8482, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8482/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 就绪");

const LIST = ["tickspeed", "dimboost", "galaxy", "bigCrunch"];

await page.evaluate((LIST) => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const inst = key => Autobuyer[key];
  const counts = {};
  let hooked = false;

  window.__c = {
    lg, num, LIST,
    hook() {
      if (hooked) return;
      for (const key of LIST) {
        const b = inst(key);
        const orig = b.tick.bind(b);
        counts[key] = 0;
        b.tick = (...args) => { counts[key]++; return orig(...args); };
      }
      hooked = true;
    },
    resetCnt() { for (const key of LIST) counts[key] = 0; },
    cnt() { return { ...counts }; },
    // 目标实例缩放 = true，其余（含 AD 的 8 个）显式压成 false
    applyScaling(target, scaled) {
      for (const key of LIST) {
        const b = inst(key);
        const want = scaled && key === target;
        Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => want });
      }
      for (const b of Autobuyer.antimatterDimension.zeroIndexed) {
        Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => false });
      }
      return {
        targetEff: inst(target).effectiveInterval,
        targetRaw: inst(target).interval,
        adEff: Autobuyer.antimatterDimension.zeroIndexed[0].effectiveInterval,
        adRaw: Autobuyer.antimatterDimension.zeroIndexed[0].interval,
      };
    },
    setup(text, F, target, scaled, scenario) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      // 第二道门也开：只有声明了 usesSpeedScaledInterval 的实例才真正被缩放
      GameSpeed.setScaleAutobuyerInterval(scaled);

      const before = {};
      for (const key of LIST) {
        const b = inst(key);
        before[key] = { bought: !!b.isBought, active: !!b.isActive, interval: b.interval };
        if (!b.isBought) b.data.isBought = true;
        // 只留目标，屏蔽其它 prestige 购买器（arm 之间一致）
        b.isActive = key === target;
      }
      if (scenario === "default") {
        const b = inst(target);
        b.data.interval = b.baseInterval;
        b.data.cost = 1;
      }
      // 大坍塌模式设为 AMOUNT 且阈值 1，让 canTick 只受间隔与 canCrunch 限制
      if (target === "bigCrunch") {
        player.auto.bigCrunch.mode = AUTO_CRUNCH_MODE.AMOUNT;
        player.auto.bigCrunch.amount = new Decimal(1);
      }
      // Tick Speed 场景：允许超过 1.8e308 继续增长，否则产量在几十帧内触顶无法比较
      if (target === "tickspeed") player.break = true;
      player.auto.autobuyersOn = true;

      const g = this.applyScaling(target, scaled);
      this.resetCnt();
      return {
        target, F, scaled, scenario, g,
        before,
        afterInterval: inst(target).interval,
        breakOn: !!player.break,
        autobuyersOn: player.auto.autobuyersOn,
        galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
      };
    },
    snap() {
      return {
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), eter: num(Currency.eternities.value),
        galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
        tickUpg: (() => { try { return Tickspeed.totalUpgrades; } catch (e) { return null; } })(),
        ipPerInf: (() => { try { return num(gainedInfinityPoints()); } catch (e) { return null; } })(),
        game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
      };
    },
    run(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__c.hook();
}, LIST);

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const rows = [];
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");

const matrix = [];
for (const target of ["tickspeed", "bigCrunch"]) {
  for (const scenario of ["maxed", "default"]) {
    for (const F of [1, 10000]) {
      for (const scaled of [false, true]) matrix.push({ target, scenario, F, scaled });
    }
  }
}

for (const cfg of matrix) {
  for (let rep = 1; rep <= REPS; rep++) {
    const info = await page.evaluate(({ text, cfg }) =>
      window.__c.setup(text, cfg.F, cfg.target, cfg.scaled, cfg.scenario), { text: saveText, cfg });
    const s0 = await page.evaluate(() => window.__c.snap());
    const t0 = Date.now();
    const s1 = await page.evaluate(({ n, ms }) => window.__c.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const cpuMs = Date.now() - t0;
    const cnt = await page.evaluate(() => window.__c.cnt());
    const row = {
      ...cfg, rep, cpuMs, info,
      ticks: cnt[cfg.target],
      dAm: s1.amLog - s0.amLog, dIp: s1.ipLog - s0.ipLog,
      dInf: s1.inf - s0.inf, dGal: s1.galaxies - s0.galaxies, dBoost: s1.dimboosts - s0.dimboosts,
      dTickUpg: (s1.tickUpg ?? 0) - (s0.tickUpg ?? 0),
      absInf0: s0.inf, absIp0: s0.ipLog,
      eff: info.g.targetEff, raw: info.g.targetRaw, adEff: info.g.adEff, adRaw: info.g.adRaw,
      intervalNow: info.afterInterval,
    };
    rows.push(row);
    console.log(`  ${cfg.target.padEnd(10)} ${cfg.scenario.padEnd(7)} F=${String(cfg.F).padStart(5)} ${cfg.scaled ? "on " : "off"} rep${rep}：` +
      `tick=${String(row.ticks).padStart(3)} eff=${(row.eff < 0.01 ? row.eff.toExponential(1) : row.eff.toFixed(0))}ms(raw ${row.raw}) ` +
      `ΔlogAM=${row.dAm.toFixed(3)} ΔlogIP=${row.dIp.toFixed(3)} Δ∞=${e(row.dInf)} ΔtickUpg=${row.dTickUpg} ` +
      `inf0=${e(row.absInf0)} CPU/帧=${(cpuMs / FRAMES).toFixed(3)}ms`);
  }
}

const agg = (target, scenario, F, scaled) => {
  const sub = rows.filter(r => r.target === target && r.scenario === scenario && r.F === F && r.scaled === scaled);
  if (!sub.length) return null;
  const avg = k => sub.reduce((a, b) => a + b[k], 0) / sub.length;
  return {
    ticks: avg("ticks"), dAm: avg("dAm"), dIp: avg("dIp"), dInf: avg("dInf"),
    dTickUpg: avg("dTickUpg"), cpu: avg("cpuMs") / FRAMES,
    eff: sub[0].eff, raw: sub[0].raw, adEff: sub[0].adEff,
  };
};

console.log("\n========== 汇总（同 REAL 窗口 = 帧数 × 20ms） ==========");
for (const target of ["tickspeed", "bigCrunch"]) {
  for (const scenario of ["maxed", "default"]) {
    for (const F of [1, 10000]) {
      for (const s of [false, true]) {
        const a = agg(target, scenario, F, s);
        console.log(` ${target.padEnd(10)} ${scenario.padEnd(7)} F=${String(F).padStart(5)} ${s ? "on " : "off"} ` +
          `tick=${a.ticks.toFixed(1).padStart(6)} ΔlogAM=${a.dAm.toFixed(3).padStart(9)} ΔlogIP=${a.dIp.toFixed(3).padStart(9)} ` +
          `Δ∞=${e(a.dInf).padStart(9)} ΔtickUpg=${a.dTickUpg.toFixed(1).padStart(7)} CPU=${a.cpu.toFixed(3)}ms eff=${(a.eff < 0.01 ? a.eff.toExponential(1) : a.eff.toFixed(0)).padStart(8)}ms`);
      }
    }
  }
}

// 机制断言：缩放必须真的改变 effectiveInterval，且 AD 不被牵连
const badScaling = rows.filter(r => {
  const expect = r.scaled ? r.raw / Math.max(1, r.F) : r.raw;
  return Math.abs(r.eff - expect) > 1e-6 || r.adEff !== r.adRaw;
});
console.log(`\n[机制] 缩放注入有效且 AD 未被牵连：${badScaling.length === 0 ? "PASS" : "FAIL（" + badScaling.length + " 行不符）"}`);

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-autobuyer-candidates2.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, frameMs: FRAME_MS, reps: REPS, rows, errors: errs }, null, 2));
console.log("已写入 _research/exp-autobuyer-candidates2.json");
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
