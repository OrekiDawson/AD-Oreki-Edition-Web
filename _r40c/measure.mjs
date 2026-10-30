// R40-C · 真实 Android Chrome 多视口布局测量（v2：CDP 直接改设备指标，不触发 reload）
// 连接 AVD 内 Chrome 的 CDP（adb forward tcp:9222），在真实 Blink 引擎里套用各档视口。
// 用法：node _tools/_r40c/measure.mjs [--fresh] [--out dir] [--tag prefix] [--views a,b]
import fs from "node:fs";
import path from "node:path";

const puppeteer = (await import("puppeteer-core")).default;
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const OUT = val("--out", "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c");
const TAG = val("--tag", "r40c");
fs.mkdirSync(OUT, { recursive: true });

const ALL_VIEWS = [
  { name: "320x640", w: 320, h: 640, dpr: 2 },
  { name: "360x640", w: 360, h: 640, dpr: 3 },
  { name: "390x844", w: 390, h: 844, dpr: 2.75 },
  { name: "392x676", w: 392, h: 676, dpr: 2.75 },
  { name: "430x932", w: 430, h: 932, dpr: 3 },
  { name: "768x1024", w: 768, h: 1024, dpr: 2 },
  { name: "1280x800", w: 1280, h: 800, dpr: 1 },
  { name: "768x360横屏", w: 768, h: 360, dpr: 2 },
];
const only = val("--views");
const VIEWPORTS = only ? ALL_VIEWS.filter(v => only.split(",").includes(v.name)) : ALL_VIEWS;

const TABS = ["维度", "挑战", "自动化", "成就", "统计数据", "选项"];
// 这些组合截图存证（其余只测量）
const SHOT_VIEWS = ["320x640", "360x640", "392x676", "768x360横屏", "768x1024", "1280x800"];
const SHOT_TABS = ["维度", "挑战", "自动化", "统计数据", "选项", "成就"];

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288")) || pages[pages.length - 1];
if (!page) { console.error("找不到 8288 页面"); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
await cdp.send("Page.setBypassCSP", { enabled: false }).catch(() => {});
await page.setCacheEnabled(false);

// ---------- 阶段 0：全新存档（走游戏自带 hardReset，避免 beforeunload 把旧档写回） ----------
let freshInfo = { reset: false };
if (has("--fresh")) {
  const before = await page.evaluate(() => (document.body.innerText || "").slice(0, 60));
  await page.evaluate(() => { try { GameStorage.hardReset(); } catch (e) { window.__hrErr = String(e); } }).catch(() => {});
  await sleep(14000);
  freshInfo = await page.evaluate(() => ({
    reset: true,
    url: location.href,
    head: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
    err: window.__hrErr || null,
    am: (() => {
      try { return String(player.antimatter); } catch { return "n/a"; }
    })(),
    dim1: (() => {
      try { return String(player.dimensions.antimatter[0].amount); } catch { return "n/a"; }
    })(),
    speed: (() => { try { return String(player.speedFactor); } catch { return "n/a"; } })(),
  }));
  freshInfo.before = before;
}

async function clickTab(name) {
  const ok = await page.evaluate(n => {
    const b = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => (x.innerText || "").trim() === n);
    if (!b) return false;
    b.click();
    return true;
  }, name);
  await sleep(400);
  return ok;
}

const MEASURE = () => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0) return false;
    if (e.getClientRects().length === 0) return false;
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const label = e => {
    const cls = String(e.className || "").split(/\s+/)[0].slice(0, 40);
    return `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${cls ? "." + cls : ""}`;
  };

  const overflow = [];
  for (const e of document.querySelectorAll("#ui *")) {
    if (!vis(e)) continue;
    if (e.classList.contains("a-notification--enter") || e.classList.contains("a-notification--leave")) continue;
    const b = e.getBoundingClientRect();
    if (b.right <= vw + 1) continue;
    let clipped = false;
    for (let p = e.parentElement; p && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") { clipped = true; break; }
    }
    if (clipped) continue;
    overflow.push({ el: label(e), right: Math.round(b.right), w: Math.round(b.width), over: Math.round(b.right - vw), text: (e.textContent || "").trim().slice(0, 24) });
  }
  overflow.sort((a, b) => b.over - a.over);

  const clickable = [...document.querySelectorAll("#ui button, #ui a, #ui [role=button], #ui input[type=checkbox], #ui select")].filter(vis);
  const small = clickable.map(e => {
    const b = e.getBoundingClientRect();
    return { el: label(e), w: Math.round(b.width), h: Math.round(b.height), text: (e.innerText || "").trim().slice(0, 20) };
  }).filter(x => x.w < 44 || x.h < 44);

  const clippedText = [];
  for (const e of document.querySelectorAll("#ui *")) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflow === "visible") continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (e.innerText || "").trim()) {
      clippedText.push({ el: label(e), sw: e.scrollWidth, cw: e.clientWidth, text: (e.innerText || "").trim().slice(0, 24) });
    }
  }

  const fixed = [...document.querySelectorAll("#ui *")].filter(e => vis(e) && ["fixed", "sticky"].includes(getComputedStyle(e).position));
  const occlusions = [];
  for (const f of fixed) {
    const fb = f.getBoundingClientRect();
    if (fb.width < 8 || fb.height < 8) continue;
    // 只统计「吸底/吸顶整条」或明显悬浮块
    for (const c of clickable) {
      if (f.contains(c) || c.contains(f)) continue;
      const cb = c.getBoundingClientRect();
      const ix = Math.min(fb.right, cb.right) - Math.max(fb.left, cb.left);
      const iy = Math.min(fb.bottom, cb.bottom) - Math.max(fb.top, cb.top);
      if (ix > 4 && iy > 4) {
        occlusions.push({ by: label(f), byW: Math.round(fb.width), byH: Math.round(fb.height), target: label(c), targetText: (c.innerText || "").trim().slice(0, 16) });
        break;
      }
    }
  }

  const tabs = [...document.querySelectorAll(".l-tab-btn-inner")].filter(vis).map(t => {
    const b = t.getBoundingClientRect();
    return { t: t.innerText.trim(), w: Math.round(b.width), h: Math.round(b.height) };
  });

  return {
    vw, vh: innerHeight,
    cw: de.clientWidth, ch: de.clientHeight,
    sw: de.scrollWidth, pageH: de.scrollHeight,
    docOverflow: de.scrollWidth - de.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
    overflowCount: overflow.length, overflow: overflow.slice(0, 6),
    smallCount: small.length, small: small.slice(0, 10),
    clippedCount: clippedText.length, clipped: clippedText.slice(0, 6),
    occlusionCount: occlusions.length, occlusions: occlusions.slice(0, 4),
    tabMin: tabs.length ? Math.min(...tabs.map(x => Math.min(x.w, x.h))) : null,
    tab0: tabs[0] || null,
  };
};

const results = [];
for (const v of VIEWPORTS) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: true,
    screenWidth: v.w, screenHeight: v.h,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(600);
  for (const tab of TABS) {
    const clicked = await clickTab(tab);
    const m = await page.evaluate(MEASURE);
    results.push({ view: v.name, tab, clicked, ...m });
    if (SHOT_VIEWS.includes(v.name) && SHOT_TABS.includes(tab)) {
      await page.screenshot({ path: path.join(OUT, `${TAG}-${v.name}-${tab}.png`) }).catch(() => {});
    }
  }
}

await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
fs.writeFileSync(path.join(OUT, `${TAG}-measure.json`), JSON.stringify({ freshInfo, results }, null, 2));
await browser.disconnect();

console.log("FRESH:", JSON.stringify(freshInfo));
console.log("view          tab      vw  docOvf ovf small clip occl tabMin");
for (const r of results) {
  console.log(`${r.view.padEnd(13)} ${String(r.tab).padEnd(8)} ${String(r.vw).padEnd(3)} ${String(r.docOverflow).padEnd(6)} ${String(r.overflowCount).padEnd(3)} ${String(r.smallCount).padEnd(5)} ${String(r.clippedCount).padEnd(4)} ${String(r.occlusionCount).padEnd(4)} ${r.tabMin}`);
}
