// 只读诊断：DS6（膨胀研究 6「解锁现实」）为什么买不到（R38-A）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9352";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  try {
    const ds6 = TimeStudy.reality;
    const td8 = TimeStudy.timeDimension(8);
    o.tier = Laitela.difficultyTier;
    o.laiRun = Laitela.isRunning;
    o.maxDim = Laitela.maxAllowedDimension;
    o.ds6Bought = ds6.isBought;
    o.ds6Reqs = (() => { try { return ds6.config.requirement(); } catch (e) { return "err:" + e.message; } })();
    o.td8Bought = td8.isBought;
    o.maxEPExp = player.records.thisReality.maxEP.exponent;
    o.perkFirst = (() => { try { return Perk.firstPerk.isBought; } catch (e) { return "err"; } })();
    o.preRealityAch = (() => { try { return Achievements.preReality.filter(a => !a.isUnlocked).map(a => a.id); } catch (e) { return "err"; } })();
    o.achWaived = (() => { try { return globalThis.orekiAchievementsWaivedForReality?.() ?? "n/a"; } catch (e) { return "err:" + e.message; } })();
    o.tt = (() => { try { return Number(Currency.timeTheorems.value); } catch (e) { return null; } })();
    o.gs = (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })();
    o.realities = player.realities;
    o.iu25Bought = ImaginaryUpgrade(25).isBought;
    o.iu25Pos = ImaginaryUpgrade(25).isAvailableForPurchase;
    o.glyphN = Glyphs.activeWithoutCompanion.length;
    o.im = Number(Currency.imaginaryMachines.value);
    o.step = globalThis.OrekiEndgameAutomation?.step ?? null;
    o.lastErr = globalThis.OrekiEndgameAutomation?._lastError ?? null;
    o.holdLai = globalThis.OrekiEndgameAutomation?.holdForLaitela ?? null;
  } catch (e) { o.err = String((e && e.stack) || e); }
  return o;
});
console.log(JSON.stringify(out, null, 1));
await b.disconnect();
