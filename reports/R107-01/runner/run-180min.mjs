// R104-02 · Web 真实新档 180 分钟通关实测跑分器
//
// 目标：用 Playwright 原生 API（chromium.launch / browser.newContext(viewport,isMobile,hasTouch) /
// newPage / page.evaluate / page.screenshot）在手机视口下，从真实全新存档起跑，
// 以真实墙钟（Date.now + performance.now 单调时钟）计时，判据为 window 内
// player.isGameEnd 首次为 true（MOD 终局：totalAntimatter 指数 >= 1000，见
// src/core/celestials/pelle/game-end.js 的 OREKI_PELLE_END_TARGET_EXP = 1e3）。
//
// 约束（R104 规则）：
//  - 不改 Date.now / performance.now / setTimeout / requestAnimationFrame / 游戏时间源；
//  - 不用离线结算、不复制他人存档、不写任何 player 字段；
//  - 真实新档：新建 browser context + 文档开始处 localStorage.clear() + 页面加载后 clear + reload；
//  - 采样：每 10s 一次轻量 evaluate（只读字段）；每 60s 截图；关键阶段额外截图；
//  - gameEnd 后继续跑 >=120s 确认不回退；
//  - 上限 180 分钟真实墙钟。
//
// 用法：
//   node r104-web-run.mjs --mode full    --out <dir> [--max-min 180] [--sample-ms 10000] [--shot-ms 60000] [--confirm-ms 180000]
//   node r104-web-run.mjs --mode control --out <dir> [--max-min 3]   [--sample-ms 5000]  [--shot-ms 30000]
//
// 说明：headless Chromium 不存在“可见窗口”，为规避 Chromium Page Lifecycle 冻结
// （web/_tools/lib/edge-launch.mjs 记录过该问题：页面被判定 hidden 后整页定时器停止），
// 本脚本只通过 Playwright 的 CDP session 下发 Emulation.setFocusEmulationEnabled 与
// Page.setWebLifecycleState(active) 两项“保持可见”仿真，并在每次采样里记录
// document.visibilityState 作为自证。所有点击/截图/取值均走 Playwright 高层 API。

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const WORKSPACE = "/home/oreki/AD-Oreki-Unified";
const REPO = WORKSPACE + "/web/AD-Oreki-Edition";

// ── 参数解析 ───────────────────────────────────────────────────────────────
function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}
const MODE = arg("mode", "full");
const MAX_MIN = Number(arg("max-min", MODE === "control" ? 3 : 180));
const SAMPLE_MS = Number(arg("sample-ms", MODE === "control" ? 5000 : 10000));
const SHOT_MS = Number(arg("shot-ms", MODE === "control" ? 30000 : 60000));
const CONFIRM_MS = Number(arg("confirm-ms", 180000));
// --probe-et 1（默认）：canEt 后每 >=30s 直接调用一次 tickEternity（诊断用，可能由探针触发结算）
// --probe-et 0：主跑 PASS 证据用，绝不主动调用，只读采样
const PROBE_ET = Number(arg("probe-et", 1)) === 1;
const MAX_WALL_MS = MAX_MIN * 60 * 1000;
const OUT = path.resolve(arg("out", WORKSPACE + "/reports/R104/web/run-" + stamp()));
const SHOTS = path.join(OUT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function iso(t = Date.now()) { return new Date(t).toISOString(); }
const T_START_MONO = performance.now();
let T_GAME0 = null; // 新档 document 起始（reload 前 Node 端单调时刻），墙钟统一起点

// ── 日志 ──────────────────────────────────────────────────────────────────
const RUN_LOG = path.join(OUT, "run.log");
const CONSOLE_LOG = path.join(OUT, "console.log");
const SAMPLES = path.join(OUT, "samples.jsonl");
const SUMMARY = path.join(OUT, "summary.json");
const runLogLines = [];
const consoleCounts = Object.create(null);
let consoleWritten = 0;
let consoleSuppressed = 0;
function rlog(...a) {
  const s = "[" + iso() + "] " + a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  runLogLines.push(s);
  try { fs.writeFileSync(RUN_LOG, runLogLines.join("\n") + "\n"); } catch (e) { /* ignore */ }
}
function clog(type, text) {
  const t = String(text).slice(0, 2000);
  // 高频 info 日志（如 OREKI_CRUNCH_DEC）只做前缀计数，避免把 Node 事件循环写死；
  // error/pageerror 一律完整记录。
  const isErr = type === "error" || type === "pageerror" || type === "requestfailed";
  const key = t.slice(0, 120);
  consoleCounts[key] = (consoleCounts[key] || 0) + 1;
  if (!isErr && consoleCounts[key] > 200) { consoleSuppressed++; return; }
  consoleWritten++;
  if (consoleWritten > 50000) { consoleSuppressed++; return; }
  try { fs.appendFileSync(CONSOLE_LOG, "[" + iso() + "][" + type + "] " + t + "\n"); } catch (e) { /* ignore */ }
}
function flushConsole() { try { if (consoleSuppressed > 0) fs.appendFileSync(CONSOLE_LOG, "[" + iso() + "][runner] 日志限流：省略 " + consoleSuppressed + " 条重复/超量 console 行（前缀计数见 summary）\n"); } catch (e) { /* ignore */ } }

// ── Playwright 解析（优先复用机器上已装好的 1.65.0 + chromium-1254）──────────
const PW_CANDIDATES = ["/tmp/pwtest", "/home/oreki/.npm/_npx/e41f203b7505f1fb", REPO, WORKSPACE];
function loadPlaywright() {
  const tried = [];
  for (const base of PW_CANDIDATES) {
    try {
      const req = createRequire(path.join(base, "noop.js"));
      const resolved = req.resolve("playwright");
      const mod = req("playwright");
      const version = req("playwright/package.json").version;
      return { chromium: mod.chromium, resolved, version, base };
    } catch (e) { tried.push(base + ": " + e.message); }
  }
  throw new Error("找不到 playwright。候选与错误：\n" + tried.join("\n"));
}

// ── 静态 HTTP 服务（纯静态源码目录）──────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".ttf": "font/ttf", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json", ".wav": "audio/wav",
};
function startServer(root) {
  const server = http.createServer((req, res) => {
    try {
      let p = decodeURIComponent(String(req.url || "/").split("?")[0].split("#")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.resolve(root, "." + p);
      if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); res.end("403"); return; }
      fs.stat(f, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 " + p); return; }
        const mime = MIME[path.extname(f).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime, "Content-Length": st.size, "Cache-Control": "no-store" });
        if (req.method === "HEAD") { res.end(); return; }
        fs.createReadStream(f).pipe(res);
      });
    } catch (e) { try { res.writeHead(500); res.end("500"); } catch (e2) { /* ignore */ } }
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

// ── 页面内初始化脚本（每个 document 开头执行）───────────────────────────
// 作用：1) 记录/清空 localStorage（保证真新档，且不受上一文档 unload 存档影响）
//      2) 记录 document 起始时间 t0（真实墙钟，不改任何游戏时间源）
//      3) 10ms 轮询在 player 出现的第一时间抄出生快照（结构性新档证据）
//      4) 维护 rAF 计数（只观测帧率，不参与游戏时间）
function initScript() {
  try {
    window.__orekiT0 = Date.now();
    window.__orekiTimeOrigin = performance.timeOrigin;
    const keys = [];
    try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) { /* ignore */ }
    window.__orekiStorageAtStart = keys;
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    window.__orekiStorageCleared = true;
    window.__orekiBirth = null;
    window.__orekiPlayerAt = null;
    const iv = setInterval(() => {
      try {
        if (!window.__orekiPlayerAt && window.player && typeof window.player === "object") {
          const p = window.player;
          window.__orekiPlayerAt = Date.now();
          window.__orekiBirth = {
            at: Date.now(),
            globalKeys: ["player", "Tab", "Tabs", "GameSpeed", "OrekiSmartExecutor", "Pelle", "GameEnd"].filter(k => k in window),
            realities: p.realities,
            brk: p.break === true,
            infinitiesLog10: (() => { try { return Math.round(Number(p.infinities.log10()) * 1e3) / 1e3; } catch (e) { return null; } })(),
            totalAntimatter: (() => { try { return String(p.celestials.pelle.records.totalAntimatter); } catch (e) { return null; } })(),
            antimatter: (() => { try { return String(p.antimatter); } catch (e) { return null; } })(),
            dimensionBoosts: p.dimensionBoosts,
            galaxies: p.galaxies,
            endState: (() => { try { return Number(window.GameEnd.endState); } catch (e) { return null; } })(),
            speed: (() => { try { return window.GameSpeed.factor; } catch (e) { return null; } })(),
            isDynamic: (() => { try { return window.GameSpeed.isDynamic; } catch (e) { return null; } })(),
            tutorialActive: p.tutorialActive,
            tutorialState: p.tutorialState,
            storageAtStart: window.__orekiStorageAtStart,
            // 自动存档键在出生时是否已存在（应为空数组）
            speedStorageAtStart: window.__orekiStorageAtStart,
          };
          clearInterval(iv);
        }
      } catch (e) { /* ignore */ }
    }, 10);
    window.__orekiFrames = 0;
    const rafCount = () => { window.__orekiFrames++; requestAnimationFrame(rafCount); };
    requestAnimationFrame(rafCount);
  } catch (e) {
    try { window.__orekiInitErr = String((e && e.message) || e); } catch (e2) { /* ignore */ }
  }
}

// ── 采样函数（页面内执行，只读）──────────────────────────────────────────
function sampleInPage() {
  const T = fn => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return "ERR:" + String((e && e.message) || e).slice(0, 120); } };
  const L = v => { try { return v && typeof v.log10 === "function" ? Math.round(v.log10() * 1e3) / 1e3 : null; } catch (e) { return null; } };
  const B = v => { try { return v === true; } catch (e) { return null; } };
  const now = Date.now();
  const o = {
    t: Math.round((now - window.__orekiT0) / 100) / 10,
    iso: new Date(now).toISOString(),
    vis: (() => { try { return document.visibilityState; } catch (e) { return null; } })(),
    hidden: (() => { try { return document.hidden === true; } catch (e) { return null; } })(),
    pageHasFocus: (() => { try { return document.hasFocus(); } catch (e) { return null; } })(),
    // 帧率（只观测）
    fps: (() => { try {
      const prev = window.__orekiFpsPrev;
      const cur = { at: now, frames: window.__orekiFrames || 0 };
      window.__orekiFpsPrev = cur;
      if (!prev || cur.at <= prev.at) return null;
      return Math.round(((cur.frames - prev.frames) / ((cur.at - prev.at) / 1000)) * 10) / 10;
    } catch (e) { return null; } })(),
  };

  // ── 终局判据与核心进度 ──────────────────────────────────────────────
  o.gameEnd = T(() => player.isGameEnd === true);
  o.endState = T(() => Math.round(Number(GameEnd.endState) * 1e6) / 1e6);
  o.doomed = T(() => (typeof Pelle !== "undefined" ? Pelle.isDoomed === true : null));
  o.pelleUnl = T(() => (typeof Pelle !== "undefined" ? Pelle.isUnlocked === true : null));
  o.realities = T(() => player.realities);
  o.etLog10 = T(() => { const v = Number(player.eternities.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.etStr = T(() => String(player.eternities).slice(0, 24));
  o.infLog10 = T(() => { const v = Number(player.infinities.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.infTotalLog10 = T(() => { const v = Number(Currency.infinitiesTotal.value.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.brk = T(() => player.break === true);
  o.amLog10 = T(() => { const v = Number(player.antimatter.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.ipLog10 = T(() => { const v = Number(Currency.infinityPoints.value.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.epLog10 = T(() => { const v = Number(Currency.eternityPoints.value.pLog10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.totAMLog10 = T(() => { const v = Number(player.celestials.pelle.records.totalAntimatter.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.dimBoost = T(() => player.dimensionBoosts);
  o.gal = T(() => player.galaxies);
  o.tt = T(() => Math.round(player.records.totalTimePlayed) / 1000);
  o.lastUpdate = T(() => Math.round(player.lastUpdate));

  // ── 阶段/研究/佩勒 ──────────────────────────────────────────────────
  o.tsN = T(() => { let n = 0; for (const s of (GameDatabase.eternity && GameDatabase.eternity.timeStudies ? GameDatabase.eternity.timeStudies.normal : [])) { try { if (TimeStudy(s.id).isBought) n++; } catch (e) { /* ignore */ } } return n; });
  o.ds6 = T(() => TimeStudy.reality.isBought === true);
  o.dsN = T(() => player.dilation.studies.length);
  o.ecDone = T(() => { const a = []; for (let i = 1; i <= 12; i++) { try { a.push(EternityChallenge(i).completions); } catch (e) { a.push("?"); } } return a.join(","); });
  // EC 链诊断（R104-02 P0 #7：EC1 入口资源=永恒次数，ecEntryPending 压永恒自锁）
  o.ecUnl = T(() => player.challenge.eternity.unlocked);
  o.ecCur = T(() => player.challenge.eternity.current);
  o.nextEc = T(() => globalThis.OrekiEternityAutomation.nextUnfinishedEcId());
  o.ecReq = T(() => {
    const a = globalThis.OrekiEternityAutomation;
    const id = a.nextUnfinishedEcId();
    if (!id) return null;
    const st = TimeStudy.eternityChallenge(id);
    const fmt = v => { try { let x = v; if (x && typeof x.toNumber === "function") x = x.toNumber(); const n = Number(x); return Number.isFinite(n) ? n : String(v).slice(0, 24); } catch (e) { return null; } };
    return { id, isBought: st.isBought === true, current: fmt(st.requirementCurrent), total: fmt(st.requirementTotal) };
  });
  o.ecPend2 = T(() => globalThis.OrekiEternityAutomation.ecEntryPending() === true);
  // 现实链 hold 诊断（pass4 出现 realities 冻结在 5）
  o.holdR = T(() => globalThis.OrekiCelestialAutomation ? globalThis.OrekiCelestialAutomation.holdReality === true : null);
  o.holdV = T(() => globalThis.OrekiCelestialAutomation ? globalThis.OrekiCelestialAutomation.holdRealityForV === true : null);
  o.holdDeep = T(() => globalThis.OrekiCelestialAutomation ? globalThis.OrekiCelestialAutomation.holdRealityForDeepChallenge === true : null);
  o.holdLai = T(() => globalThis.OrekiEndgameAutomation ? globalThis.OrekiEndgameAutomation.holdForLaitela === true : null);
  o.dilHold = T(() => globalThis.OrekiDilationAutomation ? globalThis.OrekiDilationAutomation._holdSinceMs ? Math.round((Date.now() - globalThis.OrekiDilationAutomation._holdSinceMs) / 1000) : 0 : null);
  o.realMinMs = T(() => { const a = globalThis.OrekiRealityAutomation; return a ? Math.round(Date.now() - (a._lastRealityAt || 0)) : null; });
  o.readySince = T(() => { const a = globalThis.OrekiRealityAutomation; return a && a._readySince ? Math.round((Date.now() - a._readySince) / 100) / 10 : 0; });
  o.ruBought = T(() => { const a = []; for (let i = 1; i <= 25; i++) { try { if (RealityUpgrade(i).isBought) a.push(i); } catch (e) { /* ignore */ } } return a.join(","); });
  o.ruAvail = T(() => { const a = []; for (let i = 1; i <= 25; i++) { try { const u = RealityUpgrade(i); if (!u.isBought && u.isAvailableForPurchase) a.push(i); } catch (e) { /* ignore */ } } return a.join(","); });
  o.rmL = T(() => { const v = Number(Currency.realityMachines.value.log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.glyphs = T(() => player.realities);
  o.ts171 = T(() => TimeStudy(171).isBought === true);
  o.tickGained = T(() => player.totalTickGained);
  // EP 增益来源诊断（P0 #10：maxEP 需 >= e4000 才能现实）
  o.maxEpExponent = T(() => player.records.thisReality.maxEP.exponent);
  o.maxEpLog10 = T(() => { const v = Number(player.records.thisReality.maxEP.log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.gainedEPLog10 = T(() => { const v = Number(gainedEternityPoints().log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.maxIPLog10 = T(() => { const v = Number(player.records.thisEternity.maxIP.log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.ttLog10 = T(() => { const v = Number(Currency.timeTheorems.value.log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.ipExponent = T(() => player.infinityPoints.exponent);
  o.crunchPolicy = T(() => { const p = globalThis.OrekiCrunchPolicy; const d = p && (p._lastDecision || p.lastDecision); return d ? { allow: d.allow, reason: d.reason || d.id || null } : null; });
  o.ecReqAll = T(() => {
    const a = globalThis.OrekiEternityAutomation;
    const out = [];
    for (let id = 1; id <= 12; id++) {
      try {
        const st = TimeStudy.eternityChallenge(id);
        const fmt = v => { let x = v; if (x && typeof x.toNumber === "function") x = x.toNumber(); const n = Number(x); return Number.isFinite(n) ? Math.round(n * 1e2) / 1e2 : String(v).slice(0, 16); };
        out.push({ id, bought: st.isBought === true, canBuy: st.canBeBought === true, cur: fmt(st.requirementCurrent), tot: fmt(st.requirementTotal) });
      } catch (e) { out.push({ id, err: true }); }
    }
    return out;
  });
  o.td = T(() => { const a = []; for (let i = 1; i <= 8; i++) { try { a.push(TimeDimension(i).bought); } catch (e) { a.push("?"); } } return a.join(","); });
  o.ru10b = T(() => RealityUpgrade(10).isBought === true);
  o.ruAll = T(() => RealityUpgrades.allBought === true);
  o.teresa = T(() => Teresa.isUnlocked === true);
  o.ach147 = T(() => Achievement(147).isUnlocked === true);
  o.laiTier = T(() => Laitela.difficultyTier);
  o.laiRun = T(() => Laitela.isRunning === true);
  o.iu25b = T(() => { const m = globalThis.OrekiEndgameAutomation ? globalThis.OrekiEndgameAutomation._iuBought : null; return m && m.iu25 === true; });
  o.doomPhase = T(() => (globalThis.OrekiEndgameAutomation ? globalThis.OrekiEndgameAutomation._doomPhase : null));
  o.gg = T(() => player.celestials.pelle.galaxyGenerator.generatedGalaxies);
  o.rsLog10 = T(() => { const v = Number(Currency.realityShards.value.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });

  // ── 速度 / 教程（默认值自证）───────────────────────────────────────
  o.spdStored = T(() => localStorage.getItem("oreki-game-speed"));
  o.spdDynStored = T(() => localStorage.getItem("oreki-game-speed-dynamic"));
  o.factor = T(() => GameSpeed.factor);
  o.factorEff = T(() => GameSpeed.effectiveFactor);
  o.isDynamic = T(() => GameSpeed.isDynamic === true);
  o.ramps = T(() => GameSpeed.dynamicRampCount);
  o.tutActive = T(() => player.tutorialActive);
  o.tutState = T(() => player.tutorialState);

  // ── [R104-02 诊断] 首次永恒门禁（只读；不调用有副作用的 _justCrunchedFrame）──
  o.etGate = T(() => {
    const a = globalThis.OrekiEternityAutomation;
    const ex = globalThis.OrekiSmartExecutor;
    const token = (() => { try { return Currency.infinities.value.toNumber(); } catch (e) { return null; } })();
    const lastToken = a ? a._lastInfinitiesToken : null;
    const skipFrames = a ? a._crunchSkipFrames : null;
    return {
      active: a ? a.active === true : null,
      stageAllowed: ex ? ex.eternityStageAllowed() === true : null,
      holdRu10: a ? a.holdForRealityUpgrade10() === true : null,
      ecPend: a ? a.ecEntryPending() === true : null,
      break: player.break === true,
      canEt: Player.canEternity === true,
      infinityUnlocked: (() => { try { return PlayerProgress.infinityUnlocked() === true; } catch (e) { return null; } })(),
      gainedEPLog10: (() => { try { return Math.round(Number(gainedEternityPoints().log10()) * 1e2) / 1e2; } catch (e) { return null; } })(),
      epLog10: (() => { try { return Math.round(Number(Currency.eternityPoints.value.log10()) * 1e2) / 1e2; } catch (e) { return null; } })(),
      infToken: token, lastToken: lastToken === undefined ? null : lastToken, skipFrames,
      skipStreak: a ? (a._crunchSkipStreak === undefined ? null : a._crunchSkipStreak) : null,
      tokenChanged: lastToken === undefined || lastToken === null ? null : token !== lastToken,
      // 只读推断：下一次 tickEternity 的 _justCrunchedFrame 是否会命中
      wouldSkipCrunch: lastToken === undefined || lastToken === null ? false : (token !== null && token !== lastToken) || (typeof skipFrames === "number" && skipFrames > 0),
      iu15Freeze: (() => { try { return globalThis.OrekiIu15Sprint ? globalThis.OrekiIu15Sprint.freezeResets === true : null; } catch (e) { return null; } })(),
    };
  });

  // ── 自动化健康 ─────────────────────────────────────────────────────
  o.auto = T(() => {
    const d = globalThis.OrekiSmartExecutor && globalThis.OrekiSmartExecutor.debugState ? globalThis.OrekiSmartExecutor.debugState() : null;
    if (!d) return null;
    return {
      enabled: d.enabled, intervalSec: d.intervalSec, strictGlobal: d.strictGlobal,
      stage: d.stage ? d.stage.id : null,
      goalId: d.goal ? d.goal.id : null,
      actionCount: d.actionCount, attemptCount: d.attemptCount,
      lastExecAgoSec: d.lastExecAgoSec, stalledSec: d.stalledSec,
      degraded: d.degraded, degradedCount: d.degradedCount,
      error: d.error ? String(d.error).slice(0, 160) : null,
      manualHold: d.manualHold ? d.manualHold : null,
      nextInMs: d.beat ? d.beat.nextInMs : null,
      blockers: (d.blockers || []).map(b => (b && (b.id || b.label || b.why)) || "?").slice(0, 6),
      noAction: d.noAction ? String(JSON.stringify(d.noAction)).slice(0, 200) : null,
      lastAction: d.action ? { verb: d.action.verb, source: d.action.source, acted: d.action.acted } : null,
      served: d.beat ? d.beat.served : null,
      beatLog: d.beat && Array.isArray(d.beat.log) ? d.beat.log.slice(-8).map(x => ({ task: x.task, gapMs: x.gapMs, taskGapMs: x.taskGapMs })) : null,
    };
  });
  // 核心成长链（首次永恒前的真实门槛相关）
  o.maxAMLog10 = T(() => { const v = Number(player.records.thisInfinity.maxAM.log10()); return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : v; });
  o.id1Unl = T(() => InfinityDimension(1).isUnlocked === true);
  o.idUnlN = T(() => { let n = 0; for (let i = 1; i <= 8; i++) { try { if (InfinityDimension(i).isUnlocked) n++; } catch (e) { /* ignore */ } } return n; });
  o.ipMult = T(() => player.IPMultPurchases);
  o.canEternity = T(() => Player.canEternity === true);
  // ── [R104-02 P0] 首次永恒门禁与引导窗口（Lead 修复后必须逐样本可见）──
  o.eAutoActive = T(() => player.auto.eternity.isActive === true);
  o.eAutoUnl = T(() => { try { return Autobuyer.eternity.isUnlocked === true; } catch (e) { return null; } });
  o.eAutoMilestone = T(() => { try { return globalThis.EternityMilestone.autobuyerEternity.isReached === true; } catch (e) { return null; } });
  o.eBootstrap = T(() => { try { return globalThis.OrekiEternityAutomation._eternityBootstrapActive() === true; } catch (e) { return null; } });
  o.eFreshSession = T(() => { try { return globalThis.OrekiEternityAutomation._freshSessionBootstrap; } catch (e) { return null; } });
  o.eAdopted = T(() => { try { return globalThis.OrekiEternityAutomation._eternityAutobuyerAdopted === true; } catch (e) { return null; } });
  o.etGoalLog10 = T(() => { const v = Number(Player.eternityGoal.log10()); return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : v; });
  o.eternityUnlocked = T(() => PlayerProgress.eternityUnlocked() === true);
  o.smStage = T(() => { const e = globalThis.OrekiSmartStrategy ? globalThis.OrekiSmartStrategy.evaluate() : null; return e && e.stage ? e.stage.id : null; });
  o.smDeg = T(() => { const e = globalThis.OrekiSmartStrategy ? globalThis.OrekiSmartStrategy.evaluate() : null; return e ? e.degraded : null; });
  o.errE = T(() => (globalThis.OrekiEternityAutomation ? globalThis.OrekiEternityAutomation._lastError || "" : null));
  o.errR = T(() => (globalThis.OrekiRealityAutomation ? globalThis.OrekiRealityAutomation._lastError || "" : null));
  o.errC = T(() => (globalThis.OrekiCelestialAutomation ? globalThis.OrekiCelestialAutomation._lastError || "" : null));
  o.errD = T(() => (globalThis.OrekiDilationAutomation ? globalThis.OrekiDilationAutomation._lastError || "" : null));
  o.errG = T(() => (globalThis.OrekiEndgameAutomation ? globalThis.OrekiEndgameAutomation._lastError || "" : null));
  o.errX = T(() => (globalThis.OrekiSmartExecutor && globalThis.OrekiSmartExecutor.debugState ? globalThis.OrekiSmartExecutor.debugState().error : null));

  return o;
}

// ── 环境与源码身份 ───────────────────────────────────────────────────────
function gitOut(cmd) {
  try { return execSync(cmd, { cwd: REPO, encoding: "utf8", timeout: 15000 }).trim(); } catch (e) { return "ERR:" + e.message; }
}
const SOURCE_SHA = gitOut("git rev-parse HEAD");
const SOURCE_SHA_FULL = gitOut("git rev-parse HEAD");
const SOURCE_BRANCH = gitOut("git rev-parse --abbrev-ref HEAD");
const SOURCE_DIRTY = gitOut("git status --porcelain");
const SOURCE_LAST_COMMIT = gitOut("git log -1 --format='%H %cI %s'");
const SOURCE_DIRTY_STAT = gitOut("git diff --stat");
const SOURCE_DIRTY_FILES = gitOut("git status --porcelain");

// ── 主流程 ───────────────────────────────────────────────────────────────
const summary = {
  run_id: path.basename(OUT),
  mode: MODE,
  criterion: {
    id: "player.isGameEnd-first-true",
    description: "window 内 player.isGameEnd 首次为 true 即通关",
    formula_file: "web/AD-Oreki-Edition/src/core/celestials/pelle/game-end.js",
    OREKI_PELLE_END_OFFSET: 1,
    OREKI_PELLE_END_TARGET_EXP: 1000,
    pass_condition: "gameEnd 首次为 true 且真实墙钟耗时 <= 180 分钟",
  },
  source: {
    repo: REPO,
    sha: SOURCE_SHA,
    branch: SOURCE_BRANCH,
    dirty: SOURCE_DIRTY === "" ? "" : SOURCE_DIRTY,
    dirty_stat: SOURCE_DIRTY_STAT,
    dirty_files: SOURCE_DIRTY_FILES,
    last_commit: SOURCE_LAST_COMMIT,
  },
  environment: {
    host: (() => { try { return os.hostname(); } catch (e) { return "?"; } })(),
    platform: process.platform + " " + process.arch,
    node: process.version,
    playwright: null,
    chromium_executable: null,
    browser_version: null,
    viewport: { width: 412, height: 915 },
    device_scale_factor: 2.625,
    is_mobile: true,
    has_touch: true,
    user_agent: null,
    locale: "zh-CN",
    launch_args: [],
    server: null,
    page_visibility_enforcement: "Playwright CDP session: Emulation.setFocusEmulationEnabled + Page.setWebLifecycleState(active)（仅保活仿真，不碰游戏时间源）",
  },
  timing: {
    start_iso: null,
    start_monotonic_ms: Math.round(T_START_MONO * 1000) / 1000,
    end_iso: null,
    end_monotonic_ms: null,
    wall_sec_total: null,
    gameend_wall_sec: null,
    gameend_iso: null,
    stopwatch_note: "t0 = 新档文档起始 Date.now()（页面内 __orekiT0）；墙钟 = Node performance.now() 单调差值自 T_GAME0；全程不改任何游戏时间源",
    process_start_monotonic_ms: Math.round(T_START_MONO * 1000) / 1000,
  },
  freshness: {
    method: "全新 browser context（无 storage）+ 每个 document 起始 localStorage.clear() + 页面加载后 clear + reload",
    storage_keys_at_start: null,
    birth: null,
    verdict: null,
  },
  defaults: {
    speed_storage_at_birth: null,
    speed_dynamic_storage_at_birth: null,
    speed_factor_at_birth: null,
    speed_is_dynamic_at_birth: null,
    tutorial_active_at_birth: null,
    tutorial_state_at_birth: null,
    automation_interval_sec_at_birth: null,
    final_speed_factor: null,
    speed_ramps: null,
    note: "oreki-game-speed 默认 10000×、动态升档默认开启；均为产品默认值，本轮不修改",
  },
  events: [],
  firsts: {},
  gameend: { reached: false, at_wall_sec: null, at_iso: null, sample: null },
  confirm: { duration_ms: CONFIRM_MS, samples_after: 0, regressions: 0, ok: false },
  samples: { count: 0, interval_ms: SAMPLE_MS, screenshots: 0, screenshot_interval_ms: SHOT_MS },
  anomalies: { pageerrors: [], console_errors: [], sample_errors: [], freeze_watchdog: [], aborted: null },
  result: null,
  result_reason: null,
};
function writeSummary() {
  try { fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + "\n"); } catch (e) { /* ignore */ }
}

let server = null, browser = null, context = null, page = null, cdp = null;
let stopped = false;
const events = [];
const firsts = {};
let gameEndAtWallMs = null;
let gameEndSample = null;
let samplesAfterEnd = 0, regressionsAfterEnd = 0;
let shotCount = 0, lastShotAt = 0, eventSeq = 0;
let sampleCount = 0;
const sampleErrors = [];
const fpsVals = [];
const visVals = [];
let lastEtProbeAt = -1e9;
let etProbeCount = 0;
let etProbeSettled = false;
let firstServed = null;
let prevServed = null;
let freezeStreak = 0;
let prevLt = null, prevTt = null;
let finalState = null;

function wallSec() {
  const base = T_GAME0 === null ? T_START_MONO : T_GAME0;
  return Math.round((performance.now() - base) / 100) / 10;
}

async function shot(name) {
  try {
    const file = path.join(SHOTS, name + ".png");
    await page.screenshot({ path: file, type: "png" });
    shotCount++;
    lastShotAt = Date.now();
    return file;
  } catch (e) {
    rlog("[shot-fail]", name, String((e && e.message) || e));
    return null;
  }
}

function addEvent(tag, key, value, extra) {
  eventSeq++;
  const ev = {
    seq: eventSeq, tag, key, value: value === undefined ? null : value,
    wall_sec: wallSec(),
    iso: iso(),
    in_page_t: finalState ? finalState.t : null,
  };
  if (extra) Object.assign(ev, extra);
  events.push(ev);
  firsts[key] = ev;
  summary.events = events;
  summary.firsts = firsts;
  writeSummary();
  rlog("[EVENT]", tag, JSON.stringify(ev));
}

// 事件判定（只在 false→true / 阈值首次跨越时记录）
const EVENT_DEFS = [
  { key: "break", tag: "首次打破无限(player.break)", test: s => s.brk === true },
  { key: "infinity", tag: "首次无限(infTotal>=1)", test: s => typeof s.infTotalLog10 === "number" && s.infTotalLog10 >= 0 },
  { key: "eternity", tag: "首次永恒(eternities>=1)", test: s => typeof s.etLog10 === "number" && s.etLog10 >= 0 },
  { key: "reality", tag: "首次现实(realities>=1)", test: s => typeof s.realities === "number" && s.realities >= 1 },
  { key: "reality5", tag: "5 现实", test: s => typeof s.realities === "number" && s.realities >= 5 },
  { key: "reality20", tag: "20 现实", test: s => typeof s.realities === "number" && s.realities >= 20 },
  { key: "reality100", tag: "100 现实", test: s => typeof s.realities === "number" && s.realities >= 100 },
  { key: "timestudy", tag: "首次时间研究(tsN>=1)", test: s => typeof s.tsN === "number" && s.tsN >= 1 },
  { key: "ds6", tag: "首次现实时间研究(TimeStudy.reality)", test: s => s.ds6 === true },
  { key: "dilation", tag: "首次膨胀研究(dsN>=1)", test: s => typeof s.dsN === "number" && s.dsN >= 1 },
  { key: "teresa", tag: "特蕾莎解锁", test: s => s.teresa === true },
  { key: "ru10", tag: "现实升级 RU10 已购", test: s => s.ru10b === true },
  { key: "ruAll", tag: "全部现实升级", test: s => s.ruAll === true },
  { key: "ach147", tag: "成就 147", test: s => s.ach147 === true },
  { key: "pelleUnl", tag: "佩勒已解锁", test: s => s.pelleUnl === true },
  { key: "doomed", tag: "doomed(佩勒毁灭现实)", test: s => s.doomed === true },
  { key: "laitela", tag: "莱特拉难度层>=1", test: s => typeof s.laiTier === "number" && s.laiTier >= 1 },
  { key: "iu25", tag: "IU25 已购", test: s => s.iu25b === true },
  { key: "gameEnd", tag: "首次 isGameEnd=true（通关）", test: s => s.gameEnd === true },
];

function checkEvents(s) {
  for (const def of EVENT_DEFS) {
    if (firsts[def.key]) continue;
    let hit = false;
    try { hit = def.test(s); } catch (e) { hit = false; }
    if (hit) {
      const extra = {
        realities: s.realities, endState: s.endState, totAMLog10: s.totAMLog10,
        doomed: s.doomed, brk: s.brk, factor: s.factor, ramps: s.ramps,
        in_game_tt_sec: s.tt,
      };
      addEvent(def.tag, def.key, tagValue(s, def.key), extra);
      // 关键事件额外截图
      shot("evt-" + String(eventSeq).padStart(2, "0") + "-" + def.key + "-t" + Math.round(wallSec()) + "s");
      if (def.key === "gameEnd") {
        gameEndAtWallMs = performance.now();
        gameEndSample = s;
        summary.gameend = {
          reached: true, at_wall_sec: wallSec(), at_iso: iso(), at_in_page_t: s.t,
          sample: s,
        };
        summary.timing.gameend_wall_sec = wallSec();
        summary.timing.gameend_iso = iso();
        writeSummary();
        rlog("[GAMEEND]", JSON.stringify({ wall: wallSec(), t: s.t, endState: s.endState, totAMLog10: s.totAMLog10, realities: s.realities, factor: s.factor, ramps: s.ramps }));
      }
    }
  }
}
function tagValue(s, key) {
  switch (key) {
    case "break": return s.brk;
    case "infinity": return s.infTotalLog10;
    case "eternity": return s.etLog10;
    case "reality": case "reality5": case "reality20": case "reality100": return s.realities;
    case "timestudy": return s.tsN;
    case "ds6": return s.ds6;
    case "dilation": return s.dsN;
    case "doomed": return s.doomed;
    case "gameEnd": return s.gameEnd;
    default: return s[key] === undefined ? null : s[key];
  }
}

async function takeSample() {
  const nodeNow = Date.now();
  const mono = performance.now();
  let s;
  try {
    s = await page.evaluate(sampleInPage);
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    sampleErrors.push({ at: iso(nodeNow), error: msg });
    summary.anomalies.sample_errors = sampleErrors.slice(-20);
    rlog("[sample-error]", msg);
    return null;
  }
  sampleCount++;
  s.node_iso = iso(nodeNow);
  s.wall_sec = Math.round((mono - T_START_MONO) / 100) / 10;
  finalState = s;
  if (typeof s.fps === "number" && Number.isFinite(s.fps)) fpsVals.push(s.fps);
  if (typeof s.vis === "string") visVals.push(s.vis);
  // 本次采样相对上一次的「任务被服务次数」增量（验证 eternityReset 是否真的 didAct）
  if (s.auto && s.auto.served) {
    const cur = s.auto.served;
    s.served_delta = prevServed ? Object.fromEntries(Object.keys(cur).map(k => [k, cur[k] - (prevServed[k] || 0)])) : null;
    prevServed = { ...cur };
  }
  summary.samples.count = sampleCount;
  fs.appendFileSync(SAMPLES, JSON.stringify(s) + "\n");

  // 冻死看门狗：连续 6 次采样里 lastUpdate 与游戏内累计时间都不动 → 判定疑似冻结并尝试保活
  if (s.lastUpdate !== null && s.tt !== null) {
    if (prevLt !== null && s.lastUpdate === prevLt && s.tt === prevTt) freezeStreak++;
    else freezeStreak = 0;
    if (freezeStreak >= 6) {
      const rec = { at: iso(), wall_sec: wallSec(), vis: s.vis, hidden: s.hidden, streak: freezeStreak };
      summary.anomalies.freeze_watchdog.push(rec);
      rlog("[watchdog] 疑似页面冻结", JSON.stringify(rec));
      freezeStreak = 0;
      try {
        await page.bringToFront();
        if (cdp) {
          await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
          await cdp.send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
        }
        rlog("[watchdog] 已重新下发 focus/lifecycle 保活（未触碰游戏时间源）");
      } catch (e) { rlog("[watchdog] 保活失败", String((e && e.message) || e)); }
    }
    prevLt = s.lastUpdate; prevTt = s.tt;
  }

  // 调度器服务计数（验证 eternity/eternityReset 不再被饿死）
  if (s.auto && s.auto.served) {
    if (firstServed === null) firstServed = s.auto.served;
    const delta = {};
    for (const k of Object.keys(s.auto.served)) delta[k] = s.auto.served[k] - (firstServed[k] || 0);
    summary.scheduler = {
      served_first: firstServed,
      served_last: s.auto.served,
      served_delta: delta,
      eternity_served: s.auto.served.eternity || 0,
      eternity_reset_served: s.auto.served.eternityReset || 0,
      eternity_reset_served_delta_total: (s.auto.served.eternityReset || 0) - ((firstServed && firstServed.eternityReset) || 0),
      eternity_served_delta_total: (s.auto.served.eternity || 0) - ((firstServed && firstServed.eternity) || 0),
      last_beat_log: s.auto.beatLog || null,
      note: "OrekiSmartExecutor.debugState().beat.served 累计值；修复后 eternityReset 必须 > 0",
    };
  }

  // 事件
  checkEvents(s);

  // ── [R104-02 诊断] canEternity 已真而 eternities 仍为 0 时，每 >=30s 显式调用一次 tickEternity()，
  //    记录返回值与调用前后门禁快照（Lead 授权：只读观察；若真的结算了，说明是“被主循环跳过”）。
  const etCount = (() => { try { return Number(player.eternities.log10()); } catch (e) { return null; } })();
  if (PROBE_ET && MODE !== "control" && s.canEternity === true && !etProbeSettled && s.gameEnd !== true && (performance.now() - lastEtProbeAt > 30000) && etProbeCount < 12) {
    lastEtProbeAt = performance.now();
    etProbeCount++;
    try {
      const pr = await page.evaluate(() => {
        const a = globalThis.OrekiEternityAutomation;
        const g = () => {
          const out = {};
          try { out.et = String(player.eternities); } catch (e) { out.et = "ERR"; }
          try { out.epL = Math.round(Number(Currency.eternityPoints.value.log10()) * 1e2) / 1e2; } catch (e) { out.epL = null; }
          try { out.token = Currency.infinities.value.toNumber(); } catch (e) { out.token = null; }
          out.lastToken = a._lastInfinitiesToken === undefined ? null : a._lastInfinitiesToken;
          out.skipFrames = a._crunchSkipFrames;
          out.autoActive = player.auto.eternity.isActive === true;
          try { out.gainedEPL = Math.round(Number(gainedEternityPoints().log10()) * 1e2) / 1e2; } catch (e) { out.gainedEPL = null; }
          out.canEt = Player.canEternity === true;
          out.break = player.break === true;
          out.active = a.active === true;
          out.stageAllowed = globalThis.OrekiSmartExecutor.eternityStageAllowed() === true;
          return out;
        };
        const before = g();
        let ret = null, err = null;
        try { ret = a.tickEternity(); } catch (e) { err = String((e && e.message) || e); }
        const after = g();
        return { before, ret, err, after };
      });
      const rec = { wall_sec: wallSec(), in_page_t: s.t, probe: etProbeCount, ...pr };
      (summary.et_probes = summary.et_probes || []).push(rec);
      rlog("[et-probe]", JSON.stringify(rec));
      // 如果探针真的结算了永恒（返回 true 或 eternities/EP 变化），后续不再探针
      if (pr.ret === true || (pr.after && pr.before && pr.after.et !== pr.before.et)) etProbeSettled = true;
      writeSummary();
    } catch (e) {
      rlog("[et-probe-error]", String((e && e.message) || e));
    }
  }

  // 周期性截图
  if (Date.now() - lastShotAt >= SHOT_MS) {
    shot("img-" + String(shotCount + 1).padStart(3, "0") + "-t" + Math.round(wallSec()) + "s");
  }

  // 通关后确认窗口
  if (gameEndAtWallMs !== null) {
    samplesAfterEnd++;
    summary.confirm.samples_after = samplesAfterEnd;
    if (s.gameEnd !== true) { regressionsAfterEnd++; summary.confirm.regressions = regressionsAfterEnd; rlog("[REGRESS] gameEnd 回落", JSON.stringify({ wall: s.wall_sec, endState: s.endState })); }
    summary.confirm.ok = regressionsAfterEnd === 0;
  }

  summary.samples.screenshots = shotCount;
  summary.timing.end_iso = iso();
  summary.timing.end_monotonic_ms = Math.round(performance.now() * 1000) / 1000;
  summary.timing.wall_sec_total = wallSec();
  if (s.factor !== null) summary.defaults.final_speed_factor = s.factor;
  if (s.ramps !== null) summary.defaults.speed_ramps = s.ramps;
  writeSummary();

  // 控制台行（进度概览）
  const brief = {
    wall: s.wall_sec, t: s.t, fps: s.fps, vis: s.vis,
    game: s.gameEnd ? 1 : 0, end: s.endState, r: s.realities, et: s.etLog10, inf: s.infTotalLog10,
    doom: s.doomed ? 1 : 0, totAM: s.totAMLog10, tt: s.tt, brk: s.brk ? 1 : 0,
    spd: s.factor, ramp: s.ramps, sm: s.smStage, err: [s.errE, s.errR, s.errC, s.errD, s.errG, s.errX].filter(Boolean).join("|").slice(0, 80),
    ip: s.ipLog10, maxAM: s.maxAMLog10, id1: s.id1Unl ? 1 : 0, canEt: s.canEternity ? 1 : 0,
    eAct: s.eAutoActive ? 1 : 0, eUnl: s.eAutoUnl ? 1 : 0, eBoot: s.eBootstrap ? 1 : 0,
    goal: s.auto && s.auto.goalId, aCount: s.auto && s.auto.actionCount, stalled: s.auto && s.auto.stalledSec,
    gate: s.etGate ? [s.etGate.active ? "act" : "off", s.etGate.stageAllowed ? "sgOK" : "sgNG", s.etGate.wouldSkipCrunch ? "skipCrunch" : "noSkip", s.etGate.holdRu10 ? "holdRU10" : "", s.etGate.ecPend ? "ecPend" : "", "gEP=" + s.etGate.gainedEPLog10, "EP=" + s.etGate.epLog10].filter(Boolean).join("|") : null,
  };
  rlog("[sample]", JSON.stringify(brief));
  return s;
}

function finish(result, reason) {
  summary.result = result;
  summary.result_reason = reason;
  summary.timing.end_iso = summary.timing.end_iso || iso();
  if (summary.timing.end_monotonic_ms === null) summary.timing.end_monotonic_ms = Math.round(performance.now() * 1000) / 1000;
  summary.timing.wall_sec_total = summary.timing.wall_sec_total || wallSec();
  summary.timing.wall_sec_total_process = Math.round((performance.now() - T_START_MONO) / 100) / 10;
  summary.defaults.speed_ramps = summary.defaults.speed_ramps === null && finalState ? finalState.ramps : summary.defaults.speed_ramps;
  summary.anomalies.console_errors = summary.anomalies.console_errors.slice(-40);
  summary.anomalies.console_prefix_counts = Object.fromEntries(Object.entries(consoleCounts).sort((a, b) => b[1] - a[1]).slice(0, 30));
  summary.anomalies.console_suppressed_lines = consoleSuppressed;
  summary.samples.screenshots = shotCount;
  writeSummary();
  rlog("[RESULT]", result, reason);
  flushConsole();
}

async function main() {
  rlog("[start] mode=" + MODE, "out=" + OUT, "maxMin=" + MAX_MIN, "sampleMs=" + SAMPLE_MS, "shotMs=" + SHOT_MS, "confirmMs=" + CONFIRM_MS);
  rlog("[source]", SOURCE_SHA, SOURCE_BRANCH, "dirty=" + (SOURCE_DIRTY === "" ? "(clean)" : JSON.stringify(SOURCE_DIRTY.slice(0, 300))));
  rlog("[source] last commit:", SOURCE_LAST_COMMIT);
  const pw = loadPlaywright();
  rlog("[playwright]", pw.version, "resolved=" + pw.resolved, "base=" + pw.base);

  const srv = await startServer(REPO);
  server = srv.server;
  summary.environment.server = "http://127.0.0.1:" + srv.port + "/ (serve " + REPO + ")";
  rlog("[server]", summary.environment.server);

  const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36";
  const launchArgs = [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
    "--mute-audio",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ];
  summary.environment.launch_args = launchArgs;
  summary.environment.user_agent = UA;
  browser = await pw.chromium.launch({ headless: true, args: launchArgs, timeout: 120000 });
  const bv = browser.version ? browser.version() : null;
  summary.environment.browser_version = bv;
  summary.environment.chromium_executable = (() => { try { return pw.chromium.executablePath(); } catch (e) { return null; } })();
  rlog("[browser]", bv, summary.environment.chromium_executable);

  // 全新 context：隔离 cookie/localStorage/sessionStorage，等价于第一次打开
  context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    userAgent: UA,
  });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("console", m => {
    const t = m.text();
    clog(m.type(), t);
    if (m.type() === "error") summary.anomalies.console_errors.push({ at: iso(), text: t.slice(0, 300) });
  });
  page.on("pageerror", e => {
    const txt = String((e && e.stack) || (e && e.message) || e).slice(0, 800);
    clog("pageerror", txt);
    summary.anomalies.pageerrors.push({ at: iso(), text: txt.slice(0, 400) });
    rlog("[pageerror]", txt.slice(0, 300));
  });
  page.on("requestfailed", req => {
    const t = "requestfailed " + req.url() + " :: " + String((req.failure() && req.failure().errorText) || "");
    clog("requestfailed", t);
  });

  await context.addInitScript(initScript);
  const BASE = "http://127.0.0.1:" + srv.port + "/index.html";

  // 第一次加载 → 页面加载后 clear → reload（再靠 initScript 在文档开头清一次，双保险）
  rlog("[newgame] 首次加载 " + BASE);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(800);
  const cleared = await page.evaluate(() => {
    const before = [];
    try { for (let i = 0; i < localStorage.length; i++) before.push(localStorage.key(i)); } catch (e) { /* ignore */ }
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    return { before, after: (() => { try { return localStorage.length; } catch (e) { return null; } })() };
  });
  rlog("[newgame] 首次加载后 localStorage.clear()", JSON.stringify(cleared));

  const t0Node = Date.now();
  const t0Mono = performance.now();
  T_GAME0 = t0Mono; // 单调墙钟起点 = 新档文档加载前一刻
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 120000 });

  // 保持页面“前台可见”：Playwright CDP session 只用于保活仿真（不碰游戏时间源）
  try {
    cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
    await page.bringToFront();
    rlog("[visibility] focus emulation + lifecycle=active + bringToFront 已下发");
  } catch (e) {
    cdp = null;
    rlog("[visibility] 保活仿真下发失败（继续，采样里记录 visibilityState）:", String((e && e.message) || e));
  }

  // 新档结构性证据
  const freshness = await page.evaluate(() => ({
    t0: window.__orekiT0,
    timeOrigin: window.__orekiTimeOrigin,
    storageAtStart: window.__orekiStorageAtStart,
    playerAt: window.__orekiPlayerAt,
    birth: window.__orekiBirth,
    now: Date.now(),
    vis: document.visibilityState,
  }));
  summary.freshness.storage_keys_at_start = freshness.storageAtStart;
  summary.freshness.birth = freshness.birth;
  const birth = freshness.birth || {};
  const birthAM = Number(birth.totalAntimatter);
  const freshOk = Array.isArray(freshness.storageAtStart) && freshness.storageAtStart.length === 0
    && Number.isFinite(birthAM) && birthAM >= 0 && birthAM <= 10
    && (birth.infinitiesLog10 === null || birth.infinitiesLog10 <= 0)
    && birth.dimensionBoosts === 0 && birth.galaxies === 0
    && birth.realities === 0 && birth.brk === false && birth.endState === 0;
  summary.freshness.verdict = freshOk ? "PASS(全新存档)" : "FAIL(非全新存档)";
  rlog("[newgame] 出生快照", JSON.stringify(freshness));
  rlog("[newgame] 新鲜度判定:", summary.freshness.verdict);

  summary.timing.start_iso = iso(freshness.t0 || t0Node);
  summary.timing.start_monotonic_ms = Math.round((t0Mono - T_START_MONO) * 1000) / 1000;
  summary.timing.t0_source = "document-start Date.now()（页面内 window.__orekiT0），Node 端 reload 前 recorded=" + iso(t0Node);
  summary.timing.t0_in_page = freshness.t0;
  summary.timing.player_created_ms_after_t0 = (freshness.playerAt && freshness.t0) ? (freshness.playerAt - freshness.t0) : null;

  summary.defaults.speed_storage_at_birth = birth.speedStorageAtStart === undefined ? "n/a" : birth.speedStorageAtStart;
  summary.defaults.speed_factor_at_birth = birth.speed;
  summary.defaults.speed_is_dynamic_at_birth = birth.isDynamic;
  summary.defaults.tutorial_active_at_birth = birth.tutorialActive;
  summary.defaults.tutorial_state_at_birth = birth.tutorialState;
  // 出生时速度存储键（document 起点快照）
  const spdAtStart = await page.evaluate(() => {
    const keys = {};
    try { for (const k of ["oreki-game-speed", "oreki-game-speed-dynamic", "oreki.automation.enabled", "oreki.automation.intervalSec"]) keys[k] = localStorage.getItem(k); } catch (e) { /* ignore */ }
    return keys;
  });
  summary.defaults.storage_at_birth = spdAtStart;
  summary.defaults.speed_storage_at_birth = spdAtStart["oreki-game-speed"];
  summary.defaults.speed_dynamic_storage_at_birth = spdAtStart["oreki-game-speed-dynamic"];
  summary.defaults.automation_interval_sec_at_birth = await page.evaluate(() => {
    try { const d = window.OrekiSmartExecutor.debugState(); return d ? d.intervalSec : null; } catch (e) { return null; }
  });
  writeSummary();

  if (!freshOk) {
    rlog("[FATAL] 新鲜度判定失败，拒绝把非全新存档当真实新档出数");
    await shot("00-newgame-failed");
    finish("FAIL", "新档新鲜度校验未通过（出生快照/storageAtStart 不符合全新存档）");
    return;
  }
  await shot("00-start");

  // ── 采样主循环 ─────────────────────────────────────────────────────
  const loopStart = performance.now();
  await takeSample(); // 起跑立即取第一条
  let nextSampleAt = SAMPLE_MS;
  while (!stopped) {
    const elapsed = performance.now() - loopStart;
    if (gameEndAtWallMs === null && elapsed > MAX_WALL_MS) {
      rlog("[stop] 达到上限", MAX_MIN, "分钟仍未 gameEnd");
      break;
    }
    if (gameEndAtWallMs !== null && performance.now() - gameEndAtWallMs >= CONFIRM_MS) {
      rlog("[stop] gameEnd 后确认窗口已满", CONFIRM_MS, "ms");
      break;
    }
    if (elapsed >= nextSampleAt) {
      await takeSample();
      nextSampleAt += SAMPLE_MS;
      if (nextSampleAt < elapsed) nextSampleAt = elapsed + SAMPLE_MS; // 长卡顿后不追帧狂采
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 结束状态
  const finalS = finalState;
  if (MODE === "control") {
    const avgFps = fpsVals.length ? Math.round((fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length) * 10) / 10 : null;
    const visSet = [...new Set(visVals)];
    summary.control = {
      max_min: MAX_MIN,
      sampled_sec: wallSec(),
      samples: sampleCount,
      speed_factor_start: summary.defaults.speed_factor_at_birth,
      speed_factor_end: finalS && finalS.factor,
      speed_is_dynamic: finalS && finalS.isDynamic,
      speed_ramps: finalS && finalS.ramps,
      speed_storage: finalS && finalS.spdStored,
      speed_dynamic_storage: finalS && finalS.spdDynStored,
      tutorial_active: finalS && finalS.tutActive,
      tutorial_state: finalS && finalS.tutState,
      automation: finalS && finalS.auto,
      avg_fps: avgFps,
      min_fps: fpsVals.length ? Math.min(...fpsVals) : null,
      visibility_states: visSet,
      page_has_focus: finalS && finalS.pageHasFocus,
      stage: finalS && finalS.smStage,
      progress: finalS ? {
        realities: finalS.realities, infinities: finalS.infTotalLog10, eternity: finalS.etLog10,
        brk: finalS.brk, endState: finalS.endState, gameEnd: finalS.gameEnd, doomPhase: finalS.doomPhase,
      } : null,
    };
    const cOk = sampleCount >= 10 && sampleErrors.length === 0 && visSet.includes("visible");
    await shot("99-control-end");
    finish(cOk ? "CONTROL-OK" : "CONTROL-FAIL",
      "短对照 " + MAX_MIN + "min：speed=" + summary.control.speed_factor_end +
      " dyn=" + summary.control.speed_is_dynamic + " ramps=" + summary.control.speed_ramps +
      " tut=" + summary.control.tutorial_active + "/" + summary.control.tutorial_state +
      " fps~" + avgFps + " vis=" + visSet.join(",") + " samples=" + sampleCount +
      (gameEndAtWallMs !== null ? " gameEnd=true" : " gameEnd=false"));
    return;
  }
  if (finalS && finalS.gameEnd === true) {
    const pass = summary.confirm.regressions === 0 && summary.gameend.at_wall_sec !== null && summary.gameend.at_wall_sec <= MAX_WALL_MS / 1000;
    await shot("99-final");
    finish(
      pass ? "PASS" : "FAIL",
      pass
        ? "首次 isGameEnd=true 于 " + summary.gameend.at_wall_sec + "s（<= 180min），确认窗口 " + Math.round(CONFIRM_MS / 1000) + "s 内未回退"
        : "gameEnd 已出现但确认窗口内出现回退或墙钟超限（regressions=" + summary.confirm.regressions + "）"
    );
  } else {
    await shot("99-timeout");
    finish("FAIL", "真实墙钟达到上限 " + MAX_MIN + " 分钟仍未出现 player.isGameEnd=true；最后进度 r=" + (finalS && finalS.realities) + " endState=" + (finalS && finalS.endState) + " totAMLog10=" + (finalS && finalS.totAMLog10));
  }
}

let exiting = false;
async function cleanup() {
  if (exiting) return;
  exiting = true;
  try { flushConsole(); } catch (e) { /* ignore */ }
  try { writeSummary(); } catch (e) { /* ignore */ }
  try { if (context) await context.close(); } catch (e) { /* ignore */ }
  try { if (browser) await browser.close(); } catch (e) { /* ignore */ }
  try { if (server) server.close(); } catch (e) { /* ignore */ }
}

process.on("SIGTERM", () => { rlog("[signal] SIGTERM"); finish("FAIL", "被外部 SIGTERM 终止（采样数据保留）"); cleanup().then(() => process.exit(2)); });
process.on("SIGINT", () => { rlog("[signal] SIGINT"); finish("FAIL", "被 Ctrl-C 终止（采样数据保留）"); cleanup().then(() => process.exit(2)); });
process.on("uncaughtException", e => { rlog("[uncaught]", String((e && e.stack) || e)); });
process.on("unhandledRejection", e => { rlog("[unhandledRejection]", String((e && e.stack) || e)); });

try {
  await main();
  await cleanup();
  if (summary.result === "PASS" || summary.result === "CONTROL-OK") process.exit(0);
  if (summary.result === "FAIL" || summary.result === "CONTROL-FAIL") process.exit(2);
  process.exit(0);
} catch (e) {
  rlog("[fatal]", String((e && e.stack) || e));
  summary.anomalies.aborted = String((e && e.message) || e);
  finish("NOT RUN", "跑分器异常中止: " + String((e && e.message) || e));
  await cleanup();
  process.exit(1);
}
