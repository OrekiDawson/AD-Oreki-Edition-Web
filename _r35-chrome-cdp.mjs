// R35：真 Chrome（Android AVD oreki_web_test / emulator-5556）线上验收驱动
//
// 前提（已由主 Agent 做过）：
//   adb -s emulator-5556 forward tcp:9222 localabstract:chrome_devtools_remote
//   Chrome 已打开 https://oreki.net
//
// 用 CDP 直连，而不是 uiautomator：读 DOM / 发真触摸 / 截图都更可靠。
// 用法：node _r35-chrome-cdp.mjs <步骤>
//   info      —— 打印页面基本事实（标题、URL、可见性、错误）
//   sidebar   —— 打印侧栏条目文本与顺序、是否有溢出
//   start     —— 真触摸点击「开始游戏 / 进入」入口
//   news      —— 检查新闻弹窗是否自动关闭 / 手动关闭
//   scroll    —— 侧栏内滚动并截图
//   narrow    —— 切到 360×640 窄屏检查横向溢出
//   shot      —— 仅截图
import fs from "node:fs";

const STEP = process.argv[2] || "info";
const OUT = process.argv[3] || ".";
const WS_URL = process.env.OREKI_CDP_WS || "ws://127.0.0.1:9222/devtools/page/0";

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = e => reject(new Error(`ws error: ${e?.message || "unknown"}`));
    setTimeout(() => reject(new Error("ws timeout")), 10000);
  });
}

let seq = 0;
const pending = new Map();
function send(ws, method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout ${method}`)); }
    }, 30000);
  });
}

function attach(ws) {
  ws.onmessage = ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data || "")})`));
      else resolve(msg.result);
    }
  };
}

async function evalJs(ws, expr) {
  const r = await send(ws, "Runtime.evaluate", {
    expression: expr, returnByValue: true, awaitPromise: true, userGesture: true,
  });
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  }
  return r.result?.value;
}

async function shot(ws, name) {
  const r = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const p = `${OUT}/${name}.png`;
  fs.writeFileSync(p, Buffer.from(r.data, "base64"));
  return p;
}

async function touch(ws, x, y) {
  const base = { x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await send(ws, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [base] });
  await new Promise(r => setTimeout(r, 60));
  await send(ws, "Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise(r => setTimeout(r, 400));
}

const PEEK = `
(() => {
  const t = s => (s || "").replace(/\\s+/g, " ").trim();
  const vis = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const out = {
    url: location.href,
    title: document.title,
    visibility: document.visibilityState,
    vw: innerWidth, vh: innerHeight,
    dpr: devicePixelRatio,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    hasPlayer: typeof window.player === "object" && window.player !== null,
    notation: (() => { try { return window.player?.options?.notation ?? null; } catch { return null; } })(),
    // 侧栏所有可见条目：文本 + 几何
    sidebar: (() => {
      const res = [];
      const nodes = document.querySelectorAll(".l-sidebar a, .l-sidebar button, .sidebar a, .sidebar button, .c-sidebar-tab");
      for (const n of nodes) {
        if (!vis(n)) continue;
        const r = n.getBoundingClientRect();
        res.push({ text: t(n.innerText || n.textContent), x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height) });
      }
      return res;
    })(),
    // 顶层 tab 名（不论选择器是否命中，兜底抓一遍所有 tab 类节点）
    tabs: (() => {
      const res = [];
      for (const n of document.querySelectorAll("[class*=tab]")) {
        if (!vis(n)) continue;
        const tx = t(n.innerText || n.textContent);
        if (!tx || tx.length > 12) continue;
        const r = n.getBoundingClientRect();
        res.push({ text: tx, x: Math.round(r.x), y: Math.round(r.y), cls: String(n.className).slice(0, 40) });
      }
      return res;
    })(),
    modals: Array.from(document.querySelectorAll(".c-modal, .l-modal, [class*=modal]"))
      .filter(vis).map(n => t(n.innerText).slice(0, 120)),
    visibleText: t(document.body.innerText).slice(0, 600),
  };
  return out;
})()
`;

const main = async () => {
  const ws = await connect(WS_URL);
  attach(ws);
  await send(ws, "Runtime.enable");
  await send(ws, "Page.enable");
  // 反冻结：真 Chrome 在后台也会被判 hidden，强制活跃
  await send(ws, "Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await send(ws, "Page.setWebLifecycleState", { state: "active" }).catch(() => {});

  if (STEP === "info" || STEP === "sidebar" || STEP === "news") {
    const peek = await evalJs(ws, PEEK);
    console.log(JSON.stringify(peek, null, 2));
    const p = await shot(ws, `_r35c_${STEP}`);
    console.log("shot:", p);
  } else if (STEP === "start") {
    const p = await shot(ws, "_r35c_before_start");
    console.log("before:", p);
    // 标题画面的入口：原版是「开始」按钮 / 点击任意处
    const hit = await evalJs(ws, `
      (() => {
        const cands = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
          .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        return cands.map(n => ({ text: (n.innerText || "").trim().slice(0, 24),
          x: Math.round(n.getBoundingClientRect().x + n.getBoundingClientRect().width / 2),
          y: Math.round(n.getBoundingClientRect().y + n.getBoundingClientRect().height / 2) }));
      })()
    `);
    console.log("buttons:", JSON.stringify(hit));
    if (Array.isArray(hit) && hit.length) {
      const b = hit.find(h => /开始|Start|进入|继续|Continue/i.test(h.text)) || hit[0];
      console.log("tap:", JSON.stringify(b));
      await touch(ws, b.x, b.y);
    }
    const after = await evalJs(ws, PEEK);
    console.log("after:", JSON.stringify(after, null, 2));
    const p2 = await shot(ws, "_r35c_after_start");
    console.log("after shot:", p2);
  } else if (STEP === "scroll") {
    await send(ws, "Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x: 60, y: 700, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
    });
    for (let i = 1; i <= 8; i++) {
      await send(ws, "Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: 60, y: 700 - i * 40, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
      });
      await new Promise(r => setTimeout(r, 30));
    }
    await send(ws, "Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await new Promise(r => setTimeout(r, 500));
    const peek = await evalJs(ws, PEEK);
    console.log(JSON.stringify({ sidebar: peek.sidebar, overflowX: peek.overflowX }, null, 2));
    console.log("shot:", await shot(ws, "_r35c_scrolled"));
  } else if (STEP === "narrow") {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width: 360, height: 640, deviceScaleFactor: 3, mobile: true,
    });
    await new Promise(r => setTimeout(r, 800));
    const peek = await evalJs(ws, PEEK);
    console.log(JSON.stringify({ vw: peek.vw, scrollW: peek.scrollW, clientW: peek.clientW,
      overflowX: peek.overflowX }, null, 2));
    console.log("shot:", await shot(ws, "_r35c_narrow"));
    await send(ws, "Emulation.clearDeviceMetricsOverride", {}).catch(() => {});
  } else if (STEP === "shot") {
    console.log("shot:", await shot(ws, "_r35c_shot"));
  }
  ws.close();
  process.exit(0);
};

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
