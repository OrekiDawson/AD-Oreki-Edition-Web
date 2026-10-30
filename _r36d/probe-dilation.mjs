// R36-D · 膨胀时间（dilatedTime）链路 —— 真实新档连续采样采集脚本。
//
// 目的：把「dilatedTime 恒 0」的四环逐环取证：
//   ① DS1 买上了吗？（TT / EC11+EC12 / 231~234）
//   ② studies 多久被清空一次？（实测秒数）
//   ③ startDilatedEternity 被调用过吗？
//   ④ tickDilation 的门禁计数（gates）为什么不动？
//   ⑤ maxDT 的真实增速，离 1e30 还差几个数量级？
//
// 用法：
//   node _r36d/probe-dilation.mjs [项目目录] [HTTP端口] [秒] [Edge端口]
// 例：
//   node _r36d/probe-dilation.mjs ../AD-Oreki-Edition 8856 330 9346
//
// 关键约束（本轮）：
//   · 浏览器**只能用 headless Edge**，CDP 端口 9346（Agent A 用 9341，不冲突）。
//   · 真实全新存档：清 localStorage 后 reload，不碰用户正式存档。
//   · **不执行全局 taskkill msedge.exe** —— 只按 --remote-debugging-port 精确筛自己的进程。
//   · 不得开模拟器（归 Agent B）。
//
// 产出：
//   · _r36d/_r36d-dil-<ts>.jsonl —— 原始采样（每行一条 JSON）
//   · _r36d/_r36d-dil-<ts>.log    —— 人读日志

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 默认项目根 = web/AD-Oreki-Edition（HERE = web/_tools/_r36d）
const DEFAULT_ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const nums = [];
let rootArg = null;
for (const a of argv) {
  if (/^\d+$/.test(a)) nums.push(Number(a));
  else if (rootArg === null) rootArg = a;
}
const root = path.resolve(rootArg || DEFAULT_ROOT);
const port = nums.length > 0 ? nums[0] : 8856;
const DURATION = (nums.length > 1 ? nums[1] : 330) * 1000;
const EDGE_PORT = nums.length > 2 ? nums[2] : 9346;
const TAG = process.env.OREKI_TAG || `r36d-dil-${Date.now()}`;
const JSONL = path.join(HERE, `_${TAG}.jsonl`);
const LOG = path.join(HERE, `_${TAG}.log`);

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`[fatal] 项目根无效（找不到 index.html）：${root}`);
  console.error(`        正确用法：node probe-dilation.mjs "${DEFAULT_ROOT}" 8856 330 9346`);
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

// ── 清理遗留 Edge（**只杀本脚本自己那个调试端口**上的）────────────────
// ⚠️ 绝不能 `taskkill /IM msedge.exe` —— 那会杀掉其它 Agent 的浏览器实例。
function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${EDGE_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try {
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
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
    if (t.startsWith("[OREKI_DIL_PROBE]")) {
      const raw = t.slice("[OREKI_DIL_PROBE]".length).trim();
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
          && typeof TimeStudy === "function" && typeof DilationTimeStudyState === "object"
          && typeof VUnlocks === "object";
      } catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 安装只读探针（动态 import，不改任何生产启动文件）──────────────
  const installed = await page.evaluate(async () => {
    try {
      const m = await import("/src/core/oreki-dilation-probe.js");
      m.installOrekiDilatedProbe({ intervalMs: 1000 });
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String((e && e.stack) || e) };
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
      const arr = window.__orekiDilatedProbe || [];
      const s = arr[arr.length - 1];
      if (!s) return null;
      const v = s.v || {};
      const vfmt = Object.keys(v).map(k => `${k}=${v[k]?.p == null ? "?" : v[k].p.toFixed(3)}`).join(" ");
      return {
        n: arr.length, t: s.t,
        dilUnl: s.dilUnlocked, dilActive: s.dilActive,
        dilStudies: s.dilStudiesLen, ds1: s.ds1?.isBought, ds1Can: s.ds1?.canBeBought,
        tsBought: s.ds1?.tsBought, ecFull: s.ds1?.ecFull, ttMaxL: s.ds1?.ttMaxL,
        maxDTL: s.maxDTL, dtL: s.dtL, dtRateL: s.dtRateL, tpL: s.tpL,
        realities: s.realities, sinceRealitySec: s.sinceRealitySec,
        ecDone: s.ecDone,
        gates: s.gates, dilStarts: s.dilStarts, dilTpSeeds: s.dilTpSeeds,
        holdV: s.holdV, holdDeep: s.holdDeep, vEligible: s.vEligible,
        deep: s.deepState,
        vUnlocked: s.vUnlocked, vCan: s.vCanUnlock, vfmt,
        maxEtAmL: s.maxEtAmL, epL: s.epL, infTotalL: s.infTotalL, rmL: s.rmL,
        canEternity: s.canEternity, speed: s.speed,
      };
    }).catch(() => null);
    if (st && el - last >= 10) {
      last = el;
      log(`[${String(el).padStart(4)}s] n=${st.n} r=${st.realities} (since=${st.sinceRealitySec}s) ` +
        `dilUnl=${st.dilUnl} dilAct=${st.dilActive} studies=${st.dilStudies} ds1=${st.ds1}/${st.ds1Can} ` +
        `ts=[${st.tsBought}] ecFull=${JSON.stringify(st.ecFull)} ttMaxL=${st.ttMaxL?.toFixed(1)}`);
      log(`        maxDTL=${st.maxDTL?.toFixed(2)} dtL=${st.dtL?.toFixed(2)} rateL=${st.dtRateL?.toFixed(2)} tpL=${st.tpL?.toFixed(2)} ` +
        `ec=[${st.ecDone}] starts=${st.dilStarts} seeds=${st.dilTpSeeds} holdV=${st.holdV} holdD=${st.holdDeep} vElig=${st.vEligible}`);
      log(`        gates=${JSON.stringify(st.gates)} vUnl=${st.vUnlocked} vCan=${st.vCan} ${st.vfmt}`);
      if (st.deep) log(`        deep=${JSON.stringify(st.deep)}`);
    }
  }

  const final = await page.evaluate(() => {
    const arr = window.__orekiDilatedProbe || [];
    const s = arr[arr.length - 1];
    const maxL = arr.reduce((m, x) => (x.maxDTL != null && (m == null || x.maxDTL > m) ? x.maxDTL : m), null);
    return {
      samples: arr.length,
      last: s,
      maxMaxDTL: maxL,
      dilEverUnlocked: arr.some(x => x.dilUnlocked === true),
      maxDTeverPositive: arr.some(x => x.maxDTL != null && x.maxDTL > 0),
      dilStartsMax: arr.reduce((m, x) => (x.dilStarts != null && (m == null || x.dilStarts > m) ? x.dilStarts : m), null),
      gatesLast: arr.length ? arr[arr.length - 1].gates : null,
      // DS1 在位的时间段（秒）
      ds1Windows: (() => {
        const out = [];
        let start = null;
        for (const x of arr) {
          if (x.dilUnlocked === true && start === null) start = x.t;
          if (x.dilUnlocked !== true && start !== null) { out.push([start, x.t, Math.round(x.t - start)]); start = null; }
        }
        if (start !== null) out.push([start, arr[arr.length - 1].t, Math.round(arr[arr.length - 1].t - start)]);
        return out;
      })(),
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
