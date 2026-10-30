// 只读诊断：IU25 为什么买不到（R38-A）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9352";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  try {
    const u = ImaginaryUpgrade(25);
    o.tier = Laitela.difficultyTier;
    o.laiRun = Laitela.isRunning;
    o.maxDim = Laitela.maxAllowedDimension;
    o.entropy = player.celestials.laitela.entropy;
    o.imLog = Number(Currency.imaginaryMachines.value);
    o.cost = u.cost;
    o.isAvailableForPurchase = u.isAvailableForPurchase;
    o.isPossible = u.isPossible;
    o.hasFailed = u.config.hasFailed ? u.config.hasFailed() : null;
    o.checkRequirement = u.config.checkRequirement ? u.config.checkRequirement() : null;
    o.timeStudyReality = TimeStudy.reality.isBought;
    o.glyphCount = Glyphs.activeWithoutCompanion.length;
    o.glyphNames = Glyphs.activeWithoutCompanion.map(g => g && g.type);
    o.reqBitsMasked = (player.reality.imaginaryUpgReqs & (1 << 25)) !== 0;
    o.canBeApplied = u.canBeApplied;
    o.pelleDisabled = u.pelleDisabled;
    o.readyByAutomation = globalThis.OrekiEndgameAutomation?.iu25ConditionsReady?.() ?? null;
    o.purchaseTry = (() => { try { return u.purchase() === true; } catch (e) { return "err:" + e.message; } })();
    o.isBoughtAfter = u.isBought;
    o.step = globalThis.OrekiEndgameAutomation?.step ?? null;
    o.lastErr = globalThis.OrekiEndgameAutomation?._lastError ?? null;
  } catch (e) { o.err = String((e && e.stack) || e); }
  return o;
});
console.log(JSON.stringify(out, null, 1));
await b.disconnect();
