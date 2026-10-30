// R36 · 移动端多视口几何验收（主 Agent 自有任务：控件档位 / 溢出 / 通知）
//
// 覆盖 R36 执行令要求的全部视口：
//   320 / 360 / 392 / 430 / 768 / 1280（竖屏）+ 676×392（横屏）
//
// 每档每页测量：
//   · 整页横向溢出（documentElement.scrollWidth vs clientWidth）
//   · 右缘越界元素数量与样本（right > innerWidth + 2）
//   · 可点元素命中区尺寸分布（按高度分桶）
//   · 低于 44×44 的可点元素清单
//   · 高度档位分布（验证「主 56 / 次 48」是否收敛）
//
// 运行：
//   node _tools/_r36_viewports.mjs [输出目录]
// 退出码 0 = 跑完（不代表全部通过，看报告里的 pass 字段）；非 0 = 执行失败。

import fs from "node:fs";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const OUT = process.argv[2] || ".";
const PORT = 9333;
const SERVE_PORT = 8099;

const VIEWPORTS = [
  { name: "320", w: 320, h: 640 },
  { name: "360", w: 360, h: 640 },
  { name: "392", w: 392, h: 676 },
  { name: "430", w: 430, h: 932 },
  { name: "768", w: 768, h: 1024 },
  { name: "1280", w: 1280, h: 800 },
  { name: "横屏676x392", w: 676, h: 392 }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 页面内测量函数（注入执行） */
const MEASURE = `(() => {
  const vw = innerWidth;
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false;
    // 关键：祖先 display:none 时，元素自己的 display/visibility 仍可能是正常值，
    // 只看自身样式会把「隐藏页签的残留 DOM」误判成可见元素。
    // getClientRects().length === 0 才是「真正没有盒子」的可靠判据。
    if (e.getClientRects().length === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = e => {
    const r = e.getBoundingClientRect();
    return { cls: String(e.className || e.tagName).slice(0, 46),
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x), right: Math.round(r.right) };
  };
  // A 类：真正的「按钮」—— 决定触控尺寸是否合格
  const buttons = Array.from(document.querySelectorAll(
    "button, a, .o-primary-btn, .o-challenge-btn, .o-tab-btn, [class*=btn], [role=button]")).filter(vis);
  // B 类：输入/滑块/标签 —— 视觉尺寸天然小，不按 44×44 判，但要单独看
  const inputs = Array.from(document.querySelectorAll(
    "input, select, textarea, label, [class*=slider]")).filter(vis);
  const btnBoxes = buttons.map(box);
  const inpBoxes = inputs.map(box);
  const heights = {};
  for (const b of btnBoxes) heights[b.h] = (heights[b.h] || 0) + 1;
  const tooSmall = btnBoxes.filter(b => b.w < 44 || b.h < 44);
  const overflowing = Array.from(document.querySelectorAll("*")).filter(e => {
    if (!vis(e)) return false;
    // 通知条入场/离场动画用 translateX 做位移，动画期间 rect 会短暂出界，
    // 那是动画中间态，不是布局缺陷 —— 排除。
    if (e.classList.contains("a-notification--enter") || e.classList.contains("a-notification--leave")) return false;
    const r = e.getBoundingClientRect();
    if (r.right <= vw + 2) return false;
    // 局部横向滚动容器（overflow:auto/scroll/hidden）里的内容超出是**设计如此**，
    // 不算「被裁」，只有溢出到滚动容器之外才是缺陷。
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return false;
    }
    return true;
  });
  const ofSample = overflowing.slice(0, 6).map(e => {
    const r = e.getBoundingClientRect();
    return { cls: String(e.className).slice(0, 46), right: Math.round(r.right), w: Math.round(r.width) };
  });
  // 关键类名的实际高度（用于验证档位）
  const key = {};
  for (const sel of [".o-challenge-btn", ".o-primary-btn", ".o-primary-btn--subtab-option",
                    ".o-tab-btn", ".l-reality-button", ".l-player-glyphs-column",
                    ".l-reality-button-column", ".c-autobuyer-box-row", ".l-tab-btn-inner",
                    ".l-notification-container", "#ui-fixed", ".c-game-tab",
                    ".l-dimension-single-row", ".c-challenge-box"]) {
    const n = document.querySelector(sel);
    key[sel] = n ? box(n) : null;
  }
  // 通知容器的定位上下文诊断
  const nc = document.querySelector(".l-notification-container");
  const ncStyle = nc ? getComputedStyle(nc) : null;
  const ncDiag = nc ? {
    rect: box(nc),
    position: ncStyle.position, top: ncStyle.top, right: ncStyle.right,
    left: ncStyle.left, width: ncStyle.width,
    parentCls: String(nc.parentElement?.className || "").slice(0, 46),
    parentRect: nc.parentElement ? box(nc.parentElement) : null,
    parentPos: nc.parentElement ? getComputedStyle(nc.parentElement).position : null
  } : null;
  return {
    vw,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overflowCount: overflowing.length,
    overflowSample: ofSample,
    buttonCount: btnBoxes.length,
    heightHistogram: heights,
    tooSmallCount: tooSmall.length,
    tooSmallSample: tooSmall.slice(0, 24),
    inputCount: inpBoxes.length,
    inputSmall: inpBoxes.filter(b => b.w < 44 || b.h < 44).slice(0, 6),
    keyBoxes: key,
    ncDiag,
    notifications: document.querySelectorAll("#notification-container .o-notification").length
  };
})()`;

const { browser, cleanup } = await launchBrowser({ port: PORT });
const report = { at: new Date().toISOString(), render: {}, viewports: [] };

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
  report.pageErrorCount = errors.length;

  // --- 进入主界面：点「开始」类按钮 ---
  const cands = await page.evaluate(() => Array.from(
    document.querySelectorAll("button, .c-modal__button, [class*=button]")
  ).filter(n => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map(n => {
    const r = n.getBoundingClientRect();
    return { text: (n.innerText || "").trim().slice(0, 24),
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }));
  const startBtn = cands.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.text)) || cands[0];
  if (startBtn) {
    await page.mouse.click(startBtn.x, startBtn.y);
    await sleep(2500);
  }
  report.startButton = startBtn || null;

  // --- 探测渲染能力 ---
  const probe = await page.evaluate(() => {
    const inner = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
      .filter(n => n.getBoundingClientRect().width > 0);
    return { sidebarItems: inner.length,
      names: inner.map(n => (n.innerText || "").replace(/\s+/g, " ").trim()),
      tabs: window.player?.tabs ?? null };
  });
  report.render = probe;
  console.log("渲染探测:", JSON.stringify(probe));

  /* --- 几何测量脚手架（**仅用于测量 UI 几何**） ---
   * 新档只解锁 5 个侧栏页，挑战/无限/永恒/现实/天神页根本不存在，
   * 几何无从测量。这里把各 Tab 的 condition 临时置为 true，
   * 让这些页面**渲染出来**以便量尺寸。
   * 这只是测试脚手架：它不写入任何玩法状态、不产生任何通关结论，
   * 报告里的一切数字只说明「CSS 在该结构下的几何表现」。 */
  const scaffold = await page.evaluate(() => {
    const out = { ok: false, tabs: [], errors: [] };
    try {
      const Tab = window.Tab;
      if (!Tab) return { ok: false, reason: "window.Tab 不存在" };
      for (const key of Object.keys(Tab)) {
        const t = Tab[key];
        if (!t || !t.config) continue;
        t.config.condition = () => true;
        for (const st of (t.subtabs || [])) {
          if (st?.config) st.config.condition = () => true;
        }
        out.tabs.push(key);
      }
      out.ok = true;
    } catch (e) {
      out.errors.push(String(e && e.message || e));
    }
    return out;
  });
  report.scaffold = scaffold;
  console.log("脚手架:", JSON.stringify(scaffold).slice(0, 300));
  await sleep(1200);

  // 强制刷新一次当前页，让 Vue 重新求值
  await page.evaluate(() => {
    try { window.ui.view.tab = window.Tabs.dimensions; } catch { /* ignore */ }
  });
  await sleep(800);

  // --- 逐视口测量 ---
  const sidebar = (await page.evaluate(() => Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => n.getBoundingClientRect().width > 0)
    .map(n => (n.innerText || "").replace(/\s+/g, " ").trim())));
  const TAB_KEYS = ["dimensions", "automation", "challenges", "infinity", "eternity", "reality", "celestials", "achievements", "statistics", "options"];
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 });
    await sleep(900);
    const entry = { viewport: vp.name, w: vp.w, h: vp.h, tabs: [] };
    for (const key of TAB_KEYS) {
      // 切页：直接调 Tabs[key].show()（比点侧栏更稳，不依赖坐标）
      const ok = await page.evaluate(k => {
        try {
          const t = window.Tabs[k];
          if (!t) return "no-tab";
          t.show();
          return true;
        } catch (e) { return String(e && e.message || e); }
      }, key);
      await sleep(700);
      const m = await page.evaluate(MEASURE);
      entry.tabs.push({ tab: key, switched: ok, ...m });
    }
    report.viewports.push(entry);
    console.log(`视口 ${vp.name} 完成（${entry.tabs.length} 页）`);
  }

  // 截图留证（窄屏 + 桌面各一张）
  for (const vp of [{ n: "_r36_360", w: 360, h: 640 }, { n: "_r36_1280", w: 1280, h: 800 }]) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 });
    await sleep(800);
    await page.screenshot({ path: `${OUT}/${vp.n}.png` });
  }
} finally {
  await cleanup();
}

// --- 汇总判定 ---
const narrow = report.viewports.filter(v => v.w <= 430);
const summary = {
  整页横向溢出: narrow.map(v => ({ vp: v.viewport, tabs: v.tabs.filter(t => t.pageOverflowX).map(t => t.tab) })).filter(x => x.tabs.length),
  元素越界最多的页: narrow.map(v => ({ vp: v.viewport, max: Math.max(...v.tabs.map(t => t.overflowCount)) })).sort((a, b) => b.max - a.max)[0],
  低于44的按钮: narrow.map(v => ({ vp: v.viewport, n: Math.max(...v.tabs.map(t => t.tooSmallCount)) })),
  高度档位分布_360: report.viewports.find(v => v.viewport === "360")?.tabs.map(t => ({ tab: t.tab, hist: t.heightHistogram }))
};
report.summary = summary;
fs.writeFileSync(`${OUT}/_r36_viewports_report.json`, JSON.stringify(report, null, 2));
console.log("\n=== 汇总 ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`\n报告: ${OUT}/_r36_viewports_report.json`);
process.exit(0);
