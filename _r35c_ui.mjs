// R35：真 Chrome 移动端 UI 验收（真实触摸事件，非脚本点击）
//
// 前提：adb forward tcp:9222 localabstract:chrome_devtools_remote 已建立，Chrome 已打开 https://oreki.net
// 用法：node _r35c_ui.mjs [输出目录]
import fs from "node:fs";

const OUT = process.argv[2] || ".";
const WS_URL = process.env.OREKI_CDP_WS || "ws://127.0.0.1:9222/devtools/page/0";

let seq = 0;
const pend = new Map();
const ws = new WebSocket(WS_URL);
const send = (m, p = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pend.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error("timeout " + m)); } }, 30000);
});
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const { res, rej } = pend.get(m.id);
    pend.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  }
};
await new Promise(r => { ws.onopen = r; });

const ev = async x => {
  const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result?.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tap(x, y) {
  const p = { x, y, radiusX: 10, radiusY: 10, force: 1, id: 1 };
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
  await sleep(50);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(700);
}

async function swipe(x, y0, y1) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1, radiusX: 12, radiusY: 12, force: 1 }] });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: Math.round(y0 + (y1 - y0) * i / steps), id: 1, radiusX: 12, radiusY: 12, force: 1 }],
    });
    await sleep(25);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(600);
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
}

const ACTIVE = `
(() => {
  const t = s => (s || "").replace(/\\s+/g, " ").trim();
  const items = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const rows = items.map(n => {
    const r = n.getBoundingClientRect();
    const host = n.closest(".l-tab-btn") || n;
    const active = host.classList.contains("l-tab-btn--active") ||
      host.getAttribute("aria-selected") === "true" ||
      host.className.includes("active");
    return { text: t(n.innerText || n.textContent), cx: Math.round(r.x + r.width / 2),
      cy: Math.round(r.y + r.height / 2), active };
  });
  return { rows,
    activeTexts: rows.filter(r => r.active).map(r => r.text),
    modalOpen: Array.from(document.querySelectorAll("[class*=modal]"))
      .some(n => { const r = n.getBoundingClientRect(); return r.width > 100 && r.height > 100; }),
    modalText: (() => {
      const m = Array.from(document.querySelectorAll("[class*=modal]"))
        .find(n => { const r = n.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
      return m ? t(m.innerText).slice(0, 200) : null;
    })(),
    bodyText: t(document.body.innerText).slice(0, 400) };
})()
`;

const report = { steps: [], errors: [] };
await send("Runtime.enable");
await send("Log.enable").catch(() => {});
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") {
    report.errors.push(String(m.params.exceptionDetails?.exception?.description || "").slice(0, 200));
  }
});
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});

// 0) 关掉可能存在的剧情弹窗（点它的确认按钮）
let s = await ev(ACTIVE);
if (s.modalOpen) {
  const btn = await ev(`
    (() => {
      const m = Array.from(document.querySelectorAll("[class*=modal]"))
        .find(n => { const r = n.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
      if (!m) return null;
      const b = m.querySelector("button, .c-modal__button, [class*=button]");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
        text: (b.innerText || "").trim().slice(0, 20) };
    })()
  `);
  report.steps.push({ step: "关闭弹窗", modalText: s.modalText, button: btn });
  if (btn) await tap(btn.x, btn.y);
  s = await ev(ACTIVE);
  report.steps.push({ step: "关闭后", modalOpen: s.modalOpen });
}

// 1) 侧栏 10 项 + 真实触摸逐个切换
const rows = s.rows;
report.sidebar = { count: rows.length, names: rows.map(r => r.text) };

const visited = [];
for (const r of rows) {
  await tap(r.cx, r.cy);
  const st = await ev(ACTIVE);
  visited.push({ tap: r.text, activeAfter: st.activeTexts, heading: (st.bodyText || "").slice(0, 60), modal: st.modalOpen });
}
report.steps.push({ step: "逐项真实触摸", visited });

// 2) 滚动测试：回到「选项」页做长列表滚动
const opt = rows.find(r => r.text === "选项");
if (opt) {
  await tap(opt.cx, opt.cy);
  const before = await ev(`(() => {
    const el = document.querySelector(".l-main-column, #mainColumn, main") || document.scrollingElement;
    return { tag: el.tagName, scrollTop: Math.round(el.scrollTop), scrollH: el.scrollHeight, clientH: el.clientHeight };
  })()`);
  await swipe(196, 560, 220);
  const after = await ev(`(() => {
    const el = document.querySelector(".l-main-column, #mainColumn, main") || document.scrollingElement;
    return { scrollTop: Math.round(el.scrollTop), scrollH: el.scrollHeight, clientH: el.clientHeight };
  })()`);
  report.scroll = { before, after };
  await shot("_r35c_opt_scrolled");
}

// 3) 窄屏 360×640 横向溢出检查
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await sleep(1200);
const narrow = await ev(`(() => ({
  vw: innerWidth, vh: innerHeight,
  docScrollW: document.documentElement.scrollWidth,
  docClientW: document.documentElement.clientWidth,
  bodyScrollW: document.body.scrollWidth,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  overflowing: Array.from(document.querySelectorAll("*")).filter(n => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.right > innerWidth + 2;
  }).slice(0, 8).map(n => ({ cls: String(n.className).slice(0, 40), right: Math.round(n.getBoundingClientRect().right) }))
}))()`);
report.narrow = narrow;
await shot("_r35c_narrow360");
await send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {});
await sleep(600);

// 4) 记数法核对
report.notation = await ev(`(() => ({
  option: window.player?.options?.notation ?? null,
  label: (() => {
    const s = Array.from(document.querySelectorAll("select, .o-select"))
      .map(n => n.value || n.innerText).filter(Boolean);
    return s.slice(0, 6);
  })(),
  antimatter: (() => { try { return window.format ? window.format(window.Currency.antimatter.value) : null; } catch (e) { return null; } })(),
  sampleBig: (() => { try { return window.format(new (window.Decimal)(1, 1e10)); } catch (e) { return null; } })()
}))()`);

// 5) 新闻弹窗是否自动关闭
report.news = await ev(`(() => {
  const t = s => (s || "").replace(/\\s+/g, " ").trim();
  const news = Array.from(document.querySelectorAll("[class*=news], .c-news-ticker, [class*=ticker]"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return { visibleNews: news.map(n => t(n.innerText).slice(0, 120)),
    modalOpen: Array.from(document.querySelectorAll("[class*=modal]"))
      .some(n => { const r = n.getBoundingClientRect(); return r.width > 100 && r.height > 100; }) };
})()`);

await shot("_r35c_final");
fs.writeFileSync(`${OUT}/_r35c_ui_report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
process.exit(0);
