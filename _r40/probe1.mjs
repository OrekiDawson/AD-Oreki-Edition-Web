// R40-A · Web 端「EC 时间研究被反复清零」只读根因探针
//
// 目标：在**真实全新存档**上跑到 EC 阶段，回答一个问题：
//   把 11~200 号普通时间研究清空的，到底是哪条调用点？
//   (a) respecTimeStudies(...)  —— 哪一个 caller（用 Error().stack 取真实调用栈）
//   (b) 现实重置（Currency.timeTheorems.reset() → reality.js）
//
// 手段（全部只读，不改游戏逻辑、不写回源码）：
//   1) 在页面内包一层 `TimeStudyState.prototype.refund`（class 方法，可写）。
//      `respecTimeStudies()` 的唯一动作就是「对每个已买研究调 refund()」
//      （src/core/time-studies/time-studies.js:140-150），所以每次 refund 都等价于
//      「有人正在清空研究树」。包里记录 **refund 那一瞬的调用栈**，
//      于是 caller 是 oreki-eternity-automation:399 / :679 / reality.js:670 / eternity.js:37 一目了然。
//   2) 200 ms 轻采样（unlocked/current/71/171/EC2 五个判定/TT/realities/EC completions），
//      1 s 重采样（额外 TT log10、theorem max/value）。
//   3) 页面内累积，node 侧增量拉取，避免每帧传输大对象。
//
// 用法：
//   OREKI_HTTP_PORT=8871 OREKI_CDP_PORT=9361 node _r40/probe1.mjs [时长秒=660] [tag]
// 产出：_r40/<tag>.jsonl（采样）、_r40/<tag>.refunds.jsonl（清零事件+调用栈）、_r40/<tag>.log
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 660) * 1000;
const TAG = process.argv[3] || `probe1-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8871);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9361);
const LIGHT_MS = Number(process.env.OREKI_LIGHT_MS || 200);
const HEAVY_MS = Number(process.env.OREKI_HEAVY_MS || 1000);

const JSONL = path.join(HERE, `${TAG}.jsonl`);
const REFUNDS = path.join(HERE, `${TAG}.refunds.jsonl`);
const TRANS = path.join(HERE, `${TAG}.transitions.jsonl`);
const LOG = path.join(HERE, `${TAG}.log`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

const logLines = [];
function log(...a) {
  const s = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  logLines.push(s);
  try { fs.writeFileSync(LOG, logLines.join("\n") + "\n"); } catch (e) { /* ignore */ }
}

function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${EDGE_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { /* ignore */ }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/ (cdp ${EDGE_PORT}, ${DURATION / 1000}s)`);

// ---------------------------------------------------------------- 页面内埋点
const INSTALL = () => {
  const R = { refunds: [], t0: Date.now(), installed: null, err: null };
  window.__r40 = R;
  try {
    const s11 = TimeStudy(11);
    const base = Object.getPrototypeOf(Object.getPrototypeOf(s11)); // TimeStudyState.prototype
    const orig = base.refund;
    base.refund = function r40Refund(...args) {
      try {
        const stack = String(new Error().stack || "").split("\n").slice(1, 8)
          .map(s => s.trim()).join(" | ");
        R.refunds.push({
          at: Date.now() - R.t0,
          id: this.id,
          type: this.type,
          unlocked: player.challenge.eternity.unlocked,
          studiesLen: player.timestudy.studies.length,
          realities: player.realities,
          stack,
        });
        if (R.refunds.length > 20000) R.refunds.shift();
      } catch (e) { /* ignore */ }
      return orig.apply(this, args);
    };
    R.installed = base.refund !== orig;
  } catch (e) {
    R.err = String(e && e.message);
  }
  return { installed: R.installed, err: R.err };
};

const LIGHT = () => {
  const R = window.__r40;
  const out = { t: Math.round((Date.now() - window.__r40T0) / 100) / 10 };
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const L = v => { try { return v && v.log10 ? Math.round(v.log10() * 1e3) / 1e3 : null; } catch (e) { return null; } };
  try {
    out.unl = player.challenge.eternity.unlocked;
    out.cur = player.challenge.eternity.current;
    out.respecFlag = player.respec === true;
    out.sN = player.timestudy.studies.length;
    out.s71 = TimeStudy(71).isBought === true;
    out.s171 = TimeStudy(171).isBought === true;
    out.s111 = TimeStudy(111).isBought === true;
    out.s151 = TimeStudy(151).isBought === true;
    out.s181 = TimeStudy(181).isBought === true;
    out.s121 = TimeStudy(121).isBought === true;
    out.s131 = TimeStudy(131).isBought === true;
    out.ec1 = EternityChallenge(1).completions;
    out.ec2 = EternityChallenge(2).completions;
    out.ec3 = EternityChallenge(3).completions;
    out.ec4 = EternityChallenge(4).completions;
    out.ec5 = EternityChallenge(5).completions;
    out.ec6 = EternityChallenge(6).completions;
    out.ec7 = EternityChallenge(7).completions;
    out.ec8 = EternityChallenge(8).completions;
    out.ec9 = EternityChallenge(9).completions;
    out.ec10 = EternityChallenge(10).completions;
    out.ec11 = EternityChallenge(11).completions;
    out.ec12 = EternityChallenge(12).completions;
    const st2 = TimeStudy.eternityChallenge(2);
    out.ec2canBuy = st2.canBeBought === true;
    out.ec2afford = st2.isAffordable === true;
    out.ec2sec = st2.allSecondaryRequirementsMet === true;
    out.ec2entry = st2.isEntryGoalMet === true;
    out.ec2reqCur = S(st2.requirementCurrent);
    out.ttMaxL = L(Currency.timeTheorems.max);
    out.realities = player.realities;
    out.totalTickL = L(player.totalTickGained);
    out.etL = L(Currency.eternities.value);
    out.frame = (() => { try { return globalThis.OrekiEternityAutomation?._frame ?? null; } catch (e) { return null; } })();
    out.refundN = R ? R.refunds.length : -1;
    out.prepHold = (() => { try { return globalThis.OrekiEternityAutomation?._prepHoldUntil ?? null; } catch (e) { return null; } })();
    // R40-A 验收追加：ds6 必须 200ms 分辨率可见（判断现实是否只可能在 ds6=true 之后发生）；
    // 以及 respec 计数 / 维度分叉选择 / dilation 驱动步骤，用于证明 6s 抖动已消失。
    out.ds6 = (() => { try { return TimeStudy.reality.isBought === true; } catch (e) { return null; } })();
    out.hR = (() => { try { return globalThis.OrekiCelestialAutomation?.holdReality === true; } catch (e) { return null; } })();
    out.rsc = (() => { try { return globalThis.OrekiEternityAutomation?._respecCount ?? null; } catch (e) { return null; } })();
    out.path = (() => { try { return globalThis.OrekiEternityAutomation?.dimensionPathId?.() ?? null; } catch (e) { return null; } })();
    out.dstep = (() => { try { return globalThis.OrekiDilationAutomation?._step ?? null; } catch (e) { return null; } })();
    out.s73 = (() => { try { return TimeStudy(73).isBought === true; } catch (e) { return null; } })();
    out.s233 = (() => { try { return TimeStudy(233).isBought === true; } catch (e) { return null; } })();
    // V 解锁 / IU15 —— 用于判断「900 s 内 Vunl=false 是否为回归」
    out.Vunl = (() => { try { return VUnlocks.vAchievementUnlock.isUnlocked === true; } catch (e) { return null; } })();
    out.iu15 = (() => { try { return ImaginaryUpgrade(15).isBought === true; } catch (e) { return null; } })();
    out.glyphN = (() => { try { return Glyphs.activeWithoutCompanion.length; } catch (e) { return null; } })();
    out.slotN = (() => { try { return Glyphs.activeSlotCount; } catch (e) { return null; } })();
  } catch (e) { out.err = String(e && e.message); }
  return out;
};

const HEAVY = () => {
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const o = {};
  try {
    o.gs = (() => { try { return Math.round(getGameSpeedupFactor()); } catch (e) { return null; } })();
    o.real = Math.round((player.records?.totalTimePlayed ?? 0) / 1000);
    o.epL = (() => { try { return Math.round(Currency.eternityPoints.value.log10() * 1e2) / 1e2; } catch (e) { return null; } })();
    o.ipL = (() => { try { return Math.round(Currency.infinityPoints.value.log10() * 1e2) / 1e2; } catch (e) { return null; } })();
    o.ttValL = (() => { try { return Math.round(Currency.timeTheorems.value.log10() * 1e3) / 1e3; } catch (e) { return null; } })();
    o.ttMaxL = (() => { try { return Math.round(Currency.timeTheorems.max.log10() * 1e3) / 1e3; } catch (e) { return null; } })();
    o.ds6 = (() => { try { return TimeStudy.reality.isBought === true; } catch (e) { return null; } })();
    o.iu25 = (() => { try { return ImaginaryUpgrade(25).isBought === true; } catch (e) { return null; } })();
    o.pelleUnl = (() => { try { return Pelle.isUnlocked === true; } catch (e) { return null; } })();
    o.gameEnd = player.isGameEnd === true;
    o.boughtIds = (() => { try { return player.timestudy.studies.join(","); } catch (e) { return null; } })();
    o.respecFlag = player.respec === true;
    o.ecUnl = player.challenge.eternity.unlocked;
    o.ecCur = player.challenge.eternity.current;
    o.ecs = (() => {
      try {
        const a = [];
        for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions);
        return a.join(",");
      } catch (e) { return null; }
    })();
    o.dims = (() => {
      try {
        const a = [];
        for (let t = 1; t <= 8; t++) a.push(TimeDimension(t).bought);
        return a.join(",");
      } catch (e) { return null; }
    })();
    o.dsBought = (() => { try { return [1, 2, 3, 4, 5, 6].map(i => DilationTimeStudyState.studies[i].isBought ? 1 : 0).join(""); } catch (e) { return null; } })();
    o.refundTotal = window.__r40 ? window.__r40.refunds.length : -1;
  } catch (e) { o.err = String(e && e.message); }
  return o;
};

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors } = await openGame(browser, { port: PORT });
  const consoleErrs = [];
  page.on("console", m => {
    const t = m.text();
    if (m.type() === "error" || /OREKI|R40|uncaught|TypeError/i.test(t)) {
      consoleErrs.push(t.slice(0, 300));
      if (consoleErrs.length > 300) consoleErrs.shift();
    }
  });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] localStorage 已清空并重载 → 真实新档");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof TimeStudy === "function" && typeof EternityChallenge === "function"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }

  const inst = await page.evaluate(INSTALL);
  log("[install]", inst);
  await page.evaluate(() => { window.__r40T0 = Date.now(); });

  const t0 = Date.now();
  let lastLog = -1;
  let pulled = 0;
  let lastHeavy = 0;
  let prevStudies = null;
  let clearEpisodes = 0;
  let lastKey = null;

  while (Date.now() - t0 < DURATION) {
    const now = Date.now();
    const s = await page.evaluate(LIGHT).catch(e => ({ err: String(e && e.message) }));

    // 增量拉取 refund 事件（清零 = 有人在 respec）
    const refs = await page.evaluate(n => (window.__r40 ? window.__r40.refunds.slice(n) : []), pulled)
      .catch(() => []);
    if (refs.length) {
      pulled += refs.length;
      for (const r of refs) {
        try { fs.appendFileSync(REFUNDS, JSON.stringify(r) + "\n"); } catch (e) { /* ignore */ }
      }
      // 只在「新一轮清零的第一条」打印，避免刷屏
      if (prevStudies !== null && refs[0] && refs[0].studiesLen > 0) {
        clearEpisodes++;
        log(`[RESPEC#${clearEpisodes}] t=${(refs[0].at / 1000).toFixed(1)}s id=${refs[0].id} ` +
          `unlocked=${refs[0].unlocked} studiesLen=${refs[0].studiesLen} realities=${refs[0].realities}`);
        log(`           stack: ${refs[0].stack}`);
      }
    }
    if (s && !s.err) prevStudies = s.sN;

    // 200 ms 分辨率的状态跃迁记录（只在关键字段变化时写一行，文件很小）
    if (s && !s.err) {
      const key = `${s.unl}/${s.cur}/${s.realities}/${s.ds6}/${s.path}/${s.sN}/${s.rsc}/${s.ecsKey ?? ""}`;
      if (key !== lastKey) {
        lastKey = key;
        try {
          fs.appendFileSync(TRANS, JSON.stringify({
            t: s.t, unl: s.unl, cur: s.cur, realities: s.realities, ds6: s.ds6, path: s.path,
            sN: s.sN, s71: s.s71, s73: s.s73, s171: s.s171, s233: s.s233, rsc: s.rsc,
            holdReality: s.hR, dstep: s.dstep,
            ecs: [s.ec1, s.ec2, s.ec3, s.ec4, s.ec5, s.ec6, s.ec7, s.ec8, s.ec9, s.ec10, s.ec11, s.ec12].join(","),
          }) + "\n");
        } catch (e) { /* ignore */ }
      }
    }

    if (now - lastHeavy >= HEAVY_MS) {
      lastHeavy = now;
      const h = await page.evaluate(HEAVY).catch(() => null);
      if (h) {
        try { fs.appendFileSync(JSONL, JSON.stringify({ ...s, ...h }) + "\n"); } catch (e) { /* ignore */ }
        const el = Math.floor((now - t0) / 1000);
        if (el - lastLog >= 15) {
          lastLog = el;
          log(`[${String(el).padStart(4)}s] real=${h.real}s gs=${h.gs} ttMaxL=${h.ttMaxL} ttValL=${h.ttValL} ` +
            `unl=${s.unl} cur=${s.cur} sN=${s.sN} 71=${s.s71 ? 1 : 0} 171=${s.s171 ? 1 : 0} ` +
            `ec2canBuy=${s.ec2canBuy ? 1 : 0} ecs=${h.ecs} r=${h.realities} refund=${h.refundTotal} ` +
            `respecFlag=${s.respecFlag ? 1 : 0} ds6=${h.ds6 ? 1 : 0}`);
        }
      }
    }
    const wait = LIGHT_MS - (Date.now() - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }

  const fin = await page.evaluate(LIGHT).catch(() => null);
  const finH = await page.evaluate(HEAVY).catch(() => null);
  log("[final-light]", JSON.stringify(fin));
  log("[final-heavy]", JSON.stringify(finH));
  if (errors?.length) log("[pageerror]", JSON.stringify(errors.slice(0, 5)));
  if (consoleErrs.length) log("[console-err-tail]", JSON.stringify(consoleErrs.slice(-12)));
  log(`[out] JSONL=${JSONL}`);
  log(`[out] REFUNDS=${REFUNDS}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
