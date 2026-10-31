// R42-B · 输入框与软键盘遮挡：宿主机几何代理测量
//
// 为什么只能这样测：
//   宿主机 Edge 的「视口」与 Android 的「软键盘」不是一回事。Android Chrome 默认
//   `interactive-widget=resizes-visual`：键盘弹出只压小**视觉视口**，布局视口（含 100vh）
//   不变，所以 `position: absolute` 居中在 100vh 里的弹窗不会自己上移。
//   headless 里既没有键盘，也无法让 visualViewport 独立于 layout viewport 缩小。
//
// 所以本脚本分两步，各自标明档位：
//   A. [实测-宿主机视口] 全高视口下量出弹窗与输入框的实际 rect、是否有可滚动祖先；
//   B. [静态推导] 用「键盘占屏比例」算出遮挡线，判断输入框落在线上还是线下。
//
// 运行：node _tools/_r42b/keyboard-probe.mjs _tools/_r42b 320,360

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42b";
const ONLY = (process.argv[3] || "320,360").split(",").map(s => s.trim());
const SERVE_PORT = 8099;
const CDP_PORT = 9356;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const VPS = [
  { name: "320", w: 320, h: 640, dpr: 2 },
  { name: "360", w: 360, h: 640, dpr: 2 },
].filter(v => ONLY.includes(v.name));

// 键盘占屏比例：Android 上中文输入法竖屏常见 40%~50%，这里取 45% 作保守估计
const KEYBOARD_RATIO = 0.45;

const PROBE = `(() => {
  const describe = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // 可滚动祖先链：有它就能靠内部滚动把输入框顶进可视区
    const scrollers = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      const oy = s.overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 2) {
        scrollers.push({ cls: String(p.className || p.tagName).slice(0, 40), clientH: p.clientHeight, scrollH: p.scrollHeight });
      }
    }
    return {
      sel, tag: el.tagName,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) },
      position: cs.position, maxHeight: cs.maxHeight, height: cs.height,
      fontSizePx: parseFloat(cs.fontSize),
      scrollers,
    };
  };
  return {
    vw: innerWidth, vh: innerHeight,
    overlay: describe(".l-modal-overlay"),
    modal: describe(".l-modal"),
    tool: describe(".c-oreki-tool"),
    textarea: describe(".c-oreki-tool__textarea"),
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    docScrollH: document.documentElement.scrollHeight,
    docClientH: document.documentElement.clientHeight,
    viewportMeta: (document.querySelector('meta[name=viewport]') || {}).content || null,
  };
})()`;

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
    cwd: path.resolve("AD-Oreki-Edition"), stdio: ["ignore", "pipe", "pipe"],
  });
  await sleep(1200);
  return { proc };
}

const report = {
  at: new Date().toISOString(),
  envNote: "宿主机 Edge + CDP 视口模拟；键盘遮挡为「几何代理 + 静态推导」，**不是** Android 软键盘实测",
  keyboardRatio: KEYBOARD_RATIO,
  viewports: [],
};
const { proc: serveProc } = await ensureServer();
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
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
    await page.keyboard.press("Escape"); await sleep(300);
  }

  for (const vp of VPS) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
    await sleep(700);
    await page.evaluate(() => {
      try { window.Modal.orekiSave.show(); } catch (e) { /* 兼容旧入口名 */ }
    });
    await sleep(800);
    const snap = await page.evaluate(PROBE);
    await page.screenshot({ path: path.join(OUT, "shots", `r42b_kb_${vp.name}_save.png`) });

    // 聚焦输入框，量焦点后是否发生自动滚动（Android 上这一步是浏览器替你做的那一半）
    const focusInfo = await page.evaluate(() => {
      const ta = document.querySelector(".c-oreki-tool__textarea");
      if (!ta) return { present: false };
      const before = ta.getBoundingClientRect().top;
      ta.focus();
      const after = ta.getBoundingClientRect().top;
      return { present: true, movedOnFocus: Math.round(after - before), active: document.activeElement === ta };
    });
    await sleep(400);
    const focusSnap = await page.evaluate(PROBE);
    await page.screenshot({ path: path.join(OUT, "shots", `r42b_kb_${vp.name}_focus.png`) });

    // 键盘线：visual viewport 被压小后，可见区底沿落在 45% 处
    const kbLine = Math.round(vp.h * (1 - KEYBOARD_RATIO));
    const ta = focusSnap.textarea;
    const verdict = ta ? {
      keyboardLineY: kbLine,
      textareaTop: ta.rect.y,
      textareaBottom: ta.rect.bottom,
      coveredPx: Math.max(0, ta.rect.bottom - kbLine),
      covered: ta.rect.bottom > kbLine,
      recoveryScroller: ta.scrollers.length > 0,
      // 只有「被盖住 且 没有可滚动祖先」才是真缺陷（有祖先可滚的话 Chrome 会把焦点滚进来）
      hardDefect: ta.rect.bottom > kbLine && ta.scrollers.length === 0,
    } : null;

    report.viewports.push({ vp: vp.name, w: vp.w, h: vp.h, snap, focusInfo, focusSnap, verdict });
    console.log(`[${vp.name}] textarea.y=${ta && ta.rect.y} bottom=${ta && ta.rect.bottom} kbLine=${kbLine} ` +
      `covered=${verdict && verdict.covered} hardDefect=${verdict && verdict.hardDefect} ` +
      `scrollers=${ta && ta.scrollers.length} modalH=${snap.modal && snap.modal.rect.h}`);

    // 清干净：hideAll 之后可能还有队列里的确认框，逐次 Esc 到没有 .l-modal 为止
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { try { window.Modal.hideAll(); } catch { /* ignore */ } });
      await sleep(250);
      const left = await page.evaluate(() => document.querySelectorAll(".l-modal").length);
      if (!left) break;
      await page.keyboard.press("Escape");
      await sleep(250);
    }
  }
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
  if (serveProc) { try { serveProc.kill(); } catch { /* ignore */ } }
}

fs.writeFileSync(path.join(OUT, "keyboard-probe-report.json"), JSON.stringify(report, null, 2));
console.log("报告写入", path.join(OUT, "keyboard-probe-report.json"));
// Edge 的 browser.close() 在 CDP 连接上偶发不返回；报告已落盘，直接退出避免进程悬挂
process.exit(0);
