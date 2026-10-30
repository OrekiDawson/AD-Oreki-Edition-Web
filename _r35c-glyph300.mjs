// R34-B：真实新档 → V 链（膨胀 → TP → DT → V）实测采样。
// 只读观测：本脚本不调用任何购买/解锁函数，全部交给生产代码自动化。
// 用法：node _r34b-vchain.mjs [项目目录] [HTTP端口] [总时长秒] [Edge端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8816);
const DURATION = Number(process.argv[4] || 600) * 1000;
const JSONL = process.env.OREKI_JSONL || `_r34b-vchain-${Date.now()}.jsonl`;

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

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9452) });
const { page, errors: errs } = await openGame(browser, { port });

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

// pLog10 语义探针（护栏②的正确性依赖它）
const plogProbe = await page.evaluate(() => {
  try {
    const out = {};
    for (const v of [0, 1e-30, 1, 1e30]) out[v] = new Decimal(v).pLog10();
    out.__type = typeof new Decimal(0).pLog10();
    return out;
  } catch (e) { return { err: String(e) }; }
});
console.log("pLog10 探针:", JSON.stringify(plogProbe));

await page.evaluate(v => { globalThis.__OREKI_DIAG_SET__ = v; }, process.env.OREKI_DIAG_VGATE === "1");
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
  // [R34-B] 冻结硬指标：页面内 250ms 心跳。若心跳滞后（hbLagMs > 1500）而墙钟照走，
  // 说明渲染进程被 Page Lifecycle 冻结，这一帧之后的所有数据都不可信。
  globalThis.__hb = 0;
  globalThis.__hbAt = Date.now();
  setInterval(() => { globalThis.__hb++; globalThis.__hbAt = Date.now(); }, 250);
  // [R34-B] 诊断开关：绕过阶段 0 的 realities 门，用来回答「不冻结时 TP 到底会不会播种」。
  // 只在 OREKI_DIAG_VGATE=1 时打开，正式跑不设。
  if (globalThis.__OREKI_DIAG_SET__ === true) globalThis.__OREKI_DIAG_BYPASS_VGATE__ = true;
  globalThis.__snap = () => {
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const L = globalThis.__lg;
    const ecDone = pick(() => {
      const a = [];
      for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions);
      return a.join(",");
    });
    const vProg = pick(() => Object.entries(GameDatabase.celestials.v.mainUnlock)
      .map(([k, e]) => `${k}:${e.progress().toFixed(3)}`).join(" "));
    const cs = pick(() => globalThis.OrekiCelestialAutomation?.debugState);
    const ds1 = pick(() => {
      const s = DilationTimeStudyState.studies[1];
      return {
        isBought: s.isBought === true,
        canBeBought: s.canBeBought === true,
        reqMet: (s.config.requirement || []).map(r => {
          try { return typeof r === "function" ? !!r() : !!r; } catch (e) { return "ERR"; }
        }),
        cost: (s.cost || "").toString(),
      };
    });
    return {
      t: Math.floor((Date.now() - globalThis.__t0) / 1000),
      vis: pick(() => document.visibilityState),
      hidden: pick(() => document.hidden === true),
      focus: pick(() => document.hasFocus() === true),
      hb: pick(() => globalThis.__hb),
      hbLagMs: pick(() => Date.now() - globalThis.__hbAt),
      amL: pick(() => L(Currency.antimatter.value)),
      maxEtAmL: pick(() => L(player.records.thisEternity.maxAM)),
      maxInAmL: pick(() => L(player.records.thisInfinity.maxAM)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      maxIPL: pick(() => L(player.records.thisEternity.maxIP)),
      goalL: pick(() => L(Player.eternityGoal)),
      canEt: pick(() => Player.canEternity === true),
      infL: pick(() => L(player.infinities)),
      etL: pick(() => L(player.eternities)),
      realities: pick(() => player.realities),
      rm: pick(() => Currency.realityMachines.value.toString()),
      epL: pick(() => L(Currency.eternityPoints.value)),
      maxEpL: pick(() => L(player.records.thisReality.maxEP)),
      infTotalL: pick(() => L(Currency.infinitiesTotal.value)),
      ttL: pick(() => L(Currency.timeTheorems.value)),
      studiesN: pick(() => player.timestudy.studies.length),
      dilUnl: pick(() => PlayerProgress.dilationUnlocked() === true),
      ds1,
      ds1Name: pick(() => TimeStudy.dilation === DilationTimeStudyState.studies[1]),
      dsAllBought: pick(() => [1, 2, 3, 4, 5, 6].map(i => DilationTimeStudyState.studies[i].isBought ? 1 : 0).join("")),
      ecDone,
      nextEc: pick(() => globalThis.OrekiEternityAutomation?.nextUnfinishedEcId?.()),
      ecRunning: pick(() => EternityChallenge.isRunning === true),
      ecCur: pick(() => player.challenge.eternity.current),
      canReality: pick(() => isRealityAvailable() === true),
      realityStudy: pick(() => TimeStudy.reality.isBought === true),
      repL: pick(() => L(Replicanti.amount)),
      maxRepL: pick(() => L(player.records.thisReality.maxReplicanti)),
      rgBought: pick(() => Replicanti.galaxies.bought),
      rgMax: pick(() => Replicanti.galaxies.max),
      rgCanBuy: pick(() => Replicanti.galaxies.canBuyMore === true),
      dilActive: pick(() => player.dilation.active === true),
      dilStarts: pick(() => cs?.dilationStarts),
      tpSeeds: pick(() => cs?.dilationTpSeeds),
      tpL: pick(() => L(Currency.tachyonParticles.value)),
      maxDTL: pick(() => L(player.records.thisReality.maxDT)),
      dtNowL: pick(() => L(Currency.dilatedTime.value)),
      dtRateL: pick(() => L(getDilationGainPerSecond())),
      holdV: pick(() => globalThis.OrekiCelestialAutomation?.holdRealityForV === true),
      vHoldSince: pick(() => cs?.vHoldSince),
      vProg,
      vCan: pick(() => V.canUnlockCelestial === true),
      vUnlocked: pick(() => VUnlocks.vAchievementUnlock.isUnlocked === true),
      vRun: pick(() => player.celestials.v.run === true),
      spaceTh: pick(() => V.spaceTheorems),
      raPet: pick(() => Ra.totalPetLevel),
      raUnlocked: pick(() => V.spaceTheorems >= 36),
      lait: pick(() => ImaginaryUpgrade(15).isBought === true),
      pelle: pick(() => ImaginaryUpgrade(25).isBought === true),
      doomed: pick(() => Pelle.isDoomed === true),
      ad1MultL: pick(() => L(AntimatterDimension(1).multiplier)),
      tspeedL: pick(() => L(Tickspeed.perSecond)),
      inCel: pick(() => isInCelestialReality() === true),
      celRun: pick(() => ["teresa", "effarig", "enslaved", "v"].filter(n => player.celestials[n]?.run).join(",")),
      teresaUnl: pick(() => Teresa.isUnlocked === true),
      pouredL: pick(() => L(Teresa.pouredAmount)),
      effarigStage: pick(() => Effarig.currentStage),
      effarigUnl: pick(() => EffarigUnlock.reality.isUnlocked === true),
      allRu: pick(() => RealityUpgrades.allBought === true),
      // [R35-C] 符文等级观测修正。R34 的 `Glyphs.bestLevel` 在本版本根本不存在
      // （296 样本全 null）。真实语义有三层，全部在这里取：
      //   1) gainedGlyphLevel().actualLevel —— 「现在做一次现实能拿到的等级」，
      //      经 instability/hyperInstability 双软上限，正是 v.js:220 里 RU8 用的字段；
      //   2) gainedGlyphLevel().rawLevel   —— 软上限之前的原始等级，用来看软上限吃掉多少；
      //   3) player.records.bestReality.glyphLevel —— 历史最高纪录，只在现实结算时更新
      //      （reality.js:291-292），所以它可以落后于 1)。
      glyph: pick(() => {
        const g = gainedGlyphLevel();
        const inp = getGlyphLevelInputs();
        return {
          actual: g.actualLevel,
          raw: g.rawLevel,
          best: player.records.bestReality.glyphLevel,
          ep: inp.ep.value,
          repl: inp.repl.value,
          dt: inp.dt.value,
          eter: inp.eter.value,
          perkShop: inp.perkShop,
          shard: inp.shardFactor,
          singu: inp.singularityEffect,
          scalePenalty: inp.scalePenalty,
          inst: Glyphs.instabilityThreshold,
          hyperInst: Glyphs.hyperInstabilityThreshold,
          maxDTL: L(player.records.thisReality.maxDT),
          maxRepL: L(player.records.thisReality.maxReplicanti),
          maxEpL: L(player.records.thisReality.maxEP),
        };
      }),
      // [R35-C] V 的 runUnlocks 真实字段（player.celestials.v.runUnlocks = 已完成层级数）
      vRun: pick(() => ({
        running: player.celestials.v.run === true,
        completions: player.celestials.v.runUnlocks.join(","),
        records: player.celestials.v.runRecords.map(x => (x && x.toString ? (x.toString().length > 12 ? x.toString() : x.toString()) : String(x))).join("|"),
        st: V.spaceTheorems,
        ru8: VRunUnlock(8).conditionValue,
        ru8cur: player.celestials.v.runRecords[8],
        ru1: VRunUnlock(1).conditionValue,
        ru1cur: player.celestials.v.runRecords[1],
        ru7cur: player.celestials.v.runRecords[7],
        ru5cur: player.celestials.v.runRecords[5],
      })),
      // RU1 的三个来源分别有多少（星系总数 4000 的量化缺口）
      gal: pick(() => ({
        repl: Replicanti.galaxies.total,
        normal: player.galaxies,
        tachyon: player.dilation.totalTachyonGalaxies,
        total: Replicanti.galaxies.total + player.galaxies + player.dilation.totalTachyonGalaxies,
      })),
      slowestBH: pick(() => player.requirementChecks.reality.slowestBH.toString()),
      maxGlyphsRec: pick(() => player.requirementChecks.reality.maxGlyphs),
      // [R35-C] IM 上限链实测（machines.js:26-66，验证 OREKI_IM_CAP_MULT=10.6）
      im: pick(() => ({
        storedCap: player.reality.iMCap,
        baseCap: MachineHandler.baseIMCap,
        projected: MachineHandler.projectedIMCap,
        multApplied: typeof OREKI_IM_CAP_MULT === "number" ? OREKI_IM_CAP_MULT : "未加载",
        cur: Currency.imaginaryMachines.value,
        uncappedRML: MachineHandler.uncappedRM.log10(),
        hardcapReached: Currency.realityMachines.value.gte(MachineHandler.hardcapRM),
      })),
      ra: pick(() => ({
        unlocked: Ra.isUnlocked === true,
        running: Ra.isRunning === true,
        pet: Ra.totalPetLevel,
        pets: Ra.pets.all.map(p => `${p.key}:${p.isUnlocked ? p.level : "-"}`).join(","),
        mem: Ra.pets.all.map(p => (p.isUnlocked ? Number(p.memories) : 0)),
      })),
      autoBuyOn: pick(() => player.auto.autobuyersOn === true),
      speed: pick(() => getGameSpeedupFactor()),
      rejL: pick(() => L(Currency.timeShards.value)),
      glL: pick(() => L(Currency.glyphPoints?.value)),
      endState: pick(() => player.endState),
      // [R34-B] 代码版本探针：确认页面加载的是改后代码（模块缓存会让改动失效）
      hasDefer: pick(() => typeof OrekiRealityAutomation._deferRealityForVSeed === "function"),
      deferSince: pick(() => OrekiRealityAutomation._vSeedDeferSince),
      gates: pick(() => cs?.gates),
      eng: pick(() => navigator.userAgent.length > 0),
    };
  };
});

const t0 = Date.now();
let lastPrint = 0;
console.log("=== R35-C 真实新档：DT 增长下的符文等级观测 ===");
while (Date.now() - t0 < DURATION) {
  let s = null;
  try { s = await page.evaluate(() => globalThis.__snap()); } catch (e) { s = { err: String(e) }; }
  if (s) {
    fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastPrint >= 30) {
      lastPrint = el;
      const g = s.glyph || {};
      console.log(`[${String(el).padStart(4)}s] real=${s.realities} dil=${s.dilUnl ? 1 : 0}/${s.dilActive ? "A" : "-"}` +
        ` tp=${s.tpL?.toFixed(1) ?? "-"} maxDT=${s.maxDTL?.toFixed(1) ?? "-"}` +
        ` | GLYPH act=${g.actual ?? "-"} raw=${g.raw ?? "-"} best=${g.best ?? "-"}` +
        ` (ep=${g.ep?.toFixed(2) ?? "-"} repl=${g.repl?.toFixed(2) ?? "-"} dt=${g.dt?.toFixed(2) ?? "-"} eter=${g.eter?.toFixed(2) ?? "-"})` +
        ` | v=${s.vCan ? "CAN" : (s.vUnlocked ? "UNL" : "-")}${s.vRun?.running ? " RUN" : ""} st=${s.spaceTh} ru=${s.vRun?.completions ?? "-"}` +
        ` gal=${s.gal?.total ?? "-"} tt=${s.ttL?.toFixed(1) ?? "-"}` +
        ` | IM cap=${s.im?.storedCap?.toExponential?.(2) ?? s.im?.storedCap ?? "-"} base=${s.im?.baseCap?.toExponential?.(2) ?? "-"} mult=${s.im?.multApplied}` +
        ` | ra=${s.ra?.pet ?? "-"}`);
    }
  }
  await new Promise(r => setTimeout(r, 5000));
}

const tail = await page.evaluate(() => globalThis.__snap()).catch(() => null);
console.log("=== 末态 ===");
console.log(JSON.stringify(tail, null, 1));
if (errs?.length) console.log("页面错误:", errs.slice(0, 5));
console.log("JSONL:", JSONL);
await cleanup();
server.close();
