// 实验：反物质维度自动购买器的 interval 按全局倍率缩放（开关默认关闭）
// 对照：同一存档、同一窗口、F=1 / F=10000，开关 off/on
//
// 用法：node exp-autobuyer-scaling.mjs [--reps=3] [--frames=200]
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
const REPS = argNum("reps", 3);
const FRAMES = argNum("frames", 200);
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
await new Promise(r => server.listen(8480, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8480/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 就绪");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const ad = () => Autobuyer.antimatterDimension.zeroIndexed;   // tier 1-8
  const c = { adTicks: [0, 0, 0, 0, 0, 0, 0, 0], adOrder: [], tickTicks: 0, galaxyTicks: 0 };
  let hooked = false;

  window.__a = {
    lg, num,
    hook() {
      if (hooked) return true;
      ad().forEach((b, i) => {
        const orig = b.tick.bind(b);
        b.__origTick = orig;
        b.tick = (...args) => { c.adTicks[i]++; if (c.adOrder.length < 40) c.adOrder.push(i + 1); return orig(...args); };
      });
      for (const [key, b] of [["tickTicks", Autobuyer.tickspeed], ["galaxyTicks", Autobuyer.galaxy]]) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        b.tick = (...args) => { c[key]++; return orig(...args); };
      }
      hooked = true;
      return true;
    },
    resetCnt() { c.adTicks = [0, 0, 0, 0, 0, 0, 0, 0]; c.adOrder = []; c.tickTicks = 0; c.galaxyTicks = 0; return true; },
    cnt() { return { adTicks: [...c.adTicks], adOrder: [...c.adOrder], tickTicks: c.tickTicks, galaxyTicks: c.galaxyTicks }; },
    // 同一存档 + 固定初始状态；scaling 控制实验开关
    setup(text, F, scaling) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      const on = GameSpeed.setScaleAutobuyerInterval(scaling);
      // 让反物质维度购买器全部可用（存档里未必买过；两侧同样处理）
      let enabled = 0;
      const pre = [];
      ad().forEach(b => {
        try {
          pre.push({ bought: !!b.isBought, interval: b.interval });
          if (!b.isBought) b.data.isBought = true;
          b.isEnabled = true;
          enabled++;
        } catch (e) { /* ignore */ }
      });
      this.resetCnt();
      return { scaling: on, enabled, pre, effInterval: ad().map(b => (() => { try { return b.effectiveInterval; } catch (e) { return null; } })()), interval: ad().map(b => b.interval) };
    },
    snap() {
      return {
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), eter: num(Currency.eternities.value),
        game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
        speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })(),
      };
    },
    run(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
    defaultFlag() {
      // 模拟"首次访问"：清掉键后重新读默认值
      try { const key = GameSpeed.autobuyerScaleStorageKey; window.localStorage.removeItem(key); return GameSpeed.scaleAutobuyerInterval; } catch (e) { return null; }
    },
  };
  window.__a.hook();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "—");
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");

// 默认值检查（任何 setup 之前）
const defFlag = await page.evaluate(() => window.__a.defaultFlag());
check("[C0] 实验开关默认关闭（清掉 localStorage 键后读到的仍是 false）", defFlag === false, `读到 ${defFlag}`);

const rows = [];
for (const F of [1, 10000]) {
  for (const scaling of [false, true]) {
    for (let rep = 1; rep <= REPS; rep++) {
      const info = await page.evaluate(({ text, F, scaling }) => window.__a.setup(text, F, scaling), { text: saveText, F, scaling });
      const s0 = await page.evaluate(() => window.__a.snap());
      const t0 = Date.now();
      const s1 = await page.evaluate(({ n, ms }) => window.__a.run(n, ms), { n: FRAMES, ms: FRAME_MS });
      const cpuMs = Date.now() - t0;
      const cnt = await page.evaluate(() => window.__a.cnt());
      const row = {
        F, scaling, rep, cpuMs, info,
        dAm: s1.amLog - s0.amLog, dIp: s1.ipLog - s0.ipLog, dInf: s1.inf - s0.inf,
        dGame: s1.game - s0.game, dReal: s1.real - s0.real,
        adTotal: cnt.adTicks.reduce((a, b) => a + b, 0), adTicks: cnt.adTicks,
        adOrder: cnt.adOrder, tickTicks: cnt.tickTicks, galaxyTicks: cnt.galaxyTicks,
      };
      rows.push(row);
      console.log(`  F=${String(F).padStart(5)} 开关=${scaling ? "on " : "off"} rep${rep}：AD购买 ${String(row.adTotal).padStart(5)} 次 ` +
        `(tier ${row.adTicks.join("/")})，Δlog10(AM)=${row.dAm.toFixed(3)}，Δlog10(IP)=${row.dIp.toFixed(3)}，Δ无限=${e(row.dInf)}，` +
        `CPU/帧=${(cpuMs / FRAMES).toFixed(3)}ms，effInterval=${info.effInterval.map(v => (v === null ? "—" : (v < 0.01 ? v.toExponential(1) : v.toFixed(1)))).join(",")}`);
    }
  }
}

const agg = (F, scaling) => {
  const sub = rows.filter(r => r.F === F && r.scaling === scaling);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    adTotal: avg(sub.map(r => r.adTotal)), dIp: avg(sub.map(r => r.dIp)), dAm: avg(sub.map(r => r.dAm)),
    dInf: avg(sub.map(r => r.dInf)), cpu: avg(sub.map(r => r.cpuMs / FRAMES)),
    adTicks: sub[0].adTicks, order: sub[0].adOrder, tickTicks: sub[0].tickTicks, galaxyTicks: sub[0].galaxyTicks,
    dGame: avg(sub.map(r => r.dGame)), eff: sub[0].info.effInterval,
  };
};

console.log("\n========== 汇总（每次重复的平均） ==========");
console.log("     F   开关   AD购买次数   Δlog10(AM)   Δlog10(IP)   Δ无限       CPU/帧    每帧购买");
for (const F of [1, 10000]) {
  for (const s of [false, true]) {
    const a = agg(F, s);
    console.log(`  ${String(F).padStart(5)} ${s ? " on " : " off"} ${String(a.adTotal.toFixed(0)).padStart(10)} ${a.dAm.toFixed(4).padStart(11)} ${a.dIp.toFixed(4).padStart(12)} ${e(a.dInf).padStart(10)} ${a.cpu.toFixed(3).padStart(9)}ms ${(a.adTotal / FRAMES).toFixed(2).padStart(9)}`);
  }
}

const f1off = agg(1, false), f1on = agg(1, true);
const f10koff = agg(10000, false), f10kon = agg(10000, true);

console.log("");
check("[C1] F=1 时开关不改变行为（购买次数与产出完全一致）",
  Math.abs(f1on.adTotal - f1off.adTotal) < 1e-9 && Math.abs(f1on.dIp - f1off.dIp) < 1e-9,
  `off ${f1off.adTotal.toFixed(0)} 次 / on ${f1on.adTotal.toFixed(0)} 次；Δlog10(IP) ${f1off.dIp.toFixed(6)} vs ${f1on.dIp.toFixed(6)}`);
check("[C2] F=10000 时开关显著提高购买次数（≥10×）",
  f10kon.adTotal / Math.max(f10koff.adTotal, 1) >= 10,
  `off ${f10koff.adTotal.toFixed(0)} 次 → on ${f10kon.adTotal.toFixed(0)} 次（${(f10kon.adTotal / Math.max(f10koff.adTotal, 1)).toFixed(1)}×）`);
check("[C3] F=10000 时同窗口产出明显提高（Δlog10(IP) ≥ +0.1）",
  f10kon.dIp - f10koff.dIp >= 0.1,
  `off ${f10koff.dIp.toFixed(3)} → on ${f10kon.dIp.toFixed(3)}（+${(f10kon.dIp - f10koff.dIp).toFixed(3)}）`);
check("[C4] 购买顺序未被破坏（仍按 tier 1→8 循环，与关闭时同模式）",
  JSON.stringify(f10kon.order.slice(0, 8)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
  `开启后前 8 次：${f10kon.order.slice(0, 8).join(",")}`);
check("[C5] 非目标购买器不受影响（tick速度/星系购买器的触发次数与关闭时一致）",
  f10kon.tickTicks === f10koff.tickTicks && f10kon.galaxyTicks === f10koff.galaxyTicks,
  `tick ${f10koff.tickTicks} vs ${f10kon.tickTicks}；星系 ${f10koff.galaxyTicks} vs ${f10kon.galaxyTicks}`);
check("[C6] CPU 开销有界（开关开启后每帧耗时 ≤ 关闭时的 4 倍）",
  f10kon.cpu <= f10koff.cpu * 4,
  `off ${f10koff.cpu.toFixed(3)}ms/帧 → on ${f10kon.cpu.toFixed(3)}ms/帧（${(f10kon.cpu / f10koff.cpu).toFixed(2)}×）`);
check("[E] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

note("[口径] 帧数 × 20ms 是墙钟代理（稳定 50fps 的理想值），不是真实浏览器计时；CPU 是本次无头环境的实测耗时，真实浏览器只会更慢。");
note(`[机制] 生效间隔：F=1 时 off/on 都是 ${f1off.eff.slice(0, 3).map(v => v.toFixed(1)).join("/")}ms；` +
  `F=10000 时 off=${f10koff.eff.slice(0, 3).map(v => v.toFixed(1)).join("/")}ms，on=${f10kon.eff.slice(0, 3).map(v => v.toExponential(1)).join("/")}ms（= interval ÷ F）。`);

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-autobuyer-scaling.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, frameMs: FRAME_MS, reps: REPS, rows, verdict: results, errors: errs }, null, 2));
console.log("\n已写入 _research/exp-autobuyer-scaling.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
