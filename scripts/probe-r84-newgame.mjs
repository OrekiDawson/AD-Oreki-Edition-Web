#!/usr/bin/env node
/**
 * R84 全新存档真实墙钟通关探针（桌面 Edge headless，非 Android 视口验收）。
 *
 * ## 这个脚本回答什么问题
 *
 * 只有一个：**清空 localStorage 后，从零到 `player.isGameEnd === true` 用了多少真实墙钟秒。**
 * 它不做 UI 截图、不做视口验收、不改任何游戏代码 —— 纯观测。
 *
 * ## 为什么自己实现 CDP 而不装依赖
 *
 * Node 22 自带 `WebSocket`，够用。仓库无 package.json，不能引 puppeteer。
 *
 * ## 口径（与 FACTS C.35 对齐，别写错）
 *
 * · 时间是 `Date.now()` 真实墙钟差，**不是**游戏内时间，也不经过任何倍率换算。
 * · 只记录「开跑为默认速度」，不宣称全程 10000×（动态升档默认开启）。
 * · `localStorage.clear()` 在首次导航到页面之后、reload 之前执行 —— 必须在同源下才有效。
 *
 * ## 用法
 *
 *   node serve.mjs 8123                 # 另开一个终端
 *   node scripts/probe-r84-newgame.mjs --port 8123 --max 1800
 *
 * 产物：`reports/_r84/newgame.jsonl`（逐秒采样）+ 终端摘要。
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "reports", "_r84");

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt;
};

const PORT = Number(argOf("--port", "8123"));
const MAX_SEC = Number(argOf("--max", "1800"));
const SAMPLE_MS = Number(argOf("--sample", "1000"));
const URL_BASE = `http://127.0.0.1:${PORT}/`;

// 无头 Edge：用一个临时 profile，避免污染用户真实浏览器数据。
const EDGE = process.env.EDGE
  || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const DEBUG_PORT = 9223;
const PROFILE = path.join(os.tmpdir(), `oreki-r84-edge-${process.pid}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  /** 求值并把异常原样抛出来（不吞），方便定位探针自身错误。 */
  async eval(expr, timeoutMs = 30000) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    }, timeoutMs);
    if (r.exceptionDetails) {
      throw new Error(`eval failed: ${r.exceptionDetails.text} ${JSON.stringify(r.exceptionDetails.exception?.description || "")}`);
    }
    return r.result?.value;
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 15000);
  });
  return new Cdp(ws);
}

/** 轮询 /json/list 拿到页面 target 的 webSocketDebuggerUrl。 */
async function findPageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error("找不到 Edge 的页面调试目标");
}

const SAMPLE_EXPR = `(() => {
  const g = globalThis;
  const num = (v) => {
    try {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
      if (typeof v.eq === "function" || typeof v.log10 === "function") return Number(v.toString());
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  };
  const expOf = (v) => {
    try {
      if (v == null) return null;
      if (typeof v.exponent === "number") return v.exponent;
      if (v.mantissa != null && v.exponent != null) return Number(v.exponent);
      return null;
    } catch { return null; }
  };
  const p = g.player || {};
  const out = {
    t: Math.round((Date.now() - g.__r84T0) / 100) / 100,
    gameEnd: p.isGameEnd === true,
    endState: num(g.GameEnd && g.GameEnd.endState),
    amE: expOf(p.antimatter),
    totAM: num(p.records && p.records.totalAntimatter),
    realities: num(p.realities),
    eternities: num(p.eternities),
    infinities: num(p.infinities),
    bcUnl: p.break === true,
    doom: g.Pelle ? g.Pelle.isDoomed === true : null,
    lai: g.Laitela ? g.Laitela.isRunning === true : null,
    iu15: (() => { try { return g.ImaginaryUpgrade ? g.ImaginaryUpgrade(15).isBought === true : null; } catch { return null; } })(),
    iu25: (() => { try { return g.ImaginaryUpgrade ? g.ImaginaryUpgrade(25).isBought === true : null; } catch { return null; } })(),
    stage: (() => { try { return g.OrekiSmartStrategy && g.OrekiSmartStrategy.debugState ? g.OrekiSmartStrategy.debugState.stage : null; } catch { return null; } })(),
    smDeg: (() => { try { return g.OrekiSmartStrategy && g.OrekiSmartStrategy.debugState ? g.OrekiSmartStrategy.debugState.degraded : null; } catch { return null; } })(),
    smErr: (() => { try { return g.OrekiSmartStrategy && g.OrekiSmartStrategy.debugState ? g.OrekiSmartStrategy.debugState.lastError : null; } catch { return null; } })(),
    speed: (() => { try { return g.GameSpeed ? g.GameSpeed.current : null; } catch { return null; } })(),
    spdDyn: (() => { try { return g.OrekiGameSpeed ? g.OrekiGameSpeed.dynamicEnabled : null; } catch { return null; } })(),
  };
  try {
    const d = g.OrekiEndgameAutomation && g.OrekiEndgameAutomation.debugState;
    if (d) { out.doomPhase = d.doomPhase ?? null; out.doomShards = d.doomShards ?? null; }
  } catch { /* ignore */ }
  return out;
})()`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonlPath = path.join(OUT_DIR, "newgame.jsonl");
  const fh = fs.openSync(jsonlPath, "w");

  const edge = spawn(EDGE, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--window-size=1280,800",
    "about:blank",
  ], { stdio: "ignore" });

  let cdp = null;
  const startedAt = Date.now();
  try {
    const wsUrl = await findPageTarget();
    cdp = await connect(wsUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // ---- 1. 先导航到同源页面，才能 clear localStorage ----
    await cdp.send("Page.navigate", { url: URL_BASE });
    await sleep(1500);
    await cdp.eval("localStorage.clear(); sessionStorage.clear(); 'cleared'");

    // ---- 2. 带清空后的存储重载，并打上起点时间戳 ----
    await cdp.send("Page.reload", { ignoreCache: true });
    // 等游戏对象就绪（最多 30 s）
    let ready = false;
    for (let i = 0; i < 120; i++) {
      const ok = await cdp.eval("typeof player !== 'undefined' && typeof GameEnd !== 'undefined'").catch(() => false);
      if (ok) { ready = true; break; }
      await sleep(250);
    }
    if (!ready) throw new Error("游戏对象未就绪（30 s 超时）");

    await cdp.eval("globalThis.__r84T0 = Date.now(); 'ok'");
    console.log(`[R84] 起跑：全新存档，最大观测 ${MAX_SEC}s，采样 ${SAMPLE_MS}ms`);

    // ---- 3. 逐秒采样 ----
    let firstEnd = null;
    let last = null;
    for (let i = 0; i < Math.ceil((MAX_SEC * 1000) / SAMPLE_MS); i++) {
      await sleep(SAMPLE_MS);
      let s;
      try {
        s = await cdp.eval(SAMPLE_EXPR);
      } catch (e) {
        s = { t: Math.round((Date.now() - startedAt) / 100) / 100, error: String(e.message || e) };
      }
      last = s;
      fs.writeSync(fh, JSON.stringify(s) + "\n");
      if (s && s.gameEnd === true && firstEnd == null) {
        firstEnd = s;
        console.log(`[R84] 首次 gameEnd=true：t=${s.t}s endState=${s.endState} totAML=${s.totAM}`);
        break;
      }
      if (i % 30 === 0) {
        console.log(`  t=${s.t}s stage=${s.stage} amE=${s.amE} real=${s.realities} doom=${s.doom} end=${s.endState}`);
      }
    }

    const summary = {
      startedAt: new Date(startedAt).toISOString(),
      wallSec: firstEnd ? firstEnd.t : (last ? last.t : null),
      reachedEnd: Boolean(firstEnd),
      firstEnd,
      last,
      maxSec: MAX_SEC,
    };
    fs.writeFileSync(path.join(OUT_DIR, "newgame-summary.json"),
      JSON.stringify(summary, null, 2) + "\n", "utf-8");
    console.log("[R84] 摘要：" + JSON.stringify({
      reachedEnd: summary.reachedEnd, wallSec: summary.wallSec,
      stage: last?.stage, amE: last?.amE, endState: last?.endState,
    }));
  } finally {
    fs.closeSync(fh);
    try { if (cdp) cdp.ws.close(); } catch { /* ignore */ }
    try { edge.kill(); } catch { /* ignore */ }
    // 清理临时 profile（失败无所谓）
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch((e) => {
  console.error("[R84] 探针失败：" + (e && e.stack || e));
  process.exit(1);
});
