// R40-A3 · 只读旁路采样：连到正在跑的长跑浏览器（CDP），读 V 的六项 mainUnlock progress。
// 不写任何 player 字段，不调任何 purchase/start。
//
// 用法：node _r40/vprobe.mjs [cdpPort=9374]
import puppeteer from "puppeteer-core";

const PORT = Number(process.argv[2] || 9374);
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}` });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("127.0.0.1")) || pages[0];

const out = await page.evaluate(() => {
  const T = fn => { try { return fn(); } catch (e) { return "ERR:" + e.message; } };
  const L = v => T(() => v.log10().toFixed(2));
  const r = {
    realities: T(() => player.realities),
    eternitiesL: T(() => L(Currency.eternities.value)),
    infinitiesTotalL: T(() => L(Currency.infinitiesTotal.value)),
    maxDTL: T(() => L(player.records.thisReality.maxDT)),
    maxReplicantiL: T(() => L(player.records.thisReality.maxReplicanti)),
    rmL: T(() => L(Currency.realityMachines.value)),
    vUnl: T(() => VUnlocks.vAchievementUnlock.isUnlocked),
    progs: T(() => Object.entries(GameDatabase.celestials.v.mainUnlock)
      .map(([k, e]) => `${k}=${Number(e.progress()).toFixed(3)}`).join(" ")),
    dilationActive: T(() => player.dilation.active),
    dsBought: T(() => DilationTimeStudyState.studies.map((s, i) => s.isBought ? 1 : 0).join("")),
    laiTier: T(() => Laitela.difficultyTier),
    laiRun: T(() => Laitela.isRunning),
    laiEnt: T(() => player.celestials.laitela.entropy),
    amE: T(() => Number(player.antimatter.exponent)),
    realSec: T(() => Math.round(Time.thisRealityRealTime.totalSeconds)),
  };
  return r;
});
console.log(JSON.stringify(out, null, 1));
await browser.disconnect();
