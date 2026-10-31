// R42 · Web 移动端多宽度实测（320 / 360 / 390 / 430 / 768 / 1280 + 横屏）
//
// 每个宽度检查：导航是否可点、表格是否只在自己容器里横滚、弹窗是否溢出、
// 触控目标是否 ≥44、滚动是否到底、整页有没有横向滚动条。
// 同时检查侧栏是否按真实进度动态显示（新档只应有 5 项），以及解锁后不出现空页/重复入口。
//
// 环境如实记录：宿主机 Edge（CDP）+ puppeteer 设备模拟，**不是** Android Chrome。
// AVD 只做一次交叉核对（见报告里的 avd 段）。
//
// 运行：
//   node _tools/_r42/mobile-widths.mjs _tools/_r42

import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42";
const SERVE_PORT = 8099;
const CDP_PORT = 9341;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "320", w: 320, h: 640, dpr: 2, mobile: true },
  { name: "360", w: 360, h: 640, dpr: 2, mobile: true },
  { name: "390", w: 390, h: 844, dpr: 3, mobile: true },
  { name: "430", w: 430, h: 932, dpr: 3, mobile: true },
  { name: "768", w: 768, h: 1024, dpr: 2, mobile: true },
  { name: "1280", w: 1280, h: 800, dpr: 1, mobile: false },
  { name: "横屏_844x390", w: 844, h: 390, dpr: 3, mobile: true },
];

// 页面内测量：整页横向溢出 / 越界元素 / 触控尺寸 / 表格自身滚动 / 侧栏
const MEASURE = `(() => {
  const vw = innerWidth;
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
    return { t: (e.innerText || e.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 18),
             cls: String(e.className || "").slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(b => b.w < 44 || b.h < 44);
  // 整页横向溢出：只要 documentElement 出现横向滚动条就算失败
  const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  // 越界元素：排除「自己在局部横滚容器里」的合法情况
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
  }).map(e => ({ cls: String(e.className || e.tagName).slice(0, 40), right: Math.round(e.getBoundingClientRect().right) }));
  // 侧栏 / 底栏真实可见项
  const sidebar = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => n.getClientRects().length > 0)
    .map(n => (n.innerText || "").replace(/\\s+/g, " ").trim());
  // 新闻条是否存在于页面上（本 MOD 要求关闭）
  const news = {
    nodes: document.querySelectorAll("#news, .c-news-ticker, .l-news-ticker, [class*=news-ticker]").length,
    visible: Array.from(document.querySelectorAll("#news, .c-news-ticker, .l-news-ticker, [class*=news-ticker]"))
      .some(n => n.getClientRects().length > 0),
  };
  return { vw, docOverflow, docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    overflowCount: outside.length, overflowSample: outside.slice(0, 6),
    buttonCount: btns.length, smallCount: small.length, smallSample: small.slice(0, 8),
    sidebar, news };
})()`;

// 教程弹窗内测量：表格是否只在自己容器滚、弹窗是否超出视口
const TUT_MEASURE = `(() => {
  const modal = document.querySelector(".c-oreki-tut");
  if (!modal) return { present: false };
  const r = modal.getBoundingClientRect();
  const scroll = document.querySelector(".c-oreki-tut__scroll");
  const tables = Array.from(document.querySelectorAll(".c-oreki-tut__table"));
  const tableInfo = tables.map(t => {
    const tr = t.getBoundingClientRect();
    const box = t.closest(".c-oreki-tut__scroll");
    return { w: Math.round(tr.width), right: Math.round(tr.right),
      scrollBoxW: box ? Math.round(box.getBoundingClientRect().width) : null,
      ownScroller: (() => { for (let p = t; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll") return true; } return false; })(),
      overflowsScrollBox: box ? tr.right > box.getBoundingClientRect().right + 2 : null };
  });
  const navs = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"));
  const navSmall = navs.map(n => { const b = n.getBoundingClientRect(); return { t: (n.innerText||"").replace(/\\s+/g," ").trim().slice(0,16), h: Math.round(b.height), w: Math.round(b.width) }; })
    .filter(x => x.h < 36);
  return {
    present: true,
    modalRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    modalOutsideViewport: r.right > innerWidth + 2 || r.left < -2 || r.bottom > innerHeight + 2,
    scrollRect: scroll ? { h: Math.round(scroll.getBoundingClientRect().height), scrollH: scroll.scrollHeight } : null,
    tableInfo, navCount: navs.length, navSmall,
    footerVisible: (() => { const f = document.querySelector(".c-oreki-tut__footer"); if (!f) return null; const b = f.getBoundingClientRect(); return b.bottom <= innerHeight + 2 && b.height > 0; })(),
    pageOverflowWithModal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`;

const report = { at: new Date().toISOString(), env: {}, freshSidebar: null, unlocked: null, viewports: [] };
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await sleep(1500);

  const start = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0)
      .map(n => { const r = n.getBoundingClientRect(); return { t: (n.innerText || "").trim().slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    return c.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.t)) || null;
  });
  if (start) { await page.mouse.click(start.x, start.y); await sleep(2500); }
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length))) break;
    await page.keyboard.press("Escape");
    await sleep(300);
  }

  report.env = await page.evaluate(() => ({
    ua: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
  }));
  report.freshSidebar = await page.evaluate(() => Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => n.getClientRects().length > 0)
    .map(n => (n.innerText || "").replace(/\s+/g, " ").trim()));

  /* ---------- 逐视口：主界面 + 教程弹窗 ---------- */
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, isMobile: vp.mobile, hasTouch: vp.mobile });
    await sleep(900);
    const main = await page.evaluate(MEASURE);
    const p1 = path.join(SHOTS, `r42_w_${vp.name}.png`);
    await page.screenshot({ path: p1 });

    // 打开教程 -> 跳到第 5 章（含对照表）
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) { window.TutorialReadingPosition.chapterId = null; window.TutorialReadingPosition.scrollTop = 0; }
      window.Modal.orekiTutorial.show();
    });
    await sleep(900);
    await page.evaluate(() => {
      const navs = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)"));
      if (navs[5]) navs[5].click();
    });
    await sleep(700);
    // 滚到表格位置
    await page.evaluate(() => {
      const t = document.querySelector(".c-oreki-tut__table");
      if (t) t.scrollIntoView({ block: "center" });
    });
    await sleep(500);
    const tut = await page.evaluate(TUT_MEASURE);
    const p2 = path.join(SHOTS, `r42_w_${vp.name}_tut.png`);
    await page.screenshot({ path: p2 });

    // 滚到底，确认长章在本宽度也能到底
    const scrollInfo = await page.evaluate(() => {
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

    report.viewports.push({ vp: vp.name, w: vp.w, h: vp.h, main, tut, tutScroll: scrollInfo, tutAtBottom: atBottom, shots: [p1, p2] });
    console.log(`视口 ${vp.name}: docOverflow=${main.docOverflow} overflowCount=${main.overflowCount} small=${main.smallCount} tutModal=${tut.present} atBottom=${atBottom}`);

    // 关教程
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(n => /关闭教程/.test(n.innerText || ""));
      if (b) b.click();
    });
    await sleep(600);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(n => /确定|OK/.test(n.innerText || "")); if (b) b.click(); });
    await sleep(300);
  }

  /* ---------- 解锁全部页签：查有无空页 / 重复入口 ---------- */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const unlock = await page.evaluate(() => {
    const out = { ok: true, err: [] };
    try {
      player.auto.autobuyersOn = false;
      player.eternities = 1; player.realities = 1; player.infinities = 1; player.break = true;
      try { Teresa.pouredAmount = 1; } catch (e) { out.err.push("Teresa"); }
      player.celestials.pelle.doomed = true;
    } catch (e) { out.ok = false; out.err.push(String(e && e.message || e)); }
    return out;
  });
  await sleep(1500);
  const tabs = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
      .filter(n => n.getClientRects().length > 0)
      .map(n => (n.innerText || "").replace(/\s+/g, " ").trim());
    return { names, dupes: names.filter((n, i) => names.indexOf(n) !== i) };
  });
  // 逐页点一遍，记录每页主区域文本长度（0 = 空页）
  const pages = [];
  for (const key of ["dimensions", "automation", "challenges", "infinity", "eternity", "reality", "celestials", "achievements", "statistics", "options"]) {
    const ok = await page.evaluate(k => {
      try { if (!window.Tabs[k]) return "no-tab"; window.Tabs[k].show(); return true; } catch (e) { return String(e && e.message || e); }
    }, key);
    await sleep(700);
    const len = await page.evaluate(() => {
      const el = document.querySelector(".l-game-tab, .c-game-tab, #ui-fixed .l-tab-content, .tab-content");
      const root = el || document.body;
      return (root.innerText || "").replace(/\s+/g, " ").trim().length;
    });
    pages.push({ tab: key, switched: ok, textLen: len });
  }
  report.unlocked = { unlock, ...tabs, pages, dupes: tabs.dupes };
  const p3 = path.join(SHOTS, "r42_w_390_unlocked.png");
  await page.screenshot({ path: p3 });
  report.viewports.push({ vp: "390_unlocked", shots: [p3] });
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
}

fs.writeFileSync(path.join(OUT, "mobile-widths-report.json"), JSON.stringify(report, null, 2));

// 每个宽度一句结论
const lines = [];
for (const v of report.viewports) {
  if (!v.main) continue;
  const bad = [];
  if (v.main.docOverflow) bad.push(`整页横向溢出 ${v.main.docScrollW}>${v.main.docClientW}`);
  if (v.main.overflowCount) bad.push(`${v.main.overflowCount} 个元素越界`);
  if (v.main.smallCount) bad.push(`${v.main.smallCount} 个可点元素 <44px`);
  if (v.tut && v.tut.present) {
    if (v.tut.modalOutsideViewport) bad.push("教程弹窗超出视口");
    if (v.tut.pageOverflowWithModal) bad.push("开教程后整页横向溢出");
    if (v.tut.footerVisible === false) bad.push("教程底栏不可见");
    const badTable = (v.tut.tableInfo || []).filter(t => t.overflowsScrollBox);
    if (badTable.length) bad.push(`对照表撑破滚动容器 ${badTable.length} 个`);
  }
  if (v.main.news.visible) bad.push("新闻条可见（应关闭）");
  lines.push({ vp: v.vp, verdict: bad.length ? "问题：" + bad.join("；") : "通过", shots: v.shots });
}
report.verdicts = lines;
fs.writeFileSync(path.join(OUT, "mobile-widths-report.json"), JSON.stringify(report, null, 2));
console.log("\n=== 逐宽度结论 ===");
console.log(JSON.stringify(lines, null, 2));
console.log("\n新档侧栏:", JSON.stringify(report.freshSidebar));
console.log("解锁后侧栏:", JSON.stringify(report.unlocked && report.unlocked.names));
console.log("重复入口:", JSON.stringify(report.unlocked && report.unlocked.dupes));
console.log("各页文本长度:", JSON.stringify(report.unlocked && report.unlocked.pages));
console.log("fatal:", report.fatal || "none");
