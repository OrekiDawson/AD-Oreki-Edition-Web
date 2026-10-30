// R36-C 定向探针（headless Edge，CDP 端口固定 9342，Agent A 用 9341，不冲突）
//
// 目的（一次跑齐三件事）：
//   A. 证明 R35 的两处改动在运行时**真的加载**：
//      A1 `Ra.requiredMemoriesForLevel(L)` 运行时值 vs 源码公式（原版 1e6 / R35 2.5e3）
//      A2 `MachineHandler.baseIMCap` / `currentIMCap` 运行时值 vs `OREKI_IM_CAP_MULT = 10.6`
//   B. IU14/IU15/Laitela 解锁链的**运行时**判定（isBought / isAvailableForPurchase /
//      hasFailed / checkRequirement / Laitela.isUnlocked）
//   C. V 六项 `progress()` 运行时值 + `player.antimatter.exponent` + `maxID1`
//   D. **Ra 记忆真实仿真**：用真实 `pet.tick()` + 真实 `levelUp()` / `purchaseMemoryUpgrade()`
//      / `purchaseChunkUpgrade()` 驱动，跑「180 分钟墙钟 @ F=10000」等价时长，
//      记录每只宠物真实到达的等级与记忆量（不写任何存档、不伪造游戏状态）
//
// 用法：node _r36c/probe.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

const WEB = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web";
const ROOT = path.join(WEB, "AD-Oreki-Edition");
const SAVE_DIR = path.join(WEB, "_saves/samples");
const OUT_DIR = path.join(WEB, "_tools/_r36c");
const CDP_PORT = 9342;          // 固定端口；Agent A 占 9341
const HTTP_PORT = 8432;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };

// ───────────────────────── 静态服务器 ─────────────────────────
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  const rel = path.relative(ROOT, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(HTTP_PORT, "127.0.0.1", r));

// ───────────────────────── 启动 Edge（固定 9342）─────────────────────────
const puppeteer = (await import("puppeteer-core")).default;
const profileDir = path.join(os.tmpdir(), `oreki-r36c-${process.pid}-${CDP_PORT}`);
const child = spawn(EDGE, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio",
  "--no-first-run", "--no-default-browser-check", "--disable-background-mode",
  "--window-size=1200,800",
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

async function waitForDevtools(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) { await r.json(); return true; }
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}
if (!await waitForDevtools(CDP_PORT, 30000)) {
  try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* */ }
  console.error("FATAL: Edge 9342 未就绪");
  process.exit(1);
}
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}`, protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));

await page.goto(`http://127.0.0.1:${HTTP_PORT}/index.html`, { waitUntil: "load", timeout: 90000 });
let ready = false;
for (let i = 0; i < 120; i++) {
  ready = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof Ra === "object" && typeof MachineHandler === "object"; }
    catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.error("FATAL: 游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS  游戏启动就绪（CDP 9342）\n");

// ───────────────────────── 页内工具 ─────────────────────────
await page.evaluate(() => {
  const num = v => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "object" && typeof v.toNumber === "function") { try { return v.toNumber(); } catch (e) { return null; } }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // 源码公式复刻（与 ra.js:304-309 完全一致，只换尾乘）
  const formula = (level, tail) => {
    if (level >= 25) return Infinity;
    const adjustedLevel = level + Math.pow(level, 2) / 10;
    const post15Scaling = Math.pow(1.5, Math.max(0, level - 15));
    return Math.floor(Math.pow(adjustedLevel, 5.52) * post15Scaling * tail);
  };
  window.__r36c = {
    num,
    // A1：运行时门槛值 vs 两套公式
    reqTable() {
      const out = [];
      for (let L = 1; L <= 24; L++) {
        const runtime = num(Ra.requiredMemoriesForLevel(L));
        out.push({
          L,
          runtime,
          upstream_1e6: formula(L, 1e6),
          r35_2p5e3: formula(L, 2.5e3),
          matchesUpstream: runtime === formula(L, 1e6),
          matchesR35: runtime === formula(L, 2.5e3),
        });
      }
      return out;
    },
    // A2：IM cap 链
    imCap() {
      const uncapped = num(MachineHandler.uncappedRM);
      const base = num(MachineHandler.baseIMCap);
      const cur = num(MachineHandler.currentIMCap);
      const proj = num(MachineHandler.projectedIMCap);
      const mult = typeof OREKI_IM_CAP_MULT !== "undefined" ? OREKI_IM_CAP_MULT : null;
      const orig = (Math.pow(Math.clampMin(Math.log10(uncapped) - 1000, 0), 2)) *
        (Math.pow(Math.clampMin(Math.log10(uncapped) - 100000, 1), 0.2));
      return {
        uncappedRM: uncapped,
        uncappedRM_log10: uncapped ? Math.log10(uncapped) : null,
        baseIMCap: base,
        currentIMCap: cur,
        projectedIMCap: proj,
        iMCap_stored: num(player.reality.iMCap),
        OREKI_IM_CAP_MULT: mult,
        upstreamForm: orig,
        ratioBaseOverUpstreamForm: orig > 0 ? base / orig : null,
        imUnlocked: MachineHandler.isIMUnlocked,
        imValue: num(Currency.imaginaryMachines.value),
        baseRMCap: num(MachineHandler.baseRMCap),
        hardcapRM: num(MachineHandler.hardcapRM),
        rmValue: num(Currency.realityMachines.value),
      };
    },
    // B：IU 链 + Laitela
    iuChain() {
      const pick = id => {
        const u = ImaginaryUpgrade(id);
        const cfg = u.config;
        let checkReq = null, hasFailed = null, reqText = null;
        try { checkReq = !!u.config.checkRequirement?.(); } catch (e) { checkReq = "throw:" + e.message; }
        try { hasFailed = !!u.config.hasFailed?.(); } catch (e) { hasFailed = "throw:" + e.message; }
        try { reqText = u.requirement; } catch (e) { reqText = "throw:" + e.message; }
        return {
          id,
          name: cfg.name,
          cost: num(u.cost),
          isBought: !!u.isBought,
          isAvailableForPurchase: !!u.isAvailableForPurchase,
          isPossible: !!u.isPossible,
          canBeApplied: !!u.canBeApplied,
          checkRequirement: checkReq,
          hasFailed: hasFailed,
          requirementText: reqText,
          effect: (() => { try { return u.effect?.() ?? u.effect; } catch (e) { return "throw"; } })(),
        };
      };
      return {
        iu13: pick(13), iu14: pick(14), iu15: pick(15), iu16: pick(16),
        iu20: pick(20), iu21: pick(21), iu22: pick(22), iu23: pick(23),
        iu24: pick(24), iu25: pick(25),
        laitela: {
          isUnlocked: !!Laitela.isUnlocked,
          continuumUnlocked: !!Laitela.continuumUnlocked,
          continuumActive: !!Laitela.continuumActive,
          isRunning: !!Laitela.isRunning,
          maxAllowedDimension: Laitela.maxAllowedDimension,
          difficultyTier: Laitela.difficultyTier,
        },
        ra: {
          isUnlocked: !!Ra.isUnlocked,
          isRunning: !!Ra.isRunning,
          spaceTheorems: V.spaceTheorems,
          totalPetLevel: Ra.totalPetLevel,
          remembranceUnlocked: !!Ra.remembrance.isUnlocked,
        },
        // C：IU15 的两重门
        iu15Gates: {
          maxID1: num(player.requirementChecks.reality.maxID1),
          maxID1_isZero: player.requirementChecks.reality.maxID1.eq(0),
          antimatter_value_log10: num(Currency.antimatter.value.log10()),
          player_antimatter_exponent: num(player.antimatter.exponent),
          exponent_ge_1p5e12: num(player.antimatter.exponent) >= 1.5e12,
        },
      };
    },
    // C：V 六项运行时 progress
    vProgress() {
      const out = {};
      for (const [k, e] of Object.entries(GameDatabase.celestials.v.mainUnlock)) {
        out[k] = {
          progress: e.progress(),
          requirement: e.requirement,
          resource: (() => { try { const r = e.resource(); return num(r); } catch (err) { return "throw:" + err.message; } })(),
        };
      }
      return {
        items: out,
        allGe1: Object.values(GameDatabase.celestials.v.mainUnlock).every(e => e.progress() >= 1),
        vUnlocked: !!V.isUnlocked,
        spaceTheorems: V.spaceTheorems,
        raUnlockApplied: !!VUnlocks.raUnlock.isUnlocked,
      };
    },
    // 宠物快照
    pets() {
      return Ra.pets.all.map(p => ({
        key: p.key,
        level: p.level,
        isUnlocked: !!p.isUnlocked,
        memories: num(p.memories),
        memoryChunks: num(p.memoryChunks),
        memoryUpgrades: p.data.memoryUpgrades,
        chunkUpgrades: p.data.chunkUpgrades,
        rawMemoryChunksPerSecond: num(p.rawMemoryChunksPerSecond),
        memoryChunksPerSecond: num(p.memoryChunksPerSecond),
        memoryUpgradeCurrentMult: num(p.memoryUpgradeCurrentMult),
        chunkUpgradeCurrentMult: num(p.chunkUpgradeCurrentMult),
        hasRemembrance: !!p.hasRemembrance,
        requiredMemories: num(p.requiredMemories),
      }));
    },
    productionPerMemoryChunk() { return num(Ra.productionPerMemoryChunk); },
    env() {
      return {
        F: (() => { try { return num(getGlobalSpeedFactor()); } catch (e) { return null; } })(),
        EP_log10: num(Currency.eternityPoints.value.log10()),
        IP_log10: num(Currency.infinityPower.value.log10()),
        TS_log10: num(Currency.timeShards.value.log10()),
        shards: num(Effarig.shardsGained),
        glyphLevel: num(player.records.bestReality.glyphLevel),
        totalTimePlayed: num(player.records.totalTimePlayed),
        achievementsPower: num(Achievements.power),
      };
    },
  };
});

const e = (v, d = 4) => (v === null || v === undefined ? "—" : (typeof v === "number" ? (Number.isFinite(v) ? v.toExponential(d) : String(v)) : String(v)));
const fmtBig = v => (v === null || v === undefined ? "—" : (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : String(v)));

// ───────────────────────── 存档逐个检查 ─────────────────────────
const saveFiles = [
  "1123._Endgame.txt",
  "1105._6.7e11DT+Cel7+3.9e44RS.txt",
  "1000._9.73e14iM+Cel6+1.84e45SG.txt",
  "424._8.4e1412EP+4.9e10DT.txt",
];

const report = { generatedAt: new Date().toISOString(), cdpPort: CDP_PORT, saves: [] };

for (const sf of saveFiles) {
  const fp = path.join(SAVE_DIR, sf);
  if (!fs.existsSync(fp)) { console.log(`\n### ${sf} —— 存档不存在，跳过\n`); continue; }
  const text = fs.readFileSync(fp, "utf-8");
  console.log(`\n${"=".repeat(78)}\n### ${sf}\n${"=".repeat(78)}`);

  const loaded = await page.evaluate(t => {
    try {
      try { GameIntervals.stop(); } catch (e) { /* */ }
      player = GameSaveSerializer.deserialize(t);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      return { ok: true };
    } catch (e) { return { ok: false, err: e.message }; }
  }, text);
  if (!loaded.ok) { console.log("  解码失败：", loaded.err); continue; }

  const req = await page.evaluate(() => window.__r36c.reqTable());
  const up = req.filter(r => r.matchesUpstream).length;
  const r35 = req.filter(r => r.matchesR35).length;
  console.log(`\n[A1] Ra.requiredMemoriesForLevel 运行时 vs 公式：命中上游(1e6) ${up}/24 级；命中 R35(2.5e3) ${r35}/24 级`);
  console.log(`     L=1 runtime=${fmtBig(req[0].runtime)}  L=19 runtime=${fmtBig(req[18].runtime)}  L=20 runtime=${fmtBig(req[19].runtime)}  L=24 runtime=${fmtBig(req[23].runtime)}`);

  const im = await page.evaluate(() => window.__r36c.imCap());
  console.log(`\n[A2] IM cap 链：uncappedRM=${fmtBig(im.uncappedRM)} (log10=${e(im.uncappedRM_log10, 6)})`);
  console.log(`     baseIMCap=${fmtBig(im.baseIMCap)}  currentIMCap=${fmtBig(im.currentIMCap)}  iMCap(stored)=${fmtBig(im.iMCap_stored)}`);
  console.log(`     OREKI_IM_CAP_MULT=${im.OREKI_IM_CAP_MULT}  上游同式=${fmtBig(im.upstreamForm)}  比值=${e(im.ratioBaseOverUpstreamForm, 4)}`);
  console.log(`     isIMUnlocked=${im.imUnlocked}  IM存量=${fmtBig(im.imValue)}  RM=${fmtBig(im.rmValue)} / hardcapRM=${fmtBig(im.hardcapRM)}`);

  const iu = await page.evaluate(() => window.__r36c.iuChain());
  console.log(`\n[B] IU 链：`);
  for (const k of ["iu13", "iu14", "iu15", "iu16", "iu20", "iu21", "iu22", "iu23", "iu24", "iu25"]) {
    const u = iu[k];
    console.log(`     ${k.padEnd(5)} ${String(u.name).padEnd(8)} cost=${fmtBig(u.cost).padStart(10)}  bought=${String(u.isBought).padEnd(5)} canBuy=${String(u.isAvailableForPurchase).padEnd(5)} possible=${String(u.isPossible).padEnd(5)} checkReq=${String(u.checkRequirement).padEnd(5)} hasFailed=${String(u.hasFailed)}`);
  }
  console.log(`     Laitela: isUnlocked=${iu.laitela.isUnlocked} continuumUnlocked=${iu.laitela.continuumUnlocked} isRunning=${iu.laitela.isRunning} maxAllowedDim=${iu.laitela.maxAllowedDimension} tier=${iu.laitela.difficultyTier}`);
  console.log(`     Ra: isUnlocked=${iu.ra.isUnlocked} spaceTheorems=${iu.ra.spaceTheorems} totalPetLevel=${iu.ra.totalPetLevel} remembrance=${iu.ra.remembranceUnlocked}`);
  console.log(`     IU15 两重门：maxID1=${fmtBig(iu.iu15Gates.maxID1)} (==0? ${iu.iu15Gates.maxID1_isZero})  player.antimatter.exponent=${e(iu.iu15Gates.player_antimatter_exponent, 5)} (>=1.5e12? ${iu.iu15Gates.exponent_ge_1p5e12})  Currency.antimatter.log10=${e(iu.iu15Gates.antimatter_value_log10, 5)}`);

  const vp = await page.evaluate(() => window.__r36c.vProgress());
  console.log(`\n[C] V 六项运行时 progress：`);
  for (const [k, v] of Object.entries(vp.items)) {
    console.log(`     ${k.padEnd(15)} progress=${e(v.progress, 4).padStart(12)}  requirement=${fmtBig(v.requirement)}  resource=${fmtBig(v.resource)}`);
  }
  console.log(`     all>=1: ${vp.allGe1}   V.isUnlocked=${vp.vUnlocked}  spaceTheorems=${vp.spaceTheorems}  raUnlock=${vp.raUnlockApplied}`);

  const ps = await page.evaluate(() => window.__r36c.pets());
  const ppc = await page.evaluate(() => window.__r36c.productionPerMemoryChunk());
  const env = await page.evaluate(() => window.__r36c.env());
  console.log(`\n[D] 宠物快照（productionPerMemoryChunk=${e(ppc, 5)}）：`);
  for (const p of ps) {
    console.log(`     ${String(p.key).padEnd(18)} L=${String(p.level).padStart(2)} unlocked=${String(p.isUnlocked).padEnd(5)} mem=${fmtBig(p.memories).padStart(12)} chunks=${fmtBig(p.memoryChunks).padStart(12)} rawCPS=${fmtBig(p.rawMemoryChunksPerSecond).padStart(12)} CPS=${fmtBig(p.memoryChunksPerSecond).padStart(12)} memUpg=${String(p.memoryUpgrades).padStart(2)}(×${e(p.memoryUpgradeCurrentMult, 3)}) chunkUpg=${String(p.chunkUpgrades).padStart(2)}(×${e(p.chunkUpgradeCurrentMult, 3)}) remem=${p.hasRemembrance}`);
  }
  console.log(`     环境：F=${env.F} EP.log10=${e(env.EP_log10, 5)} IP.log10=${e(env.IP_log10, 5)} TS.log10=${e(env.TS_log10, 5)} shards=${fmtBig(env.shards)} glyphLevel=${fmtBig(env.glyphLevel)} totalTimePlayed=${fmtBig(env.totalTimePlayed)} achPower=${e(env.achievementsPower, 4)}`);

  report.saves.push({ file: sf, reqTable: req, imCap: im, iuChain: iu, vProgress: vp, pets: ps, ppc, env });
}

// ───────────────────────── D：Ra 记忆真实仿真 ─────────────────────────
// 场景：从当前存档的资源状态出发，把宠物记忆清零（仅内存态，不落盘），
//       用真实 pet.tick() + 真实升级/加购 API 跑「180 分钟墙钟 @ F=10000」等价时长。
// Ra 记忆侧时间 = 墙钟 × √F（game.js:637 的 realDiff / sqrt(F)）。
console.log(`\n\n${"=".repeat(78)}\n### Ra 记忆真实仿真（真实代码驱动）\n${"=".repeat(78)}`);

const sim = await page.evaluate(({ wallSeconds, F }) => {
  const sqrtF = Math.sqrt(F);
  const teff = wallSeconds * sqrtF;            // Ra 侧有效秒数
  const step = 1000;                            // 每步 1000 Ra-秒
  const steps = Math.ceil(teff / step);
  const out = { wallSeconds, F, sqrtF, teff, steps, pets: {}, trace: [] };

  // 记录初始资源指纹（用于说明「用的是哪份存档的资源」）
  out.fingerprint = {
    EP_log10: Currency.eternityPoints.value.log10(),
    IP_log10: Currency.infinityPower.value.log10(),
    TS_log10: Currency.timeShards.value.log10(),
    RM_log10: Currency.realityMachines.value.log10(),
  };

  player.celestials.ra.run = true;

  // 清零宠物记忆态（仅内存）
  for (const p of Ra.pets.all) { p.reset(); p.data.memories = 0; p.data.memoryChunks = 0; p.data.memoryUpgrades = 0; p.data.chunkUpgrades = 0; p.data.level = 1; }
  player.celestials.ra.petWithRemembrance = null;

  const pets = Ra.pets.all;
  const levelUpAll = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of pets) {
        if (!p.isUnlocked) continue;
        // 优先升级（门槛 = 当前 level 的 requiredMemories）
        while (p.level < Ra.levelCap && p.memories >= p.requiredMemories) { p.levelUp(); changed = true; }
        // 再买记忆倍率升级
        while (!p.memoryUpgradeCapped && p.canBuyMemoryUpgrade) { p.purchaseMemoryUpgrade(); changed = true; }
        // 再买记忆块倍率升级
        while (!p.chunkUpgradeCapped && p.canBuyChunkUpgrade) { p.purchaseChunkUpgrade(); changed = true; }
      }
    }
  };

  for (let i = 0; i < steps; i++) {
    for (const p of pets) p.tick(step * 1000, true);
    levelUpAll();
    if (i % Math.max(1, Math.floor(steps / 12)) === 0 || i === steps - 1) {
      out.trace.push({
        raSeconds: Math.round((i + 1) * step),
        wallSeconds: Math.round((i + 1) * step / sqrtF),
        pets: pets.map(p => ({ k: p.key, L: p.level, mem: p.memories, ch: p.memoryChunks, mu: p.data.memoryUpgrades, cu: p.data.chunkUpgrades })),
        totalPetLevel: Ra.totalPetLevel,
        ppc: Ra.productionPerMemoryChunk,
      });
    }
  }
  levelUpAll();

  out.pets = pets.map(p => ({
    key: p.key, level: p.level, isUnlocked: !!p.isUnlocked,
    memories: p.memories, memoryChunks: p.memoryChunks,
    memoryUpgrades: p.data.memoryUpgrades, chunkUpgrades: p.data.chunkUpgrades,
    memoryUpgradeCurrentMult: p.memoryUpgradeCurrentMult,
    chunkUpgradeCurrentMult: p.chunkUpgradeCurrentMult,
    rawCPS: p.rawMemoryChunksPerSecond, cps: p.memoryChunksPerSecond,
    requiredMemoriesNext: p.level < Ra.levelCap ? p.requiredMemories : null,
    cappedMem: p.memoryUpgradeCapped, cappedChunk: p.chunkUpgradeCapped,
  }));
  out.totalPetLevel = Ra.totalPetLevel;
  out.remembranceUnlocked = Ra.remembrance.isUnlocked;
  out.ppc = Ra.productionPerMemoryChunk;
  out.reqNow = [];
  for (let L = 1; L <= 24; L++) out.reqNow.push({ L, req: Ra.requiredMemoriesForLevel(L) });
  return out;
}, { wallSeconds: 10800, F: 10000 });

console.log(`\n墙钟预算 ${sim.wallSeconds}s（180 分钟）  F=${sim.F}  √F=${sim.sqrtF}  ⇒ Ra 侧有效 ${sim.teff.toLocaleString()} 秒（${sim.steps} 步）`);
console.log(`资源指纹：EP.log10=${e(sim.fingerprint.EP_log10, 5)}  IP.log10=${e(sim.fingerprint.IP_log10, 5)}  TS.log10=${e(sim.fingerprint.TS_log10, 5)}  RM.log10=${e(sim.fingerprint.RM_log10, 5)}`);
console.log(`\n最终 totalPetLevel=${sim.totalPetLevel}  remembrance=${sim.remembranceUnlocked}  productionPerMemoryChunk=${e(sim.ppc, 5)}`);
console.log(`\n${"宠物".padEnd(20)}${"等级".padStart(4)}${"记忆".padStart(13)}${"记忆块".padStart(13)}${"memUpg".padStart(7)}${"chunkUpg".padStart(9)}${"memMult".padStart(11)}${"chunkMult".padStart(11)}${"CPS".padStart(13)}${"下一级门槛".padStart(14)}`);
for (const p of sim.pets) {
  console.log(`${String(p.key).padEnd(20)}${String(p.level).padStart(4)}${fmtBig(p.memories).padStart(13)}${fmtBig(p.memoryChunks).padStart(13)}${String(p.memoryUpgrades).padStart(7)}${String(p.chunkUpgrades).padStart(9)}${e(p.memoryUpgradeCurrentMult, 4).padStart(11)}${e(p.chunkUpgradeCurrentMult, 4).padStart(11)}${fmtBig(p.cps).padStart(13)}${fmtBig(p.requiredMemoriesNext).padStart(14)}`);
}
console.log(`\n过程轨迹（Ra 有效秒 / 折合墙钟秒 / 各宠等级 / totalPetLevel）：`);
for (const t of sim.trace) {
  console.log(`  ra=${String(t.raSeconds).padStart(9)}  wall=${String(t.wallSeconds).padStart(6)}  ` +
    t.pets.map(p => `${p.k}:L${p.L}/mem${fmtBig(p.mem)}`).join("  ") + `  total=${t.totalPetLevel}`);
}
report.sim = sim;

// 分级门槛表（真实运行时值）
console.log(`\n分级门槛（真实运行时 Ra.requiredMemoriesForLevel）：`);
for (const r of sim.reqNow) console.log(`  L=${String(r.L).padStart(2)}  req=${fmtBig(r.req).padStart(14)}`);

fs.writeFileSync(path.join(OUT_DIR, "probe-report.json"), JSON.stringify(report, null, 2));
console.log(`\n已写入 ${path.join(OUT_DIR, "probe-report.json")}`);
if (errs.length) console.log("\n页面异常：\n" + errs.slice(0, 10).join("\n"));
else console.log("\n无页面未捕获异常。");

await browser.close();
try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* */ }
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* */ }
server.close();
process.exit(0);
