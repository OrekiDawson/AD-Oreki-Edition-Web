// 从活页面抓一份存档当检查点
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const out = process.argv[2] || "cp-late2.txt";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9352", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html")) || pages[0];
const info = await page.evaluate(() => {
  const o = {};
  try {
    GameStorage.save(true, false);
    o.save = localStorage.getItem("dimensionSave");
    o.realities = player.realities;
    o.amE = player.antimatter.exponent;
    o.imCap = MachineHandler.currentIMCap.toExponential(2);
    o.simTime = player.records.totalTimePlayed;
  } catch (e) { o.err = String(e && e.message); }
  return o;
});
if (info.err) { console.error(info.err); process.exit(1); }
fs.writeFileSync(new URL(out, import.meta.url), info.save);
console.log(JSON.stringify({ ...info, save: `(${info.save.length} bytes)` }));
await b.disconnect();
