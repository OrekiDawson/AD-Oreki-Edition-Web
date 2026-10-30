// R35-A：V 解锁门禁 / hold 状态机同帧只读诊断 + 真实新档验收
//
// 目的（对应任务 3.1 / 3.3）：
//   · 同一帧里同时记录 PlayerProgress.dilationUnlocked() / player.dilation.active /
//     player.dilation.studies 原始内容 / TimeStudy.reality.isBought / realities / TP /
//     maxDT / holdRealityForV / shouldReality() / gates / player.lastUpdate；
//   · 区分「门问错状态 / 帧序清空 / 帧循环停摆 / 其它」四种情况；
//   · 验收 visibilityState 全程 visible、tick 持续增长（lastUpdate 不冻结）、
//     TP 数值 > 0、maxDT 真实到 1e30、六项 progress、vCanUnlock / vUnlocked。
//
// 只读：本脚本不调用任何购买/解锁/重置函数，全部交给生产自动化代码。
// 用法：node _r35a-vgate.mjs [项目目录] [HTTP端口] [总时长秒] [Edge端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8820);
const DURATION = Number(process.argv[4] || 1300) * 1000;
const EDGE_PORT = Number(process.argv[5] || process.env.OREKI_EDGE_PORT || 9460);
const JSONL = process.env.OREKI_JSONL || `_r35a-vgate-${Date.now()}.jsonl`;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: EDGE_PORT });
const { page, errors: errs } = await openGame(browser, { port });

// 真实全新存档：清掉 localStorage 后重载
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => {
    try {
      if (v === null || v === undefined) return null;
      const t = String(v);
      if (t === "0" || t === "0e0") return null;
      if (t.includes("Infinity") || t === "NaN") return null;
      const i = t.indexOf("e");
      if (i < 0) {
        const n = Number(t);
        return Number.isFinite(n) && n > 0 ? Math.log10(n) : null;
      }
      const mant = Number(t.slice(0, i));
      const exp = Number(t.slice(i + 1));
      if (!Number.isFinite(mant) || !Number.isFinite(exp)) return null;
      return Math.log10(Math.abs(mant)) + exp;
    } catch (e) { return null; }
  };
  globalThis.__lg = lg;
  globalThis.__t0 = Date.now();
  // 250ms 心跳：与墙钟对照即可判定「渲染进程被冻结」而不是游戏停摆
  globalThis.__hb = 0;
  globalThis.__hbAt = Date.now();
  setInterval(() => { globalThis.__hb++; globalThis.__hbAt = Date.now(); }, 250);
  // 主循环 tick 计数：包装 gameLoop 不现实，改为直接累计 player.lastUpdate 的递增次数
  globalThis.__lastUpd = null;
  globalThis.__updTicks = 0;
  globalThis.__updStep = 0;
  globalThis.__snap = () => {
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const L = globalThis.__lg;
    // tick 增长：每次采样对比 player.lastUpdate 是否前进（值本身 + 自增次数）
    const lu = pick(() => player.lastUpdate);
    if (lu !== null && lu !== undefined) {
      if (globalThis.__lastUpd !== null && lu > globalThis.__lastUpd) globalThis.__updTicks++;
      globalThis.__updStep = globalThis.__lastUpd === null ? 0 : lu - globalThis.__lastUpd;
      globalThis.__lastUpd = lu;
    }
    const cs = pick(() => globalThis.OrekiCelestialAutomation?.debugState);
    const ecDone = pick(() => {
      const a = [];
      for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions);
      return a.join(",");
    });
    return {
      t: Math.floor((Date.now() - globalThis.__t0) / 1000),
      vis: pick(() => document.visibilityState),
      hidden: pick(() => document.hidden === true),
      focus: pick(() => document.hasFocus() === true),
      hb: pick(() => globalThis.__hb),
      hbLagMs: pick(() => Date.now() - globalThis.__hbAt),
      lastUpdate: pick(() => player.lastUpdate),
      updAdvance: globalThis.__updStep,
      updTicks: globalThis.__updTicks,
      // ── 门禁同帧快照（任务 3.1 要求逐项）──
      gDilUnlocked: pick(() => PlayerProgress.dilationUnlocked() === true),
      gDilActive: pick(() => player.dilation.active === true),
      gStudiesRaw: pick(() => JSON.stringify(player.dilation.studies)),
      gDS1: pick(() => DilationTimeStudyState.studies[1].isBought === true),
      gDS6: pick(() => TimeStudy.reality.isBought === true),
      gRealities: pick(() => player.realities),
      gTP: pick(() => Currency.tachyonParticles.value.toString()),
      gTPraw: pick(() => L(Currency.tachyonParticles.value)),
      gMaxDT: pick(() => player.records.thisReality.maxDT.toString()),
      gMaxDTL: pick(() => L(player.records.thisReality.maxDT)),
      gDtNowL: pick(() => L(Currency.dilatedTime.value)),
      gDtRateL: pick(() => L(getDilationGainPerSecond())),
      gHold: pick(() => globalThis.OrekiCelestialAutomation?.holdRealityForV === true),
      gHoldSince: pick(() => cs?.vHoldSince),
      gGraceSince: pick(() => cs?.vGraceSince),
      gEligible: pick(() => cs?.vFinishEligible),
      // shouldReality() 内部会写 `_readySince`（首次就绪时间戳）。探针必须把它**还原**，
      // 否则每 5 s 一次的采样会把「膨胀研究 1 的 10 s 窗口」反复重置，直接改变被测行为。
      gShouldReality: pick(() => {
        const ra = globalThis.OrekiRealityAutomation;
        if (!ra) return null;
        const prevSince = ra._readySince;
        const prevAt = ra._lastRealityAt;
        const v = ra.shouldReality() === true;
        ra._readySince = prevSince;
        ra._lastRealityAt = prevAt;
        return v;
      }),
      gGates: pick(() => cs?.gates),
      gDilStarts: pick(() => cs?.dilationStarts),
      gTpSeeds: pick(() => cs?.dilationTpSeeds),
      // ── 常规进度 ──
      realities: pick(() => player.realities),
      etL: pick(() => L(Currency.eternities.value)),
      infTotalL: pick(() => L(Currency.infinitiesTotal.value)),
      maxRepL: pick(() => L(player.records.thisReality.maxReplicanti)),
      rm: pick(() => Currency.realityMachines.value.toString()),
      epL: pick(() => L(Currency.eternityPoints.value)),
      studiesN: pick(() => player.timestudy.studies.length),
      ecDone,
      ecRunning: pick(() => EternityChallenge.isRunning === true),
      canReality: pick(() => isRealityAvailable() === true),
      vProg: pick(() => Object.entries(GameDatabase.celestials.v.mainUnlock)
        .map(([k, e]) => `${k}:${e.progress().toFixed(3)}`).join(" ")),
      vCan: pick(() => V.canUnlockCelestial === true),
      vUnlocked: pick(() => VUnlocks.vAchievementUnlock.isUnlocked === true),
      vRun: pick(() => player.celestials.v.run === true),
      spaceTh: pick(() => V.spaceTheorems),
      raUnlocked: pick(() => V.spaceTheorems >= 36),
      raPet: pick(() => Ra.totalPetLevel),
      lait: pick(() => ImaginaryUpgrade(15).isBought === true),
      pelle: pick(() => ImaginaryUpgrade(25).isBought === true),
      teresaUnl: pick(() => Teresa.isUnlocked === true),
      pouredL: pick(() => L(Teresa.pouredAmount)),
      effarigStage: pick(() => Effarig.currentStage),
      allRu: pick(() => RealityUpgrades.allBought === true),
      inCel: pick(() => isInCelestialReality() === true),
      celRun: pick(() => ["teresa", "effarig", "enslaved", "v"].filter(n => player.celestials[n]?.run).join(",")),
      speed: pick(() => getGameSpeedupFactor()),
      autoBuyOn: pick(() => player.auto.autobuyersOn === true),
      endState: pick(() => player.endState),
      // 代码版本探针：确认页面加载的是改后代码（模块缓存会让改动失效）
      hasR35: pick(() => typeof globalThis.OrekiCelestialAutomation?._vFinishEligible === "function"),
    };
  };
});

const lines = [];
const t0 = Date.now();
let lastPrint = 0;
console.log("=== R35-A V 门禁 / hold 状态机 真实新档采样 ===");
while (Date.now() - t0 < DURATION) {
  let s = null;
  try { s = await page.evaluate(() => globalThis.__snap()); } catch (e) { s = { err: String(e) }; }
  if (s) {
    fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastPrint >= 20) {
      lastPrint = el;
      console.log(`[${String(el).padStart(4)}s] vis=${s.vis} hbLag=${s.hbLagMs} r=${s.realities}` +
        ` dilU=${s.gDilUnlocked ? 1 : 0} act=${s.gDilActive ? 1 : 0} st=${s.gDilStarts} seed=${s.gTpSeeds}` +
        ` tp=${s.gTPraw?.toFixed(1) ?? "-"} maxDT=${s.gMaxDTL?.toFixed(1) ?? "-"} hold=${s.gHold ? 1 : 0}` +
        ` should=${s.gShouldReality ? 1 : 0} v=${s.vCan ? "CAN" : (s.vUnlocked ? "UNL" : "-")} gates=${JSON.stringify(s.gGates)}`);
    }
  }
  await new Promise(r => setTimeout(r, 5000));
}

const tail = await page.evaluate(() => globalThis.__snap()).catch(() => null);
console.log("=== 末态 ===");
console.log(JSON.stringify(tail, null, 1));

// 存档重载一致性：不改变任何状态，只验证「重载后 V/maxDT/TP 与重载前一致」
let reload = null;
try {
  const before = await page.evaluate(() => ({
    vUnlocked: (() => { try { return VUnlocks.vAchievementUnlock.isUnlocked === true; } catch (e) { return null; } })(),
    maxDT: (() => { try { return player.records.thisReality.maxDT.toString(); } catch (e) { return null; } })(),
    tp: (() => { try { return Currency.tachyonParticles.value.toString(); } catch (e) { return null; } })(),
    realities: (() => { try { return player.realities; } catch (e) { return null; } })(),
  }));
  await page.evaluate(() => { try { GameStorage.save(true); } catch (e) { /* ignore */ } });
  await new Promise(r => setTimeout(r, 1500));
  await page.reload({ waitUntil: "load", timeout: 60000 });
  for (let i = 0; i < 150; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
      catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }
  const after = await page.evaluate(() => ({
    vUnlocked: (() => { try { return VUnlocks.vAchievementUnlock.isUnlocked === true; } catch (e) { return null; } })(),
    maxDT: (() => { try { return player.records.thisReality.maxDT.toString(); } catch (e) { return null; } })(),
    tp: (() => { try { return Currency.tachyonParticles.value.toString(); } catch (e) { return null; } })(),
    realities: (() => { try { return player.realities; } catch (e) { return null; } })(),
  }));
  reload = { before, after };
  console.log("=== 重载一致性 ===");
  console.log(JSON.stringify(reload));
} catch (e) {
  console.log("重载校验失败:", String(e));
}

if (errs?.length) console.log("页面错误:", errs.slice(0, 5));
console.log("JSONL:", JSONL);
await cleanup();
server.close();
