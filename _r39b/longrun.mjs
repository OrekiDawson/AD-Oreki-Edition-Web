// R38-M · 终局长跑：真实新档一路跑到 isGameEnd 或超时，全程 1 s 采样。
// 相对 R38-A 的 exp.mjs 只加三件事：
//   1) 进入毁灭现实时把存档抓成 cp-doomed.txt（后续验证不必再等 10 分钟）；
//   2) 每帧额外采样 endState / bigCrunch 自动购买器状态 / 关闭计数；
//   3) player.isGameEnd 一旦为 true 立即结束并打印结论。
//
// 用法：
//   node _r38a/exp.mjs record [秒]        真新档跑到「V 解锁 + IM 解锁」，存检查点 cp-late.txt
//   node _r38a/exp.mjs exp [秒] [block]   从 cp-late.txt 载入，等下一次现实后
//                                         hold 现实 + （block=1 时）禁买 ID1，采样 amE 增长曲线
//
// 产出：_r38a/<tag>.jsonl + .log
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const MODE = argv[0] || "record";
const DURATION = (Number(argv[1]) || 600) * 1000;
const BLOCK = argv[2] === "1" || argv[2] === "block";
const FREEZE = process.env.OREKI_FREEZE === "1";
const TAG = argv[3] || `r38m-longrun-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8862);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9352);
const SAMPLE_MS = Number(process.env.OREKI_SAMPLE_MS || 1000);
const CP = path.join(HERE, process.env.OREKI_CP || "cp-late.txt");
const JSONL = path.join(HERE, `${TAG}.jsonl`);
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
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/ (cdp ${EDGE_PORT}, mode=${MODE}, ${DURATION / 1000}s, block=${BLOCK}, freeze=${FREEZE})`);

const SAMPLE = () => {
  const L = v => {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : (v.log10 ? v.log10() : Number(v));
      return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
    } catch (e) { return null; }
  };
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r38aT0) / 100) / 10 };
  try {
    const p = player;
    o.gs = (() => { try { return Math.round(getGameSpeedupFactor()); } catch (e) { return null; } })();
    o.real = Math.round((p.records?.totalTimePlayed ?? 0) / 1000);
    o.realities = Math.round(p.realities);
    o.amE = Number(p.antimatter?.exponent ?? 0);
    o.amL = L(p.antimatter);
    o.rmL = L(Currency.realityMachines.value);
    o.epL = L(Currency.eternityPoints.value);
    o.infPowL = L(Currency.infinityPower.value);
    o.ipL = L(Currency.infinityPoints.value);
    o.id1 = S((() => { try { return InfinityDimension(1).amount; } catch (e) { return null; } })());
    o.id1bought = (() => { try { return InfinityDimension(1).purchases; } catch (e) { return null; } })();
    o.idUnl = (() => { try { return InfinityDimensions.all.filter(d => d.isUnlocked).length; } catch (e) { return null; } })();
    o.maxID1 = S((() => { try { return player.requirementChecks.reality.maxID1; } catch (e) { return null; } })());
    o.imL = L(Currency.imaginaryMachines.value);
    o.imCapL = L(MachineHandler.currentIMCap);
    o.iu15 = (() => { try { return ImaginaryUpgrade(15).isBought === true; } catch (e) { return null; } })();
    o.iu15pos = (() => { try { return ImaginaryUpgrade(15).isAvailableForPurchase === true; } catch (e) { return null; } })();
    o.iu25 = (() => { try { return ImaginaryUpgrade(25).isBought === true; } catch (e) { return null; } })();
    o.iu25pos = (() => { try { return ImaginaryUpgrade(25).isAvailableForPurchase === true; } catch (e) { return null; } })();
    o.ds6 = (() => { try { return TimeStudy.reality.isBought === true; } catch (e) { return null; } })();
    o.glyphN = (() => { try { return Glyphs.activeWithoutCompanion.length; } catch (e) { return null; } })();
    o.epKL = (() => { try { return Math.round(player.records.thisReality.maxEP.log10()); } catch (e) { return null; } })();
    o.machL = L(MachineHandler.uncappedRM ?? null);
    o.etL = L(Currency.eternities.value);
    o.crunchL = L(Currency.infinitiesTotal.value);
    o.laiUnl = (() => { try { return Laitela.isUnlocked === true; } catch (e) { return null; } })();
    o.laiTier = p.celestials?.laitela?.difficultyTier ?? null;
    o.laiEnt = p.celestials?.laitela?.entropy ?? null;
    o.laiRun = (() => { try { return Laitela.isRunning === true; } catch (e) { return null; } })();
    o.laiMaxDim = (() => { try { return Laitela.maxAllowedDimension; } catch (e) { return null; } })();
    o.thisRealMs = (() => { try { return Math.round(p.records.thisReality.realTime); } catch (e) { return null; } })();
    o.laiHold = (() => { try { return globalThis.OrekiEndgameAutomation?.holdForLaitela === true; } catch (e) { return null; } })();
    o.pelleUnl = (() => { try { return Pelle.isUnlocked === true; } catch (e) { return null; } })();
    o.doomed = (() => { try { return Pelle.isDoomed === true; } catch (e) { return null; } })();
    o.pamE = Number(p.celestials?.pelle?.records?.totalAntimatter?.exponent ?? 0);
    o.gameEnd = p.isGameEnd === true;
    o.hold = (() => { try { return globalThis.OrekiCelestialAutomation?.holdReality === true; } catch (e) { return null; } })();
    o.sprint = (() => { try { return globalThis.OrekiEarlyAutomation?.isIu15SprintActive() === true; } catch (e) { return null; } })();
    o.Vunl = (() => { try { return VUnlocks.vAchievementUnlock.isUnlocked === true; } catch (e) { return null; } })();
    o.sp = (() => { try { const d = globalThis.OrekiIu15Sprint?.debugState; return d ? d.phase + '/' + Number(d.peakAmE).toExponential(2) + '/' + d.runSec + 's' : null; } catch (e) { return null; } })();
    o.lock15 = (() => { try { return ImaginaryUpgrade(15).hasPlayerLock === true; } catch (e) { return null; } })();
    o.ad1 = S((() => { try { return AntimatterDimension(1).amount; } catch (e) { return null; } })());
    o.endState = (() => { try { return Number(GameEnd.endState.toFixed(4)); } catch (e) { return null; } })();
    o.bcActive = (() => { try { return Autobuyer.bigCrunch.isActive; } catch (e) { return null; } })();
    o.etActive = (() => { try { return Autobuyer.eternity.isActive; } catch (e) { return null; } })();
    o.resetsOff = (() => { try { return globalThis.OrekiEndgameAutomation?._doomResetsOff; } catch (e) { return null; } })();
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
    if (m.type() === "error" || t.startsWith("[OREKI") || t.startsWith("[R38") || t.startsWith("[V-HOLD]")) {
      consoleErrs.push(t.slice(0, 300));
      if (consoleErrs.length > 200) consoleErrs.shift();
    }
  });

  if (MODE === "record") {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    await page.reload({ waitUntil: "load", timeout: 60000 });
    log("[record] 新档启动");
  } else {
    const cp = fs.readFileSync(CP, "utf8").trim();
    await page.evaluate(s => {
      try {
        localStorage.clear();
        localStorage.setItem("dimensionSave", s);
      } catch (e) { /* ignore */ }
    }, cp);
    await page.reload({ waitUntil: "load", timeout: 60000 });
    log(`[exp] 载入检查点 ${CP} (${cp.length} bytes)`);
  }

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof MachineHandler === "object" && typeof Currency === "object"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => { window.__r38aT0 = Date.now(); });

  // 实验模式：**立刻**封锁（不等现实重置）。
  // 理由：10000× 速度下 1 真实秒 = 1e4 游戏秒，等检测到现实重置再封锁时 ID 早已买满，
  // 那个现实的 maxID1 已经脏了（R38-A 第一轮实测：t=19.8s 打补丁时 maxID1 已是 1e1621357）。
  // 先封锁，再等**下一个**现实重置 —— 新现实从第一帧起就是 ID1=0 的干净态。
  let patchInfo = null;
  if (MODE === "exp") {
    patchInfo = await page.evaluate((b, f) => {
      const out = {};
      if (f) {
        try {
          Object.defineProperty(Player, "canCrunch", { configurable: true, get: () => false });
          Object.defineProperty(Player, "canEternity", { configurable: true, get: () => false });
          out.frozen = true;
        } catch (e) { out.freezeErr = String(e && e.message); }
        try {
          Autobuyer.bigCrunch.isActive = false;
          Autobuyer.eternity.isActive = false;
          out.abResetOff = true;
        } catch (e) { out.patchErr3 = String(e && e.message); }
      }
      if (b) {
        try {
          for (let t = 1; t <= 8; t++) {
            const d = InfinityDimension(t);
            d.buyMax = () => false;
            d.buySingle = () => false;
          }
          out.patchedBuyMax = true;
        } catch (e) { out.patchErr1 = String(e && e.message); }
        try {
          player.auto.infinityDims.isActive = false;
          out.abOff = true;
        } catch (e) { out.patchErr2 = String(e && e.message); }
      }
      return out;
    }, BLOCK, FREEZE).catch(e => ({ err: String(e && e.message) }));
    log(`[exp] 立即封锁: ${JSON.stringify(patchInfo)}`);
  }

  const t0 = Date.now();
  let lastLog = -1;
  let holdApplied = false;
  let baseRealities = null;
  let blockApplied = MODE === "exp";

  let deadStreak = 0;
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message), t: 0 }));

    // [R39] 页面 detached / 目标已关闭时不要在死页面上空转到超时：
    // 连续 15 次拿不到数据就落盘退出，保留 jsonl 供事后分析。
    if (s && s.err && /detach|closed|Target page|Session closed|crash/i.test(s.err)) {
      deadStreak += 1;
      if (deadStreak === 1) log(`[dead] 采样失败: ${s.err} @t=${s.t}s`);
      if (deadStreak >= 15) {
        log("[dead] 页面已不可用，中止长跑（保留 jsonl）");
        break;
      }
    } else if (s && !s.err) {
      deadStreak = 0;
    }

    if (MODE === "record" && s.doomed === true && !globalThis.__r38mDoomSaved) {
      const dsave = await page.evaluate(() => {
        try { GameStorage.save(true, false); return localStorage.getItem("dimensionSave"); }
        catch (e) { return null; }
      }).catch(() => null);
      if (dsave) {
        fs.writeFileSync(path.join(HERE, `cp-doomed-${TAG}.txt`), dsave);
        fs.writeFileSync(path.join(HERE, "cp-doomed.txt"), dsave);
        globalThis.__r38mDoomSaved = true;
        log(`[record] 毁灭态检查点已保存 cp-doomed.txt (${dsave.length} bytes) @t=${s.t}s pamE=${s.pamE}`);
      }
    }
    if (s.gameEnd === true) {
      log(`[record] *** isGameEnd 已置位 *** @t=${s.t}s pamE=${s.pamE} endState=${s.endState}`);
      try { fs.appendFileSync(JSONL, JSON.stringify(s) + String.fromCharCode(10)); } catch (e) { /* ignore */ }
      break;
    }
    if (MODE === "record") {
      // 记录阶段：跑到 V 解锁 + IM 解锁时额外存一份早期检查点
      if (!holdApplied && s.Vunl === true && s.imCapL !== null && s.imCapL > 6) {
        const saved = await page.evaluate(() => {
          try {
            GameStorage.save(true, false);
            return localStorage.getItem("dimensionSave");
          } catch (e) { return null; }
        }).catch(() => null);
        if (saved) {
          fs.writeFileSync(CP, saved);
          log(`[record] 检查点已保存 ${CP} (${saved.length} bytes) @t=${s.t}s realities=${s.realities}`);
          holdApplied = true;
        }
      }
    } else if (MODE === "exp" && !holdApplied) {
      // 等**封锁之后**的第一个现实重置：新现实的 maxID1 一定是 0
      const amE = Number(s.amE) || 0;
      if (baseRealities === null) baseRealities = s.realities;
      const justReset = s.realities > baseRealities && amE < 1e6;
      if (justReset) {
        baseRealities = s.realities;
        const r = await page.evaluate(() => {
          const out = {};
          try {
            Object.defineProperty(globalThis.OrekiCelestialAutomation, "holdReality", {
              configurable: true, get: () => true,
            });
            out.hold = true;
          } catch (e) { out.holdErr = String(e && e.message); }
          try { out.maxID1 = player.requirementChecks.reality.maxID1.toString(); } catch (e) { out.mErr = String(e && e.message); }
          return out;
        }).catch(e => ({ err: String(e && e.message) }));
        log(`[exp] 干净现实重置 → 压住现实: ${JSON.stringify(r)} @t=${s.t}s realities=${s.realities}`);
        holdApplied = true;
        await page.evaluate(() => { window.__r38aT0 = Date.now(); });
      }
    }

    try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }

    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastLog >= 10) {
      lastLog = el;
      log(`[${String(el).padStart(4)}s] r=${s.realities} gs=${s.gs} amE=${Number(s.amE).toExponential(2)} ` +
        `infPowL=${s.infPowL} id1=${s.id1} maxID1=${s.maxID1} iu15=${s.iu15 ? 1 : 0}/${s.iu15pos ? 1 : 0} ` +
        `imL=${s.imL?.toFixed?.(2)}/${s.imCapL?.toFixed?.(2)} lai=${s.laiUnl ? 1 : 0}/${s.laiTier} ` +
        `pelle=${s.pelleUnl ? 1 : 0}/${s.doomed ? 1 : 0} pamE=${Number(s.pamE).toExponential(2)} end=${s.gameEnd ? 1 : 0} ` +
        `hold=${s.hold ? 1 : 0} block=${blockApplied ? 1 : 0} sp=${s.sp} lock15=${s.lock15 ? 1 : 0}`);
    }
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }

  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin, null, 1));
  if (errors?.length) log("[pageerror]", errors.slice(0, 5));
  if (consoleErrs.length) log("[console-err-tail]", consoleErrs.slice(-10));
  log(`[out] JSONL=${JSONL}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
