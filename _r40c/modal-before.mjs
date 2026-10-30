// 复现"修复前"：把 oreki.css 里的两条窄屏规则用 !important 反转，回到上游 40rem 固定宽
const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
for (const v of [{ w: 320, h: 640 }, { w: 392, h: 676 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await page.evaluate(() => { window.onbeforeunload = null; location.reload(); }).catch(() => {});
  let ok = null;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    ok = await page.evaluate(() => {
      const m = document.querySelector(".c-modal[data-v-modal-progress-bar]");
      const p = document.querySelector(".modal-progress-bar[data-v-modal-progress-bar]");
      if (!m || !p) return null;
      // 反转修复：恢复上游固定宽度
      const s = document.getElementById("undo40c") || document.createElement("style");
      s.id = "undo40c";
      s.textContent = ".c-modal[data-v-modal-progress-bar]{width:auto!important;max-width:none!important}.modal-progress-bar[data-v-modal-progress-bar]{width:40rem!important;max-width:none!important}.modal-progress-bar__buttons[data-v-modal-progress-bar]{width:25rem!important}.modal-progress-bar__bg[data-v-modal-progress-bar]{width:20rem!important}";
      document.head.appendChild(s);
      const mb = m.getBoundingClientRect(), pb = p.getBoundingClientRect();
      return { vw: innerWidth, modal: { x: Math.round(mb.x), w: Math.round(mb.width), right: Math.round(mb.right), sw: m.scrollWidth, cw: m.clientWidth }, bar: { x: Math.round(pb.x), w: Math.round(pb.width), right: Math.round(pb.right) }, docOvf: document.documentElement.scrollWidth - document.documentElement.clientWidth, clipped: m.scrollWidth > m.clientWidth + 1 };
    }).catch(() => null);
    if (ok) break;
  }
  console.log("BEFORE(r40c 规则被反转) " + v.w + "x" + v.h, JSON.stringify(ok));
  await page.screenshot({ path: `C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/r40c-modal-before-${v.w}.png` }).catch(() => {});
  await page.evaluate(() => { const s = document.getElementById("undo40c"); if (s) s.remove(); }).catch(() => {});
  await page.evaluate(() => { const b2 = [...document.querySelectorAll(".c-modal button")].find(x => /跳过|加速/.test(x.innerText || "")); b2 && b2.click(); }).catch(() => {});
  await sleep(800);
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await b.disconnect();
