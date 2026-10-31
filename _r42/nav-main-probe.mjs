// R42-C：窄屏教程弹窗「导航条与正文之间约 92px 空白」溯源
// 量 layout 的直接子元素，以及每个子元素上下 margin / 是否有占位块。
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
await p.evaluate(() => { if (window.TutorialReadingPosition) TutorialReadingPosition.chapterId = null; Modal.orekiTutorial.show(); });
await sleep(2000);

console.log(JSON.stringify(await p.evaluate(() => {
  const R = n => { const x = n.getBoundingClientRect(); const cs = getComputedStyle(n); return { tag: n.tagName, cls: (n.className || "").toString().slice(0, 50), x: +x.x.toFixed(1), y: +x.y.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1), mt: cs.marginTop, mb: cs.marginBottom, pt: cs.paddingTop, pb: cs.paddingBottom, disp: cs.display, grow: cs.flexGrow, basis: cs.flexBasis, minH: cs.minHeight }; };
  const layout = document.querySelector(".c-oreki-tut__layout");
  const kids = Array.from(layout.children).map(R);
  // layout 的孙子层级里谁撑高了
  const layoutCS = getComputedStyle(layout);
  return { vw: innerWidth, layout: { ...R(layout), dir: layoutCS.flexDirection, maxH: layoutCS.maxHeight, algn: layoutCS.alignItems, just: layoutCS.justifyContent, gap: layoutCS.gap }, kids };
}), null, 1));

adb("shell", "wm", "density", "reset");
await b.disconnect();
