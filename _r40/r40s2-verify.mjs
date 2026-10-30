// [R40-S2] 执行层四条验收（team-lead 2026-10-31 指定）：
//   ① 200 s 全新档：smOk / smDeg / smDegN / smErr + 面板七项齐全 + 控制台报错条数
//   ② 「同帧不抢」：接管时该 source 本帧摘要必须为空（计 takeoverWhileModuleActed，应为 0）
//   ③ 手动优先：点一次购买区 → 当前 goal 停 60 s、面板显示剩余秒数、其它 goal 不受影响
//   ④ 面板不显示任何预测值（只有实测态）
//
// 全新档：localStorage.clear() + reload（与 pelle-probe.mjs:190 同一手法）。
// 端口固定 8886 / 9386，避免和队里其它长跑抢 8884 / 9374。
//
// 用法：node _tools/_r40/r40s2-verify.mjs [秒=200] [tag]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 200) * 1000;
const TAG = process.argv[3] || `r40s2-verify-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8886);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9386);
const HOLD_PROBE_MS = 70000;
const CLICK_AT_MS = Math.max(20000, DURATION - HOLD_PROBE_MS);

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
console.log(`[serve] ${PORT} cdp=${EDGE_PORT} dur=${DURATION / 1000}s clickAt=${CLICK_AT_MS / 1000}s`);

const { browser, cleanup } = await launchBrowser({ port: EDGE_PORT });
const { page, errors } = await openGame(browser, { port: PORT });

// 控制台：本模块相关（含 sm/ex/oreki/smart 关键字）+ 全量 pageerror
const consoleAll = [];
const consoleRelevant = [];
page.on("console", m => {
  const type = m.type();
  if (type !== "error" && type !== "warning") return;
  const text = m.text();
  consoleAll.push({ type, text: text.slice(0, 300) });
  if (/oreki|smart|executor|OrekiSmart/i.test(text)) consoleRelevant.push({ type, text: text.slice(0, 300) });
});

// ── 全新档
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof globalThis.player !== "undefined" && !!globalThis.OrekiSmartExecutor, { timeout: 60000 });
await page.evaluate(() => { window.__r40T0 = Date.now(); });
const T0 = Date.now();

const SAMPLE = () => page.evaluate(() => {
  const T = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return null; } };
  const s = globalThis.OrekiSmartStrategy, e = globalThis.OrekiSmartExecutor;
  const st = T(() => s.debugState()) || {};
  const ex = T(() => e.debugState()) || {};
  const d = T(() => s.evaluate()) || {};
  return {
    t: Math.round((Date.now() - window.__r40T0) / 100) / 10,
    // ① 解释器
    smOk: d.ok ?? null,
    smDeg: d.degraded ?? null,
    smDegN: st.degradedCount ?? null,
    smErr: st.lastError || "",
    stage: d.stage?.id ?? null,
    goal: d.goal?.id ?? null,
    score: d.strategy?.id ?? null,
    // 面板七项（空串/空数组都算缺）
    panel: {
      stage: d.stage?.title ?? "",
      goal: d.goal?.title ?? "",
      strategy: d.strategy?.title ?? "",
      action: ex.action ? `${ex.action.label}|${ex.action.source}|${ex.action.acted ? 1 : 0}` : "",
      next: ex.next?.label ?? "",
      blockers: (d.blockers ?? []).map(b => b.id).join("|"),
      switch: ex.lastSwitch ? `${ex.lastSwitch.from ?? ""}>${ex.lastSwitch.to}` : "",
    },
    // ② 同帧不抢
    takeovers: ex.takeovers ?? null,
    conflict: ex.takeoverWhileModuleActed ?? null,
    actN: ex.actionCount ?? null,
    tryN: ex.attemptCount ?? null,
    idle: ex.idle ?? null,
    // ③ 手动优先
    holdGoal: ex.manualHold?.goalId ?? null,
    holdSec: ex.manualHold?.remainSec ?? null,
    // 现场
    doomed: T(() => Pelle.isDoomed === true),
    brk: T(() => player.break === true),
    amE: T(() => Number(player.antimatter.exponent)),
    realities: T(() => player.realities),
    spd: (() => { try { return localStorage.getItem("oreki-game-speed"); } catch (e) { return null; } })(),
    gameEnd: T(() => player.isGameEnd === true),
    eErr: T(() => globalThis.OrekiEndgameAutomation?._lastError || ""),
  };
});

const rows = [];
fs.writeFileSync(JSONL, "");
let clickReport = null;

while (Date.now() - T0 < DURATION) {
  const s = await SAMPLE();
  rows.push(s);
  fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");

  if (!clickReport && Date.now() - T0 >= CLICK_AT_MS) {
    const before = await page.evaluate(() => ({
      actN: globalThis.OrekiSmartExecutor.debugState().actionCount,
      goal: globalThis.OrekiSmartStrategy.evaluate().goal?.id ?? null,
    }));
    // 手动点一次「购买区」：优先找文字里带「买」的可见按钮，且不在设置/教程覆盖层里
    const clicked = await page.evaluate(() => {
      const bad = n => n.closest(".l-options-grid") || n.closest(".c-oreki-tutorial") || n.closest(".c-modal");
      const cands = [...document.querySelectorAll("#ui button, #ui .o-primary-btn, #ui [class*='buy']")]
        .filter(n => n.offsetParent !== null && !bad(n));
      const hit = cands.find(n => /买|购买|Buy/.test(n.textContent || "")) || cands[0];
      if (!hit) return { ok: false, why: "no-candidate", n: cands.length };
      const text = (hit.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
      hit.click();
      return { ok: true, text, cls: String(hit.className).slice(0, 60) };
    });
    clickReport = { at: Math.round((Date.now() - T0) / 100) / 10, before, clicked, series: [] };
    // 之后 70 s 每秒记一次 hold / 动作数
    const t0 = Date.now();
    while (Date.now() - t0 < HOLD_PROBE_MS) {
      await new Promise(r => setTimeout(r, 1000));
      const s2 = await SAMPLE();
      rows.push(s2);
      fs.appendFileSync(JSONL, JSON.stringify(s2) + "\n");
      clickReport.series.push({
        t: s2.t, goal: s2.goal, holdGoal: s2.holdGoal, holdSec: s2.holdSec,
        actN: s2.actN, stage: s2.stage,
      });
    }
    break;
  }
  await new Promise(r => setTimeout(r, 1000));
}

// ── 面板取证（同一页面，同一存档）
const nav = await page.evaluate(() => {
  try {
    const opt = Tab.options;
    const sub = opt.subtabs.find(s => s.key === "gameplay" || s.id === 2);
    window.__r40Nav = () => { opt.show(true); sub.show(true); };
    window.__r40Nav();
    window.__r40NavTimer = setInterval(window.__r40Nav, 200);
    return { ok: true };
  } catch (e) { return { ok: false, why: String(e.message) }; }
});
await new Promise(r => setTimeout(r, 2000));
const panel = await page.evaluate(() => {
  try { clearInterval(window.__r40NavTimer); } catch (e) { /* ignore */ }
  const el = document.querySelector(".c-oreki-smart__panel");
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  return {
    found: true,
    lines: [...el.querySelectorAll(".c-oreki-smart__line")].map(n => n.innerText.replace(/\s+/g, " ").trim()),
    rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
    overflowX: el.scrollWidth > el.clientWidth,
  };
});
const shot = path.join(HERE, `${TAG}-panel.png`);
try {
  const h = await page.$(".c-oreki-smart__panel");
  if (h) await h.screenshot({ path: shot });
  else await page.screenshot({ path: shot });
} catch (e) { /* ignore */ }

// ── 汇总
const last = rows[rows.length - 1] ?? {};
const panelKeys = ["stage", "goal", "strategy", "action", "next", "blockers", "switch"];
const panelMissing = panelKeys.filter(k => !last.panel || last.panel[k] === "");
const conflicts = rows.reduce((m, r) => Math.max(m, r.conflict ?? 0), 0);
const takeovers = rows.reduce((m, r) => Math.max(m, r.takeovers ?? 0), 0);
const holdSamples = (clickReport?.series ?? []).filter(x => x.holdGoal);
const actDuringHold = (() => {
  const ser = clickReport?.series ?? [];
  const first = ser.find(x => x.holdGoal);
  if (!first) return null;
  const lastHold = [...ser].reverse().find(x => x.holdGoal);
  const idxFirst = ser.indexOf(first), idxLast = ser.indexOf(lastHold);
  // ⚠ 上一版这里写成 `idxFirst.actN ?? 0`（拿下标当对象用），把 4-4 算成了 4-0 = 4，
  // 差点报成「hold 期间照样动手」。现在按样本逐个走一遍：hold>0 的相邻两帧里 actN 有任何增长都算违例。
  const delta = (ser[idxLast].actN ?? 0) - (ser[idxFirst].actN ?? 0);
  const violations = [];
  for (let i = 1; i < ser.length; i++) {
    const a = ser[i - 1], b = ser[i];
    if ((b.holdSec ?? 0) > 0 && (a.actN ?? 0) !== (b.actN ?? 0)) {
      violations.push({ t: b.t, from: a.actN, to: b.actN, holdSec: b.holdSec });
    }
  }
  return {
    from: first.t, to: lastHold.t, delta,
    actNFirst: ser[idxFirst].actN, actNLast: ser[idxLast].actN,
    violations, samplesWithHold: holdSamples.length,
  };
})();
const summary = {
  tag: TAG,
  durationSec: last.t ?? null,
  samples: rows.length,
  // ①
  smOk: last.smOk, smDeg: last.smDeg, smDegN: last.smDegN, smErr: last.smErr,
  smDegSamples: rows.filter(r => r.smDeg === true).length,
  panelMissing,
  panelLines: panel.lines ?? null,
  panelFound: panel.found === true,
  panelRect: panel.rect ?? null,
  panelOverflowX: panel.overflowX ?? null,
  consoleRelevant: consoleRelevant.length,
  consoleRelevantSample: consoleRelevant.slice(0, 3),
  consoleAllErrors: consoleAll.filter(x => x.type === "error").length,
  consoleAll: consoleAll.slice(0, 6),
  pageErrors: errors.length,
  pageErrorSample: errors.slice(0, 2),
  // ②
  takeovers, takeoverWhileModuleActed: conflicts,
  // ③
  click: clickReport ? { at: clickReport.at, clicked: clickReport.clicked, before: clickReport.before } : null,
  holdSamples: holdSamples.length,
  holdFirstSec: holdSamples[0]?.holdSec ?? null,
  holdLastSec: holdSamples[holdSamples.length - 1]?.holdSec ?? null,
  actDuringHold,
  // ④
  hasPredictionText: /预计|预估|剩余时间|ETA/.test((panel.lines ?? []).join(" ")),
  // 现场
  stage: last.stage, goal: last.goal, strategy: last.score,
  doomed: last.doomed, brk: last.brk, amE: last.amE, realities: last.realities,
  spdSet: [...new Set(rows.map(r => r.spd))],
  gameEnd: rows.some(r => r.gameEnd === true),
  nav,
  screenshot: shot,
};
console.log(JSON.stringify(summary, null, 1));
fs.writeFileSync(OUT, JSON.stringify(summary, null, 1));

await cleanup();
server.close();
process.exit(0);
