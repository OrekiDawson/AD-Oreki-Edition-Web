// R40-T 第二层验收：滚动位置 + 关闭出口
//  1. 读到某一章中部 → 被更高优先级弹窗顶掉 → 关掉消息 → 回到同一章、**同一行附近**（±1 行）
//  2. 按 Esc 能关闭（Esc 走 hotkeys.js 的 Modal.hideAll，不派发 CLOSE_MODAL）
//  3. 点右上角 × 能关闭
//  4. 主动关闭后再打开，不粘在旧章节、滚动归零
//  5. 底部有「Esc 可关闭」提示行
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8153);
// 一行的高度：font-size 1.25rem × line-height 1.6 = 2rem；浏览器根字号 16px → 32px
const LINE = 32;
const SCROLL_TO = 420;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN",
    "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("[pageerror]", e.message));
page.on("console", m => {
  const t = m.text();
  if (/googletagmanager|Content Security/iu.test(t)) return;
  if (m.type() === "error") console.log("[console.error]", t.slice(0, 300));
});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui))) break;
  await new Promise(r => setTimeout(r, 200));
}

const state = () => page.evaluate(() => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  return {
    cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    q: window.ui.view.modal.queue.length,
    open: !!document.querySelector(".c-oreki-tut"),
    title: (document.querySelector(".c-oreki-tut__head-title") || {}).textContent || "",
    scrollTop: box ? Math.round(box.scrollTop) : -1,
    scrollHeight: box ? box.scrollHeight : -1,
    clientHeight: box ? box.clientHeight : -1,
    hint: (document.querySelector(".c-oreki-tut__hint") || {}).textContent || "",
  };
});

// TutorialReadingPosition 没有挂到 window 上，用动态 import 取同一个模块实例（ESM 按 URL 缓存）
const storedPos = () => page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  return { chapterId: mod.TutorialReadingPosition.chapterId, scrollTop: Math.round(mod.TutorialReadingPosition.scrollTop) };
});

const jumpTo = async (label) => page.evaluate((wanted) => {
  const btns = [...document.querySelectorAll(".c-oreki-tut__nav-btn")];
  const target = btns.find(b => (b.textContent || "").includes(wanted));
  if (!target) return false;
  target.click();
  return true;
}, label);

// 这一版新档会自己跑起来，10 秒左右真的会解锁成就 55（priority 3 的说明会盖住教程）。
// 每次要断言教程本体前先把消息点掉，否则测的是「消息在顶层」这个无关状态。
const drain = async () => {
  for (let i = 0; i < 12; i++) {
    const cur = await page.evaluate(() => window.ui.view.modal.current && window.ui.view.modal.current._component.name);
    if (cur !== "MessageModal") return cur;
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
      if (btns.length) btns[btns.length - 1].click();
    });
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
};

// ── 1. 打开 → 第 10 章 → 滚到 420px ───────────────────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
const jumped = await jumpTo("第 10 章");
await new Promise(r => setTimeout(r, 400));
const scrolled = await page.evaluate((target) => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  if (!box) return { ok: false };
  box.scrollTop = target;
  return { ok: true, top: Math.round(box.scrollTop), h: box.scrollHeight, c: box.clientHeight };
}, SCROLL_TO);
// 等一帧让 scroll 事件落地：玩家是真的滚完再看，不是「赋值 + 立刻弹窗」这种同帧竞态
await new Promise(r => setTimeout(r, 400));
const before = await state();
check("跳到第 10 章并滚动到 420px",
  jumped && before.title.includes("第 10 章") && Math.abs(before.scrollTop - SCROLL_TO) <= LINE,
  `title=${before.title} scrollTop=${before.scrollTop} scrollHeight=${scrolled.h} clientHeight=${scrolled.c}`);
check("内容区确实可滚动（不是内容太短导致的假滚动）",
  scrolled.h - scrolled.c > SCROLL_TO + LINE, `可滚 ${scrolled.h - scrolled.c}px`);

// ── 2. 用与 bigCrunchReset 相同的调用把教程顶掉 ────────────────────────
await page.evaluate(() => window.Modal.message.show("测试：由于你在 1 分钟内完成了一次无限，界面发生了变化。", {}, 3));
await new Promise(r => setTimeout(r, 600));
const during = await state();
const duringStored = await storedPos();
check("教程被 priority 3 的消息顶掉（组件被销毁）",
  during.cur === "MessageModal" && !during.open && during.q === 2,
  `current=${during.cur} 教程DOM=${during.open} 队列=${during.q}`);
check("被顶掉时记下了章节与滚动位置",
  duringStored.chapterId && Math.abs(duringStored.scrollTop - before.scrollTop) <= LINE,
  JSON.stringify(duringStored));

// ── 3. 关掉消息 → 回到同一章、同一行 ─────────────────────────────────
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  if (btns.length) btns[btns.length - 1].click();
});
await new Promise(r => setTimeout(r, 900));
const after = await state();
check("关掉消息后教程自动回来", after.open && after.cur === "OrekiTutorialModal", JSON.stringify({ cur: after.cur, open: after.open }));
check("回来的仍是第 10 章", after.title.includes("第 10 章"), `实际标题：${after.title}`);
check("滚动位置回到同一行附近（±1 行 = ±32px）",
  Math.abs(after.scrollTop - before.scrollTop) <= LINE,
  `打断前 ${before.scrollTop}px → 回来 ${after.scrollTop}px（差 ${after.scrollTop - before.scrollTop}px）`);

// ── 4. 提示行 ────────────────────────────────────────────────────────
check("底部有「Esc 可关闭」提示行", /Esc/.test(after.hint) && /关闭/.test(after.hint), after.hint.trim());

// ── 5. 按 Esc 关闭 ───────────────────────────────────────────────────
await page.keyboard.press("Escape");
await new Promise(r => setTimeout(r, 600));
const escClosed = await state();
check("按 Esc 能关闭教程", !escClosed.open && escClosed.cur !== "OrekiTutorialModal",
  JSON.stringify({ cur: escClosed.cur, open: escClosed.open, q: escClosed.q }));

// ── 6. Esc 关闭后再打开：不粘在旧章节、滚动归零 ───────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await drain();
await new Promise(r => setTimeout(r, 300));
const reopened = await state();
check("Esc 关闭后再打开回到当前阶段定位（不粘在第 10 章）",
  reopened.open && !reopened.title.includes("第 10 章"), `实际标题：${reopened.title}`);
check("Esc 关闭后再打开滚动归零", reopened.scrollTop === 0, `实际 ${reopened.scrollTop}px`);

// ── 7. 再跳第 10 章 → 点 × 关闭 ──────────────────────────────────────
await drain();
await jumpTo("第 10 章");
await new Promise(r => setTimeout(r, 400));
const beforeX = await state();
await page.evaluate(() => {
  const btn = document.querySelector(".c-modal__close-btn");
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 600));
const xClosed = await state();
check("跳到第 10 章后点右上角 × 能关闭",
  beforeX.title.includes("第 10 章") && !xClosed.open && xClosed.cur !== "OrekiTutorialModal",
  JSON.stringify({ 关前: beforeX.title, 关后current: xClosed.cur, 队列: xClosed.q }));

// ── 8. × 关闭后再打开也不粘 ──────────────────────────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await drain();
await new Promise(r => setTimeout(r, 300));
const reopened2 = await state();
check("× 关闭后再打开不粘在第 10 章", reopened2.open && !reopened2.title.includes("第 10 章"), `实际标题：${reopened2.title}`);

console.log("");
const failed = results.filter(r => !r.pass).length;
console.log(`合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`);
await browser.close();
process.exit(failed ? 1 : 0);
