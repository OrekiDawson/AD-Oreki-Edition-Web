// R36-C 场景仿真探针 v3（真实游戏代码 + 场景参数注入），headless Edge CDP 9342
//
// 目标（team-lead 第 2 步验收）：
//   1) 「每级一行」的重算表：门槛记忆 / 180 分钟可达量 / 缺口倍数 / 结论
//   2) 最小缩放系数（按指数缩）：在 180 分钟内仍能到 teresa 20 级的**最大**尾乘 k
//      （k 越大 = 门槛越高 = 除得越少；找出仍可达的上界）
//   3) √F 时间缩放对记忆侧的真实影响（F=1 vs F=10000，同资源同场景）
//   4) 真实存档资源指纹（EP.log10 → 特蕾莎原始块速率）
//
// 注入的都是**场景参数**（记忆曲线尾乘、特蕾莎原始记忆块速率、速度倍率），
// 不写存档、不伪造游戏进度标记；每轮仿真前重新加载同一存档。
//
// 用法：node _r36c/probe3.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

const WEB = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web";
const ROOT = path.join(WEB, "AD-Oreki-Edition");
const OUT_DIR = path.join(WEB, "_tools/_r36c");
const CDP_PORT = 9342;
const HTTP_PORT = 8434;
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
const profileDir = path.join(os.tmpdir(), `oreki-r36c3-${process.pid}-${CDP_PORT}`);
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
    try { return typeof gameLoop === "function" && typeof Ra === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.error("FATAL: 游戏未启动"); await browser.close(); server.close(); process.exit(1); }
console.log("PASS  游戏启动就绪（CDP 9342）\n");

const saveText = fs.readFileSync(path.join(WEB, "_saves/samples", SAVE_FILE), "utf-8");

await page.evaluate(() => {
  window.__sim3 = function (opts) {
    const { saveText, tail, teresaRawCPS, wallSeconds, F, stepSeconds } = opts;

    try { GameIntervals.stop(); } catch (e) { /* */ }
    player = GameSaveSerializer.deserialize(saveText);
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);

    const origReq = Ra.requiredMemoriesForLevel.bind(Ra);
    Ra.requiredMemoriesForLevel = function (level) {
      if (level >= Ra.levelCap) return Infinity;
      const adjustedLevel = level + Math.pow(level, 2) / 10;
      const post15Scaling = Math.pow(1.5, Math.max(0, level - 15));
      return Math.floor(Math.pow(adjustedLevel, 5.52) * post15Scaling * tail);
    };

    const teresaCfg = GameDatabase.celestials.ra.pets.teresa;
    const origTeresaCPS = teresaCfg.rawMemoryChunksPerSecond;
    if (teresaRawCPS !== null && teresaRawCPS !== undefined) teresaCfg.rawMemoryChunksPerSecond = () => teresaRawCPS;

    player.celestials.ra.run = true;
    for (const p of Ra.pets.all) {
      p.data.level = 1; p.data.memories = 0; p.data.memoryChunks = 0;
      p.data.memoryUpgrades = 0; p.data.chunkUpgrades = 0;
      p.__gross = 0; p.__spent = 0;
    }
    player.celestials.ra.petWithRemembrance = null;
    player.celestials.ra.unlockBits = 0;

    const pets = Ra.pets.all;
    // 包裹 tick 以累计「毛产出」（不受升级消耗影响）
    for (const p of pets) {
      if (p.__wrapped) continue;
      const orig = p.tick.bind(p);
      p.__origTick = orig;
      p.tick = (rd, gc) => {
        const before = p.memories;
        const r = orig(rd, gc);
        p.__gross += p.memories - before;
        return r;
      };
      p.__wrapped = true;
    }

    const sqrtF = Math.sqrt(F);
    const teff = wallSeconds * sqrtF;
    const step = stepSeconds * 1000;
    const steps = Math.ceil(teff / step);
    const levelTimeline = {};   // petKey -> [{L, wall, mem}]
    const startWall = {};       // petKey -> wall 秒

    const driveUnlocks = () => {
      for (const u of Ra.unlocks.all) {
        const pet = u.pet;
        if (!pet) continue;
        if (pet.level >= u.level && !u.isUnlocked) u.unlock();
      }
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
          while (p.level < Ra.levelCap && p.memories >= p.requiredMemories) {
            const from = p.level;
            p.levelUp();
            p.__spent += p.requiredMemories;   // 近似：升级花费（升级后 requiredMemories 已变）
            changed = true;
            const key = p.key.toLowerCase();
            (levelTimeline[key] ||= []).push({ L: p.level, wall: curWall, mem: p.memories });
          }
          while (!p.memoryUpgradeCapped && p.canBuyMemoryUpgrade) { p.purchaseMemoryUpgrade(); changed = true; }
          while (!p.chunkUpgradeCapped && p.canBuyChunkUpgrade) { p.purchaseChunkUpgrade(); changed = true; }
        }
      }
    };

    let curWall = 0;
    for (let i = 0; i < steps; i++) {
      curWall = ((i + 1) * stepSeconds) / sqrtF;
      for (const p of pets) p.tick(step, true);
      buy();
    }
    buy();

    const out = {
      tail, teresaRawCPS, wallSeconds, F, sqrtF, teff, steps,
      fingerprint: {
        EP_log10: Currency.eternityPoints.value.log10(),
        EP_pLog10: Currency.eternityPoints.value.pLog10(),
        RM_pLog10: Currency.realityMachines.value.pLog10(),
        glyphLevel: player.records.bestReality.glyphLevel,
      },
      pets: pets.map(p => ({
        key: p.key, level: p.level, unlocked: !!p.isUnlocked,
        memories: p.memories, gross: p.__gross, memoryChunks: p.memoryChunks,
        memoryUpgrades: p.data.memoryUpgrades, chunkUpgrades: p.data.chunkUpgrades,
        memMult: p.memoryUpgradeCurrentMult, chunkMult: p.chunkUpgradeCurrentMult,
        rawCPS: p.rawMemoryChunksPerSecond, cps: p.memoryChunksPerSecond,
        memCapped: p.memoryUpgradeCapped, chunkCapped: p.chunkUpgradeCapped,
      })),
      totalPetLevel: Ra.totalPetLevel,
      remembrance: Ra.remembrance.isUnlocked,
      ppc: Ra.productionPerMemoryChunk,
      levelTimeline,
      req: (() => { const a = []; for (let L = 1; L <= 24; L++) a.push({ L, req: Ra.requiredMemoriesForLevel(L) }); return a; })(),
    };
    Ra.requiredMemoriesForLevel = origReq;
    teresaCfg.rawMemoryChunksPerSecond = origTeresaCPS;
    return out;
  };
});

const e = (v, d = 4) => (v === null || v === undefined ? "—" : (typeof v === "number" ? (Number.isFinite(v) ? v.toExponential(d) : String(v)) : String(v)));
const fb = v => (v === null || v === undefined ? "—" : (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : String(v)));
const sim = (opts) => page.evaluate(o => window.__sim3(o), { saveText, ...opts });

// ── 现实资源基准（来自真实新档日志实测）──
const EP_LOG10_REAL = 4240460.38;                    // _r34b-gate1300.jsonl t=1319 的 epL
const CPS_REAL = 4 * Math.pow(EP_LOG10_REAL / 1e4, 3);
console.log(`现实资源基准（实测自 _r34b-gate1300.jsonl t=1319）：EP.log10 = ${EP_LOG10_REAL.toExponential(4)}`);
console.log(`  ⇒ 特蕾莎原始记忆块速率 rawCPS = 4·(EP.log10/1e4)^3 = ${CPS_REAL.toExponential(4)} 块/秒\n`);

const scenarios = [
  { id: "R35曲线 ÷400（2.5e3）+ 现实资源 + F=10000", tail: 2.5e3, cps: CPS_REAL, F: 10000 },
  { id: "上游原版（1e6）+ 现实资源 + F=10000", tail: 1e6, cps: CPS_REAL, F: 10000 },
  { id: "R35曲线 ÷400（2.5e3）+ 现实资源 + F=1", tail: 2.5e3, cps: CPS_REAL, F: 1 },
  { id: "上游原版（1e6）+ 现实资源 + F=1", tail: 1e6, cps: CPS_REAL, F: 1 },
];

const all = {};
for (const sc of scenarios) {
  console.log("═".repeat(96));
  console.log(`场景：${sc.id}`);
  console.log("═".repeat(96));
  const r = await sim({ tail: sc.tail, teresaRawCPS: sc.cps, wallSeconds: 10800, F: sc.F, stepSeconds: sc.F >= 1000 ? 100 : 10 });
  all[sc.id] = r;
  const t = r.pets[0];
  console.log(`资源指纹 EP.pLog10=${e(r.fingerprint.EP_pLog10, 5)}  RM.pLog10=${e(r.fingerprint.RM_pLog10, 5)}  → teresa rawCPS=${fb(t.rawCPS)}`);
  console.log(`180 分钟末：teresa L=${t.level}  totalPetLevel=${r.totalPetLevel}  remembrance=${r.remembrance}  毛产出=${fb(t.gross)}  池内存量=${fb(t.memories)}  memUpg=${t.memoryUpgrades}(×${e(t.memMult, 3)}) chunkUpg=${t.chunkUpgrades}(×${e(t.chunkMult, 3)}) ppc=${e(r.ppc, 3)}`);
  const tl = r.levelTimeline.teresa || [];
  console.log(`\n| 等级 L | 门槛 req(L) | 累计 Σreq(1..L) | 180分钟毛产出 | 缺口倍数(累计/产出) | 实测到达 L 的墙钟 | 结论 |`);
  console.log(`|---|---|---|---|---|---|---|`);
  let cum = 0;
  for (let L = 1; L <= 24; L++) {
    const req = r.req[L - 1].req;
    cum += req;
    const gross = t.gross;
    const gap = gross > 0 ? cum / gross : Infinity;
    const hit = tl.find(x => x.L === L);
    const concl = hit ? "可达" : "不可达";
    console.log(`| ${L} | ${fb(req)} | ${fb(cum)} | ${fb(gross)} | ${gap < 1e-6 ? "≈0（富余 " + (1 / gap).toExponential(3) + "×）" : fb(gap)} | ${hit ? Math.round(hit.wall) + " s" : "—"} | ${concl} |`);
  }
  console.log();
}

// ── 最小缩放系数：仍能在 180 分钟内到 teresa 20 级的**最大**尾乘 k ──
console.log("═".repeat(96));
console.log("最小缩放系数（尾乘 k 上界：k 越大门槛越高；超过此值 180 分钟内到不了 teresa 20 级）");
console.log("═".repeat(96));
async function maxTail(cps, F) {
  let lo = 1, hi = 1e9;                     // lo = 可达，hi = 不可达
  for (let it = 0; it < 22; it++) {
    const mid = Math.pow(lo * hi, 0.5);
    const r = await sim({ tail: mid, teresaRawCPS: cps, wallSeconds: 10800, F, stepSeconds: F >= 1000 ? 200 : 20 });
    const ok = r.pets[0].level >= 20;
    if (ok) lo = mid; else hi = mid;
  }
  return lo;
}
const grid = [];
for (const [cpsLabel, cps] of [["现实 3.05e8", CPS_REAL], ["保守 1.80e7", 4 * Math.pow(1650205.35 / 1e4, 3)], ["1e6", 1e6], ["1e5", 1e5]]) {
  for (const F of [10000, 1]) {
    const k = await maxTail(cps, F);
    grid.push({ cpsLabel, cps, F, maxTail: k, minDivisor: 1e6 / k });
    console.log(`  特蕾莎 rawCPS=${cpsLabel.padEnd(12)} F=${String(F).padStart(5)}  → 可达的最大尾乘 k = ${k.toExponential(4)}  相当于至少 ÷${(1e6 / k).toExponential(3)}`);
  }
}

fs.writeFileSync(path.join(OUT_DIR, "probe3-report.json"), JSON.stringify({ scenarios: all, grid }, null, 2));
console.log(`\n已写入 ${path.join(OUT_DIR, "probe3-report.json")}`);
if (errs.length) console.log("\n页面异常：\n" + errs.slice(0, 8).join("\n"));
else console.log("\n无页面未捕获异常。");

await browser.close();
try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* */ }
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* */ }
server.close();
process.exit(0);
