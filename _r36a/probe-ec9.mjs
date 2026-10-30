// R36-A · EC9「无限之力」墙 —— 真实新档连续采样采集脚本。
//
// 目的：把 R35-S3 报告里「无限之力能不能攒到 1e17498 / 1e25498」这个
// 【推导】变成【实测】。
//
// 用法：
//   node _r36a/probe-ec9.mjs [项目目录] [HTTP端口] [秒] [Edge端口]
// 例：
//   node _r36a/probe-ec9.mjs ../AD-Oreki-Edition 8851 330 9341
//
// 关键约束（本轮）：
//   · 浏览器**只能用 headless Edge**，CDP 端口 9341（不许用模拟器，模拟器归 Agent B）。
//   · 真实全新存档：清 localStorage 后 reload，不碰用户正式存档。
//   · 本机内存只有 8GB：开浏览器前先 taskkill msedge.exe，跑完立刻关。
//   · 不得同时开两个浏览器实例。
//
// 产出：
//   · _r36a/_r36a-ec9-<ts>.jsonl —— 原始采样（每行一条 JSON）
//   · _r36a/_r36a-ec9-<ts>.log    —— 人读日志

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 默认项目根 = web/AD-Oreki-Edition（HERE = web/_tools/_r36a）
const DEFAULT_ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
// 参数容错解析：允许省略项目根。
//   node probe-ec9.mjs                        → 默认根 / 8851 / 330s / 9341
//   node probe-ec9.mjs 8851 330 9341          → 省略根，端口/时长/Edge端口按序
//   node probe-ec9.mjs <root> 8851 330 9341   → 显式全参
const argv = process.argv.slice(2);
const nums = [];
let rootArg = null;
for (const a of argv) {
  if (/^\d+$/.test(a)) nums.push(Number(a));
  else if (rootArg === null) rootArg = a;
}
const root = path.resolve(rootArg || DEFAULT_ROOT);
const port = nums.length > 0 ? nums[0] : 8851;
const DURATION = (nums.length > 1 ? nums[1] : 330) * 1000;
const EDGE_PORT = nums.length > 2 ? nums[2] : 9341;
const TAG = process.env.OREKI_TAG || `r36a-ec9-${Date.now()}`;
const JSONL = path.join(HERE, `_${TAG}.jsonl`);
const LOG = path.join(HERE, `_${TAG}.log`);

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`[fatal] 项目根无效（找不到 index.html）：${root}`);
  console.error(`        正确用法：node probe-ec9.mjs "${DEFAULT_ROOT}" 8851 330 9341`);
  process.exit(2);
}

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
  fs.writeFileSync(LOG, logLines.join("\n") + "\n");
}

// ── 清理遗留 Edge（本机内存 8GB，必须先清）──────────────────────────
// 注意：**只杀本脚本自己那个调试端口**上的 Edge。
// 本轮实测发现同机还有别的 Agent 的 Edge 实例在跑（端口 9333），
// `taskkill /IM msedge.exe` 会把人家的采集一起弄挂，属于跨 Agent 破坏。
// 因此这里按 `--remote-debugging-port=<EDGE_PORT>` 精确筛选。
function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${EDGE_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try {
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
    log(`[cleanup] 已清理端口 ${EDGE_PORT} 上的遗留 msedge.exe`);
  } catch (e) {
    log(`[cleanup] 端口 ${EDGE_PORT} 上无遗留 msedge.exe`);
  }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));
log(`[serve] ${root} -> http://127.0.0.1:${port}/`);

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors: errs } = await openGame(browser, { port });
  page.on("console", m => {
    const t = m.text();
    if (t.startsWith("[OREKI_EC_PROBE]")) {
      const raw = t.slice("[OREKI_EC_PROBE]".length).trim();
      // 只收 JSON 行（探针安装提示行以中文开头，必须排除，否则 JSONL 会被污染）
      if (!raw.startsWith("{")) return;
      try { fs.appendFileSync(JSONL, raw + "\n"); } catch (e) { /* ignore */ }
    }
  });

  // ── 真实全新存档 ──────────────────────────────────────────────────
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] localStorage 已清空并重载 = 真实新档");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try {
        return typeof player === "object" && typeof AntimatterDimension === "function"
          && typeof Currency === "function" && typeof EternityChallenge === "function"
          && typeof TimeStudy === "function" && typeof InfinityDimension === "function";
      } catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 安装只读探针（动态 import，不改任何生产启动文件）──────────────
  const installed = await page.evaluate(async () => {
    try {
      const m = await import("/src/core/oreki-ec-probe.js");
      m.installOrekiEcProbe({ intervalMs: 1000 });
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String(e && e.stack || e) };
    }
  });
  if (!installed.ok) {
    log("[probe] 探针安装失败：", installed.err);
  } else {
    log("[probe] 探针已安装（1000 ms 间隔）");
  }

  // ── 连续采样 ─────────────────────────────────────────────────────
  const t0 = Date.now();
  let last = 0;
  log(`[run] 开始连续采样 ${DURATION / 1000} s …`);
  while (Date.now() - t0 < DURATION) {
    await new Promise(r => setTimeout(r, 5000));
    const el = Math.floor((Date.now() - t0) / 1000);
    const st = await page.evaluate(() => {
      const arr = window.__orekiEcProbe || [];
      const s = arr[arr.length - 1];
      if (!s) return null;
      return {
        n: arr.length,
        t: s.t,
        infPowerL: s.infPowerL,
        peakInfPowerL: s.peakInfPowerL,
        ecReqCur9L: s.ecReqCur9L,
        ecReqTot9L: s.ecReqTot9L,
        ec9BitSet: s.ec9BitSet,
        ecDone: s.ecDone,
        ecUnlocked: s.ecUnlocked,
        study151Bought: s.study151Bought,
        study181Bought: s.study181Bought,
        ec9CanBeBought: s.ec9CanBeBought,
        ttL: s.ttL,
        epL: s.epL,
        crunches: s.bigCrunches,
        eternities: s.eternities,
        realities: s.realities,
        dtL: s.dtL,
        maxDTL: s.maxDTL,
        dilStudies: s.dilationStudies,
        bootstrapRun: s.bootstrapRun,
      };
    }).catch(() => null);
    if (st && el - last >= 10) {
      last = el;
      log(`[${String(el).padStart(4)}s] n=${st.n} ipowL=${st.infPowerL?.toFixed(1)} peak=${st.peakInfPowerL?.toFixed(1)}` +
        ` reqCur9=${st.ecReqCur9L?.toFixed(1)} reqTot9=${st.ecReqTot9L?.toFixed(1)} bit9=${st.ec9BitSet ? 1 : 0}` +
        ` ec=[${st.ecDone}] ecUnlock=${st.ecUnlocked} s151=${st.study151Bought ? 1 : 0} s181=${st.study181Bought ? 1 : 0}` +
        ` can9=${st.ec9CanBeBought ? 1 : 0} ttL=${st.ttL?.toFixed(1)}` +
        ` epL=${st.epL?.toFixed(0)} crunch=${st.crunches} et=${st.eternities} r=${st.realities}` +
        ` dtL=${st.dtL?.toFixed(2)} dil=${st.dilStudies} boot=${st.bootstrapRun}`);
    }
  }

  const final = await page.evaluate(() => {
    const arr = window.__orekiEcProbe || [];
    const s = arr[arr.length - 1];
    return {
      samples: arr.length,
      last: s,
      // 峰值统计（跨全部采样）
      maxInfPowerL: arr.reduce((m, x) => (x.infPowerL != null && (m == null || x.infPowerL > m) ? x.infPowerL : m), null),
      maxPeakInfPowerL: arr.reduce((m, x) => (x.peakInfPowerL != null && (m == null || x.peakInfPowerL > m) ? x.peakInfPowerL : m), null),
      maxEcReqCur9L: arr.reduce((m, x) => (x.ecReqCur9L != null && (m == null || x.ecReqCur9L > m) ? x.ecReqCur9L : m), null),
      maxId1L: arr.reduce((m, x) => {
        const v = x.idAmtL && x.idAmtL[0];
        return (v != null && (m == null || v > m)) ? v : m;
      }, null),
      maxEpL: arr.reduce((m, x) => (x.epL != null && (m == null || x.epL > m) ? x.epL : m), null),
      ec9Reached5: arr.some(x => x.ec9Completions >= 5),
      ec12Reached5: arr.some(x => x.ecDone && x.ecDone[11] >= 5),
      dtEverPositive: arr.some(x => x.maxDTL != null && x.maxDTL > 0),
      dilEverUnlocked: arr.some(x => x.dilationUnlocked === true),
      // R36-A 验证用：EC 链推进的三个关键中间态
      maxEcUnlocked: arr.reduce((m, x) => (x.ecUnlocked != null && (m == null || x.ecUnlocked > m) ? x.ecUnlocked : m), null),
      ec9EverDone: arr.some(x => x.ecDone && x.ecDone[8] >= 1),
      ec10EverDone: arr.some(x => x.ecDone && x.ecDone[9] >= 1),
      ec11EverDone: arr.some(x => x.ecDone && x.ecDone[10] >= 1),
      ec12EverDone: arr.some(x => x.ecDone && x.ecDone[11] >= 1),
      study151EverBought: arr.some(x => x.study151Bought === true),
      study181EverBought: arr.some(x => x.study181Bought === true),
      study231EverBought: arr.some(x => x.study231Bought === true),
      study232EverBought: arr.some(x => x.study232Bought === true),
      study233EverBought: arr.some(x => x.study233Bought === true),
      study234EverBought: arr.some(x => x.study234Bought === true),
      ec9EverCanBeBought: arr.some(x => x.ec9CanBeBought === true),
    };
  }).catch(() => null);

  log("[final]", JSON.stringify(final, null, 1));
  if (errs?.length) log("[pageerror]", errs.slice(0, 5));
  log(`[out] JSONL=${JSONL}`);
  log(`[out] LOG=${LOG}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
