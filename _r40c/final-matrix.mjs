const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
const V = [[320,640],[360,640],[390,844],[392,676],[430,932],[768,1024],[1280,800],[768,360]];
const out = [];
for (const [w,h] of V) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 900, screenWidth: w, screenHeight: h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: w < 900, maxTouchPoints: w < 900 ? 5 : 1 });
  await sleep(500);
  const m = await page.evaluate(() => {
    const ui = document.querySelector("#ui");
    const tc = document.querySelector(".tab-container");
    const ub = ui.getBoundingClientRect();
    const tb = tc ? tc.getBoundingClientRect() : null;
    return {
      vw: innerWidth, vh: innerHeight,
      uiW: Math.round(ub.width), uiH: Math.round(ub.height),
      uiBottomOver: Math.round(ub.bottom - innerHeight),
      uiRightGap: Math.round(innerWidth - ub.right),
      docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      contentX: tb ? Math.round(tb.x) : null, contentW: tb ? Math.round(tb.width) : null,
      bodyPad: getComputedStyle(document.body).padding,
      tabPad: document.querySelector(".c-game-tab") ? getComputedStyle(document.querySelector(".c-game-tab")).paddingBottom : null,
    };
  });
  out.push({ view: `${w}x${h}`, ...m });
  console.log(`${w}x${h}`.padEnd(9), JSON.stringify(m));
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
(await import("node:fs")).writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/final-matrix.json".replace("_r40c/_r40c","_r40c"), JSON.stringify(out, null, 2));
await b.disconnect();
