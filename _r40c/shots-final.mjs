// 最终存证截图：先关掉所有弹窗，再逐页截图
const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c";
for (const v of [{ w: 392, h: 676 }, { w: 320, h: 640 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(800);
  for (let i = 0; i < 8; i++) {
    const c = await page.evaluate(() => { const b2 = [...document.querySelectorAll(".c-modal button")].find(x => /跳过|嗯嗯|确定|加速/.test(x.innerText || "")); if (b2) { b2.click(); return b2.innerText.trim(); } return null; }).catch(() => null);
    if (!c) break;
    await sleep(900);
  }
  for (const tab of ["维度", "挑战", "自动化", "统计数据", "选项"]) {
    await page.evaluate(n => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === n); t && t.click(); }, tab);
    await sleep(900);
    await page.evaluate(() => { const ui = document.querySelector("#ui"); ui.scrollTop = 0; });
    await sleep(300);
    const m = await page.evaluate(() => ({
      docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      uiBottomOver: Math.round(document.querySelector("#ui").getBoundingClientRect().bottom - innerHeight),
      tab: (document.querySelector(".l-tab-btn-inner.o-tab-btn--active") || {}).innerText || null,
      modal: !!document.querySelector(".c-modal[data-v-modal-progress-bar]"),
    }));
    console.log(`${v.w} ${tab}`, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/r40c-final-${v.w}-${tab}.png` }).catch(() => {});
  }
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await b.disconnect();
