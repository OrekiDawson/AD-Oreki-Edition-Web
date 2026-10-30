const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c";
async function clearModals() {
  for (let i = 0; i < 30; i++) {
    const has = await page.evaluate(() => !!document.querySelector(".l-modal-overlay, .c-modal"));
    if (!has) return true;
    await page.evaluate(() => {
      const bt = [...document.querySelectorAll(".c-modal button")].find(x => /跳过|加速|嗯嗯|确定|关闭/.test(x.innerText || ""));
      if (bt) bt.click();
    });
    await sleep(1000);
  }
  return false;
}
for (const v of [{ w: 392, h: 676 }, { w: 320, h: 640 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(600);
  const okClear = await clearModals();
  for (const tab of ["维度", "挑战", "自动化", "统计数据", "选项"]) {
    await page.evaluate(n => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === n); t && t.click(); }, tab);
    await sleep(700);
    await page.evaluate(() => { document.querySelector("#ui").scrollTop = 0; });
    await sleep(300);
    const m = await page.evaluate(() => ({
      docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      uiBottomOver: Math.round(document.querySelector("#ui").getBoundingClientRect().bottom - innerHeight),
      modal: !!document.querySelector(".l-modal-overlay, .c-modal"),
      help: (() => { const h = document.querySelector(".l-help-me"), i = document.querySelector(".l-information"); if (!h || !i) return null; const a = h.getBoundingClientRect(), c = i.getBoundingClientRect(); return { helpBottom: Math.round(a.bottom), infoTop: Math.round(c.top), gap: Math.round(c.top - a.bottom) }; })(),
    }));
    console.log(`${v.w} ${tab} clear=${okClear}`, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/r40c-clean-${v.w}-${tab}.png` }).catch(() => {});
  }
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await b.disconnect();
