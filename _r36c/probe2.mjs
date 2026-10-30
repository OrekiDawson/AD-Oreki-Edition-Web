// R36-C 场景仿真探针（真实游戏代码 + 场景参数注入），headless Edge CDP 9342
//
// 目的：把「Ra 记忆 ÷400 够不够 / 还差多少 / 最小缩放系数是多少」从「公式推导」
//       升级为「用真实游戏代码跑出来的表」。
//
// 注入的都是**场景参数**（记忆曲线尾乘、特蕾莎的原始记忆块速率、速度倍率），
// 不写任何存档、不伪造任何游戏进度标记；每轮仿真前都从同一个存档重新加载。
//
// 用法：node _r36c/probe2.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

const WEB = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web";
const ROOT = path.join(WEB, "AD-Oreki-Edition");
const SAVE_DIR = path.join(WEB, "_saves/samples");
const OUT_DIR = path.join(WEB, "_tools/_r36c");
const CDP_PORT = 9342;
const HTTP_PORT = 8433;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SAVE_FILE = "424._8.4e1412EP+4.9e10DT.txt";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };

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

const puppeteer = (await import("puppeteer-core")).default;
const profileDir = path.join(os.tmpdir(), `oreki-r36c2-${process.pid}-${CDP_PORT}`);
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
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) { await r.json(); return true; } }
    catch (e) { /* */ }
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}
if (!await waitForDevtools(CDP_PORT, 30000)) {
  try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* */ }
  console.error("FATAL: Edge 9342 未就绪"); process.exit(1);
}
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}`, protocolTimeout: 900000 });
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

const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");

// ───────────────── 页内：场景仿真器 ─────────────────
await page.evaluate(() => {
  window.__sim = async function (opts) {
    const { saveText, tail, teresaRawCPS, wallSeconds, F, stepSeconds } = opts;

    // —— 重载存档，保证每轮场景起点一致 ——
    try { GameIntervals.stop(); } catch (e) { /* */ }
    player = GameSaveSerializer.deserialize(saveText);
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);

    // —— 注入场景参数 A：记忆曲线尾乘 ——
    const origReq = Ra.requiredMemoriesForLevel.bind(Ra);
    Ra.requiredMemoriesForLevel = function (level) {
      if (level >= Ra.levelCap) return Infinity;
      const adjustedLevel = level + Math.pow(level, 2) / 10;
      const post15Scaling = Math.pow(1.5, Math.max(0, level - 15));
      return Math.floor(Math.pow(adjustedLevel, 5.52) * post15Scaling * tail);
    };

    // —— 注入场景参数 B：特蕾莎原始记忆块速率 ——
    const teresaCfg = GameDatabase.celestials.ra.pets.teresa;
    const origTeresaCPS = teresaCfg.rawMemoryChunksPerSecond;
    if (teresaRawCPS !== null && teresaRawCPS !== undefined) {
      teresaCfg.rawMemoryChunksPerSecond = () => teresaRawCPS;
    }

    // —— 场景 C：把 Ra 的运行态打开（真实游戏状态，不是进度标记）——
    player.celestials.ra.run = true;

    // —— 清零宠物记忆态 ——
    for (const p of Ra.pets.all) {
      p.data.level = 1; p.data.memories = 0; p.data.memoryChunks = 0;
      p.data.memoryUpgrades = 0; p.data.chunkUpgrades = 0;
    }
    player.celestials.ra.petWithRemembrance = null;
    // 清掉所有解锁位，保证解锁链由仿真重新走一遍
    player.celestials.ra.unlockBits = 0;

    const pets = Ra.pets.all;
    const sqrtF = Math.sqrt(F);
    const teff = wallSeconds * sqrtF;
    const step = stepSeconds * 1000;
    const steps = Math.ceil(teff / step);

    const tL20 = { teresa: null, any: null };
    const trace = [];

    // 解锁链驱动：等价于 Ra.checkForUnlocks()，但不依赖 V 的解锁门（我们只关心记忆链）
    const driveUnlocks = () => {
      for (const u of Ra.unlocks.all) {
        const pet = u.pet;
        if (!pet) continue;
        if (pet.level >= u.level && !u.isUnlocked) u.unlock();
      }
      // 回忆解锁：总等级 >= 20 时，把回忆给块率最高的宠物
      if (Ra.remembrance.isUnlocked && !player.celestials.ra.petWithRemembrance) {
        let best = null, bestCps = -1;
        for (const p of pets) {
          if (!p.isUnlocked) continue;
          const c = p.rawMemoryChunksPerSecond;
          if (c > bestCps) { bestCps = c; best = p; }
        }
        if (best) player.celestials.ra.petWithRemembrance = best.key.toLowerCase();
      }
    };

    const buy = () => {
      let changed = true;
      while (changed) {
        changed = false;
        driveUnlocks();
        for (const p of pets) {
          if (!p.isUnlocked) continue;
          while (p.level < Ra.levelCap && p.memories >= p.requiredMemories) { p.levelUp(); changed = true; }
          while (!p.memoryUpgradeCapped && p.canBuyMemoryUpgrade) { p.purchaseMemoryUpgrade(); changed = true; }
          while (!p.chunkUpgradeCapped && p.canBuyChunkUpgrade) { p.purchaseChunkUpgrade(); changed = true; }
        }
      }
    };

    for (let i = 0; i < steps; i++) {
      for (const p of pets) p.tick(step, true);
      buy();
      const wall = ((i + 1) * stepSeconds) / sqrtF;
      for (const p of pets) {
        if (p.level >= 20 && tL20[p.key.toLowerCase()] === null) tL20[p.key.toLowerCase()] = wall;
      }
      if (Ra.totalPetLevel >= 20 && tL20.any === null) tL20.any = wall;
      if (i % Math.max(1, Math.floor(steps / 8)) === 0 || i === steps - 1) {
        trace.push({
          wall: Math.round(wall), ra: Math.round((i + 1) * stepSeconds),
          pets: pets.map(p => ({ k: p.key, L: p.level, mem: p.memories, ch: p.memoryChunks, mu: p.data.memoryUpgrades, cu: p.data.chunkUpgrades })),
          total: Ra.totalPetLevel, ppc: Ra.productionPerMemoryChunk,
        });
      }
    }
    buy();

    const out = {
      tail, teresaRawCPS, wallSeconds, F, sqrtF, teff, steps,
      fingerprint: {
        EP_log10: Currency.eternityPoints.value.log10(),
        RM_log10: Currency.realityMachines.value.log10(),
        glyphLevel: player.records.bestReality.glyphLevel,
        totalTimePlayed: player.records.totalTimePlayed,
      },
      pets: pets.map(p => ({
        key: p.key, level: p.level, unlocked: !!p.isUnlocked,
        memories: p.memories, memoryChunks: p.memoryChunks,
        memoryUpgrades: p.data.memoryUpgrades, chunkUpgrades: p.data.chunkUpgrades,
        memMult: p.memoryUpgradeCurrentMult, chunkMult: p.chunkUpgradeCurrentMult,
        rawCPS: p.rawMemoryChunksPerSecond, cps: p.memoryChunksPerSecond,
        memCapped: p.memoryUpgradeCapped, chunkCapped: p.chunkUpgradeCapped,
      })),
      totalPetLevel: Ra.totalPetLevel,
      remembrance: Ra.remembrance.isUnlocked,
      ppc: Ra.productionPerMemoryChunk,
      tL20,
      trace,
    };
    // 还原注入
    Ra.requiredMemoriesForLevel = origReq;
    teresaCfg.rawMemoryChunksPerSecond = origTeresaCPS;
    return out;
  };
});

const e = (v, d = 4) => (v === null || v === undefined ? "—" : (typeof v === "number" ? (Number.isFinite(v) ? v.toExponential(d) : String(v)) : String(v)));
const fb = v => (v === null || v === undefined ? "—" : (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : String(v)));
const results = [];

async function run(label, opts) {
  const r = await page.evaluate(o => window.__sim(o), { saveText, ...opts });
  results.push({ label, ...r });
  console.log(`${label.padEnd(46)} | teresaL=${String(r.pets[0].level).padStart(2)}  total=${String(r.totalPetLevel).padStart(3)}  remem=${String(r.remembrance).padEnd(5)}` +
    ` | teresaMem=${fb(r.pets[0].memories).padStart(11)}  memUpg=${String(r.pets[0].memoryUpgrades).padStart(2)} chunkUpg=${String(r.pets[0].chunkUpgrades).padStart(2)}` +
    ` | ppc=${e(r.ppc, 3)}  t_L20(wall)=${r.tL20.any === null ? "未达成" : Math.round(r.tL20.any) + "s"}`);
  return r;
}

console.log(`存档：${SAVE_FILE}`);
console.log(`参考资源：EP.log10 / RM.log10 见下表；仿真 = 真实 pet.tick() + 真实 levelUp/purchase* API\n`);

console.log("════ ① A/B：原版曲线(1e6) vs R35 曲线(2.5e3)，同一资源、同一 180 分钟、F=10000 ════");
for (const tail of [1e6, 2.5e3]) {
  await run(`tail=${tail === 1e6 ? "上游1e6" : "R35 2.5e3"}  F=10000  180min`, { tail, teresaRawCPS: null, wallSeconds: 10800, F: 10000, stepSeconds: 100 });
}
console.log("\n════ ② 对照：同样场景但 F=1（验证 √F 时间缩放对记忆侧的真实影响）════");
for (const tail of [1e6, 2.5e3]) {
  await run(`tail=${tail === 1e6 ? "上游1e6" : "R35 2.5e3"}  F=1     180min`, { tail, teresaRawCPS: null, wallSeconds: 10800, F: 1, stepSeconds: 10 });
}

console.log("\n════ ③ 特蕾莎原始块速率扫描（内存块/秒）：找「达到 20 级」的临界速率 ════");
const CPS_LIST = [1e4, 1e5, 3e5, 1e6, 3e6, 1e7, 3e7, 1e8, 3e8];
for (const tail of [1e6, 2.5e3]) {
  console.log(`\n--- tail=${tail === 1e6 ? "上游1e6" : "R35 2.5e3"} ---`);
  for (const cps of CPS_LIST) {
    await run(`  teresaCPS=${cps.toExponential(0)}  F=10000  180min`, { tail, teresaRawCPS: cps, wallSeconds: 10800, F: 10000, stepSeconds: 100 });
  }
}

console.log("\n════ ④ 二分：R35 曲线(2.5e3) 下，达到 teresa 20 级所需的最小特蕾莎块速率 ════");
async function minCPS(tail, F) {
  let lo = 1e2, hi = 1e9;
  for (let it = 0; it < 18; it++) {
    const mid = Math.sqrt(lo * hi);
    const r = await page.evaluate(o => window.__sim(o), { saveText, tail, teresaRawCPS: mid, wallSeconds: 10800, F, stepSeconds: 200 });
    if (r.tL20.teresa !== null) hi = mid; else lo = mid;
  }
  return hi;
}
for (const [tail, F] of [[2.5e3, 10000], [1e6, 10000], [2.5e3, 1], [1e6, 1]]) {
  const cps = await minCPS(tail, F);
  console.log(`  tail=${tail === 1e6 ? "上游1e6" : "R35 2.5e3"}  F=${String(F).padStart(5)}  → teresa 到 20 级所需最小原始块速率 = ${cps.toExponential(3)} 块/秒`);
  console.log(`     折算特蕾莎所需 EP.log10 = ${(Math.cbrt(cps / 4) * 1e4).toExponential(4)}  （rawCPS=4·(EP.log10/1e4)^3）`);
}

console.log("\n════ ⑤ 尾乘 k 扫描（固定 teresaCPS，R35 曲线的 k=2.5e3；找最小可用 k）════");
async function minTail(cps, F) {
  let lo = 1, hi = 1e6;
  for (let it = 0; it < 16; it++) {
    const mid = Math.sqrt(lo * hi);
    const r = await page.evaluate(o => window.__sim(o), { saveText, tail: mid, teresaRawCPS: cps, wallSeconds: 10800, F, stepSeconds: 200 });
    if (r.tL20.teresa !== null) hi = mid; else lo = mid;
  }
  return hi;
}
for (const cps of [1e6, 1e7]) {
  for (const F of [10000, 1]) {
    const k = await minTail(cps, F);
    console.log(`  teresaCPS=${cps.toExponential(0)}  F=${String(F).padStart(5)}  → 达到 teresa 20 级所需最小尾乘 k = ${k.toExponential(4)}（即 ÷${(1e6 / k).toFixed(1)}）`);
  }
}

console.log("\n════ ⑥ 详细：R35 曲线 + 真实存档资源，180 分钟 F=10000 的完整轨迹 ════");
const detail = results.find(r => r.label.startsWith("tail=R35 2.5e3  F=10000"));
if (detail) {
  console.log(`资源指纹：EP.log10=${e(detail.fingerprint.EP_log10, 5)}  RM.log10=${e(detail.fingerprint.RM_log10, 5)}  glyphLevel=${fb(detail.fingerprint.glyphLevel)}  totalTimePlayed=${fb(detail.fingerprint.totalTimePlayed)}`);
  console.log(`最终：totalPetLevel=${detail.totalPetLevel}  remembrance=${detail.remembrance}  ppc=${e(detail.ppc, 5)}`);
  for (const p of detail.pets) {
    console.log(`  ${String(p.key).padEnd(18)} L=${String(p.level).padStart(2)} unlocked=${String(p.unlocked).padEnd(5)} mem=${fb(p.memories).padStart(12)} ch=${fb(p.memoryChunks).padStart(12)} memUpg=${String(p.memoryUpgrades).padStart(2)}(×${e(p.memMult, 3)}) chunkUpg=${String(p.chunkUpgrades).padStart(2)}(×${e(p.chunkMult, 3)}) rawCPS=${fb(p.rawCPS).padStart(12)} cps=${fb(p.cps).padStart(12)} memCapped=${p.memCapped} chunkCapped=${p.chunkCapped}`);
  }
  console.log("\n轨迹（wall 秒 / Ra 有效秒 / 各宠等级与记忆 / totalPetLevel / ppc）：");
  for (const t of detail.trace) {
    console.log(`  wall=${String(t.wall).padStart(6)}  ra=${String(t.ra).padStart(8)}  ` + t.pets.map(p => `${p.k}:L${p.L}/m${fb(p.mem)}`).join("  ") + `  total=${t.total}  ppc=${e(t.ppc, 3)}`);
  }
}

fs.writeFileSync(path.join(OUT_DIR, "probe2-report.json"), JSON.stringify(results, null, 2));
console.log(`\n已写入 ${path.join(OUT_DIR, "probe2-report.json")}`);
if (errs.length) console.log("\n页面异常：\n" + errs.slice(0, 10).join("\n"));
else console.log("\n无页面未捕获异常。");

await browser.close();
try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* */ }
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* */ }
server.close();
process.exit(0);
