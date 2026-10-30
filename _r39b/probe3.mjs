import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9362", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  for (let id = 1; id <= 3; id++) {
    safe(`ec${id}`, () => {
      const s = TimeStudy.eternityChallenge(id);
      return `bought=${s.isBought} canBeBought=${s.canBeBought} affordable=${s.isAffordable} ` +
        `req=${JSON.stringify(s.config?.requirement)} ` +
        `reqBought=${(s.config?.requirement || []).map(x => { try { return TimeStudy(x).isBought; } catch (e) { return "?"; } }).join(",")}`;
    });
  }
  safe("ec1Challenge", () => {
    const c = EternityChallenge(1);
    return `isUnlocked=${c.isUnlocked} completions=${c.completions}/${c.maxCompletions} req=${c.config?.requirement ? "yes" : "no"}`;
  });
  safe("unlocked", () => player.challenge.eternity.unlocked);
  safe("boughtStudies", () => {
    const list = [];
    for (let i = 11; i <= 200; i++) { try { if (TimeStudy(i) && TimeStudy(i).isBought) list.push(i); } catch (e) {} }
    return list.join(",");
  });
  safe("ttLog", () => Currency.timeTheorems.value.log10().toFixed(1));
  safe("ecStudyTT", () => {
    const arr = [];
    for (let i = 1; i <= 12; i++) { try { const s = TimeStudy.eternityChallenge(i); arr.push(`${i}:${s.isBought ? "B" : (s.canBeBought ? "C" : "-")}`); } catch (e) {} }
    return arr.join(" ");
  });
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
