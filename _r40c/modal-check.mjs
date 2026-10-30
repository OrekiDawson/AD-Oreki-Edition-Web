// 复测「离线进度模拟」弹窗在 320/360/392 三档是否仍溢出
const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
const out = [];
for (const v of [{ w: 320, h: 640 }, { w: 360, h: 640 }, { w: 392, h: 676 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // 触发离线弹窗：重载
  await page.evaluate(() => { window.onbeforeunload = null; location.reload(); }).catch(() => {});
  let found = null;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    found = await page.evaluate(() => {
      const m = document.querySelector(".c-modal[data-v-modal-progress-bar]");
      const p = document.querySelector(".modal-progress-bar[data-v-modal-progress-bar]");
      if (!m || !p) return null;
      const mb = m.getBoundingClientRect(), pb = p.getBoundingClientRect();
      return {
        vw: innerWidth, cw: document.documentElement.clientWidth,
        modal: { x: Math.round(mb.x), w: Math.round(mb.width), right: Math.round(mb.right), sw: m.scrollWidth, cw: m.clientWidth },
        bar: { x: Math.round(pb.x), w: Math.round(pb.width), right: Math.round(pb.right) },
        docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clipped: m.scrollWidth > m.clientWidth + 1,
      };
    }).catch(() => null);
    if (found) break;
  }
  out.push({ view: `${v.w}x${v.h}`, ...(found || { noModal: true }) });
  console.log(v.w + "x" + v.h, JSON.stringify(found));
  await page.screenshot({ path: `C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/r40c-modal-${v.w}.png` }).catch(() => {});
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
(await import("node:fs")).writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/modal-check.json", JSON.stringify(out, null, 2));
await b.disconnect();
