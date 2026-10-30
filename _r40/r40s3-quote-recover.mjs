// [R40-S3 追加] 天神引文层结束后，被顶掉的 modal 层会不会回来？（team-lead 2026-10-31 派）
//
// 要回答的只有一个问题：引文把整片弹窗层顶掉之后，等引文结束（自然结束 or 玩家真点掉），
// `PopupModal` 会不会重新渲染、`cur` 会不会回到 `OrekiTutorialModal`。
// 判据（team-lead 写死）：
//   `view.quotes.current` 由非空变 null 之后 ≤ 2 s 内 `nModal > 0` 且 `cur === "OrekiTutorialModal"` → 会回来
//   10 s 仍是 0 → 软锁，必修
//
// 两条路径都测：
//   A 自然结束：什么都不点，等 12 s（引文是多行的，正常需要玩家翻页，所以预期不会自己结束 —— 预期也要写进结论）
//   B 真点掉  ：先截图存证 + 打印可点元素的 bounding box，再用真实鼠标点击（不是 evaluate 里调函数）
//
// 用法：node _tools/_r40/r40s3-quote-recover.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8893);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9393);
const TAG = process.argv[2] || "r40s3-quote-recover";
const MAX_WAIT_QUOTE_MS = 420000;   // 引文实测落在 228~264 s，给足余量
const NATURAL_WINDOW_MS = 12000;    // 路径 A 观察窗口
const RECOVER_WINDOW_MS = 12000;    // 引文结束后观察窗口（判据 2 s 回来 / 10 s 算软锁）

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
const consoleErr = [];
page.on("console", m => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 200)); });

await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof globalThis.player !== "undefined" && !!globalThis.Modal, { timeout: 60000 });
await page.evaluate(() => { window.__t0 = Date.now(); });

const JSONL = path.join(HERE, `${TAG}.jsonl`);
fs.writeFileSync(JSONL, "");
const rows = [];
const ms = () => Math.round((Date.now() - T0) / 100) / 10;
const T0 = Date.now();
const sleep = n => new Promise(r => setTimeout(r, n));

const SAMPLE = () => page.evaluate(() => {
  const T = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  const tut = document.querySelector(".c-oreki-tut");
  const cur = ui.view.modal.current;
  return {
    t: Math.round((Date.now() - window.__t0) / 100) / 10,
    qCur: T(() => !!(ui.view.quotes || {}).current),
    qLine: T(() => {
      const el = document.querySelector("[data-v-celesial-quote-line] .l-modal-celestial-quote__text");
      return el ? el.textContent.trim().slice(0, 40) : null;
    }),
    nQuote: T(() => document.querySelectorAll("[data-v-celestial-quote-modal]").length, 0),
    nModal: T(() => document.querySelectorAll(".c-modal").length, 0),
    nChoice: T(() => document.querySelectorAll("[data-v-modal-wrapper-choice]").length, 0),
    nMsg: T(() => document.querySelectorAll(".c-modal-message").length, 0),
    cur: T(() => (cur ? (cur.component?.name || "anon") : null)),
    qNames: T(() => (ui.view.modal.queue || []).map(m => `${m.component?.name || "anon"}#${m.priority}`).join("|")),
    tutNodes: T(() => (tut ? tut.querySelectorAll("*").length : 0), 0),
    tutTitle: T(() => (tut?.querySelector(".c-oreki-tut__head-title")?.textContent || "").trim(), ""),
    realities: T(() => player.realities),
  };
});

const push = s => { rows.push(s); fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); };

// ── 开教程
await sleep(10000);
const openRes = await page.evaluate(() => { try { Modal.orekiTutorial.show(); return true; } catch (e) { return String(e.message); } });
console.log(`[open] t=${ms()} ok=${openRes}`);
await sleep(1200);
push(await SAMPLE());

// ── 等引文自然出现
let appeared = null;
const waitUntil = Date.now() + MAX_WAIT_QUOTE_MS;
while (Date.now() < waitUntil) {
  const s = await SAMPLE();
  push(s);
  if (s.qCur) { appeared = s; break; }
  await sleep(400);
}
if (!appeared) {
  console.log(`[MISS] 引文在 ${MAX_WAIT_QUOTE_MS / 1000}s 内没有出现`);
  fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify({ tag: TAG, verdict: "未捕获", pageErrors: errors.length }, null, 1));
  await cleanup(); server.close(); process.exit(0);
}
console.log(`[quote] t=${appeared.t} 首行="${appeared.qLine}" qNames=${appeared.qNames} nModal=${appeared.nModal} tutNodes=${appeared.tutNodes}`);

// 存证：先截图，再打印当时所有可点元素的位置（不猜坐标）
await page.screenshot({ path: path.join(HERE, `${TAG}-a-appear.png`) });
const clickables = await page.evaluate(() => {
  const sel = [".c-modal-celestial-quote__arrow-right", ".c-modal-celestial-quote__end",
    ".c-modal-celestial-quote__arrow-left", ".c-oreki-tut", ".l-modal-overlay"];
  return sel.map(s => {
    const el = document.querySelector(s);
    if (!el) return { s, found: false };
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return { s, found: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      w: Math.round(r.width), h: Math.round(r.height), display: st.display, visibility: st.visibility, opacity: st.opacity };
  });
});
console.log("[clickables]", JSON.stringify(clickables));

// ── 路径 A：不干预，看它会不会自己结束
const aStart = Date.now();
let naturalEnd = null;
while (Date.now() - aStart < NATURAL_WINDOW_MS) {
  const s = await SAMPLE();
  push(s);
  if (!s.qCur) { naturalEnd = { endT: s.t, samplesSoFar: rows.length }; break; }
  await sleep(200);
}
console.log(`[A natural] ${naturalEnd ? `自己结束了 @${naturalEnd.endT}` : `${NATURAL_WINDOW_MS / 1000}s 内没有自己结束（预期：多行引文要人翻）`}`);

// ── 路径 B：真点击（鼠标点 bounding box 中心），一直点到 close 出现再点 close
let clicks = 0;
let closedByClick = false;
let endT = null;
const clickLog = [];
for (let i = 0; i < 12 && !closedByClick; i++) {
  const target = await page.evaluate(() => {
    const end = document.querySelector(".c-modal-celestial-quote__end");
    if (end) { const r = end.getBoundingClientRect(); return { sel: "end", x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    const right = document.querySelector(".c-modal-celestial-quote__arrow-right");
    if (right) { const r = right.getBoundingClientRect(); return { sel: "right", x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    return null;
  });
  if (!target) { await sleep(300); continue; }
  if (target.sel === "end") await page.screenshot({ path: path.join(HERE, `${TAG}-b-lastline.png`) });
  await page.mouse.click(target.x, target.y);
  clicks++;
  await sleep(350);
  const s = await SAMPLE();
  push(s);
  clickLog.push({ sel: target.sel, t: s.t, qCur: s.qCur, qNames: s.qNames, nModal: s.nModal });
  if (!s.qCur) { closedByClick = true; endT = s.t; }
}
console.log(`[B click] clicks=${clicks} closed=${closedByClick}`, JSON.stringify(clickLog));

// ── 恢复观察：引文结束后 modal 层多久回来
let recover = { verdict: "未结束" };
if (closedByClick) {
  const rStart = Date.now();
  let firstBack = null;
  while (Date.now() - rStart < RECOVER_WINDOW_MS) {
    const s = await SAMPLE();
    push(s);
    if (s.nModal > 0 && s.cur === "OrekiTutorialModal") { firstBack = s; break; }
    await sleep(100);
  }
  const latency = firstBack ? Math.round((firstBack.t - endT) * 10) / 10 : null;
  recover = firstBack
    ? { verdict: latency <= 2 ? "会回来，不修" : "回来但超 2 s", latencyS: latency, back: firstBack }
    : { verdict: "软锁", latencyS: null, last: rows.at(-1) };
}
console.log("[recover]", JSON.stringify(recover));

const out = {
  tag: TAG, verdict: recover.verdict, latencyS: recover.latencyS ?? null,
  quoteAt: appeared.t, quoteLine: appeared.qLine, qNamesAtQuote: appeared.qNames,
  naturalEnd, clickLog, clicks, closedByClick,
  clickables, pageErrors: errors.length, consoleErrors: consoleErr.length,
  consoleErrSample: consoleErr.slice(0, 1),
  recoverDetail: recover,
};
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await cleanup();
server.close();
process.exit(0);
