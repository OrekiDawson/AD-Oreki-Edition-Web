// R37-A · 终局链路真新档采样器（只读；不改生产代码）
//
// 用法： node _r37a/probe.mjs [秒] [标签]
//   · 项目根固定 web/AD-Oreki-Edition
//   · HTTP 8861，CDP 9351（R37-A 独占）
//   · 真实新档：新 profile + localStorage.clear() + reload
// 产出： _r37a/<标签>.jsonl（2 s 一条）与 <标签>.log（10 s 一条人读汇总）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const DURATION = (Number(argv[0]) || 600) * 1000;
const TAG = argv[1] || `r37a-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8861);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9351);
const SAMPLE_MS = Number(process.env.OREKI_SAMPLE_MS || 2000);
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
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/  (cdp ${EDGE_PORT}, ${DURATION / 1000}s)`);

const SAMPLE = () => {
  const L = v => {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : (v.log10 ? v.log10() : Number(v));
      return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
    } catch (e) { return null; }
  };
  const raw = v => { try { return v?.toString?.() ?? String(v); } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r37aT0) / 100) / 10 };
  try {
    const p = player;
    o.real = Math.round((p.records?.totalTimePlayed ?? 0) / 1000);
    o.speed = window.GameSpeed?.factor ?? null;
    o.realities = Math.round(p.realities);
    o.etL = L(Currency.eternities.value);
    o.infTotL = L(Currency.infinitiesTotal.value);
    o.rmL = L(Currency.realityMachines.value);
    o.epL = L(Currency.eternityPoints.value);
    o.ttL = L(Currency.timeTheorems.value);
    o.amE = Number(p.antimatter?.exponent ?? 0);
    o.ipL = L(Currency.infinityPoints.value);
    o.repL = L(Replicanti.amount);

    // 膨胀
    o.dilUnl = PlayerProgress.dilationUnlocked();
    o.dilAct = p.dilation.active === true;
    o.tpL = L(Currency.tachyonParticles.value);
    o.maxDTL = L(p.records.thisReality.maxDT);
    o.dtL = L(Currency.dilatedTime.value);
    o.dtRateL = L(getDilationGainPerSecond ? getDilationGainPerSecond() : null);
    o.dtReb = p.dilation.rebuyables?.[1] ?? null;
    // [R38-A 修正] 原探针把 `p.dilation.upgrades.size` 当成「DT 升级数量」，
    // 但 dtGain（id=1）是 **rebuyable**，真实购买次数在 `player.dilation.rebuyables[1]`；
    // `upgrades` 是 Set，只装一次性升级的 id。两者不是同一个东西：
    //   · dtUpgN   = 一次性升级个数（Set.size，原版语义）
    //   · dtGainN  = dtGain 这个可重复升级的购买层数（rebuyables[1]）
    // 另外区分三种「看起来像归零」的情况：
    //   · dilUnl=None  → `PlayerProgress.dilationUnlocked()` 读失败或未解锁（探针缺字段/真未解锁）
    //   · loopStalled  → `player.lastUpdate` 在两次采样间没有推进（游戏主循环停摆）
    //   · 真实清零     → 上面两者都正常，但 dilatedTime / rebuyables 确实是 0（现实重置）
    o.dtUpgN = p.dilation.upgrades instanceof Set ? p.dilation.upgrades.size
      : (Array.isArray(p.dilation.upgrades) ? p.dilation.upgrades.length : null);
    o.dtGainN = p.dilation.rebuyables?.[1] ?? null;
    o.dtReb3 = p.dilation.rebuyables?.[3] ?? null;
    o.loopMs = (() => {
      try {
        const last = Number(p.lastUpdate) || 0;
        const prev = window.__r38aLastUpdate || 0;
        window.__r38aLastUpdate = last;
        return prev ? Math.round(last - prev) : null;
      } catch (e) { return null; }
    })();
    o.loopStalled = o.loopMs !== null && o.loopMs <= 0;
    o.dilUnlSrc = (() => {
      try {
        const v = PlayerProgress.dilationUnlocked();
        if (v === undefined) return "missing-field";
        return v ? "unlocked" : "locked";
      } catch (e) { return `error:${String(e && e.message).slice(0, 40)}`; }
    })();

    // [R37-A] IU15 冲刺 / ID1 观测
    o.id1 = (() => { try { return Number(InfinityDimension(1).amount); } catch (e) { return null; } })();
    o.maxID1 = (() => { try { return player.requirementChecks.reality.maxID1.toString(); } catch (e) { return null; } })();
    o.sprint = (() => { try { return OrekiEarlyAutomation.isIu15SprintActive() === true; } catch (e) { return null; } })();
    o.dtUpgBought = (() => { try { return OrekiCelestialAutomation._dtUpgBought; } catch (e) { return null; } })();
    o.egStep = (() => { try { return globalThis.OrekiEndgameAutomation?.step; } catch (e) { return null; } })();
    o.hold = (() => { try { return globalThis.OrekiCelestialAutomation?.holdReality === true; } catch (e) { return null; } })();
    o.holdV = (() => { try { return globalThis.OrekiCelestialAutomation?.holdRealityForV === true; } catch (e) { return null; } })();
    o.deep = (() => { try { const d = globalThis.OrekiDilationAutomation?.debugState; return d ? `${d.phase}/${d.step}/${d.holdForMs}` : null; } catch (e) { return null; } })();
    o.ecU = (() => { try { return player.challenge.eternity.unlocked; } catch (e) { return null; } })();

    // 挑战 / V
    o.ec = Object.keys(p.eternityChalls || {}).length;
    o.ecDone = (() => {
      try { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => EternityChallenge(i).completions); }
      catch (e) { return null; }
    })();
    o.Vunl = VUnlocks?.vAchievementUnlock?.isUnlocked ?? null;
    o.Vrun = V?.isRunning ?? null;
    o.st = V?.spaceTheorems ?? null;
    o.Vprog = (() => {
      try {
        const m = GameDatabase.celestials.v.mainUnlock;
        return Object.keys(m).map(k => {
          const pu = m[k].progress();
          return `${k}:${pu >= 1 ? "OK" : pu.toExponential(1)}@${L(m[k].resource())}`;
        }).join(" ");
      } catch (e) { return null; }
    })();

    // Ra
    o.RaUnl = Ra?.isUnlocked ?? null;
    o.RaRun = Ra?.isRunning ?? null;
    o.petLv = Ra?.totalPetLevel ?? null;

    // 虚幻机器
    o.imL = L(Currency.imaginaryMachines.value);
    o.imCapL = L(MachineHandler.currentIMCap);
    o.iu = (() => {
      try { return [6, 13, 14, 15, 20, 25].map(i => `${i}:${ImaginaryUpgrade(i).isBought ? 1 : 0}`).join(","); }
      catch (e) { return null; }
    })();

    // 莱特拉 / 佩勒
    o.laiUnl = Laitela?.isUnlocked ?? null;
    o.laiRun = Laitela?.isRunning ?? null;
    o.laiTier = p.celestials?.laitela?.difficultyTier ?? null;
    o.laiEnt = p.celestials?.laitela?.entropy ?? null;
    o.dmL = L(Currency.darkMatter.value);
    o.pelleUnl = Pelle?.isUnlocked ?? null;
    o.doomed = Pelle?.isDoomed ?? null;
    o.pamE = Number(p.celestials?.pelle?.records?.totalAntimatter?.exponent ?? 0);
    o.endState = (() => { try { return Math.round(GameEnd.endState * 1000) / 1000; } catch (e) { return null; } })();
    o.gameEnd = p.isGameEnd === true;
    o.remnants = L(p.celestials?.pelle?.remnants);
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
    if (m.type() === "error" || t.startsWith("[V-HOLD]") || t.startsWith("[OREKI")) {
      consoleErrs.push(t.slice(0, 300));
      if (consoleErrs.length > 200) consoleErrs.shift();
    }
  });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] localStorage 清空 + reload");

  for (let i = 0; i < 150; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof VUnlocks === "object" && typeof MachineHandler === "object"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }
  await page.evaluate(() => { window.__r37aT0 = Date.now(); });

  const t0 = Date.now();
  let lastLog = -1;
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message) }));
    try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastLog >= 10) {
      lastLog = el;
      log(`[${String(el).padStart(4)}s] r=${s.realities} rmL=${s.rmL?.toFixed(0)} epL=${s.epL?.toFixed(0)} amE=${s.amE?.toExponential(2)} ` +
        `dil=${s.dilUnl ? 1 : 0}/${s.dilAct ? 1 : 0} tpL=${s.tpL ?? "-"} maxDTL=${s.maxDTL ?? "-"} rate=${s.dtRateL ?? "-"} reb=${s.dtReb}`);
      log(`        V=${s.Vunl ? 1 : 0} st=${s.st} run=${s.Vrun} Ra=${s.RaUnl ? 1 : 0}/${s.RaRun ? 1 : 0} pet=${s.petLv} ` +
        `imL=${s.imL?.toFixed(2)}/cap=${s.imCapL?.toFixed(2)} iu=[${s.iu}] lai=${s.laiUnl ? 1 : 0}/${s.laiRun ? 1 : 0} tier=${s.laiTier} ` +
        `pelle=${s.pelleUnl ? 1 : 0} doomed=${s.doomed ? 1 : 0} pamE=${s.pamE?.toExponential(2)} end=${s.endState} gameEnd=${s.gameEnd}`);
      log(`        id1=${s.id1} maxID1=${s.maxID1} sprint=${s.sprint} dtUpg=${s.dtUpgBought} eg=${s.egStep} hold=${s.hold}/${s.holdV} ecU=${s.ecU} deep=${s.deep}`);
      if (s.ecDone) log(`        ec=[${s.ecDone}] Vprog: ${s.Vprog}`);
      if (s.err) log(`        [sample err] ${s.err}`);
    }
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }

  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin, null, 1));
  if (errors?.length) log("[pageerror]", errors.slice(0, 5));
  if (consoleErrs.length) log("[console-err-tail]", consoleErrs.slice(-12));
  log(`[out] JSONL=${JSONL}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
