// [R40-S3 诊断] 教程弹窗「DOM 消失但仍在队列里」的取证
//
// 现象（r40s3-tut2.jsonl，全新档，第 10 s 开教程）：
//   t=254.9 tutOpen=true  nodes=234  标题「第 13 章　天神（一）…」  queue="OrekiTutorialModal#4|MessageModal#2"
//   t=255.9 tutOpen=false nodes=0    标题 ""                      queue 同上（没变）
// 即：队列没动、没被顶掉，但 DOM 没了。
//
// 本脚本只做一件事：把「谁动了弹窗系统」逐次记下来（带调用栈前 3 帧），
// 每 500 ms 采样一次 `ui.view.modal.current` 的真实类型与渲染树节点数。
//
// 用法：node _tools/_r40/r40s3-why-tut.mjs [秒数]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8889);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9389);
const MAX_SEC = Number(process.argv[2]) || 300;
const TAG = process.argv[3] || "r40s3-why-tut";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: EDGE_PORT });
const { page, errors } = await openGame(browser, { port: PORT });

await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof globalThis.player !== "undefined" && !!globalThis.Modal, { timeout: 60000 });

// ── 插桩：只包「改变队列/当前」的四个入口，不碰 ui.view.modal 的响应式（R40T §一 的教训）
await page.evaluate(() => {
  window.__r40T0 = Date.now();
  window.__modLog = [];
  const stamp = () => Math.round((Date.now() - window.__r40T0) / 100) / 10;
  const push = (kind, extra) => {
    let stack = "";
    try { stack = (new Error().stack || "").split("\n").slice(2, 5).map(s => s.trim()).join(" <= "); } catch (e) { /* ignore */ }
    if (window.__modLog.length < 400) window.__modLog.push({ t: stamp(), kind, extra, stack });
  };
  const wrapStatic = (name) => {
    const orig = Modal[name];
    if (typeof orig !== "function") return;
    Modal[name] = function (...args) {
      push(name, { q: (ui.view.modal.queue || []).length });
      return orig.apply(this, args);
    };
  };
  ["hide", "hideAll", "sortModalQueue"].forEach(wrapStatic);
  const origShow = Modal.prototype.show;
  Modal.prototype.show = function (...args) {
    const n = this.component?.name || "anon";
    push("show", { modal: n, prio: this.priority });
    return origShow.apply(this, args);
  };
});

const SAMPLE = () => page.evaluate(() => {
  const T = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const cur = ui.view.modal.current;
  const nameOf = m => {
    const c = m && m.component;
    return c ? (c.name || c.__name || "anon") : (m ? `obj:${Object.keys(m).slice(0, 3).join(",")}` : String(m));
  };
  const tut = document.querySelector(".c-oreki-tut");
  return {
    t: Math.round((Date.now() - window.__r40T0) / 100) / 10,
    cur: T(() => nameOf(cur)),
    curIsQ0: T(() => cur === (ui.view.modal.queue || [])[0]),
    qLen: T(() => (ui.view.modal.queue || []).length),
    qNames: T(() => (ui.view.modal.queue || []).map(m => `${nameOf(m)}#${m.priority}`).join("|")),
    nTut: T(() => (tut ? tut.querySelectorAll("*").length : 0), 0),
    nModal: T(() => document.querySelectorAll(".c-modal").length, 0),
    nChoice: T(() => document.querySelectorAll("[data-v-modal-wrapper-choice]").length, 0),
    nMsg: T(() => document.querySelectorAll(".c-modal-message").length, 0),
    // GameUiComponentFixed 的 v-else-if 链：ModalProgressBar → CelestialQuoteModal
    // → CelestialQuoteHistoryDisplay → PopupModal。任何一条抢在前面，弹窗层就整片不渲染，
    // 而 modal.queue 完全不动 —— 与观察到的签名（队列不变、DOM 全空）一致。
    pb: T(() => ui.view.modal.progressBar !== undefined, null),
    qCur: T(() => {
      const q = ui.view.quotes || {};
      if (!q.current) return null;
      return q.current.id || q.current.name || (q.current.quote && String(q.current.quote).slice(0, 24)) || "quote";
    }),
    qHistN: T(() => ((ui.view.quotes || {}).history || []).length, 0),
    nQuoteDom: T(() => document.querySelectorAll("[class*='c-celestial-quote'], .l-modal-celestial-quote").length, 0),
    title: T(() => (tut?.querySelector(".c-oreki-tut__head-title")?.textContent || "").trim(), ""),
    stage: T(() => globalThis.OrekiSmartStrategy?.debugState?.().stage?.id),
    realities: T(() => player.realities),
    modLogN: T(() => window.__modLog.length, 0),
  };
});

const T0 = Date.now();
const rows = [];
let openedAt = null;
const JSONL = path.join(HERE, `${TAG}.jsonl`);
fs.writeFileSync(JSONL, "");

while (Date.now() - T0 < MAX_SEC * 1000) {
  const elapsed = Date.now() - T0;
  if (openedAt === null && elapsed >= 10000) {
    const r = await page.evaluate(() => {
      try { Modal.orekiTutorial.show(); return { ok: true }; } catch (e) { return { ok: false, why: String(e.message) }; }
    });
    openedAt = Math.round(elapsed / 100) / 10;
    console.log(`[open] t=${openedAt}s ${JSON.stringify(r)}`);
  }
  const s = await SAMPLE();
  rows.push(s);
  fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  await new Promise(r => setTimeout(r, 500));
}

const log = await page.evaluate(() => window.__modLog);
const out = { tag: TAG, samples: rows.length, lastT: rows.at(-1)?.t, pageErrors: errors.length, modLog: log };
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(out, null, 1));

// 打印「DOM 从有到无」的边界
for (let i = 1; i < rows.length; i++) {
  if (rows[i - 1].nTut > 0 && rows[i].nTut === 0) {
    console.log(`[drop] ${rows[i - 1].t}s -> ${rows[i].t}s`);
    console.log("  before:", JSON.stringify(rows[i - 1]));
    console.log("  after :", JSON.stringify(rows[i]));
    console.log("  modLog since:", JSON.stringify(log.filter(e => e.t <= rows[i].t).slice(-6), null, 1));
  }
}
console.log("pageErrors=", errors.length, "modLog=", log.length);
await cleanup();
server.close();
process.exit(0);
