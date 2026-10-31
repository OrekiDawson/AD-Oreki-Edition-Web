// R42 · 教程弹窗底栏在窄屏的几何核查（320 / 360 / 390）
// 起因：320 宽的截图里「下一章」贴着弹窗右缘，怀疑底栏 4 个元素排不下。
// 这里量底栏自身 scrollWidth 与每个子元素的 rect，判断是真溢出还是视觉错觉。
//
// 运行：node _tools/_r42/tut-footer-probe.mjs

import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const SERVE_PORT = 8099;
const CDP_PORT = 9349;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  if (errors.length) console.log("pageErrors:", errors.slice(0, 3));
  for (const w of [320, 360, 390, 430]) {
    await page.setViewport({ width: w, height: 700, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await sleep(1000);
    if (w === 320) {
      const start = await page.evaluate(() => {
        const c = Array.from(document.querySelectorAll("button, [class*=button]"))
          .filter(n => n.getBoundingClientRect().width > 0)
          .map(n => { const r = n.getBoundingClientRect(); return { t: (n.innerText || "").trim().slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        return c.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.text || h.t)) || null;
      });
      if (start) { await page.mouse.click(start.x, start.y); await sleep(2500); }
      for (let i = 0; i < 5; i++) {
        if (!(await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length))) break;
        await page.keyboard.press("Escape"); await sleep(300);
      }
    }
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) window.TutorialReadingPosition.chapterId = null;
      window.Modal.orekiTutorial.show();
    });
    await sleep(900);
    await page.evaluate(() => {
      const n = document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)");
      if (n[5]) n[5].click();
    });
    await sleep(600);
    const info = await page.evaluate(() => {
      const f = document.querySelector(".c-oreki-tut__footer");
      if (!f) return null;
      const fr = f.getBoundingClientRect();
      const kids = Array.from(f.children).map(c => {
        const r = c.getBoundingClientRect();
        return { cls: String(c.className).slice(0, 34), text: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 10),
          x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height),
          outsideParent: r.right > fr.right + 1 || r.left < fr.left - 1 };
      });
      const modal = document.querySelector(".c-oreki-tut").getBoundingClientRect();
      return {
        footer: { x: Math.round(fr.x), right: Math.round(fr.right), w: Math.round(fr.width),
          scrollW: f.scrollWidth, clientW: f.clientWidth,
          selfOverflow: f.scrollWidth > f.clientWidth + 1,
          overflowX: getComputedStyle(f).overflowX, flexWrap: getComputedStyle(f).flexWrap },
        modal: { x: Math.round(modal.x), right: Math.round(modal.right), w: Math.round(modal.width) },
        kids,
        clipped: kids.filter(k => k.outsideParent || k.right > modal.right + 1),
      };
    });
    console.log(`--- ${w} ---`);
    console.log(JSON.stringify(info, null, 1));
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(n => /关闭教程/.test(n.innerText || ""));
      if (b) b.click();
    });
    await sleep(600);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(n => /确定|OK/.test(n.innerText || "")); if (b) b.click(); });
    await sleep(300);
  }
} finally {
  await cleanup();
}
