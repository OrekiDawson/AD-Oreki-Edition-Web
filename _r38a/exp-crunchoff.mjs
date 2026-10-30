// 现场实验：莱特拉 run 期间关掉大坍缩/永恒自动购买器，看熵能不能持续涨（R38-A）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9352";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const info = await page.evaluate(() => {
  const o = {};
  o.savedBc = Autobuyer.bigCrunch.isActive;
  o.savedEt = Autobuyer.eternity.isActive;
  Autobuyer.bigCrunch.isActive = false;
  Autobuyer.eternity.isActive = false;
  if (!Laitela.isRunning) Laitela.initializeRun();
  o.run = Laitela.isRunning;
  o.tier = Laitela.difficultyTier;
  o.realMs = player.records.thisReality.realTime;
  return o;
});
console.log("setup", JSON.stringify(info));
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 500));
  const s = await page.evaluate(() => ({
    tier: player.celestials.laitela.difficultyTier,
    ent: player.celestials.laitela.entropy,
    amE: player.antimatter.exponent,
    run: Laitela.isRunning,
    realMs: player.records.thisReality.realTime,
    rate: Laitela.entropyGainPerSecond,
  }));
  console.log(`${(i + 1) * 0.5}s tier=${s.tier} run=${s.run} ent=${s.ent.toFixed(3)} amE=${Number(s.amE).toExponential(2)} rate=${s.rate.toFixed(4)} real=${s.realMs}`);
  if (s.tier >= 8) break;
}
await page.evaluate(() => null);
await b.disconnect();
