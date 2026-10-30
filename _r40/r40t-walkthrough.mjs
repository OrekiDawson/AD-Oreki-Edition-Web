// R40T 教程渲染走查：真实浏览器里逐章点开 17 章，桌面 + 360px 窄屏各一遍，截图落盘。
// 只读：不写 player、不改存档、不提交。用法：node r40t-walkthrough.mjs [端口]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] || 8124);
const PAGE_URL = `http://127.0.0.1:${PORT}/index.html`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "shots");
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

fs.mkdirSync(SHOTS, { recursive: true });

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
  if (type === "error" || type === "warning") consoleLog.push({ type, text: msg.text() });
});
page.on("pageerror", err => pageErrors.push(String(err && err.message || err)));
page.on("requestfailed", req => pageErrors.push(`REQFAIL ${req.url()} ${req.failure()?.errorText}`));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function boot() {
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => globalThis.GameUI && globalThis.GameUI.initialized === true,
    { timeout: 90000 }
  ).catch(() => {});
  await sleep(2500);
  // 公告弹窗会反复重开（自动化每秒都在大坍缩，"1 分钟内完成无限" 那类提示会不断触发），
  // 这里在页面内把 message 通道静音掉：只影响本次走查的浏览器上下文，不改仓库代码。
  await page.waitForSelector("#oreki-tutorial-entry", { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    const M = globalThis.Modal;
    if (!M) return;
    if (M.message && typeof M.message.show === "function") {
      M.message.show = () => {};
    }
    try { M.message?.hide?.(); } catch (e) {}
    try { M.current?.hide?.(); } catch (e) {}
  });
  await sleep(600);
  for (let i = 0; i < 6; i++) {
    const stillThere = await page.evaluate(() => {
      const modal = document.querySelector(".l-modal");
      if (!modal) return false;
      const btns = Array.from(modal.querySelectorAll("button"));
      if (btns.length) btns[btns.length - 1].click();
      return true;
    });
    if (!stillThere) break;
    await sleep(400);
  }
  await sleep(300);
}

async function openTutorial() {
  // 已经开着就直接复用（Modal.show() 是 toggle，重复调用会关掉）
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.$(".c-oreki-tut__layout")) return page.$(".c-oreki-tut__layout");
    await page.evaluate(() => {
      const btn = document.getElementById("oreki-tutorial-entry");
      if (btn) btn.click();
    });
    try {
      await page.waitForSelector(".c-oreki-tut__layout", { timeout: 2500 });
      await sleep(350);
      return page.$(".c-oreki-tut__layout");
    } catch (e) {
      await sleep(500);
    }
  }
  const diag = await page.evaluate(() => ({
    gameInit: globalThis.GameUI?.initialized === true,
    btn: Boolean(document.getElementById("oreki-tutorial-entry")),
    modal: Boolean(globalThis.Modal?.orekiTutorial),
    layout: Boolean(document.querySelector(".c-oreki-tut__layout")),
    tut: Boolean(document.querySelector(".c-oreki-tut")),
    modalEl: document.querySelectorAll(".l-modal").length,
    modalText: (document.querySelector(".l-modal") || {innerText: null}).innerText?.replace(/\s+/gu, " ").slice(0, 200) || null,
    bodyLen: document.body.innerHTML.length,
  }));
  console.error("[openTutorial 失败]", JSON.stringify(diag));
  return null;
}

async function closeTutorial() {
  await page.evaluate(() => {
    try { globalThis.Modal?.orekiTutorial?.hide?.(); } catch (e) {}
    try { globalThis.Modal?.current?.hide?.(); } catch (e) {}
  });
  await sleep(300);
}

async function measure() {
  return page.evaluate(() => {
    const q = s => document.querySelector(s);
    const qa = s => Array.from(document.querySelectorAll(s));
    const layout = q(".c-oreki-tut__layout");
    const scroll = q(".c-oreki-tut__scroll");
    const navBtns = qa(".c-oreki-tut__nav-btn");
    const tables = qa(".c-oreki-tut__table");
    const tableOverflow = tables.map(t => ({
      w: Math.round(t.getBoundingClientRect().width),
      sw: t.scrollWidth,
      over: t.scrollWidth - Math.round(t.getBoundingClientRect().width),
    }));
    return {
      navCount: navBtns.length,
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
      blockCount: qa(".c-oreki-tut__block, .c-oreki-tut__current").length,
      textLen: (scroll ? scroll.innerText.replace(/\s+/gu, "").length : 0),
      docScrollW: document.scrollingElement ? document.scrollingElement.scrollWidth : null,
      docClientW: document.scrollingElement ? document.scrollingElement.clientWidth : null,
      scrollBoxW: scroll ? Math.round(scroll.clientWidth) : null,
      scrollBoxSW: scroll ? scroll.scrollWidth : null,
      tableOverflow,
      layoutBox: layout ? (() => { const r = layout.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() : null,
    };
  });
}

async function shootChapter(name, box) {
  const file = path.join(SHOTS, `r40t-${name}.png`);
  if (box) {
    const clip = {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.max(1, Math.floor(box.w)),
      height: Math.max(1, Math.floor(box.h)),
    };
    await page.screenshot({ path: file, clip, type: "png" });
  } else {
    await page.screenshot({ path: file, fullPage: false, type: "png" });
  }
  return path.basename(file);
}

async function runPass(mode, viewport) {
  const out = [];
  await page.setViewport(viewport);
  await sleep(500);
  const layout = await openTutorial();
  if (!layout) {
    out.push({ error: "教程弹窗没能打开", mode });
    return out;
  }
  const first = await measure();
  const total = first.navCount || 17;
  for (let i = 0; i < total; i++) {
    await page.evaluate(idx => {
      const btns = document.querySelectorAll(".c-oreki-tut__nav-btn");
      if (btns[idx]) btns[idx].click();
    }, i);
    await sleep(220);
    const m = await measure();
    const id = (m.headTitle || `idx${i}`).replace(/[^\w\u4e00-\u9fff]+/gu, "-");
    const shot = await shootChapter(`${mode}-${String(i).padStart(2, "0")}`, m.layoutBox);
    out.push({ mode, index: i, shot, ...m });
  }
  return out;
}

await boot();

const report = { url: PAGE_URL, startedAt: new Date().toISOString(), entry: null, desktop: [], narrow: [], h2p: null, console: [], pageErrors: [] };

// 1) 入口按钮存在性
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

// 2) 桌面 1280 走查
report.desktop = await runPass("desk", { width: 1280, height: 800, deviceScaleFactor: 1 });

// 3) 窄屏 360 走查
report.narrow = await runPass("narrow", { width: 360, height: 760, deviceScaleFactor: 1 });

// 4) H2P 页签形态（另一处入口）
await closeTutorial();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await sleep(300);
await page.evaluate(() => { try { globalThis.Modal?.h2p?.show(); } catch (e) {} });
await sleep(900);
const h2pTabs = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".o-h2p-tab-button")).map(n => n.textContent.trim()));
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll(".o-h2p-tab-button"));
  const hit = btns.find(b => b.textContent.includes("Oreki")) || btns[0];
  if (hit) hit.click();
});
await sleep(900);
report.h2p = await page.evaluate(() => {
  const body = document.querySelector(".c-oreki-tut");
  return {
    modalOpen: Boolean(document.querySelector(".l-h2p-modal")),
    tabNames: Array.from(document.querySelectorAll(".o-h2p-tab-button")).map(n => n.textContent.trim()).slice(0, 40),
    tutorialHtmlPresent: Boolean(body),
    detailsCount: document.querySelectorAll(".c-oreki-tut__details").length,
    openDetails: document.querySelectorAll(".c-oreki-tut__details[open]").length,
    firstSummary: (document.querySelector(".c-oreki-tut__summary") || {}).textContent?.trim() || null,
    bodyScrollOverflow: (() => {
      const b = document.querySelector(".l-h2p-body");
      return b ? b.scrollWidth - b.clientWidth : null;
    })(),
  };
});
report.h2pTabNames = h2pTabs;
await page.screenshot({ path: path.join(SHOTS, "r40t-98-h2p.png"), type: "png" });

report.console = consoleLog.slice(0, 200);
report.pageErrors = pageErrors.slice(0, 100);
report.finishedAt = new Date().toISOString();

fs.writeFileSync(path.join(HERE, "r40t-walkthrough.json"), JSON.stringify(report, null, 2), "utf8");
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
