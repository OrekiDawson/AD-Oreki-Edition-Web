// R107-01 P1 阶段化节拍：真实新档「默认设置」验证（不注入 interval / 不注入速度）
//
// 目的：玩家全新存档、默认 10 s 节拍配置下，MOD 自动化按阶段上限（realities==0 → 1s）
// 运行；记录首无限 / Break / 首永恒 / 首现实 / realities 增长，以及实际生效节拍。
// 只做真实 UI 交互（关弹窗/关教程提示），不写 player 字段、不改调度器配置、不改速度。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = REPO + "/reports/R107-01/beat/run-default";
fs.mkdirSync(OUT, { recursive: true });
const LOG = OUT + "/samples.jsonl";
fs.writeFileSync(LOG, "");
const SHOTS = OUT + "/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => { const s = "[" + new Date().toISOString() + "] " + a.join(" "); console.log(s); fs.appendFileSync(OUT + "/run.log", s + "\n"); };
const writeJson = (name, obj) => fs.writeFileSync(OUT + "/" + name, JSON.stringify(obj, null, 2) + "\n");

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
await page.waitForFunction(() => window.player && window.OrekiSmartExecutor, null, { timeout: 90000 });
await page.waitForTimeout(1500);
log("fresh save booted; localStorage automation keys:",
  JSON.stringify(await page.evaluate(() => ({ enabled: localStorage.getItem("oreki.automation.enabled"), intervalSec: localStorage.getItem("oreki.automation.intervalSec") }))));

async function dismissModals() {
  for (let i = 0; i < 6; i++) {
    let clicked = false;
    for (const re of [/嗯呐/, /^确定$/, /^关闭$/, /^继续$/, /^知道了$/, /^跳过$/]) {
      const b = page.locator("button:visible, .o-primary-btn:visible").filter({ hasText: re }).first();
      if (await b.count()) { try { await b.click({ timeout: 800 }); clicked = true; break; } catch (e) {} }
    }
    if (!clicked) return;
    await page.waitForTimeout(200);
  }
}
async function shot(name) { try { await page.screenshot({ path: SHOTS + "/" + name + ".png" }); } catch (e) {} }

const T0 = Date.now();
const wall = () => Math.round((Date.now() - T0) / 100) / 10;
const state = () => page.evaluate(() => {
  const T = (fn) => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } };
  const lg = v => { try { const x = Number(v.log10()); return Number.isFinite(x) ? Math.round(x * 1e2) / 1e2 : x; } catch (e) { return null; } };
  const d = T(() => window.OrekiSmartExecutor.debugState());
  return {
    infinities: T(() => { const v = player.infinities; return typeof v === "number" ? v : null; }),
    infinitiesLog10: T(() => lg(player.infinities)),
    breakFlag: T(() => player.break === true),
    eternitiesLog10: T(() => lg(player.eternities)),
    realities: T(() => player.realities),
    maxAMLog10: T(() => lg(player.records.thisInfinity.maxAM)),
    maxIPLog10: T(() => lg(player.records.thisEternity.maxIP)),
    epLog10: T(() => lg(Currency.eternityPoints.value)),
    stage: T(() => d && d.stage ? d.stage.id : null),
    goal: T(() => d && d.goal ? d.goal.id : null),
    configuredIntervalSec: T(() => window.OrekiSmartExecutor.intervalSec),
    effectiveIntervalSec: T(() => window.OrekiSmartExecutor.effectiveIntervalSec),
    stageCapSec: T(() => d ? d.stageCapSec : null),
    storedInterval: T(() => localStorage.getItem("oreki.automation.intervalSec")),
    storedEnabled: T(() => localStorage.getItem("oreki.automation.enabled")),
    speed: T(() => window.GameSpeed.factor),
    dynamicSpeed: T(() => window.GameSpeed.isDynamic),
    fps: T(() => window.GameUI.fps),
    served: T(() => d && d.beat ? d.beat.served : null),
    lastBeatAt: T(() => d && d.beat ? d.beat.lastAt : null),
  };
});

const milestones = {};
const MAX_WALL = Number(process.env.MAX_WALL_SEC || 2700);
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 2000);
let lastShotKey = "";
while (wall() < MAX_WALL) {
  const s = await state(); s.wall_sec = wall();
  fs.appendFileSync(LOG, JSON.stringify(s) + "\n");
  const mark = (name) => { if (milestones[name] === undefined) { milestones[name] = s.wall_sec; log("milestone", name, "@", s.wall_sec); writeJson("milestones-" + name + ".json", { name, wall: s.wall_sec, state: s }); shot("milestone-" + name); } };
  if ((typeof s.infinities === "number" && s.infinities >= 1) || (s.infinitiesLog10 !== null && s.infinitiesLog10 > 0)) mark("firstInfinity");
  if (s.breakFlag === true) mark("breakInfinity");
  if (s.eternitiesLog10 !== null && s.eternitiesLog10 > 0) mark("firstEternity");
  if (typeof s.realities === "number") {
    if (s.realities >= 1) mark("firstReality");
    for (const n of [5, 10, 15, 20, 30, 50, 75, 100]) if (s.realities >= n) mark("realities" + n);
  }
  if (typeof s.realities === "number" && s.realities >= 100) { log("realities>=100; stop"); break; }
  const shotKey = s.realities !== null ? String(s.realities) : "";
  if (shotKey !== lastShotKey && (s.realities === 1 || s.realities === 5 || s.realities === 10 || s.realities === 20 || s.realities === 50)) { shot("stage-r" + s.realities); lastShotKey = shotKey; }
  if (wall() % 60 < SAMPLE_MS / 1000) log("progress", JSON.stringify({ w: s.wall_sec, inf: s.infinities, brk: s.breakFlag, etLog: s.eternitiesLog10, r: s.realities, ep: s.epLog10, stage: s.stage, goal: s.goal, cfg: s.configuredIntervalSec, eff: s.effectiveIntervalSec, cap: s.stageCapSec, stored: s.storedInterval, speed: s.speed, fps: s.fps }));
  await dismissModals();
  await page.waitForTimeout(SAMPLE_MS);
}
const finalState = await state();
const ui = await page.evaluate(() => ({
  configured: window.OrekiSmartExecutor.intervalSec,
  effective: window.OrekiSmartExecutor.effectiveIntervalSec,
  stored: localStorage.getItem("oreki.automation.intervalSec"),
  labels: [...document.querySelectorAll(".c-oreki-sched__info b")].map(e => e.textContent.trim()),
  inputValue: document.querySelector(".c-oreki-sched__field")?.value ?? null,
}));
const summary = { generatedAt: new Date().toISOString(), config: { mode: "fresh save, default settings (no interval/speed injection)", maxWallSec: MAX_WALL, sampleMs: SAMPLE_MS }, milestones, finalState, uiConfigUnchanged: ui, pageErrors, consoleErrors: consoleErrors.slice(0, 10) };
writeJson("summary.json", summary);
log("done", JSON.stringify({ milestones, realities: finalState.realities, wall: finalState.wall_sec }));
await browser.close();
await new Promise(r => server.close(r));
