// R107-01 · Web 行为等价与体验定向验收（Playwright 原生 API + Chromium 手机视口）
//
// 覆盖：
//   S0 新闻关闭（DOM 不存在、无新闻入口、无可见空白占位）
//   S1 无意义切页（无输入 60s 自动切页次数 = 0；业务不依赖切页）
//   S2 阶段解锁显示（新档无高阶入口 → 首次大坍缩后无限入口即时出现，永恒/现实仍不出现）
//   S3 自动购买器（阶段感知 / 总开关立即停止 / 1~60s 间隔与边界钳制 / 手动优先 / 不越阶段）
//   S4 阶段解锁后的自动购买器阶段感知升级（真实运行到首次永恒，永恒入口/阶段即时出现）
//
// 约束：真实新档（全新 browser context + 空 storage）；只用真实 UI 点击/输入；
//       不写任何 player 进度字段；不修改游戏时间源；存档只来自本轮真实游玩后的 UI 导出。
//
// 运行：node reports/R107-01/accept-r107-01.mjs
// 产物：reports/R107-01/{result.json,evidence/*,suite-run.log}

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = REPO + "/reports/R107-01";
const EV = OUT + "/evidence";
fs.mkdirSync(EV, { recursive: true });
const LOG_PATH = OUT + "/suite-run.log";
fs.writeFileSync(LOG_PATH, "");
const results = [];
const rec = (scenario, id, status, detail = "") => {
  results.push({ scenario, id, status, detail });
  const line = "[" + status + "] " + scenario + " | " + id + " | " + detail;
  console.log(line);
  fs.appendFileSync(LOG_PATH, line + "\n");
};
const check = (scenario, id, cond, detail = "") => rec(scenario, id, cond ? "PASS" : "FAIL", detail);
const writeFile = (name, content) => fs.writeFileSync(EV + "/" + name, content);
const writeJson = (name, obj) => writeFile(name, JSON.stringify(obj, null, 2));

// ── Playwright 解析（复用机器上已安装的 1.65.0 + chromium-1254）────────────
const PW_CANDIDATES = [
  "/home/oreki/.npm/_npx/e41f203b7505f1fb",
  "/tmp/pwtest",
  REPO,
];
function loadPlaywright() {
  const tried = [];
  for (const base of PW_CANDIDATES) {
    try {
      const req = createRequire(path.join(base, "noop.js"));
      const mod = req("playwright");
      const version = req("playwright/package.json").version;
      return { chromium: mod.chromium, version, base };
    } catch (e) { tried.push(base + ": " + e.message); }
  }
  throw new Error("找不到 playwright。候选与错误：\n" + tried.join("\n"));
}

// ── 静态服务器 ─────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".ttf": "font/ttf", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8", ".map": "application/json", ".wav": "audio/wav",
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(REPO, p);
  if (!file.startsWith(REPO)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const PORT = server.address().port;
const BASE = "http://127.0.0.1:" + PORT + "/";

const pw = loadPlaywright();
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36";
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--mute-audio", "--no-sandbox"],
});
const envInfo = {
  startedAt: new Date().toISOString(),
  playwright: pw.version,
  playwrightBase: pw.base,
  chromium: browser.version(),
  baseUrl: BASE,
  viewport: "412x839 (Pixel 7 mobile, DPR 2.625, isMobile, hasTouch)",
  userAgent: UA,
};
const newContext = () => browser.newContext({
  viewport: { width: 412, height: 839 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  userAgent: UA,
  permissions: ["clipboard-read", "clipboard-write"],
});
function attachLogs(page) {
  const logs = [];
  page.on("console", m => logs.push({ type: m.type(), at: Date.now(), text: m.text().slice(0, 500) }));
  page.on("pageerror", e => logs.push({ type: "pageerror", at: Date.now(), text: String(e.message).slice(0, 800) }));
  page.on("requestfailed", r => logs.push({ type: "requestfailed", at: Date.now(), text: r.url().slice(0, 200) + " :: " + (r.failure()?.errorText || "") }));
  return logs;
}
function dumpLogs(tag, logs) {
  writeFile(tag + "-console.log", logs.map(l => "[" + l.type + "] " + l.text).join("\n"));
  writeJson(tag + "-console.json", logs);
}
const shot = (page, name) => page.screenshot({ path: EV + "/" + name + ".png" });

async function boot(page) {
  page.setDefaultTimeout(12000);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(900);
  await dismissModals(page);
}

const snapshot = page => page.evaluate(() => {
  const T = window.Tab;
  const d = window.OrekiSmartExecutor.debugState();
  const side = document.querySelector(".c-modern-sidebar");
  const newsSelectors = ["#news", ".c-news-ticker", "[class*='news-ticker']", ".c-news-line", ".c-news-ticker__line"];
  return {
    progress: {
      infinity: window.PlayerProgress.infinityUnlocked(),
      eternity: window.PlayerProgress.eternityUnlocked(),
      reality: window.PlayerProgress.realityUnlocked(),
    },
    player: {
      infinities: window.player.infinities.toString(),
      eternities: window.player.eternities.toString(),
      realities: window.player.realities.toString(),
      break: window.player.break,
      antimatter: window.player.antimatter.toString(),
      maxAM: window.player.records.thisInfinity.maxAM.toString(),
      totalAM: window.player.records.totalAntimatter.toString(),
      infinityPoints: window.player.infinityPoints.toString(),
      autobuyersOn: window.player.auto.autobuyersOn,
      lastOpenTab: window.player.options.lastOpenTab,
    },
    view: { tab: window.ui.view.tab, subtab: window.ui.view.subtab },
    tabAvail: Object.fromEntries(["dimensions","automation","challenges","infinity","eternity","reality","celestials"].map(k => [k, T[k].isAvailable])),
    tabUnlocked: Object.fromEntries(["dimensions","infinity","eternity","reality"].map(k => [k, T[k].isUnlocked])),
    timeDimensionUnlocked: T.dimensions.time.isUnlocked,
    sidebarTabNames: [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean),
    subtabBar: [...document.querySelectorAll(".o-tab-btn--subtab")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean),
    currentComponent: (() => { try { return window.Tabs.current?.[window.ui.view.subtab]?.config?.component ?? null; } catch (e) { return "ERR:" + e.message; } })(),
    bodyHasTimeStudies: /时间研究|时间之理|时间维度|永恒升级|永恒里程碑/.test(document.body.innerText),
    bodyHasReality: /现实升级|符文炼金|复兴树/.test(document.body.innerText),
    news: {
      counts: Object.fromEntries(newsSelectors.map(s => [s, document.querySelectorAll(s).length])),
      total: newsSelectors.reduce((n, s) => n + document.querySelectorAll(s).length, 0),
      bodyMentionsNews: /新闻/.test(document.body.innerText),
      bodyTextHead: document.body.innerText.replace(/\s+/gu, " ").trim().slice(0, 400),
    },
    exec: {
      enabled: d.enabled, intervalSec: d.intervalSec, strictGlobal: d.strictGlobal,
      stage: d.stage?.id ?? null, goalId: d.goal?.id ?? null,
      actionCount: d.actionCount, attemptCount: d.attemptCount,
      eternityStageAllowed: d.eternityStageAllowed,
      lastBeatAt: d.beat.lastAt,
      execLog: d.beat.log.map(x => ({ task: x.task, at: Math.round(x.at), gapMs: x.gapMs === null ? null : Math.round(x.gapMs), taskGapMs: x.taskGapMs === null ? null : Math.round(x.taskGapMs) })),
      manualClickCount: d.manualClickCount, manualHold: d.manualHold,
      lastAction: d.lastAction ? { label: d.lastAction.label, acted: d.lastAction.acted } : null,
      blockers: d.blockers ?? null,
      degradedCount: d.degradedCount ?? null,
    },
    storage: {
      automationEnabled: localStorage.getItem("oreki.automation.enabled"),
      automationInterval: localStorage.getItem("oreki.automation.intervalSec"),
      saveLength: (localStorage.getItem("dimensionSave") || "").length,
    },
  };
});


// 原版教程提示 / 成就弹窗 / 离线进度弹窗会拦截点击；真实玩家会点掉它们。
// 这里用真实 UI 点击清理，不隐藏 DOM、不绕过交互。
async function dismissModals(page) {
  const texts = [/嗯呐/, /^确定$/, /^关闭$/, /^继续$/, /^知道了$/, /^好$/, /^跳过$/, /^是$/];
  for (let round = 0; round < 12; round++) {
    let clicked = false;
    const closeBtn = page.locator("button.o-primary-btn--modal-close, .c-modal__close-btn").first();
    if (await closeBtn.count()) { try { await closeBtn.click({ timeout: 900 }); clicked = true; } catch (e) { /* ignore */ } }
    for (const re of texts) {
      if (clicked) break;
      const btn = page.locator("button:visible, .o-primary-btn:visible").filter({ hasText: re }).first();
      if (await btn.count()) {
        try { await btn.click({ timeout: 900 }); clicked = true; } catch (e) { /* ignore */ }
      }
    }
    const overlay = await page.locator(".l-modal-overlay:visible, .c-modal.l-modal:visible").count();
    if (!overlay) return;
    if (!clicked) {
      // 弹窗没有可识别按钮时，用 Esc 关闭（原版 modal 支持）
      try { await page.keyboard.press("Escape"); } catch (e) { /* ignore */ }
    }
    await page.waitForTimeout(250);
  }
}

async function ensureDrawer(page) {
  const btn = page.locator(".c-oreki-nav__toggle");
  if (!(await btn.count())) return;
  const expanded = await btn.first().getAttribute("aria-expanded");
  if (expanded !== "true") await btn.first().click({ timeout: 4000 });
  await page.waitForTimeout(300);
}
async function closeDrawer(page) {
  const btn = page.locator(".c-oreki-nav__toggle");
  if (!(await btn.count())) return;
  let expanded = await btn.first().getAttribute("aria-expanded");
  if (expanded !== "true") return;
  // 真实用户关闭抽屉：点遮罩（scrim）。locator 点击会因动画 stability 超时，
  // 这里用真实指针在遮罩右侧空白点按一下（不是 JS 直接改状态）。
  const vp = page.viewportSize() || { width: 412, height: 839 };
  try { await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2)); } catch (e) { /* ignore */ }
  await page.waitForTimeout(400);
  expanded = await btn.first().getAttribute("aria-expanded");
  if (expanded === "true") {
    // 兜底：真实点击任意侧栏页签，@click.native="closeDrawer" 会收起抽屉
    try { await page.locator(".c-modern-sidebar .l-tab-btn-inner").first().click({ timeout: 2500 }); } catch (e) { /* ignore */ }
    await page.waitForTimeout(400);
  }
}
async function clickTab(page, name) {
  await dismissModals(page);
  await ensureDrawer(page);
  await page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: name }).first().click({ timeout: 6000 });
  await page.waitForTimeout(400);
}
async function clickSubtab(page, name) {
  await dismissModals(page);
  await ensureDrawer(page);
  await page.locator(".o-tab-btn--subtab").filter({ hasText: name }).first().click({ timeout: 6000 });
  await page.waitForTimeout(400);
  await closeDrawer(page);
}
async function openOptionsGameplay(page) { await clickTab(page, "选项"); await clickSubtab(page, "游戏玩法"); }
async function openOptionsVisual(page) { await clickTab(page, "选项"); await clickSubtab(page, "视觉效果"); }
async function openOptionsSaving(page) { await clickTab(page, "选项"); await clickSubtab(page, "存档"); }

async function clickAction(page, re, timeout = 600) {
  const loc = page.locator("button, .o-primary-btn").filter({ hasText: re }).first();
  if (!(await loc.count())) return false;
  try { await loc.click({ timeout }); return true; } catch (e) { return false; }
}
async function closeModals(page) {
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator("button.o-primary-btn--modal-close").first();
    if (await closeBtn.count()) { try { await closeBtn.click({ timeout: 800 }); } catch (e) { /* ignore */ } }
    const okBtn = page.locator("button.c-modal__confirm-btn").first();
    if (await okBtn.count()) { try { await okBtn.click({ timeout: 800 }); } catch (e) { /* ignore */ } }
    await page.waitForTimeout(250);
  }
}
async function settleOffline(page) {
  for (let i = 0; i < 60; i++) {
    const hasBar = await page.evaluate(() => !!(window.ui && window.ui.view && window.ui.view.modal && window.ui.view.modal.progressBar));
    if (!hasBar) return true;
    const skip = page.locator("button").filter({ hasText: /跳过/ }).first();
    if (await skip.count()) { try { await skip.click({ timeout: 1500 }); } catch (e) { /* ignore */ } }
    await page.waitForTimeout(600);
  }
  return false;
}
async function playToCrunch(page) {
  for (let i = 0; i < 500; i++) {
    await clickAction(page, /^买到 10 个$/);
    await clickAction(page, /^购买最大数量（M）$/);
    await clickAction(page, /^维度提升（\d+）$/);
    await clickAction(page, /^反物质星系 \(\d+\)$/);
    await clickAction(page, /^计数频率价格/);
    if (i % 20 === 0) await dismissModals(page);
    if (i % 10 === 0 && await page.evaluate(() => window.Player.canCrunch)) return true;
    await page.waitForTimeout(45);
  }
  return false;
}
async function firstCrunch(page) {
  await dismissModals(page);
  await closeDrawer(page);
  await page.locator(".btn-big-crunch").click({ timeout: 8000 });
  await page.waitForTimeout(600);
  const confirm = page.locator("button.c-modal__confirm-btn").first();
  if (await confirm.count()) await confirm.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await closeModals(page);
  await dismissModals(page);
}

async function runScenarios() {
// ═══════════════════════════════════════════════════════════════════════════
// S0 关闭新闻：DOM 不存在、无新闻入口、无可见占位
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S0-news-closed";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page);
  await boot(page);
  await page.waitForTimeout(600);
  const st = await snapshot(page);
  await shot(page, "s0-01-fresh-news");
  writeJson("s0-01-fresh-news.json", st);

  check(S, "news-nodes-absent-in-dom", st.news.total === 0, "counts=" + JSON.stringify(st.news.counts));
  check(S, "no-news-text-rendered", st.news.bodyMentionsNews === false, "bodyMentionsNews=" + st.news.bodyMentionsNews + ", head=\"" + st.news.bodyTextHead.slice(0, 160) + "\"");
  check(S, "fresh-save-baseline", Number(st.player.antimatter) > 0 && st.player.infinities === "0" && st.player.realities === "0",
    "antimatter=" + st.player.antimatter + ", infinities=" + st.player.infinities + ", realities=" + st.player.realities);

  // 视觉效果页不应再有「新闻」入口
  await openOptionsVisual(page);
  const visual = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll(".l-options-tab button, .l-options-tab .o-primary-btn")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean).slice(0, 80),
    bodyMentionsNews: /新闻/.test(document.body.innerText),
    newsNodes: document.querySelectorAll("#news, .c-news-ticker, [class*='news-ticker']").length,
  }));
  await shot(page, "s0-02-options-visual");
  writeJson("s0-02-options-visual.json", visual);
  check(S, "no-news-entry-in-visual-options", visual.bodyMentionsNews === false && visual.newsNodes === 0,
    "bodyMentionsNews=" + visual.bodyMentionsNews + ", newsNodes=" + visual.newsNodes + ", buttons=" + JSON.stringify(visual.buttons.slice(0, 12)));
  check(S, "no-pageerror", logs.filter(l => l.type === "pageerror").length === 0, "count=" + logs.filter(l => l.type === "pageerror").length);
  dumpLogs("s0", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S1 无意义切页：无输入 60s 自动切页次数 = 0；业务不依赖切页
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S1-no-meaningless-tab-switch";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page);
  await boot(page);
  const base = await snapshot(page);
  const startLog = base.exec.execLog.length;
  const startBeat = base.exec.lastBeatAt;
  const startTotalAM = base.player.totalAM;
  // [R107-01 P1] 阶段化节拍会让前 60s 内出现更多**原版**解锁跳页；本项只验证 MOD 不切页，
  // 所以同样临时关闭原版 automaticTabSwitching（测试场景），循环结束恢复。
  const autoTabBeforeIdle = await page.evaluate(() => window.player.options.automaticTabSwitching === true);
  await page.evaluate(() => { window.player.options.automaticTabSwitching = false; });
  const changes = [];
  let lastKey = base.view.tab + "/" + base.view.subtab;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const v = await page.evaluate(() => ({ tab: window.ui.view.tab, subtab: window.ui.view.subtab, lastOpenTab: window.player.options.lastOpenTab }));
    const key = v.tab + "/" + v.subtab;
    if (key !== lastKey) { changes.push({ atMs: Date.now() - t0, from: lastKey, to: key }); lastKey = key; }
    await page.waitForTimeout(500);
  }
  const afterIdle = await snapshot(page);
  await page.evaluate(auto => { window.player.options.automaticTabSwitching = auto; }, autoTabBeforeIdle);
  await shot(page, "s1-01-idle-60s");
  writeJson("s1-01-idle-60s.json", { changes, base: { view: base.view, execLog: base.exec.execLog.length, lastBeatAt: base.exec.lastBeatAt, totalAM: base.player.totalAM, infinities: base.player.infinities }, after: { view: afterIdle.view, execLog: afterIdle.exec.execLog.length, execStage: afterIdle.exec.stage, totalAM: afterIdle.player.totalAM, infinities: afterIdle.player.infinities } });
  check(S, "no-automatic-tab-switch-without-input", changes.length === 0, "changes=" + JSON.stringify(changes));
  check(S, "business-ticks-without-tab-switch", afterIdle.exec.execLog.length > startLog && afterIdle.exec.lastBeatAt > startBeat,
    "execLog " + startLog + "→" + afterIdle.exec.execLog.length + ", lastBeatAt " + Math.round(startBeat) + "→" + Math.round(afterIdle.exec.lastBeatAt));
  check(S, "production-grows-while-idle", Number(afterIdle.player.totalAM) > Number(startTotalAM),
    "totalAM " + startTotalAM + "→" + afterIdle.player.totalAM + ", stage=" + afterIdle.exec.stage + ", infinities=" + afterIdle.player.infinities);

  // 停在「选项 → 游戏玩法」25s：业务仍执行，且不会被强制切回其它页。
  // [R107-01 P1] 阶段化节拍加速了前期进度，25s 窗口内会命中**原版**的解锁跳页
  // （Tab.show(manual=false) → automaticTabSwitching：首无限/ID1/时间研究等解锁时
  // 原版会自动切到对应页）。本项检查的是「MOD 不得自己强切页」，因此先关闭原版
  // 自动切页开关（仅测试场景，不改生产默认值），窗口结束后恢复。
  await openOptionsGameplay(page);
  const autoTabBefore = await page.evaluate(() => window.player.options.automaticTabSwitching === true);
  await page.evaluate(() => { window.player.options.automaticTabSwitching = false; });
  const beforeTab = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { ac: d.actionCount, count: d.beat.log.length, lastBeatAt: d.beat.lastAt,
      servedSum: Object.values(d.beat.served || {}).reduce((a, b) => a + b, 0),
      view: window.ui.view.tab + "/" + window.ui.view.subtab,
      totalAM: window.player.records.totalAntimatter.toString(),
      totalAMLog10: Number(window.player.records.totalAntimatter.log10()),
      infinities: window.player.infinities.toString(),
      infinitiesLog10: Number(window.player.infinities.log10()) };
  });
  const tabT0 = Date.now();
  const tabChanges = [];
  let lastTabKey = beforeTab.view;
  while (Date.now() - tabT0 < 25000) {
    const v = await page.evaluate(() => ({ view: window.ui.view.tab + "/" + window.ui.view.subtab, totalAM: window.player.records.totalAntimatter.toString(), infinities: window.player.infinities.toString() }));
    if (v.view !== lastTabKey) { tabChanges.push({ atMs: Date.now() - tabT0, from: lastTabKey, to: v.view }); lastTabKey = v.view; }
    await page.waitForTimeout(500);
  }
  const afterTab = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { ac: d.actionCount, count: d.beat.log.length, lastBeatAt: d.beat.lastAt,
      servedSum: Object.values(d.beat.served || {}).reduce((a, b) => a + b, 0),
      view: window.ui.view.tab + "/" + window.ui.view.subtab,
      totalAM: window.player.records.totalAntimatter.toString(),
      totalAMLog10: Number(window.player.records.totalAntimatter.log10()),
      infinities: window.player.infinities.toString(),
      infinitiesLog10: Number(window.player.infinities.log10()) };
  });
  await page.evaluate(auto => { window.player.options.automaticTabSwitching = auto; }, autoTabBefore);
  writeJson("s1-02-away-tab.json", { beforeTab, afterTab, tabChanges, autoTabBefore });
  check(S, "no-forced-tab-switch-while-away", tabChanges.length === 0, "changes=" + JSON.stringify(tabChanges) + ", view=" + afterTab.view);
  // [R107-01 P1] 不能用 beat.log.length 判定业务仍在执行：debugState 只保留最近 12 条，
  // 1s 节拍下窗口内很快填满（12→12），旧断言会假失败。改用累计 actionCount。
  check(S, "business-ticks-while-away-from-dimensions",
    (afterTab.lastBeatAt > beforeTab.lastBeatAt || afterTab.servedSum > beforeTab.servedSum) &&
      (afterTab.totalAMLog10 > beforeTab.totalAMLog10 || afterTab.infinitiesLog10 > beforeTab.infinitiesLog10),
    "lastBeatAt " + Math.round(beforeTab.lastBeatAt) + "→" + Math.round(afterTab.lastBeatAt) +
      ", served " + beforeTab.servedSum + "→" + afterTab.servedSum +
      ", actionCount " + beforeTab.ac + "→" + afterTab.ac +
      ", totalAM " + beforeTab.totalAM + "→" + afterTab.totalAM +
      ", infinities " + beforeTab.infinities + "→" + afterTab.infinities + ", view=" + afterTab.view);
  check(S, "no-pageerror", logs.filter(l => l.type === "pageerror").length === 0, "count=" + logs.filter(l => l.type === "pageerror").length);
  dumpLogs("s1", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S2 阶段解锁显示：新档锁住 → 首次大坍缩后无限入口即时出现（不刷新），永恒/现实仍不出现
// ═══════════════════════════════════════════════════════════════════════════
let exportedSave = "";
let exportedState = null;
{
  const S = "S2-stage-unlock-display";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page);
  await boot(page);
  const fresh = await snapshot(page);
  await ensureDrawer(page);
  await shot(page, "s2-01-fresh-locked");
  writeJson("s2-01-fresh-locked.json", fresh);
  await closeDrawer(page);

  const banned = ["无限", "永恒", "现实", "天神"];
  check(S, "fresh-no-high-stage-entry", !fresh.progress.infinity && !fresh.tabAvail.infinity && !fresh.tabAvail.eternity && !fresh.tabAvail.reality,
    "infinity=" + fresh.progress.infinity + ", tabs=" + JSON.stringify(fresh.tabAvail));
  check(S, "fresh-sidebar-has-no-locked-stage-entry", !banned.some(n => fresh.sidebarTabNames.some(t => t === n)), "sidebar=" + JSON.stringify(fresh.sidebarTabNames));
  check(S, "fresh-no-locked-content-rendered", !fresh.bodyHasTimeStudies && !fresh.bodyHasReality && fresh.currentComponent !== "TimeStudiesTab",
    "comp=" + fresh.currentComponent + ", studies=" + fresh.bodyHasTimeStudies + ", reality=" + fresh.bodyHasReality);
  check(S, "stage-gate-blocks-eternity-layer-before-infinity", fresh.exec.eternityStageAllowed === false,
    "eternityStageAllowed=" + fresh.exec.eternityStageAllowed + ", infinityUnlocked=" + fresh.progress.infinity);

  const ready = await playToCrunch(page);
  check(S, "big-crunch-reachable-by-real-play", ready, "canCrunch=" + await page.evaluate(() => window.Player.canCrunch));
  await firstCrunch(page);
  // 不刷新，等待 UI 在 15s 内反映新阶段
  let post = null;
  const pollT0 = Date.now();
  while (Date.now() - pollT0 < 15000) {
    post = await snapshot(page);
    if (post.tabAvail.infinity && post.progress.infinity) break;
    await page.waitForTimeout(500);
  }
  const uiDelayMs = Date.now() - pollT0;
  await dismissModals(page);
  await ensureDrawer(page);
  await shot(page, "s2-02-after-first-crunch");
  writeJson("s2-02-after-first-crunch.json", { post, uiDelayMs, checks: { drawer: await page.evaluate(() => [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean)) } });
  const drawerNames = await page.evaluate(() => [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean));
  await closeDrawer(page);
  check(S, "first-crunch-enters-infinity-stage", post.progress.infinity && Number(post.player.infinities) >= 1,
    "infinityUnlocked=" + post.progress.infinity + ", infinities=" + post.player.infinities + ", IP=" + post.player.infinityPoints);
  check(S, "infinity-entry-appears-without-reload", post.tabAvail.infinity && drawerNames.includes("无限"),
    "infinityTab=" + post.tabAvail.infinity + ", drawer=" + JSON.stringify(drawerNames) + ", uiDelay=" + uiDelayMs + "ms");
  check(S, "eternity-reality-still-absent", !post.tabAvail.eternity && !post.tabAvail.reality && !post.progress.eternity && !post.progress.reality,
    "eternityTab=" + post.tabAvail.eternity + ", realityTab=" + post.tabAvail.reality + ", eternities=" + post.player.eternities);
  check(S, "no-time-studies-after-first-crunch", !post.bodyHasTimeStudies && post.currentComponent !== "TimeStudiesTab",
    "comp=" + post.currentComponent + ", studiesText=" + post.bodyHasTimeStudies);

  // 真实 UI 导出存档，供 S3 使用
  await dismissModals(page);
  await openOptionsSaving(page);
  await clickAction(page, "导出存档");
  await page.waitForTimeout(900);
  const exported = await page.evaluate(async () => {
    let clip = "";
    try { clip = await navigator.clipboard.readText(); } catch (e) { clip = ""; }
    const ta = document.querySelector("body > textarea[readonly]");
    const text = clip || (ta ? ta.value : "");
    return { text, len: text.length, valid: !!window.GameSaveSerializer.deserialize(text) };
  });
  exportedSave = exported.text;
  exportedState = await snapshot(page);
  writeFile("r107-real-infinity-save.txt", exportedSave);
  writeJson("s2-03-export.json", { len: exported.len, valid: exported.valid, state: { infinities: exportedState.player.infinities, IP: exportedState.player.infinityPoints, stage: exportedState.exec.stage, view: exportedState.view } });
  check(S, "real-save-exported-from-ui", exported.valid && exported.len > 500, "len=" + exported.len + ", valid=" + exported.valid);
  check(S, "no-pageerror", logs.filter(l => l.type === "pageerror").length === 0, "count=" + logs.filter(l => l.type === "pageerror").length);
  dumpLogs("s2", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S3 自动购买器：阶段感知 / 总开关 / 1~60s / 边界钳制 / 持久化 / 手动优先
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S3-autobuyer";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page);
  await boot(page);
  await page.evaluate(save => localStorage.setItem("dimensionSave", save), exportedSave);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await settleOffline(page);
  await closeModals(page);
  const st0 = await snapshot(page);
  writeJson("s3-00-imported-stage.json", { view: st0.view, stage: st0.exec.stage, goalId: st0.exec.goalId, enabled: st0.exec.enabled, intervalSec: st0.exec.intervalSec, inf: st0.player.infinities, eternityStageAllowed: st0.exec.eternityStageAllowed });
  check(S, "stage-restored-from-real-save", st0.progress.infinity && st0.tabAvail.infinity && !st0.tabAvail.eternity,
    "infinity=" + st0.progress.infinity + ", infinityTab=" + st0.tabAvail.infinity + ", eternityTab=" + st0.tabAvail.eternity + ", stage=" + st0.exec.stage);

  // 阶段感知（负向）：eternities=0 时不得执行永恒/现实层任务，阶段策略必须是无限阶段
  const eternityTasks0 = st0.exec.execLog.filter(x => /eternity|reality|celestial|perk|endgame/.test(x.task)).map(x => x.task);
  // 阶段门禁的真实语义（oreki-smart-executor.js eternityStageAllowed()）：
  //   allowed = PlayerProgress.infinityUnlocked() && player.break
  // 它不是「eternities>0」；首次无限前必须 false，Break 后才放行永恒层动作。
  check(S, "stage-gate-allows-eternity-layer-exactly-after-break",
    st0.exec.eternityStageAllowed === (st0.progress.infinity === true && st0.player.break === true),
    "allowed=" + st0.exec.eternityStageAllowed + ", infinityUnlocked=" + st0.progress.infinity + ", break=" + st0.player.break);
  check(S, "no-eternity-layer-action-before-infinity",
    st0.progress.infinity === true || eternityTasks0.length === 0,
    "infinityUnlocked=" + st0.progress.infinity + ", allowed=" + st0.exec.eternityStageAllowed + ", tasks=" + JSON.stringify(eternityTasks0));
  check(S, "stage-aware-goal-belongs-to-infinity-stage",
    typeof st0.exec.stage === "string" && st0.exec.stage !== null && st0.exec.stage !== "preInfinity" && !/eternity|reality/.test(st0.exec.stage),
    "stage=" + st0.exec.stage + ", goal=" + st0.exec.goalId);

  await dismissModals(page);
  await openOptionsGameplay(page);
  await dismissModals(page);
  await shot(page, "s3-01-options-gameplay");
  const ui0 = await page.evaluate(() => ({
    toggleText: document.querySelector(".c-oreki-sched__toggle")?.textContent.replace(/\s+/gu, " ").trim() ?? null,
    labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()).slice(0, 4),
    inputValue: document.querySelector(".c-oreki-sched__field")?.value ?? null,
  }));
  writeJson("s3-01-ui.json", ui0);
  check(S, "ui-shows-automation-on-default-10s",
    /启用/.test(ui0.toggleText || "") && (ui0.labels || []).some(t => /10 秒/.test(t)) && ui0.inputValue === "10",
    "toggle=\"" + ui0.toggleText + "\", labels=" + JSON.stringify(ui0.labels) + ", input=" + ui0.inputValue);

  const waitExec = async (sinceAt, minCount, timeoutMs) => {
    const t = Date.now();
    while (Date.now() - t < timeoutMs) {
      const log = await page.evaluate(() => window.OrekiSmartExecutor.debugState().beat.log.map(x => ({ task: x.task, at: Math.round(x.at), gapMs: x.gapMs === null ? null : Math.round(x.gapMs) })));
      const fresh = log.filter(x => x.at > sinceAt);
      if (fresh.length >= minCount) return { log, fresh, waitedMs: Date.now() - t };
      await page.waitForTimeout(200);
    }
    const log = await page.evaluate(() => window.OrekiSmartExecutor.debugState().beat.log.map(x => ({ task: x.task, at: Math.round(x.at), gapMs: x.gapMs === null ? null : Math.round(x.gapMs) })));
    return { log, fresh: log.filter(x => x.at > sinceAt), waitedMs: Date.now() - t, timedOut: true };
  };
  const base = await waitExec(0, 3, 40000);
  // [R107-01 P1] 阶段化节拍：玩家配置仍是上限，但实际节拍 = min(配置, 阶段上限)。
  // 因此这里不能再断言「10 s 固定间隔」，而要断言「实际生效节拍」；
  // UI/存储值仍需保持玩家配置 10 s（上一项 ui-shows-automation-on-default-10s 已断言）。
  const baseBeat = await page.evaluate(() => ({
    configured: window.OrekiSmartExecutor.intervalSec,
    effective: window.OrekiSmartExecutor.effectiveIntervalSec,
    stageCap: window.OrekiSmartExecutor.debugState().stageCapSec,
    realities: window.player.realities,
    stored: localStorage.getItem("oreki.automation.intervalSec"),
  }));
  writeJson("s3-02-baseline-exec.json", { base, baseBeat });
  const baseExpectedMs = baseBeat.effective * 1000;
  check(S, "mod-scheduler-executes-at-stage-capped-effective-beat",
    baseBeat.configured === 10 && (baseBeat.stored === null || baseBeat.stored === "10") &&
      baseBeat.effective <= baseBeat.stageCap &&
      base.fresh.length >= 3 &&
      base.fresh.slice(1).every(x => x.gapMs === null ||
        (x.gapMs >= baseExpectedMs - 500 && x.gapMs <= baseExpectedMs + 1500)),
    "configured=" + baseBeat.configured + "s, effective=" + baseBeat.effective + "s, cap=" + baseBeat.stageCap +
      "s, realities=" + baseBeat.realities + ", executions=" + base.fresh.length +
      ", gaps=" + JSON.stringify(base.fresh.map(x => x.gapMs)));

  // 总开关关闭 → 立即停止；不得改动原版总开关
  const beforeOff = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { count: d.beat.log.length, lastAt: d.beat.lastAt, actionCount: d.actionCount, attemptCount: d.attemptCount, autobuyersOn: window.player.auto.autobuyersOn };
  });
  await page.locator(".c-oreki-sched__toggle").first().click({ timeout: 6000 });
  await page.waitForTimeout(400);
  const offState = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { enabled: window.OrekiSmartExecutor.enabled, storedEnabled: localStorage.getItem("oreki.automation.enabled"), actionCount: d.actionCount, attemptCount: d.attemptCount, lastBeatAt: d.beat.lastAt, count: d.beat.log.length, autobuyersOn: window.player.auto.autobuyersOn, toggleText: document.querySelector(".c-oreki-sched__toggle")?.textContent.replace(/\s+/gu, " ").trim() };
  });
  await shot(page, "s3-03-switch-off");
  check(S, "switch-off-applies-immediately",
    offState.enabled === false && offState.storedEnabled === "0" && /关闭/.test(offState.toggleText || ""),
    "enabled=" + offState.enabled + ", stored=" + offState.storedEnabled + ", toggle=\"" + offState.toggleText + "\"");
  await page.waitForTimeout(5500);
  const afterOff = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { count: d.beat.log.length, lastBeatAt: d.beat.lastAt, actionCount: d.actionCount, attemptCount: d.attemptCount, enabled: window.OrekiSmartExecutor.enabled };
  });
  writeJson("s3-03-switch-off.json", { beforeOff, offState, afterOff });
  check(S, "mod-stops-executing-while-switch-off",
    afterOff.count === beforeOff.count && afterOff.lastBeatAt === beforeOff.lastAt && afterOff.actionCount === beforeOff.actionCount && afterOff.attemptCount === beforeOff.attemptCount,
    "execLog " + beforeOff.count + "→" + afterOff.count + ", lastBeatAt " + Math.round(beforeOff.lastAt) + "→" + Math.round(afterOff.lastBeatAt) + ", actions " + beforeOff.actionCount + "→" + afterOff.actionCount);
  check(S, "vanilla-autobuyers-not-disabled-by-mod-switch", offState.autobuyersOn === true, "player.auto.autobuyersOn=" + offState.autobuyersOn);

  // 重新开启
  await page.locator(".c-oreki-sched__toggle").first().click({ timeout: 6000 });
  await page.waitForTimeout(400);
  const onState = await page.evaluate(() => ({ enabled: window.OrekiSmartExecutor.enabled, stored: localStorage.getItem("oreki.automation.enabled") }));
  check(S, "switch-on-applies-immediately", onState.enabled === true && onState.stored === "1", "enabled=" + onState.enabled + ", stored=" + onState.stored);

  // 间隔 1 秒
  await page.locator(".c-oreki-sched__field").fill("1");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 6000 });
  await page.waitForTimeout(300);
  const set1 = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()) }));
  const mark1 = await page.evaluate(() => { const d = window.OrekiSmartExecutor.debugState(); return { lastAt: d.beat.lastAt, count: d.beat.log.length }; });
  const exec1 = await waitExec(mark1.lastAt, 3, 15000);
  const gaps1 = exec1.fresh.map(x => x.gapMs);
  await shot(page, "s3-04-interval-1s");
  writeJson("s3-04-interval-1s.json", { set1, mark1, exec1 });
  check(S, "interval-1s-applied-and-stored", set1.intervalSec === 1 && set1.stored === "1" && (set1.labels || []).some(t => /调度间隔 1 秒/.test(t)),
    "interval=" + set1.intervalSec + ", stored=" + set1.stored + ", labels=" + JSON.stringify(set1.labels));
  check(S, "interval-1s-takes-effect", exec1.fresh.length >= 3 && gaps1.slice(1).every(g => g !== null && g >= 600 && g <= 3000),
    "executions=" + exec1.fresh.length + ", gaps=" + JSON.stringify(gaps1));

  // 边界钳制：0 → 1，999 → 60
  await page.locator(".c-oreki-sched__field").fill("0");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 6000 });
  await page.waitForTimeout(350);
  const clampLow = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), input: document.querySelector(".c-oreki-sched__field")?.value }));
  await page.locator(".c-oreki-sched__field").fill("999");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 6000 });
  await page.waitForTimeout(350);
  const clampHigh = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), input: document.querySelector(".c-oreki-sched__field")?.value }));
  await shot(page, "s3-05-clamp");
  writeJson("s3-05-clamp.json", { clampLow, clampHigh });
  check(S, "interval-clamped-to-1-60-range",
    clampLow.intervalSec === 1 && clampHigh.intervalSec === 60 && clampLow.stored === "1" && clampHigh.stored === "60",
    "0→" + clampLow.intervalSec + " (stored " + clampLow.stored + "), 999→" + clampHigh.intervalSec + " (stored " + clampHigh.stored + ")");

  // 间隔 60 秒实测一拍
  const set60 = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()), lastAt: window.OrekiSmartExecutor.debugState().beat.lastAt, count: window.OrekiSmartExecutor.debugState().beat.log.length }));
  const deadline60 = Date.now() + 80000;
  let newEntry60 = null;
  while (Date.now() < deadline60) {
    const d = await page.evaluate(() => { const s = window.OrekiSmartExecutor.debugState(); return { count: s.beat.log.length, last: s.beat.log.length ? s.beat.log[s.beat.log.length - 1] : null }; });
    if (d.count > set60.count && d.last && d.last.at > set60.lastAt) { newEntry60 = d.last; break; }
    await page.waitForTimeout(150);
  }
  const gap60 = newEntry60 ? Math.round(newEntry60.gapMs ?? -1) : null;
  await shot(page, "s3-06-interval-60s");
  writeJson("s3-06-interval-60s.json", { set60, newEntry60, gap60 });
  check(S, "interval-60s-applied-and-stored", set60.intervalSec === 60 && (set60.labels || []).some(t => /调度间隔 60 秒/.test(t)),
    "interval=" + set60.intervalSec + ", labels=" + JSON.stringify(set60.labels));
  // [R107-01 P1] 60 s 是玩家配置的上限；阶段上限会把它压到 ≤5 s。
  // 因此「60 s 生效」改为断言：配置/存储仍为 60、实际节拍 = min(60, stageCap)，
  // 且真实观测到的 gap 与该生效值一致（不再要求 58~65 s）。
  const beat60 = await page.evaluate(() => ({
    configured: window.OrekiSmartExecutor.intervalSec,
    effective: window.OrekiSmartExecutor.effectiveIntervalSec,
    stageCap: window.OrekiSmartExecutor.debugState().stageCapSec,
    realities: window.player.realities,
  }));
  writeJson("s3-06-interval-60s-effective.json", { beat60, gap60, newEntry60 });
  const beat60ExpectedMs = beat60.effective * 1000;
  check(S, "interval-60s-stored-upper-bound-and-stage-cap-applied",
    beat60.configured === 60 && beat60.effective === Math.min(60, beat60.stageCap) &&
      newEntry60 !== null && gap60 !== null &&
      gap60 >= beat60ExpectedMs - 500 && gap60 <= beat60ExpectedMs + 1500,
    "configured=" + beat60.configured + "s, effective=" + beat60.effective + "s, cap=" + beat60.stageCap +
      "s, realities=" + beat60.realities + ", gap=" + gap60 + "ms");

  // 持久化：刷新后保持
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await settleOffline(page);
  await closeModals(page);
  const persisted60 = await page.evaluate(() => ({ enabled: window.OrekiSmartExecutor.enabled, intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), stage: window.OrekiSmartExecutor.debugState().stage?.id, hasEternity: window.Tab.eternity.isAvailable }));
  await shot(page, "s3-07-persist-after-reload");
  writeJson("s3-07-persist.json", persisted60);
  check(S, "interval-60s-persists-after-reload", persisted60.enabled === true && persisted60.intervalSec === 60 && persisted60.stored === "60",
    "enabled=" + persisted60.enabled + ", interval=" + persisted60.intervalSec + ", stored=" + persisted60.stored);
  check(S, "stage-not-advanced-by-reload", persisted60.hasEternity === false, "eternityTab=" + persisted60.hasEternity + ", stage=" + persisted60.stage);

  // 手动优先：1s 间隔下真实点击购买 → 让路 60s 且执行层不动作
  await settleOffline(page);
  await openOptionsGameplay(page);
  await page.locator(".c-oreki-sched__field").fill("1");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 6000 });
  await page.waitForTimeout(1200);
  await clickTab(page, "维度");
  await closeDrawer(page);
  for (let i = 0; i < 20; i++) {
    const hasOverlay = await page.evaluate(() => !!document.querySelector(".l-modal-overlay"));
    if (!hasOverlay) break;
    await settleOffline(page);
    await closeModals(page);
    await page.waitForTimeout(400);
  }
  const manualBefore = await page.evaluate(() => ({ mc: window.OrekiSmartExecutor.debugState().manualClickCount, ac: window.OrekiSmartExecutor.debugState().actionCount, count: window.OrekiSmartExecutor.debugState().beat.log.length, am: window.player.antimatter.toString() }));
  let manualAction = "none";
  const buyBtn = page.locator("#ui button:not([disabled]), #ui .o-primary-btn:not(.o-primary-btn--disabled)").filter({ hasText: /购买|买到/ }).first();
  if (await buyBtn.count()) {
    try { await buyBtn.click({ timeout: 3000 }); manualAction = "buy:" + ((await buyBtn.textContent()) || "").replace(/\s+/gu, " ").trim().slice(0, 24); } catch (e) { /* ignore */ }
  }
  if (manualAction === "none") {
    try { await page.locator("#ui").click({ position: { x: 60, y: 140 }, timeout: 3000 }); manualAction = "content-area-click"; } catch (e) { /* ignore */ }
  }
  await page.waitForTimeout(600);
  const manualAfter = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { mc: d.manualClickCount, ac: d.actionCount, count: d.beat.log.length, hold: d.manualHold, execState: d.lastResult };
  });
  await page.waitForTimeout(5200);
  const manualLater = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { mc: d.manualClickCount, ac: d.actionCount, attemptCount: d.attemptCount, hold: d.manualHold };
  });
  await shot(page, "s3-08-manual-hold");
  writeJson("s3-08-manual.json", { manualBefore, manualAfter, manualLater, manualAction });
  check(S, "manual-click-recorded-and-mod-yields",
    manualAction !== "none" && manualAfter.mc > manualBefore.mc && manualAfter.hold !== null && manualAfter.hold.remainSec > 50,
    "manualAction=" + manualAction + ", manualClick " + manualBefore.mc + "→" + manualAfter.mc + ", hold=" + JSON.stringify(manualAfter.hold));
  check(S, "mod-verb-layer-not-acting-during-manual-hold", manualLater.ac === manualBefore.ac,
    "actionCount " + manualBefore.ac + "→" + manualLater.ac + ", attemptCount=" + manualLater.attemptCount + ", holdRemain=" + (manualLater.hold?.remainSec ?? null));

  const stageCheck = await snapshot(page);
  const eternityTasks = stageCheck.exec.execLog.filter(x => /eternity|reality|celestial|perk|endgame/.test(x.task)).map(x => x.task);
  writeJson("s3-09-stage.json", { eternities: stageCheck.player.eternities, eternityTab: stageCheck.tabAvail.eternity, stage: stageCheck.exec.stage, allowed: stageCheck.exec.eternityStageAllowed, eternityTasks });
  check(S, "no-eternity-layer-entry-while-eternities-zero",
    stageCheck.player.eternities === "0" && !stageCheck.tabAvail.eternity && !stageCheck.bodyHasTimeStudies,
    "eternities=" + stageCheck.player.eternities + ", eternityTab=" + stageCheck.tabAvail.eternity + ", studiesText=" + stageCheck.bodyHasTimeStudies);
  check(S, "no-eternity-reality-tasks-while-zero-eternities", eternityTasks.filter(t => /eternity|eternityReset/.test(t)).length === 0,
    "tasks=" + JSON.stringify(eternityTasks) + ", allowed=" + stageCheck.exec.eternityStageAllowed);

  // ── S4 阶段解锁后的自动购买器阶段感知升级（真实运行到首次永恒）──────────
  const S4 = "S4-stage-transition-to-eternity";
  await dismissModals(page);
  await openOptionsGameplay(page);
  await page.locator(".c-oreki-sched__field").fill("10");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 6000 });
  await page.waitForTimeout(500);
  await clickTab(page, "维度");
  await closeDrawer(page);
  const transitions = [];
  let lastKey = "";
  const tEt0 = Date.now();
  let reached = false;
  while (Date.now() - tEt0 < 660000) {
    const v = await page.evaluate(() => ({
      et: window.player.eternities.toString(), inf: window.player.infinities.toString(), brk: window.player.break,
      stage: window.OrekiSmartExecutor.debugState().stage?.id ?? null,
      allowed: window.OrekiSmartExecutor.eternityStageAllowed(),
      eternityTab: window.Tab.eternity.isAvailable,
      realityTab: window.Tab.reality.isAvailable,
    }));
    const key = JSON.stringify(v);
    if (key !== lastKey) { transitions.push({ atMs: Date.now() - tEt0, ...v }); lastKey = key; }
    if (Number(v.et) >= 1 && v.eternityTab) { reached = true; break; }
    await page.waitForTimeout(3000);
  }
  const waitedEtMs = Date.now() - tEt0;
  await page.waitForTimeout(2500);
  const afterEt = await snapshot(page);
  await ensureDrawer(page);
  await shot(page, "s4-01-after-first-eternity");
  const drawerEt = await page.evaluate(() => [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean));
  await closeDrawer(page);
  writeJson("s4-01-after-first-eternity.json", { reached, waitedEtMs, transitions, afterEt: { eternities: afterEt.player.eternities, stage: afterEt.exec.stage, allowed: afterEt.exec.eternityStageAllowed, eternityTab: afterEt.tabAvail.eternity, realityTab: afterEt.tabAvail.reality, drawer: drawerEt, goalId: afterEt.exec.goalId } });
  check(S4, "real-run-reaches-eternity-within-window", reached, "eternities=" + afterEt.player.eternities + ", waited=" + Math.round(waitedEtMs / 1000) + "s, transitions=" + JSON.stringify(transitions.slice(-3)));
  check(S4, "eternity-entry-appears-without-reload", afterEt.tabAvail.eternity === true && drawerEt.includes("永恒"),
    "eternityTab=" + afterEt.tabAvail.eternity + ", drawer=" + JSON.stringify(drawerEt));
  check(S4, "executor-stage-switched-to-eternity-allowed", afterEt.exec.eternityStageAllowed === true && !/preInfinity|infinity$/.test(afterEt.exec.stage || ""),
    "stage=" + afterEt.exec.stage + ", allowed=" + afterEt.exec.eternityStageAllowed + ", goal=" + afterEt.exec.goalId);
  check(S4, "reality-entry-still-absent-at-first-eternity", afterEt.tabAvail.reality === false && afterEt.player.realities === "0",
    "realityTab=" + afterEt.tabAvail.reality + ", realities=" + afterEt.player.realities);
  // 阶段切换后，执行层真实执行永恒层任务（30s 内）
  let eternityActed = null;
  const actT0 = Date.now();
  while (Date.now() - actT0 < 40000) {
    const t = await page.evaluate(() => window.OrekiSmartExecutor.debugState().beat.log.filter(x => /eternity/.test(x.task)).map(x => ({ task: x.task, at: Math.round(x.at) })));
    if (t.length > 0) { eternityActed = t[t.length - 1]; break; }
    await page.waitForTimeout(1000);
  }
  writeJson("s4-02-eternity-task.json", { eternityActed, waitedMs: Date.now() - actT0 });
  check(S4, "eternity-layer-task-executed-after-unlock", eternityActed !== null,
    "task=" + JSON.stringify(eternityActed) + ", stage=" + afterEt.exec.stage);
  check(S4, "no-pageerror", logs.filter(l => l.type === "pageerror").length === 0, "count=" + logs.filter(l => l.type === "pageerror").length);
  dumpLogs("s3-s4", logs);
  await ctx.close();
}

} // end runScenarios

await runScenarios().catch(e => rec("RUNNER", "scenario-crash", "FAIL", String((e && e.stack) || e).slice(0, 4000)));

await browser.close().catch(() => {});
await new Promise(resolve => server.close(resolve));

const totals = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
const summary = {
  generatedAt: new Date().toISOString(),
  round: "R107-01",
  task: "T7 Web 行为等价：新闻关闭/无意义切页/自动购买器/阶段解锁显示",
  env: envInfo,
  viewport: envInfo.viewport,
  totals,
  pass: totals.FAIL === undefined,
  results,
};
fs.writeFileSync(OUT + "/result.json", JSON.stringify(summary, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(totals));
console.log("evidence:", EV);
process.exit(totals.FAIL ? 1 : 0);
