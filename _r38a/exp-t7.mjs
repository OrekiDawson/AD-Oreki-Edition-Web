// 现场实验②：tier7 下「等 amE 冲高再进 run」，测 amE 衰减与熵增速（R38-A）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9352";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
await page.evaluate(() => {
  Autobuyer.bigCrunch.isActive = true;
  clearCelestialRuns();
});
let waited = 0;
for (; waited < 40; waited++) {
  await new Promise(r => setTimeout(r, 500));
  const s = await page.evaluate(() => ({
    amE: Number(player.antimatter.exponent), tier: Laitela.difficultyTier,
    run: Laitela.isRunning, realMs: player.records.thisReality.realTime,
  }));
  if (s.amE >= 1e10 && s.realMs < 20000 && !s.run) {
    console.log(`锁定 amE=1e${s.amE.toExponential(2)} tier=${s.tier} real=${s.realMs}`);
    break;
  }
}
await page.evaluate(() => { if (!Laitela.isRunning) Laitela.initializeRun(); });
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 150));
  const s = await page.evaluate(() => ({
    tier: player.celestials.laitela.difficultyTier, ent: player.celestials.laitela.entropy,
    amE: Number(player.antimatter.exponent), run: Laitela.isRunning,
    realMs: player.records.thisReality.realTime, rate: Laitela.entropyGainPerSecond,
  }));
  console.log(`${((i + 1) * 0.15).toFixed(2)}s tier=${s.tier} run=${s.run} ent=${s.ent.toFixed(3)} amE=${s.amE.toExponential(2)} rate=${s.rate.toFixed(4)} real=${s.realMs}`);
  if (s.tier >= 8) { console.log(">>> 升到 tier 8"); break; }
}
await b.disconnect();
