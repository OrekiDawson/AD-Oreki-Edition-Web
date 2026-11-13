// R107-01 EP e4000 墙现场取证（只读探针；不改任何 player 字段）
//
// 目的：在 realities 卡住 / EP 指数冻结的现场，导出 EP 增益公式输入与自动化状态，
// 判断 EP 不涨是「公式输入不增长」还是「EP mult/时间研究未购买」。
//
// 加速方式（Lead 允许）：真实 UI 把「智能自动操作」间隔设为 1s、游戏速度设为 100000×
// （两者都是产品内玩家可配置项）；不修改 Date.now/performance.now，不写进度字段。
//
// 运行：node reports/R107-01/ep-wall-fix/probe-ep-wall.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = REPO + "/reports/R107-01/ep-wall-fix/probe";
fs.mkdirSync(OUT, { recursive: true });
const LOOP = OUT + "/samples.jsonl";
fs.writeFileSync(LOOP, "");
const log = (...a) => { const s = "[" + new Date().toISOString() + "] " + a.join(" "); console.log(s); fs.appendFileSync(OUT + "/probe.log", s + "\n"); };

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webm": "video/webm", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon", ".map": "application/json", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const server = http.createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(REPO, p);
  fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }); rs.end(d); });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = "http://127.0.0.1:" + PORT + "/";

const req = createRequire("/home/oreki/.npm/_npx/e41f203b7505f1fb/noop.js");
const { chromium } = req("playwright");
const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: "zh-CN",
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36" });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const pageErrors = [];
const consoleLog = [];
page.on("pageerror", e => pageErrors.push(String(e.message).slice(0, 800)));
page.on("console", m => { if (m.type() === "error") consoleLog.push(m.text().slice(0, 400)); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.player && window.Tab && window.OrekiSmartExecutor, null, { timeout: 90000 });
await page.waitForTimeout(1200);

// ── 真实 UI 设置：间隔 1s + 游戏速度 100000× ─────────────────────────────
async function openDrawer() {
  const t = page.locator(".c-oreki-nav__toggle");
  if (!(await t.count())) return;
  if ((await t.first().getAttribute("aria-expanded")) !== "true") { try { await t.first().click({ timeout: 5000 }); } catch (e) { /* ignore */ } }
  await page.waitForTimeout(350);
}
async function closeDrawer() {
  const t = page.locator(".c-oreki-nav__toggle");
  if (!(await t.count())) return;
  if ((await t.first().getAttribute("aria-expanded")) !== "true") return;
  const vp = page.viewportSize() || { width: 412, height: 915 };
  try { await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2)); } catch (e) { /* ignore */ }
  await page.waitForTimeout(400);
}
async function dismissModals() {
  for (let round = 0; round < 10; round++) {
    let clicked = false;
    for (const re of [/嗯呐/, /^确定$/, /^关闭$/, /^继续$/, /^知道了$/, /^跳过$/]) {
      const btn = page.locator("button:visible, .o-primary-btn:visible").filter({ hasText: re }).first();
      if (await btn.count()) { try { await btn.click({ timeout: 900 }); clicked = true; break; } catch (e) { /* ignore */ } }
    }
    if (!clicked) return;
    await page.waitForTimeout(250);
  }
}
async function clearCrunchScreen() {
  const need = await page.evaluate(() => { try { return !!(window.Player.canCrunch && !window.player.break); } catch (e) { return false; } });
  if (!need) return false;
  try { await page.locator(".btn-big-crunch").click({ timeout: 4000 }); } catch (e) { /* ignore */ }
  await page.waitForTimeout(500);
  const c = page.locator("button.c-modal__confirm-btn").first();
  if (await c.count()) { try { await c.click({ timeout: 3000 }); } catch (e) { /* ignore */ } }
  await page.waitForTimeout(1000);
  return true;
}
async function gotoOptionsGameplay() {
  await dismissModals();
  await clearCrunchScreen();
  await openDrawer();
  await page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: "选项" }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
  await openDrawer();
  await page.locator(".o-tab-btn--subtab").filter({ hasText: "游戏玩法" }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(450);
  await closeDrawer();
}
let applied = { interval: null, speed: null };
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    await gotoOptionsGameplay();
    const field = page.locator(".c-oreki-sched__field");
    if ((await field.count()) > 0) {
      if (applied.interval !== 1) {
        await field.fill("1");
        await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
        await page.waitForTimeout(350);
        applied.interval = await page.evaluate(() => window.OrekiSmartExecutor.intervalSec);
      }
      if (applied.speed !== 100000) {
        const sf = page.locator(".c-oreki-speed__field");
        if (await sf.count()) {
          await sf.fill("100000");
          await page.locator(".c-oreki-speed__apply").click({ timeout: 5000 });
          await page.waitForTimeout(350);
          applied.speed = await page.evaluate(() => window.GameSpeed.factor);
        }
      }
    }
    if (applied.interval === 1 && applied.speed === 100000) break;
  } catch (e) { /* retry */ }
  await page.waitForTimeout(1200);
}
log("applied", JSON.stringify(applied));
// 回维度页
try { await openDrawer(); await page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: "维度" }).first().click({ timeout: 6000 }); await page.waitForTimeout(300); await closeDrawer(); } catch (e) { /* ignore */ }

const T0 = Date.now();
const wall = () => Math.round((Date.now() - T0) / 100) / 10;

// ── 采样（只读）─────────────────────────────────────────────────────────
const sample = async (deep) => page.evaluate((wantDeep) => {
  const T = (fn) => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return "ERR:" + String(e && e.message || e).slice(0, 100); } };
  const lg = (v) => { try { const x = Number(v.log10()); return Number.isFinite(x) ? Math.round(x * 1e2) / 1e2 : x; } catch (e) { return null; } };
  const s = {
    wall_sec: null,
    realities: T(() => player.realities),
    etLog10: T(() => lg(player.eternities)),
    epLog10: T(() => { try { return Math.round(Number(Currency.eternityPoints.value.log10()) * 1e2) / 1e2; } catch (e) { return null; } }),
    maxEpExponent: T(() => player.records.thisReality.maxEP.exponent),
    maxEPLog10: T(() => lg(player.records.thisReality.maxEP)),
    maxIPLog10: T(() => lg(player.records.thisEternity.maxIP)),
    gainedEPLog10: T(() => lg(window.gainedEternityPoints())),
    gainedIPLog10: T(() => lg(window.gainedInfinityPoints())),
    ttLog10: T(() => lg(Currency.timeTheorems.value)),
    ttPurchased: T(() => (typeof TimeTheorems !== "undefined" && TimeTheorems.totalPurchased ? TimeTheorems.totalPurchased() : null)),
    ds6: T(() => TimeStudy.reality.isBought === true),
    dsN: T(() => player.dilation.studies.length),
    ecDone: T(() => { const a = []; for (let i = 1; i <= 12; i++) { try { a.push(EternityChallenge(i).completions); } catch (e) { a.push("?"); } } return a.join(","); }),
    isRealityAvailable: T(() => (typeof window.isRealityAvailable === "function" ? window.isRealityAvailable() : null)),
    isBootstrap: T(() => (typeof PlayerProgress !== "undefined" && PlayerProgress.realityUnlocked()) ? (TimeStudy.reality.isBought !== true) : true),
    gameSpeed: T(() => (window.GameSpeed && window.GameSpeed.factor) || null),
    dimBoost: T(() => player.dimensionBoosts),
    gal: T(() => player.galaxies),
    id1Unl: T(() => { try { return InfinityDimension(1).isUnlocked === true; } catch (e) { return null; } }),
    canEternity: T(() => { try { return Player.canEternity === true; } catch (e) { return null; } }),
    stage: T(() => window.OrekiSmartExecutor.debugState().stage?.id ?? null),
    goal: T(() => window.OrekiSmartExecutor.debugState().goal?.id ?? null),
    blockers: T(() => window.OrekiSmartExecutor.debugState().blockers ?? null),
    lastAction: T(() => { const a = window.OrekiSmartExecutor.debugState().lastAction; return a ? { label: a.label, acted: a.acted } : null; }),
    visitedTabs: null,
  };
  s.wall_sec = null;
  if (wantDeep) {
    s.deep = {
      isRealityAvailable: T(() => (typeof window.isRealityAvailable === "function" ? window.isRealityAvailable() : null)),
      thisRealityMaxEP: T(() => String(player.records.thisReality.maxEP)),
      thisRealityMaxEPExponent: T(() => player.records.thisReality.maxEP.exponent),
      thisEternityMaxIP: T(() => String(player.records.thisEternity.maxIP)),
      gainedEternityPoints: T(() => String(window.gainedEternityPoints())),
      gainedInfinityPoints: T(() => String(window.gainedInfinityPoints())),
      currentEP: T(() => String(Currency.eternityPoints.value)),
      currentIP: T(() => String(Currency.infinityPoints.value)),
      timeTheorems: T(() => String(Currency.timeTheorems.value)),
      timeTheoremTotalPurchased: T(() => (typeof TimeTheorems !== "undefined" && TimeTheorems.totalPurchased ? TimeTheorems.totalPurchased() : null)),
      timeStudiesBought: T(() => { const a = []; for (const st of GameDatabase.eternity.timeStudies.normal) { try { if (TimeStudy(st.id).isBought) a.push(st.id); } catch (e) { /* ignore */ } } return a; }),
      eternityUpgradeBits: T(() => player.eternityUpgrades && player.eternityUpgrades.size !== undefined ? player.eternityUpgrades.size : null),
      eternityUpgradesStr: T(() => { try { return String(player.eternityUpgrades); } catch (e) { return null; } }),
      dilation: T(() => ({ studies: player.dilation.studies.slice(), dilatedTime: String(player.dilation.dilatedTime), totalTachyonParticles: String(player.dilation.totalTachyonParticles), nextThreshold: String(player.dilation.nextThreshold) })),
      realityUpgradesBought: T(() => { const a = []; for (let i = 1; i <= 25; i++) { try { if (RealityUpgrade(i).isBought) a.push(i); } catch (e) { /* ignore */ } } return a; }),
      ach147: T(() => { try { return Achievement(147).isUnlocked === true; } catch (e) { return null; } }),
      ach116: T(() => { try { return Achievement(116).isUnlocked === true; } catch (e) { return null; } }),
      teresa: T(() => { try { return Teresa.isUnlocked === true; } catch (e) { return null; } }),
      pelle: T(() => { try { return Pelle.isUnlocked === true; } catch (e) { return null; } }),
      doomed: T(() => { try { return Pelle.isDoomed === true; } catch (e) { return null; } }),
      eternityMilestones: T(() => { try { return Object.keys(EternityMilestone).map(k => k + ":" + (EternityMilestone[k].isReached === true)); } catch (e) { return null; } }),
      gameSpeed: T(() => (window.GameSpeed && window.GameSpeed.factor) || null),
      intervalSec: T(() => window.OrekiSmartExecutor.intervalSec),
      executor: T(() => { const d = window.OrekiSmartExecutor.debugState(); return { stage: d.stage, goal: d.goal, blockers: d.blockers, lastAction: d.lastAction, lastResult: d.lastResult, beat: d.beat, actionCount: d.actionCount, attemptCount: d.attemptCount, manualHold: d.manualHold, lastError: d.lastError }; }),
      challenge: T(() => ({ normalBits: player.challenge.normal.completedBits, infinityBits: player.challenge.infinity.completedBits, ecUnlocked: player.challenge.eternity.unlocked, ecCurrent: player.challenge.eternity.current })),
      autoReality: T(() => (player.auto && player.auto.reality) || null),
      autoEternity: T(() => (player.auto && player.auto.eternity) || null),
      autoOn: T(() => player.auto && player.auto.autobuyersOn),
      am: T(() => String(player.antimatter)),
      dims: T(() => { const a = []; for (let i = 1; i <= 8; i++) { try { a.push({ i, amount: String(AntimatterDimension(i).amount), bought: AntimatterDimension(i).bought, isAvailable: AntimatterDimension(i).isAvailable }); } catch (e) { a.push("ERR"); } } return a; }),
      tickspeed: T(() => ({ amount: String(Tickspeed.amount), bought: Tickspeed.bought, isAvailable: Tickspeed.isAvailable })),
      dimBoostState: T(() => ({ canBeBought: DimensionBoost.canBeBought, requires: DimensionBoost.requirement, bought: player.dimensionBoosts, galaxies: player.galaxies })),
      breakFlag: T(() => player.break === true),
      infinityGoal: T(() => String(Player.infinityGoal)),
      autoDims: T(() => { const o = {}; try { for (const k of Object.keys(player.auto)) { const v = player.auto[k]; if (v && typeof v === "object" && "isActive" in v) o[k] = v.isActive === true; } } catch (e) { /* ignore */ } return o; }),
      autoUpgrades: T(() => { try { return { infinityUpgrades: player.auto.infinityUpgrades ? player.auto.infinityUpgrades.isActive : null, bigCrunch: player.auto.bigCrunch ? player.auto.bigCrunch.isActive : null, eternity: player.auto.eternity ? player.auto.eternity.isActive : null, reality: player.auto.reality ? player.auto.reality.isActive : null }; } catch (e) { return null; } }),
      infinityUpgradeBits: T(() => player.infinityUpgradeBits ?? null),
      achievements34: T(() => { try { return Achievement(34).isUnlocked; } catch (e) { return null; } }),
      achievements111: T(() => { try { return Achievement(111).isUnlocked; } catch (e) { return null; } }),
      recordsInfinity: T(() => ({ maxAM: String(player.records.thisInfinity.maxAM), bestIP: String(player.records.thisInfinity.bestIP ?? 0), realTime: player.records.thisInfinity.realTime })),
      records: T(() => ({ thisReality: { maxEP: String(player.records.thisReality.maxEP), maxAM: String(player.records.thisReality.maxAM), realTime: player.records.thisReality.realTime }, thisEternity: { maxIP: String(player.records.thisEternity.maxIP), maxAM: String(player.records.thisEternity.maxAM) }, totalTimePlayed: player.records.totalTimePlayed })),
    };
  }
  return s;
}, deep);

const deeps = {};
const states = [];
let firstWallAt = null;
let lastEP = null;
const MAX_WALL = 1200;
while (wall() < MAX_WALL) {
  let st;
  try { st = await sample(false); } catch (e) { await page.waitForTimeout(1000); continue; }
  st.wall_sec = wall();
  states.push(st);
  fs.appendFileSync(LOOP, JSON.stringify(st) + "\n");
  // 到达关键节点的深快照
  const key = st.realities >= 15 ? "r15" : st.realities >= 10 ? "r10" : st.realities >= 5 ? "r5" : null;
  if (key && !deeps[key]) {
    try { const d = await sample(true); d.wall_sec = wall(); d.key = key; deeps[key] = d; fs.writeFileSync(OUT + "/deep-" + key + ".json", JSON.stringify(d, null, 2)); log("deep snapshot", key, "wall", d.wall_sec, "realities", d.realities, "epLog10", d.epLog10); } catch (e) { log("deep fail", key, String(e)); }
  }
  if (st.realities >= 15 && firstWallAt === null) { firstWallAt = st.wall_sec; log("reach realities=15 at wall", firstWallAt, "epLog10", st.epLog10); }
  // 崩塌检测：realities 已到 15 后，维度/ID 状态被重置（dimBoost<=10 且 ID1 未解锁）而 AM 停滞
  if (st.realities >= 15 && st.dimBoost <= 10 && st.id1Unl === false && !deeps["collapse"]) {
    try { const d = await sample(true); d.wall_sec = wall(); d.key = "collapse"; deeps["collapse"] = d; fs.writeFileSync(OUT + "/deep-collapse.json", JSON.stringify(d, null, 2)); log("deep snapshot collapse wall", d.wall_sec, "realities", d.realities, "epLog10", d.epLog10, "dimBoost", d.deep && d.deep.dimBoostState && d.deep.dimBoostState.bought); } catch (e) { log("deep fail collapse", String(e)); }
  }
  if (st.realities >= 15 && firstWallAt !== null && wall() - firstWallAt >= 300 && !deeps["r15+300"]) {
    try { const d = await sample(true); d.wall_sec = wall(); d.key = "r15+300"; deeps["r15+300"] = d; fs.writeFileSync(OUT + "/deep-r15-plus300.json", JSON.stringify(d, null, 2)); log("deep snapshot r15+300 wall", d.wall_sec, "realities", d.realities, "epLog10", d.epLog10); } catch (e) { log("deep fail r15+300", String(e)); }
  }
  if (firstWallAt !== null && wall() - firstWallAt >= 60 && !deeps["r15+60"]) {
    try { const d = await sample(true); d.wall_sec = wall(); d.key = "r15+60"; deeps["r15+60"] = d; fs.writeFileSync(OUT + "/deep-r15-plus60.json", JSON.stringify(d, null, 2)); log("deep snapshot r15+60 wall", d.wall_sec, "realities", d.realities, "epLog10", d.epLog10); } catch (e) { log("deep fail r15+60", String(e)); }
  }
  if (st.realities >= 20 || (st.realities >= 15 && st.isRealityAvailable === true)) { log("progress past wall", JSON.stringify({ realities: st.realities, epLog10: st.epLog10, isRealityAvailable: st.isRealityAvailable })); break; }
  lastEP = st.epLog10;
  await page.waitForTimeout(1000);
}

const summary = {
  generatedAt: new Date().toISOString(),
  repo: REPO,
  head: fs.existsSync(REPO + "/.git/HEAD") ? "see source-snapshot" : null,
  applied,
  firstReality15WallSec: firstWallAt,
  lastEPLog10: lastEP,
  states: states.length,
  deepKeys: Object.keys(deeps),
  pageErrors,
  consoleErrors: consoleLog.slice(0, 20),
  note: "只读探针；间隔 1s、游戏速度 100000× 均为真实 UI 设置的玩家可配置项；未写任何 player 字段。",
};
fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2) + "\n");
log("done", JSON.stringify({ states: states.length, deepKeys: Object.keys(deeps), pageErrors: pageErrors.length }));
await browser.close();
await new Promise(r => server.close(r));
