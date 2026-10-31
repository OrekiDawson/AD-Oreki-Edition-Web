// R42 · 侧栏/底栏「按真实进度动态显示」+ 无空页/无重复入口
//
// 两段：
//   A. 全新存档：侧栏应只有真实解锁的项（本 MOD 实测 5 项）
//   B. 注入最高阶段状态后：侧栏应齐全，且每一项点开都有正文（textLen > 阈值），无重名
//
// 只改内存 player，不写存档、不落盘；测试结束浏览器即销毁。
//
// 运行：node _tools/_r42/tabs-scan.mjs _tools/_r42

import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42";
const SERVE_PORT = 8099;
const CDP_PORT = 9345;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const EXPECTED_ALL = ["维度", "自动化", "挑战", "无限", "永恒", "现实", "天神", "成就", "统计数据", "选项"];

const report = { at: new Date().toISOString(), fresh: null, unlocked: null };
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

const readTabs = () => Array.from(document.querySelectorAll(".l-tab-btn-inner"))
  .filter(n => n.getClientRects().length > 0)
  .map(n => (n.innerText || "").replace(/\s+/g, " ").trim());

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await sleep(1500);
  const start = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0)
      .map(n => { const r = n.getBoundingClientRect(); return { t: (n.innerText || "").trim().slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    return c.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.t)) || null;
  });
  if (start) { await page.mouse.click(start.x, start.y); await sleep(2500); }
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length))) break;
    await page.keyboard.press("Escape");
    await sleep(300);
  }

  // A. 新档
  report.fresh = await page.evaluate(readTabs);
  const pFresh = path.join(SHOTS, "r42_tabs_fresh.png");
  await page.screenshot({ path: pFresh });
  report.freshShot = pFresh;

  // B. 注入最高阶段
  const inj = await page.evaluate(() => {
    const out = { ok: true, err: [] };
    try {
      player.auto.autobuyersOn = false;
      player.infinities = 1; player.eternities = 1; player.realities = 1; player.break = true;
      player.infinityPoints = new Decimal("1e400");
      try { Teresa.pouredAmount = 1; } catch (e) { out.err.push("Teresa:" + e.message); }
      player.celestials.pelle.doomed = true;
      try { Achievement(147).unlock(true, true); } catch (e) { out.err.push("ach147:" + e.message); }
    } catch (e) { out.ok = false; out.err.push(String(e && e.message || e)); }
    return out;
  });
  await sleep(2000);
  const names = await page.evaluate(readTabs);

  // 逐项点开，量正文
  const pages = [];
  for (let i = 0; i < names.length; i++) {
    const clicked = await page.evaluate(idx => {
      const inners = Array.from(document.querySelectorAll(".l-tab-btn-inner")).filter(n => n.getClientRects().length > 0);
      const target = inners[idx];
      if (!target) return "no-node";
      // 点击处理器挂在 .l-tab-btn-inner 自己身上（ModernTabButton.js:54），
      // 不是它的父 div；点父节点不会切页。
      target.click();
      return (target.innerText || "").trim();
    }, i);
    await sleep(900);
    const info = await page.evaluate(() => {
      const tab = document.querySelector(".c-game-tab");
      const text = (tab?.innerText || "").replace(/\s+/g, " ").trim();
      return {
        textLen: text.length,
        snippet: text.slice(0, 60),
        empty: text.length === 0,
        scrollH: tab ? tab.scrollHeight : 0,
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    pages.push({ idx: i, name: clicked, ...info });
    if (i === 6) { // 天神页留一张图
      const p = path.join(SHOTS, `r42_tab_${i}_${clicked}.png`);
      await page.screenshot({ path: p });
    }
  }
  const pAll = path.join(SHOTS, "r42_tabs_unlocked.png");
  await page.screenshot({ path: pAll });

  report.unlocked = {
    inject: inj,
    names,
    missing: EXPECTED_ALL.filter(n => !names.includes(n)),
    unexpected: names.filter(n => !EXPECTED_ALL.includes(n)),
    dupes: names.filter((n, i) => names.indexOf(n) !== i),
    pages,
    emptyPages: pages.filter(p => p.empty),
    shot: pAll,
  };
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
}

fs.writeFileSync(path.join(OUT, "tabs-scan-report.json"), JSON.stringify(report, null, 2));
console.log("新档侧栏:", JSON.stringify(report.fresh));
console.log("解锁后侧栏:", JSON.stringify(report.unlocked && report.unlocked.names));
console.log("缺项:", JSON.stringify(report.unlocked && report.unlocked.missing), "多项:", JSON.stringify(report.unlocked && report.unlocked.unexpected), "重复:", JSON.stringify(report.unlocked && report.unlocked.dupes));
console.log("逐页:", JSON.stringify((report.unlocked && report.unlocked.pages || []).map(p => [p.name, p.textLen, p.empty])));
console.log("空页:", JSON.stringify(report.unlocked && report.unlocked.emptyPages));
console.log("fatal:", report.fatal || "none");
