import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9362", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  safe("url", () => location.href + " @ " + document.title);
  safe("eternitiesLog10", () => Currency.eternities.value.log10().toFixed(1));
  safe("maxEPLog10", () => player.records.thisReality.maxEP.log10().toFixed(0));
  safe("TT", () => Currency.timeTheorems.value.toNumber());
  safe("ecState", () => JSON.stringify(player.challenge.eternity));
  safe("ecCompletions", () => {
    const a = [];
    for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions);
    return a.join(",");
  });
  safe("ds6", () => `avail=${TimeStudy.reality.isAvailableForPurchase} bought=${TimeStudy.reality.isBought} ` +
    `canBeBought=${TimeStudy.reality.canBeBought}`);
  safe("ecAutoNext", () => {
    const a = globalThis.OrekiEternityAutomation;
    return a && a.nextUnfinishedEcId ? a.nextUnfinishedEcId() : "n/a";
  });
  safe("ecAutoActive", () => globalThis.OrekiEternityAutomation?.active);
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
