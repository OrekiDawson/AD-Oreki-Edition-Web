// 诊断：hardReset 是否真的清档
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288"));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const snap = tag => page.evaluate(t => ({
  tag: t,
  am: String(player.antimatter),
  d1: String(player.dimensions.antimatter[0].amount),
  dims: player.dimensions.antimatter.length,
  ip: String(player.infinityPoints),
  ep: String(player.eternityPoints),
  rm: String(player.reality.realityMachines),
  slot: GameStorage.currentSlot,
  lsLen: (localStorage.getItem(GameStorage.localStorageKey) || "").length,
  saves: Object.values(GameStorage.saves || {}).map(s => (s || "").length),
  lsKeys: Object.keys(localStorage),
}), tag);

console.log(JSON.stringify(await snap("before")));
const hr = await page.evaluate(() => { try { GameStorage.hardReset(); return "ok"; } catch (e) { return "ERR " + e.message; } });
console.log("hardReset =>", hr);
console.log(JSON.stringify(await snap("immediate")));
await sleep(6000);
console.log(JSON.stringify(await snap("after6s")));
await browser.disconnect();
