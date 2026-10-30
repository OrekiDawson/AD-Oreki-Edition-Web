// 共享浏览器启动辅助（Edge 156 + puppeteer-core 25 的 pipe 传输不兼容，改走 CDP 端口）
//
// 事实（本轮实测）：
//  · `puppeteer.launch({ executablePath: msedge.exe, headless:"new" })` →
//    "Failed to launch the browser process: Code: 0"（既有的 diag-*.mjs / exp-*.mjs 全部同样失败）
//  · 但 `msedge.exe --headless=new --remote-debugging-port=9333` 手动启动**完全正常**，
//    `/json/version` 能返回完整 CDP 信息 → 说明浏览器本身没问题，是 puppeteer 的 pipe 握手失败。
//  · 因此改为：手动 spawn Edge + `puppeteer.connect({ browserURL })`。
//
// 用法：
//   import { launchBrowser } from "./lib/edge-launch.mjs";
//   const { browser, cleanup } = await launchBrowser({ port: 9333 });
//   ...
//   await cleanup();

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

export function findEdge() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("找不到 Edge 可执行文件");
}

function getJson(port, route, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}${route}`, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => {
          try { resolve(JSON.parse(d)); } catch (e) { setTimeout(attempt, 300); }
        });
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error(`CDP 端口 ${port} 超时`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

let portCursor = 9400 + (process.pid % 300);

/**
 * 启动 Edge 并通过 CDP 连接。
 * @returns {Promise<{browser: import("puppeteer-core").Browser, cleanup: () => Promise<void>}>}
 */
export async function launchBrowser({ port, headless = true, extraArgs = [] } = {}) {
  const puppeteer = (await import("puppeteer-core")).default;
  const exe = findEdge();
  const usePort = port || (portCursor++);
  const profileDir = path.join(os.tmpdir(), `oreki-cdp-${Date.now()}-${usePort}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${usePort}`,
    `--user-data-dir=${profileDir}`,
    "--no-sandbox",
    "--disable-gpu",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
    ...extraArgs,
  ];
  if (headless) args.unshift("--headless=new");

  const child = spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", d => { stderr += d.toString(); });

  let browser;
  try {
    await getJson(usePort, "/json/version");
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${usePort}`,
      defaultViewport: null,
    });
  } catch (e) {
    try { child.kill(); } catch { /* ignore */ }
    throw new Error(`Edge 启动失败: ${e.message}\nstderr: ${stderr.slice(0, 800)}`);
  }

  const cleanup = async () => {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { browser, cleanup, port: usePort };
}

/**
 * 打开游戏页面并等待核心全局对象就绪。
 *
 * 【R34-A 修复 · 冻结根因】`emulateVisible`（默认开启）
 * 背景：R33/R34 观察到「约 4~8 分钟后 player.lastUpdate 永久停止推进」，表现为
 * 无 pageerror、主线程 idle、page.evaluate 仍可用。R34 对冻结中的页面直接取证：
 *   document.visibilityState === "hidden"、document.hidden === true、hasFocus() === false
 *   setTimeout(300ms) / requestAnimationFrame 4 秒内一次都没回调
 *   GameIntervals.gameLoop.restart() 立即返回，之后 tick 增量仍为 0
 * 即：渲染进程把页面判定为后台并**冻结**了整个定时器队列（Page Lifecycle frozen），
 * 不是游戏代码停摆。`--disable-background-timer-throttling` 等启动参数只挡「降频节流」，
 * 挡不住「整页冻结」，所以必须在 CDP 层让页面始终保持可见/聚焦。
 */
export async function openGame(browser, { port, url = "http://127.0.0.1", waitMs = 60000, emulateVisible = true } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.stack || e.message));

  // 幂等地把「保持可见/聚焦」下发到该 target。导航会重置 target 的仿真状态，
  // 因此必须在 goto 之前发一次、load 之后再补一次。
  let cdp = null;
  const applyVisible = async where => {
    if (!emulateVisible || !cdp) return false;
    let ok = true;
    try {
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    } catch (e) { ok = false; }
    // 老版本浏览器不支持 setWebLifecycleState，忽略即可（它不是必需的）
    await cdp.send("Page.setWebLifecycleState", { state: "active" }).catch(() => { /* ignore */ });
    if (ok) console.log(`[edge-launch] focus emulation on (${where})`);
    return ok;
  };
  if (emulateVisible) {
    try {
      cdp = await page.createCDPSession();
      await applyVisible("pre-navigation");
    } catch (e) {
      // 不影响主流程；缺失时页面可能在 4~8 分钟后被冻结
      console.warn("[edge-launch] focus emulation 启用失败:", e.message);
    }
  }

  await page.goto(`${url}:${port}/index.html`, { waitUntil: "load", timeout: waitMs });
  await applyVisible("post-load");
  for (let i = 0; i < 150; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
      catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }
  return { page, errors };
}
