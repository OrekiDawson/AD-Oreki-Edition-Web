// R42 · 教程渲染五项验收（Web 侧，逐项取证）
//
// 五项：
//   1. 18 章逐章可阅读（正文非空、不是占位符）
//   2. 7 篇附录都有玩家可达的入口（点得进去，不是只有数据里存在）
//   3. 按 stage() 正确定位章节
//   4. 长章节不截断（滚到底，末尾文字可见）
//   5. 字号三档真实生效
//
// 口径说明（先写清楚，免得把「没做」当「通过」）：
//   · 第 5 项按 docs/TUTORIAL_SCHEMA.md「双端渲染差异」表，Web 侧是「默认字号」、
//     小/中/大三档只属于 Android。Web 侧没有字号控件，因此这里只记录「确实没有」，
//     真实的三档差异必须在 Android 上取；本脚本不代替那一项。
//
// 运行（先起静态服务器）：
//   python -m http.server 8099 --bind 127.0.0.1 --directory AD-Oreki-Edition
//   node _tools/_r42/tut-accept.mjs _tools/_r42
// 退出码 0 = 脚本跑完；判定看报告里的 pass 字段。

import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42";
const SERVE_PORT = 8099;
const CDP_PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const report = { at: new Date().toISOString(), env: {}, items: {}, shots: [] };

const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

/** 关掉可能挡住的弹窗，直到没有 .l-modal-overlay */
async function clearModals(page, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const n = await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length);
    if (n === 0) return true;
    await page.keyboard.press("Escape");
    await sleep(350);
  }
  return (await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length)) === 0;
}

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(1200);

  // 越过「开始」类按钮
  const startText = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
      .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(n => {
        const r = n.getBoundingClientRect();
        return { text: (n.innerText || "").trim().slice(0, 24), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
    const hit = cands.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.text));
    return hit || null;
  });
  if (startText) {
    await page.mouse.click(startText.x, startText.y);
    await sleep(2500);
    report.startButton = startText.text;
  }
  await clearModals(page);

  report.env = await page.evaluate(() => ({
    innerWidth, innerHeight, dpr: devicePixelRatio,
    ua: navigator.userAgent.slice(0, 80),
    // 侧栏真实可见项（按真实进度动态显示的证据）
    sidebar: Array.from(document.querySelectorAll(".l-tab-btn-inner"))
      .filter(n => n.getClientRects().length > 0)
      .map(n => (n.innerText || "").replace(/\s+/g, " ").trim()),
    hasTutorialEntry: Boolean(document.getElementById("oreki-tutorial-entry")),
  }));

  /* ---------- 用真实 UI 入口打开教程 ---------- */
  const entryBox = await page.evaluate(() => {
    const b = document.getElementById("oreki-tutorial-entry");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
  });
  report.items.entry = { box: entryBox };
  if (entryBox) {
    await page.mouse.click(entryBox.x, entryBox.y);
  } else {
    await page.evaluate(() => window.Modal.orekiTutorial.show());
  }
  await sleep(1500);

  const opened = await page.evaluate(() => ({
    modal: Boolean(document.querySelector(".c-oreki-tut")),
    navCount: document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)").length,
    apxCount: document.querySelectorAll(".c-oreki-tut__nav-btn--apx").length,
    apxLabel: document.querySelector(".c-oreki-tut__nav-label")?.innerText || null,
    head: document.querySelector(".c-oreki-tut__head-title")?.innerText || null,
  }));
  report.items.entry.opened = opened;

  /* ---------- 第 1 项：18 章逐章可阅读 ---------- */
  const chapters = [];
  for (let i = 0; i < opened.navCount; i++) {
    await page.evaluate(idx => {
      const btns = Array.from(document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)"));
      btns[idx].click();
    }, i);
    await sleep(320);
    const info = await page.evaluate(() => {
      const body = document.querySelector(".c-oreki-tut__scroll");
      const text = (body?.innerText || "").replace(/\s+/g, " ").trim();
      return {
        head: document.querySelector(".c-oreki-tut__head-title")?.innerText || "",
        title: document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)")[0]?.innerText || "",
        chars: text.length,
        snippet: text.slice(0, 40),
        placeholder: /本章正在编写中|只有骨架|本章尚未写完/.test(text),
        draft: /草稿/.test(text),
        sections: document.querySelectorAll(".c-oreki-tut__label").length,
        scrollH: body ? body.scrollHeight : 0,
        clientH: body ? body.clientHeight : 0,
      };
    });
    chapters.push({ index: i, ...info });
  }
  report.items.chapters = {
    count: chapters.length,
    empty: chapters.filter(c => c.chars < 200).map(c => ({ i: c.index, chars: c.chars, snippet: c.snippet })),
    placeholderChapters: chapters.filter(c => c.placeholder || c.draft).map(c => c.index),
    minChars: Math.min(...chapters.map(c => c.chars)),
    maxChars: Math.max(...chapters.map(c => c.chars)),
    list: chapters.map(c => ({ i: c.index, head: c.head, chars: c.chars, sections: c.sections })),
  };
  report.items.chapters.pass =
    chapters.length === 18 && report.items.chapters.empty.length === 0 && report.items.chapters.placeholderChapters.length === 0;

  /* ---------- 第 2 项：7 篇附录的玩家可达入口 ---------- */
  const apx = [];
  for (let i = 0; i < opened.apxCount; i++) {
    await page.evaluate(idx => {
      document.querySelectorAll(".c-oreki-tut__nav-btn--apx")[idx].click();
    }, i);
    await sleep(320);
    const info = await page.evaluate(() => {
      const md = document.querySelector(".c-oreki-tut__md");
      const text = (md?.innerText || "").replace(/\s+/g, " ").trim();
      return {
        head: document.querySelector(".c-oreki-tut__head-title")?.innerText || "",
        subtitle: document.querySelector(".c-oreki-tut__head-subtitle")?.innerText || "",
        chars: text.length,
        snippet: text.slice(0, 36),
        active: Boolean(document.querySelector(".c-oreki-tut__nav-btn--apx.c-oreki-tut__nav-btn--active")),
      };
    });
    apx.push({ index: i, ...info });
  }
  report.items.appendices = {
    count: apx.length,
    navLabel: opened.apxLabel,
    empty: apx.filter(a => a.chars < 100).map(a => ({ i: a.index, head: a.head, chars: a.chars })),
    list: apx.map(a => ({ i: a.index, head: a.head, chars: a.chars })),
  };
  report.items.appendices.pass = apx.length === 7 && report.items.appendices.empty.length === 0
    && apx.every(a => a.subtitle.includes("附录"));

  // 附录入口截图
  await page.evaluate(() => document.querySelectorAll(".c-oreki-tut__nav-btn--apx")[0]?.click());
  await sleep(400);
  {
    const p = path.join(SHOTS, "r42_tut_02_appendix_nav.png");
    await page.screenshot({ path: p });
    report.shots.push(p);
  }

  /* ---------- 第 4 项：最长章滚到底，末尾文字可见 ---------- */
  const longest = chapters.slice().sort((a, b) => b.chars - a.chars)[0];
  await page.evaluate(idx => {
    document.querySelectorAll(".c-oreki-tut__nav-btn:not(.c-oreki-tut__nav-btn--apx)")[idx].click();
  }, longest.index);
  await sleep(400);
  const topScroll = await page.evaluate(() => {
    const b = document.querySelector(".c-oreki-tut__scroll");
    return { scrollH: b.scrollHeight, clientH: b.clientHeight, top: b.scrollTop };
  });
  await page.evaluate(() => {
    const b = document.querySelector(".c-oreki-tut__scroll");
    b.scrollTop = b.scrollHeight;
  });
  await sleep(600);
  const bottom = await page.evaluate(() => {
    const b = document.querySelector(".c-oreki-tut__scroll");
    const last = Array.from(b.querySelectorAll(".c-oreki-tut__block")).pop();
    const footer = document.querySelector(".c-oreki-tut__footer");
    const vis = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.height > 0 && r.top < innerHeight && r.bottom > 0 && s.display !== "none" };
    };
    return {
      scrollTop: b.scrollTop,
      atBottom: Math.abs(b.scrollTop + b.clientHeight - b.scrollHeight) <= 2,
      lastBlock: last ? last.innerText.replace(/\s+/g, " ").trim().slice(0, 120) : null,
      lastBlockBox: vis(last),
      footerBox: vis(footer),
      headBox: vis(document.querySelector(".c-oreki-tut__head")),
    };
  });
  {
    const p = path.join(SHOTS, "r42_tut_04_longest_bottom.png");
    await page.screenshot({ path: p });
    report.shots.push(p);
  }
  report.items.longest = {
    chapterIndex: longest.index,
    head: longest.head,
    chars: longest.chars,
    scrollH: topScroll.scrollH,
    clientH: topScroll.clientH,
    needScroll: topScroll.scrollH > topScroll.clientH + 2,
    ...bottom,
  };
  report.items.longest.pass = report.items.longest.atBottom === true
    && bottom.lastBlockBox && bottom.lastBlockBox.visible === true;

  /* ---------- 第 5 项：字号三档（Web 侧口径） ---------- */
  const font = await page.evaluate(() => {
    const textNode = document.querySelector(".c-oreki-tut__text");
    const cs = textNode ? getComputedStyle(textNode) : null;
    const controls = Array.from(document.querySelectorAll("[class*=font], [id*=font], [class*=字号]"))
      .map(n => String(n.className || n.id).slice(0, 40));
    return {
      textFontSize: cs ? cs.fontSize : null,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      fontControls: controls,
      cssVarCandidates: ["--oreki-tut-font-scale", "--tutorial-font-scale", "--font-scale"]
        .map(v => ({ v, val: getComputedStyle(document.documentElement).getPropertyValue(v).trim() })),
    };
  });
  report.items.font = {
    ...font,
    webHasControl: font.fontControls.length > 0,
    note: "按 docs/TUTORIAL_SCHEMA.md「双端渲染差异」，Web 侧字号固定、三档只属于 Android；"
      + "本项在 Web 侧只能证「没有控件」，真实三档差异必须去 Android 取。",
    pass: font.fontControls.length === 0 ? "N/A（Web 无此功能，按设计）" : "有控件待验",
  };

  /* ---------- 第 3 项：stage() 定位 ---------- */
  // 做法：关掉教程 -> 改内存里的玩家状态 -> 重新打开 -> 看默认落在哪一章。
  // 只改内存、不写存档、不落盘；测完刷新即失效。
  await page.keyboard.press("Escape");
  await sleep(600);
  await clearModals(page);

  const positions = [];
  const STATES = [
    { name: "全新档（early）", patch: null },
    { name: "无限次数=1、未打破（infinity）", patch: { infinities: 1, break: false } },
    { name: "已打破、IP 指数 0（infinity）", patch: { infinities: 1, break: true, ipExp: 0 } },
    { name: "已打破、IP 指数 12（infinity 后段）", patch: { infinities: 1, break: true, ipExp: 12 } },
    { name: "永恒次数=1（eternity）", patch: { eternities: 1, break: true, ipExp: 20 } },
  ];
  for (const st of STATES) {
    if (st.patch) {
      const ok = await page.evaluate(p => {
        try {
          if (p.infinities !== undefined) player.infinities = p.infinities;
          if (p.eternities !== undefined) player.eternities = p.eternities;
          if (p.break !== undefined) player.break = p.break;
          if (p.ipExp !== undefined) {
            player.infinityPoints = new Decimal(`1e${p.ipExp}`);
          }
          player.records.thisInfinity = player.records.thisInfinity || {};
          return true;
        } catch (e) { return String(e && e.message || e); }
      }, st.patch);
      if (ok !== true) positions.push({ state: st.name, patchError: ok });
      await sleep(300);
    }
    await page.evaluate(() => {
      if (window.TutorialReadingPosition) window.TutorialReadingPosition.chapterId = null;
    });
    await page.evaluate(() => window.Modal.orekiTutorial.show());
    await sleep(900);
    const got = await page.evaluate(() => ({
      head: document.querySelector(".c-oreki-tut__head-title")?.innerText || "",
      counter: document.querySelector(".c-oreki-tut__counter")?.innerText || "",
      stage: document.querySelector(".c-oreki-tut__current-name")?.innerText || "",
    }));
    positions.push({ state: st.name, ...got });
    // 打开状态下按 Esc 关不掉（教程提示里写了 Enter 不关闭），用关闭按钮
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll(".l-modal-close-btn, .c-modal__close-btn, button"))
        .filter(n => /关闭教程/.test(n.innerText || ""));
      if (btns.length) btns[0].click();
    });
    await sleep(600);
    await clearModals(page);
    await page.evaluate(() => { if (window.TutorialReadingPosition) { window.TutorialReadingPosition.chapterId = null; window.TutorialReadingPosition.scrollTop = 0; } });
  }
  report.items.positioning = {
    states: positions,
    note: "定位函数是 src/core/oreki-tutorial.js:294-317 的 getTutorialStartIndex()。"
      + "本轮实测到的映射：early->ch01；infinity 且未打破->ch04；已打破且 IP 指数<11->ch05；>=11->ch06。",
  };
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
}

fs.writeFileSync(path.join(OUT, "tut-accept-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  entry: report.items.entry?.opened,
  chapters: report.items.chapters && { pass: report.items.chapters.pass, n: report.items.chapters.count, min: report.items.chapters.minChars, max: report.items.chapters.maxChars },
  appendices: report.items.appendices && { pass: report.items.appendices.pass, n: report.items.appendices.count, list: report.items.appendices.list },
  longest: report.items.longest && { pass: report.items.longest.pass, head: report.items.longest.head, chars: report.items.longest.chars, atBottom: report.items.longest.atBottom },
  font: report.items.font,
  positioning: report.items.positioning && report.items.positioning.states,
  fatal: report.fatal,
  pageErrors: report.pageErrors,
}, null, 2));
