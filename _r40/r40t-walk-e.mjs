// R40T 教程渲染走查（agent-e）：真实浏览器逐章点开 17 章，桌面 + 360px 各一遍，截图落盘。
// 只读：不写 player、不改存档、不提交。
//
// 关键坑（本轮实测）：游戏自己会不断弹「消息弹窗」（例如「你在 1 分钟内完成了一次无限…」），
// 弹窗是单例队列，只要当前有一个非教程弹窗在，Modal.orekiTutorial.show() 就不会生效，
// 表现为「点了教程按钮没反应、或者抓到的是别的弹窗」。所以每次开教程、每次点章节之前，
// 都要先把挡路的弹窗关掉。
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] || 8288);
const PAGE_URL = `http://127.0.0.1:${PORT}/index.html`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "shots");
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const consoleLog = [];
const pageErrors = [];

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN"],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on("console", msg => {
  const type = msg.type();
  if (type === "error" || type === "warning") consoleLog.push({ type, text: msg.text().slice(0, 400) });
});
page.on("pageerror", err => pageErrors.push(String((err && err.message) || err).slice(0, 400)));
page.on("requestfailed", req => pageErrors.push(`REQFAIL ${req.url()} ${req.failure()?.errorText}`));

async function dismissBlockingModals(maxRounds = 6) {
  for (let i = 0; i < maxRounds; i++) {
    const state = await page.evaluate(() => {
      const centered = document.querySelector(".l-modal-content--centered");
      if (!centered) return "none";
      if (document.querySelector(".c-oreki-tut__layout")) return "tutorial";
      const btn = centered.querySelector(".c-modal__confirm-btn, .c-modal-message__okay-btn, .c-modal__close-btn");
      if (btn) { btn.click(); return "clicked"; }
      try { globalThis.Modal?.current?.hide?.(); } catch (e) { /* ignore */ }
      return "hidden";
    });
    if (state === "none" || state === "tutorial") return state;
    await sleep(260);
  }
  return "still-blocked";
}

async function boot() {
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => globalThis.GameUI && GameUI.initialized === true, { timeout: 90000 }).catch(() => {});
  await sleep(2500);
  await dismissBlockingModals(8);
}

async function openTutorial() {
  await dismissBlockingModals(6);
  const clicked = await page.evaluate(() => {
    const btn = document.getElementById("oreki-tutorial-entry");
    if (!btn) return "no-entry-button";
    btn.click();
    return "clicked";
  });
  await sleep(500);
  let has = await page.$(".c-oreki-tut__layout");
  if (!has) {
    await dismissBlockingModals(4);
    await page.evaluate(() => { try { globalThis.Modal?.orekiTutorial?.show(); } catch (e) { /* ignore */ } });
    await sleep(700);
    has = await page.$(".c-oreki-tut__layout");
  }
  return { clicked, ok: Boolean(has) };
}

async function closeTutorial() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".l-modal button")].find(b => /关闭教程/.test(b.innerText));
    if (btn) btn.click();
    else { try { globalThis.Modal?.orekiTutorial?.hide?.(); } catch (e) { /* ignore */ } }
  });
  await sleep(300);
}

async function measure() {
  return page.evaluate(() => {
    const q = s => document.querySelector(s);
    const qa = s => Array.from(document.querySelectorAll(s));
    const layout = q(".c-oreki-tut__layout");
    const scroll = q(".c-oreki-tut__scroll");
    const tables = qa(".c-oreki-tut__table");
    const tableOverflow = tables.map(t => {
      const r = t.getBoundingClientRect();
      return { w: Math.round(r.width), sw: t.scrollWidth, over: t.scrollWidth - Math.round(r.width) };
    });
    let widest = { text: "", w: 0 };
    for (const c of qa(".c-oreki-tut__table td, .c-oreki-tut__table th")) {
      const w = Math.round(c.getBoundingClientRect().width);
      if (w > widest.w) widest = { text: (c.innerText || "").slice(0, 40), w };
    }
    return {
      navCount: qa(".c-oreki-tut__nav-btn").length,
      headTitle: (q(".c-oreki-tut__head-title") || {}).textContent?.trim() || null,
      subtitle: (q(".c-oreki-tut__head-subtitle") || {}).textContent?.trim() || null,
      labels: qa(".c-oreki-tut__label").map(n => n.textContent.trim()),
      steps: qa(".c-oreki-tut__list li").length,
      autoBadges: qa(".c-oreki-tut__auto").length,
      tables: tables.length,
      tableHeadCells: qa(".c-oreki-tut__table thead th").length,
      tableBodyRows: qa(".c-oreki-tut__table tbody tr").length,
      traps: qa(".c-oreki-tut__trap li").length,
      doneText: (q(".c-oreki-tut__done") || {}).textContent?.trim()?.slice(0, 40) || null,
      hasDraftBar: Boolean(q(".c-oreki-tut__draft")),
      hasLockedBar: Boolean(q(".c-oreki-tut__locked")),
      hasPlaceholder: Boolean(q(".c-oreki-tut__placeholder")),
      placeholderText: (q(".c-oreki-tut__placeholder") || {}).innerText?.replace(/\s+/gu, " ")?.slice(0, 120) || null,
      blockCount: qa(".c-oreki-tut__block, .c-oreki-tut__current").length,
      textLen: scroll ? scroll.innerText.replace(/\s+/gu, "").length : 0,
      scrollBoxW: scroll ? Math.round(scroll.clientWidth) : null,
      scrollBoxSW: scroll ? scroll.scrollWidth : null,
      scrollOver: scroll ? scroll.scrollWidth - Math.round(scroll.clientWidth) : null,
      tableOverflow,
      widestCell: widest,
      // 页面级横向溢出：360px 下如果 > 0，说明有元素把整页撑宽、出现横向滚动条
      pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      layoutBox: layout ? (() => { const r = layout.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() : null,
    };
  });
}

async function shoot(name, box) {
  const file = path.join(SHOTS, `r40t-${name}.png`);
  if (box && box.w > 2 && box.h > 2) {
    await page.screenshot({
      path: file,
      clip: { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)), width: Math.floor(box.w), height: Math.floor(box.h) },
      type: "png",
    });
  } else {
    await page.screenshot({ path: file, type: "png" });
  }
  return path.basename(file);
}

/** 确保教程弹窗处于打开且可交互状态；挡路的游戏消息弹窗先关掉 */
async function ensureTutorial() {
  await dismissBlockingModals(6);
  let present = await page.evaluate(() => Boolean(document.querySelector(".c-oreki-tut__layout")));
  if (!present) {
    await page.evaluate(() => {
      const btn = document.getElementById("oreki-tutorial-entry");
      if (btn) btn.click();
    });
    await sleep(450);
    present = await page.evaluate(() => Boolean(document.querySelector(".c-oreki-tut__layout")));
  }
  if (!present) {
    await page.evaluate(() => { try { globalThis.Modal?.orekiTutorial?.show(); } catch (e) { /* ignore */ } });
    await sleep(650);
    present = await page.evaluate(() => Boolean(document.querySelector(".c-oreki-tut__layout")));
  }
  return present;
}

async function runPass(mode, viewport) {
  const out = [];
  await page.setViewport(viewport);
  await sleep(600);
  const ok0 = await ensureTutorial();
  if (!ok0) {
    out.push({ mode, error: "教程弹窗没能打开" });
    await page.screenshot({ path: path.join(SHOTS, `r40t-${mode}-FAIL.png`), type: "png" });
    return out;
  }
  const first = await measure();
  const total = first.navCount || 17;
  for (let i = 0; i < total; i++) {
    let shotState = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ready = await ensureTutorial();
      if (!ready) {
        shotState = { ok: false, why: "tutorial-missing" };
        continue;
      }
      await page.evaluate(idx => {
        const btns = document.querySelectorAll(".c-oreki-tut__nav-btn");
        if (btns[idx]) btns[idx].click();
      }, i);
      await sleep(200);
      const st = await page.evaluate(idx => {
        const centered = document.querySelector(".l-modal-content--centered");
        const tut = document.querySelector(".c-oreki-tut__layout");
        const head = document.querySelector(".c-oreki-tut__head-title");
        const navs = document.querySelectorAll(".c-oreki-tut__nav-btn");
        return {
          tutorialPresent: Boolean(tut),
          otherModal: Boolean(centered) && !tut,
          headTitle: head ? head.textContent.trim() : null,
          activeIdx: (() => {
            const a = document.querySelector(".c-oreki-tut__nav-btn--active");
            if (!a) return null;
            return Array.prototype.indexOf.call(navs, a);
          })(),
          navCount: navs.length,
        };
      }, i);
      if (st.tutorialPresent && st.activeIdx === i) {
        shotState = { ok: true, st };
        break;
      }
      shotState = { ok: false, why: st.otherModal ? "blocked-by-game-modal" : `wrong-chapter(${st.headTitle}/${st.activeIdx})` };
      await dismissBlockingModals(3);
      await sleep(160);
    }
    const m = await measure();
    const shot = await shoot(`${mode}-${String(i).padStart(2, "0")}`, m.layoutBox);
    out.push({ mode, index: i, shot, attempts: shotState, ...m });
  }
  await closeTutorial();
  return out;
}

await boot();

// 看门狗：游戏会不停弹里程碑消息弹窗，只要教程没开着就把它关掉，避免抢焦点。
// 只点「确定/关闭」按钮，不写任何游戏状态。
await page.evaluate(() => {
  globalThis.__wd = setInterval(() => {
    if (document.querySelector(".c-oreki-tut__layout")) return;
    const c = document.querySelector(".l-modal-content--centered");
    if (!c) return;
    const b = c.querySelector(".c-modal__confirm-btn, .c-modal-message__okay-btn, .c-modal__close-btn");
    if (b) b.click();
  }, 120);
});

const report = { url: PAGE_URL, startedAt: new Date().toISOString(), entry: null, desktop: [], narrow: [], h2p: null, console: [], pageErrors: [] };

report.entry = await page.evaluate(() => {
  const btn = document.getElementById("oreki-tutorial-entry");
  if (!btn) return { exists: false };
  const r = btn.getBoundingClientRect();
  const style = getComputedStyle(btn);
  return {
    exists: true,
    text: btn.innerText.trim(),
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    position: style.position,
    zIndex: style.zIndex,
    visible: r.width > 0 && r.height > 0 && style.display !== "none" && style.visibility !== "hidden",
  };
});
await page.screenshot({ path: path.join(SHOTS, "r40t-00-entry-desktop.png"), type: "png" });

report.desktop = await runPass("desk", { width: 1280, height: 800, deviceScaleFactor: 1 });
report.narrow = await runPass("narrow", { width: 360, height: 760, deviceScaleFactor: 1 });

await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await sleep(300);
await dismissBlockingModals(4);
await page.evaluate(() => { try { globalThis.Modal?.h2p?.show(); } catch (e) { /* ignore */ } });
await sleep(1200);
// H2P 默认停在别的页签，必须点开「新手教程」才看得到教程正文
const h2pTabClicked = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll(".o-h2p-tab-button, .l-h2p-tab-list button")];
  const t = nodes.find(n => /新手教程/.test(n.textContent || ""));
  if (!t) return false;
  t.click();
  return true;
});
await sleep(900);
report.h2p = await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll("[class*='h2p-tab'], [class*='H2P'] button"))
    .map(n => n.textContent.trim()).filter(Boolean).slice(0, 40);
  return {
    modalOpen: Boolean(document.querySelector(".l-modal-content--centered")),
    tabNames: tabs,
    tutorialHtmlPresent: Boolean(document.querySelector(".c-oreki-tut")),
    detailsCount: document.querySelectorAll(".c-oreki-tut__details").length,
    openDetails: document.querySelectorAll(".c-oreki-tut__details[open]").length,
    placeholderCount: document.querySelectorAll(".c-oreki-tut__placeholder").length,
    draftBarCount: document.querySelectorAll(".c-oreki-tut__draft").length,
    tableCount: document.querySelectorAll(".c-oreki-tut__table").length,
    bodyScrollOver: (() => {
      const b = document.querySelector(".l-h2p-body");
      return b ? b.scrollWidth - b.clientWidth : null;
    })(),
  };
});
report.h2p.tabClicked = h2pTabClicked;
await page.screenshot({ path: path.join(SHOTS, "r40t-98-h2p.png"), type: "png" });

report.console = consoleLog.slice(0, 200);
report.pageErrors = pageErrors.slice(0, 100);
report.finishedAt = new Date().toISOString();

fs.writeFileSync(path.join(HERE, "r40t-walkthrough-e.json"), JSON.stringify(report, null, 2), "utf8");
await browser.close();

const sum = r => r.reduce((a, c) => a + (c.error ? 0 : 1), 0);
console.log(JSON.stringify({
  entry: report.entry,
  desktopChapters: sum(report.desktop),
  narrowChapters: sum(report.narrow),
  consoleErrors: report.console.filter(c => c.type === "error").length,
  consoleWarns: report.console.filter(c => c.type === "warning").length,
  pageErrors: report.pageErrors.length,
  h2p: report.h2p,
}, null, 2));
