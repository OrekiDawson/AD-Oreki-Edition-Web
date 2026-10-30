// 滚到底部后，检查固定底栏（存档计时 / 教程入口）是否压住可点元素
const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8288"));
const cdp = await page.createCDPSession();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);
const res = [];
for (const v of [{ w: 320, h: 640 }, { w: 392, h: 676 }, { w: 430, h: 932 }]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(400);
  for (const tab of ["维度", "选项", "自动化"]) {
    await page.evaluate(n => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === n); if (t) t.click(); }, tab);
    await sleep(300);
    const r = await page.evaluate(() => {
      const ui = document.querySelector("#ui");
      ui.scrollTop = ui.scrollHeight;
      const vh = innerHeight, vw = innerWidth;
      const vis = e => { const s = getComputedStyle(e); return s.visibility !== "hidden" && s.display !== "none" && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0; };
      const bars = [];
      for (const sel of [".o-save-timer", ".c-oreki-tut-entry"]) {
        const e = document.querySelector(sel);
        if (e && vis(e)) { const r = e.getBoundingClientRect(); bars.push({ sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }); }
      }
      const clk = [...document.querySelectorAll("#ui button, #ui a")].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { t: (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 16), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }; });
      const hits = [];
      for (const bar of bars) for (const c of clk) {
        const ix = Math.min(bar.x + bar.w, c.right) - Math.max(bar.x, c.x);
        const iy = Math.min(bar.y + bar.h, c.bottom) - Math.max(bar.y, c.y);
        if (ix > 6 && iy > 6) hits.push({ bar: bar.sel, target: c.t, overlapW: Math.round(ix), overlapH: Math.round(iy), pct: Math.round(ix * iy / Math.max(1, c.w * c.h) * 100) });
      }
      // 内容底部与底栏顶部的距离
      const lastBtn = clk.filter(c => c.bottom < vh + 200).sort((a, b) => b.bottom - a.bottom)[0];
      return { vw, vh, scrollTop: Math.round(ui.scrollTop), bars, hits: hits.slice(0, 6), hitCount: hits.length, lastBtn };
    });
    res.push({ view: `${v.w}x${v.h}`, tab, ...r });
    console.log(`${v.w}x${v.h} ${tab}: bars=${JSON.stringify(r.bars)} hitCount=${r.hitCount}`);
    if (r.hitCount) console.log("   hits:", JSON.stringify(r.hits.slice(0, 4)));
    console.log("   lastBtn:", JSON.stringify(r.lastBtn));
  }
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await (await import("node:fs")).writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/probe-bottom.json", JSON.stringify(res, null, 2));
await b.disconnect();
