// R21 交付验证：常驻教程入口 + 教程内容 + 360/390 移动端
//
// 覆盖：
//  ① 常驻入口存在于 DOM、可见、触控 ≥ 36px、点击能打开教程弹窗；
//  ② 教程章节含新增「阶段突破」，正文中文可读（抽查 AD3/AD3b/AD4/AD5 的关键数字）；
//  ③ 360×640 与 390×844：无文档级横向溢出、正文可滚动到底、底部翻章按钮在面板内、
//     弹窗不被侧栏导航遮盖（elementFromPoint 命中弹窗）；
//  ④ 入口按钮与页面内可交互元素的遮挡情况（只报告，用于判断是否需要让位）；
//  ⑤ 侧栏 10 项顺序（Tabs.newUI 渲染顺序）；
//  ⑥ 全程无未捕获异常。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve("../AD-Oreki-Edition");
const port = 8621;
const SHOT_DIR = "C:/Users/Oreki/AppData/Local/Temp";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".webm": "video/webm",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: 8622 });
const { page, errors } = await openGame(browser, { port });
const consoleErrors = [];
page.on("console", m => {
  if (m.type() === "error" && !/googletagmanager|Content Security Policy/iu.test(m.text())) {
    consoleErrors.push(m.text());
  }
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const setViewport = async (width, height) => {
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: width < 768, hasTouch: width < 768 });
  for (let i = 0; i < 100; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await wait(300);
  }
  await wait(900);
};

const openViaEntry = async () => {
  // 游戏内可能已经有别的弹窗（例如「1 分钟内完成无限」的速度跑提示），而且会反复出现；
  // 教程弹窗排队时可能被更高优先级的消息弹窗挤掉，所以这里「清空 -> 点击 -> 等渲染」多试几轮。
  for (let attempt = 0; attempt < 5; attempt++) {
    // 视口切换会重载页面；GameUI.initialized 为 false 时 Modal.show() 会直接 return
    for (let i = 0; i < 100; i++) {
      const ready = await page.evaluate(() => {
        try { return !!(window.GameUI && GameUI.initialized && window.Modal && Modal.orekiTutorial); }
        catch { return false; }
      }).catch(() => false);
      if (ready) break;
      await wait(200);
    }
    await page.evaluate(() => { try { Modal.hideAll(); } catch (e) { /* ignore */ } });
    await wait(350);
    const clicked = await page.evaluate(() => {
      const b = document.getElementById("oreki-tutorial-entry");
      if (!b) return false;
      b.click();
      return true;
    });
    for (let i = 0; i < 25; i++) {
      if (await page.evaluate(() => !!document.querySelector(".c-oreki-tut"))) return clicked;
      // 被别的弹窗挤掉时再清一次队列
      if (i === 12) await page.evaluate(() => { try { Modal.hideAll(); Modal.orekiTutorial.show(); } catch (e) { /* ignore */ } });
      await wait(100);
    }
  }
  return false;
};
const closeTutorial = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "关闭教程");
    if (btn) btn.click();
  });
  for (let i = 0; i < 40; i++) {
    if (!(await page.evaluate(() => !!document.querySelector(".c-oreki-tut")))) return true;
    await wait(100);
  }
  return false;
};
const gotoChapter = async (idx) => {
  await page.evaluate(i => {
    const b = document.querySelectorAll(".c-oreki-tut__nav-btn");
    if (b[i]) b[i].click();
  }, idx);
  await wait(350);
};

// ── ① 常驻入口（桌面） ─────────────────────────────────────────────
await setViewport(1280, 800);
const entry = await page.evaluate(() => {
  const b = document.getElementById("oreki-tutorial-entry");
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const cs = getComputedStyle(b);
  return {
    text: b.textContent.replace(/\s+/g, " ").trim(),
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    z: cs.zIndex, pos: cs.position,
    inViewport: r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.top >= 0,
    touchOk: Math.min(r.width, r.height) >= 36,
    aria: b.getAttribute("aria-label"),
  };
});
check("常驻教程入口已注入", !!entry, entry ? `“${entry.text}” ${entry.rect.join("×")} z=${entry.z}` : "缺失");
check("入口固定在视口内且触控 ≥ 36px", entry && entry.pos === "fixed" && entry.inViewport && entry.touchOk,
  entry ? `pos=${entry.pos} inView=${entry.inViewport} touch=${entry.touchOk}` : "");
check("入口有中文可读标签与无障碍名", entry && /教程/.test(entry.text) && !!entry.aria, entry ? `aria=${entry.aria}` : "");

// 入口在任意页签都在（切到统计/成就页确认）
await page.evaluate(() => Tab.statistics.show(true));
await wait(600);
const onStats = await page.evaluate(() => {
  const b = document.getElementById("oreki-tutorial-entry");
  const r = b.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
});
check("切到「统计数据」页后入口仍可见", onStats);
await page.evaluate(() => Tab.dimensions.show(true));
await wait(400);

// ── ② 点击入口打开教程 + 新章节内容 ─────────────────────────────
const opened = await openViaEntry();
check("点击入口能打开教程弹窗", opened);

// 层级断言：入口 z-index 必须低于弹窗遮罩（6），否则会压住对话框
const zOrder = await page.evaluate(() => {
  const b = document.getElementById("oreki-tutorial-entry");
  const overlay = document.querySelector(".l-modal") || document.querySelector(".l-modal-overlay");
  return {
    entry: Number(getComputedStyle(b).zIndex),
    overlay: overlay ? Number(getComputedStyle(overlay).zIndex) : null,
    hasOverlay: !!overlay,
  };
});
check("入口 z-index 低于弹窗遮罩（弹窗打开时不抢焦点）",
  zOrder.hasOverlay && Number.isFinite(zOrder.entry) && Number.isFinite(zOrder.overlay) && zOrder.entry < zOrder.overlay,
  `entry=${zOrder.entry} overlay=${zOrder.overlay}`);

const meta = await page.evaluate(() => ({
  titles: [...document.querySelectorAll(".c-oreki-tut__nav-title")].map(e => e.textContent.trim()),
  hasBreakthrough: [...document.querySelectorAll(".c-oreki-tut__nav-title")].some(e => e.textContent.trim() === "阶段突破"),
}));
check("章节列表含「阶段突破」", meta.hasBreakthrough, `共 ${meta.titles.length} 章：${meta.titles.join(" / ")}`);

const btIdx = meta.titles.indexOf("阶段突破");
await gotoChapter(btIdx);
const chapterText = await page.$eval(".c-oreki-tut__scroll", e => e.innerText.replace(/\s+/g, " "));
const need = [
  ["AD3 兜底数字 1e8", /1e8/],
  ["AD3 说明「全部购买」", /全部购买/],
  ["AD3b 门槛 1e1100", /1e1100/],
  ["AD3b 暂停自动坍缩", /暂停/],
  ["AD4 保留反物质窗口", /维度提升/],
  ["AD4 毁灭现实排除", /毁灭现实/],
  ["AD5 成本 32767", /32767/],
  ["AD5 间隔 150000", /150000/],
  ["AD5 15 级", /15 级/],
  ["AD5 Break 前置", /前置/],
  ["AD5b 自动按 Break", /AD5b/],
  ["AD6 无限维度自动化", /AD6/],
  ["AD6 每帧最多买 1 个升级", /最多买 1 个/],
  ["AD6 永恒里程碑原因", /永恒里程碑/],
  ["AD7 开局自动化", /AD7/],
  ["AD7 说明倍率对开局无效", /时间倍率在开局阶段完全无效/],
  ["AD7 说明 150 秒真实时间", /150 秒/],
  ["AD8 IP 兑换尺度（308 → 30）", /308/],
  ["AD8 常量 30", /30（常量 OREKI_PRE_ETERNITY_IP_DIVISOR = 30）|= 30/],
  ["AD8 标题为 Reality 之前", /AD8 · Reality 之前的 IP 兑换尺度/],
  ["AD8 窗口含整个永恒阶段", /包括之后的每一次永恒/],
  ["AD9 章节存在", /AD9 · Reality 之前的 EP 兑换尺度/],
  ["AD9 常量名", /OREKI_PRE_REALITY_EP_DIVISOR/],
  ["AD9 EP 公式 5\^", /5\^/],
  ["AD9 说明不伪造解锁标志", /不伪造解锁标志/],
  ["AD8 诚实措辞：数值平衡改动", /数值平衡改动/],
  ["AD8 说明仍要真实触发 canEternity", /canEternity/],
  ["实测时间线 11 秒", /11 秒/],
  ["实测时间线 13 秒", /13 秒/],
  ["实测时间线 15 秒", /15 秒/],
  ["永恒后实测 21891 次无限", /21891/],
  ["AD4 保留反物质解除条件", /首次永恒之后|首次永恒达成|自动失效/],
];
for (const [name, re] of need) check(`阶段突破正文包含：${name}`, re.test(chapterText));
check("阶段突破正文为中文（含中文标点与汉字）", /[一-龥]{6,}/u.test(chapterText) && /，/u.test(chapterText));
await page.screenshot({ path: `${SHOT_DIR}/r21-tutorial-desktop-breakthrough.png` });

// 动态速度章节也抽查一次
const speedIdx = meta.titles.indexOf("Mod 专属机制");
await gotoChapter(speedIdx);
const modText = await page.$eval(".c-oreki-tut__scroll", e => e.innerText.replace(/\s+/g, " "));
for (const [name, re] of [
  ["默认 10000×", /10000×/],
  ["上限 100000×", /100000×/],
  ["停滞 4 秒判定", /4 秒/],
  ["每次 ×2 升档", /×2/],
  ["手动模式说明", /手动模式/],
  ["本地持久化", /浏览器本地/],
]) check(`Mod 专属机制正文包含：${name}`, re.test(modText));
await page.screenshot({ path: `${SHOT_DIR}/r21-tutorial-desktop-speed.png` });
await closeTutorial();

// ── ④b 阶段指南：无限期 / 永恒期 两段的实测时间线 ─────────────────
await setViewport(1280, 900);
await wait(1200);
const readStage = () => page.$$eval(".c-oreki-tut__current .c-oreki-tut__points li",
  els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
// 切到「阶段指南」并等 current 区块渲染出来（最多重试 3 次）
const openStageChapter = async () => {
  for (let i = 0; i < 3; i++) {
    await gotoChapter(3);
    for (let k = 0; k < 20; k++) {
      const ok = await page.evaluate(() => !!document.querySelector(".c-oreki-tut__current-name"));
      if (ok) return true;
      await wait(150);
    }
  }
  return false;
};
const stageName = () => page.evaluate(() => {
  const el = document.querySelector(".c-oreki-tut__current-name");
  return el ? el.textContent.trim() : "";
});

// ① 回到「无限期」：清掉永恒/现实，保留 1 次无限
await page.evaluate(() => {
  player.infinities = new Decimal(1);
  player.eternities = new Decimal(0);
  player.realities = 0;
  GameUI.update();
});
await wait(900);
const stageOpened = await openViaEntry();
check("能打开教程（阶段指南复核）", stageOpened);
const stageRendered = await openStageChapter();
check("阶段指南能渲染当前阶段区块", stageRendered);
const infSteps = await readStage();
const infAll = infSteps.join(" | ");
const curName = await stageName();
check("当前阶段为「无限期」", curName === "无限期", `current=${curName}`);
check("无限期步骤含实测时间线（11/13/15~16 秒）",
  /11 秒/.test(infAll) && /13 秒/.test(infAll) && /15(?:~16)? 秒/.test(infAll),
  `步骤数=${infSteps.length}`);
check("无限期时间线标注了 10000× 默认速度口径", /10000×/.test(infAll));

// ② 切到「永恒期」：应带 21891 次无限 / 1e13140 的实测句
await page.evaluate(() => {
  player.eternities = new Decimal(1);
  GameUI.update();
});
await wait(1200);
const etSteps = await readStage();
const etBlock = await page.evaluate(() => {
  const el = document.querySelector(".c-oreki-tut__current");
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
});
const etAll = `${etSteps.join(" | ")} ${etBlock}`;
const etName = await stageName();
check("当前阶段切换为「永恒期」", etName === "永恒期", `current=${etName}`);
check("永恒期步骤含永恒后实测（21891 次无限 / 1e13140）",
  /21891/.test(etAll) && /1e13140/.test(etAll), `步骤数=${etSteps.length}`);
check("永恒期说明 AD8/AD9 尺度沿用", /AD8/.test(etAll) && /AD9/.test(etAll));
await page.screenshot({ path: `${SHOT_DIR}/r21-tutorial-desktop-stages.png` });
await closeTutorial();

// ── ③ 360 / 390 移动端 ──────────────────────────────────────────
for (const [w, h] of [[390, 844], [360, 640]]) {
  await setViewport(w, h);
  // isMobile 变化会触发一次页面重载，等它稳定后再测入口（否则点击会被重载吞掉）
  await wait(1500);

  const entryMobile = await page.evaluate(() => {
    const b = document.getElementById("oreki-tutorial-entry");
    const r = b.getBoundingClientRect();
    return {
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1,
      touchOk: Math.min(r.width, r.height) >= 36,
      overlaps: [...document.querySelectorAll("#ui button, #ui .o-primary-btn, #ui input")]
        .filter(el => {
          const cs = getComputedStyle(el);
          const rr = el.getBoundingClientRect();
          if (cs.display === "none" || cs.visibility === "hidden" || rr.width === 0) return false;
          if (el.closest(".c-news-ticker")) return false;
          return !(rr.right < r.left || rr.left > r.right || rr.bottom < r.top || rr.top > r.bottom);
        })
        .map(el => (el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 14))
        .slice(0, 6),
    };
  });
  check(`${w}px 入口在视口内且触控达标`, entryMobile.inView && entryMobile.touchOk,
    `rect=${entryMobile.rect.join("×")}`);
  console.log(`      · ${w}px 入口遮挡的页面控件：${entryMobile.overlaps.length ? entryMobile.overlaps.join(" | ") : "无"}`);

  const ok = await openViaEntry();
  check(`${w}px 点击入口能打开教程`, ok);
  await gotoChapter(btIdx);

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const panel = document.querySelector(".c-modal");
    const scroll = document.querySelector(".c-oreki-tut__scroll");
    const nav = document.querySelector(".c-oreki-tut__nav");
    const footer = document.querySelector(".c-oreki-tut__footer");
    const r = el => el.getBoundingClientRect();
    const inside = (a, c) => a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && a.left >= c.left - 1 && a.right <= c.right + 1;
    const p = r(panel);
    // 弹窗是否被侧栏/新闻条挡住：取弹窗中心点做命中测试
    const hit = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
    const hitInside = !!hit && (hit === panel || panel.contains(hit) || !!hit.closest(".c-modal"));
    // 正文能否滚到底
    const canScroll = !!scroll && scroll.scrollHeight > scroll.clientHeight + 1;
    let before = 0, after = 0;
    if (scroll) {
      before = scroll.scrollTop;
      scroll.scrollTop = scroll.scrollHeight;
      after = scroll.scrollTop;
    }
    return {
      docOverflow: de.scrollWidth > de.clientWidth + 1,
      scrollW: de.scrollWidth, clientW: de.clientWidth,
      panelInView: p.top >= -1 && p.left >= -1 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1,
      navInside: inside(r(nav), p),
      footerInside: inside(r(footer), p),
      scrollInside: inside(r(scroll), p),
      hitInside,
      // 标题/关闭按钮不能被成就通知条（z-index 1000）压住
      titleHitInside: (() => {
        const title = document.querySelector(".c-modal__title") || document.querySelector(".c-modal h1, .c-modal");
        if (!title) return true;
        const r = title.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!el && (!!el.closest(".c-modal"));
      })(),
      canScroll, scrolled: after > before || !canScroll,
      scrollable: canScroll,
      navScrollable: nav.scrollWidth > nav.clientWidth + 1,
      smallButtons: [...document.querySelectorAll(".c-oreki-tut button, .l-modal-buttons button")]
        .filter(el => {
          const cs = getComputedStyle(el);
          const rr = el.getBoundingClientRect();
          return cs.display !== "none" && rr.width > 0 && rr.height > 0;
        })
        .map(el => ({ t: (el.textContent || "").trim().slice(0, 8), h: Math.round(el.getBoundingClientRect().height) }))
        .filter(x => x.h < 32),
    };
  });
  check(`${w}px 无文档级横向溢出`, !m.docOverflow, `scrollW=${m.scrollW} clientW=${m.clientW}`);
  check(`${w}px 弹窗完整落在视口内`, m.panelInView);
  check(`${w}px 正文/章节导航/底部按钮都在面板内`, m.navInside && m.footerInside && m.scrollInside,
    `nav=${m.navInside} footer=${m.footerInside} scroll=${m.scrollInside}`);
  check(`${w}px 弹窗未被导航遮盖（中心点命中弹窗）`, m.hitInside);
  check(`${w}px 弹窗标题未被成就通知遮盖`, m.titleHitInside);
  check(`${w}px 正文可滚动到底`, !m.scrollable || m.scrolled, `scrollable=${m.scrollable} scrolled=${m.scrolled}`);
  check(`${w}px 教程按钮触控高度 ≥ 32px`, m.smallButtons.length === 0,
    m.smallButtons.length ? JSON.stringify(m.smallButtons.slice(0, 3)) : "");

  await page.screenshot({ path: `${SHOT_DIR}/r21-tutorial-${w}x${h}-breakthrough.png` });

  // 截图一张章节导航区的（滚动到顶部，看导航条是否横向可滚且不被裁）
  await page.evaluate(() => {
    const sc = document.querySelector(".c-oreki-tut__scroll");
    if (sc) sc.scrollTop = 0;
  });
  await wait(200);
  await page.screenshot({ path: `${SHOT_DIR}/r21-tutorial-${w}x${h}-top.png` });

  await closeTutorial();
}

// ── ⑤ 侧栏顺序（10 项固定顺序）──────────────────────────────────
const tabOrder = await page.evaluate(() => Tabs.newUI.map(t => ({ key: t.key, name: t.name })));
const expected = ["维度", "自动化", "挑战", "无限", "永恒", "现实", "天神", "成就", "统计数据", "选项"];
const got = tabOrder.filter(t => t.key !== "shop").map(t => t.name);
check("侧栏顺序为固定 10 项", JSON.stringify(got) === JSON.stringify(expected),
  `实际=[${got.join(",")}]`);

// ── ⑥ 控制台 ────────────────────────────────────────────────────
check("无未捕获异常", errors.length === 0 && consoleErrors.length === 0,
  [...errors, ...consoleErrors].slice(0, 3).join(" | "));

await cleanup();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n===== ${results.length - failed}/${results.length} 通过 =====`);
if (failed) process.exitCode = 1;
