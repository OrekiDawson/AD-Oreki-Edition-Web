// [R40-S3 追加 v2] 引文队列排空后，modal 层是否回来？（v1 发现：引文不是一条，是一整队）
//
// v1（r40s3-quote-recover.mjs）的发现：
//   t=277 s 引文出现，点 12 次，每次都是「关掉一条、下一条自动顶上」，队列没排空；
//   每次点击间隔 5~7 s，因为页面在 10000× 下主线程很满，SAMPLE 的 evaluate 要等。
//   所以 12 次点击的上限不够，v1 的「未结束」不能当软锁结论。
//
// v2 改动：
//   1) 引文出现时先读 `ui.view.quotes.queue.length`，把「还剩多少条」写进数据；
//   2) 点击循环上限按队列长度算（+10 余量），每 5 次才 SAMPLE 一次（省掉等待）；
//   3) 排空后立刻切到 100 ms 采样，量「modal 层多久回来」。
//
// 判据（team-lead 写死）：quotes.current 变 null 后 ≤2 s 内 nModal>0 且 cur==OrekiTutorialModal 为回来；
// 10 s 仍 0 判软锁。
//
// 用法：node _tools/_r40/r40s3-quote-drain.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8894);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9394);
const TAG = process.argv[2] || "r40s3-quote-drain";
const MAX_WAIT_QUOTE_MS = 420000;
const RECOVER_WINDOW_MS = 12000;

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
await page.evaluate(() => {
  window.__t0 = Date.now();
  // 50 ms 页内监视：只在「状态签名变化」时记一条，完全不依赖 Node 侧轮询，能把时刻测准
  window.__mon = [];
  let last = "";
  setInterval(() => {
    try {
      const q = ui.view.quotes || {};
      const cur = ui.view.modal.current;
      const sig = [
        q.current ? 1 : 0,
        (q.queue || []).length,
        document.querySelectorAll(".c-modal").length,
        cur ? (cur.component?.name || "anon") : "",
        document.querySelectorAll(".c-oreki-tut").length,
      ].join("|");
      if (sig === last) return;
      last = sig;
      if (window.__mon.length < 4000) {
        window.__mon.push({ t: Math.round((Date.now() - window.__t0) / 100) / 10, perf: Math.round(performance.now()), sig });
      }
    } catch (e) { /* ignore */ }
  }, 50);
});

const T0 = Date.now();
const sleep = n => new Promise(r => setTimeout(r, n));
const now = () => Math.round((Date.now() - T0) / 100) / 10;
const JSONL = path.join(HERE, `${TAG}.jsonl`);
fs.writeFileSync(JSONL, "");
const rows = [];
const push = s => { rows.push(s); fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); };

const SAMPLE = () => page.evaluate(() => {
  const T = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const tut = document.querySelector(".c-oreki-tut");
  const cur = ui.view.modal.current;
  return {
    t: Math.round((Date.now() - window.__t0) / 100) / 10,
    qCur: T(() => !!(ui.view.quotes || {}).current),
    qLeft: T(() => ((ui.view.quotes || {}).queue || []).length),
    qLine: T(() => {
      const el = document.querySelector("[data-v-celesial-quote-line] .l-modal-celestial-quote__text");
      return el ? el.textContent.trim().slice(0, 30) : null;
    }),
    nQuote: T(() => document.querySelectorAll("[data-v-celestial-quote-modal]").length, 0),
    nModal: T(() => document.querySelectorAll(".c-modal").length, 0),
    cur: T(() => (cur ? (cur.component?.name || "anon") : null)),
    qNames: T(() => (ui.view.modal.queue || []).map(m => `${m.component?.name || "anon"}#${m.priority}`).join("|")),
    tutNodes: T(() => (tut ? tut.querySelectorAll("*").length : 0), 0),
    tutTitle: T(() => (tut?.querySelector(".c-oreki-tut__head-title")?.textContent || "").trim(), ""),
    realities: T(() => player.realities),
  };
});

await sleep(10000);
console.log(`[open] t=${now()} ok=${await page.evaluate(() => { try { Modal.orekiTutorial.show(); return true; } catch (e) { return String(e.message); } })}`);
await sleep(1000);
push(await SAMPLE());

// ── 等引文
let appeared = null;
while (Date.now() - T0 < MAX_WAIT_QUOTE_MS) {
  const s = await SAMPLE();
  push(s);
  if (s.qCur) { appeared = s; break; }
  await sleep(400);
}
if (!appeared) {
  console.log("[MISS] 引文未出现");
  fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify({ tag: TAG, verdict: "未捕获", pageErrors: errors.length }, null, 1));
  await cleanup(); server.close(); process.exit(0);
}
console.log(`[quote] t=${appeared.t} 首行="${appeared.qLine}" 队列剩余=${appeared.qLeft} qNames=${appeared.qNames} nModal=${appeared.nModal}`);
await page.screenshot({ path: path.join(HERE, `${TAG}-appear.png`) });

// ── 点空引文队列（真实鼠标点击；先看 close 是否可见，可见就点 close，否则点右箭头）
let clicks = 0, endT = null;
const budget = 60;   // v2：qLeft 会随每次关闭「再解锁下一条」，不能按初始队列长度算
const log = [];
const drainDeadline = Date.now() + 180000;
while (clicks < budget && Date.now() < drainDeadline) {
  const target = await page.evaluate(() => {
    const q = ui.view.quotes || {};
    const out = {
      qCur: !!q.current,
      qLeft: (q.queue || []).length,
      nModal: document.querySelectorAll(".c-modal").length,
    };
    const end = document.querySelector(".c-modal-celestial-quote__end");
    if (end) { const r = end.getBoundingClientRect(); if (r.width > 0) return { ...out, sel: "end", x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    const right = document.querySelector(".c-modal-celestial-quote__arrow-right");
    if (right) { const r = right.getBoundingClientRect(); if (r.width > 0) return { ...out, sel: "right", x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    const txt = document.querySelector("[data-v-celesial-quote-line] .l-modal-celestial-quote__text");
    if (txt) { const r = txt.getBoundingClientRect(); return { ...out, sel: "text", x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    return { ...out, sel: null };
  });
  if (!target.sel) { await sleep(200); continue; }
  await page.mouse.click(target.x, target.y);
  clicks++;
  await sleep(120);
  log.push({ n: clicks, sel: target.sel, t: now(), qCur: target.qCur, qLeft: target.qLeft, nModal: target.nModal });
  if (!target.qCur) { endT = now(); break; }
  if (clicks % 10 === 0) push(await SAMPLE());
}
if (endT === null) {
  const s = await SAMPLE();
  push(s);
  log.push({ n: clicks, sel: "final", t: s.t, qCur: s.qCur, qLeft: s.qLeft, nModal: s.nModal });
  if (!s.qCur) endT = s.t;
}
console.log(`[drain] clicks=${clicks} budget=${budget} ended=${endT !== null}`, JSON.stringify(log));

// ── 恢复观察
let verdict = "未结束", latency = null, back = null;
if (endT !== null) {
  const rStart = Date.now();
  while (Date.now() - rStart < RECOVER_WINDOW_MS) {
    const s = await SAMPLE();
    push(s);
    if (s.nModal > 0 && s.cur === "OrekiTutorialModal") { back = s; latency = Math.round((s.t - endT) * 10) / 10; break; }
    await sleep(100);
  }
  if (back) verdict = latency <= 2 ? "会回来，不修" : "回来但超 2 s";
  else verdict = "软锁";
}
console.log(`[recover] verdict=${verdict} latency=${latency}s back=${JSON.stringify(back)}`);

const mon = await page.evaluate(() => window.__mon || []);
let timing = null;
{
  // 从「最后一次引文开着」往后找：先找引文关闭，再找 modal 层带着 OrekiTutorialModal 回来
  let lastOn = -1;
  for (let i = 0; i < mon.length; i++) if (mon[i].sig.startsWith("1|")) lastOn = i;
  if (lastOn >= 0) {
    let off = -1, back = -1;
    for (let i = lastOn + 1; i < mon.length; i++) if (mon[i].sig.startsWith("0|")) { off = i; break; }
    if (off >= 0) {
      for (let i = off; i < mon.length; i++) {
        const p = mon[i].sig.split("|");
        if (p[0] === "0" && Number(p[2]) > 0 && p[3] === "OrekiTutorialModal") { back = i; break; }
      }
    }
    timing = {
      lastQuoteOnAt: mon[lastOn].t,
      quoteOffAt: off >= 0 ? mon[off].t : null,
      modalBackAt: back >= 0 ? mon[back].t : null,
      latencyS: (off >= 0 && back >= 0) ? Math.round((mon[back].t - mon[off].t) * 10) / 10 : null,
      sigOff: off >= 0 ? mon[off].sig : null,
      sigBack: back >= 0 ? mon[back].sig : null,
    };
  }
}

const out = {
  tag: TAG, timing, monCount: mon.length,
  verdict, latencyS: latency, quoteAt: appeared.t, qLeftAtQuote: appeared.qLeft,
  qNamesAtQuote: appeared.qNames, clicks, budget, endedAt: endT, drainLog: log,
  back, pageErrors: errors.length,
  lastRow: rows.at(-1),
};
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await cleanup();
server.close();
process.exit(0);
