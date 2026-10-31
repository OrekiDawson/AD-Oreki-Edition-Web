// 浏览器启动兼容层（测试脚手架，非生产代码）
//
// 背景：2026-10-26 起，本机 Edge 156 在「已有后台进程」时会把新启动委派给既有实例，
// launcher 立刻 exit 0，于是 puppeteer.launch 报 `Failed to launch the browser process: Code: 0`，
// 整套 _tools 下的浏览器测试全部无法运行（不是项目代码问题，是启动方式问题）。
//
// 修法：不使用 puppeteer.launch，改为自己 spawn Edge（固定 --remote-debugging-port + 独立 profile），
// 轮询 /json/version 就绪后用 puppeteer.connect 接管。CDP 侧行为与 launch 完全一致，
// 且能精确回收自己那一个进程树。
//
// 用法（无需改各脚本）：
//   NODE_OPTIONS="--import=file:///C:/.../_tools/lib/patch-launch.mjs" node smoke.mjs ...
// 已在 run-all.sh 里统一注入；单独跑脚本时也可以手动加。
//
// 兼容：把接到的一切 launch 参数（headless / args / protocolTimeout / executablePath）都吃下来，
// executablePath 只在「不是 Edge」时才真正使用（例如将来换 Chrome/headless-shell）。

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const DEFAULT_EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const DEBUG = !!process.env.OREKI_BROWSER_DEBUG;

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch (e) {
  throw new Error(`patch-launch: 无法加载 puppeteer-core（${e.message}）`);
}

const origLaunch = puppeteer.launch?.bind(puppeteer);

/**
 * [R42 · INC-2026-1031-04] 共享实例端口。全系统只允许一个 Edge 实例，用这个端口标识它。
 * 旧实现每次调用 `portCursor++` + 独立 profile ⇒ 每次 launch 都是一个全新实例。
 */
const SHARED_PORT = Number(process.env.OREKI_CDP_PORT || 9300);
const MAX_EDGE_TOTAL = Number(process.env.OREKI_MAX_EDGE_TOTAL || 70);

function countEdgeProcesses() {
  try {
    const r = spawnSync("tasklist", ["/FI", "IMAGENAME eq msedge.exe", "/FO", "CSV", "/NH"], {
      encoding: "utf8", timeout: 8000, windowsHide: true,
    });
    if (r.status !== 0 || !r.stdout) return -1;
    return r.stdout.split("\n").filter(l => l.toLowerCase().includes("msedge.exe")).length;
  } catch { return -1; }
}

/** 探测某端口上是否已有可用 CDP 实例（短超时，只用于复用判断）。 */
async function probeAlive(port, timeoutMs = 1200) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    await r.json();
    return true;
  } catch { return false; }
}

async function waitForDevtools(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) { await r.json(); return true; }
    } catch (e) { /* 还没起来 */ }
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

async function launchViaConnect(options = {}) {
  const exe = options.executablePath || DEFAULT_EDGE;
  const isEdge = /msedge\.exe$/i.test(exe);

  // ---- 1) 复用优先：共享端口上已有实例就直接接上去，绝不新建第二个 ----
  if (await probeAlive(SHARED_PORT)) {
    if (DEBUG) console.error(`[patch-launch] 复用已有实例 port=${SHARED_PORT}`);
    const shared = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${SHARED_PORT}`,
      protocolTimeout: options.protocolTimeout || 180000,
      defaultViewport: options.defaultViewport === undefined ? null : options.defaultViewport,
    });
    // 共用实例不是本次创建的：close() 退化为 disconnect()，避免误关别人的浏览器
    shared.close = async () => { try { await shared.disconnect(); } catch (e) { /* ignore */ } };
    return shared;
  }

  // ---- 2) 新建前的硬性上限保护 ----
  const total = countEdgeProcesses();
  if (total >= MAX_EDGE_TOTAL) {
    throw new Error(`patch-launch: 系统里已有 ${total} 个 msedge 进程（上限 ${MAX_EDGE_TOTAL}），拒绝再建实例。AGENTS.md §30`);
  }

  const port = SHARED_PORT;
  const profileDir = path.join(os.tmpdir(), `oreki-cdp-shared-${port}`);
  const baseArgs = [
    "--no-sandbox", "--disable-gpu", "--mute-audio",
    "--no-first-run", "--no-default-browser-check", "--disable-background-mode",
    "--window-size=1200,800",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
  ];
  const passArgs = (options.args || []).filter(a => !/^--remote-debugging-port|^--user-data-dir/.test(a));
  const headlessArg = isEdge ? ["--headless=new"] : ["--headless=new"];
  const args = [...headlessArg, ...baseArgs, ...passArgs, "about:blank"];

  if (DEBUG) console.error(`[patch-launch] spawn ${exe} port=${port}`);
  const child = spawn(exe, args, { stdio: "ignore", windowsHide: true });

  let exited = null;
  child.once("exit", code => { exited = code; });

  const ok = await waitForDevtools(port, 30000);
  if (!ok) {
    try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* ignore */ }
    if (origLaunch) {
      // 兜底：如果 spawn 方式失败，退回原生 launch（例如换到 chrome-headless-shell 时会成功）
      if (DEBUG) console.error("[patch-launch] spawn 方式未就绪，回退原生 launch");
      return origLaunch(options);
    }
    throw new Error(`patch-launch: DevTools 端口 ${port} 在 30s 内未就绪（exit=${exited}）`);
  }

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    protocolTimeout: options.protocolTimeout || 180000,
    defaultViewport: options.defaultViewport === undefined ? null : options.defaultViewport,
  });

  const origClose = browser.close.bind(browser);
  browser.close = async () => {
    try { await origClose(); } catch (e) { /* ignore */ }
    try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* ignore */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  };
  return browser;
}

try {
  puppeteer.launch = launchViaConnect;
  if (DEBUG) console.error("[patch-launch] puppeteer.launch 已替换为 spawn+connect");
} catch (e) {
  // 有些版本 launch 是只读属性 → 退回给各脚本自己 spawn（本文件仍可被显式 import 使用）
  if (DEBUG) console.error(`[patch-launch] 无法改写 launch：${e.message}`);
}

export { launchViaConnect };
