const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
for (const v of [{ w: 1280, h: 800 }, { w: 768, h: 1024 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: false, screenWidth: v.w, screenHeight: v.h });
  await sleep(800);
  await page.evaluate(() => { const ui = document.querySelector("#ui"); if (ui) ui.scrollTop = 0; });
  await page.evaluate(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "维度"); t && t.click(); });
  await sleep(900);
  const m = await page.evaluate(() => {
    const ui = document.querySelector("#ui"); const r = ui.getBoundingClientRect();
    return { vw: innerWidth, vh: innerHeight, uiW: Math.round(r.width), uiH: Math.round(r.height), uiY: Math.round(r.y), bottom: Math.round(r.bottom), bodyPad: getComputedStyle(document.body).padding, uiHcss: getComputedStyle(ui).height, docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(v.w + "x" + v.h, JSON.stringify(m));
  await page.screenshot({ path: `C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/r40c-desk-${v.w}.png` });
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await b.disconnect();
