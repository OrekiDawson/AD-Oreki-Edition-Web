// R108-01 · Web 修复后默认设置真实新档回归：IM 上限修复（OREKI_IM_CAP_MULT 300→3000）
// 目标：验证默认 10000× 下真实新档能否走到 IU15 → 莱特拉 → IU25 → 佩勒 → gameEnd。
// 口径：全新 context、默认设置（不改 interval/速度/动态速度）、只做真实 UI 关弹窗、不写 player 字段。
// 探针 v2：修正 number 货币的 log10 读取（Teresa.pouredAmount / imaginaryMachines / IM cap），
//          并补 Achievement151、IU 购买、莱特拉熵/相位、endgame debugState 等只读字段。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition";
const OUT = process.env.OUT_DIR || "/home/oreki/AD-Oreki-Unified/reports/R108-01/web/run-fixed";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT + "/screenshots", { recursive: true });
const SAMPLES = OUT + "/samples.jsonl";
fs.writeFileSync(SAMPLES, "");
fs.writeFileSync(OUT + "/run.log", "");
const log = (...a) => { const s = "[" + new Date().toISOString() + "] " + a.join(" "); console.log(s); fs.appendFileSync(OUT + "/run.log", s + "\n"); };
const writeJson = (name, obj) => fs.writeFileSync(OUT + "/" + name, JSON.stringify(obj, null, 2) + "\n");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webm": "video/webm", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon", ".map": "application/json", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const server = http.createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(REPO, p);
  fs.readFile(f, (e, d) => {
    if (e) { rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    rs.end(d);
  });
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port + "/";

const req = createRequire("/home/oreki/.npm/_npx/e41f203b7505f1fb/noop.js");
const { chromium } = req("playwright");
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion", "--mute-audio", "--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
  locale: "zh-CN", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
});
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const pageErrors = [], consoleErrors = [];
page.on("pageerror", e => pageErrors.push(String(e.message).slice(0, 500)));
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
log("goto", BASE);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.player && window.OrekiSmartExecutor && window.GameEnd, null, { timeout: 120000 });
await page.waitForTimeout(1500);

const boot = await page.evaluate(() => ({
  realities: player.realities,
  antimatter: String(player.antimatter),
  storageKeys: Object.keys(localStorage),
  intervalCfg: window.OrekiSmartExecutor.intervalSec,
  effInterval: window.OrekiSmartExecutor.effectiveIntervalSec,
  speed: window.GameSpeed.factor,
  dynamic: window.GameSpeed.isDynamic,
  imCapMult: (() => { try { return window.OREKI_IM_CAP_MULT ?? null; } catch (e) { return null; } })(),
  srcIMCapMult: (() => { try { return MachineHandler.baseIMCap; } catch (e) { return null; } })(),
}));
log("boot", JSON.stringify(boot));
writeJson("boot.json", boot);

async function dismissModals() {
  for (let i = 0; i < 8; i++) {
    let clicked = false;
    for (const re of [/嗯呐/, /^确定$/, /^关闭$/, /^继续$/, /^知道了$/, /^跳过$/, /^开始游戏$/]) {
      const b = page.locator("button:visible, .o-primary-btn:visible").filter({ hasText: re }).first();
      if (await b.count()) { try { await b.click({ timeout: 700 }); clicked = true; break; } catch (e) {} }
    }
    if (!clicked) return;
    await page.waitForTimeout(180);
  }
}

const state = () => page.evaluate(() => {
  const T = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return null; } };
  const lgDec = v => { try { const x = Number(v.log10()); return Number.isFinite(x) ? Math.round(x * 100) / 100 : (Number.isNaN(x) ? "NaN" : String(x)); } catch (e) { return null; } };
  const lgNum = v => { try { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(Math.log10(n) * 100) / 100 : null; } catch (e) { return null; } };
  const pop = v => { try { let n = 0, x = Number(v) >>> 0; while (x) { n += x & 1; x >>>= 1; } return n; } catch (e) { return null; } };
  const d = T(() => window.OrekiSmartExecutor.debugState());
  return {
    realities: T(() => player.realities),
    rm: T(() => String(Currency.realityMachines.value)),
    rmLog10: T(() => lgDec(Currency.realityMachines.value)),
    ruBits: T(() => player.reality.upgradeBits),
    ruCount: T(() => pop(player.reality.upgradeBits)),
    ruAll: T(() => RealityUpgrades.allBought),
    glyphsActive: T(() => Glyphs.activeList.length),
    glyphsInv: T(() => player.reality.glyphs.inventory.length),
    glyphMaxLevel: T(() => { const a = Glyphs.activeList.map(g => g.level); return a.length ? Math.max(...a) : 0; }),
    teresaUnl: T(() => Teresa.isUnlocked),
    teresaPouredLog10: T(() => lgNum(Number(Teresa.pouredAmount))),
    teresaFill: T(() => Math.round(Teresa.fill * 1000) / 1000),
    teresaEffarig: T(() => TeresaUnlocks.effarig.isUnlocked),
    effarigStage: T(() => Effarig.currentStage),
    effarigRun: T(() => player.celestials.effarig.run === true),
    effarigRunTicket: T(() => EffarigUnlock.run.isUnlocked),
    enslavedUnl: T(() => Enslaved.isUnlocked),
    enslavedRun: T(() => player.celestials.enslaved.run === true),
    ach151: T(() => Achievement(151).isUnlocked),
    vUnl: T(() => VUnlocks.vAchievementUnlock.isUnlocked),
    vTheorem: T(() => V.spaceTheorems),
    raUnl: T(() => Ra.isUnlocked),
    raTab: T(() => VUnlocks.raUnlock.isUnlocked),
    im: T(() => Number(Currency.imaginaryMachines.value)),
    imLog10: T(() => lgNum(Number(Currency.imaginaryMachines.value))),
    imCap: T(() => Number(MachineHandler.currentIMCap)),
    imCapLog10: T(() => lgNum(Number(MachineHandler.currentIMCap))),
    iu15Cost: T(() => Number(ImaginaryUpgrade(15).cost)),
    iu15: T(() => ImaginaryUpgrade(15).isBought),
    iu25: T(() => ImaginaryUpgrade(25).isBought),
    laitelaUnl: T(() => Laitela.isUnlocked),
    laitelaTier: T(() => Laitela.difficultyTier),
    laitelaRunning: T(() => Laitela.isRunning),
    laitelaEntropy: T(() => Math.round(Number(player.celestials.laitela.entropy) * 1000) / 1000),
    amLog10: T(() => lgDec(player.antimatter)),
    amExp: T(() => Number(player.antimatter && player.antimatter.exponent)),
    thisRealityRealMs: T(() => player.records.thisReality.realTime),
    laiHold: T(() => globalThis.OrekiEndgameAutomation?.holdForLaitela === true),
    laiRuns: T(() => globalThis.OrekiEndgameAutomation?._laitelaRuns ?? null),
    laiAborts: T(() => globalThis.OrekiEndgameAutomation?._laitelaAborts ?? null),
    pelleUnl: T(() => Pelle.isUnlocked),
    doomed: T(() => Pelle.isDoomed),
    endState: T(() => GameEnd.endState),
    gameEnd: T(() => player.isGameEnd === true),
    pelleTotalAMLog10: T(() => lgDec(player.celestials.pelle.records.totalAntimatter)),
    stage: T(() => d && d.stage ? d.stage.id : null),
    goal: T(() => d && d.goal ? d.goal.id : null),
    cfgInterval: T(() => window.OrekiSmartExecutor.intervalSec),
    effInterval: T(() => window.OrekiSmartExecutor.effectiveIntervalSec),
    speed: T(() => window.GameSpeed.factor),
    dynamic: T(() => window.GameSpeed.isDynamic),
    tt: T(() => player.timestudy.studies.length),
    eternitiesLog10: T(() => lgDec(player.eternities)),
    epLog10: T(() => lgDec(Currency.eternityPoints.value)),
    maxEpExp: T(() => player.records.thisReality.maxEP.exponent),
    serve: T(() => d && d.beat ? d.beat.served : null),
    endgame: T(() => { const e = globalThis.OrekiEndgameAutomation; if (!e || !e.debugState) return null; const s = e.debugState; return { step: s.step, imL: s.imL, imCapL: s.imCapL, laiTier: s.laitelaTier, laiRunning: s.laitelaRunning, iu15: s.iuBought ? s.iuBought[15] : null, iu25: s.iuBought ? s.iuBought[25] : null, doomPhase: s.doomPhase, doomArm: s.doomArmageddons, shardsL: s.doomShardsL, break: (() => { try { return player.break === true; } catch (e) { return null; } })(), lastError: s.lastError }; }),
  };
});

const T0 = Date.now();
const wall = () => Math.round((Date.now() - T0) / 100) / 10;
const MAX_WALL = Number(process.env.MAX_WALL_SEC || 7200);
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 2000);
const milestones = {};
const shots = new Set();
async function shot(name) { try { await page.screenshot({ path: OUT + "/screenshots/" + name + ".png" }); } catch (e) {} }

let lastLog = -999;
while (wall() < MAX_WALL) {
  let s;
  try { s = await state(); } catch (e) { log("STATE ERROR", String(e).slice(0, 300)); await page.waitForTimeout(SAMPLE_MS); continue; }
  s.wall = wall();
  fs.appendFileSync(SAMPLES, JSON.stringify(s) + "\n");

  const mark = (name) => {
    if (milestones[name] !== undefined) return;
    milestones[name] = s.wall;
    log("milestone", name, "@", s.wall, JSON.stringify({ r: s.realities, rm: s.rmLog10, ru: s.ruCount, glyphs: s.glyphsActive, imL: s.imLog10, iu15: s.iu15, stage: s.stage, goal: s.goal, endState: s.endState }));
    writeJson("milestone-" + name + ".json", { name, wall: s.wall, state: s });
    if (shots.size < 40) { shots.add(name); shot("milestone-" + name); }
  };
  if (s.realities >= 1) mark("firstReality");
  for (const n of [5, 10, 15, 20, 30, 50, 60, 75, 100]) if (s.realities >= n) mark("realities" + n);
  if (typeof s.maxEpExp === "number" && s.maxEpExp >= 4000) mark("ep4000");
  if (s.teresaUnl === true) mark("teresaUnlocked");
  if (s.teresaEffarig === true) mark("effarigUnlocked");
  if (s.effarigStage >= 2) mark("effarigStage2");
  if (s.effarigStage >= 3) mark("effarigStage3");
  if (s.enslavedUnl === true) mark("enslavedUnlocked");
  if (s.ach151 === true) mark("ach151");
  if (s.vUnl === true) mark("vUnlocked");
  if (s.imLog10 !== null && s.imLog10 >= 9) mark("im1e9");
  if (s.laitelaUnl === true) mark("laitelaUnlocked");
  if (s.iu15 === true) mark("iu15");
  if (s.laitelaTier >= 8) mark("laitelaTier8");
  if (s.pelleUnl === true) mark("pelleUnlocked");
  if (s.doomed === true) mark("doomed");
  if (s.iu25 === true) mark("iu25");
  if (typeof s.endState === "number" && s.endState >= 1) { mark("endState1"); log("GAME END endState>=1 at wall", s.wall); }
  if (s.gameEnd === true) { log("GAME END isGameEnd=true at wall", s.wall); break; }

  if (s.wall - lastLog >= 30) {
    lastLog = s.wall;
    log("progress", JSON.stringify({ w: s.wall, r: s.realities, rm: s.rmLog10, ru: s.ruCount, gl: s.glyphsActive, terrL: s.teresaPouredLog10, eff: s.effarigStage, ach151: s.ach151, v: s.vUnl, imL: s.imLog10, capL: s.imCapLog10, iu15: s.iu15, iu25: s.iu25, lai: s.laitelaUnl, tier: s.laitelaTier, ent: s.laitelaEntropy, pelle: s.pelleUnl, doomed: s.doomed, end: s.endState, stage: s.stage, goal: s.goal, speed: s.speed, effInt: s.effInterval, step: s.endgame ? s.endgame.step : null }));
  }
  try { await dismissModals(); } catch (e) {}
  await page.waitForTimeout(SAMPLE_MS);
}

const finalState = await state();
finalState.wall = wall();
const summary = {
  generatedAt: new Date().toISOString(),
  run: "R108-01 web FIXED (OREKI_IM_CAP_MULT 3000) default settings",
  config: { freshSave: true, defaultSettings: true, intervalInjected: false, speedInjected: false, dynamicSpeed: true, viewport: "412x839 DPR2.625 isMobile hasTouch", maxWallSec: MAX_WALL, sampleMs: SAMPLE_MS },
  boot, milestones, finalState,
  gameEndReached: finalState.gameEnd === true || finalState.endState >= 1,
  pageErrors, consoleErrors: consoleErrors.slice(0, 20),
  status: finalState.gameEnd === true ? "GAME_END" : (wall() >= MAX_WALL ? "TIMEOUT" : "STOPPED"),
};
writeJson("summary.json", summary);
log("done", JSON.stringify({ status: summary.status, milestones, pageErrors: pageErrors.length }));
await browser.close();
await new Promise(r => server.close(r));
