// R21：真实新档 → 首次 Eternity，**只依赖生产代码的自动化**（AD3/AD3b/AD4/AD5/AD5b/AD6）
//
// 与 verify-real-newgame-to-eternity.mjs 的关键区别：
//   旧脚本在页面里装了 step() 手工驱动（买维度、买无限升级、买 ipMult、买 ID、升间隔、Break），
//   所以它测的是「脚本会玩 + 生产代码」的混合结果。
//   本脚本**完全不做任何购买**，只在 `Player.canEternity` 为真时调用一次 `eternity()`——
//   这是玩家唯一必须亲手按的那一下。其余全部交给生产代码。
//
// 用法：node verify-r21-eternity.mjs [项目目录] [端口] [总时长秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8780);
const DURATION = Number(process.argv[4] || 600) * 1000;
const JSONL = process.env.OREKI_JSONL || "";

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

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9422) });
const { page, errors: errs } = await openGame(browser, { port });

// 真正的新档
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

// 只装「点永恒」这一下，外加采样的公共函数；不做任何购买
await page.evaluate(() => {
  const lg = v => {
    try {
      const t = v.toString();
      const i = t.indexOf("e");
      if (i < 0) return Math.log10(Math.abs(Number(t)));
      return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
    } catch (e) { return NaN; }
  };
  globalThis.__lg = lg;
  globalThis.__milestones = {};
  globalThis.__step = () => {
    // 纯生产自动化测试：这里**完全不点任何按钮**，只做玩家唯一必须亲手按的那一下——永恒。
    // 开局买维度 / 计数频率 / 维度提升 / 星系 由 AD7 负责；
    // Break 与间隔升级由 AD5/AD5b 负责；无限维度与无限升级由 AD6 负责。
    try {
      // 生产代码暂未接管自动永恒（AD13 有回归已撤回），这里由脚本扮演玩家点永恒
      // 生产代码已接管自动永恒（AD13），脚本不再代点
    } catch (e) { /* ignore */ }
  };
  setInterval(() => { try { globalThis.__step(); } catch (e) { /* ignore */ } }, 200);
});

const t0 = Date.now();
const milestone = {};
const lines = [];
const record = (name, t) => {
  if (milestone[name] !== undefined) return;
  milestone[name] = t;
  console.log(`  ★ ${name} @ ${t}s`);
  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify({ milestone: name, t }) + "\n");
};

console.log("=== R21 真实新档（纯生产自动化）→ 首次 Eternity ===");

let last = null;
while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(() => {
    const L = globalThis.__lg;
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const ids = [];
    for (let t = 1; t <= 8; t++) {
      ids.push(pick(() => (InfinityDimension(t).isUnlocked ? 1 : 0)) || 0);
    }
    return {
      t: Math.floor((Date.now() - (globalThis.__t0 || Date.now())) / 1000),
      amL: pick(() => L(Currency.antimatter.value)),
      maxEtL: pick(() => L(player.records.thisEternity.maxAM)),
      maxInL: pick(() => L(player.records.thisInfinity.maxAM)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      maxIPL: pick(() => L(player.records.thisEternity.maxIP)),
      goalL: pick(() => L(Player.eternityGoal)),
      inf: pick(() => player.infinities.toString()),
      et: pick(() => player.eternities.toString()),
      brk: pick(() => player.break === true),
      canEt: pick(() => Player.canEternity === true),
      upg: pick(() => player.infinityUpgrades.size),
      ipMult: pick(() => player.IPMultPurchases),
      bcInterval: pick(() => player.auto.bigCrunch.interval),
      bcActive: pick(() => player.auto.bigCrunch.isActive === true),
      bcMode: pick(() => player.auto.bigCrunch.mode),
      dimboosts: pick(() => player.dimensionBoosts),
      galaxies: pick(() => player.galaxies),
      ids,
      id1u: ids[0] === 1,
      multL: pick(() => L(GameCache.totalIPMult.value)),
      ttL: pick(() => L(Currency.timeTheorems.value)),
      realityStudy: pick(() => TimeStudy.reality.isBought === true),
      ecUnlocked: pick(() => player.challenge.eternity.unlocked),
      boughtIds: pick(() => TimeStudy.boughtNormalTS().map(x=>x.id).join(",")),
      ec3Cur: pick(() => TimeStudy.eternityChallenge(3).requirementCurrent.toString()),
      ec3Tot: pick(() => TimeStudy.eternityChallenge(3).requirementTotal.toString()),
      ad8Tot: pick(() => AntimatterDimension(8).totalAmount.toString()),
      holdEt: pick(() => OrekiEternityAutomation ? true : false),
      ecRunning: pick(() => EternityChallenge.isRunning === true),
      ecDone: pick(() => { const o=[]; for(let i=1;i<=12;i++){ try{ o.push(EternityChallenge(i).completions);}catch(e){o.push(-1);} } return o.join(","); }),
      dilationUnlocked: pick(() => PlayerProgress.dilationUnlocked() === true),
      td1Unlocked: pick(() => TimeDimension(1).isUnlocked === true),
      td1Bought: pick(() => TimeDimension(1).bought === true),
      canBuyTT: pick(() => TimeTheorems.checkForBuying(true) === true),
      studiesN: pick(() => TimeStudy.boughtNormalTS().length),
      ttNow: pick(() => Currency.timeTheorems.value.toString()),
      canReality: pick(() => isRealityAvailable() === true),
      epL: pick(() => L(Currency.eternityPoints.value)),
      epGainL: pick(() => L(gainedEternityPoints())),
      etErr: pick(() => globalThis.__etErr || null),
      // ── R26 现实层观测 ─────────────────────────────────────────────
      realities: pick(() => player.realities),
      rmL: pick(() => L(Currency.realityMachines.value)),
      rmGainL: pick(() => L(MachineHandler.gainedRealityMachines)),
      ppL: pick(() => L(Currency.perkPoints.value)),
      glyphAct: pick(() => Glyphs.active.filter(g => g !== null).length),
      glyphInv: pick(() => Glyphs.inventoryList.filter(g => g).length),
      upgBits: pick(() => player.reality.upgradeBits),
      upgReqs: pick(() => player.reality.upgReqs),
      allRuBought: pick(() => RealityUpgrades.allBought === true),
      ruCount: pick(() => RealityUpgrades.all.filter(u => u.isBought).length),
      ruIds: pick(() => RealityUpgrades.all.filter(u => u.isBought).map(u => u.id).join(",")),
      ruSlots: pick(() => Glyphs.activeSlotCount),
      glyphLv: pick(() => Glyphs.activeWithoutCompanion.map(g => `${g.type}:${g.level}:${g.strength}`).join(" ")),
      invHigh: pick(() => Glyphs.inventoryList.filter(g => g && g.level >= 10).length),
      teresaUnlocked: pick(() => Achievement(147).isUnlocked === true),
      perkPts: pick(() => Currency.perkPoints.value.toString()),
      fired: pick(() => globalThis.OrekiRealityAutomation?._realitiesFired ?? 0),
      endState: pick(() => GameEnd.endState),
      isGameEnd: pick(() => player.isGameEnd === true),
      pelleDoomed: pick(() => Pelle.isDoomed === true),
      teresa: pick(() => Teresa.isRunning === true),
      // R26 现实后 EC 重解锁诊断
      ecCur: pick(() => player.challenge.eternity.current),
      ec6B: pick(() => TimeStudy.eternityChallenge(6).isBought),
      ec6E: pick(() => TimeStudy.eternityChallenge(6).isEntryGoalMet),
      ec8B: pick(() => TimeStudy.eternityChallenge(8).isBought),
      ec12B: pick(() => TimeStudy.eternityChallenge(12).isBought),
      ecEnt: pick(() => OrekiEternityAutomation.ecEntryPending()),
      nextEc: pick(() => OrekiEternityAutomation.nextUnfinishedEcId()),
      repGal: pick(() => player.replicanti.galaxies),
      repCap: pick(() => Replicanti.galaxies.max),
      tsBought: pick(() => TimeStudy.boughtEternityTS().map(x => x.id).join(",")),
      // ── R27 天神链观测 ─────────────────────────────────────────────
      pouredL: pick(() => L(Teresa.pouredAmount)),
      teresaUnlockedNow: pick(() => Teresa.isUnlocked === true),
      teresaRun: pick(() => player.celestials.teresa.run === true),
      effarigRun: pick(() => player.celestials.effarig.run === true),
      enslavedRun: pick(() => player.celestials.enslaved.run === true),
      vRun: pick(() => player.celestials.v.run === true),
      effarigUnlocked: pick(() => TeresaUnlocks.effarig.isUnlocked === true),
      enslavedUnlocked: pick(() => Enslaved.isUnlocked === true),
      vUnlocked: pick(() => VUnlocks.vAchievementUnlock.isUnlocked === true),
      vCanUnlock: pick(() => V.canUnlockCelestial === true),
      celestialEntered: pick(() => JSON.stringify(globalThis.OrekiCelestialAutomation?._entered ?? {})),
      inCelestial: pick(() => isInCelestialReality() === true),
      // ── R28 现实升级逐项诊断 ────────────────────────────────────────
      ruDetail: pick(() => RealityUpgrades.all.filter(u => u.id >= 6).map(u =>
        `${u.id}${u.isBought ? "✓" : (u.isAvailableForPurchase ? "o" : "x")}`).join("")),
      ru18: pick(() => ({ bought: RealityUpgrade(18).isBought, avail: RealityUpgrade(18).isAvailableForPurchase, cost: RealityUpgrade(18).cost.toString() })),
      ru20: pick(() => ({ bought: RealityUpgrade(20).isBought, avail: RealityUpgrade(20).isAvailableForPurchase, cost: RealityUpgrade(20).cost.toString() })),
      ru21: pick(() => ({ bought: RealityUpgrade(21).isBought, avail: RealityUpgrade(21).isAvailableForPurchase, cost: RealityUpgrade(21).cost.toString() })),
      a147: pick(() => Achievement(147).isUnlocked === true),
      teresaIsUnlocked: pick(() => Teresa.isUnlocked === true),
      // ── R30 鹿颈长（Effarig）链观测 ────────────────────────────────
      // 为什么要这几个字段：Effarig 的入场券是 `EffarigUnlock.run`（原版 5e11 碎片），
      // 而碎片公式 `pow(EP_exponent / 7500, glyphEffectAmount)` 在 EP 指数 < 7500 时
      // 会因「小于 1 的底数取高次幂」而归零 → 碎片恒 0 → 永远买不起 → 天神链断在这里。
      // 所以必须同时观测「碎片存量」「本次现实可得碎片」「符文效果位计数」，
      // 才能判断缩放参数（OREKI_EFFARIG_SHARD_DIVISOR / OREKI_EFFARIG_UNLOCK_COST_DIVISOR）
      // 是否落在正确量级。
      relicShardsL: pick(() => L(Currency.relicShards.value)),
      shardsGainedL: pick(() => L(Effarig.shardsGained)),
      glyphEffectAmt: pick(() => Effarig.glyphEffectAmount),
      effarigStage: pick(() => Effarig.currentStage),
      effarigUnlockRun: pick(() => EffarigUnlock.run.isUnlocked === true),
      effarigUnlockRunCost: pick(() => EffarigUnlock.run.cost),
      effarigUnlockInf: pick(() => EffarigUnlock.infinity.isUnlocked === true),
      effarigUnlockEtn: pick(() => EffarigUnlock.eternity.isUnlocked === true),
      glyphHigh: pick(() => Glyphs.inventoryList.filter(g => g && g.level >= 10).length),
      glyphEquippedHigh: pick(() => Glyphs.activeWithoutCompanion.countWhere(g => g.level >= 10)),
      galTotal: pick(() => Replicanti.galaxies.total + player.galaxies + player.dilation.totalTachyonGalaxies),
      blackHoleDays: pick(() => Time.timeSinceBlackHole.totalDays),
      // ── R32 鹿颈长削弱链路观测 ──────────────────────────────────────
      // R31 只能看到「阶段没推进」，无法区分根因是：
      //   (a) nerf 仍在压制每个乘子的指数（multDilation 偏低）
      //   (b) 自动化在 run 内没有真实触发 Big Crunch
      //   (c) 维度购买 / tickspeed 本身起不来
      // 下面三个字段一次把三者分开，避免再跑一轮盲测。
      canCrunch: pick(() => Player.canCrunch === true),
      effMult: pick(() => Number(Effarig.multDilation.toFixed(5))),
      effTick: pick(() => Number(Effarig.tickDilation.toFixed(5))),
      effNerf: pick(() => Number(Effarig.nerfFactor(Currency.infinityPower.value).toFixed(5))),
      adBought: pick(() => [1, 2, 3, 4, 5, 6, 7, 8].map(i => AntimatterDimension(i).bought).join(",")),
      adMultL: pick(() => [1, 2, 3, 4, 5, 6, 7, 8]
        .map(i => L(AntimatterDimension(i).multiplier.value)).join(",")),
      tspeedL: pick(() => L(Tickspeed.perSecond)),
      ipowL: pick(() => L(Currency.infinityPower.value)),
      tshardL: pick(() => L(Currency.timeShards.value)),
      effShardL: pick(() => L(Effarig.shardsGained)),
      // ── R33 V 解锁六项 mainUnlock 逐项诊断 ─────────────────────────
      // `VUnlocks.vAchievementUnlock.requirement()` 是
      // `Object.values(GameDatabase.celestials.v.mainUnlock).every(e => e.progress() >= 1)`
      // （secret-formula/celestials/v.js:196），即六项**必须同时**达 100%。
      // 只记 `vCanUnlock` 无法知道卡在哪一项，所以把每项 progress 原样取出来。
      vProg: pick(() => Object.entries(GameDatabase.celestials.v.mainUnlock)
        .map(([k, e]) => `${k}:${Number(e.progress()).toPrecision(4)}`).join(" ")),
      vReal: pick(() => Currency.realities.value / 10000),
      vEtL: pick(() => L(Currency.eternities.value)),
      vInL: pick(() => L(Currency.infinitiesTotal.value)),
      vDtL: pick(() => L(player.records.thisReality.maxDT)),
      vRepL: pick(() => L(player.records.thisReality.maxReplicanti)),
      vRmL: pick(() => L(Currency.realityMachines.value)),
      // 无名氏入场券（R33 修复对象）：没有它就绝不该进 run。
      // `ENSLAVED_UNLOCKS` 没有暴露到 window，用底层存储位判断（id=1 即 RUN）。
      ensTicket: pick(() => (player.celestials.enslaved.unlocks || []).includes(1)),
      ensStoredL: pick(() => L(player.celestials.enslaved.stored)),
      glyphBestLv: pick(() => Math.max(0, ...Glyphs.inventoryList.filter(g => g).map(g => g.level))),
      // ── R33 膨胀链路诊断（B 方案验证用）─────────────────────────────
      dilActive: pick(() => player.dilation.active === true),
      dilStarts: pick(() => OrekiCelestialAutomation._dilationStarts),
      tpL: pick(() => L(Currency.tachyonParticles.value)),
      dtRaw: pick(() => player.records.thisReality.maxDT.toString()),
      dtNowL: pick(() => L(Currency.dilatedTime.value)),
      // 帧循环存活探针：`player.lastUpdate` 是 gameLoop 每帧写入的真实时间戳。
      // 若这个值持续变大，说明「整局停摆」不是代码死锁，而是浏览器停发 rAF（窗口被遮挡）。
      lastUpdAge: pick(() => Date.now() - player.lastUpdate),
      // V 收尾阶段：是否压住现实、TP 喂食次数
      holdV: pick(() => OrekiCelestialAutomation.holdRealityForV === true),
      tpSeeds: pick(() => OrekiCelestialAutomation._dilationTpSeeds),
      // 帧循环存活（秒）：player.lastUpdate 由 gameLoop 每帧写入
      playedSec: pick(() => Math.round(Number(player.records.totalTimePlayed) / 1000)),
    };
  }).catch(e => ({ t: Math.floor((Date.now() - t0) / 1000), sampleErr: String(e && e.message || e).slice(0, 200) }));
  if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }
  if (s.sampleErr) {
    // 采样本身失败（页面报错 / 变量未就绪）：把异常原文留下来，不要静默吞掉
    console.log(`t=${s.t}s 采样异常: ${s.sampleErr}`);
    if (JSONL) fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
    await new Promise(r => setTimeout(r, 1000));
    continue;
  }

  const t = Math.floor((Date.now() - t0) / 1000);
  s.t = t;
  last = s;

  if (s.brk) record("Break", t);
  if (Number(s.inf) >= 1) record("首次无限", t);
  if (s.id1u) record("ID1 解锁", t);
  if (s.ids.slice(0, 8).every(x => x === 1)) record("ID1-8 全解锁", t);
  if (s.canEt) record("canEternity=true", t);
  if (Number(s.et) >= 1) record("首次永恒", t);
  if (s.ecDone === "5,5,5,5,5,5,5,5,5,5,5,5") record("EC12×5", t);
  if (s.canReality) record("canReality=true", t);
  if (Number(s.realities) >= 1) record("首次现实", t);
  if (s.teresaUnlockedNow) record("特蕾莎解锁(A147)", t);
  if (s.a147) record("成就147达成", t);
  if (s.teresaIsUnlocked) record("Teresa.isUnlocked", t);
  if (s.pouredL >= 24) record("特蕾莎浇满1e24", t);
  if (s.effarigUnlocked) record("鹿颈长解锁", t);
  if (s.enslavedUnlocked) record("无名氏解锁", t);
  if (s.vUnlocked) record("V解锁", t);
  if (s.isGameEnd) record("isGameEnd=true", t);

  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (t % 5 === 0 || t < 5) {
    console.log(`t=${String(t).padStart(4)}s maxIn=1e${String(s.maxInL).slice(0, 7)} maxEt=1e${String(s.maxEtL).slice(0, 7)} IP=1e${String(s.ipL).slice(0, 6)} maxIP=1e${String(s.maxIPL).slice(0, 6)} inf=${String(s.inf).slice(0, 6)} ID=[${s.ids.join("")}] 升级=${s.upg} 间隔=${s.bcInterval} 坍缩=${s.bcMode}/${s.bcActive} canEt=${s.canEt} et=${s.et}`);
    console.log(`        real=${s.realities} canReal=${s.canReality} ensRun=${s.enslavedRun} ticket=${s.ensTicket} V[${s.vProg || "-"}]`);
  }

  await new Promise(r => setTimeout(r, 1000));
}

console.log("\n=== 里程碑 ===");
for (const [k, v] of Object.entries(milestone)) console.log(`  ${k}: ${v}s`);
if (Object.keys(milestone).length === 0) console.log("  （无）");
if (last) {
  console.log("\n=== 末态 ===");
  console.log(JSON.stringify(last, null, 0));
}
if (errs.length) console.log("\n页面异常:", errs.slice(0, 3));

await cleanup();
server.close();
process.exit(0);
