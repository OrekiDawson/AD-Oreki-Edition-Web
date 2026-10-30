// R40-A2 · 时间墙诊断探针（只读）
//
// 目的：给 T1（V / IU15 到达时间）与 T2（莱特拉 tier 0→8）提供 500 ms 实测时序。
//   T1：PlayerProgress.dilationUnlocked() 首次为真、DS1~DS6 各自首次买上、
//       records.thisReality.maxDT 首次达 V 门槛、OrekiDilationAutomation.debugState 的
//       cooldownMs / earlyHoldUsedMs / releases / lastRelease / holdForMs 时序。
//   T2：Laitela.difficultyTier 每一级的首次时刻、当级 holdReality 占空比、
//       以及「现实发生了但 tier 没加」的空转周期。
//
// 只读：不写任何 player 字段，不调任何 purchase/start。
//
// 用法（端口只能 8871/9361）：
//   OREKI_HTTP_PORT=8871 OREKI_CDP_PORT=9361 node _r40/probe2.mjs [秒=1200] [tag] [sampleMs=500]
// 产出：_r40/<tag>.jsonl / .log
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 1200) * 1000;
const TAG = process.argv[3] || `probe2-${Date.now()}`;
const SAMPLE_MS = Number(process.argv[4]) || 500;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8871);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9361);

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
log(`[serve] ${PORT} cdp=${EDGE_PORT} ${DURATION / 1000}s sample=${SAMPLE_MS}ms tag=${TAG}`);

const SAMPLE = () => {
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const L = v => { try { return v && v.log10 ? Math.round(v.log10() * 1e3) / 1e3 : null; } catch (e) { return null; } };
  const T = fn => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r40T0) / 100) / 10 };
  try {
    o.realities = player.realities;
    o.amE = Number(player.antimatter.exponent ?? 0);
    o.gs = T(() => Math.round(getGameSpeedupFactor()));
    o.thisRealSec = T(() => Math.round(Time.thisRealityRealTime.totalSeconds));
    // ── T1
    o.dilUnl = T(() => PlayerProgress.dilationUnlocked() === true);
    o.ds1 = T(() => DilationTimeStudyState.studies[1].isBought === true);
    o.ds2 = T(() => DilationTimeStudyState.studies[2].isBought === true);
    o.ds3 = T(() => DilationTimeStudyState.studies[3].isBought === true);
    o.ds4 = T(() => DilationTimeStudyState.studies[4].isBought === true);
    o.ds5 = T(() => DilationTimeStudyState.studies[5].isBought === true);
    o.ds6 = T(() => DilationTimeStudyState.studies[6].isBought === true);
    o.maxDTL = T(() => Math.round(player.records.thisReality.maxDT.pLog10() * 1e2) / 1e2);
    o.ttMaxL = T(() => Math.round(Currency.timeTheorems.max.log10() * 1e2) / 1e2);
    o.epL = T(() => Math.round(Currency.eternityPoints.value.log10() * 1e2) / 1e2);
    o.ecs = T(() => { const a = []; for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions); return a.join(","); });
    // 膨胀自动化的真实等待量
    const d = globalThis.OrekiDilationAutomation;
    o.dPhase = T(() => d._phase);
    o.dStep = T(() => d._step);
    o.dHold = T(() => d.hold === true);
    o.dHoldMs = T(() => (d._holdSinceMs ? Date.now() - d._holdSinceMs : 0));
    o.dCoolMs = T(() => Math.max(0, Math.round(d._cooldownUntilMs - Date.now())));
    o.dEarlyUsedMs = T(() => Math.round(d._earlyHoldUsedMs));
    o.dReleases = T(() => d._releases);
    o.dLastRelease = T(() => d._lastRelease);
    o.dActions = T(() => d._actions);
    o.dTargetEc = T(() => d._targetEc());
    o.dErr = T(() => d._lastError);
    o.holdReality = T(() => globalThis.OrekiCelestialAutomation?.holdReality === true);
    o.celPhase = T(() => globalThis.OrekiCelestialAutomation?._phase);
    o.ecHold = T(() => globalThis.OrekiEternityAutomation?.shouldHoldReset() === true);
    // ── T2
    o.Vunl = T(() => VUnlocks.vAchievementUnlock.isUnlocked === true);
    o.iu15 = T(() => ImaginaryUpgrade(15).isBought === true);
    o.iu25 = T(() => ImaginaryUpgrade(25).isBought === true);
    o.iu25pos = T(() => ImaginaryUpgrade(25).isAvailableForPurchase === true);
    o.imL = T(() => Math.round(Currency.imaginaryMachines.value.log10() * 1e2) / 1e2);
    o.imCapL = T(() => Math.round(MachineHandler.currentIMCap.log10() * 1e2) / 1e2);
    o.laiUnl = T(() => Laitela.isUnlocked === true);
    o.laiTier = T(() => Laitela.difficultyTier);
    o.laiRun = T(() => Laitela.isRunning === true);
    o.laiEnt = T(() => player.celestials.laitela.entropy);
    o.laiGain = T(() => Math.round(Laitela.entropyGainPerSecond * 1e5) / 1e5);
    o.laiMaxDim = T(() => Laitela.maxAllowedDimension);
    o.laiFastest = T(() => player.celestials.laitela.fastestCompletion);
    o.pelleUnl = T(() => Pelle.isUnlocked === true);
    o.doomed = T(() => Pelle.isDoomed === true);
    o.gameEnd = player.isGameEnd === true;
    o.endState = T(() => Number(GameEnd.endState.toFixed(4)));
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
    if (m.type() === "error" || /OREKI|R40|TypeError/i.test(t)) {
      consoleErrs.push(t.slice(0, 260));
      if (consoleErrs.length > 200) consoleErrs.shift();
    }
  });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] 真实新档");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof Laitela === "object" && typeof MachineHandler === "object"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => { window.__r40T0 = Date.now(); });

  const t0 = Date.now();
  let lastLog = -1;
  const firsts = {};
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message) }));
    if (s && !s.err) {
      try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }
      // 首次达成打点
      const mark = (k, v, extra = "") => {
        if (v && !firsts[k]) { firsts[k] = s.t; log(`[FIRST] ${k} t=${s.t}s r=${s.realities} amE=${s.amE} ${extra}`); }
      };
      mark("dilUnl", s.dilUnl === true);
      for (const k of ["ds1", "ds2", "ds3", "ds4", "ds5", "ds6"]) mark(k, s[k] === true, `ttMaxL=${s.ttMaxL}`);
      mark("maxDT>=1e30", s.maxDTL !== null && s.maxDTL >= 30, `maxDTL=${s.maxDTL}`);
      mark("Vunl", s.Vunl === true, `realities=${s.realities}`);
      mark("iu15", s.iu15 === true, `realities=${s.realities}`);
      mark("iu25", s.iu25 === true, `realities=${s.realities}`);
      mark("laiUnl", s.laiUnl === true);
      mark("gameEnd", s.gameEnd === true);
      if (s.laiTier !== null && firsts[`laiT${s.laiTier}`] === undefined) {
        firsts[`laiT${s.laiTier}`] = s.t;
        log(`[TIER] ${s.laiTier} @t=${s.t}s r=${s.realities} amE=${s.amE} ent=${s.laiEnt} gain=${s.laiGain} thisRealSec=${s.thisRealSec} dHold=${s.dHold ? 1 : 0} holdR=${s.holdReality ? 1 : 0}`);
      }
      const el = Math.floor((Date.now() - t0) / 1000);
      if (el - lastLog >= 20) {
        lastLog = el;
        log(`[${String(el).padStart(4)}s] r=${s.realities} amE=${s.amE} dil=${s.dilUnl ? 1 : 0} dsB=` +
          `${[s.ds1, s.ds2, s.ds3, s.ds4, s.ds5, s.ds6].map(x => (x ? 1 : 0)).join("")} maxDTL=${s.maxDTL} ` +
          `V=${s.Vunl ? 1 : 0} iu15=${s.iu15 ? 1 : 0} iu25=${s.iu25 ? 1 : 0} tier=${s.laiTier} ` +
          `dPhase=${s.dPhase} holdR=${s.holdReality ? 1 : 0} cool=${s.dCoolMs} early=${s.dEarlyUsedMs} ` +
          `rel=${s.dReleases}/${s.dLastRelease} holdMs=${s.dHoldMs} ecs=${s.ecs}`);
      }
    }
    const wait = SAMPLE_MS - ((Date.now() - t0) % SAMPLE_MS);
    await new Promise(r => setTimeout(r, Math.max(0, Math.min(wait, SAMPLE_MS))));
  }

  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin));
  log("[firsts]", JSON.stringify(firsts));
  if (errors?.length) log("[pageerror]", JSON.stringify(errors.slice(0, 5)));
  if (consoleErrs.length) log("[console-err-tail]", JSON.stringify(consoleErrs.slice(-8)));
  log(`[out] ${JSONL}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
