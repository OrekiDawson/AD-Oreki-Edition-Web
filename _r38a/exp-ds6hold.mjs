// 现场实验③：tier8 压住现实不放，看 DS6（膨胀研究 6）能不能靠 EC 链自己买上（R38-A）
import puppeteer from "puppeteer-core";
const port = process.env.OREKI_CDP_PORT || "9362";
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const setup = await page.evaluate(() => {
  try {
    Object.defineProperty(globalThis.OrekiCelestialAutomation, "holdReality", {
      configurable: true, get: () => true,
    });
  } catch (e) { return { err: String(e) }; }
  if (Laitela.isRunning) clearCelestialRuns();
  return { tier: Laitela.difficultyTier, run: Laitela.isRunning, realMs: player.records.thisReality.realTime };
});
console.log("setup", JSON.stringify(setup));
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const s = await page.evaluate(() => ({
    ds6: TimeStudy.reality.isBought,
    ec: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => EternityChallenge(i).completions).join(","),
    ds1: (() => { try { return DilationTimeStudyState.studies[1].config.requirement(); } catch (e) { return "e"; } })(),
    dsN: [1, 2, 3, 4, 5, 6].filter(i => DilationTimeStudyState.studies[i].isBought).length,
    realMs: Math.round(player.records.thisReality.realTime),
    realities: player.realities,
    ttL: Math.round(Currency.timeTheorems.value.log10()),
    epE: Math.round(Currency.eternityPoints.value.exponent),
  }));
  console.log(`${(i + 1) * 2}s ds6=${s.ds6} dsN=${s.dsN} ds1=${s.ds1} ec=[${s.ec}] real=${s.realMs} r=${s.realities} ttL=${s.ttL} epE=${s.epE}`);
  if (s.ds6) break;
}
await b.disconnect();
