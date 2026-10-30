// R40-M · EC 死锁取证：真实新档 + 研究清零来源判定
//
// 目的：回答「谁把 11~200 号时间研究清空了」——
//   (a) respecTimeStudies（unlocked 从 N 变 0，realities 不变）
//   (b) 现实重置（realities +1）
// 采样里同时记录 EC1~EC4 的 completions / canBeBought / unlocked / current / 研究位图。
//
// 用法：node diag.mjs [秒]
// 环境：OREKI_HTTP_PORT / OREKI_CDP_PORT / OREKI_SAMPLE_MS / OREKI_TAG
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 900) * 1000;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8872);
const CDP = Number(process.env.OREKI_CDP_PORT || 9362);
const SAMPLE_MS = Number(process.env.OREKI_SAMPLE_MS || 500);
const TAG = process.env.OREKI_TAG || `r40m-diag-${Date.now()}`;
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
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${CDP}*' } | `
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
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/ (cdp ${CDP}, ${DURATION / 1000}s)`);

const SAMPLE = () => {
  const L = v => {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : (v.log10 ? v.log10() : Number(v));
      return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
    } catch (e) { return null; }
  };
  const o = { t: Math.round((Date.now() - window.__r40T0) / 100) / 10 };
  try {
    const p = player;
    o.realities = Math.round(p.realities);
    o.ecUnl = p.challenge.eternity.unlocked;
    o.ecCur = p.challenge.eternity.current;
    o.ecBits = p.challenge.eternity.requirementBits;
    o.ecDone = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => {
      try { return EternityChallenge(i).completions; } catch (e) { return -1; }
    });
    o.tsN = (() => { try { return player.timestudy.studies.length; } catch (e) { return -1; } })();
    o.ts = (() => {
      try {
        const ids = [71, 72, 73, 81, 111, 121, 131, 141, 151, 171, 181, 191, 193, 214, 233];
        return ids.filter(i => { try { return TimeStudy(i).isBought; } catch (e) { return false; } }).join(",");
      } catch (e) { return "ERR"; }
    })();
    o.ttL = L(Currency.timeTheorems.value);
    o.ttMaxL = L(Currency.timeTheorems.max);
    o.epL = L(Currency.eternityPoints.value);
    o.etL = L(Currency.eternities.value);
    o.tickGained = (() => { try { return player.totalTickGained; } catch (e) { return null; } })();
    o.ec2 = (() => {
      try {
        const s = TimeStudy.eternityChallenge(2);
        return [s.isAffordable ? 1 : 0, s.canBeBought ? 1 : 0, s.allSecondaryRequirementsMet ? 1 : 0,
          s.isEntryGoalMet ? 1 : 0].join("");
      } catch (e) { return "ERR"; }
    })();
    o.ec3 = (() => {
      try {
        const s = TimeStudy.eternityChallenge(3);
        return [s.isAffordable ? 1 : 0, s.canBeBought ? 1 : 0, s.allSecondaryRequirementsMet ? 1 : 0].join("");
      } catch (e) { return "ERR"; }
    })();
    o.fr = (() => { try { return globalThis.OrekiEternityAutomation?._frame ?? null; } catch (e) { return null; } })();
    o.nextEc = (() => { try { return globalThis.OrekiEternityAutomation?.nextUnfinishedEcId?.() ?? null; } catch (e) { return null; } })();
    o.hold = (() => { try { return globalThis.OrekiCelestialAutomation?.holdReality === true; } catch (e) { return null; } })();
    o.holdReset = (() => { try { return globalThis.OrekiEternityAutomation?.shouldHoldReset?.() === true; } catch (e) { return null; } })();
    o.tsTrue = (() => { try { return TimeStudy.reality.isBought === true; } catch (e) { return null; } })();
    o.amE = Number(p.antimatter?.exponent ?? 0);
    o.gs = (() => { try { return Math.round(getGameSpeedupFactor()); } catch (e) { return null; } })();
    o.ds6 = (() => { try { return TimeStudy.reality.isBought === true; } catch (e) { return null; } })();
    o.iu25 = (() => { try { return ImaginaryUpgrade(25).isBought === true; } catch (e) { return null; } })();
    o.gameEnd = p.isGameEnd === true;
    o.endState = (() => { try { return Number(GameEnd.endState.toFixed(4)); } catch (e) { return null; } })();
    o.laiTier = (() => { try { return player.celestials.laitela.difficultyTier; } catch (e) { return null; } })();
    o.laiRun = (() => { try { return Laitela.isRunning === true; } catch (e) { return null; } })();
    o.laiUnl = (() => { try { return Laitela.isUnlocked === true; } catch (e) { return null; } })();
    o.ent = (() => { try { return +Number(player.celestials.laitela.entropy).toFixed(3); } catch (e) { return null; } })();
    o.imL = (() => { try { return Math.round(Math.log10(Number(Currency.imaginaryMachines.value)) * 100) / 100; } catch (e) { return null; } })();
    o.iu15 = (() => { try { return ImaginaryUpgrade(15).isBought === true; } catch (e) { return null; } })();
    o.iu25 = (() => { try { return ImaginaryUpgrade(25).isBought === true; } catch (e) { return null; } })();
    o.iu25av = (() => { try { return ImaginaryUpgrade(25).isAvailableForPurchase === true; } catch (e) { return null; } })();
    o.Vunl = (() => { try { return VUnlocks.vAchievementUnlock.isUnlocked === true; } catch (e) { return null; } })();
    o.laiHold = (() => { try { return globalThis.OrekiEndgameAutomation?._laiHold === true; } catch (e) { return null; } })();
    o.pelleUnl = (() => { try { return Pelle.isUnlocked === true; } catch (e) { return null; } })();
    o.doomed = (() => { try { return Pelle.isDoomed === true; } catch (e) { return null; } })();
    o.pamE = (() => { try { return Number(player.celestials?.pelle?.records?.totalAntimatter?.exponent ?? 0); } catch (e) { return null; } })();
    o.maxID1z = (() => { try { return player.requirementChecks.reality.maxID1.eq(0); } catch (e) { return null; } })();
  } catch (e) { o.err = String(e && e.message); }
  return o;
};

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: CDP });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors } = await openGame(browser, { port: PORT });
  const consoleErrs = [];
  page.on("console", m => {
    const t = m.text();
    if (m.type() === "error" || t.startsWith("[OREKI") || t.startsWith("[R40")) {
      consoleErrs.push(t.slice(0, 300));
      if (consoleErrs.length > 300) consoleErrs.shift();
    }
  });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[record] 全新存档启动");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof Currency === "object"; } catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => { window.__r40T0 = Date.now(); });

  const t0 = Date.now();
  let lastLog = -1;
  let prev = null;
  let deadStreak = 0;
  const events = [];

  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message), t: 0 }));

    if (s && s.err && /detach|closed|Target page|Session closed|crash/i.test(s.err)) {
      deadStreak += 1;
      if (deadStreak >= 15) { log("[dead] 页面不可用，中止（保留 jsonl）"); break; }
    } else if (s && !s.err) deadStreak = 0;

    // ── 清零来源判定：研究数从 N>=3 掉到 0，且 realities 没变 → respec
    if (prev && !s.err && !prev.err) {
      const wipe = prev.tsN >= 3 && s.tsN === 0;
      if (wipe) {
        const realityDelta = s.realities - prev.realities;
        const ev = {
          t: s.t, kind: realityDelta > 0 ? "REALITY_RESET" : "RESPEC",
          realities: s.realities, realityDelta,
          ecUnlBefore: prev.ecUnl, ecUnlAfter: s.ecUnl,
          ecDoneBefore: prev.ecDone.join("/"), ecDoneAfter: s.ecDone.join("/"),
          tsBefore: prev.ts, ttBefore: prev.ttMaxL, fr: s.fr,
        };
        events.push(ev);
        log(`[WIPE] ${JSON.stringify(ev)}`);
      }
      if (prev.ecUnl !== s.ecUnl) {
        log(`[ECUNL] ${prev.ecUnl} -> ${s.ecUnl} @t=${s.t}s ecDone=${s.ecDone.join("/")} ts=${s.ts}`);
      }
      if (prev.ds6 === false && s.ds6 === true) log(`[DS6] bought @t=${s.t}s`);
      if (prev.gameEnd === false && s.gameEnd === true) log(`[GAMEEND] @t=${s.t}s`);
    }

    try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }

    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastLog >= 5) {
      lastLog = el;
      log(`[${String(el).padStart(4)}s] r=${s.realities} unl=${s.ecUnl} cur=${s.ecCur} ecDone=${(s.ecDone || []).join("/")} ` +
        `tsN=${s.tsN} ts=${s.ts} tt=${s.ttMaxL} ec2=${s.ec2} next=${s.nextEc} hr=${s.holdReset ? 1 : 0} ` +
        `lai=${s.laiUnl ? 1 : 0}/${s.laiTier}/${s.laiRun ? 1 : 0} ent=${s.ent} imL=${s.imL} ` +
        `iu15=${s.iu15 ? 1 : 0} iu25=${s.iu25 ? 1 : 0}/${s.iu25av ? 1 : 0} V=${s.Vunl ? 1 : 0} ` +
        `lh=${s.laiHold ? 1 : 0} pelle=${s.pelleUnl ? 1 : 0}/${s.doomed ? 1 : 0} pamE=${Number(s.pamE || 0).toExponential(1)}`);
    }

    prev = s;
    if (s.gameEnd === true) { log("[record] isGameEnd 已置位，结束"); break; }
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }

  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin));
  log("[events]", JSON.stringify(events));
  if (errors?.length) log("[pageerror]", errors.slice(0, 5));
  if (consoleErrs.length) log("[console-err-tail]", consoleErrs.slice(-10));
  log(`[out] JSONL=${JSONL} LOG=${LOG}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
