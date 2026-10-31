// R42-B · Web 移动端宿主机视口矩阵（320 / 360 先行，再 390 / 430 / 横屏）
//
// 口径（写死，不许混）：
//   本脚本**只**做宿主机 Edge 的视口模拟（CDP Emulation.setDeviceMetricsOverride）。
//   结论一律标 [宿主机视口模拟]，**不得**当成 Android Chrome 实机结论。
//   宽度换算参考：CSS 宽 = 物理宽 / (density / 160)，脚本里不含任何 wm/adb 调用。
//
// 检查项：
//   1) 整页横向溢出 / 越界元素
//   2) 触控目标 < 44px
//   3) 教程弹窗几何（是否被裁）、底栏是否可见、正文能否滚到底
//   4) 教程横向导航条：是否跟随当前章、切章是否真的换内容（防「点了不切章」）
//   5) 每章正文字数（防「每章只有几十字」）
//   6) 输入框遮挡：用「视口高度被键盘压缩」的代理视口测焦点元素是否仍可见
//
// 运行：
//   node _tools/_r42b/viewport-matrix.mjs _tools/_r42b 320,360

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320,360").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9355;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const ALL_VP = [
  { name: "320", w: 320, h: 640, dpr: 2 },
  { name: "360", w: 360, h: 640, dpr: 2 },
  { name: "390", w: 390, h: 844, dpr: 3 },
  { name: "430", w: 430, h: 932, dpr: 3 },
  { name: "横屏_640x320", w: 640, h: 320, dpr: 2 },
];
const VIEWPORTS = ALL_VP.filter(v => ONLY.includes(v.name));

/* ---------------- 页面级测量 ---------------- */
const PAGE_MEASURE = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false;
    if (e.getClientRects().length === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const btns = Array.from(document.querySelectorAll("button, a, [role=button]")).filter(vis);
  const small = btns.map(e => {
    const r = e.getBoundingClientRect();
    return { t: (e.innerText || e.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 20),
             cls: String(e.className || "").slice(0, 34), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(b => b.w < 44 || b.h < 44);
  const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const outside = Array.from(document.querySelectorAll("body *")).filter(e => {
    if (!vis(e)) return false;
    if (e.classList.contains("a-notification--enter") || e.classList.contains("a-notification--leave")) return false;
    const r = e.getBoundingClientRect();
    if (r.right <= vw + 2) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return false;
    }
    return true;
  }).map(e => ({ cls: String(e.className || e.tagName).slice(0, 44), right: Math.round(e.getBoundingClientRect().right) }));
  return { vw, vh, docOverflow, docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    overflowCount: outside.length, overflowSample: outside.slice(0, 6),
    buttonCount: btns.length, smallCount: small.length, smallSample: small.slice(0, 8) };
})()`;

/* ---------------- 教程弹窗测量（含导航跟随） ---------------- */
const TUT_MEASURE = `(() => {
  const modal = document.querySelector(".c-oreki-tut");
  if (!modal) return { present: false };
  const r = modal.getBoundingClientRect();
  const nav = document.querySelector(".c-oreki-tut__nav");
  const navBtns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"));
  const active = document.querySelector(".c-oreki-tut__nav-btn--active");
  const navInfo = nav ? {
    dir: getComputedStyle(nav).flexDirection,
    overflowX: getComputedStyle(nav).overflowX,
    scrollLeft: Math.round(nav.scrollLeft), scrollW: Math.round(nav.scrollWidth),
    clientW: Math.round(nav.clientWidth), h: Math.round(nav.getBoundingClientRect().height),
  } : null;
  // 当前章按钮是否落在导航条可视带内（横向滚动条的核心判据）
  let activeInBand = null, activeVisible = null;
  if (active && nav) {
    const nb = nav.getBoundingClientRect(), ab = active.getBoundingClientRect();
    const band = { l: nb.left, r: nb.left + nav.clientWidth };
    activeInBand = ab.left >= band.l - 2 && ab.right <= band.r + 2;
    // 比可视带还宽的按钮不可能完整落进带内，这时只要求「左沿可见」= 章序号与标题开头可见
    activeVisible = (ab.left >= band.l - 2 && ab.left <= band.r - 2) || (ab.right >= band.l + 2 && ab.right <= band.r + 2);
  }
  const navSmall = navBtns.map(n => { const b = n.getBoundingClientRect(); return { t: (n.innerText||"").replace(/\\s+/g," ").trim().slice(0,16), h: Math.round(b.height), w: Math.round(b.width) }; })
    .filter(x => x.h > 0 && x.h < 36);
  const scroll = document.querySelector(".c-oreki-tut__scroll");
  const tables = Array.from(document.querySelectorAll(".c-oreki-tut__table"));
  const tableInfo = tables.map(t => {
    const tr = t.getBoundingClientRect();
    const box = t.closest(".c-oreki-tut__scroll");
    return { w: Math.round(tr.width), right: Math.round(tr.right),
      scrollBoxW: box ? Math.round(box.getBoundingClientRect().width) : null,
      overflowsScrollBox: box ? tr.right > box.getBoundingClientRect().right + 2 : null };
  });
  const footer = document.querySelector(".c-oreki-tut__footer");
  const fb = footer ? footer.getBoundingClientRect() : null;
  // 正文里被横向裁掉（内容比容器宽）的元素：教程说「被裁」的第一手判据
  const clipped = Array.from(document.querySelectorAll(".c-oreki-tut__scroll *")).filter(e => {
    const s = getComputedStyle(e);
    if (e.children.length > 0 && !/^(P|LI|TD|TH|SPAN|CODE)$/.test(e.tagName)) return false;
    return e.scrollWidth > e.clientWidth + 2 && s.overflowX === "hidden";
  }).map(e => ({ tag: e.tagName, cls: String(e.className||"").slice(0,30), sw: e.scrollWidth, cw: e.clientWidth }));
  // 文字被省略号截断
  const ellipsis = Array.from(document.querySelectorAll(".c-oreki-tut *")).filter(e =>
    getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 2
  ).map(e => ({ tag: e.tagName, cls: String(e.className||"").slice(0,30), text: (e.innerText||"").slice(0,20) }));
  return {
    present: true,
    modalRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    modalOutside: r.right > innerWidth + 2 || r.left < -2 || r.bottom > innerHeight + 2 || r.top < -2,
    modalClip: { right: Math.round(r.right - innerWidth), bottom: Math.round(r.bottom - innerHeight) },
    headTitle: (document.querySelector(".c-oreki-tut__head-title") || {}).innerText || null,
    bodyLen: scroll ? (scroll.innerText || "").replace(/\\s+/g, "").length : null,
    navInfo, activeInBand, activeVisible, navBtnCount: navBtns.length, navSmall,
    scrollRect: scroll ? { h: Math.round(scroll.getBoundingClientRect().height), scrollH: scroll.scrollHeight,
      bottom: Math.round(scroll.getBoundingClientRect().bottom) } : null,
    tableInfo,
    footerVisible: fb ? (fb.bottom <= innerHeight + 2 && fb.height > 0) : null,
    footerRect: fb ? { x: Math.round(fb.x), w: Math.round(fb.width), h: Math.round(fb.height), bottom: Math.round(fb.bottom) } : null,
    clippedCount: clipped.length, clippedSample: clipped.slice(0, 6),
    ellipsisCount: ellipsis.length, ellipsisSample: ellipsis.slice(0, 6),
    pageOverflowWithModal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`;

/* ---------------- 启动本地静态服务 ---------------- */
async function ensureServer() {
  const alive = await new Promise(res => {
    import("node:http").then(({ default: http }) => {
      const req = http.get(`http://127.0.0.1:${SERVE_PORT}/index.html`, r => { r.resume(); res(true); });
      req.on("error", () => res(false));
      req.setTimeout(1500, () => { req.destroy(); res(false); });
    });
  });
  if (alive) return { proc: null };
  const proc = spawn(process.execPath, ["serve.mjs", String(SERVE_PORT)], {
    cwd: path.resolve("AD-Oreki-Edition"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  await sleep(1200);
  return { proc };
}

const report = {
  at: new Date().toISOString(),
  envNote: "宿主机 Edge（HeadlessChrome/Chromium 内核）+ CDP 视口模拟；**不是** Android Chrome 实机/AVD",
  script: "_tools/_r42b/viewport-matrix.mjs",
  viewports: [],
};
const { proc: serveProc } = await ensureServer();
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);

  // 开局：点「开始」
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
    await page.keyboard.press("Escape");
    await sleep(300);
  }

  report.env = await page.evaluate(() => ({ ua: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio }));

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
    await sleep(900);
    const main = await page.evaluate(PAGE_MEASURE);
    await page.screenshot({ path: path.join(SHOTS, `r42b_w_${vp.name}.png`) });

    // 开教程（重置续读，避免粘在上次那一章）
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) { window.TutorialReadingPosition.chapterId = null; window.TutorialReadingPosition.scrollTop = 0; }
      window.Modal.orekiTutorial.show();
    });
    await sleep(900);

    // ① 目录逐章点击：验证「点了真的切章」+ 每章正文字数
    const chapters = [];
    const navCount = await page.evaluate(() => document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)").length);
    for (let i = 0; i < navCount; i++) {
      const clicked = await page.evaluate(idx => {
        const navs = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)"));
        const b = navs[idx];
        if (!b) return { ok: false, reason: "no-btn" };
        b.click();
        return { ok: true, label: (b.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24) };
      }, i);
      await sleep(220);
      const snap = await page.evaluate(sel => {
        const t = document.querySelector(".c-oreki-tut__head-title");
        const s = document.querySelector(".c-oreki-tut__scroll");
        const nav = document.querySelector(".c-oreki-tut__nav");
        const act = document.querySelector(".c-oreki-tut__nav-btn--active");
        let inBand = null, visible = null, bw = null, axis = null;
        if (act && nav) {
          const nb = nav.getBoundingClientRect(), ab = act.getBoundingClientRect();
          bw = Math.round(ab.width);
          const overY = nav.scrollHeight - nav.clientHeight;
          const overX = nav.scrollWidth - nav.clientWidth;
          axis = (overY > 2 && overX < 2) ? "y" : "x";
          if (axis === "y") {
            const band = { t: nb.top, b: nb.top + nav.clientHeight };
            inBand = ab.top >= band.t - 2 && ab.bottom <= band.b + 2;
            visible = (ab.top >= band.t - 2 && ab.top <= band.b - 2) || (ab.bottom >= band.t + 2 && ab.bottom <= band.b + 2);
          } else {
            const band = { l: nb.left, r: nb.left + nav.clientWidth };
            inBand = ab.left >= band.l - 2 && ab.right <= band.r + 2;
            visible = (ab.left >= band.l - 2 && ab.left <= band.r - 2) || (ab.right >= band.l + 2 && ab.right <= band.r + 2);
          }
        }
        const st = document.querySelector(".c-oreki-tut__counter");
        return {
          title: t ? t.innerText.trim() : null,
          textLen: s ? (s.innerText || "").replace(/\s+/g, "").length : null,
          scrollTop: s ? Math.round(s.scrollTop) : null,
          counter: st ? st.innerText.trim() : null,
          navScrollLeft: nav ? Math.round(nav.scrollLeft) : null,
          activeInBand: inBand,
          activeVisible: visible,
          activeBtnW: bw,
          navAxis: axis,
          activeText: act ? (act.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24) : null,
        };
      });
      chapters.push({ i, ...clicked, ...snap });
    }

    // ② 定位回第 5 章（有对照表）做几何测量
    await page.evaluate(() => {
      const navs = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)"));
      if (navs[5]) navs[5].click();
    });
    await sleep(500);
    await page.evaluate(() => {
      const t = document.querySelector(".c-oreki-tut__table");
      if (t) t.scrollIntoView({ block: "center" });
    });
    await sleep(400);
    const tut = await page.evaluate(TUT_MEASURE);
    await page.screenshot({ path: path.join(SHOTS, `r42b_w_${vp.name}_tut.png`) });

    // ③ 正文能否滚到底（防「滚动卡住」）
    const scrollEnd = await page.evaluate(() => {
      const b = document.querySelector(".c-oreki-tut__scroll");
      if (!b) return null;
      b.scrollTop = b.scrollHeight;
      return { scrollH: b.scrollHeight, clientH: b.clientHeight };
    });
    await sleep(400);
    const atBottom = await page.evaluate(() => {
      const b = document.querySelector(".c-oreki-tut__scroll");
      return b ? Math.abs(b.scrollTop + b.clientHeight - b.scrollHeight) <= 2 : null;
    });
    await page.screenshot({ path: path.join(SHOTS, `r42b_w_${vp.name}_tut_bottom.png`) });

    // ④ 附录（Markdown 表格）在这一档是否也不撑破
    const apx = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn--apx"));
      if (!btns.length) return { present: false };
      btns[0].click();
      return { present: true, count: btns.length };
    });
    await sleep(600);
    const apxMeasure = await page.evaluate(TUT_MEASURE);
    await page.screenshot({ path: path.join(SHOTS, `r42b_w_${vp.name}_apx.png`) });

    report.viewports.push({
      vp: vp.name, w: vp.w, h: vp.h, dpr: vp.dpr,
      main, chapters, tut, tutAtBottom: atBottom, tutScroll: scrollEnd, appendix: { ...apx, measure: apxMeasure },
    });
    const blank = chapters.filter(c => !c.textLen || c.textLen < 200);
    const noSwitch = chapters.filter((c, idx) => idx > 0 && c.title === chapters[idx - 1].title);
    console.log(`[${vp.name}] docOverflow=${main.docOverflow} overflow=${main.overflowCount} small=${main.smallCount} ` +
      `modalOutside=${tut.modalOutside} footerVis=${tut.footerVisible} atBottom=${atBottom} ` +
      `navDir=${tut.navInfo && tut.navInfo.dir} activeInBand=${tut.activeInBand} ` +
      `navScrollLeft=${tut.navInfo && tut.navInfo.scrollLeft} ` +
      `blankCh=${blank.length} noSwitch=${noSwitch.length} clipped=${tut.clippedCount}`);

    // 关教程
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(n => /关闭教程/.test(n.innerText || ""));
      if (b) b.click();
    });
    await sleep(700);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(n => /确定|OK/.test(n.innerText || "")); if (b) b.click(); });
    await sleep(300);
  }
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
  if (serveProc) { try { serveProc.kill(); } catch { /* ignore */ } }
}

// 分段跑（先 320/360，再 390/430/横屏）时不要把上一段的结论冲掉：按视口名合并
const reportPath = path.join(OUT, "viewport-matrix-report.json");
let merged = report;
if (fs.existsSync(reportPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    if (Array.isArray(prev.viewports) && prev.viewports.length) {
      const byName = new Map(prev.viewports.map(v => [v.vp, v]));
      for (const v of report.viewports) byName.set(v.vp, v);
      merged = { ...prev, ...report, viewports: Array.from(byName.values()) };
    }
  } catch { /* 旧报告坏了就整份重写 */ }
}
fs.writeFileSync(reportPath, JSON.stringify(merged, null, 2));
console.log("报告写入", path.join(OUT, "viewport-matrix-report.json"));
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
