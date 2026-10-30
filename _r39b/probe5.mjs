import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9362", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  safe("typeofPurchaseUntil171", () => typeof TimeStudy(171).purchaseUntil);
  safe("typeofPurchaseUntil71", () => typeof TimeStudy(71).purchaseUntil);
  safe("buy71", () => { const r = TimeStudy(71).purchaseUntil(); return `ret=${JSON.stringify(r)} bought71=${TimeStudy(71).isBought} ` +
    `bought171=${TimeStudy(171).isBought} canBuy171=${TimeStudy(171).canBeBought}`; });
  safe("buy171", () => { const r = TimeStudy(171).purchaseUntil(); return `ret=${JSON.stringify(r)} bought171=${TimeStudy(171).isBought}`; });
  safe("ecStudyAfter", () => {
    const s = TimeStudy.eternityChallenge(2);
    return `ec2 canBeBought=${s.canBeBought} bought=${s.isBought} req=${JSON.stringify(s.config?.requirement)}`;
  });
  safe("ttLog", () => Currency.timeTheorems.value.log10().toFixed(2));
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
