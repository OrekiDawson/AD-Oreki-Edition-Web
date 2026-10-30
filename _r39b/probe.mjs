// 只读探针：连到正在跑的长跑 Edge（CDP 9362），把关键终局状态打出来。
import puppeteer from "puppeteer-core";

const PORT = Number(process.env.OREKI_CDP_PORT || 9362);
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  safe("realities", () => player.realities);
  safe("eternitiesLog10", () => Math.round(Math.log10(Number(Currency.eternities.value))));
  safe("thisRealityMaxEPexp", () => Math.round(Math.log10(Number(player.records.thisReality.maxEP))));
  safe("TT", () => Number(Currency.timeTheorems.value));
  safe("ds6_avail", () => TimeStudy.reality.isAvailableForPurchase);
  safe("ds6_bought", () => TimeStudy.reality.isBought);
  safe("ec", () => player.challenge.eternity.completions.join(","));
  safe("ecUnlocked", () => player.challenge.eternity.unlocked);
  safe("laiUnl", () => Laitela.isUnlocked);
  safe("laiTier", () => Laitela.difficultyTier);
  safe("laiRun", () => Laitela.isRunning);
  safe("imLog10", () => Math.round(Math.log10(Number(Currency.imaginaryMachines.value))));
  safe("iu25q", () => ImaginaryUpgrade(25).isAvailableForPurchase);
  safe("iu25pos", () => ImaginaryUpgrade(25).isPossible);
  safe("iu15", () => ImaginaryUpgrade(15).isBought);
  safe("glyphs", () => Glyphs.activeWithoutCompanion.length);
  safe("pelleUnl", () => Pelle.isUnlocked);
  safe("step", () => globalThis.OrekiEndgameAutomation?.step);
  safe("err", () => globalThis.OrekiEndgameAutomation?._lastError);
  safe("hold", () => globalThis.OrekiEndgameAutomation?._laiHold);
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
