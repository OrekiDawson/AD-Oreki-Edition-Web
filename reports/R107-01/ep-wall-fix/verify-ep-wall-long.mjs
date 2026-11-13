// R107-01 EP e4000 墙「冻结现场」诊断（单浏览器，低负载；只读 + 页面内 200ms 只读跟踪）
//
// 复现条件：间隔 1s、游戏速度固定（默认 10000×，可用 FIX_SPEED 覆盖）、动态速度关闭。
const FIX_SPEED = Number(process.env.FIX_SPEED || 10000);
// 到达 realities>=15 后，若 AM/维度连续 20s 不变（判定为冻结），安装 200ms 只读跟踪 20s，
// 记录 AM/维度/boost/galaxy/tick/无限次数/IP/crunch 自动器/执行层 served 的逐帧变化，
// 用于回答「为什么 AM 停在 startingValue、维度为 0」。
//
// 不改任何 player 字段；速度/间隔都是产品内玩家可配置项。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = REPO + "/reports/R107-01/ep-wall-fix/" + (process.env.DIAG_OUT || "verify-fix-long");
fs.mkdirSync(OUT, { recursive: true });
const LOOP = OUT + "/samples.jsonl";
fs.writeFileSync(LOOP, "");
const log = (...a) => { const s = "[" + new Date().toISOString() + "] " + a.join(" "); console.log(s); fs.appendFileSync(OUT + "/diag.log", s + "\n"); };

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webm": "video/webm", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon", ".map": "application/json", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const server = http.createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(REPO, p);
  fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }); rs.end(d); });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port + "/";
const req = createRequire("/home/oreki/.npm/_npx/e41f203b7505f1fb/noop.js");
const { chromium } = req("playwright");
const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--mute-audio", "--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: "zh-CN", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36" });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const pageErrors = []; const consoleErrors = [];
page.on("pageerror", e => pageErrors.push(String(e.message).slice(0, 500)));
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.player && window.Tab && window.OrekiSmartExecutor, null, { timeout: 90000 });
await page.waitForTimeout(1200);

async function openDrawer() { const t = page.locator(".c-oreki-nav__toggle"); if (!(await t.count())) return; if ((await t.first().getAttribute("aria-expanded")) !== "true") { try { await t.first().click({ timeout: 5000 }); } catch (e) {} } await page.waitForTimeout(320); }
async function closeDrawer() { const t = page.locator(".c-oreki-nav__toggle"); if (!(await t.count())) return; if ((await t.first().getAttribute("aria-expanded")) !== "true") return; const vp = page.viewportSize() || { width: 412, height: 915 }; try { await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2)); } catch (e) {} await page.waitForTimeout(380); }
async function dismissModals() { for (let r = 0; r < 10; r++) { let c = false; for (const re of [/嗯呐/, /^确定$/, /^关闭$/, /^继续$/, /^知道了$/, /^跳过$/]) { const b = page.locator("button:visible, .o-primary-btn:visible").filter({ hasText: re }).first(); if (await b.count()) { try { await b.click({ timeout: 900 }); c = true; break; } catch (e) {} } } if (!c) return; await page.waitForTimeout(230); } }
async function clearCrunchScreen() { const need = await page.evaluate(() => { try { return !!(window.Player.canCrunch && !window.player.break); } catch (e) { return false; } }); if (!need) return false; try { await page.locator(".btn-big-crunch").click({ timeout: 4000 }); } catch (e) {} await page.waitForTimeout(500); const c = page.locator("button.c-modal__confirm-btn").first(); if (await c.count()) { try { await c.click({ timeout: 3000 }); } catch (e) {} } await page.waitForTimeout(1000); return true; }
async function setConfig() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await dismissModals(); await clearCrunchScreen();
      await openDrawer();
      await page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: "选项" }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(400);
      await openDrawer();
      await page.locator(".o-tab-btn--subtab").filter({ hasText: "游戏玩法" }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(450);
      await closeDrawer();
      const sched = page.locator(".c-oreki-sched__field");
      if ((await sched.count()) > 0) {
        await sched.fill("1");
        await page.locator(".c-oreki-sched__apply").click({ timeout: 5000 });
        await page.waitForTimeout(350);
        const sf = page.locator(".c-oreki-speed__field");
        if (await sf.count()) {
          await sf.fill(String(FIX_SPEED));
          await page.locator(".c-oreki-speed__apply").click({ timeout: 5000 });
          await page.waitForTimeout(350);
        }
        // 关闭「自动动态速度」：文字按钮
        const dynBtn = page.locator("button, .o-primary-btn").filter({ hasText: /自动动态速度/ }).first();
        if (await dynBtn.count()) {
          const dynOn = await page.evaluate(() => { try { return window.GameSpeed.isDynamic === true; } catch (e) { return null; } });
          if (dynOn) { try { await dynBtn.click({ timeout: 3000 }); } catch (e) {} await page.waitForTimeout(300); }
        }
      }
      const applied = await page.evaluate(() => ({ interval: window.OrekiSmartExecutor.intervalSec, speed: window.GameSpeed.factor, dynamic: window.GameSpeed.isDynamic }));
      if (applied.interval === 1 && applied.speed === FIX_SPEED && applied.dynamic === false) return applied;
    } catch (e) { /* retry */ }
    await page.waitForTimeout(1200);
  }
  return await page.evaluate(() => ({ interval: window.OrekiSmartExecutor.intervalSec, speed: window.GameSpeed.factor, dynamic: window.GameSpeed.isDynamic }));
}
const applied = await setConfig();
log("applied", JSON.stringify(applied));
try { await openDrawer(); await page.locator(".c-modern-sidebar .l-tab-btn-inner").filter({ hasText: "维度" }).first().click({ timeout: 6000 }); await page.waitForTimeout(300); await closeDrawer(); } catch (e) {}
const T0 = Date.now();
const wall = () => Math.round((Date.now() - T0) / 100) / 10;

const state = () => page.evaluate(() => {
  const T = (fn) => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } };
  const lg = v => { try { const x = Number(v.log10()); return Number.isFinite(x) ? Math.round(x * 1e2) / 1e2 : x; } catch (e) { return null; } };
  return {
    realities: T(() => player.realities),
    amLog10: T(() => lg(player.antimatter)),
    maxAMLog10: T(() => lg(player.records.thisInfinity.maxAM)),
    ipLog10: T(() => lg(Currency.infinityPoints.value)),
    maxIPLog10: T(() => lg(player.records.thisEternity.maxIP)),
    epLog10: T(() => { try { return Math.round(Number(Currency.eternityPoints.value.log10()) * 1e2) / 1e2; } catch (e) { return null; } }),
    etLog10: T(() => lg(player.eternities)),
    etStr: T(() => String(player.eternities).slice(0, 24)),
    etAuto: T(() => ({ mode: player.auto.eternity.mode, amount: String(player.auto.eternity.amount), xHighest: String(player.auto.eternity.xHighest), isActive: player.auto.eternity.isActive === true, increaseWithMult: player.auto.eternity.increaseWithMult === true })),
    eAutoUnlocked: T(() => { try { return EternityMilestone.autobuyerEternity.isReached === true; } catch (e) { return null; } }),
    realTimePlayed: T(() => player.records.realTimePlayed),
    breakFlag: T(() => player.break === true),
    gamePaused: T(() => player.options.gamePaused === true),
    enslavedStoring: T(() => { try { return Enslaved.isStoringRealTime === true; } catch (e) { return null; } }),
    dimBoost: T(() => player.dimensionBoosts), gal: T(() => player.galaxies),
    dims: T(() => { const a = []; for (let i = 1; i <= 8; i++) { try { a.push(Number(AntimatterDimension(i).amount.log10())); } catch (e) { a.push(null); } } return a; }),
    tickBought: T(() => player.totalTickBought),
    infinitiesLog10: T(() => lg(player.infinities)),
    canCrunch: T(() => Player.canCrunch),
    breakFlag: T(() => player.break),
    autoOn: T(() => player.auto.autobuyersOn),
    groupActive: T(() => { try { return window.Autobuyer.antimatterDimension.isActive; } catch (e) { return null; } }),
    crunchActive: T(() => { try { return window.Autobuyer.bigCrunch.isActive; } catch (e) { return null; } }),
    crunchInterval: T(() => { try { return window.Autobuyer.bigCrunch.interval; } catch (e) { return null; } }),
    crunchMode: T(() => { try { return window.Autobuyer.bigCrunch.mode; } catch (e) { return null; } }),
    cost1: T(() => String(AntimatterDimension(1).cost)),
    afford1: T(() => AntimatterDimension(1).isAffordable),
    avail1: T(() => AntimatterDimension(1).isAvailableForPurchase),
    executorServed: T(() => window.OrekiSmartExecutor.debugState().served),
    lastAction: T(() => { const a = window.OrekiSmartExecutor.debugState().lastAction; return a ? { label: a.label, acted: a.acted } : null; }),
    stage: T(() => window.OrekiSmartExecutor.debugState().stage?.id ?? null),
    goal: T(() => window.OrekiSmartExecutor.debugState().goal?.id ?? null),
    blockers: T(() => window.OrekiSmartExecutor.debugState().blockers),
  };
});

const marks = {};
let maxRealities = 0, maxEpLog10 = 0, maxMaxEpExponent = 0, realityAvailTrue = 0, gameEndAtWall = null;
const MAX_WALL = Number(process.env.MAX_WALL_SEC || 1800);
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 2000);
while (wall() < MAX_WALL) {
  const s = await state();
  s.wall_sec = wall();
  const ge = await page.evaluate(() => { try { return { endState: window.GameEnd?.endState ?? null, credits: window.GameEnd?.creditsEverClosed === true }; } catch (e) { return { endState: null, credits: null }; } });
  s.gameEnd = ge;
  const rav = await page.evaluate(() => { try { return window.isRealityAvailable ? window.isRealityAvailable() === true : null; } catch (e) { return null; } });
  s.realityAvailable = rav;
  s.maxEpExponent = await page.evaluate(() => { try { const v = Number(player.records.thisReality.maxEP.exponent); return Number.isFinite(v) ? v : null; } catch (e) { return null; } });
  fs.appendFileSync(LOOP, JSON.stringify(s) + "\n");
  if (typeof s.realities === "number") maxRealities = Math.max(maxRealities, s.realities);
  if (typeof s.epLog10 === "number") maxEpLog10 = Math.max(maxEpLog10, s.epLog10);
  if (typeof s.maxEpExponent === "number") maxMaxEpExponent = Math.max(maxMaxEpExponent, s.maxEpExponent);
  if (rav === true) realityAvailTrue++;
  for (const n of [1, 5, 10, 15, 16, 20, 30, 50]) {
    if (marks["r" + n] === undefined && typeof s.realities === "number" && s.realities >= n) marks["r" + n] = s.wall_sec;
  }
  if (marks.ep4000 === undefined && typeof s.maxEpExponent === "number" && s.maxEpExponent >= 4000) marks.ep4000 = s.wall_sec;
  if (s.wall_sec % 30 < SAMPLE_MS / 1000) log("progress", JSON.stringify({ w: s.wall_sec, r: s.realities, ep: s.epLog10, maxEp: s.maxEpExponent, maxIP: s.maxIPLog10, am: s.amLog10, rav, stage: s.stage, goal: s.goal, endState: ge.endState }));
  if (ge.endState > 0 || ge.credits === true) { gameEndAtWall = s.wall_sec; log("GAME END at wall " + gameEndAtWall); break; }
  const stopR = Number(process.env.STOP_REALITIES || 50);
  if (s.realities >= stopR) { log("realities>=" + stopR + " at wall " + s.wall_sec); break; }
  await page.waitForTimeout(SAMPLE_MS);
}
fs.writeFileSync(OUT + "/verify-summary.json", JSON.stringify({ generatedAt: new Date().toISOString(), applied, marks, maxRealities, maxEpLog10, maxMaxEpExponent, realityAvailTrue, gameEndAtWall, pageErrors, consoleErrors: consoleErrors.slice(0, 10) }, null, 2) + "\n");
log("done", JSON.stringify({ maxRealities, gameEndAtWall, marks }));
await browser.close();
await new Promise(r => server.close(r));
