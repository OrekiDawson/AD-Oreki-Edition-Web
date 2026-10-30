// R35：真 Chrome UI 验收（第三版）
//
// 第二版失败原因已查明：不是弹窗卡死，而是**剧情引言有队列**——每次点 ✓ 只前进一条，
// 后期存档积压很多条，于是后续所有触摸都被「切换引言」吃掉。
// 本版先排空引言队列，再用真实触摸逐项切页，并用 player.tabs 作为切页证据。
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
  const p = { x: Math.round(x), y: Math.round(y), radiusX: 10, radiusY: 10, force: 1, id: 1 };
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
  await sleep(50);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(320);
}
async function swipe(x, y0, y1) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1, radiusX: 12, radiusY: 12, force: 1 }] });
  for (let i = 1; i <= 12; i++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove",
      touchPoints: [{ x, y: Math.round(y0 + (y1 - y0) * i / 12), id: 1, radiusX: 12, radiusY: 12, force: 1 }] });
    await sleep(22);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(600);
}
async function shot(n) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64"));
}

const report = { steps: [] };
await send("Runtime.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
await send("Page.setWebLifecycleState", { state: "active" }).catch(() => {});

// --- 1) 排空引言队列 ---
const drained = [];
for (let i = 0; i < 80; i++) {
  const st = await ev(`(() => {
    const o = document.querySelector(".l-modal-overlay");
    if (!o) return { open: false };
    const e = o.querySelector(".c-modal-celestial-quote__end");
    const r = e ? e.getBoundingClientRect() : null;
    return { open: true,
      text: (o.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 40),
      box: r && r.width > 2 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null };
  })()`);
  if (!st.open) break;
  drained.push(st.text);
  if (st.box) await tap(st.box.x, st.box.y);
  else await sleep(1200);
}
report.quoteDrain = { count: drained.length, lastFew: drained.slice(-4),
  closed: !(await ev(`!!document.querySelector(".l-modal-overlay")`)) };

// --- 2) 用 player.tabs 作为切页证据 ---
const tabKeys = await ev(`(() => typeof window.Tab === "object" ? Object.keys(window.Tab) : null)()`);
report.tabKeys = tabKeys;

const rows = await ev(`(() => Array.from(document.querySelectorAll(".l-tab-btn-inner"))
  .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .map(n => { const r = n.getBoundingClientRect();
    return { text: (n.innerText || "").replace(/\\s+/g, " ").trim(),
      cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; }))()`);
report.sidebar = { count: rows.length, names: rows.map(r => r.text) };

const visited = [];
for (const r of rows) {
  const before = await ev(`JSON.stringify(window.player?.tabs ?? null)`);
  await tap(r.cx, r.cy);
  const after = await ev(`JSON.stringify(window.player?.tabs ?? null)`);
  const modal = await ev(`!!document.querySelector(".l-modal-overlay")`);
  visited.push({ tap: r.text, before, after, changed: before !== after, modal });
}
report.steps.push({ step: "逐项真实触摸（player.tabs 证据）", visited });

// --- 3) 滚动（先切到统计数据这种长页面）---
const stat = rows.find(r => r.text === "统计数据");
if (stat) {
  await tap(stat.cx, stat.cy);
  const probeScroll = `(() => { for (const n of document.querySelectorAll("div, section, main")) {
    if (n.scrollHeight > n.clientHeight + 8 && n.clientHeight > 200)
      return { cls: String(n.className).slice(0, 36), scrollTop: Math.round(n.scrollTop),
        scrollH: n.scrollHeight, clientH: n.clientHeight }; } return null; })()`;
  const before = await ev(probeScroll);
  await swipe(196, 620, 240);
  await swipe(196, 620, 240);
  const after = await ev(probeScroll);
  report.scroll = { before, after, moved: !!(before && after && after.scrollTop > before.scrollTop),
    fullPageScrollable: await ev(`document.documentElement.scrollHeight > document.documentElement.clientHeight`) };
  await shot("_r35c_scroll_stat");
}

// --- 4) 窄屏 360×640，逐页检查溢出（每页切过去再量）---
const narrowByTab = [];
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await sleep(1000);
for (const r of rows) {
  await tap(60 / 2 + 27, r.cy);
  await sleep(300);
  const n = await ev(`(() => ({
    vw: innerWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    docScrollW: document.documentElement.scrollWidth,
    clipped: Array.from(document.querySelectorAll("*"))
      .filter(e => { const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.right > innerWidth + 2 &&
          getComputedStyle(e).visibility !== "hidden"; })
      .slice(0, 4).map(e => ({ cls: String(e.className).slice(0, 40), right: Math.round(e.getBoundingClientRect().right) }))
  }))()`);
  narrowByTab.push({ tab: r.text, ...n });
}
report.narrow360 = narrowByTab;
await shot("_r35c_narrow360");
await send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {});
await sleep(700);

// --- 5) 记数法（用玩家真实数值，不构造假 Decimal）---
report.notation = await ev(`(() => {
  const out = { option: window.player?.options?.notation ?? null, samples: [] };
  const f = window.format;
  const push = (k, v) => { try { out.samples.push([k, f(v)]); } catch (e) { out.samples.push([k, "ERR"]); } };
  try { push("antimatter", window.Currency.antimatter.value); } catch (e) { /* */ }
  try { push("infinityPoints", window.Currency.infinityPoints.value); } catch (e) { /* */ }
  try { push("eternities", window.Currency.eternities.value); } catch (e) { /* */ }
  try { push("realityMachines", window.Currency.realityMachines.value); } catch (e) { /* */ }
  try { push("ipPerSec", window.Currency.infinityPoints.value.times(1e-3)); } catch (e) { /* */ }
  return out;
})()`);

// --- 6) 新闻 ---
report.news = await ev(`(() => {
  const t = s => (s || "").replace(/\\s+/g, " ").trim();
  const nodes = Array.from(document.querySelectorAll("[class*=news]"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return { visible: nodes.map(n => t(n.innerText).slice(0, 90)),
    overlayOpen: !!document.querySelector(".l-modal-overlay") };
})()`);
await shot("_r35c_end");
fs.writeFileSync(`${OUT}/_r35c_ui3_report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
process.exit(0);
