// R40-T 弹窗消失追踪：只装探针，不改游戏逻辑。
// 目标：抓住「教程弹窗打开约 2.4 s 后自行关闭」的第一现场。
//
// 用法（必须用外部常驻服务器，脚本内不要自建）：
//   node serve-static.mjs 8150 ../AD-Oreki-Edition
//   OREKI_NO_SERVER=1 node r40t-modal-trace.mjs
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8150);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN",
    "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("console", m => console.log("[console]", m.text()));
page.on("pageerror", e => console.log("[pageerror]", e.message));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });

// 等游戏初始化
for (let i = 0; i < 300; i++) {
  const ok = await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui));
  if (ok) break;
  await new Promise(r => setTimeout(r, 200));
}
console.log("initialized:", await page.evaluate(() => !!(window.GameUI && GameUI.initialized)));

// ── 装探针 ─────────────────────────────────────────────────────────────
const installed = await page.evaluate(() => {
  const log = [];
  window.__TRACE__ = log;
  const push = (tag, extra) => {
    const stack = new Error().stack.split("\n").slice(2, 9).join(" | ");
    log.push(`${tag} @${Math.round(performance.now())}ms ${extra || ""} :: ${stack}`);
  };

  const modalVm = window.ui.view.modal;

  // 1) queue 的每一次写入（含 sortModalQueue 的整体替换）
  let q = modalVm.queue;
  Object.defineProperty(modalVm, "queue", {
    configurable: true,
    get() { return q; },
    set(v) {
      const names = Array.isArray(v) ? v.map(m => (m && m._component && m._component.name) || "?").join(",") : String(v);
      push("[QUEUE]", `len=${Array.isArray(v) ? v.length : "?"} [${names}]`);
      q = v;
    },
  });

  // 2) current 的每一次写入
  let c = modalVm.current;
  Object.defineProperty(modalVm, "current", {
    configurable: true,
    get() { return c; },
    set(v) {
      push("[CURRENT]", (v && v._component && v._component.name) || String(v));
      c = v;
    },
  });

  // 3) removeFromQueue —— 单实例出队
  const proto = Object.getPrototypeOf(window.Modal.orekiTutorial);
  const origRemove = proto.removeFromQueue;
  proto.removeFromQueue = function (...args) {
    push("[removeFromQueue]", (this._component && this._component.name) || "?");
    return origRemove.apply(this, args);
  };

  // 4) Modal.hide / hideAll 静态
  const origHide = window.Modal.hide;
  window.Modal.hide = function (...args) {
    push("[Modal.hide]", `queueLen=${window.ui.view.modal.queue.length}`);
    return origHide.apply(this, args);
  };
  const origHideAll = window.Modal.hideAll;
  window.Modal.hideAll = function (...args) {
    push("[Modal.hideAll]", "");
    return origHideAll.apply(this, args);
  };

  // 5) CLOSE_MODAL 的派发点
  const origDispatch = window.EventHub.dispatch;
  window.EventHub.dispatch = function (event, ...rest) {
    if (event === "CLOSE_MODAL" || event === "ENTER_PRESSED") {
      push(`[dispatch:${event}]`, "");
    }
    return origDispatch.call(this, event, ...rest);
  };

  return true;
});
console.log("probes installed:", installed);

// ── 打开教程 ───────────────────────────────────────────────────────────
const opened = await page.evaluate(() => {
  try {
    window.Modal.orekiTutorial.show();
    return {
      queueLen: window.ui.view.modal.queue.length,
      current: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    };
  } catch (e) {
    return { error: String(e) };
  }
});
console.log("after show():", JSON.stringify(opened));

// ── 采样 8 秒 ──────────────────────────────────────────────────────────
for (let i = 1; i <= 40; i++) {
  await new Promise(r => setTimeout(r, 200));
  const s = await page.evaluate(() => ({
    q: window.ui.view.modal.queue.length,
    cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    dom: !!document.querySelector(".c-oreki-tut"),
  }));
  if (i % 2 === 0 || s.q === 0) console.log(`t=${i * 200}ms queue=${s.q} current=${s.cur} dom=${s.dom}`);
  if (s.q === 0) break;
}

const trace = await page.evaluate(() => window.__TRACE__);
console.log("\n===== TRACE (" + trace.length + " 条) =====");
for (const line of trace) console.log(line);

await browser.close();
