// R40-T 弹窗修复验收：三件事
//  A. 被更高优先级弹窗顶掉后，关掉那条消息，教程要回到**原来的章**（修之前会回到「当前阶段」章）
//  B. 教程打开时按 Enter 不应关闭（修之前 ModalWrapperChoice 把 ENTER_PRESSED 接到 doConfirm）
//  C. 用户主动关闭后再次打开，应回到「当前阶段」定位（阅读位置只用于续读，不粘住）
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8151);
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

const state = () => page.evaluate(() => ({
  cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
  q: window.ui.view.modal.queue.length,
  open: !!document.querySelector(".c-oreki-tut"),
  title: (document.querySelector(".c-oreki-tut__head-title") || {}).textContent || "",
  activeNav: [...document.querySelectorAll(".c-oreki-tut__nav-btn--active .c-oreki-tut__nav-title")]
    .map(e => e.textContent.trim())[0] || "",
}));

// ── 打开并跳到第 10 章 ────────────────────────────────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 600));
const jumped = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-oreki-tut__nav-btn")];
  const target = btns.find(b => (b.textContent || "").includes("第 10 章"));
  if (!target) return { ok: false, titles: btns.slice(0, 3).map(b => b.textContent.trim()) };
  target.click();
  return { ok: true };
});
await new Promise(r => setTimeout(r, 300));
const before = await state();
check("打开并跳到第 10 章", jumped.ok && before.title.includes("第 10 章"), JSON.stringify(before));

// ── 等一个更高优先级弹窗把它顶掉 ──────────────────────────────────────
let covered = false;
for (let i = 0; i < 150; i++) {
  await new Promise(r => setTimeout(r, 200));
  const s = await state();
  if (s.cur === "MessageModal") { covered = true; break; }
}
const during = await state();
check("教程被更高优先级弹窗顶掉（复现原缺陷）", covered,
  `current=${during.cur} 教程DOM=${during.open} 队列=${during.q}`);

// ── 关掉那条消息，看是否回到原来的章 ─────────────────────────────────
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  if (btns.length) btns[btns.length - 1].click();
});
await new Promise(r => setTimeout(r, 800));
const after = await state();
check("关掉消息后教程自动回来", after.open && after.cur === "OrekiTutorialModal", JSON.stringify(after));
check("回来的仍是第 10 章（不是当前阶段章）", after.title.includes("第 10 章"), `实际标题：${after.title}`);

// ── 按 Enter 不应关闭 ────────────────────────────────────────────────
await page.keyboard.press("Enter");
await new Promise(r => setTimeout(r, 500));
const afterEnter = await state();
check("教程打开时按 Enter 不关闭", afterEnter.open && afterEnter.cur === "OrekiTutorialModal",
  JSON.stringify({ cur: afterEnter.cur, open: afterEnter.open }));

// ── 主动关闭 → 再打开应回到当前阶段 ──────────────────────────────────
await page.evaluate(() => {
  const btn = document.querySelector(".c-modal__close-btn");
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 500));
const closed = await state();
check("点 × 能正常关闭", !closed.open && closed.cur !== "OrekiTutorialModal", JSON.stringify(closed));

await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 600));
const reopened = await state();
const expectedStageIndex = await page.evaluate(() => {
  const i = window.OrekiTutorialStartIndex ? window.OrekiTutorialStartIndex() : null;
  return i;
});
check("关闭后再打开回到当前阶段定位（不粘在第 10 章）", reopened.open && !reopened.title.includes("第 10 章"),
  `实际标题：${reopened.title}${expectedStageIndex === null ? "" : ""}`);

console.log("");
const failed = results.filter(r => !r.pass).length;
console.log(`合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`);
await browser.close();
process.exit(failed ? 1 : 0);
