// R42-B · 教程窄屏导航条几何专项：为什么 320 宽下导航条高 117px
// 目的：确认高度是「内容撑开」还是「某条样式写死」，再决定要不要动。
//
// 运行：node _tools/_r42b/nav-geometry.mjs _tools/_r42b 320

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9357;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = [{ name: "320", w: 320, h: 640, dpr: 2 }, { name: "360", w: 360, h: 640, dpr: 2 }]
  .filter(v => ONLY.includes(v.name));

const PROBE = `(() => {
  const nav = document.querySelector(".c-oreki-tut__nav");
  const btns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"));
  const label = document.querySelector(".c-oreki-tut__nav-label");
  const cs = el => el ? getComputedStyle(el) : null;
  const ncs = cs(nav);
  const info = {
    nav: { h: Math.round(nav.getBoundingClientRect().height), clientH: nav.clientHeight,
      align: ncs.alignItems, flexDir: ncs.flexDirection, minH: ncs.minHeight, maxH: ncs.maxHeight,
      padding: ncs.padding, overflowY: ncs.overflowY, gap: ncs.gap },
    label: label ? { h: Math.round(label.getBoundingClientRect().height), mt: cs(label).marginTop,
      fs: cs(label).fontSize, lh: cs(label).lineHeight } : null,
    buttons: btns.slice(0, 4).map(b => {
      const s = cs(b), r = b.getBoundingClientRect();
      return { t: (b.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 14),
        w: Math.round(r.width), h: Math.round(r.height), minH: s.minHeight, h_: s.height,
        pad: s.padding, fs: s.fontSize, lh: s.lineHeight, ws: s.whiteSpace, alignSelf: s.alignSelf };
    }),
    tallest: (() => {
      let best = null;
      for (const n of document.querySelectorAll(".c-oreki-tut__nav > *")) {
        const r = n.getBoundingClientRect();
        if (!best || r.height > best.h) best = { cls: String(n.className || n.tagName).slice(0, 40), h: Math.round(r.height) };
      }
      return best;
    })(),
    layoutH: Math.round(document.querySelector(".c-oreki-tut__layout").getBoundingClientRect().height),
    mainH: Math.round(document.querySelector(".c-oreki-tut__main").getBoundingClientRect().height),
    scrollH: Math.round(document.querySelector(".c-oreki-tut__scroll").getBoundingClientRect().height),
    vh: innerHeight,
  };
  return info;
})()`;

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

const report = { at: new Date().toISOString(), envNote: "宿主机 Edge 视口模拟", viewports: [] };
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
    const info = await page.evaluate(PROBE);
    // 单独截导航条本体（含四周留白），用于肉眼确认是不是被压成竖排单字
    const box = await page.evaluate(() => {
      const n = document.querySelector(".c-oreki-tut__nav");
      const r = n.getBoundingClientRect();
      return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(innerWidth, r.width + 8), height: Math.min(innerHeight, r.height + 8) };
    });
    await page.screenshot({ path: path.join(OUT, "shots", `r42b_nav_${vp.name}.png`), clip: box });
    report.viewports.push({ vp: vp.name, info });
    console.log(`[${vp.name}] navH=${info.nav.h} layoutH=${info.layoutH} mainH=${info.mainH} scrollH=${info.scrollH} ` +
      `vh=${info.vh} tallest=${info.tallest && info.tallest.cls}:${info.tallest && info.tallest.h} ` +
      `btn=${JSON.stringify(info.buttons[0])} labelH=${info.label && info.label.h}`);
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
fs.writeFileSync(path.join(OUT, "nav-geometry-report.json"), JSON.stringify(report, null, 2));
console.log("报告写入", path.join(OUT, "nav-geometry-report.json"));
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
