// [R42] 路线层存活探针（短跑，只证明「层在活对象里、有输出、没降级」）。
//
// ⚠ 这个脚本**不产出通关秒数**。FACTS C.46：采样强度能改变结论，通关时间一律用
// `_r40/pelle-probe.mjs` 的同款口径（1000 ms / 约 60 字段）。本脚本每 2 s 只读
// `OrekiSmartStrategy` 的几个只读接口，字段数远小于基线口径，用途只有「层是活的」。
//
// 用法：node _tools/_r40/r42-route-peek.mjs [秒=120] [tag]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 120) * 1000;
const TAG = process.argv[3] || `r42-route-peek-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8887);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9377);
const JSONL = path.join(HERE, `${TAG}.jsonl`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

function log(...a) { console.log(a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")); }

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
log(`[serve] ${PORT} cdp=${EDGE_PORT} ${DURATION / 1000}s tag=${TAG}`);

const SAMPLE = () => {
  const T = fn => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } };
  const S = v => { try { return v === null || v === undefined ? null : String(v); } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r42T0) / 100) / 10 };
  const M = globalThis.OrekiSmartStrategy;
  o.smOk = T(() => M.evaluate()?.ok ?? null);
  o.smStage = T(() => M.evaluate()?.stage?.id ?? null);
  o.smDeg = T(() => M.evaluate()?.degraded ?? null);
  o.smErr = T(() => M.debugState()?.lastError ?? null);
  // ── R42 路线层
  const route = T(() => M.evaluate()?.route ?? null);
  o.rStage = T(() => route?.stageId ?? null);
  o.rCurrent = T(() => route?.chosen ?? null);
  o.rSwitched = T(() => route?.switchKind ?? null);
  o.rReason = S(T(() => route?.switchReason ?? null));
  o.rEta = T(() => route?.etaRealSec ?? null);
  o.rConf = T(() => route?.confidence ?? null);
  o.rEtaReason = S(T(() => route?.etaReason ?? null));
  o.rGoalRes = T(() => route?.goalRes ?? null);
  o.rCands = S(T(() => (route?.candidates || []).map(c => `${c.id}:${c.prereqOk ? "ok" : "x"}:${c.etaRealSec === null ? "-" : c.etaRealSec}:${c.risk}`).join(" ")));
  o.rPriority = S(T(() => (route?.priority || []).join(",")));
  o.rSpecPriority = S(T(() => (route?.specPriority || []).join(",")));
  o.rSwitches = T(() => M.debugState()?.routeSwitches ?? null);
  o.rLastSwitch = S(T(() => {
    const l = M.debugState()?.routeLastSwitch;
    return l ? `${l.from}->${l.to}:${l.reason}` : null;
  }));
  o.rSampleCounts = S(T(() => JSON.stringify(M.debugState()?.rateSampleCounts ?? {})));
  o.rSymbols = S(T(() => JSON.stringify(M.debugState()?.routeSymbols ?? {})));
  // 只读接口（route-model.interface 的 8 项）
  o.iId = T(() => M.getCurrentRouteId());
  o.iEta = T(() => M.getEstimatedRemainingSeconds());
  o.iStep = S(T(() => M.getCurrentStep()));
  o.iAlts = S(T(() => (M.getAlternativeRoutes() || []).join(" | ")));
  // 执行层：证明购买权边界没被路线层动过
  o.exReg = S(T(() => (globalThis.OrekiSmartExecutor?.debugState()?.registered || []).join("|")));
  o.exActN = T(() => globalThis.OrekiSmartExecutor?.debugState()?.actionCount ?? null);
  o.exTryN = T(() => globalThis.OrekiSmartExecutor?.debugState()?.attemptCount ?? null);
  o.exConflict = T(() => globalThis.OrekiSmartExecutor?.debugState()?.takeoverWhileModuleActed ?? null);
  o.exDeg = T(() => globalThis.OrekiSmartExecutor?.debugState()?.degraded ?? null);
  return o;
};

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors } = await openGame(browser, { port: PORT });
  const consoleErrs = [];
  page.on("console", m => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 240)); });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] 真实新档");
  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof globalThis.OrekiSmartStrategy === "object"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => { window.__r42T0 = Date.now(); });

  const t0 = Date.now();
  let seen = new Set();
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message) }));
    if (s && !s.err) {
      try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }
      const key = `${s.smStage}/${s.rCurrent}`;
      if (!seen.has(key)) {
        seen.add(key);
        log(`[${String(s.t).padStart(5)}s] stage=${s.smStage} route=${s.rCurrent || "-"} kind=${s.rSwitched}` +
          ` eta=${s.rEta === null ? "null" : `${s.rEta}s(${s.rConf}/${s.rEtaReason})`}` +
          ` prio=${s.rPriority} samples=${s.rSampleCounts}`);
        log(`         cands=${s.rCands}`);
        if (s.rPriority !== s.rSpecPriority) log(`         !! 已重排：spec=${s.rSpecPriority}`);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin, null, 1));
  log("[switches]", JSON.stringify([...seen]));
  if (errors?.length) log("[pageerror]", JSON.stringify(errors.slice(0, 5)));
  if (consoleErrs.length) log("[console-err-tail]", JSON.stringify(consoleErrs.slice(-8)));
} catch (e) {
  log("[fatal]", String((e && e.stack) || e));
} finally {
  try { await cleanup(); } catch (e) { /* ignore */ }
  try { server.close(); } catch (e) { /* ignore */ }
  killEdge();
  log("[done]");
  process.exit(0);
}
