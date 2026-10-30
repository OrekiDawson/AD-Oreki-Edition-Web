// R40-T 第二轮验收：适配「教程 priority 4」之后的现实
//
// 背景：`a5142cf` 把 `Modal.orekiTutorial` 的 priority 从 0 提到 4，
// 而消息弹窗的基础 priority 是 2、全仓没有 ≥4 的其他弹窗 —— 也就是说
// **教程打开期间已经没有任何东西能顶掉它**。所以这个脚本测三件不同的事：
//
//  A. 真实行为：消息弹窗被排到教程后面，教程不消失、章节不跳
//  B. 真实行为：关掉教程后，排队的那条消息立刻补发（回调不丢）
//  C. 模拟行为：把 priority 临时改回 0 复现「被顶掉」，验证章节 + 滚动位置仍能恢复
//
// C 是模拟，报告里必须标明；A/B 是当前代码的真实行为。
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8153);
const LINE = 32; // 1.25rem × line-height 1.6 = 2rem = 32px
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
    q: window.ui.view.modal.queue.map(m => `${m._component.name}#${m._priority}`),
    open: !!document.querySelector(".c-oreki-tut"),
    title: (document.querySelector(".c-oreki-tut__head-title") || {}).textContent || "",
    scrollTop: box ? Math.round(box.scrollTop) : -1,
    hint: (document.querySelector(".c-oreki-tut__hint") || {}).textContent || "",
  };
});

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

const clickMessageOk = () => page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  if (btns.length) btns[btns.length - 1].click();
});

// 新档会自己跑起来，10 秒左右真的解锁成就 55（priority 3 的说明）。
const drain = async () => {
  for (let i = 0; i < 12; i++) {
    const cur = await page.evaluate(() => window.ui.view.modal.current && window.ui.view.modal.current._component.name);
    if (cur !== "MessageModal") return cur;
    await clickMessageOk();
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
};

// ── A. 真实行为：priority 4，消息顶不掉教程 ───────────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
const p4 = await page.evaluate(() => window.Modal.orekiTutorial._priority);
check("教程的 priority 现在是 4（全仓唯一 ≥4 的弹窗）", p4 === 4, `_priority=${p4}`);

await jumpTo("第 10 章");
await new Promise(r => setTimeout(r, 500));
await page.evaluate((target) => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  if (box) box.scrollTop = target;
}, SCROLL_TO);
await new Promise(r => setTimeout(r, 400));
const before = await state();
check("跳到第 10 章并滚动到 420px", before.title.includes("第 10 章") && Math.abs(before.scrollTop - SCROLL_TO) <= LINE,
  `title=${before.title} scrollTop=${before.scrollTop}`);

await page.evaluate(() => window.Modal.message.show("测试：由于你在 1 分钟内完成了一次无限，界面发生了变化。", {}, 3));
await new Promise(r => setTimeout(r, 800));
const during = await state();
check("消息弹窗顶不掉教程（教程仍是 current、DOM 仍在）",
  during.cur === "OrekiTutorialModal" && during.open && during.q.length === 2,
  `current=${during.cur} 队列=${JSON.stringify(during.q)}`);
check("顶不掉的同时章节与滚动位置都没动",
  during.title.includes("第 10 章") && Math.abs(during.scrollTop - before.scrollTop) <= LINE,
  `title=${during.title} scrollTop=${during.scrollTop}`);

// ── B. 真实行为：关掉教程后，排队消息补发 ─────────────────────────────
await page.evaluate(() => {
  const btn = document.querySelector(".c-modal__close-btn");
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 800));
const afterClose = await state();
check("关闭教程后排队的消息立刻补发", afterClose.cur === "MessageModal" && !afterClose.open,
  `current=${afterClose.cur} 队列=${JSON.stringify(afterClose.q)}`);

// 补发的消息文本必须是刚才那条，不能是别的
const msgText = await page.evaluate(() => (document.querySelector(".c-modal-message__text") || {}).textContent || "");
check("补发的是同一条消息（内容没丢、回调没被吞）", msgText.includes("1 分钟内完成了一次无限"), msgText.slice(0, 40));

await clickMessageOk();
await new Promise(r => setTimeout(r, 600));
const stillMine = await page.evaluate(() =>
  ((document.querySelector(".c-modal-message__text") || {}).textContent || "").startsWith("测试："));
check("点掉补发的消息后，测试消息不再出现（之后可能是真成就消息，不算残留）", !stillMine, `测试消息仍在=${stillMine}`);

// ── C. 模拟「被顶掉」：临时把 priority 改回 0，验证章节 + 滚动能恢复 ──
// 先把可能残留的消息清空，否则教程只是排在队列里、根本不会挂载（测不出销毁）
await drain();
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => { window.Modal.orekiTutorial._priority = 0; });
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await jumpTo("第 10 章");
await new Promise(r => setTimeout(r, 500));
await page.evaluate((target) => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  if (box) box.scrollTop = target;
}, SCROLL_TO);
await new Promise(r => setTimeout(r, 400));
const simBefore = await state();

await page.evaluate(() => window.Modal.message.show("模拟顶掉", {}, 3));
await new Promise(r => setTimeout(r, 700));
const simDuring = await state();
const simStored = await storedPos();
await page.evaluate(() => { window.Modal.orekiTutorial._priority = 4; });

check("【模拟】教程被顶掉（组件销毁）",
  simDuring.cur === "MessageModal" && !simDuring.open && simDuring.q.length === 2,
  `current=${simDuring.cur} 队列=${JSON.stringify(simDuring.q)}`);
check("【模拟】被顶掉时记下了章节与滚动位置",
  simStored.chapterId === "ch10" && Math.abs(simStored.scrollTop - simBefore.scrollTop) <= LINE,
  JSON.stringify(simStored));

await clickMessageOk();
await new Promise(r => setTimeout(r, 900));
const simAfter = await state();
check("【模拟】关掉消息后回到第 10 章", simAfter.open && simAfter.title.includes("第 10 章"), `title=${simAfter.title}`);
check("【模拟】滚动位置回到同一行附近（±1 行 = ±32px）",
  Math.abs(simAfter.scrollTop - simBefore.scrollTop) <= LINE,
  `打断前 ${simBefore.scrollTop}px → 回来 ${simAfter.scrollTop}px`);

// ── D. 关闭出口：Esc / × ──────────────────────────────────────────────
check("底部有「Esc 可关闭」提示行", /Esc/.test(simAfter.hint) && /关闭/.test(simAfter.hint), simAfter.hint.trim());

await page.keyboard.press("Escape");
await new Promise(r => setTimeout(r, 600));
const escClosed = await state();
check("按 Esc 能关闭教程", !escClosed.open && escClosed.cur !== "OrekiTutorialModal",
  JSON.stringify({ cur: escClosed.cur, open: escClosed.open, q: escClosed.q }));

await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await drain();
await new Promise(r => setTimeout(r, 300));
const reopened = await state();
check("Esc 关闭后再打开回到当前阶段（不粘在第 10 章）",
  reopened.open && !reopened.title.includes("第 10 章"), `实际标题：${reopened.title}`);
check("Esc 关闭后再打开滚动归零", reopened.scrollTop === 0, `实际 ${reopened.scrollTop}px`);

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
  JSON.stringify({ 关前: beforeX.title, 关后current: xClosed.cur }));

console.log("");
const failed = results.filter(r => !r.pass).length;
console.log(`合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`);
await browser.close();
process.exit(failed ? 1 : 0);
