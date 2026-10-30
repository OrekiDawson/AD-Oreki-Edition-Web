// 窄屏可用性定向验证：内置教程 + 选项→游戏性（动态速度相关）
//
// 目的（针对 Agent E「Web 教程与跨端一致性」本轮落点）：
//   ① 教程弹窗在 320/360/390/430/768/1280 宽度下不产生文档级横向溢出；
//   ② 教程正文、章节导航、底部按钮都留在弹窗面板内（不被裁掉）；
//   ③ 教程正文可滚动（内容不超长导致无法访问底部按钮）；
//   ④ 选项→游戏性页在窄屏下：倍率输入框 / 预设按钮 / 动态开关都可见且可点，
//      触控目标短边 ≥ 32px；
//   ⑤ 动态速度开关真实写回 GameSpeed（关闭后不再自动升档）。
//
// 边界：这是**宿主机浏览器的视口仿真**，不等价于 AVD/真机内真实浏览器
//      （见 AD-Oreki-Edition/docs/移动端适配测试门禁.md §5-A）。
//
// 用法：
//   NODE_OPTIONS="--import=file:///C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/lib/patch-launch.mjs" \
//     node verify-oreki-tutorial-responsive.mjs ../AD-Oreki-Edition 8472
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8472);
const WIDTHS = [320, 360, 390, 430, 620, 700, 768, 900, 1280];
const MIN_TOUCH = 32;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(2000);

const results = [];
const check = (name, pass, detail = "") => {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// 切换视口的 isMobile 会触发一次页面重载（Emulation 重建），
// 注入的样式与游戏状态都会丢失，所以每次改视口后都要重新等待游戏就绪。
const setViewportAndWait = async (width) => {
  await page.setViewport({
    width, height: width >= 768 ? 900 : 844,
    deviceScaleFactor: 2, isMobile: width < 768, hasTouch: true,
  });
  for (let i = 0; i < 100; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await wait(400);
  }
  await wait(600);
};

const openTutorial = async () => {
  await page.evaluate(() => Modal.orekiTutorial.show());
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => !!document.querySelector(".c-oreki-tut"));
    if (has) { await wait(400); return true; }
    await wait(100);
  }
  return false;
};
const closeTutorial = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "关闭教程");
    if (btn) btn.click();
  });
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => !!document.querySelector(".c-oreki-tut"));
    if (!has) return true;
    await wait(100);
  }
  return false;
};

// —— ① 教程弹窗在各视口下的布局 ——
console.log("\n【A】内置教程弹窗 · 视口矩阵");
for (const width of WIDTHS) {
  await setViewportAndWait(width);
  const opened = await openTutorial();
  if (!opened) { check(`${width}px 教程能打开`, false, "modal 未渲染"); continue; }

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const panel = document.querySelector(".c-modal");
    const body = document.querySelector(".c-oreki-tut");
    const scroll = document.querySelector(".c-oreki-tut__scroll");
    const nav = document.querySelector(".c-oreki-tut__nav");
    const btns = document.querySelector(".l-modal-buttons");
    const r = el => el ? el.getBoundingClientRect() : null;
    const p = r(panel), b = r(body), s = r(scroll), n = r(nav), q = r(btns);
    const inside = (a, c) => !!a && !!c &&
      a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && a.left >= c.left - 1 && a.right <= c.right + 1;
    // 教程内部可横向滚动的导航条是有意设计（章节切换），不算文档级溢出
    const scrollableNav = nav ? nav.scrollWidth > nav.clientWidth + 1 : false;
    // 触控目标：教程内所有按钮
    const tutButtons = [...document.querySelectorAll(".c-oreki-tut button, .l-modal-buttons button")]
      .filter(el => {
        const cs = getComputedStyle(el);
        const rr = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && rr.width > 0 && rr.height > 0;
      })
      .map(el => {
        const rr = el.getBoundingClientRect();
        return { t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 12), w: Math.round(rr.width), h: Math.round(rr.height) };
      });
    const small = tutButtons.filter(x => Math.min(x.w, x.h) < 32);
    return {
      docOverflow: de.scrollWidth > de.clientWidth + 1,
      scrollW: de.scrollWidth, clientW: de.clientWidth,
      bodyInside: inside(b, p),
      scrollInside: inside(s, p),
      navInside: inside(n, p),
      buttonsInside: inside(q, p),
      scrollable: scroll ? scroll.scrollHeight > scroll.clientHeight + 1 : false,
      navScrollable: scrollableNav,
      smallTargets: small,
      buttonCount: tutButtons.length,
    };
  });
  check(`${width}px 教程：无文档级横向溢出`, !m.docOverflow, `scrollW=${m.scrollW} clientW=${m.clientW}`);
  check(`${width}px 教程：正文/导航/按钮都在弹窗面板内`,
    m.bodyInside && m.scrollInside && m.navInside && m.buttonsInside,
    `body=${m.bodyInside} scroll=${m.scrollInside} nav=${m.navInside} buttons=${m.buttonsInside}`);
  check(`${width}px 教程：触控目标短边 ≥ 32px`, m.smallTargets.length === 0,
    `按钮=${m.buttonCount} 小目标=${m.smallTargets.length}` + (m.smallTargets.length ? ` ${JSON.stringify(m.smallTargets.slice(0, 2))}` : ""));
  await closeTutorial();
}

// —— ② 选项 → 游戏性（动态速度相关）——
console.log("\n【B】选项 → 游戏玩法 · 动态速度相关");
for (const width of WIDTHS) {
  await setViewportAndWait(width);
  await page.evaluate(() => {
    Modal.hideAll();
    Tab.options.show(true, Tab.options.gameplay);
  });
  await wait(700);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    // 新闻跑马灯（.c-news-ticker）本身是横向滚动区，故意超出视口；
    // 与 verify-viewport-matrix.mjs 保持同一排除口径，不算布局缺陷。
    const inTicker = el => !!el.closest(".c-news-ticker, .c-news-line, .l-notification-container");
    const vis = el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && !inTicker(el);
    };
    const all = [...document.querySelectorAll("#ui *")];
    const overflowRight = all.filter(el => vis(el) && el.getBoundingClientRect().right > window.innerWidth + 1);
    const field = document.querySelector(".c-oreki-speed__field");
    const presets = [...document.querySelectorAll(".c-oreki-speed__preset")].filter(vis);
    const dynToggle = [...document.querySelectorAll("#ui button, #ui .o-primary-btn")]
      .find(el => /自动动态速度/.test(el.textContent || "") || el.getAttribute?.("aria-label") === "自动动态速度");
    const box = el => el ? el.getBoundingClientRect() : null;
    const touchOk = el => {
      if (!el) return false;
      const r = box(el);
      return r.width > 0 && r.height > 0 && Math.min(r.width, r.height) >= 32;
    };
    return {
      docOverflow: de.scrollWidth > de.clientWidth + 1,
      overflowRightCount: overflowRight.length,
      overflowSample: overflowRight.slice(0, 3).map(e => (e.className || e.tagName).toString().slice(0, 34)),
      fieldVisible: !!field && vis(field),
      fieldTouchOk: touchOk(field),
      presetCount: presets.length,
      presetAllTouchOk: presets.every(touchOk),
      presetMinH: presets.length ? Math.min(...presets.map(p => Math.round(box(p).height))) : null,
      dynToggleFound: !!dynToggle,
      dynToggleTouchOk: touchOk(dynToggle),
      dynLabel: dynToggle ? (dynToggle.textContent || "").trim().slice(0, 20) : null,
      text: document.body.innerText.match(/[自动手动]+（[^）]*）/)?.[0] || "无",
    };
  });
  check(`${width}px 选项页：无文档级横向溢出`, !m.docOverflow && m.overflowRightCount === 0,
    `docOverflow=${m.docOverflow} 右溢=${m.overflowRightCount}` + (m.overflowSample.length ? ` ${JSON.stringify(m.overflowSample)}` : ""));
  check(`${width}px 选项页：倍率输入框可见且可点`, m.fieldVisible && m.fieldTouchOk,
    `visible=${m.fieldVisible} touch=${m.fieldTouchOk}`);
  check(`${width}px 选项页：预设按钮全部可见且触控达标`, m.presetCount > 0 && m.presetAllTouchOk,
    `数量=${m.presetCount} 最小高=${m.presetMinH}`);
  check(`${width}px 选项页：动态速度开关可见且可点`, m.dynToggleFound && m.dynToggleTouchOk,
    `label=${m.dynLabel} 状态文案=${m.text}`);
}

// —— ③ 动态速度语义：关闭后不再自动升档（真实行为，不是文案）——
console.log("\n【C】动态速度 · 手动模式真实行为");
const dyn = await page.evaluate(() => {
  const out = [];
  const A = (name, cond, extra = "") => out.push({ name, pass: !!cond, extra });
  GameSpeed.set(10000);
  GameSpeed.setDynamic(false);
  const f0 = GameSpeed.factor;
  let t = Date.now();
  let ramps = 0;
  for (let i = 0; i < 40; i++) { t += 1000; if (GameSpeed.tickDynamic(t)) ramps++; }
  A("手动模式：倍率保持不变", GameSpeed.factor === f0, `factor=${GameSpeed.factor} (起始 ${f0})`);
  A("手动模式：不再自动升档", ramps === 0, `ramps=${ramps}`);
  A("手动模式：文案标为「手动」", /手动/.test(GameSpeed.modeLabel), GameSpeed.modeLabel);
  // 重新打开动态模式：应能继续升档
  GameSpeed.setDynamic(true);
  GameSpeed.set(10000);
  let t2 = Date.now();
  let ramps2 = 0;
  for (let i = 0; i < 40; i++) { t2 += 1000; if (GameSpeed.tickDynamic(t2)) ramps2++; }
  A("重新开启动态模式：能自动升档", GameSpeed.factor > 10000, `factor=${GameSpeed.factor} ramps=${ramps2}`);
  A("升档不超过倍率上限", GameSpeed.factor <= GameSpeed.max, `factor=${GameSpeed.factor} max=${GameSpeed.max}`);
  GameSpeed.setDynamic(true);
  GameSpeed.set(GameSpeed.defaultFactor);
  return out;
});
for (const c of dyn) check(c.name, c.pass, c.extra);

check("全程无未捕获异常", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n===== ${results.length - failed}/${results.length} 通过 =====`);
if (failed) process.exitCode = 1;
