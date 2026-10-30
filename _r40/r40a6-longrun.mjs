// R40-A6 · Web 端「真实新档 180 分钟内通关」复现器
//
// 目标：在 HEAD（5d3c63d 之后）上，从**真实全新存档**出发，跑到 `player.isGameEnd === true`，
// 并把全过程按 1 s 粒度落盘，供事后核对「确实是从零开始 / 确实没伪造 / 确实不回退」。
//
// 与 R40-A5 那次（`r40a5-arm2`，t=783.1 s 翻转）的区别：
//   1) 速度口径固定：`GameSpeed.set(10000)` + `GameSpeed.setDynamic(false)`，
//      两个都是「选项 → 游戏性」里玩家能点的入口，不碰 `tickSpeed` / `gameLoop` 内部状态。
//      固定倍率是为了让「10000×」这句话字面成立（动态升档会自己爬到 100000×）。
//   2) 每帧额外采 `GameSpeed.factor / effectiveFactor / dynamicRampCount`，
//      报告里可以直接证明全程倍率就是 10000×。
//   3) `isGameEnd` 翻转后再跑 120 s 确认不回落，然后提前收尾。
//
// 用法：
//   node _tools/_r40/r40a6-longrun.mjs r40a6-run1            # 上限 1800 s
//   node _tools/_r40/r40a6-longrun.mjs r40a6-run2 1800
//
// 环境变量（都有默认值）：
//   OREKI_HTTP_PORT=8862   OREKI_CDP_PORT=9352   OREKI_SAMPLE_MS=1000
//   OREKI_MAX_SEC=1800     OREKI_CONFIRM_SEC=120
//   OREKI_SPEED_MODE=fixed|default   （default=保留动态升档，仅供对照，不用来判断通关）
//
// 产出：_tools/_r40/<tag>.jsonl 与 <tag>.log
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const TAG = argv[0] || `r40a6-${Date.now()}`;
const MAX_SEC = Number(argv[1] || process.env.OREKI_MAX_SEC || 1800);
const CONFIRM_SEC = Number(process.env.OREKI_CONFIRM_SEC || 120);
const SAMPLE_MS = Number(process.env.OREKI_SAMPLE_MS || 1000);
const SPEED_MODE = (process.env.OREKI_SPEED_MODE || "fixed").toLowerCase();
const SPEED_TARGET = Number(process.env.OREKI_SPEED || 10000);
const BASE_HTTP = Number(process.env.OREKI_HTTP_PORT || 8862);
const BASE_CDP = Number(process.env.OREKI_CDP_PORT || 9352);
const JSONL = path.join(HERE, `${TAG}.jsonl`);
const LOG = path.join(HERE, `${TAG}.log`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".map": "application/json",
};

const logLines = [];
function log(...a) {
  const s = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  logLines.push(s);
  try { fs.writeFileSync(LOG, logLines.join("\n") + "\n"); } catch (e) { /* ignore */ }
}

/** 端口占用时不杀别人的进程，直接换下一个端口（+1），最多试 5 个 */
function listenWithFallback(server, basePort) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attempt = p => {
      const onErr = e => {
        server.removeListener("error", onErr);
        if (e.code === "EADDRINUSE" && tries < 5) {
          tries += 1;
          attempt(p + 1);
        } else reject(e);
      };
      server.once("error", onErr);
      server.listen(p, "127.0.0.1", () => {
        server.removeListener("error", onErr);
        resolve(p);
      });
    };
    attempt(basePort);
  });
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // 同源空白页：用来「先卸载游戏、再清存档」，绕开 unload 时游戏把存档又写回去的竞态
  if (p === "/__blank.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end("<!doctype html><meta charset=utf-8><title>blank</title><body>blank");
    return;
  }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});

let HTTP_PORT = BASE_HTTP;
let CDP_PORT = BASE_CDP;

function killEdge(port) {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${port}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { /* ignore */ }
}

// ───────────────────────── 采样函数（注入到页面里跑） ─────────────────────────
// 只读：除了 gameEnd 的读取外不写任何状态。
const SAMPLE = () => {
  const L = v => {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : (typeof v.log10 === "function" ? v.log10() : Number(v));
      return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
    } catch (e) { return null; }
  };
  const pick = fn => { try { return fn(); } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r40a6T0) / 100) / 10 };
  try {
    const p = player;
    // —— 本轮的七个必需量 ——
    o.gameEnd = p.isGameEnd === true;
    o.endState = pick(() => Number(GameEnd.endState.toFixed(6)));
    o.totAML = L(p.records?.totalAntimatter);          // 全局「总反物质」记录（A5 报的就是这个）
    o.pamL = L(p.celestials?.pelle?.records?.totalAntimatter); // 佩勒内计量（endState 的分母来源）
    o.brk = p.break === true;
    o.doomed = pick(() => Pelle.isDoomed === true) === true;
    o.realities = pick(() => Math.round(p.realities));
    o.crunches = pick(() => Math.round(Currency.infinitiesTotal.value.toNumber()));

    // —— 速度证据 ——
    o.factor = pick(() => GameSpeed.factor);
    o.factorEff = pick(() => GameSpeed.effectiveFactor);
    o.dynOn = pick(() => GameSpeed.isDynamic);
    o.dynRamps = pick(() => GameSpeed.dynamicRampCount);

    // —— 里程碑 ——
    o.dilUnl = pick(() => p.dilation.studies.length > 0);
    o.ds = pick(() => p.dilation.studies.slice().sort((a, b) => a - b).join(","));
    o.ds6 = pick(() => p.dilation.studies.includes(6));
    o.ecDone = pick(() => {
      let n = 0;
      for (let i = 1; i <= 12; i++) if (EternityChallenge(i).completions >= 5) n += 1;
      return n;
    });
    o.Vunl = pick(() => VUnlocks.vAchievementUnlock.isUnlocked === true);
    o.iu15 = pick(() => ImaginaryUpgrade(15).isBought === true);
    o.iu25 = pick(() => ImaginaryUpgrade(25).isBought === true);
    o.laiUnl = pick(() => Laitela.isUnlocked === true);
    o.laiTier = pick(() => Laitela.difficultyTier);
    o.imL = L(pick(() => Currency.imaginaryMachines.value));
    o.imCapL = L(pick(() => MachineHandler.currentIMCap));

    // —— 诊断 ——
    o.amL = L(p.antimatter);
    o.doomPhase = pick(() => OrekiEndgameAutomation?._doomPhase);
    o.eErr = pick(() => String(OrekiEndgameAutomation?._lastError ?? ""));
    o.doomBreakAt = pick(() => OrekiEndgameAutomation?._doomBreakAt);
    o.keepAuto = pick(() => PelleUpgrade.keepAutobuyers.isBought === true);
    o.bcMaxInt = pick(() => Autobuyer.bigCrunch.hasMaxedInterval === true);
    o.strikeInf = pick(() => PelleStrikes.infinity.hasStrike === true);
    o.realSec = pick(() => Math.round(p.records.realTimePlayed / 1000));
  } catch (e) { o.err = String(e && e.message); }
  return o;
};

let cleanup = async () => {};
let exitCode = 0;
const summary = { tag: TAG, ok: false };

try {
  HTTP_PORT = await listenWithFallback(server, BASE_HTTP);
  let launched = null;
  for (let i = 0; i < 4 && !launched; i++) {
    const cdp = CDP_PORT + i;
    killEdge(cdp);
    try {
      launched = await launchBrowser({ port: cdp });
      CDP_PORT = cdp;
    } catch (e) {
      log(`[cdp] ${cdp} 不可用: ${String(e.message).split("\n")[0]}`);
    }
  }
  if (!launched) throw new Error("Edge 起不来（9352~9355 均失败）");
  const browser = launched.browser;
  cleanup = launched.cleanup;
  log(`[serve] ${ROOT} -> http://127.0.0.1:${HTTP_PORT}/ cdp=${CDP_PORT} max=${MAX_SEC}s sample=${SAMPLE_MS}ms tag=${TAG} speed=${SPEED_MODE}/${SPEED_TARGET}`);

  const { page, errors } = await openGame(browser, { port: HTTP_PORT });
  const consoleErrs = [];
  page.on("console", m => {
    if (m.type() === "error") {
      consoleErrs.push(m.text().slice(0, 300));
      if (consoleErrs.length > 200) consoleErrs.shift();
    }
  });

  // ───────── 真实新档 ─────────
  // 【踩坑记录 · R40-A6 两次冒烟，都是假新档】
  //  (1) 直接在游戏页上 `localStorage.clear()` + `page.reload()`：卸载流程里游戏自己又
  //      `save(true)` 了一次，清掉的存档被写回来 → 起点 brk=true、dimensionBoosts=24785。
  //  (2) 改成「先进空白页 → 清 → 再 `goto` 同一 URL」：地址相同，浏览器**从 bfcache 恢复**
  //      了先前那个页面 —— 恢复的是内存里的老实例（游戏根本没重启），
  //      所以起点 brk=true、dimensionBoosts=24805、infinities=9.1e10。
  // 现在的写法同时避开两件事：清存档在**同源空白页**上做（那里没有游戏代码，不会写回），
  // 冷启动用**带随机 query 的新 URL**（bfcache 不可能命中）。
  // 另外在页面里装一个 T0 钩子：`player` 一出现就记时间，避免 Node 端轮询把 t0 拖后几十秒。
  const before = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const hadSave = localStorage.getItem("dimensionSave");
    return { keys, saveLen: hadSave ? hadSave.length : 0 };
  }).catch(() => ({ keys: [], saveLen: -1 }));
  log(`[newgame] 卸载前 localStorage: keys=${JSON.stringify(before.keys)} dimensionSave=${before.saveLen} bytes`);

  await page.goto(`http://127.0.0.1:${HTTP_PORT}/__blank.html`, { waitUntil: "load", timeout: 60000 });
  const emptied = await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    return Object.keys(localStorage).length;
  });
  log(`[newgame] 空白页上 localStorage.clear() 后剩余 key 数 = ${emptied}`);

  await page.evaluateOnNewDocument(() => {
    // 最后一道保险：在**新文档创建的第一时间**再清一次 localStorage。
    // 这个注入点早于 index.html 的任何 module 脚本执行，所以游戏读存档时看到的必然是空。
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    // T0 钩子：`player` 一出现就打点，并把「刚出生那一刻」的状态抄一份存起来。
    // 这份 `__r40a6INIT` 是「确实从零开始」的**结构性**证据 —— 不依赖我采样得多早。
    window.__r40a6T0 = null;
    window.__r40a6INIT = null;
    const iv = setInterval(() => {
      try {
        if (typeof player === "object" && player !== null && player.records) {
          window.__r40a6T0 = Date.now();
          window.__r40a6INIT = {
            at: window.__r40a6T0,
            createdAt: player.records.gameCreatedTime,
            realities: player.realities,
            brk: player.break === true,
            endState: (() => { try { return Number(GameEnd.endState.toFixed(6)); } catch (e) { return null; } })(),
            totalAM: String(player.records.totalAntimatter),
            boosts: player.dimensionBoosts,
            galaxies: player.galaxies,
            infinities: String(player.infinities),
            factor: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
          };
          clearInterval(iv);
        }
      } catch (e) { /* not ready */ }
    }, 10);
  });
  const freshUrl = `http://127.0.0.1:${HTTP_PORT}/index.html?fresh=${Date.now()}`;
  const navAt = Date.now();
  await page.goto(freshUrl, { waitUntil: "load", timeout: 120000 });
  log(`[newgame] 冷启动 ${freshUrl}（goto 耗时 ${Date.now() - navAt} ms）`);

  // 导航会重置 CDP 的可见性仿真，必须补一次，否则 4~8 分钟后整页冻结
  try {
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
    log(`[newgame] focus emulation 已重新下发（累计 ${Date.now() - navAt} ms）`);
  } catch (e) { log(`[newgame] focus emulation 失败（可能中途冻结）: ${e.message}`); }

  const loopAt = Date.now();
  for (let i = 0; i < 200; i++) {
    const probe = await page.evaluate(() => {
      const t = n => { try { return typeof window[n] === "undefined" ? "undefined(win)" : typeof window[n]; } catch (e) { return "throw"; } };
      const b = n => { try { return typeof eval(n) === "undefined" ? "undefined(scope)" : typeof eval(n); } catch (e) { return "throw"; } };
      return { win: { player: t("player"), GameEnd: t("GameEnd"), Currency: t("Currency") }, scope: { player: b("player"), GameEnd: b("GameEnd") } };
    }).catch(e => ({ err: String(e.message) }));
    const ok = probe.win && probe.win.player === "object" && probe.win.GameEnd === "object";
    if (ok) { log(`[timing] 全局就绪循环 ${i + 1} 次退出，耗时 ${Date.now() - loopAt} ms`); break; }
    if (i % 20 === 0) log(`[timing] 第 ${i} 次仍未就绪，已耗 ${Date.now() - loopAt} ms ${JSON.stringify(probe)}`);
    await new Promise(r => setTimeout(r, 150));
  }

  // 起始态取证
  const t0info = await page.evaluate(() => {
    const p = player;
    return {
      init: window.__r40a6INIT || null,
      ageMs: (() => { try { return Date.now() - window.__r40a6T0; } catch (e) { return null; } })(),
      realities: p.realities,
      brk: p.break === true,
      endState: (() => { try { return Number(GameEnd.endState.toFixed(6)); } catch (e) { return null; } })(),
      totalAM: String(p.records.totalAntimatter),
      am: String(p.antimatter),
      dimensionBoosts: p.dimensionBoosts,
      galaxies: p.galaxies,
      infinities: String(p.infinities),
      realSec: (() => { try { return Math.round(p.records.realTimePlayed / 1000); } catch (e) { return null; } })(),
      saveLen: (() => { try { return (localStorage.getItem("dimensionSave") || "").length; } catch (e) { return -1; } })(),
      factor: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
      dyn: (() => { try { return GameSpeed.isDynamic; } catch (e) { return null; } })(),
    };
  }).catch(e => ({ err: String(e && e.message) }));
  log(`[newgame] 出生快照 ${JSON.stringify(t0info.init)}`);
  log(`[newgame] 现在读到的态 ${JSON.stringify({ ...t0info, init: undefined })}`);

  // 硬门槛：用「存档出生时间 + 出生那一刻的状态」判定，而不是拿当前态的量级去猜。
  // 为什么不能猜量级：本 MOD 的自动化极快，开局 5 s 就能刷到 break、8 s 反物质就到 1e9e8，
  // 用「boosts < 100」之类的条件会把真新档误判成脏档（R40-A6 前三次冒烟就是这么误杀的）。
  const init = t0info.init;
  const freshOk = !!init && init.totalAM === "10" && init.boosts === 0 && init.galaxies === 0 &&
    Number(init.infinities) === 0 && init.realities === 0 && init.brk === false && init.endState === 0 &&
    Math.abs(init.createdAt - init.at) < 60000;
  log(`[newgame] 新鲜度校验 ${freshOk ? "PASS" : "FAIL"}` +
    `（出生 totalAM=${init && init.totalAM} boosts=${init && init.boosts} galaxies=${init && init.galaxies}` +
    ` infinities=${init && init.infinities} realities=${init && init.realities} brk=${init && init.brk}` +
    ` 建号到打点 ${init ? init.at - init.createdAt : "?"} ms）`);
  if (!freshOk) throw new Error(`存档不是全新的，拒绝开跑: ${JSON.stringify(t0info)}`);

  // ───────── 速度：走「选项 → 游戏性」的两个公开入口 ─────────
  const speedRes = await page.evaluate((mode, target) => {
    const out = {};
    try {
      out.set = GameSpeed.set(target);
      out.factorAfterSet = GameSpeed.factor;
    } catch (e) { out.setErr = String(e && e.message); }
    if (mode === "fixed") {
      try {
        out.dynBefore = GameSpeed.isDynamic;
        out.dynSet = GameSpeed.setDynamic(false);
        out.dynAfter = GameSpeed.isDynamic;
      } catch (e) { out.dynErr = String(e && e.message); }
    }
    try { out.effective = GameSpeed.effectiveFactor; } catch (e) { out.effErr = String(e && e.message); }
    return out;
  }, SPEED_MODE, SPEED_TARGET).catch(e => ({ err: String(e && e.message) }));
  log(`[speed] mode=${SPEED_MODE} ${JSON.stringify(speedRes)}`);

  // 墙钟起点：优先用页面里那个「player 一出现就打点」的钩子，
  // 这样 t 从**游戏真正开始跑**算起，而不是从 Node 端轮询到为止（那会晚几十秒）。
  const t0Hook = await page.evaluate(() => {
    if (!window.__r40a6T0) window.__r40a6T0 = Date.now();
    return window.__r40a6T0;
  }).catch(() => Date.now());
  const lagMs = Date.now() - t0Hook;
  log(`[t0] 钩子打点比 Node 端早 ${lagMs} ms（越小说明 t 越贴近真实开局）`);
  const t0 = Date.now();
  try { fs.writeFileSync(JSONL, ""); } catch (e) { /* ignore */ }

  const startSnap = await page.evaluate(SAMPLE).catch(() => null);
  log(`[t0] ${JSON.stringify(startSnap)}`);
  try { fs.appendFileSync(JSONL, JSON.stringify(startSnap) + "\n"); } catch (e) { /* ignore */ }

  let lastLog = -1;
  let flipS = null;          // isGameEnd 首次 true 的采样
  let flipAt = null;
  let breakAt = null;        // player.break 首次 true 的采样
  let doomAt = null;         // Pelle.isDoomed 首次 true 的采样
  let samples = 0;
  let afterFlip = 0;
  let afterFlipFalse = 0;
  let deadStreak = 0;
  const milestones = {};
  const mark = (k, v) => { if (milestones[k] === undefined && v !== null && v !== false) milestones[k] = v; };

  while (Date.now() - t0 < MAX_SEC * 1000) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message), t: -1 }));

    if (s && s.err && /detach|closed|Target page|Session closed|crash/i.test(s.err)) {
      deadStreak += 1;
      if (deadStreak === 1) log(`[dead] 采样失败: ${s.err} @t=${s.t}s`);
      if (deadStreak >= 15) { log("[dead] 页面不可用，中止（保留 jsonl）"); break; }
    } else if (s && !s.err) deadStreak = 0;

    if (s && !s.err) {
      samples += 1;
      try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }

      if (s.brk === true && breakAt === null) { breakAt = s; log(`[FIRST] break @t=${s.t}s doomed=${s.doomed} endState=${s.endState}`); }
      if (s.doomed === true && doomAt === null) { doomAt = s; log(`[FIRST] doomed @t=${s.t}s brk=${s.brk} endState=${s.endState}`); }
      if (s.dilUnl) mark("dilUnl", s.t);
      if (s.ds6) mark("ds6", s.t);
      if (s.ecDone >= 12) mark("ecAll", s.t);
      if (s.Vunl) mark("Vunl", s.t);
      if (s.iu15) mark("iu15", s.t);
      if (s.laiUnl) mark("laiUnl", s.t);
      if (s.laiTier >= 8) mark("lai8", s.t);
      if (s.iu25) mark("iu25", s.t);
      if (s.doomed) mark("doomed", s.t);
      if (s.gameEnd) mark("gameEnd", s.t);
      if (s.eErr) mark("eErrFirst", `${s.t}s ${s.eErr}`);

      if (s.gameEnd === true) {
        if (flipS === null) {
          flipS = s; flipAt = s.t;
          log(`[FIRST] gameEnd @t=${s.t}s endState=${s.endState} totAML=${s.totAML} pamL=${s.pamL} brk=${s.brk} doomed=${s.doomed}`);
        }
        afterFlip += 1;
        if (afterFlip * SAMPLE_MS >= CONFIRM_SEC * 1000) {
          log(`[confirm] 翻转后再跑 ${afterFlip} 条采样（≈${(afterFlip * SAMPLE_MS / 1000).toFixed(0)}s），isGameEnd 未回落`);
          break;
        }
      } else if (flipS !== null) {
        afterFlipFalse += 1;
        log(`[REGRESS] isGameEnd 回落到 false @t=${s.t}s（第 ${afterFlipFalse} 次）`);
      }

      const el = Math.floor((Date.now() - t0) / 1000);
      if (el - lastLog >= 10) {
        lastLog = el;
        log(`[${String(el).padStart(4)}s] r=${s.realities} doom=${s.doomed ? 1 : 0} end=${s.endState} ` +
          `totAML=${s.totAML} pamL=${s.pamL} amL=${s.amL} brk=${s.brk ? 1 : 0} f=${s.factor}/${s.factorEff} ` +
          `ec=${s.ecDone} V=${s.Vunl ? 1 : 0} iu15=${s.iu15 ? 1 : 0} lai=${s.laiUnl ? 1 : 0}/${s.laiTier} ` +
          `iu25=${s.iu25 ? 1 : 0} ph=${s.doomPhase} kA=${s.keepAuto ? 1 : 0} bcm=${s.bcMaxInt ? 1 : 0} ` +
          `strike=${s.strikeInf ? 1 : 0} eErr="${s.eErr}"`);
      }
    }
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }

  const wallSec = Math.round((Date.now() - t0) / 100) / 10;
  const fin = await page.evaluate(SAMPLE).catch(() => null);
  const lastErr = await page.evaluate(() => {
    try { return String(OrekiEndgameAutomation?._lastError ?? ""); } catch (e) { return "ERR"; }
  }).catch(() => "ERR");

  Object.assign(summary, {
    wallSec,
    samples,
    flipT: flipAt,
    breakT: breakAt ? breakAt.t : null,
    doomT: doomAt ? doomAt.t : null,
    flipEndState: flipS ? flipS.endState : null,
    flipTotAML: flipS ? flipS.totAML : null,
    flipPamL: flipS ? flipS.pamL : null,
    flipBrk: flipS ? flipS.brk : null,
    flipDoomed: flipS ? flipS.doomed : null,
    factorRange: null,
    afterFlipSamples: afterFlip,
    afterFlipRegressions: afterFlipFalse,
    lastError: lastErr,
    pageErrors: errors ? errors.slice(0, 5) : [],
    consoleErrors: consoleErrs.slice(-10),
    milestones,
    final: fin,
  });

  // 倍率区间：从 jsonl 里回读，保证「10000×」这句话有据可查
  try {
    const raw = fs.readFileSync(JSONL, "utf8").trim().split("\n").filter(Boolean);
    const fs_ = raw.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    const fac = fs_.map(x => x.factor).filter(x => typeof x === "number");
    const facE = fs_.map(x => x.factorEff).filter(x => typeof x === "number");
    summary.factorRange = {
      factorMin: Math.min(...fac), factorMax: Math.max(...fac),
      effMin: Math.min(...facE), effMax: Math.max(...facE),
      n: fs_.length,
    };
    summary.firstFive = fs_.slice(0, 5).map(x => ({
      t: x.t, realities: x.realities, brk: x.brk, endState: x.endState, totAML: x.totAML, factor: x.factor,
    }));
  } catch (e) { summary.readbackErr = String(e && e.message); }

  const ok = summary.flipT !== null && summary.flipEndState >= 1 &&
    summary.afterFlipRegressions === 0 && summary.lastError === "" &&
    (summary.breakT !== null) && summary.breakT <= summary.flipT;
  summary.ok = ok;

  log("[summary] " + JSON.stringify(summary, null, 1));
  if (errors?.length) log("[pageerror] " + JSON.stringify(errors.slice(0, 5), null, 1));
  if (consoleErrs.length) log("[console-err-tail] " + JSON.stringify(consoleErrs.slice(-10), null, 1));
  log(`[out] JSONL=${JSONL} LOG=${LOG}`);
  if (!ok) exitCode = 2;
} catch (e) {
  log(`[fatal] ${e.stack || e.message}`);
  exitCode = 1;
} finally {
  try { await cleanup(); } catch (e) { /* ignore */ }
  try { server.close(); } catch (e) { /* ignore */ }
  killEdge(CDP_PORT);
}
process.exit(exitCode);
