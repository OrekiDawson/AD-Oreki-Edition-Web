// R42-B · 命中测试：弹窗底部按钮到底是「看得见但点不到」还是「被裁掉」
// 判据：elementFromPoint(按钮中心) 是否仍落在该按钮（或其后代）上。
// 被裁切 / 被兄弟元素盖住都会让命中落到别的元素，这是比截图更硬的判据。
//
// 运行：node _tools/_r42b/hit-test.mjs _tools/_r42b 320,360

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320,360").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9360;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = [{ name: "320", w: 320, h: 640, dpr: 2 }, { name: "360", w: 360, h: 640, dpr: 2 }]
  .filter(v => ONLY.includes(v.name));

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

const HIT = `(() => {
  const targets = [];
  const push = (el, name) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) { targets.push({ name, missing: true }); return; }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    // 被裁切时命中会落到容器或 body；用「命中元素是否为目标自身或其后代」判断
    const inside = hit ? (hit === el || el.contains(hit)) : false;
    // 再按矩形采样：上 / 中 / 下三点，看有多少比例真的能命中自己
    const ys = [r.top + 4, cy, r.bottom - 4].filter(y => y > 0 && y < innerHeight);
    const okY = ys.filter(y => { const h = document.elementFromPoint(cx, y); return h && (h === el || el.contains(h)); });
    targets.push({
      name, w: Math.round(r.width), h: Math.round(r.height),
      y: Math.round(r.y), bottom: Math.round(r.bottom), centerY: Math.round(cy),
      hitSelf: inside, hitDesc: hit ? String(hit.className || hit.tagName).slice(0, 40) : null,
      sampleOk: okY.length + "/" + ys.length,
    });
  };
  const footerBtns = Array.from(document.querySelectorAll(".c-oreki-tut__footer .c-oreki-tut__nav-move"));
  footerBtns.forEach((b, i) => push(b, "footer" + i + ":" + (b.innerText || "").trim()));
  push(Array.from(document.querySelectorAll(".l-modal-buttons .o-primary-btn")).find(b => /关闭教程/.test(b.innerText || "")), "关闭教程");
  push(document.querySelector(".c-oreki-tut__nav-btn--active"), "当前章按钮");
  // 找出裁剪它的祖先：overflow 不是 visible 且边界比按钮浅
  const b = footerBtns[0];
  const clippers = [];
  if (b) {
    for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const pr = p.getBoundingClientRect();
        clippers.push({ cls: String(p.className || p.tagName).slice(0, 40), ox: s.overflowX, oy: s.overflowY,
          bottom: Math.round(pr.bottom), btnBottom: Math.round(b.getBoundingClientRect().bottom),
          clipsBottom: pr.bottom < b.getBoundingClientRect().bottom - 1 });
      }
    }
  }
  return { targets, clippers };
})()`;

const report = { at: new Date().toISOString(), envNote: "宿主机 Edge 视口模拟 + elementFromPoint 命中测试", viewports: [] };
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
    const hit = await page.evaluate(HIT);
    report.viewports.push({ vp: vp.name, hit });
    console.log(`[${vp.name}] ` + hit.targets.map(t => `${t.name} hitSelf=${t.hitSelf} sample=${t.sampleOk}${t.hitSelf ? "" : " → " + t.hitDesc}`).join(" | "));
    console.log(`         clippers: ` + hit.clippers.map(c => `${c.cls}[${c.ox}/${c.oy}] bottom=${c.bottom} btnBottom=${c.btnBottom} clips=${c.clipsBottom}`).join(" ; "));
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
fs.writeFileSync(path.join(OUT, "hit-test-report.json"), JSON.stringify(report, null, 2));
console.log("done");
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
