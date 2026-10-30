// R37-C · Web UI 验收测量（侧栏 / 新闻 / 通知 / 六视口几何 / 关键页窄屏）
//
// 运行：
//   node web/_tools/_r37c/measure.mjs [项目目录]
//
// 端口约定（R37 执行令）：
//   · CDP（Edge 调试端口）= 9352，单一 profile
//   · 静态服务 = 9353（避免和别人撞 8099）
//
// 复刻 R36 的四个测量坑规避：
//   ① 可见性用 getClientRects().length > 0（祖先 display:none 的残留 DOM 会误报）
//   ② 局部滚动容器内的超出不算缺陷（沿祖先链查 overflowX）
//   ③ 排除 a-notification--enter/--leave（入场 translateX 瞬时出界）
//   ④ 新档只解锁 5 页 → 用 Tab[*].config.condition = () => true 纯几何脚手架
//
// 输出：web/_tools/_r37c/report.json + 控制台摘要。退出码 0 = 脚本跑完。

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const ROOT = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const CDP_PORT = 9352;
const SERVE_PORT = 9353;
const OUT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webm": "video/webm",
  ".map": "application/json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(SERVE_PORT, "127.0.0.1", r));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { at: new Date().toISOString(), viewports: [] };

const MEASURE = String.raw`(() => {
  const vw = innerWidth;
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false;
    if (e.getClientRects().length === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = e => {
    const r = e.getBoundingClientRect();
    return { cls: String(e.className || e.tagName).slice(0, 52),
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right) };
  };
  // 滑块轨道（.l-ad-slider / [class*=slider]）与屏外隐藏控件（left < -1000，如 automator 的
  // textarea）不是触控按钮：前者 R36 已按「输入类」单独统计，后者根本不可见。
  const buttons = Array.from(document.querySelectorAll(
    "button, a, .o-primary-btn, .o-challenge-btn, .o-tab-btn, [class*=btn], [role=button]"))
    .filter(vis)
    .filter(e => !e.closest("[class*=slider]"))
    .filter(e => e.getBoundingClientRect().left > -1000);
  const btnBoxes = buttons.map(box);
  const heights = {};
  for (const b of btnBoxes) heights[b.h] = (heights[b.h] || 0) + 1;
  const tooSmall = btnBoxes.filter(b => b.w < 44 || b.h < 44);
  const overflowing = Array.from(document.querySelectorAll("*")).filter(e => {
    if (!vis(e)) return false;
    if (e.classList.contains("a-notification--enter") || e.classList.contains("a-notification--leave")) return false;
    const r = e.getBoundingClientRect();
    if (r.right <= vw + 2) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return false;
    }
    return true;
  });
  const leftOut = Array.from(document.querySelectorAll("*")).filter(e => {
    if (!vis(e)) return false;
    if (e.classList.contains("a-notification--enter") || e.classList.contains("a-notification--leave")) return false;
    const r = e.getBoundingClientRect();
    if (r.left >= -2) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return false;
    }
    return true;
  });
  return {
    vw,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overflowCount: overflowing.length,
    overflowSample: overflowing.slice(0, 8).map(box),
    leftOverflowCount: leftOut.length,
    leftSample: leftOut.slice(0, 5).map(box),
    buttonCount: btnBoxes.length,
    heightHistogram: heights,
    tooSmallCount: tooSmall.length,
    tooSmallSample: tooSmall.slice(0, 20),
    notificationCount: document.querySelectorAll("#notification-container .o-notification").length
  };
})()`;

const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });
try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 6);
  report.pageErrorCount = errors.length;

  // 进入主界面
  await page.evaluate(() => {
    // 新档会弹「新游戏」确认框，直接点掉主按钮更稳：用 Modal.hideAll 会跳过初始化，
    // 因此这里点真实按钮。
  });
  const clicked = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
      .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(n => ({ text: (n.innerText || "").trim().slice(0, 30), el: n }));
    const target = cands.find(c => /开始|Start|进入|继续|Continue/i.test(c.text)) || cands[0];
    if (!target) return null;
    target.el.click();
    return target.text;
  });
  report.startButton = clicked;
  await sleep(3000);

  // ---------- 1) 侧栏 ----------
  const sidebar = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner"))
      .filter(n => n.getClientRects().length > 0)
      .map(n => (n.innerText || "").replace(/\s+/g, " ").trim());
    const sideRect = document.querySelector(".c-modern-sidebar")?.getBoundingClientRect();
    const sr = sideRect ? { x: Math.round(sideRect.x), y: Math.round(sideRect.y),
      w: Math.round(sideRect.width), h: Math.round(sideRect.height) } : null;
    const shopBtn = document.querySelector(".c-modern-sidebar .tab-button.shop");
    return {
      modernSidebar: !!document.querySelector(".c-modern-sidebar"),
      items, count: items.length, sideRect: sr,
      shopInSidebar: !!shopBtn,
      shopRect: shopBtn ? (() => { const r = shopBtn.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
      tabbarFallback: Array.from(document.querySelectorAll(".l-tab-btn-inner")).length
    };
  });
  report.sidebar = sidebar;

  // ---------- 2) 新闻 ----------
  report.news = await page.evaluate(() => {
    const tickers = Array.from(document.querySelectorAll(".c-news-ticker"));
    const info = tickers.map(t => {
      const r = t.getBoundingClientRect();
      const s = getComputedStyle(t);
      return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        display: s.display, visibility: s.visibility, opacity: s.opacity,
        hasRects: t.getClientRects().length };
    });
    // 顶部空白诊断：内容容器与它的第一个有盒子的子元素之间的竖直间距
    const gc = document.querySelector(".game-container");
    const gcStyle = gc ? getComputedStyle(gc) : null;
    const firstKids = gc ? Array.from(gc.children).filter(c => c.getClientRects().length > 0)
      .map(c => { const r = c.getBoundingClientRect();
        return { cls: String(c.className || c.tagName).slice(0, 48),
          top: Math.round(r.top), h: Math.round(r.height) }; }) : [];
    const side = document.querySelector(".c-modern-sidebar");
    const sideFirst = side ? Array.from(side.children).find(c => c.getClientRects().length > 0) : null;
    return {
      tickerCount: tickers.length,
      tickers: info,
      newsWordInBody: (document.body.innerText || "").includes("新闻"),
      gameContainer: gc ? { marginTop: gcStyle.marginTop, top: Math.round(gc.getBoundingClientRect().top),
        h: Math.round(gc.getBoundingClientRect().height), children: firstKids } : null,
      sidebarFirstChildTop: sideFirst ? Math.round(sideFirst.getBoundingClientRect().top) : null,
      sidebarTop: side ? Math.round(side.getBoundingClientRect().top) : null
    };
  });

  // ---------- 2b) 选项页里是否残留「新闻」入口 ----------
  report.newsInOptions = await page.evaluate(async () => {
    window.Tab.options.show();
    await new Promise(r => setTimeout(r, 600));
    const body = document.body.innerText || "";
    const hits = [];
    for (const el of document.querySelectorAll(".c-options-tab, #page *")) {
      if (el.children.length === 0 && /新闻/.test(el.textContent || "") && el.getClientRects().length > 0) {
        hits.push({ cls: String(el.className).slice(0, 40), text: (el.textContent || "").trim().slice(0, 30) });
      }
    }
    return { optionsHasNewsWord: /新闻/.test(body), hits: hits.slice(0, 8),
      newsModalRegistered: !!window.Modal?.newsOptions };
  });
  await page.evaluate(() => window.Tab.dimensions.show());

  // ---------- 3) 通知上限实测 ----------
  report.notify = await page.evaluate(async () => {
    const pc = document.getElementById("notification-container");
    const countLive = () => Array.from(pc.children)
      .filter(n => !n.classList.contains("o-notification--overflow"))
      .filter(n => n.getClientRects().length > 0);
    // 等既有通知自然过期（默认 2000ms），避免与游戏自身的提示混在一起
    for (let i = 0; i < 40 && countLive().length > 0; i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    const baseline = countLive().length;
    for (let i = 1; i <= 6; i++) GameUI.notify.info(`通知实测 ${i}`, 60000);
    await new Promise(r => setTimeout(r, 300));
    const visible = countLive();
    const overflow = Array.from(pc.children).find(n => n.classList.contains("o-notification--overflow"));
    const rects = visible.map(n => { const r = n.getBoundingClientRect();
      return { text: n.innerText, top: Math.round(r.top), h: Math.round(r.height),
        right: Math.round(r.right), w: Math.round(r.width) }; });
    // 同文合并（此刻已满员，用同文不会新增元素）
    const mergedBefore = countLive().length;
    GameUI.notify.info("通知实测 1", 60000);
    await new Promise(r => setTimeout(r, 150));
    const mergedTexts = countLive().map(n => n.innerText);
    const mergedAfter = countLive().length;
    return {
      baseline,
      visibleCount: visible.length,
      visibleTexts: visible.map(n => n.innerText),
      rects,
      overflowText: overflow ? overflow.innerText : null,
      mergedBefore, mergedAfter, mergedTexts,
      maxRight: Math.max(...rects.map(r => r.right)),
      innerWidth: innerWidth
    };
  });

  // 清掉测试通知
  await page.evaluate(() => { document.getElementById("notification-container").innerHTML = ""; });

  // ---------- 4) 几何脚手架：解锁全部页 ----------
  report.scaffold = await page.evaluate(() => {
    const out = { ok: false, tabs: [] };
    try {
      for (const key of Object.keys(window.Tab)) {
        const t = window.Tab[key];
        if (!t || !t.config) continue;
        t.config.condition = () => true;
        for (const st of (t.subtabs || [])) if (st?.config) st.config.condition = () => true;
        out.tabs.push(key);
      }
      out.ok = true;
    } catch (e) { out.error = String(e && e.message || e); }
    return out;
  });
  await sleep(800);
  report.sidebarAfterScaffold = await page.evaluate(() => Array.from(
    document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner"))
    .filter(n => n.getClientRects().length > 0)
    .map(n => (n.innerText || "").replace(/\s+/g, " ").trim()));

  // ---------- 5) 逐视口 ----------
  const VIEWPORTS = [
    { name: "320", w: 320, h: 640 },
    { name: "360", w: 360, h: 640 },
    { name: "392", w: 392, h: 676 },
    { name: "430", w: 430, h: 932 },
    { name: "768", w: 768, h: 1024 },
    { name: "1280", w: 1280, h: 800 },
    { name: "676x392", w: 676, h: 392, landscape: true }
  ];
  const TAB_KEYS = ["dimensions", "automation", "challenges", "infinity", "eternity",
    "reality", "celestials", "achievements", "statistics", "options"];

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1,
      isMobile: vp.w < 700, hasTouch: vp.w < 700 });
    await sleep(800);
    const entry = { viewport: vp.name, w: vp.w, h: vp.h, tabs: [] };
    for (const key of TAB_KEYS) {
      const switched = await page.evaluate(k => {
        try { const t = window.Tab[k]; if (!t) return "no-tab"; t.show(); return true; }
        catch (e) { return String(e && e.message || e); }
      }, key);
      await sleep(600);
      const m = await page.evaluate(MEASURE);
      entry.tabs.push({ tab: key, switched, ...m });
    }
    report.viewports.push(entry);
    console.log(`视口 ${vp.name} 完成`);
  }

  // ---------- 6) 关键页窄屏 + 弹窗 ----------
  const modalChecks = [];
  for (const vp of [{ n: "320", w: 320, h: 640 }, { n: "392", w: 392, h: 676 }]) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await sleep(600);
    for (const key of ["dimensions", "challenges", "automation", "reality"]) {
      await page.evaluate(k => window.Tab[k].show(), key);
      await sleep(500);
      const m = await page.evaluate(MEASURE);
      modalChecks.push({ kind: "page", vp: vp.n, key,
        pageOverflowX: m.pageOverflowX, overflowCount: m.overflowCount,
        tooSmallCount: m.tooSmallCount, sample: m.tooSmallSample.slice(0, 4) });
    }
    // 教程弹窗
    const h2p = await page.evaluate(async () => {
      // 先关掉可能残留的其它弹窗，再开 H2P（否则 ui.view.modal.current 被占用）
      try { window.Modal.hideAll(); } catch (e) { /* ignore */ }
      await new Promise(r => setTimeout(r, 300));
      try { window.Modal.h2p.show(); } catch (e) { return { error: String(e) }; }
      let m = null;
      for (let i = 0; i < 12 && !m; i++) {
        await new Promise(r => setTimeout(r, 250));
        m = document.querySelector(".l-h2p-modal");
      }
      if (!m) {
        return { error: "no modal",
          modalCurrent: window.ui?.view?.modal?.current?.constructor?.name ?? null,
          hasH2P: !!window.Modal?.h2p };
      }
      const r = m.getBoundingClientRect();
      const body = document.getElementById("h2p-body");
      const br = body ? body.getBoundingClientRect() : null;
      const closeBtn = m.querySelector(".c-modal__close-btn, .l-modal-close-btn, [class*=close]");
      const cr = closeBtn ? closeBtn.getBoundingClientRect() : null;
      const tabsEl = m.querySelector(".l-h2p-tab-list");
      return {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
          h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        fitsViewport: r.x >= -1 && r.right <= innerWidth + 1,
        bodyScrollable: !!body && body.scrollHeight > body.clientHeight,
        bodyRect: br ? { w: Math.round(br.width), h: Math.round(br.height) } : null,
        closeBtnSize: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
        tabListScrollable: !!tabsEl && tabsEl.scrollHeight > tabsEl.clientHeight,
        title: m.querySelector(".c-h2p-title")?.innerText,
        firstTab: m.querySelector(".o-h2p-tab-button")?.innerText
      };
    });
    modalChecks.push({ kind: "h2p", vp: vp.n, ...h2p });
    await page.evaluate(() => window.Modal.hideAll());
    await sleep(400);
    await page.screenshot({ path: path.join(OUT_DIR, `_r37c_${vp.n}_h2p.png`) });
  }
  report.modalChecks = modalChecks;

  // 截图（320 自动化 / 320 永恒，用于肉眼核对本轮修的三处 CSS）
  for (const vp of [{ n: "360", w: 360, h: 640, tab: "dimensions" },
                    { n: "1280", w: 1280, h: 800, tab: "dimensions" },
                    { n: "320_automation", w: 320, h: 640, tab: "automation" },
                    { n: "320_eternity", w: 320, h: 640, tab: "eternity" },
                    { n: "320_options", w: 320, h: 640, tab: "options" }]) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 });
    await sleep(600);
    await page.evaluate(k => window.Tab[k].show(), vp.tab);
    await sleep(700);
    await page.screenshot({ path: path.join(OUT_DIR, `_r37c_${vp.n}.png`) });
  }
} finally {
  await cleanup();
  server.close();
}

// ---------- 汇总 ----------
const narrow = report.viewports.filter(v => v.w <= 430 || v.landscape);
const summary = {
  sidebarCount: report.sidebar?.count,
  sidebarItems: report.sidebar?.items,
  newsTickerCount: report.news?.tickerCount,
  notifyVisible: report.notify?.visibleCount,
  perViewport: report.viewports.map(v => ({
    vp: v.viewport,
    maxOverflow: Math.max(...v.tabs.map(t => t.overflowCount)),
    pagesOverflow: v.tabs.filter(t => t.pageOverflowX).map(t => t.tab),
    maxTooSmall: Math.max(...v.tabs.map(t => t.tooSmallCount)),
    tooSmallPages: v.tabs.filter(t => t.tooSmallCount > 0).map(t => `${t.tab}:${t.tooSmallCount}`)
  }))
};
report.summary = summary;
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log("=== 摘要 ===");
console.log(JSON.stringify(summary, null, 2));
console.log("pageErrors:", report.pageErrorCount, report.pageErrors);
console.log(`报告: ${path.join(OUT_DIR, "report.json")}`);
process.exit(0);
