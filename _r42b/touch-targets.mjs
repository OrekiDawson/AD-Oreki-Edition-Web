// R42-B · 教程弹窗内所有可点元素的尺寸清单（找 <44px 的触摸目标）
//
// 运行：node _tools/_r42b/touch-targets.mjs _tools/_r42b 320,360

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320,360").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9358;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = [{ name: "320", w: 320, h: 640, dpr: 2 }, { name: "360", w: 360, h: 640, dpr: 2 }]
  .filter(v => ONLY.includes(v.name));

const PROBE = `(() => {
  const items = [];
  const scope = document.querySelector(".l-modal") || document.body;
  for (const el of scope.querySelectorAll("button, a, [role=button], input[type=checkbox]")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    items.push({
      t: (el.innerText || el.getAttribute("aria-label") || el.className || el.tagName).replace(/\\s+/g, " ").trim().slice(0, 24),
      cls: String(el.className || "").slice(0, 40),
      w: Math.round(r.width), h: Math.round(r.height),
      minH: s.minHeight, height: s.height, lineH: s.lineHeight, pad: s.padding,
      small: r.width < 44 || r.height < 44,
    });
  }
  return { count: items.length, small: items.filter(i => i.small), all: items };
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
    const tut = await page.evaluate(PROBE);
    // 顺手量游戏内 HUD / 侧栏按钮（教程关掉后）
    report.viewports.push({ vp: vp.name, tutorial: tut });
    console.log(`[${vp.name}] 教程内可点元素 ${tut.count} 个，<44px 的 ${tut.small.length} 个：` +
      tut.small.map(s => `${s.t}(${s.w}x${s.h})`).join(" / "));
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
fs.writeFileSync(path.join(OUT, "touch-targets-report.json"), JSON.stringify(report, null, 2));
console.log("报告写入", path.join(OUT, "touch-targets-report.json"));
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
