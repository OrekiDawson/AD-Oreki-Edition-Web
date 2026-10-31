// R42 · 七宽度（手机档）改用 **oreki_web_test 里的 Android Chrome 真引擎** 复测
//
// 为什么重做：上一轮七宽度用的是宿主机 Edge + puppeteer 设备模拟。
// 设备模拟改的是 CDP 的 viewport，字体度量、表单控件、100vh、滚动条宽度都还是桌面引擎的，
// 320 宽「教程底栏间隙 0px」这种临界结论必须在真引擎下复核。
//
// 做法（不改分辨率，只改逻辑密度，测完 `wm density reset`）：
//   CSS 宽度 = 1080 / (density / 160)
//     540 -> 320   480 -> 360   443 -> 390   402 -> 430
//   横屏：user_rotation=1 后宽高互换，2340 / (443/160) ≈ 845 × 390
//
// 连接方式：adb forward tcp:9222 localabstract:chrome_devtools_remote
//           puppeteer.connect({ browserURL: "http://127.0.0.1:9222" })
//
// 截图走 CDP（Page.captureScreenshot），不依赖 adb screencap —— 后者在本机 AVD 上会冻结。
//
// 运行：node _tools/_r42/avd-chrome-widths.mjs _tools/_r42

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] || "_tools/_r42";
const ADB = "C:/Users/Oreki/Android/Sdk/platform-tools/adb.exe";
const SERIAL = "emulator-5556";
const SHOTS = path.join(OUT, "shots_avd");
fs.mkdirSync(SHOTS, { recursive: true });

const adb = (...args) => execFileSync(ADB, ["-s", SERIAL, ...args], { encoding: "utf8" }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  { name: "320", density: 540, rotation: 0, expectW: 320 },
  { name: "360", density: 480, rotation: 0, expectW: 360 },
  { name: "390", density: 443, rotation: 0, expectW: 390 },
  { name: "430", density: 402, rotation: 0, expectW: 430 },
  // 横屏：headless AVD 上 user_rotation / cmd window user-rotation 都不生效（实测 rotation 恒 0），
  // 改用 wm size 交换物理宽高 —— 同样只影响逻辑视口，测完 `wm size reset` 精确还原。
  { name: "横屏_845x390", density: 443, rotation: 1, expectW: 845, wmSize: "2340x1080" },
];

const MEASURE = `(() => {
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
             w: Math.round(r.width), h: Math.round(r.height) };
  }).filter(b => b.w < 44 || b.h < 44);
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
  return {
    vw, vh, dpr: devicePixelRatio,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    overflowCount: outside.length, overflowSample: outside.slice(0, 5),
    buttonCount: btns.length, smallCount: small.length, smallSample: small.slice(0, 8),
    sidebar: Array.from(document.querySelectorAll(".l-tab-btn-inner"))
      .filter(n => n.getClientRects().length > 0)
      .map(n => (n.innerText || "").replace(/\\s+/g, " ").trim()),
    news: Array.from(document.querySelectorAll("#news, .c-news-ticker, .l-news-ticker, [class*=news-ticker]"))
      .some(n => n.getClientRects().length > 0),
    scrollbar: { innerW: innerWidth, docClientW: document.documentElement.clientWidth },
  };
})()`;

const TUT = `(() => {
  const modal = document.querySelector(".c-oreki-tut");
  if (!modal) return { present: false };
  const mr = modal.getBoundingClientRect();
  const scroll = document.querySelector(".c-oreki-tut__scroll");
  const f = document.querySelector(".c-oreki-tut__footer");
  const fr = f ? f.getBoundingClientRect() : null;
  const kids = f ? Array.from(f.children).map(c => {
    const r = c.getBoundingClientRect();
    return { text: (c.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 8),
             x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
  }) : [];
  const tables = Array.from(document.querySelectorAll(".c-oreki-tut__table")).map(t => {
    const tr = t.getBoundingClientRect();
    const box = t.closest(".c-oreki-tut__scroll");
    const br = box ? box.getBoundingClientRect() : null;
    return { w: Math.round(tr.width), right: Math.round(tr.right),
             scrollBoxW: br ? Math.round(br.width) : null,
             scrollBoxRight: br ? Math.round(br.right) : null,
             overflowsScrollBox: br ? tr.right > br.right + 2 : null };
  });
  return {
    present: true,
    modal: { x: Math.round(mr.x), right: Math.round(mr.right), w: Math.round(mr.width), h: Math.round(mr.height) },
    modalOutsideViewport: mr.right > innerWidth + 2 || mr.left < -2 || mr.bottom > innerHeight + 2,
    footer: fr ? { w: Math.round(fr.width), scrollW: f.scrollWidth, clientW: f.clientWidth,
                   selfOverflow: f.scrollWidth > f.clientWidth + 1,
                   lastRight: kids.length ? kids[kids.length - 1].right : null,
                   gapToModalEdge: kids.length ? Math.round(mr.right - kids[kids.length - 1].right) : null } : null,
    footerKids: kids,
    footerVisible: fr ? (fr.bottom <= innerHeight + 2 && fr.height > 0) : null,
    scrollRect: scroll ? { h: Math.round(scroll.getBoundingClientRect().height), scrollH: scroll.scrollHeight } : null,
    tables,
    pageOverflowWithModal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    navSmall: Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"))
      .map(n => Math.round(n.getBoundingClientRect().height)).filter(h => h < 36).length,
  };
})()`;

const report = { at: new Date().toISOString(), browser: null, cases: [] };

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
try {
  report.browser = await browser.version();
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes(":8099/")) || pages[0];
  report.pageUrl = page.url();

  for (const c of CASES) {
    if (c.wmSize) adb("shell", "wm", "size", c.wmSize); else adb("shell", "wm", "size", "reset");
    adb("shell", "wm", "density", String(c.density));
    adb("shell", "settings", "put", "system", "accelerometer_rotation", "0");
    adb("shell", "settings", "put", "system", "user_rotation", String(c.rotation));
    await sleep(2500);
    // 让页面重新布局：配置变化后 Chrome 会 relayout，但为拿到干净状态显式 reload 一次
    await page.reload({ waitUntil: "load", timeout: 60000 }).catch(() => {});
    await sleep(3000);

    // 越过开始界面（新档只有一个「开始游戏」按钮）
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button, [class*=button]"))
        .find(n => /开始游戏|开始|Start|Continue|继续/.test(n.innerText || "") && n.getBoundingClientRect().width > 0);
      if (b) b.click();
    });
    await sleep(2500);

    // 清弹窗：**reload 会触发「离线进度模拟」**，它是高优先级进度条弹窗，
    // 不清掉的话 Modal.orekiTutorial.show() 只会进队列、永远不会渲染出 .c-oreki-tut。
    // （上一版五个宽度全部 tut=false 就是这个原因，不是教程坏了。）
    for (let i = 0; i < 20; i++) {
      const state = await page.evaluate(() => {
        const ov = document.querySelector(".l-modal-overlay");
        if (!ov) return { done: true };
        const isOffline = ov.className.includes("progress-bar-modal");
        const btns = Array.from(ov.querySelectorAll("button")).map(b => (b.innerText || "").trim());
        let clicked = null;
        if (isOffline) {
          const skip = Array.from(ov.querySelectorAll("button")).find(b => /跳过|Skip/.test(b.innerText || ""));
          const fast = Array.from(ov.querySelectorAll("button")).find(b => /加速/.test(b.innerText || ""));
          const t = skip || fast;
          if (t) { t.click(); clicked = (t.innerText || "").trim(); }
        } else {
          const t = Array.from(ov.querySelectorAll("button")).find(b => /确定|OK|关闭|知道了/.test(b.innerText || ""));
          if (t) { t.click(); clicked = (t.innerText || "").trim(); }
        }
        return { done: false, isOffline, btns, clicked };
      });
      if (state.done) break;
      if (!state.clicked) {
        // 没有可点的按钮（进度条正在跑），等一会儿
        if (i > 8) break;
      }
      await sleep(900);
    }
    await page.evaluate(() => { try { window.Modal.hideAll(); } catch (e) {} });
    await sleep(500);

    const main = await page.evaluate(MEASURE);
    const p1 = path.join(SHOTS, `avd_w_${c.name}.png`);
    await page.screenshot({ path: p1 });

    // 教程弹窗 + 第 5 章（含对照表）
    // 先等模块就绪：reload 之后 window.Modal.orekiTutorial 可能还没挂上，
    // 直接 show() 会静默失败（上一版 360/390/430 三档全空就是这么来的）。
    let ready = false;
    for (let i = 0; i < 40; i++) {
      ready = await page.evaluate(() => Boolean(window.Modal && window.Modal.orekiTutorial)).catch(() => false);
      if (ready) break;
      await sleep(400);
    }
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) { window.TutorialReadingPosition.chapterId = null; window.TutorialReadingPosition.scrollTop = 0; }
      window.Modal.orekiTutorial.show();
    });
    let opened = false;
    for (let i = 0; i < 20; i++) {
      opened = await page.evaluate(() => Boolean(document.querySelector(".c-oreki-tut"))).catch(() => false);
      if (opened) break;
      await sleep(300);
    }
    if (!opened) console.log(`  ! ${c.name}: 教程弹窗未出现（moduleReady=${ready}）`);
    await sleep(600);
    await page.evaluate(() => {
      const navs = document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)");
      if (navs[5]) navs[5].click();
    });
    await sleep(700);
    await page.evaluate(() => {
      const t = document.querySelector(".c-oreki-tut__table");
      if (t) t.scrollIntoView({ block: "center" });
    });
    await sleep(500);
    const tut = await page.evaluate(TUT);
    const p2 = path.join(SHOTS, `avd_w_${c.name}_tut.png`);
    await page.screenshot({ path: p2 });

    // 滚到底确认不截断
    const atBottom = await page.evaluate(() => {
      const b = document.querySelector(".c-oreki-tut__scroll");
      if (!b) return null;
      b.scrollTop = b.scrollHeight;
      return Math.abs(b.scrollTop + b.clientHeight - b.scrollHeight) <= 2;
    });
    await sleep(400);

    // 关教程
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(n => /关闭教程/.test(n.innerText || ""));
      if (b) b.click();
    });
    await sleep(800);

    report.cases.push({ case: c.name, density: c.density, rotation: c.rotation, expectW: c.expectW, moduleReady: true, main, tut, tutAtBottom: atBottom, shots: [p1, p2] });
    console.log(`${c.name}: innerWidth=${main.vw} (期望 ${c.expectW}) overflow=${main.docOverflow} outside=${main.overflowCount} small=${main.smallCount} tut=${tut.present} footerGap=${tut.footer && tut.footer.gapToModalEdge} atBottom=${atBottom}`);
  }
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  adb("shell", "wm", "size", "reset");
  adb("shell", "wm", "density", "reset");
  adb("shell", "settings", "put", "system", "user_rotation", "0");
  adb("shell", "settings", "put", "system", "accelerometer_rotation", "1");
  await browser.disconnect();
}

fs.writeFileSync(path.join(OUT, "avd-chrome-widths-report.json"), JSON.stringify(report, null, 2));
console.log("\nfatal:", report.fatal || "none");
console.log("density reset 已执行");
