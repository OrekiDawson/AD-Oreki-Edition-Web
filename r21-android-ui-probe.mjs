// R21：Android Chrome 内 Web 版的只读 UI 几何探测（不改状态、不驱动游戏）
import puppeteer from "puppeteer-core";

const CDP = process.env.CDP_URL || "http://127.0.0.1:9223";
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("10.0.2.2:8099"));
if (!page) { console.log("页签没找到:", pages.map(p => p.url())); await browser.disconnect(); process.exit(2); }

const info = await page.evaluate(() => {
  const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const txt = el => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
  const out = {};

  out.viewport = { innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio, scrollH: document.documentElement.scrollHeight };
  out.ua = navigator.userAgent;

  // 侧栏 tab 容器：找含 .l-tab-bar 或 [class*=tab-bar] 的容器
  const barSelectors = [".l-tab-bar", ".c-tab-bar", "#tabs", ".tab-bar", ".l-tab-bar__tabs"];
  out.foundBars = [];
  for (const sel of barSelectors) {
    const nodes = [...document.querySelectorAll(sel)];
    if (nodes.length) out.foundBars.push({ sel, n: nodes.length, cls: nodes[0].className, rect: r(nodes[0]) });
  }

  // 所有 tab 按钮的可见文本与位置（按 y 再 x 排序，找出"侧栏列"）
  const tabEls = [...document.querySelectorAll(".l-tab-bar__tab, .c-tab-bar__tab, .tab, [class*='tab'][role='button']")];
  out.tabs = tabEls.map(el => ({ cls: (el.className || "").toString().slice(0, 40), t: txt(el), ...r(el), vis: getComputedStyle(el).display !== "none" })).slice(0, 40);

  // 布局总览
  out.overflow = {
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };

  // 教程常驻入口
  const entry = document.getElementById("oreki-tutorial-entry");
  out.tutorialEntry = entry ? { ...r(entry), text: txt(entry), z: getComputedStyle(entry).zIndex, display: getComputedStyle(entry).display } : null;

  // 是否被别的元素盖住（用 elementFromPoint 采样按钮中心）
  if (entry) {
    const b = entry.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    out.tutorialEntryHit = hit ? (hit.id || hit.className || hit.tagName) : null;
  }

  out.player = (() => { try { return { inf: player.infinities.toString(), et: player.eternities.toString(), break: player.break, am: player.antimatter.toString() }; } catch (e) { return String(e); } })();
  out.bodyChildren = [...document.body.children].map(c => c.id || c.className);
  return out;
});

console.log(JSON.stringify(info, null, 1));
await browser.disconnect();
