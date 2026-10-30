import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9374", defaultViewport: null });
const ps = await b.pages();
const p = ps.find(x => x.url().includes("127.0.0.1")) || ps[0];
const o = await p.evaluate(() => {
  const T = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return String(e.message); } };
  return {
    t: Math.round((Date.now() - window.__r40T0) / 1000),
    maxEPL: T(() => player.records.thisReality.maxEP.exponent),
    epL: T(() => Currency.eternityPoints.value.log10().toFixed(2)),
    realityStudy: T(() => TimeStudy.reality.isBought),
    ttLog: T(() => Currency.timeTheorems.value.log10().toFixed(3)),
    ttMaxLog: T(() => Currency.timeTheorems.max.log10().toFixed(3)),
    ready: T(() => isRealityAvailable()),
    shouldReality: T(() => globalThis.OrekiRealityAutomation?.shouldReality()),
    readySinceSec: T(() => Math.round((Date.now() - (globalThis.OrekiRealityAutomation?._readySince || 0)) / 1000)),
    lastRealityAgoSec: T(() => Math.round((Date.now() - (globalThis.OrekiRealityAutomation?._lastRealityAt || 0)) / 1000)),
    ecHold: T(() => globalThis.OrekiEternityAutomation?.shouldHoldReset()),
    ecTarget: T(() => globalThis.OrekiDilationAutomation?._targetEc()),
    ecStep: T(() => globalThis.OrekiDilationAutomation?._step),
    ecUnlocked: T(() => player.challenge.eternity.unlocked),
    ecCurrent: T(() => player.challenge.eternity.current),
    ecReqs: T(() => Object.entries(player.challenge.eternity.requirementBits || {}).length),
  };
});
console.log(JSON.stringify(o, null, 1));
await b.disconnect();
