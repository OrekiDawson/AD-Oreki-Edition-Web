// R35：真 Chrome UI 验收（第二版）——先真正关掉剧情弹窗，再逐项真实触摸
//
// 关键修正：剧情引言的关闭控件是 <i class="c-modal-celestial-quote__end fa fa-check-circle">，
// 不是 button，而且引言打字未完成前不可点。
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
  await sleep(650);
}
async function swipe(x, y0, y1) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1, radiusX: 12, radiusY: 12, force: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove",
      touchPoints: [{ x, y: Math.round(y0 + (y1 - y0) * i / 10), id: 1, radiusX: 12, radiusY: 12, force: 1 }] });
    await sleep(25);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(700);
}
async function shot(n) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64"));
}

const report = { steps: [] };
await send("Runtime.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});

// --- 1) 真正关掉剧情弹窗 ---
for (let attempt = 0; attempt < 3; attempt++) {
  const m = await ev(`(() => {
    const o = document.querySelector(".l-modal-overlay");
    if (!o) return { open: false };
    const end = o.querySelector(".c-modal-celestial-quote__end");
    const r = end ? end.getBoundingClientRect() : null;
    return { open: true, hasEnd: !!end,
      endBox: r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
        w: Math.round(r.width), h: Math.round(r.height) } : null };
  })()`);
  if (!m.open) { report.steps.push({ step: `关闭剧情弹窗(第${attempt + 1}次)`, alreadyClosed: true }); break; }
  if (!m.endBox || m.endBox.w < 4) { await sleep(1500); continue; }
  await tap(m.endBox.x, m.endBox.y);
  const after = await ev(`!!document.querySelector(".l-modal-overlay")`);
  report.steps.push({ step: `关闭剧情弹窗(第${attempt + 1}次)`, tapped: m.endBox, stillOpen: after });
  if (!after) break;
}

// --- 2) 探明 Tab 的当前页可读信号 ---
const tabProbe = await ev(`(() => {
  const out = { hasTab: typeof window.Tab === "object" && window.Tab !== null };
  if (out.hasTab) {
    out.keys = Object.keys(window.Tab).slice(0, 25);
    try { out.current = window.Tab.current; } catch (e) { out.currentErr = String(e).slice(0, 80); }
    try { out.currentTabKey = window.Tab.currentTabKey; } catch (e) { out.keyErr = String(e).slice(0, 80); }
  }
  const items = Array.from(document.querySelectorAll(".l-tab-btn")).map(n => ({
    text: (n.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 12),
    cls: String(n.className),
  }));
  out.tabBtnClasses = items.slice(0, 4);
  return out;
})()`);
report.tabProbe = tabProbe;

// --- 3) 逐项真实触摸，记录切页证据 ---
const rows = await ev(`(() => Array.from(document.querySelectorAll(".l-tab-btn-inner"))
  .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .map(n => { const r = n.getBoundingClientRect();
    return { text: (n.innerText || "").replace(/\\s+/g, " ").trim(),
      cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; }))()`);
report.sidebar = { count: rows.length, names: rows.map(r => r.text) };

const visited = [];
for (const r of rows) {
  await tap(r.cx, r.cy);
  const st = await ev(`(() => {
    const t = s => (s || "").replace(/\\s+/g, " ").trim();
    const active = Array.from(document.querySelectorAll(".l-tab-btn"))
      .filter(n => /active|selected/i.test(String(n.className)))
      .map(n => t(n.innerText).slice(0, 12));
    const subtabs = Array.from(document.querySelectorAll(".o-tab-btn--subtab"))
      .filter(n => { const b = n.getBoundingClientRect(); return b.width > 0; })
      .map(n => t(n.innerText).slice(0, 14));
    const scrollBox = (() => {
      for (const n of document.querySelectorAll("div, section, main")) {
        if (n.scrollHeight > n.clientHeight + 8 && n.clientHeight > 200) {
          return { cls: String(n.className).slice(0, 40), scrollH: n.scrollHeight, clientH: n.clientHeight,
            scrollTop: Math.round(n.scrollTop) };
        }
      }
      return null;
    })();
    return { active, subtabs: subtabs.slice(0, 6), scrollBox,
      modal: !!document.querySelector(".l-modal-overlay") };
  })()`);
  visited.push({ tap: r.text, ...st });
}
report.steps.push({ step: "逐项真实触摸", visited });

// --- 4) 滚动：在「统计数据」这种长页面上真滑一次 ---
const stat = rows.find(r => r.text === "统计数据");
if (stat) {
  await tap(stat.cx, stat.cy);
  const before = await ev(`(() => { for (const n of document.querySelectorAll("div, section, main")) {
    if (n.scrollHeight > n.clientHeight + 8 && n.clientHeight > 200)
      return { cls: String(n.className).slice(0, 40), scrollTop: Math.round(n.scrollTop),
        scrollH: n.scrollHeight, clientH: n.clientHeight }; } return null; })()`);
  await swipe(196, 600, 250);
  await swipe(196, 600, 250);
  const after = await ev(`(() => { for (const n of document.querySelectorAll("div, section, main")) {
    if (n.scrollHeight > n.clientHeight + 8 && n.clientHeight > 200)
      return { cls: String(n.className).slice(0, 40), scrollTop: Math.round(n.scrollTop),
        scrollH: n.scrollHeight, clientH: n.clientHeight }; } return null; })()`);
  report.scroll = { before, after, moved: !!(before && after && after.scrollTop > before.scrollTop) };
  await shot("_r35c_scroll_stat");
}

// --- 5) 窄屏 360×640 溢出（弹窗已关，结果才可信）---
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await sleep(1500);
report.narrow = await ev(`(() => ({
  vw: innerWidth, docScrollW: document.documentElement.scrollWidth,
  docClientW: document.documentElement.clientWidth,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  overflowing: Array.from(document.querySelectorAll("*"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2; })
    .slice(0, 10).map(n => ({ cls: String(n.className).slice(0, 44),
      right: Math.round(n.getBoundingClientRect().right), w: Math.round(n.getBoundingClientRect().width) }))
}))()`);
await shot("_r35c_narrow360");
await send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {});
await sleep(800);

// --- 6) 记数法 + 新闻 ---
report.notation = await ev(`(() => {
  const picks = [];
  try { picks.push(["player.options.notation", window.player?.options?.notation]); } catch (e) { /* */ }
  try { picks.push(["antimatter", window.format(window.Currency.antimatter.value)]); } catch (e) { /* */ }
  try { picks.push(["eternities", window.format(window.Currency.eternities.value)]); } catch (e) { /* */ }
  try { picks.push(["big1e1e10", window.format(new window.Decimal(1, 1e10))]); } catch (e) { /* */ }
  try { picks.push(["mixedExp", window.format(new window.Decimal(8.62, 2.781e10))]); } catch (e) { /* */ }
  return picks;
})()`);
report.news = await ev(`(() => {
  const t = s => (s || "").replace(/\\s+/g, " ").trim();
  const nodes = Array.from(document.querySelectorAll("[class*=news], [class*=ticker]"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return { visibleNews: nodes.map(n => t(n.innerText).slice(0, 100)),
    newsModalOpen: !!document.querySelector(".l-modal-overlay") };
})()`);
await shot("_r35c_end");
fs.writeFileSync(`${OUT}/_r35c_ui2_report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
process.exit(0);
