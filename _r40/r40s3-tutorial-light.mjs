// [R40-S3 补充] 教程开着 + 轻采样 → 到 gameEnd 要多久？
//
// 为什么还要再跑一次：`r40s3-tutorial-open-run.mjs` 那两组是重采样（每秒一次
// `strategy.evaluate()` + 多次 DOM 查询），实测把通关时间拉长了 10–15%（见报告 §5）。
// 判据 3「关闭后 900 s 内 gameEnd」在这种开销下必然失败，但失败是测量造成的。
// 本脚本把采样压到 9 个字段（与 pelle-probe 同量级），其余行为与教程组完全一致：
//   第 10 s `Modal.orekiTutorial.show()` → 保持到 310 s → `Modal.hide()` → 跑到 gameEnd 或 900 s。
//
// 用法：node _tools/_r40/r40s3-tutorial-light.mjs [秒=900]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8892);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9392);
const MAX_SEC = Number(process.argv[2]) || 900;
const TAG = "r40s3-tutorial-light";
const OPEN_AT_MS = 10000;
const CLOSE_AT_MS = 310000;

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
await page.evaluate(() => { window.__t0 = Date.now(); });

// 9 个字段，跟 pelle-probe 同量级
const SAMPLE = () => page.evaluate(() => {
  const T = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  return {
    t: Math.round((Date.now() - window.__t0) / 100) / 10,
    realities: T(() => player.realities),
    doomed: T(() => Pelle.isDoomed === true),
    gameEnd: T(() => player.isGameEnd === true),
    endState: T(() => Math.round(GameEnd.endState * 1e6) / 1e6),
    amE: T(() => Number(player.antimatter.exponent)),
    totAML: T(() => { const v = player.celestials.pelle.records.totalAntimatter; return v ? Math.round(v.log10() * 1e3) / 1e3 : null; }),
    tutOpen: T(() => !!document.querySelector(".c-oreki-tut")),
    tutNodes: T(() => { const e = document.querySelector(".c-oreki-tut"); return e ? e.querySelectorAll("*").length : 0; }, 0),
    smDeg: T(() => OrekiSmartStrategy.evaluate().degraded),
  };
});

const JSONL = path.join(HERE, `${TAG}.jsonl`);
fs.writeFileSync(JSONL, "");
const rows = [];
const T0 = Date.now();
let opened = false, closed = false, closedAt = null;

while (Date.now() - T0 < MAX_SEC * 1000) {
  const el = Date.now() - T0;
  if (!opened && el >= OPEN_AT_MS) {
    const r = await page.evaluate(() => { try { Modal.orekiTutorial.show(); return true; } catch (e) { return String(e.message); } });
    opened = true;
    console.log(`[open] t=${(el / 1000).toFixed(1)} ok=${r}`);
  }
  if (opened && !closed && el >= CLOSE_AT_MS) {
    const r = await page.evaluate(() => { try { Modal.hide(); return ui.view.modal.queue.length; } catch (e) { return String(e.message); } });
    closed = true;
    closedAt = Math.round(el / 100) / 10;
    console.log(`[close] t=${closedAt} left=${r}`);
  }
  const s = await SAMPLE();
  rows.push(s);
  fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (s.gameEnd === true) {
    console.log(`[gameEnd] t=${s.t} endState=${s.endState}`);
    break;
  }
  await new Promise(r => setTimeout(r, 1000));
}

const last = rows.at(-1) || {};
const endAt = rows.find(r => r.gameEnd === true)?.t ?? null;
const tut = rows.filter(r => r.t >= 10 && r.t <= 310);
const out = {
  tag: TAG, samples: rows.length, lastT: last.t, closedAt,
  gameEndAt: endAt, endStateLast: last.endState, realitiesLast: last.realities,
  doomedAt: rows.find(r => r.doomed === true)?.t ?? null,
  tutOpenSamples: tut.filter(r => r.tutOpen).length, tutTotalSamples: tut.length,
  tutNodesMin: tut.length ? Math.min(...tut.map(r => r.tutNodes)) : null,
  smDegSamples: rows.filter(r => r.smDeg === true).length,
  pageErrors: errors.length,
  milestone: [5, 10, 15, 20, 25, 30, 40, 60, 80, 100].reduce((acc, k) => {
    const hit = rows.find(r => (r.realities || 0) >= k);
    acc[k] = hit ? hit.t : null;
    return acc;
  }, {}),
};
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(out, null, 1));
await cleanup();
server.close();
process.exit(0);
