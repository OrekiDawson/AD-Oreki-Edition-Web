// R40-T 弹窗消失追踪 v2：不重定义 queue/current（v1 那样做会掐断 Vue 响应式，导致 DOM 永不更新）。
// 只做三件事：包 removeFromQueue / Modal.hide / Modal.hideAll，轮询 DOM 与 current。
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8151);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN",
    "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("console", m => {
  const t = m.text();
  if (/googletagmanager|Content Security/iu.test(t)) return;
  console.log("[console]", t.slice(0, 400));
});
page.on("pageerror", e => console.log("[pageerror]", e.message));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui))) break;
  await new Promise(r => setTimeout(r, 200));
}

await page.evaluate(() => {
  const log = (window.__TRACE__ = []);
  const push = (tag, extra) => {
    const stack = new Error().stack.split("\n").slice(2, 10).join(" | ");
    log.push(`${tag} @${Math.round(performance.now())}ms ${extra || ""} :: ${stack}`);
  };
  const proto = Object.getPrototypeOf(window.Modal.orekiTutorial);
  const origRemove = proto.removeFromQueue;
  proto.removeFromQueue = function (...a) {
    push("[removeFromQueue]", (this._component && this._component.name) || "?");
    return origRemove.apply(this, a);
  };
  const origHide = window.Modal.hide;
  window.Modal.hide = function (...a) {
    push("[Modal.hide]", `queueLen=${window.ui.view.modal.queue.length}`);
    return origHide.apply(this, a);
  };
  const origHideAll = window.Modal.hideAll;
  window.Modal.hideAll = function (...a) {
    push("[Modal.hideAll]", "");
    return origHideAll.apply(this, a);
  };
  const origDispatch = window.EventHub.dispatch;
  window.EventHub.dispatch = function (ev, ...rest) {
    if (ev === "CLOSE_MODAL") push("[dispatch:CLOSE_MODAL]", "");
    return origDispatch.call(this, ev, ...rest);
  };
  // DOM 观察：记录 .c-oreki-tut 从有到无的那一刻
  window.__WATCH__ = { present: false, removedAt: 0 };
  const obs = new MutationObserver(() => {
    const now = !!document.querySelector(".c-oreki-tut");
    if (window.__WATCH__.present && !now) {
      window.__WATCH__.removedAt = Math.round(performance.now());
      log.push(`[DOM-REMOVED] @${window.__WATCH__.removedAt}ms current=${window.ui.view.modal.current && window.ui.view.modal.current._component.name} :: ` +
        new Error().stack.split("\n").slice(2, 8).join(" | "));
    }
    window.__WATCH__.present = now;
  });
  obs.observe(document.body, { childList: true, subtree: true });
});

await page.evaluate(() => window.Modal.orekiTutorial.show());
console.log("opened");

let vanishedAt = 0;
for (let i = 1; i <= 120; i++) {
  await new Promise(r => setTimeout(r, 100));
  const s = await page.evaluate(() => ({
    q: window.ui.view.modal.queue.length,
    cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    dom: !!document.querySelector(".c-oreki-tut"),
    end: window.GameEnd ? Number(GameEnd.endState.toFixed ? GameEnd.endState.toFixed(2) : GameEnd.endState) : -1,
  }));
  if (i % 5 === 0 || !s.dom) console.log(`t=${i * 100}ms q=${s.q} cur=${s.cur} dom=${s.dom} endState=${s.end}`);
  if (!s.dom && !vanishedAt) vanishedAt = i * 100;
  if (vanishedAt && i * 100 > vanishedAt + 1500) break;
}
console.log("vanishedAt:", vanishedAt || "从未消失（12 s 内）");

const out = await page.evaluate(() => ({ trace: window.__TRACE__, watch: window.__WATCH__ }));
console.log("\n===== TRACE (" + out.trace.length + ") =====");
for (const l of out.trace) console.log(l);
console.log("watch:", JSON.stringify(out.watch));

await browser.close();
