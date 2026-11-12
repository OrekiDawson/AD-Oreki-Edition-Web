import { chromium } from "playwright";
import fs from "node:fs";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = REPO + "/reports/R103-07";
const EV = OUT + "/evidence";
fs.mkdirSync(EV, { recursive: true });
const BASE = "http://127.0.0.1:8099/";
const results = [];
const rec = (scenario, id, status, detail = "") => {
  results.push({ scenario, id, status, detail });
  console.log(`[${status}] ${scenario} | ${id} | ${detail}`);
};
const check = (scenario, id, cond, detail = "") => rec(scenario, id, cond ? "PASS" : "FAIL", detail);

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36";
const browser = await chromium.launch({ headless: true });
const newContext = () => browser.newContext({
  viewport: { width: 412, height: 839 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  userAgent: UA,
  permissions: ["clipboard-read", "clipboard-write"],
});

function attachLogs(page, tag) {
  const logs = [];
  page.on("console", m => logs.push({ type: m.type(), at: Date.now(), text: m.text().slice(0, 400) }));
  page.on("pageerror", e => logs.push({ type: "pageerror", at: Date.now(), text: String(e.message).slice(0, 600) }));
  return logs;
}
function dumpLogs(tag, logs) {
  fs.writeFileSync(`${EV}/${tag}-console.log`, logs.map(l => `[${l.type}] ${l.text}`).join("\n"));
  fs.writeFileSync(`${EV}/${tag}-console.json`, JSON.stringify(logs, null, 2));
}
const shot = async (page, name) => page.screenshot({ path: `${EV}/${name}.png` });

async function boot(page, url = BASE) {
  page.setDefaultTimeout(10000);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(900);
}

const snapshot = page => page.evaluate(() => {
  const T = window.Tab;
  const side = document.querySelector(".c-modern-sidebar");
  const tabNames = [...document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean);
  const body = document.body.innerText;
  const d = window.OrekiSmartExecutor.debugState();
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
      infinityPoints: window.player.infinityPoints.toString(),
      autobuyersOn: window.player.auto.autobuyersOn,
    },
    view: { tab: window.ui.view.tab, subtab: window.ui.view.subtab },
    tabAvail: Object.fromEntries(["dimensions","automation","challenges","infinity","eternity","reality","celestials"].map(k => [k, T[k].isAvailable])),
    tabUnlocked: Object.fromEntries(["dimensions","infinity","eternity","reality"].map(k => [k, T[k].isUnlocked])),
    timeDimensionUnlocked: T.dimensions.time.isUnlocked,
    eternityStudiesUnlocked: T.eternity.studies.isUnlocked,
    sidebarTabNames: tabNames,
    sidebarText: (side?.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 400),
    subtabBar: [...document.querySelectorAll(".o-tab-btn--subtab")].map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean),
    currentComponent: (() => { try { return window.Tabs.current?.[window.ui.view.subtab]?.config?.component ?? null; } catch (e) { return "ERR:" + e.message; } })(),
    bodyHasTimeStudies: /时间研究|时间之理|时间维度|永恒升级|永恒里程碑/.test(body),
    bodyHasReality: /现实升级|符文炼金|复兴树/.test(body),
    exec: {
      enabled: d.enabled, intervalSec: d.intervalSec, strictGlobal: d.strictGlobal,
      stage: d.stage?.id ?? null, actionCount: d.actionCount, attemptCount: d.attemptCount,
      eternityStageAllowed: d.eternityStageAllowed, lastBeatAt: d.beat.lastAt,
      execLog: d.beat.log.map(x => ({ task: x.task, at: Math.round(x.at), gapMs: x.gapMs === null ? null : Math.round(x.gapMs), taskGapMs: x.taskGapMs === null ? null : Math.round(x.taskGapMs) })),
      manualClickCount: d.manualClickCount, manualHold: d.manualHold, lastAction: d.lastAction ? { label: d.lastAction.label, acted: d.lastAction.acted } : null,
    },
    storage: {
      automationEnabled: localStorage.getItem("oreki.automation.enabled"),
      automationInterval: localStorage.getItem("oreki.automation.intervalSec"),
      automationStrict: localStorage.getItem("oreki.automation.strictGlobal"),
      saveLength: (localStorage.getItem("dimensionSave") || "").length,
    },
  };
});

async function ensureDrawer(page) {
  const btn = page.locator(".c-oreki-nav__toggle");
  if (!(await btn.count())) return;
  const expanded = await btn.first().getAttribute("aria-expanded");
  if (expanded !== "true") await btn.first().click({ timeout: 4000 });
  await page.waitForTimeout(300);
}
async function clickTab(page, name) {
  await ensureDrawer(page);
  const loc = page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: name }).first();
  await loc.click({ timeout: 5000 });
  await page.waitForTimeout(400);
}
async function clickSubtab(page, name) {
  await ensureDrawer(page);
  const loc = page.locator(".o-tab-btn--subtab").filter({ hasText: name }).first();
  await loc.click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await closeDrawer(page);
}
async function closeDrawer(page) {
  const btn = page.locator(".c-oreki-nav__toggle");
  if (!(await btn.count())) return;
  const expanded = await btn.first().getAttribute("aria-expanded");
  if (expanded === "true") { try { await btn.first().click({ timeout: 2500 }); } catch {} await page.waitForTimeout(250); }
}
async function openOptionsSaving(page) { await clickTab(page, "选项"); await clickSubtab(page, "存档"); }
async function openOptionsGameplay(page) { await clickTab(page, "选项"); await clickSubtab(page, "游戏玩法"); }

async function clickAction(page, re, timeout = 500) {
  const loc = page.locator("button, .o-primary-btn").filter({ hasText: re }).first();
  if (!(await loc.count())) return false;
  try { await loc.click({ timeout }); return true; } catch { return false; }
}

async function closeModals(page) {
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator("button.o-primary-btn--modal-close").first();
    if (await closeBtn.count()) { try { await closeBtn.click({ timeout: 800 }); } catch {} }
    const okBtn = page.locator("button.c-modal__confirm-btn").first();
    if (await okBtn.count()) { try { await okBtn.click({ timeout: 800 }); } catch {} }
    await page.waitForTimeout(250);
  }
}

async function settleOffline(page) {
  for (let i = 0; i < 60; i++) {
    const hasBar = await page.evaluate(() => !!(window.ui && window.ui.view && window.ui.view.modal && window.ui.view.modal.progressBar));
    if (!hasBar) return true;
    const skip = page.locator("button").filter({ hasText: /跳过/ }).first();
    if (await skip.count()) { try { await skip.click({ timeout: 1500 }); } catch {} }
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
    if (i % 10 === 0 && await page.evaluate(() => window.Player.canCrunch)) return true;
    await page.waitForTimeout(45);
  }
  return false;
}

async function firstCrunch(page) {
  await page.locator(".btn-big-crunch").click({ timeout: 8000 });
  await page.waitForTimeout(600);
  const confirm = page.locator("button.c-modal__confirm-btn").first();
  if (await confirm.count()) await confirm.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await closeModals(page);
}

const writeFile = (name, content) => fs.writeFileSync(`${EV}/${name}`, content);

// ═══════════════════════════════════════════════════════════════════════════
// S1 新档阶段门禁 + 反向用例（存档恢复 / URL）
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S1-new-save-gate";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page, "s1");
  await boot(page);
  await ensureDrawer(page);
  await shot(page, "s1-01-fresh-drawer");
  let st = await snapshot(page);
  writeFile("s1-01-fresh.json", JSON.stringify(st, null, 2));

  check(S, "fresh-progress-flags", !st.progress.infinity && !st.progress.eternity && !st.progress.reality,
    `infinity=${st.progress.infinity}, eternity=${st.progress.eternity}, reality=${st.progress.reality}`);
  check(S, "no-infinity-eternity-reality-tab", !st.tabAvail.infinity && !st.tabAvail.eternity && !st.tabAvail.reality,
    `avail infinity=${st.tabAvail.infinity}, eternity=${st.tabAvail.eternity}, reality=${st.tabAvail.reality}`);
  const banned = ["无限", "永恒", "现实", "天神"];
  check(S, "sidebar-has-no-locked-stage-entry", !banned.some(n => st.sidebarTabNames.some(t => t === n)),
    `sidebar=${JSON.stringify(st.sidebarTabNames)}`);
  check(S, "no-time-studies-subtab-in-dom", !st.subtabBar.some(t => /时间研究|永恒升级|永恒里程碑|时间维度/.test(t)),
    `subtabBar=${JSON.stringify(st.subtabBar)}`);
  check(S, "time-dimension-locked", st.timeDimensionUnlocked === false, `T.dimensions.time.isUnlocked=${st.timeDimensionUnlocked}`);
  // 子页签本身没有独立 condition（isUnlocked 恒为真），真正门禁在父页签：父页签不可用时不可达。
  check(S, "time-studies-parent-gated",
    !st.tabAvail.eternity && st.currentComponent !== "TimeStudiesTab" && !st.bodyHasTimeStudies,
    `eternityTabAvailable=${st.tabAvail.eternity}, studiesSubtabUnlocked=${st.eternityStudiesUnlocked}, comp=${st.currentComponent}, studiesText=${st.bodyHasTimeStudies}`);
  check(S, "no-locked-content-rendered", !st.bodyHasTimeStudies && !st.bodyHasReality,
    `timeStudies=${st.bodyHasTimeStudies}, reality=${st.bodyHasReality}, comp=${st.currentComponent}`);

  // 反向 1：手改存档 lastOpenTab=7（永恒）后刷新
  const crafted = await page.evaluate(() => {
    window.GameStorage.save(true);
    const raw = localStorage.getItem("dimensionSave");
    const root = window.GameSaveSerializer.deserialize(raw);
    const pl = root.saves[root.current];
    pl.options.lastOpenTab = 7;
    pl.options.lastOpenSubtab = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    pl.options.hiddenTabBits = 0;
    localStorage.setItem("dimensionSave", window.GameSaveSerializer.serialize(root));
    return { lastOpenTab: pl.options.lastOpenTab, rawLen: raw.length };
  });
  writeFile("s1-02-crafted-save.json", JSON.stringify(crafted, null, 2));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, "s1-02-restore-eternity-blocked");
  const rev1 = await snapshot(page);
  writeFile("s1-02-restore-eternity-blocked.json", JSON.stringify(rev1, null, 2));
  check(S, "reverse-save-restore-eternity-blocked",
    rev1.view.tab !== "eternity" && rev1.currentComponent !== "TimeStudiesTab" && !rev1.bodyHasTimeStudies && !rev1.tabAvail.eternity,
    `view=${rev1.view.tab}/${rev1.view.subtab}, comp=${rev1.currentComponent}, eternityAvail=${rev1.tabAvail.eternity}, studiesText=${rev1.bodyHasTimeStudies}`);

  // 反向 2：手改存档 lastOpenSubtab[0]=2（时间维度）
  await page.evaluate(() => {
    const root = window.GameSaveSerializer.deserialize(localStorage.getItem("dimensionSave"));
    const pl = root.saves[root.current];
    pl.options.lastOpenTab = 0;
    pl.options.lastOpenSubtab = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    localStorage.setItem("dimensionSave", window.GameSaveSerializer.serialize(root));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await shot(page, "s1-03-restore-time-dim-blocked");
  const rev2 = await snapshot(page);
  writeFile("s1-03-restore-time-dim-blocked.json", JSON.stringify(rev2, null, 2));
  check(S, "reverse-save-restore-time-dimension-blocked",
    rev2.view.subtab !== "time" && rev2.currentComponent !== "TimeDimensionsTab" && !rev2.bodyHasTimeStudies,
    `view=${rev2.view.tab}/${rev2.view.subtab}, comp=${rev2.currentComponent}, studiesText=${rev2.bodyHasTimeStudies}`);

  // 反向 3：URL hash / query
  await page.goto(BASE + "#eternity", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const rev3 = await snapshot(page);
  await page.goto(BASE + "?tab=eternity&subtab=studies", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const rev4 = await snapshot(page);
  await shot(page, "s1-04-url-hash-query-blocked");
  writeFile("s1-04-url.json", JSON.stringify({ hash: rev3.view, query: rev4.view, hashComp: rev3.currentComponent, queryComp: rev4.currentComponent }, null, 2));
  check(S, "reverse-url-hash-query-blocked",
    rev3.view.tab !== "eternity" && rev4.view.tab !== "eternity" && rev3.currentComponent !== "TimeStudiesTab" && rev4.currentComponent !== "TimeStudiesTab",
    `hash=${rev3.view.tab}/${rev3.view.subtab}, query=${rev4.view.tab}/${rev4.view.subtab}`);

  const pageErrors1 = logs.filter(l => l.type === "pageerror");
  check(S, "no-pageerror", pageErrors1.length === 0, `count=${pageErrors1.length}`);
  dumpLogs("s1", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S2 首次大坍缩 → 无限阶段（不得提前出现永恒入口 / 不得非法直达）
// ═══════════════════════════════════════════════════════════════════════════
let exportedSave = "";
let exportedState = null;
{
  const S = "S2-first-big-crunch";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page, "s2");
  await boot(page);
  const preBefore = await snapshot(page);

  const ready = await playToCrunch(page);
  check(S, "big-crunch-reachable-by-real-play", ready, `Player.canCrunch=${await page.evaluate(() => window.Player.canCrunch)}`);
  await shot(page, "s2-01-pre-crunch");
  const preState = await snapshot(page);
  writeFile("s2-01-pre-crunch.json", JSON.stringify({ preBefore, preState }, null, 2));
  check(S, "pre-crunch-still-locked", !preState.progress.infinity && !preState.tabAvail.infinity && !preState.tabAvail.eternity,
    `infinityUnlocked=${preState.progress.infinity}, infinityTab=${preState.tabAvail.infinity}, eternityTab=${preState.tabAvail.eternity}`);

  await firstCrunch(page);
  await shot(page, "s2-02-after-first-crunch");
  const post = await snapshot(page);
  writeFile("s2-02-after-first-crunch.json", JSON.stringify(post, null, 2));
  check(S, "first-crunch-enters-infinity-stage", post.progress.infinity && Number(post.player.infinities) >= 1,
    `infinityUnlocked=${post.progress.infinity}, infinities=${post.player.infinities}, IP=${post.player.infinityPoints}`);
  check(S, "no-eternity-entry-after-first-crunch", !post.tabAvail.eternity && !post.progress.eternity,
    `eternityTab=${post.tabAvail.eternity}, eternityUnlocked=${post.progress.eternity}`);
  check(S, "no-reality-entry-after-first-crunch", !post.tabAvail.reality, `realityTab=${post.tabAvail.reality}`);
  check(S, "no-time-studies-rendered-after-first-crunch", !post.bodyHasTimeStudies && post.currentComponent !== "TimeStudiesTab",
    `comp=${post.currentComponent}, studiesText=${post.bodyHasTimeStudies}`);

  // 实时观测：自动 Break 的触发点（应只发生在第 2 次及以后大坍缩）
  const timeline = [];
  let lastKey = "";
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const s = await page.evaluate(() => ({
      inf: window.player.infinities.toString(), break: window.player.break,
      eternityStageAllowed: window.OrekiSmartExecutor.eternityStageAllowed(),
      eternityTab: window.Tab.eternity.isAvailable, eternities: window.player.eternities.toString(),
    }));
    const key = JSON.stringify(s);
    if (key !== lastKey) { timeline.push({ atMs: Date.now() - t0, ...s }); lastKey = key; }
    if (s.break && Number(s.inf) >= 2) break;
    if (Date.now() - t0 > 45000) break;
    await page.waitForTimeout(100);
  }
  writeFile("s2-03-break-timeline.json", JSON.stringify(timeline, null, 2));
  const breakPoint = timeline.find(x => x.break);
  check(S, "auto-break-only-after-2nd-infinity",
    breakPoint !== undefined && Number(breakPoint.inf) >= 2,
    breakPoint ? `first break at infinities=${breakPoint.inf} (t+${breakPoint.atMs}ms)` : "no break within 45s (timeline=" + JSON.stringify(timeline) + ")");
  check(S, "eternity-not-unlocked-when-break-opens",
    breakPoint !== undefined && !breakPoint.eternityTab && breakPoint.eternities === "0",
    breakPoint ? `at break: eternityTab=${breakPoint.eternityTab}, eternities=${breakPoint.eternities}` : "n/a");
  await page.waitForTimeout(800);
  await ensureDrawer(page);
  await shot(page, "s2-04-post-break-drawer");
  const afterBreak = await snapshot(page);
  writeFile("s2-04-post-break.json", JSON.stringify(afterBreak, null, 2));
  check(S, "infinity-tab-available-after-crunch", afterBreak.tabAvail.infinity, `infinityTab=${afterBreak.tabAvail.infinity}`);
  check(S, "eternity-still-absent-after-break", !afterBreak.tabAvail.eternity && afterBreak.player.eternities === "0",
    `eternityTab=${afterBreak.tabAvail.eternity}, eternities=${afterBreak.player.eternities}`);
  check(S, "sidebar-no-eternity-reality-entry", !afterBreak.sidebarTabNames.some(t => t === "永恒" || t === "现实"),
    `sidebar=${JSON.stringify(afterBreak.sidebarTabNames)}`);

  // 反向：本条真实存档手改 lastOpenTab=7 后恢复，必须被拦截
  const crafted = await page.evaluate(() => {
    window.GameStorage.save(true);
    localStorage.setItem("r103-real-infinity-save", localStorage.getItem("dimensionSave"));
    const root = window.GameSaveSerializer.deserialize(localStorage.getItem("dimensionSave"));
    const pl = root.saves[root.current];
    pl.options.lastOpenTab = 7;
    pl.options.lastOpenSubtab = [0,0,0,0,0,0,0,0,0,0,0];
    pl.options.hiddenTabBits = 0;
    localStorage.setItem("dimensionSave", window.GameSaveSerializer.serialize(root));
    return { inf: pl.infinities, eternities: pl.eternities, lastOpenTab: pl.options.lastOpenTab };
  });
  writeFile("s2-05-crafted.json", JSON.stringify(crafted, null, 2));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, "s2-05-reverse-eternity-blocked");
  const revInf = await snapshot(page);
  writeFile("s2-05-reverse-eternity-blocked.json", JSON.stringify(revInf, null, 2));
  check(S, "reverse-post-crunch-save-cannot-reach-time-studies",
    revInf.view.tab !== "eternity" && revInf.currentComponent !== "TimeStudiesTab" && !revInf.bodyHasTimeStudies && !revInf.tabAvail.eternity,
    `view=${revInf.view.tab}/${revInf.view.subtab}, comp=${revInf.currentComponent}, eternityTab=${revInf.tabAvail.eternity}, studiesText=${revInf.bodyHasTimeStudies}`);

  // 正向：合法恢复（lastOpenTab=1 无限页）必须仍然生效
  await page.evaluate(() => {
    const root = window.GameSaveSerializer.deserialize(localStorage.getItem("r103-real-infinity-save"));
    const pl = root.saves[root.current];
    pl.options.lastOpenTab = 6; // 无限页（id 6，已解锁，合法恢复）
    pl.options.lastOpenSubtab = [0,0,0,0,0,0,0,0,0,0,0];
    pl.options.hiddenTabBits = 0;
    localStorage.setItem("dimensionSave", window.GameSaveSerializer.serialize(root));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await settleOffline(page);
  await shot(page, "s2-06-positive-restore-infinity");
  const pos = await snapshot(page);
  writeFile("s2-06-positive-restore.json", JSON.stringify(pos, null, 2));
  check(S, "positive-restore-unlocked-tab-still-works",
    pos.view.tab === "infinity" && pos.tabAvail.infinity && !pos.tabAvail.eternity,
    `view=${pos.view.tab}/${pos.view.subtab}, infinityTab=${pos.tabAvail.infinity}`);

  // 导出真实存档（UI 真实点击 → 剪贴板/隐藏 textarea），供 S4 导入与 S3 使用
  await openOptionsSaving(page);
  await clickAction(page, "导出存档");
  await page.waitForTimeout(800);
  const exported = await page.evaluate(async () => {
    let clip = "";
    try { clip = await navigator.clipboard.readText(); } catch (e) { clip = ""; }
    const ta = document.querySelector("body > textarea[readonly]");
    const fromTextarea = ta ? ta.value : "";
    const text = clip || fromTextarea;
    return { text, source: clip ? "clipboard" : "textarea", len: text.length, valid: !!window.GameSaveSerializer.deserialize(text) };
  });
  exportedSave = exported.text;
  exportedState = await snapshot(page);
  writeFile("s2-07-export.json", JSON.stringify({ len: exported.len, source: exported.source, valid: exported.valid, state: { infinities: exportedState.player.infinities, IP: exportedState.player.infinityPoints, stage: exportedState.exec.stage, view: exportedState.view } }, null, 2));
  writeFile("r103-real-infinity-save.txt", exportedSave);
  check(S, "real-save-exported-from-ui", exported.valid && exported.len > 500,
    `len=${exported.len}, source=${exported.source}, valid=${exported.valid}`);

  const pageErrors2 = logs.filter(l => l.type === "pageerror");
  check(S, "no-pageerror", pageErrors2.length === 0, `count=${pageErrors2.length}`);
  dumpLogs("s2", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S3 自动购买器：总开关 / 1s 与 60s 间隔 / 持久化 / 手动优先 / 不越阶段
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S3-autobuyer";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page, "s3");
  // 用 S2 的真实无限阶段存档开局
  await boot(page);
  await page.evaluate(save => localStorage.setItem("dimensionSave", save), exportedSave);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await settleOffline(page);
  await closeModals(page);
  const st0 = await snapshot(page);
  writeFile("s3-00-imported-stage.json", JSON.stringify({ view: st0.view, stage: st0.exec.stage, enabled: st0.exec.enabled, intervalSec: st0.exec.intervalSec, inf: st0.player.infinities }, null, 2));
  check(S, "stage-restored-from-real-save", st0.progress.infinity && st0.tabAvail.infinity && !st0.tabAvail.eternity,
    `infinity=${st0.progress.infinity}, infinityTab=${st0.tabAvail.infinity}, eternityTab=${st0.tabAvail.eternity}`);

  await openOptionsGameplay(page);
  await shot(page, "s3-01-options-gameplay");
  const ui0 = await page.evaluate(() => ({
    toggleText: document.querySelector(".c-oreki-sched__toggle")?.textContent.replace(/\s+/gu, " ").trim() ?? null,
    intervalShown: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()).slice(0, 3),
    inputValue: document.querySelector(".c-oreki-sched__field")?.value ?? null,
  }));
  writeFile("s3-01-ui.json", JSON.stringify(ui0, null, 2));
  check(S, "ui-shows-automation-on-default-10s",
    /启用/.test(ui0.toggleText || "") && (ui0.intervalShown || []).some(t => /10 秒/.test(t)) && ui0.inputValue === "10",
    `toggle="${ui0.toggleText}", labels=${JSON.stringify(ui0.intervalShown)}, input=${ui0.inputValue}`);

  // 基线：确认 MOD 调度器确实在按 10s 节拍真实执行
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
  let base = await waitExec(0, 3, 35000);
  writeFile("s3-02-baseline-exec.json", JSON.stringify(base, null, 2));
  check(S, "mod-scheduler-really-executing-10s-beat",
    base.fresh.length >= 3 && base.fresh.slice(1).every(x => x.gapMs === null || (x.gapMs >= 9500 && x.gapMs <= 11000)),
    `executions=${base.fresh.length}, gaps=${JSON.stringify(base.fresh.map(x => x.gapMs))}`);

  // 总开关关闭 → 立即停止
  const beforeOff = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { count: d.beat.log.length, lastAt: d.beat.lastAt, actionCount: d.actionCount, attemptCount: d.attemptCount, autobuyersOn: window.player.auto.autobuyersOn };
  });
  await page.locator(".c-oreki-sched__toggle").first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const offState = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { enabled: window.OrekiSmartExecutor.enabled, storedEnabled: localStorage.getItem("oreki.automation.enabled"), actionCount: d.actionCount, attemptCount: d.attemptCount, lastBeatAt: d.beat.lastAt, count: d.beat.log.length, autobuyersOn: window.player.auto.autobuyersOn, toggleText: document.querySelector(".c-oreki-sched__toggle")?.textContent.replace(/\s+/gu, " ").trim() };
  });
  await shot(page, "s3-03-switch-off");
  check(S, "switch-off-applies-immediately",
    offState.enabled === false && offState.storedEnabled === "0" && /关闭/.test(offState.toggleText || ""),
    `enabled=${offState.enabled}, stored=${offState.storedEnabled}, toggle="${offState.toggleText}"`);
  await page.waitForTimeout(5500);
  const afterOff = await page.evaluate(() => {
    const d = window.OrekiSmartExecutor.debugState();
    return { count: d.beat.log.length, lastBeatAt: d.beat.lastAt, actionCount: d.actionCount, attemptCount: d.attemptCount, enabled: window.OrekiSmartExecutor.enabled };
  });
  writeFile("s3-03-switch-off.json", JSON.stringify({ beforeOff, offState, afterOff }, null, 2));
  check(S, "mod-stops-executing-while-switch-off",
    afterOff.count === beforeOff.count && afterOff.lastBeatAt === beforeOff.lastAt && afterOff.actionCount === beforeOff.actionCount && afterOff.attemptCount === beforeOff.attemptCount,
    `execLog ${beforeOff.count}→${afterOff.count}, lastBeatAt ${Math.round(beforeOff.lastAt)}→${Math.round(afterOff.lastBeatAt)}, actions ${beforeOff.actionCount}→${afterOff.actionCount}`);
  check(S, "vanilla-autobuyers-not-disabled-by-mod-switch", offState.autobuyersOn === true,
    `player.auto.autobuyersOn=${offState.autobuyersOn}`);

  // 重新开启
  await page.locator(".c-oreki-sched__toggle").first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const onState = await page.evaluate(() => ({ enabled: window.OrekiSmartExecutor.enabled, stored: localStorage.getItem("oreki.automation.enabled") }));
  check(S, "switch-on-applies-immediately", onState.enabled === true && onState.stored === "1", `enabled=${onState.enabled}, stored=${onState.stored}`);

  // 间隔 = 1 秒
  await page.locator(".c-oreki-sched__field").fill("1");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
  await page.waitForTimeout(300);
  const set1 = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()) }));
  const mark1 = await page.evaluate(() => { const d = window.OrekiSmartExecutor.debugState(); return { lastAt: d.beat.lastAt, count: d.beat.log.length }; });
  const exec1 = await waitExec(mark1.lastAt, 3, 12000);
  const gaps1 = exec1.fresh.map(x => x.gapMs);
  writeFile("s3-04-interval-1s.json", JSON.stringify({ set1, mark1, exec1 }, null, 2));
  await shot(page, "s3-04-interval-1s");
  check(S, "interval-1s-applied-and-stored", set1.intervalSec === 1 && set1.stored === "1" && (set1.labels || []).some(t => /调度间隔 1 秒/.test(t)),
    `interval=${set1.intervalSec}, stored=${set1.stored}, labels=${JSON.stringify(set1.labels)}`);
  check(S, "interval-1s-takes-effect", exec1.fresh.length >= 3 && gaps1.slice(1).every(g => g !== null && g >= 600 && g <= 2600),
    `executions=${exec1.fresh.length}, gaps=${JSON.stringify(gaps1)}`);

  // 间隔 = 60 秒
  await page.locator(".c-oreki-sched__field").fill("60");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const set60 = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()), lastAt: window.OrekiSmartExecutor.debugState().beat.lastAt, count: window.OrekiSmartExecutor.debugState().beat.log.length }));
  const deadline60 = Date.now() + 80000;
  let newEntry60 = null;
  while (Date.now() < deadline60) {
    const d = await page.evaluate(() => { const s = window.OrekiSmartExecutor.debugState(); return { count: s.beat.log.length, last: s.beat.log.length ? s.beat.log[s.beat.log.length - 1] : null }; });
    if (d.count > set60.count && d.last && d.last.at > set60.lastAt) { newEntry60 = d.last; break; }
    await page.waitForTimeout(150);
  }
  const gap60 = newEntry60 ? Math.round(newEntry60.gapMs ?? -1) : null;
  const exec60 = { waitedMs: 80000 - (deadline60 - Date.now()), entry: newEntry60 };
  writeFile("s3-05-interval-60s.json", JSON.stringify({ set60, exec60 }, null, 2));
  await shot(page, "s3-05-interval-60s");
  check(S, "interval-60s-applied-and-stored", set60.intervalSec === 60 && set60.stored === "60" && (set60.labels || []).some(t => /调度间隔 60 秒/.test(t)),
    `interval=${set60.intervalSec}, stored=${set60.stored}, labels=${JSON.stringify(set60.labels)}`);
  check(S, "interval-60s-takes-effect", newEntry60 !== null && gap60 !== null && gap60 >= 58000 && gap60 <= 63000,
    `executions=+${newEntry60 ? 1 : 0}, gap=${gap60}ms, entry=${JSON.stringify(newEntry60)}`);

  // 持久化验证：60 秒配置在刷新后保留
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await settleOffline(page);
  await closeModals(page);
  const persisted60 = await page.evaluate(() => ({ enabled: window.OrekiSmartExecutor.enabled, intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), stage: window.OrekiSmartExecutor.debugState().stage?.id, hasEternity: window.Tab.eternity.isAvailable }));
  writeFile("s3-06-persist.json", JSON.stringify(persisted60, null, 2));
  await shot(page, "s3-06-persist-after-reload");
  check(S, "interval-60s-persists-after-reload", persisted60.enabled === true && persisted60.intervalSec === 60 && persisted60.stored === "60",
    `enabled=${persisted60.enabled}, interval=${persisted60.intervalSec}, stored=${persisted60.stored}`);
  check(S, "stage-not-advanced-by-reload", persisted60.hasEternity === false, `eternityTab=${persisted60.hasEternity}, stage=${persisted60.stage}`);

  // 手动优先：有效间隔 1 秒下，手动点击后 smart 执行层应进入让路窗口
  await settleOffline(page);
  await openOptionsGameplay(page);
  await page.locator(".c-oreki-sched__field").fill("1");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await clickTab(page, "维度");
  await closeDrawer(page);
  // 等所有遮罩消失，避免把「点不到按钮」误判成「手动操作未被记录」
  for (let i = 0; i < 20; i++) {
    const hasOverlay = await page.evaluate(() => !!document.querySelector(".l-modal-overlay"));
    if (!hasOverlay) break;
    await settleOffline(page);
    await closeModals(page);
    await page.waitForTimeout(400);
  }
  const manualBefore = await page.evaluate(() => ({ mc: window.OrekiSmartExecutor.debugState().manualClickCount, ac: window.OrekiSmartExecutor.debugState().actionCount, count: window.OrekiSmartExecutor.debugState().beat.log.length, am: window.player.antimatter.toString() }));
  // 优先点真实购买按钮；本帧没有可买按钮时，退化为点击游戏内容区（监听器把 #ui 内任意手动点击都算让路）
  let manualAction = "none";
  const buyBtn = page.locator("#ui button:not([disabled]), #ui .o-primary-btn:not(.o-primary-btn--disabled)").filter({ hasText: /购买|买到/ }).first();
  if (await buyBtn.count()) {
    try { await buyBtn.click({ timeout: 3000 }); manualAction = "buy:" + ((await buyBtn.textContent()) || "").replace(/\s+/gu, " ").trim().slice(0, 24); } catch {}
  }
  if (manualAction === "none") {
    try { await page.locator("#ui").click({ position: { x: 60, y: 140 }, timeout: 3000 }); manualAction = "content-area-click"; } catch {}
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
  writeFile("s3-07-manual.json", JSON.stringify({ manualBefore, manualAfter, manualLater, manualAction }, null, 2));
  await shot(page, "s3-07-manual-hold");
  check(S, "manual-click-recorded-and-mod-yields",
    manualAction !== "none" && manualAfter.mc > manualBefore.mc && manualAfter.hold !== null && manualAfter.hold.remainSec > 50,
    `manualAction=${manualAction}, manualClick ${manualBefore.mc}→${manualAfter.mc}, hold=${JSON.stringify(manualAfter.hold)}`);
  check(S, "mod-verb-layer-not-acting-during-manual-hold",
    manualLater.ac === manualBefore.ac,
    `actionCount ${manualBefore.ac}→${manualLater.ac}, attemptCount=${manualLater.attemptCount}, holdRemain=${manualLater.hold?.remainSec}`);

  // 不越阶段：永恒仍未解锁，任何任务都不得产出永恒入口
  const stageCheck = await snapshot(page);
  const eternityTasks = stageCheck.exec.execLog.filter(x => /eternity|reality|celestial|perk|endgame/.test(x.task)).map(x => x.task);
  writeFile("s3-08-stage.json", JSON.stringify({ eternities: stageCheck.player.eternities, eternityTab: stageCheck.tabAvail.eternity, eternityStageAllowed: stageCheck.exec.eternityStageAllowed, eternityTasks, stage: stageCheck.exec.stage }, null, 2));
  check(S, "no-eternity-layer-entry-while-eternities-zero",
    stageCheck.player.eternities === "0" && !stageCheck.tabAvail.eternity && !stageCheck.bodyHasTimeStudies,
    `eternities=${stageCheck.player.eternities}, eternityTab=${stageCheck.tabAvail.eternity}, studiesText=${stageCheck.bodyHasTimeStudies}`);
  check(S, "no-eternity-reality-tasks-executed-while-zero-eternities",
    eternityTasks.filter(t => /eternity|eternityReset/.test(t)).length === 0,
    `tasks=${JSON.stringify(eternityTasks)}, eternityStageAllowed=${stageCheck.exec.eternityStageAllowed}`);

  const pageErrors3 = logs.filter(l => l.type === "pageerror");
  check(S, "no-pageerror", pageErrors3.length === 0, `count=${pageErrors3.length}`);
  dumpLogs("s3", logs);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// S4 存档导入：合法存档导入后入口/资源一致；刷新/重开不丢设置
// ═══════════════════════════════════════════════════════════════════════════
{
  const S = "S4-save-import";
  const ctx = await newContext();
  const page = await ctx.newPage();
  const logs = attachLogs(page, "s4");
  await boot(page);
  const fresh = await snapshot(page);
  check(S, "fresh-before-import", !fresh.progress.infinity && !fresh.tabAvail.eternity, `infinity=${fresh.progress.infinity}`);

  await openOptionsSaving(page);
  await clickAction(page, "导入存档");
  await page.waitForTimeout(500);
  await page.locator(".c-modal-import__input").fill(exportedSave);
  await page.waitForTimeout(800);
  const modalInfo = await page.evaluate(() => ({
    text: (document.querySelector(".c-modal-import__save-info")?.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 300),
    confirmExists: !!document.querySelector(".c-modal__confirm-btn"),
  }));
  await shot(page, "s4-01-import-modal");
  writeFile("s4-01-import-modal.json", JSON.stringify(modalInfo, null, 2));
  check(S, "import-modal-recognizes-save", modalInfo.confirmExists && /反物质/.test(modalInfo.text), `info="${modalInfo.text.slice(0, 120)}"`);
  await page.locator("button.c-modal__confirm-btn").first().click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  await settleOffline(page);
  await closeModals(page);
  await page.waitForTimeout(500);
  const imported = await snapshot(page);
  writeFile("s4-02-imported.json", JSON.stringify({ imported, exported: { infinities: exportedState.player.infinities, IP: exportedState.player.infinityPoints, antimatter: exportedState.player.antimatter } }, null, 2));
  await shot(page, "s4-02-imported-stage");
  check(S, "imported-stage-matches-save",
    imported.progress.infinity === true && Number(imported.player.infinities) >= Number(exportedState.player.infinities),
    `infinityUnlocked=${imported.progress.infinity}, infinities=${imported.player.infinities} (exported ${exportedState.player.infinities})`);
  check(S, "imported-entry-matches-stage", imported.tabAvail.infinity === true && imported.tabAvail.eternity === false,
    `infinityTab=${imported.tabAvail.infinity}, eternityTab=${imported.tabAvail.eternity}, realityTab=${imported.tabAvail.reality}`);
  check(S, "imported-no-eternity-content", !imported.bodyHasTimeStudies, `studiesText=${imported.bodyHasTimeStudies}, comp=${imported.currentComponent}`);

  // 设置项：MOD 间隔 1 秒，刷新后不丢
  await openOptionsGameplay(page);
  await page.locator(".c-oreki-sched__field").fill("1");
  await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
  await page.waitForTimeout(300);
  const preReload = await page.evaluate(() => ({ intervalSec: window.OrekiSmartExecutor.intervalSec, stored: localStorage.getItem("oreki.automation.intervalSec"), infinities: window.player.infinities.toString(), stage: window.OrekiSmartExecutor.debugState().stage?.id }));
  // 导入存档的离线模拟会占用 30 秒自动存档窗口（模拟期间 canSave()=false，原版语义）。
  // 真实玩家流程是等自动存档写入后再刷新；这里等待真实自动存档落盘，而不是绕过存档通道。
  const importedInf = Number(exportedState.player.infinities);
  let persistInfo = null;
  const persistT0 = Date.now();
  while (Date.now() - persistT0 < 60000) {
    persistInfo = await page.evaluate(() => {
      const raw = localStorage.getItem("dimensionSave");
      if (!raw) return null;
      try {
        const root = window.GameSaveSerializer.deserialize(raw);
        const pl = root.saves[root.current];
        return pl ? { inf: String(pl.infinities), ip: String(pl.infinityPoints) } : null;
      } catch (e) { return null; }
    });
    if (persistInfo && Number(persistInfo.inf) >= importedInf) break;
    await page.waitForTimeout(1000);
  }
  const persistWaitedMs = Date.now() - persistT0;
  writeFile("s4-02b-autosave-persist.json", JSON.stringify({ persistWaitedMs, persistInfo, importedInf }, null, 2));
  check(S, "import-persisted-by-real-autosave", persistInfo !== null && Number(persistInfo.inf) >= importedInf,
    `waited=${persistWaitedMs}ms, savedInfinities=${persistInfo?.inf}, importedInfinities=${importedInf}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.player && window.Tab && window.Tabs && window.OrekiSmartExecutor, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await settleOffline(page);
  await closeModals(page);
  const postReload = await snapshot(page);
  writeFile("s4-03-reload-persist.json", JSON.stringify({ preReload, postReload: { view: postReload.view, progress: postReload.progress, infinities: postReload.player.infinities, intervalSec: postReload.exec.intervalSec, enabled: postReload.exec.enabled, stage: postReload.exec.stage, tabAvail: postReload.tabAvail } }, null, 2));
  await shot(page, "s4-03-after-reload");
  check(S, "settings-persist-after-reload", postReload.exec.intervalSec === 1 && postReload.exec.enabled === true,
    `interval=${postReload.exec.intervalSec}, enabled=${postReload.exec.enabled}`);
  check(S, "stage-and-resources-persist-after-reload",
    postReload.progress.infinity === true && postReload.tabAvail.infinity === true && postReload.exec.stage !== "preInfinity",
    `infinities ${preReload.infinities}→${postReload.player.infinities}, stage=${postReload.exec.stage}, infinityTab=${postReload.tabAvail.infinity}`);
  check(S, "reload-does-not-show-eternity-entry", postReload.tabAvail.eternity === false, `eternityTab=${postReload.tabAvail.eternity}`);

  const pageErrors4 = logs.filter(l => l.type === "pageerror");
  check(S, "no-pageerror", pageErrors4.length === 0, `count=${pageErrors4.length}`);
  dumpLogs("s4", logs);
  await ctx.close();
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: "412x839 (Pixel 7 mobile, touch, DPR 2.625)",
  totals: results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
  results,
};
fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(summary, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(summary.totals));
console.log("evidence:", EV);
process.exit(results.some(r => r.status === "FAIL") ? 1 : 0);