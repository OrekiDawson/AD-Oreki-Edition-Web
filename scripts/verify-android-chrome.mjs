#!/usr/bin/env node
/**
 * R78 Web 六档视口验收 —— **Android 模拟器 Chrome**（不是 Edge、不是 headless）。
 *
 * ## 为什么不沿用 R51 的脚本
 *
 * `reports/_r51/_shot_viewports.mjs` 用的是 `msedge.exe --headless=new`。
 * R78 用户令明确：「不得使用桌面 Edge 或 Headless Edge 冒充 Android Chrome 验收」。
 * 本脚本走另一条链路：
 *
 *   emulator (oreki_test, Android 16 / API 36 / x86_64 / 1440x3200)
 *     → Chrome 133 (com.android.chrome)
 *     → `--remote-debugging-port=9222`（通过 adb forward 映射到本机）
 *     → Node 内置 WebSocket 直连 CDP
 *     → `Emulation.setDeviceMetricsOverride` 切六档视口
 *
 * ## 用法
 *
 *   # 1) 起本地静态服务（Web 仓根目录）
 *   node serve.mjs 8080
 *   # 2) 跑验收
 *   node scripts/verify-android-chrome.mjs
 *
 * 产物：reports/_r78/shots/<w>x<h>.png + reports/_r78/result.json
 *
 * ## 六档
 *   320 / 360 / 390 / 430 / 768 / 1280（R78 指定，注意与 R51 的 412/1024 不同）
 */

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "reports", "_r78", "shots");
const ADB = process.env.ADB || "C:/Users/Oreki/Android/sdk/platform-tools/adb.exe";
const CHROME_PKG = "com.android.chrome";
const LOCAL_PORT = 9222;

const GAME_URL = process.env.GAME_URL || "http://127.0.0.1:8080/";

// R78 指定的六档（宽度；高度取常见手机/平板比例）
const VIEWPORTS = [
  { w: 320, h: 640, label: "320" },
  { w: 360, h: 740, label: "360" },
  { w: 390, h: 844, label: "390" },
  { w: 430, h: 932, label: "430" },
  { w: 768, h: 1024, label: "768" },
  { w: 1280, h: 800, label: "1280" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function adb(...args) {
  return execFileSync(ADB, args, { encoding: "utf-8", timeout: 60000 }).trim();
}

function adbShell(...args) {
  // MSYS 路径转换会让 /data/local/tmp 变成 C:/...，用 -- 分隔并关掉转换
  return execFileSync(ADB, ["shell", ...args], {
    encoding: "utf-8",
    timeout: 60000,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  }).trim();
}

/** 最小 CDP 客户端（Node 22 自带 WebSocket）。 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", (e) => reject(new Error("ws error: " + e.message)), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 15000);
  });
  return new Cdp(ws);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  // ---- 1. 确认设备与 Chrome ----
  const devs = adb("devices");
  if (!/emulator-\d+\s+device/.test(devs)) {
    console.error("没有可用的 Android 模拟器设备：\n" + devs);
    process.exit(2);
  }
  const chromeVer = adbShell("dumpsys", "package", CHROME_PKG).match(/versionName=(\S+)/)?.[1] ?? "?";
  const sdk = adbShell("getprop", "ro.build.version.sdk");
  const abi = adbShell("getprop", "ro.product.cpu.abi");
  const size = adbShell("wm", "size");

  console.log(`设备：API ${sdk} / ${abi} / ${size}`);
  console.log(`Chrome：${chromeVer}`);

  // ---- 2. 起 Chrome 的远程调试并做端口转发 ----
  adbShell("am", "force-stop", CHROME_PKG);
  await sleep(1000);
  // Chrome 的 devtools socket 只在调试构建默认开启；用命令行显式打开
  adbShell(
    "am", "start", "-n", `${CHROME_PKG}/com.google.android.apps.chrome.Main`,
    "-a", "android.intent.action.VIEW",
    "-d", GAME_URL,
    "--es", "args", `--remote-debugging-port=9222`
  );
  await sleep(4000);

  try {
    adb("forward", `tcp:${LOCAL_PORT}`, "localabstract:chrome_devtools_remote");
  } catch (e) {
    console.error("adb forward 失败：" + e.message);
    process.exit(3);
  }

  // ---- 3. 拿 targets ----
  let target = null;
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${LOCAL_PORT}/json/list`);
      const list = await r.json();
      target = list.find((t) => t.type === "page" && t.url.startsWith("http"));
      if (target) break;
    } catch {
      /* 还没起来 */
    }
    await sleep(1500);
  }
  if (!target) {
    console.error("拿不到 Chrome 调试目标（Chrome 可能未开启 devtools socket）");
    process.exit(4);
  }
  console.log(`调试目标：${target.url}`);

  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // ---- 4. 逐档验收 ----
  for (const vp of VIEWPORTS) {
    const rec = { ...vp, ok: false, notes: [] };
    try {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: vp.w <= 768,
      });
      await sleep(1200);

      // 结构探针：确认页面真的按这个宽度布局 + 关键控件存在
      const probe = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const de = document.documentElement;
          const btn = document.querySelector('#automation-toggle, [data-oreki="automation-toggle"], .automation-toggle');
          const interval = document.querySelector('#automation-interval, [data-oreki="automation-interval"]');
          return {
            innerWidth: window.innerWidth,
            scrollWidth: de.scrollWidth,
            hasHorizontalScroll: de.scrollWidth > window.innerWidth + 2,
            hasAutomationToggle: !!btn,
            hasIntervalInput: !!interval,
            title: document.title || "",
          };
        })()`,
      });
      Object.assign(rec, probe.result?.value ?? {});
      rec.ok = rec.innerWidth === vp.w && !rec.hasHorizontalScroll;
      if (rec.hasHorizontalScroll) rec.notes.push("出现横向滚动条（布局溢出）");
      if (rec.innerWidth !== vp.w) rec.notes.push(`innerWidth=${rec.innerWidth} 与目标 ${vp.w} 不符`);

      // 截图
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      const file = path.join(OUT_DIR, `${vp.w}x${vp.h}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
      rec.screenshot = path.relative(ROOT, file);
    } catch (e) {
      rec.notes.push("异常：" + e.message);
    }
    results.push(rec);
    console.log(`${vp.w}x${vp.h}: ${rec.ok ? "OK" : "FAIL"} ${rec.notes.join("; ")}`);
  }

  // ---- 5. 汇总 ----
  const summary = {
    verifiedAt: new Date().toISOString(),
    device: { sdk, abi, size: size.replace("Physical size: ", "") },
    chrome: chromeVer,
    url: GAME_URL,
    browser: "Android System Chrome (emulator, NOT Edge/headless)",
    viewports: results,
    passed: results.filter((r) => r.ok).length,
    total: results.length,
  };
  fs.writeFileSync(path.join(ROOT, "reports", "_r78", "result.json"),
    JSON.stringify(summary, null, 2), "utf-8");

  console.log(`\n汇总：${summary.passed}/${summary.total} 档通过`);
  console.log(`结果：reports/_r78/result.json`);
  process.exit(summary.passed === summary.total ? 0 : 5);
}

main().catch((e) => {
  console.error("验收脚本异常：" + (e.stack || e.message));
  process.exit(9);
});
