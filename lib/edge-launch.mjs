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

import { spawn, execSync } from "node:child_process";
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

/**
 * 共享 CDP 端口：全系统只允许存在**一个** Edge 实例，就用这个端口标识它。
 *
 * [R42 · INC-2026-1031-04] 之前每个脚本自带端口常量（9355 / 9333 / portCursor++），
 * 于是「端口不同 ⇒ 探测不到 ⇒ 各自 spawn 一个新实例」。实例身份必须与调用方解耦，
 * 统一钉在这个端口上，才能保证「有实例就复用、绝不新建第二个」。
 */
export const SHARED_CDP_PORT = Number(process.env.OREKI_CDP_PORT || 9300);

/**
 * 共享实例里允许多少个页面（Tab）。上限按「脚本种类数」而不是「运行次数」兜底：
 * 同一个脚本反复跑必须命中 reuse 分支，不能靠这个上限来擦屁股。
 */
const MAX_SHARED_PAGES = Number(process.env.OREKI_MAX_PAGES || 6);


/**
 * 统计当前 msedge 进程总数（含渲染/utility 子进程）。
 * 用 tasklist 而不是 PowerShell：`execSync` 走 cmd.exe，PowerShell 的嵌套引号在
 * cmd 下转义极易失效，静默返回空串就会让上限保护形同虚设。
 * 经验量级：1 个浏览器实例 ≈ 15~40 个 msedge 进程。
 */
function countEdgeProcesses() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq msedge.exe" /FO CSV /NH', {
      encoding: "utf8", timeout: 8000, windowsHide: true,
    });
    return out.split("\n").filter(l => l.toLowerCase().includes("msedge.exe")).length;
  } catch {
    return -1; // 查询失败不做拦截，避免环境问题误伤
  }
}

const MAX_EDGE_TOTAL = Number(process.env.OREKI_MAX_EDGE_TOTAL || 70);

/**
 * 启动 Edge 并通过 CDP 连接。
 *
 * [R42 · INC-2026-1031-04 根因修复]
 * 旧实现有三个问题，叠加起来就是「跑一次脚本多一个 Edge 实例」：
 *   1. `profileDir` 用 `Date.now()` 生成 ⇒ 每次都是全新用户目录，**物理上不可能复用**；
 *   2. 无条件 `spawn` ⇒ 即便同端口已有一个实例在跑，也会再起一个；
 *   3. 默认端口 `portCursor++` ⇒ 每次调用换端口，互相之间也连不上。
 *
 * 现在的行为：
 *   - **先探测**：该端口上已有可用 CDP 实例就直接 `connect` 复用，返回 `reused: true`；
 *   - 复用时的 `cleanup()` 只 `disconnect`，**不 close、不 kill**（实例不是本次创建的，
 *     关掉会误伤其他 Agent 正在跑的任务）；
 *   - 真要新建时，若系统里 msedge 进程总数已超过 `OREKI_MAX_EDGE_TOTAL`（默认 70，
 *     约等于 2 个浏览器实例），直接抛错拒绝启动 —— 宁可让脚本失败，也不允许再堆实例。
 *
 * @returns {Promise<{browser: import("puppeteer-core").Browser, cleanup: () => Promise<void>, reused: boolean}>}
 */
export async function launchBrowser({ port, headless = true, extraArgs = [], reuse = true } = {}) {
  const puppeteer = (await import("puppeteer-core")).default;
  const exe = findEdge();
  // 实例身份统一钉在共享端口；调用方传进来的 port 只作为「共享端口不可用时」的备选，
  // 绝不因为它不同就去新建第二个实例。
  const usePort = SHARED_CDP_PORT;

  // ---- 1) 复用优先：探测共享端口 ----
  if (reuse) {
    for (const probePort of [SHARED_CDP_PORT, port].filter(p => p != null)) {
      try {
        await getJson(probePort, "/json/version", 1500);
        const browser = await puppeteer.connect({
          browserURL: `http://127.0.0.1:${probePort}`,
          defaultViewport: null,
        });
        console.log(`[edge-launch] 复用已有实例 port=${probePort}（未新建进程）`);
        const cleanup = async () => {
          // 只断开连接，绝不关闭共用实例
          try { await browser.disconnect(); } catch { /* ignore */ }
        };
        return { browser, cleanup, port: probePort, reused: true };
      } catch {
        // 该端口没有可复用实例，试下一个
      }
    }
  }

  // ---- 2) 新建前的硬性上限保护 ----
  const total = countEdgeProcesses();
  if (total >= MAX_EDGE_TOTAL) {
    throw new Error(
      `[edge-launch] 拒绝启动：系统里已有 ${total} 个 msedge 进程（上限 ${MAX_EDGE_TOTAL}）。\n` +
      `  AGENTS.md §30 规定浏览器是共享测试资源，禁止无限扩张。\n` +
      `  请先复用已有实例（共享端口 ${SHARED_CDP_PORT} 会自动复用），或征得主 Agent 同意后再调 OREKI_MAX_EDGE_TOTAL。`
    );
  }

  const profileDir = path.join(os.tmpdir(), `oreki-cdp-shared-${usePort}`);
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

  // [R42 · INC-2026-1031-04 三次修正] 自己新建的实例，cleanup 默认**不关**。
  // 旧实现 cleanup 会 close + kill，于是「跑一次 → 建一个 → 用完关掉 → 下次再建」，
  // 虽然同一时刻只有 1 个实例，但每次运行都是一次全新进程树，既慢又挡不住
  // 「并发时各自新建」。现在共享实例常驻，后续调用一律命中复用分支。
  // 需要真正关闭时显式设 OREKI_CLOSE_ON_CLEANUP=1（收尾清场用）。
  const cleanup = async () => {
    if (process.env.OREKI_CLOSE_ON_CLEANUP !== "1") {
      try { if (browser) await browser.disconnect(); } catch { /* ignore */ }
      return;
    }
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { browser, cleanup, port: usePort, reused: false };
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
export async function openGame(browser, { port, url = "http://127.0.0.1", waitMs = 60000, emulateVisible = true, reusePage = true, tag = null } = {}) {
  // [R42] 优先复用已打开的同站点页面，避免每次调用都 newPage() 新增 Tab。
  // 旧实现无条件 `browser.newPage()`，脚本跑 N 次就多 N 个 Tab（INC-2026-1031-04）。
  // 复用后依然会 goto 导航，状态是新的，不会读到上一轮的残留页面内容。
  //
  // 匹配顺序（tag 是调用方传进来的脚本标识，例如 "viewport-matrix"）：
  //   1. 带同一个 tag 的页面 —— 同一脚本反复跑必然命中，Tab 数不随运行次数增长；
  //   2. 没传 tag 时，只认「URL 里也没有 tag 的」老页面（兼容旧脚本）；
  //   3. 都没有就新建，但页面数到上限直接**抛错**。
  //
  // [R42 · INC-2026-1031-04 二次修正] 曾经有过「都没有就复用第一个页面」这一档，
  // 已删除。理由：复用路径紧接着 `page.goto()`，跨 Agent 命中同一个 Tab 会把对方
  // 正在跑的游戏页导航掉，对方看到的现象是「采样断流 / evaluate hang，但 node 还活着」，
  // 极易被误判成「游戏代码卡死」从而把结论写反。宁可显式失败，也不静默抢占别人的页面。
  let page = null;
  if (reusePage) {
    let pages = [];
    try { pages = await browser.pages(); } catch { pages = []; }
    const isGame = p => {
      const u = p.url() || "";
      return u.includes(`:${port}/`) && u.includes("index.html");
    };
    if (tag) {
      page = pages.find(p => isGame(p) && (p.url() || "").includes(`orekiTag=${tag}`)) || null;
    } else {
      page = pages.find(p => isGame(p) && !(p.url() || "").includes("orekiTag=")) || null;
    }
  }
  if (page) {
    console.log(`[edge-launch] 复用已有页面 ${page.url()}（未新建 Tab）`);
  } else {
    const count = (await browser.pages().catch(() => [])).length;
    if (count >= MAX_SHARED_PAGES) {
      throw new Error(
        `[edge-launch] 共享浏览器里已有 ${count} 个页面（上限 ${MAX_SHARED_PAGES}），拒绝再开新 Tab。\n` +
        `  AGENTS.md §30：禁止把标签页数量当成并行能力。\n` +
        `  正确做法：给 openGame 传一个稳定的 tag（如 { tag: "viewport-matrix" }），同一脚本会复用自己那个 Tab。`
      );
    }
    page = await browser.newPage();
  }
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

  // tag 写进 URL 查询串，下次同脚本运行才能靠它认回自己的页面（不新建 Tab）。
  const gameUrl = `${url}:${port}/index.html` + (tag ? `?orekiTag=${encodeURIComponent(tag)}` : "");
  await page.goto(gameUrl, { waitUntil: "load", timeout: waitMs });
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
