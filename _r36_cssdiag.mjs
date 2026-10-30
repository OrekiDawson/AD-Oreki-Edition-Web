// R36 · 快速 CSS 诊断：查指定选择器的计算样式与生效来源
// 用法：node _tools/_r36_cssdiag.mjs
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const SERVE_PORT = 8099;
const { browser, cleanup } = await launchBrowser({ port: 9334 });
try {
  const { page } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await new Promise(r => setTimeout(r, 800));

  const out = await page.evaluate(() => {
    const res = {};
    // 1) 变量是否解析成功
    const rootStyle = getComputedStyle(document.documentElement);
    res.vars = {
      primary: rootStyle.getPropertyValue("--oreki-touch-primary").trim(),
      secondary: rootStyle.getPropertyValue("--oreki-touch-secondary").trim(),
      minimum: rootStyle.getPropertyValue("--oreki-touch-minimum").trim()
    };
    // 2) 样式表顺序（谁在最后）
    res.sheets = Array.from(document.styleSheets).map((s, i) => {
      let href = s.href || "(inline)";
      try {
        const rules = s.cssRules || [];
        href += "  [" + rules.length + " rules]";
      } catch (e) { href += "  [CORS/不可读]"; }
      return i + ": " + href;
    });
    // 3) 目标元素的计算样式
    const probe = sel => {
      const n = document.querySelector(sel);
      if (!n) return { sel, found: false };
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return {
        sel, found: true,
        cls: String(n.className).slice(0, 70),
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
        width: cs.width, minWidth: cs.minWidth, maxWidth: cs.maxWidth,
        height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
        display: cs.display, boxSizing: cs.boxSizing, padding: cs.padding
      };
    };
    res.probes = [
      probe(".l-tt-save-load-btn"),
      probe(".l-tt-save-load-btn__wrapper"),
      probe(".hover-menu__wrapper"),
      probe(".l-button-container"),
      probe(".c-tt-buy-button")
    ];
    // 4) 匹配 .l-tt-save-load-btn 的所有规则（含来源）
    const matched = [];
    for (const s of document.styleSheets) {
      let rules;
      try { rules = s.cssRules; } catch (e) { continue; }
      const walk = (list, media) => {
        for (const rule of list) {
          if (rule.cssRules && rule.conditionText !== undefined) {
            walk(rule.cssRules, rule.conditionText || media);
            continue;
          }
          if (!rule.selectorText) continue;
          try {
            if (document.querySelector(rule.selectorText) &&
                /l-tt-save-load-btn|l-button-container/.test(rule.selectorText)) {
              matched.push({ href: (s.href || "inline").split("/").pop(), media: media || "-",
                sel: rule.selectorText, css: rule.style.cssText.slice(0, 220) });
            }
          } catch (e) { /* 无效选择器 */ }
        }
      };
      walk(rules, null);
    }
    res.matched = matched;
    return res;
  });
  console.log(JSON.stringify(out, null, 2));
} finally {
  await cleanup();
}
process.exit(0);
