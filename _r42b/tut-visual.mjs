// R42-B · 修完后目视核对：320 宽打开教程的完整弹窗 + 导航/表头/正文的 rect 与滚动状态
// 运行：node _tools/_r42b/tut-visual.mjs _tools/_r42b 320

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9359;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = [
  { name: "320", w: 320, h: 640, dpr: 2 },
  { name: "360", w: 360, h: 640, dpr: 2 },
  { name: "390", w: 390, h: 844, dpr: 3 },
  { name: "430", w: 430, h: 932, dpr: 3 },
  { name: "横屏_640x320", w: 640, h: 320, dpr: 2 },
].filter(v => ONLY.includes(v.name));

async function ensureServer() {
  const alive = await new Promise(res => {
    import("node:http").then(({ default: http }) => {
      const req = http.get(`http://127.0.0.1:${SERVE_PORT}/index.html`, r => { r.resume(); res(true); });
      req.on("error", () => res(false));
      req.setTimeout(1500, () => { req.destroy(); res(false); });
    });
  });
  if (alive) return { proc: null };
  const proc = spawn(process.execPath, ["serve.mjs", String(SERVE_PORT)], { cwd: path.resolve("AD-Oreki-Edition"), stdio: ["ignore", "pipe", "pipe"] });
  await sleep(1200);
  return { proc };
}

const report = { at: new Date().toISOString(), viewports: [] };
const { proc: serveProc } = await ensureServer();
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });
try {
  const { page } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await sleep(1500);
  const start = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll("button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0)
      .map(n => { const r = n.getBoundingClientRect(); return { t: (n.innerText || "").trim().slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    return cs.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.t)) || null;
  });
  if (start) { await page.mouse.click(start.x, start.y); await sleep(2500); }
  for (let i = 0; i < 6; i++) {
    if (!(await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length))) break;
    await page.keyboard.press("Escape"); await sleep(300);
  }
  for (const vp of VPS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
    await sleep(700);
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) { window.TutorialReadingPosition.chapterId = null; window.TutorialReadingPosition.scrollTop = 0; }
      window.Modal.orekiTutorial.show();
    });
    await sleep(900);
    const geo = await page.evaluate(() => {
      const q = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom), x: Math.round(r.x), w: Math.round(r.width) }; };
      const nav = document.querySelector(".c-oreki-tut__nav");
      return {
        modal: q(".c-modal"), tut: q(".c-oreki-tut"), layout: q(".c-oreki-tut__layout"),
        nav: q(".c-oreki-tut__nav"), head: q(".c-oreki-tut__head"), scroll: q(".c-oreki-tut__scroll"),
        footer: q(".c-oreki-tut__footer"), hint: q(".c-oreki-tut__hint"), main: q(".c-oreki-tut__main"),
        navScrollTop: nav ? Math.round(nav.scrollTop) : null,
        navVScroll: nav ? nav.scrollHeight - nav.clientHeight : null,
        layoutOverflow: (() => {
          const l = document.querySelector(".c-oreki-tut__layout");
          return l ? l.scrollHeight - l.clientHeight : null;
        })(),
      };
    });
    const box = await page.evaluate(() => {
      const m = document.querySelector(".l-modal") || document.querySelector(".c-modal");
      const r = m.getBoundingClientRect();
      return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: Math.min(innerWidth, r.width + 12), height: Math.min(innerHeight, r.height + 12) };
    });
    await page.screenshot({ path: path.join(OUT, "shots", `r42b_tut_modal_${vp.name}.png`), clip: box });
    report.viewports.push({ vp: vp.name, geo });
    console.log(`[${vp.name}]`, JSON.stringify(geo));
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => { try { window.Modal.hideAll(); } catch { /* ignore */ } });
      await sleep(250);
      if (!(await page.evaluate(() => document.querySelectorAll(".l-modal").length))) break;
      await page.keyboard.press("Escape"); await sleep(250);
    }
  }
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
  if (serveProc) { try { serveProc.kill(); } catch { /* ignore */ } }
}
fs.writeFileSync(path.join(OUT, "tut-visual-report.json"), JSON.stringify(report, null, 2));
console.log("done");
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
