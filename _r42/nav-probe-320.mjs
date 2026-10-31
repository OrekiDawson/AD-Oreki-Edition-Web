// R42-C：窄屏（320 CSS px）教程导航条几何深查
// 目的：判定 avd_w_320_tut.png 里「看不到章节目录」到底是
//   (a) 设计降级为横向滚动条 → 正常；还是 (b) 被裁剪 → bug。
// 手段：不只量 nav 自己，还量祖先链的 rect + scrollTop/scrollHeight，
//       以及「当前章按钮」是否落在可视带内（scrollLeft 是否为 0）。
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
const ADB = "C:/Users/Oreki/Android/Sdk/platform-tools/adb.exe";
const S = "emulator-5556";
const adb = (...a) => execFileSync(ADB, ["-s", S, ...a], { encoding: "utf8" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

adb("shell", "wm", "density", "540");
await sleep(2500);
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const p = (await b.pages()).find(x => x.url().includes(":8099/"));
await p.reload({ waitUntil: "load" }).catch(() => {});
await sleep(3500);

// 清掉「离线进度模拟」等启动弹窗，否则 Modal.show() 只入队
for (let i = 0; i < 15; i++) {
  const s = await p.evaluate(() => {
    const ov = document.querySelector(".l-modal-overlay");
    if (!ov) return "none";
    const t = Array.from(ov.querySelectorAll("button")).find(x => /跳过|Skip|确定|OK|开始游戏/.test(x.innerText || ""));
    if (t) { t.click(); return "click"; }
    return "wait";
  });
  if (s === "none") break;
  await sleep(900);
}
await p.evaluate(() => { try { Modal.hideAll(); } catch (e) {} });
await sleep(400);
await p.evaluate(() => {
  if (window.TutorialReadingPosition) TutorialReadingPosition.chapterId = null;
  Modal.orekiTutorial.show();
});
await sleep(2000);

const out = await p.evaluate(() => {
  const R = n => { const x = n.getBoundingClientRect(); return { x: +x.x.toFixed(1), y: +x.y.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1), bottom: +x.bottom.toFixed(1) }; };
  const nav = document.querySelector(".c-oreki-tut__nav");
  const layout = document.querySelector(".c-oreki-tut__layout");
  const scroll = document.querySelector(".c-oreki-tut__scroll");
  const btns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn"));
  const act = document.querySelector(".c-oreki-tut__nav-btn--active");

  // 祖先链：谁在裁剪 nav
  const chain = [];
  for (let n = nav; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    chain.push({
      cls: (n.className || "").toString().slice(0, 60),
      ...R(n),
      of: cs.overflow,
      ox: cs.overflowX,
      oy: cs.overflowY,
      pos: cs.position,
      scrollTop: n.scrollTop,
      scrollLeft: n.scrollLeft,
      sh: n.scrollHeight,
      ch: n.clientHeight,
      sw: n.scrollWidth,
      cw: n.clientWidth,
    });
  }

  const navR = nav.getBoundingClientRect();
  const visW = [navR.x, navR.right];
  const inBand = el => { const r = el.getBoundingClientRect(); return r.left < navR.right && r.right > navR.left; };

  return {
    vw: innerWidth, vh: innerHeight,
    layout: { ...R(layout), dir: getComputedStyle(layout).flexDirection },
    nav: { ...R(nav), dir: getComputedStyle(nav).flexDirection, ox: getComputedStyle(nav).overflowX, oy: getComputedStyle(nav).overflowY, scrollLeft: nav.scrollLeft, scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth, clientHeight: nav.clientHeight },
    scroll: scroll ? { ...R(scroll), scrollTop: scroll.scrollTop, sh: scroll.scrollHeight, ch: scroll.clientHeight } : null,
    btnCount: btns.length,
    btnTxt: btns.slice(0, 4).map(n => (n.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24)),
    btnH: [...new Set(btns.map(n => Math.round(n.getBoundingClientRect().height)))],
    btnsInBand: btns.filter(inBand).length,
    activeIdx: act ? btns.indexOf(act) : -1,
    activeText: act ? (act.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24) : null,
    activeInBand: act ? inBand(act) : null,
    activeRect: act ? R(act) : null,
    chain,
  };
});
console.log(JSON.stringify(out, null, 1));

// 只截弹窗本体，便于判断视觉
const box = await p.evaluate(() => {
  const m = document.querySelector(".c-oreki-tut");
  const r = m.getBoundingClientRect();
  return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth), height: Math.min(r.height, innerHeight) };
});
await p.screenshot({ path: "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r42/shots_avd/nav_probe_320.png", clip: box });

adb("shell", "wm", "density", "reset");
await b.disconnect();
