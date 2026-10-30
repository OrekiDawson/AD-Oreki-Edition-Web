// R34-A：整局冻结根因定位探针（独立脚本，不改共享 verify 脚本）
//
// 目的：把「约 420 秒后 player.lastUpdate 永久停止推进」这件事，拆成三种互斥情形并定位：
//   (1) 主循环 interval 根本没被调用（被 stop/clear，或定时器 id 被清掉）
//   (2) 主循环被调用但在 GAME_TICK_BEFORE 之后提前 return（gameLoop 里的早退分支）
//   (3) 主循环被调用但抛异常（被 GlobalErrorHandler 吞掉 / unhandledrejection）
//
// 判据：
//   tb = GAME_TICK_BEFORE 次数，ta = GAME_TICK_AFTER 次数
//     - tb/ta 都冻住            → (1)
//     - tb 涨、ta 不涨          → (2) 或 (3)
//   gameLoopStarted           → interval 是否还活着
//   errEvents                 → 是否有 throw
//
// 用法：node _r34-freeze-probe.mjs <时长秒>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve("../AD-Oreki-Edition");
const PORT_HTTP = 8814;
const PORT_EDGE = 9450;
const DURATION = Number(process.argv[2] || 600) * 1000;
const JSONL = path.resolve(`_r34-freeze-${Date.now()}.jsonl`);

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
await new Promise(r => server.listen(PORT_HTTP, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: PORT_EDGE });
// 可见性修复统一由 lib/edge-launch.mjs 的 openGame() 下发；
// A/B 对照组用 OREKI_NO_FOCUS_FIX=1 干净地关掉它（不额外打补丁，避免污染对照）。
const FOCUS_FIX = process.env.OREKI_NO_FOCUS_FIX !== "1";
const { page, errors: pageErrors } = await openGame(browser, { port: PORT_HTTP, emulateVisible: FOCUS_FIX });
console.log(`聚焦仿真: ${FOCUS_FIX ? "已开启（由 openGame 下发）" : "已关闭（对照组）"}`);

// ── 注入 A：在任何页面脚本之前生效的定时器审计 ──────────────────────────────
// 必须用 evaluateOnNewDocument（reload 之后仍然有效）
await page.evaluateOnNewDocument(() => {
  const R = globalThis.__r34 = globalThis.__r34 || {
    ivMap: new Map(), toMap: new Map(), lastIvId: null, lastToId: null,
    gameLoopIds: [], events: [], errs: [], counters: { iv: 0, to: 0, ci: 0, ct: 0 },
    t0: Date.now(),
  };
  const stamp = () => {
    try { return new Error().stack.split("\n").slice(2, 9).join(" | ").slice(0, 700); }
    catch (e) { return ""; }
  };
  const _si = window.setInterval.bind(window);
  const _ci = window.clearInterval.bind(window);
  const _st = window.setTimeout.bind(window);
  const _ct = window.clearTimeout.bind(window);
  window.setInterval = function(fn, ms, ...rest) {
    const id = _si(fn, ms, ...rest);
    R.counters.iv++;
    R.lastIvId = id;
    try { R.ivMap.set(id, { ms, at: Date.now() }); } catch (e) { /* ignore */ }
    return id;
  };
  window.clearInterval = function(id) {
    R.counters.ci++;
    try {
      if (R.ivMap.has(id)) {
        R.events.push({ type: "clearInterval", id, ms: R.ivMap.get(id).ms, t: Date.now() - R.t0, stack: stamp() });
        R.ivMap.delete(id);
      }
    } catch (e) { /* ignore */ }
    return _ci(id);
  };
  window.setTimeout = function(fn, ms, ...rest) {
    const id = _st(fn, ms, ...rest);
    R.counters.to++;
    R.lastToId = id;
    try { R.toMap.set(id, { ms, at: Date.now() }); } catch (e) { /* ignore */ }
    return id;
  };
  window.clearTimeout = function(id) {
    R.counters.ct++;
    try {
      if (R.toMap.has(id)) {
        R.events.push({ type: "clearTimeout", id, ms: R.toMap.get(id).ms, t: Date.now() - R.t0, stack: stamp() });
        R.toMap.delete(id);
      }
    } catch (e) { /* ignore */ }
    return _ct(id);
  };
  const addErr = (kind, payload) => {
    try { R.errs.push({ kind, t: Date.now() - R.t0, ...payload }); } catch (e) { /* ignore */ }
  };
  window.addEventListener("error", ev => {
    addErr("error", {
      message: String(ev.message || ""),
      filename: String(ev.filename || ""),
      lineno: ev.lineno, colno: ev.colno,
      stack: String((ev.error && ev.error.stack) || "").slice(0, 1200),
    });
  }, true);
  window.addEventListener("unhandledrejection", ev => {
    const r = ev.reason;
    addErr("unhandledrejection", {
      message: String((r && r.message) || r || ""),
      stack: String((r && r.stack) || "").slice(0, 1200),
    });
  });
});

// 真正的新档
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof GameIntervals === "object" && typeof PerformanceStats === "object"; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// ── 注入 B：主循环自调度链的语义审计 ────────────────────────────────────────
await page.evaluate(() => {
  const R = globalThis.__r34;
  R.loop = { starts: 0, stops: 0, enter: 0, after: 0, gameStarts: 0, gameEnds: 0 };
  const stackOf = () => {
    try { return new Error().stack.split("\n").slice(3, 9).join(" | ").slice(0, 700); }
    catch (e) { return ""; }
  };
  const logEv = e => { try { if (R.events.length < 4000) R.events.push({ t: Date.now() - R.t0, ...e }); } catch (x) { /* ignore */ } };

  // 1) GameIntervals：逐个 interval 包 start/stop
  try {
    // 给每个 interval 记一个语义名，否则日志里分不清是 gameLoop 还是 save 停了
    const names = new Map();
    for (const [k, v] of Object.entries(GameIntervals)) {
      if (v && typeof v === "object" && typeof v.start === "function") names.set(v, k);
    }
    for (const iv of GameIntervals.all()) {
      const s = iv.start.bind(iv);
      const p = iv.stop.bind(iv);
      const nm = names.get(iv) || "?";
      iv.start = function() { R.loop.starts++; logEv({ type: "iv.start", name: nm, stack: stackOf() }); return s(); };
      iv.stop = function() { R.loop.stops++; logEv({ type: "iv.stop", name: nm, stack: stackOf() }); return p(); };
    }
    // 记录 gameLoop interval 的 id
    const gls = GameIntervals.gameLoop.start.bind(GameIntervals.gameLoop);
    GameIntervals.gameLoop.start = function() {
      const r = gls();
      R.gameLoopIds.push(R.lastIvId);
      logEv({ type: "gameLoop.start", id: R.lastIvId });
      return r;
    };
  } catch (e) { logEv({ type: "hook.iv.fail", msg: String(e && e.message) }); }

  // 2) 全局崩溃处理器
  try {
    const orig = GlobalErrorHandler.stopGame.bind(GlobalErrorHandler);
    GlobalErrorHandler.stopGame = function() {
      logEv({ type: "GlobalErrorHandler.stopGame", handled: GlobalErrorHandler.handled, stack: stackOf() });
      return orig();
    };
  } catch (e) { logEv({ type: "hook.geh.fail", msg: String(e && e.message) }); }

  // 3) 帧内进度：GAME_TICK_BEFORE / GAME_TICK_AFTER
  try {
    const od = EventHub.dispatch.bind(EventHub);
    EventHub.dispatch = function(ev, ...args) {
      if (ev === "GAME_TICK_BEFORE") R.loop.enter++;
      else if (ev === "GAME_TICK_AFTER") R.loop.after++;
      return od(ev, ...args);
    };
  } catch (e) { logEv({ type: "hook.eh.fail", msg: String(e && e.message) }); }

  // 4) gameLoop 的 start/end 配对（判断早退 vs 抛错）
  try {
    const os = PerformanceStats.start.bind(PerformanceStats);
    const oe = PerformanceStats.end.bind(PerformanceStats);
    PerformanceStats.start = function(n) { if (n === "Game Update") R.loop.gameStarts++; return os(n); };
    PerformanceStats.end = function(n) { if (n === "Game Update") R.loop.gameEnds++; return oe(n); };
  } catch (e) { logEv({ type: "hook.ps.fail", msg: String(e && e.message) }); }

  // 5) simulateTime / Async 入口
  try {
    const orun = Async.run.bind(Async);
    Async.run = function(fun, maxIter, config) {
      logEv({ type: "Async.run.enter", maxIter, enabled: Async.enabled });
      const r = orun(fun, maxIter, config);
      logEv({ type: "Async.run.exit", maxIter, enabled: Async.enabled });
      return r;
    };
  } catch (e) { logEv({ type: "hook.async.fail", msg: String(e && e.message) }); }

  try {
    if (typeof simulateTime === "function") {
      const ost = simulateTime;
      globalThis.__r34_simCalls = 0;
      // simulateTime 是模块绑定，interval 里调用的是同一个函数对象，
      // 无法安全替换；只记录全局引用是否存在，够用。
      void ost;
    }
  } catch (e) { /* ignore */ }

  // 6) 玩家唯一需要点的那一下之外的自动化：本脚本不做任何购买，全交生产代码
  globalThis.__lg = v => {
    try {
      const t = v.toString();
      const i = t.indexOf("e");
      if (i < 0) return Math.log10(Math.abs(Number(t)));
      return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
    } catch (e) { return NaN; }
  };
});

console.log(`=== R34-A 冻结根因探针（${DURATION / 1000}s）日志: ${JSONL} ===`);
const t0 = Date.now();
let lastDumpIdx = 0;
let frozeAt = null;
let prev = null;
const summary = { maxAge: 0, maxAgeAt: null };

while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(cursor => {
    const R = globalThis.__r34 || {};
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const L = globalThis.__lg || (v => Number(v));
    const c = R.counters || {};
    return {
      age: pick(() => Date.now() - player.lastUpdate),
      lu: pick(() => player.lastUpdate),
      now: Date.now(),
      vis: pick(() => document.visibilityState),
      hidden: pick(() => document.hidden === true),
      focus: pick(() => document.hasFocus()),
      glStarted: pick(() => GameIntervals.gameLoop.isStarted === true),
      ivs: pick(() => GameIntervals.all().filter(i => i.isStarted).length),
      loop: pick(() => ({ ...R.loop })),
      counters: { iv: c.iv, to: c.to, ci: c.ci, ct: c.ct, liveIv: R.ivMap ? R.ivMap.size : -1 },
      asyncEnabled: pick(() => Async.enabled),
      progBar: pick(() => typeof ui !== "undefined" && ui.$viewModel && ui.$viewModel.modal.progressBar !== undefined),
      simLocked: pick(() => GameSpeed.isSimulationLocked),
      speed: pick(() => GameSpeed.factor),
      amL: pick(() => L(Currency.antimatter.value)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      epL: pick(() => L(Currency.eternityPoints.value)),
      tt: pick(() => Number(Currency.timeTheorems.value)),
      realities: pick(() => player.realities),
      eternities: pick(() => player.eternities),
      infinities: pick(() => player.infinities),
      db: pick(() => player.dimensionBoosts),
      gal: pick(() => player.galaxies),
      ec: pick(() => player.challenge.eternity.current),
      inCel: pick(() => isInCelestialReality() === true),
      celRun: pick(() => player.celestials.teresa.run || player.celestials.effarig.run ||
        player.celestials.enslaved.run || player.celestials.v.run || player.celestials.ra.run ||
        player.celestials.laitela.run || player.celestials.pelle.run),
      endState: pick(() => GameEnd.endState),
      isGameEnd: pick(() => player.isGameEnd === true),
      errsN: R.errs ? R.errs.length : 0,
      evN: R.events ? R.events.length : 0,
      evNew: R.events ? R.events.slice(cursor.v) : [],
      errNew: R.errs ? R.errs.slice(cursor.e) : [],
      lastDump: { v: (R.events || []).length, e: (R.errs || []).length },
    };
  }, lastDumpIdx).catch(e => ({ sampleErr: String(e && e.message || e).slice(0, 200) }));

  // 允许在页面内读不到 lastDumpIdxRef 时的退路
  if (s && s.lastDump) lastDumpIdx = s.lastDump;

  if (s.sampleErr) {
    console.log(`采样异常: ${s.sampleErr}`);
    await new Promise(r => setTimeout(r, 1000));
    continue;
  }

  const t = Math.round((Date.now() - t0) / 1000);
  s.t = t;
  delete s.lastDump;
  // 避免体积爆炸：事件只在发生时输出
  const evNew = s.evNew || [];
  const errNew = s.errNew || [];
  s.evCount = s.evN; s.errCount = s.errsN;
  delete s.evNew; delete s.errNew;

  if (Number.isFinite(s.age)) {
    if (s.age > summary.maxAge) { summary.maxAge = s.age; summary.maxAgeAt = t; }
  }
  if (frozeAt === null && s.age > 2000) frozeAt = t;

  fs.appendFileSync(JSONL, JSON.stringify({ sample: s }) + "\n");
  for (const e of evNew) fs.appendFileSync(JSONL, JSON.stringify({ event: e }) + "\n");
  for (const e of errNew) fs.appendFileSync(JSONL, JSON.stringify({ error: e }) + "\n");

  for (const e of evNew) console.log(`  [ev t=${(e.t / 1000).toFixed(1)}s] ${e.type}${e.name ? "(" + e.name + ")" : ""} ${e.msg || ""} ${e.stack ? ":: " + e.stack.slice(0, 300) : ""}`);
  for (const e of errNew) console.log(`  [ERR t=${(e.t / 1000).toFixed(1)}s] ${e.kind} ${e.message} @${e.filename || ""}:${e.lineno || ""} ${e.stack ? ":: " + e.stack.slice(0, 400) : ""}`);

  const lp = s.loop || {};
  if (t % 5 === 0 || t < 3 || (s.age > 2000 && (!prev || prev.age <= 2000))) {
    console.log(`t=${String(t).padStart(4)}s age=${String(s.age).padStart(7)}ms vis=${s.vis} hidden=${s.hidden} focus=${s.focus} glStarted=${s.glStarted} ivs=${s.ivs} enter=${lp.enter} after=${lp.after} gs=${lp.gameStarts} ge=${lp.gameEnds} asyncEn=${s.asyncEnabled} progBar=${s.progBar} simLocked=${s.simLocked} spd=${s.speed} | am=1e${String(s.amL).slice(0, 8)} ip=1e${String(s.ipL).slice(0, 7)} tt=${String(s.tt).slice(0, 9)} real=${s.realities} ec=${s.ec} cel=${s.inCel}/${s.celRun} end=${s.endState}`);
  }
  prev = s;
  await new Promise(r => setTimeout(r, 1000));
}

// 收尾：把剩余事件全部落盘
const tail = await page.evaluate(last => {
  const R = globalThis.__r34 || {};
  return {
    events: (R.events || []).slice(last.v),
    errs: (R.errs || []).slice(last.e),
    finalLoop: R.loop,
    gameLoopIds: R.gameLoopIds,
    liveIv: R.ivMap ? [...R.ivMap.entries()].map(([id, v]) => ({ id, ms: v.ms })) : [],
  };
}, lastDumpIdx).catch(() => null);
if (tail) {
  for (const e of tail.events) fs.appendFileSync(JSONL, JSON.stringify({ event: e }) + "\n");
  for (const e of tail.errs) fs.appendFileSync(JSONL, JSON.stringify({ error: e }) + "\n");
  fs.appendFileSync(JSONL, JSON.stringify({ tail }) + "\n");
  console.log("\n=== 末态审计 ===");
  console.log("loop:", JSON.stringify(tail.finalLoop));
  console.log("gameLoopIds:", JSON.stringify(tail.gameLoopIds));
  console.log("存活 interval:", JSON.stringify(tail.liveIv));
}

console.log(`\n首次 age>2000ms @ ${frozeAt === null ? "未冻结" : frozeAt + "s"}；age 峰值 ${summary.maxAge}ms @ ${summary.maxAgeAt}s`);
if (pageErrors.length) console.log("pageerror:", pageErrors.slice(0, 5));

await cleanup();
server.close();
process.exit(0);
