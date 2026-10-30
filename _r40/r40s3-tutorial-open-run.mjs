// [R40-S3] 「教程开着时游戏还照常推进吗」——对照实验
//
// ── 为什么必须做 ────────────────────────────────────────────────────────
// 我们只分别验过两件事：① headless 跑 708.1 s 通关；② 教程能打开、能保持 6 s。
// 从没验过**玩家开着教程边看边玩**（真实场景）时游戏是否照常推进。
// 如果教程会压制主循环 / 让执行层停摆 / 让 gameEnd 判定不触发，708 s 的结论对真实用户无效。
//
// ── 两组，同一份代码 ────────────────────────────────────────────────────
//   mode=tutorial：第 10 s 打开教程（真实入口 `Modal.orekiTutorial.show()`），保持到第 310 s，
//                  期间不动任何按钮；310 s 拍快照后关闭，继续跑到 gameEnd 或 900 s。
//   mode=control ：全程不开教程，同样跑到 gameEnd 或 900 s。
//   两组端口不同（见下），可并行跑，互不干扰。
//
// ── 判据（team-lead 2026-10-31 定，缺一条算失败）────────────────────────
//   1. 10 s→310 s 之间 `totAML` 必须增长，量与对照组同量级
//   2. 教程 300 s 内章节标题不变、`tutNodes` 全程 > 0（不能退回 C.37 那个坑）
//   3. 关闭后到 `gameEnd` 的总墙钟 ≤ 900 s
//   4. 全程 `pageErrors=0`、`smDeg=true` 的样本数 = 0
//
// 用法：
//   node _tools/_r40/r40s3-tutorial-open-run.mjs tutorial
//   node _tools/_r40/r40s3-tutorial-open-run.mjs control
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const MODE = (process.argv[2] || "tutorial").toLowerCase() === "control" ? "control" : "tutorial";
const TAG = process.argv[3] || `r40s3-${MODE}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || (MODE === "tutorial" ? 8887 : 8888));
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || (MODE === "tutorial" ? 9387 : 9388));
const MAX_SEC = Number(process.argv[4]) || 900;   // 只跑到这么多秒（判据 2 只需 320 s）
const MAX_MS = MAX_SEC * 1000;
const OPEN_AT_MS = 10 * 1000;
const KEEP_OPEN_MS = 300 * 1000;      // 打开到关闭：10 s → 310 s
const SAMPLE_MS = 1000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};
const JSONL = path.join(HERE, `${TAG}.jsonl`);
const OUT = path.join(HERE, `${TAG}.json`);

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
console.log(`[serve] mode=${MODE} port=${PORT} cdp=${EDGE_PORT}`);

const { browser, cleanup } = await launchBrowser({ port: EDGE_PORT });
const { page, errors } = await openGame(browser, { port: PORT });
const consoleErr = [];
page.on("console", m => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 240)); });

// ── 全新档
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof globalThis.player !== "undefined" && !!globalThis.OrekiSmartExecutor,
  { timeout: 60000 });
await page.evaluate(() => {
  window.__r40T0 = Date.now();
  // 记录最后一条 message 弹窗：教程被顶掉时，顶它的那条文本就是原因
  try {
    const orig = Modal.message.show.bind(Modal.message);
    Modal.message.show = (text, props, pr) => {
      window.__r40LastMsg = { at: Math.round((Date.now() - window.__r40T0) / 100) / 10, text: String(text).slice(0, 120), pr };
      return orig(text, props, pr);
    };
  } catch (e) { /* ignore */ }
});
const T0 = Date.now();
fs.writeFileSync(JSONL, "");

const SAMPLE = () => page.evaluate(() => {
  const T = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return null; } };
  const s = globalThis.OrekiSmartStrategy, x = globalThis.OrekiSmartExecutor;
  const st = T(() => s.debugState()) || {};
  const ex = T(() => x.debugState()) || {};
  const d = T(() => s.evaluate()) || {};
  const tut = document.querySelector(".c-oreki-tut");
  const totAM = T(() => player.celestials.pelle.records.totalAntimatter);
  return {
    t: Math.round((Date.now() - window.__r40T0) / 100) / 10,
    // 推进
    totAML: T(() => (totAM ? Math.round(totAM.log10() * 1e3) / 1e3 : null)),
    endState: T(() => Number(GameEnd.endState.toFixed(6))),
    gameEnd: T(() => player.isGameEnd === true),
    amE: T(() => Number(player.antimatter.exponent)),
    realities: T(() => player.realities),
    doomed: T(() => Pelle.isDoomed === true),
    brk: T(() => player.break === true),
    ecTarget: T(() => globalThis.OrekiDilationAutomation?._targetEc?.() ?? null),
    // 策略 / 执行层
    smStage: d.stage?.id ?? null,
    smGoal: d.goal?.id ?? null,
    smDeg: d.degraded ?? null,
    smDegN: st.degradedCount ?? null,
    smErr: st.lastError || "",
    exActN: ex.actionCount ?? null,
    exTryN: ex.attemptCount ?? null,
    // 面板七项（与面板同源，取 debugState 而不是 DOM：教程开着时不能切页签）
    panel: {
      stage: d.stage?.title ?? "",
      goal: d.goal?.title ?? "",
      strategy: d.strategy?.title ?? "",
      action: ex.action ? `${ex.action.label}|${ex.action.source}|${ex.action.acted ? 1 : 0}` : "",
      next: ex.next?.label ?? "",
      blockers: (d.blockers ?? []).map(b => b.id).join("|") || `无（已检查 ${st.blockersDeclared ?? "?"} 项）`,
      switch: ex.lastSwitch ? `${ex.lastSwitch.from ?? ""}>${ex.lastSwitch.to}` : "",
    },
    // 教程现场（C.37 的坑：节点在不在、标题稳不稳）
    tutOpen: !!tut && tut.offsetParent !== null,
    tutNodes: tut ? tut.querySelectorAll("*").length : 0,
    tutTitle: tut ? (tut.querySelector(".c-oreki-tut__head-title")?.textContent || "").trim() : "",
    // 谁在弹窗队列里（C.37 的取证方式：看队列顺序，而不是只看「有没有关闭」）
    queue: T(() => (ui.view.modal.queue || []).map(mm => {
      const c = mm.component;
      const n = c?.name || c?.__name || c?.render?.name || "anon";
      return `${n}#${mm.priority}`;
    }).join("|")),
    curModal: T(() => {
      const cur = ui.view.modal.current;
      if (!cur) return null;
      const c = cur.component;
      return `${c?.name || c?.__name || "anon"}#${cur.priority}`;
    }),
    lastMsg: T(() => window.__r40LastMsg || null),
  };
});

const rows = [];
let openedAt = null, closedAt = null, snapshot310 = null, closed = MODE === "control";

while (Date.now() - T0 < MAX_MS) {
  const elapsed = Date.now() - T0;
  if (MODE === "tutorial" && openedAt === null && elapsed >= OPEN_AT_MS) {
    const r = await page.evaluate(() => {
      try { Modal.orekiTutorial.show(); return { ok: true }; } catch (e) { return { ok: false, why: String(e.message) }; }
    });
    openedAt = Math.round(elapsed / 100) / 10;
    console.log(`[open] t=${openedAt}s ${JSON.stringify(r)}`);
  }
  if (MODE === "tutorial" && !closed && openedAt !== null && elapsed - openedAt * 1000 >= KEEP_OPEN_MS - OPEN_AT_MS) {
    // 310 s 快照（此刻教程仍开着）
    snapshot310 = await SAMPLE();
    const r = await page.evaluate(() => {
      // 实例上没有 hide：Modal 的 hide/hideAll 是**静态**方法（modal.js:159/167）
      try { Modal.hide(); return { ok: true, left: ui.view.modal.queue.length }; } catch (e) { return { ok: false, why: String(e.message) }; }
    });
    closedAt = Math.round(elapsed / 100) / 10;
    closed = true;
    console.log(`[close] t=${closedAt}s ${JSON.stringify(r)}`);
  }
  const s = await SAMPLE();
  rows.push(s);
  fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (s.gameEnd === true) {
    console.log(`[gameEnd] t=${s.t}`);
    break;
  }
  await new Promise(r => setTimeout(r, SAMPLE_MS));
}

// ── 汇总
const last = rows[rows.length - 1] ?? {};
const first = rows[0] ?? {};
const at = t => [...rows].reverse().find(r => r.t <= t) ?? null;
const r10 = at(10), r310 = at(310);
const growth = (a, b) => (a?.totAML != null && b?.totAML != null) ? Math.round((b.totAML - a.totAML) * 1e3) / 1e3 : null;
const tutRows = rows.filter(r => r.t >= 10 && r.t <= 310);
const titles = [...new Set(tutRows.map(r => r.tutTitle))];
const endT = rows.find(r => r.gameEnd === true)?.t ?? null;
const summary = {
  mode: MODE,
  tag: TAG,
  samples: rows.length,
  lastT: last.t,
  gameEndAt: endT,
  // 判据 1
  totAML_at10: r10?.totAML ?? null,
  totAML_at310: r310?.totAML ?? null,
  growth10_310: growth(r10, r310),
  endStateAt310: r310?.endState ?? null,
  // 判据 2
  tutOpenSamples: tutRows.filter(r => r.tutOpen === true).length,
  tutTotalSamples: tutRows.length,
  tutNodesMin: tutRows.length ? Math.min(...tutRows.map(r => r.tutNodes)) : null,
  tutTitlesSeen: titles,
  titleStable: titles.length === 1 && titles[0] !== "",
  // 判据 3
  closedAt,
  // 判据 4
  pageErrors: errors.length,
  pageErrorSample: errors.slice(0, 2),
  consoleErrors: consoleErr.length,
  consoleErrorSample: consoleErr.slice(0, 2),
  smDegSamples: rows.filter(r => r.smDeg === true).length,
  smErrLast: last.smErr || "",
  // 现场
  stagePath: [...new Set(rows.map(r => r.smStage))],
  amE_last: last.amE, realities_last: last.realities, doomed_last: last.doomed,
  exActN_last: last.exActN, exTryN_last: last.exTryN,
  panel310: snapshot310?.panel ?? null,
  // 每 60 s 的曲线（两组对比用）
  curve: rows.filter(r => Math.round(r.t) % 60 === 0).map(r => ({ t: r.t, totAML: r.totAML, endState: r.endState, stage: r.smStage })),
};
console.log(JSON.stringify(summary, null, 1));
fs.writeFileSync(OUT, JSON.stringify(summary, null, 1));

await cleanup();
server.close();
process.exit(0);
