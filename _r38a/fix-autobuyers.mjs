// 修复检查点里被 R37 旧逻辑关掉的 ID1 自动购买器（玩家开关，一次性修复）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9352";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  try {
    const before = player.auto.infinityDims.all.map(x => x.isActive);
    for (const x of player.auto.infinityDims.all) x.isActive = true;
    player.auto.infinityDims.isActive = true;
    player.auto.eternity.isActive = true;
    player.auto.bigCrunch.isActive = true;
    o.before = before;
    o.after = player.auto.infinityDims.all.map(x => x.isActive);
    GameStorage.save(true, false);
  } catch (e) { o.err = String(e && e.message); }
  return o;
});
console.log(JSON.stringify(out));
await b.disconnect();
