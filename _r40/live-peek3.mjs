import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9374", defaultViewport: null });
const ps = await b.pages();
const p = ps.find(x => x.url().includes("127.0.0.1")) || ps[0];
const o = await p.evaluate(() => {
  const T = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return String(e.message); } };
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  return {
    t: Math.round((Date.now() - window.__r40T0) / 1000),
    break: player.break, doomed: Pelle.isDoomed,
    bcUnlocked: T(() => Autobuyer.bigCrunch.isUnlocked === true),
    bcActive: T(() => Autobuyer.bigCrunch.isActive === true),
    bcCanTick: T(() => Autobuyer.bigCrunch.canTick === true),
    bcMode: T(() => Autobuyer.bigCrunch.mode),
    strikeInfinity: T(() => PelleStrikes.infinity.hasStrike === true),
    maxAMThisInfL: T(() => Math.round(player.records.thisInfinity.maxAM.log10() * 1e3) / 1e3),
    amL: T(() => Math.round(player.antimatter.log10() * 1e3) / 1e3),
    canCrunch: T(() => Player.canCrunch === true),
    ip: S(T(() => Currency.infinityPoints.value)),
    gainIP: S(T(() => gainedInfinityPoints())),
    bootstrap: T(() => globalThis.isOrekiBootstrapRun ? isOrekiBootstrapRun() : "n/a"),
    realityStudy: T(() => TimeStudy.reality.isBought === true),
    div: T(() => Effects.min(308, Achievement(103), TimeStudy(111))),
    ivl: T(() => Autobuyer.bigCrunch.data.interval),
    bcCost: T(() => Autobuyer.bigCrunch.cost),
    armN: T(() => globalThis.OrekiEndgameAutomation?._doomArmageddons),
    phase: T(() => globalThis.OrekiEndgameAutomation?._doomPhase),
    lastArmAgo: T(() => Math.round((Date.now() - (globalThis.OrekiEndgameAutomation?._lastDoomArmAt || 0)) / 1000)),
    rem: T(() => player.celestials.pelle.remnants),
    remGain: T(() => Pelle.remnantsGain),
    shardsL: T(() => Math.round(Currency.realityShards.value.log10() * 1e2) / 1e2),
    keepAuto: T(() => PelleUpgrade.keepAutobuyers.isBought === true),
    eternityActive: T(() => Autobuyer.eternity.isActive === true),
  };
});
console.log(JSON.stringify(o, null, 1));
await b.disconnect();
