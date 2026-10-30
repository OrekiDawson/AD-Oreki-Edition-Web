import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9362", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  safe("ec2detail", () => {
    const s = TimeStudy.eternityChallenge(2);
    return JSON.stringify({
      affordable: s.isAffordable,
      secondaryOK: s.allSecondaryRequirementsMet,
      reqTotal: (() => { try { return s.requirementTotal.log10().toFixed(0); } catch (e) { return "ERR"; } })(),
      unlockedField: player.challenge.eternity.unlocked,
      req171: TimeStudy(171).isBought,
    });
  });
  safe("infPower", () => Currency.infinityPower.value.log10().toFixed(1));
  safe("ec2goal", () => { try { return EternityChallenge(2).config.goal.log10().toFixed(0); } catch (e) { return "ERR"; } });
  safe("allEc", () => {
    const a = [];
    for (let i = 1; i <= 12; i++) {
      const s = TimeStudy.eternityChallenge(i);
      a.push(`${i}:${s.isBought ? "B" : (s.canBeBought ? "C" : (s.isAffordable ? "a" : "-"))}`);
    }
    return a.join(" ");
  });
  safe("secondaryNeed", () => {
    const s = TimeStudy.eternityChallenge(2);
    return JSON.stringify(s.config.secondary);
  });
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
