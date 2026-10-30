// R40-T 附录渲染验收（7 篇 + 表格 + 阅读位置）
//
// 断言的是「有内容」而不是「元素存在」——上一轮已经吃过「元素在、内容是空」的亏。
// 每条 PASS 后面都写了「判据写错会怎么误报」，见报告。
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8153);
const LINE = 32;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  return pass;
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN",
    "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", e => {
  pageErrors.push(e.message);
  console.log("[pageerror]", e.message);
});
page.on("console", m => {
  const t = m.text();
  if (/googletagmanager|Content Security/iu.test(t)) return;
  if (m.type() === "error") console.log("[console.error]", t.slice(0, 200));
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
  const md = document.querySelector(".c-oreki-tut__md");
  const apxBtns = [...document.querySelectorAll(".c-oreki-tut__nav-btn--apx")];
  return {
    cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    open: !!document.querySelector(".c-oreki-tut"),
    title: (document.querySelector(".c-oreki-tut__head-title") || {}).textContent || "",
    subtitle: (document.querySelector(".c-oreki-tut__head-subtitle") || {}).textContent || "",
    isAppendix: !!md,
    mdLen: md ? md.innerText.trim().length : 0,
    mdTables: md ? md.querySelectorAll("table").length : 0,
    mdRows: md ? md.querySelectorAll("tbody tr").length : 0,
    scrollTop: box ? Math.round(box.scrollTop) : -1,
    navApx: apxBtns.map(b => (b.textContent || "").trim().replace(/\s+/gu, " ")),
    activeApx: (document.querySelector(".c-oreki-tut__nav-btn--apx.c-oreki-tut__nav-btn--active .c-oreki-tut__nav-title") || {}).textContent || "",
  };
});

const openTutorial = async () => {
  await page.evaluate(() => window.Modal.orekiTutorial.show());
  await new Promise(r => setTimeout(r, 700));
};

const clickApx = async (n) => {
  await page.evaluate((idx) => {
    const btns = [...document.querySelectorAll(".c-oreki-tut__nav-btn--apx")];
    if (btns[idx]) btns[idx].click();
  }, n);
  await new Promise(r => setTimeout(r, 400));
};

const clickChapter = async (id) => {
  await page.evaluate((wanted) => {
    const btn = [...document.querySelectorAll(".c-oreki-tut__nav-btn")].find(b =>
      (b.textContent || "").includes(wanted));
    if (btn) btn.click();
  }, id);
  await new Promise(r => setTimeout(r, 400));
};

const closeByX = async () => {
  await page.evaluate(() => {
    const btn = document.querySelector(".c-modal__close-btn");
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));
};

// ── 1. 目录里 7 篇附录都在 ─────────────────────────────────────────────
await openTutorial();
const opened = await state();
check("目录底部有 7 篇附录入口", opened.navApx.length === 7,
  `实际 ${opened.navApx.length} 条：${opened.navApx.map(t => t.slice(0, 8)).join(" / ")}`);

// ── 2. 逐篇点进去，正文非空 ───────────────────────────────────────────
const perAppendix = [];
for (let i = 0; i < 7; i++) {
  await clickApx(i);
  const s = await state();
  perAppendix.push({ i, title: s.title, len: s.mdLen, tables: s.mdTables, rows: s.mdRows });
  check(`附录 ${i + 1} 点开后正文 > 200 字符`, s.isAppendix && s.mdLen > 200,
    `${s.title} len=${s.mdLen} table=${s.mdTables} rows=${s.mdRows}`);
}

// ── 3. apx_changes 的表格真的渲染出来（15 条差异不能丢行）─────────────
const changesIndex = perAppendix.findIndex(a => a.title.includes("差异"));
const changes = perAppendix[changesIndex];
check("apx_changes 渲染出表格且行数 ≥ 15", changes && changes.tables >= 1 && changes.rows >= 15,
  `table=${changes ? changes.tables : "?"} rows=${changes ? changes.rows : "?"}`);

// ── 4. 附录 D：滚到 500 → 点 × → 重开仍在附录 D、滚动位置保留 ──────────
await clickApx(3);
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  if (box) box.scrollTop = 500;
});
await new Promise(r => setTimeout(r, 400));
const apxD = await state();
check("附录 D 可滚动到 500px", Math.abs(apxD.scrollTop - 500) <= LINE, `scrollTop=${apxD.scrollTop}`);

await closeByX();
const afterCloseApx = await state();
check("点 × 能关闭附录", !afterCloseApx.open, JSON.stringify({ open: afterCloseApx.open, cur: afterCloseApx.cur }));

await openTutorial();
const reopenedApx = await state();
check("重开仍在附录 D（附录是查阅型内容，收起后记得）",
  reopenedApx.isAppendix && reopenedApx.title === apxD.title,
  `实际：${reopenedApx.title || "(章节)"}`);
check("重开后滚动位置保留（±1 行）", Math.abs(reopenedApx.scrollTop - 500) <= LINE,
  `关闭前 ${apxD.scrollTop}px → 重开 ${reopenedApx.scrollTop}px`);

// ── 5. 从附录切回 ch07：附录不能污染章节，且切章后滚动归零 ────────────
await clickChapter("第 7 章");
const backToCh = await state();
check("从附录切回第 7 章", !backToCh.isAppendix && backToCh.title.includes("第 7 章"),
  `实际：${backToCh.title}`);

// 5a. 点 × 关闭后重开：章节的规则是「按当前阶段定位」，不粘在 ch07。
//     注意：这条不能用「标题 == 第 7 章」当判据 —— 新生档自动跑起来后当前阶段可能正好是第 7 章，
//     那样断言会「碰巧通过」。这里改成与该函数返回值比对。
const expectedStageTitle = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  const i = mod.getTutorialStartIndex();
  return mod.TUTORIAL_CHAPTERS[i] ? mod.TUTORIAL_CHAPTERS[i].title : "";
});
await closeByX();
await openTutorial();
const afterChapterClose = await state();
check("章节点 × 关闭后重开按当前阶段定位（不粘附录、也不粘 ch07）",
  !afterChapterClose.isAppendix && afterChapterClose.title === expectedStageTitle,
  `期望「${expectedStageTitle}」，实际「${afterChapterClose.title}」`);

// 5b. 模拟被打断（priority 4 之后真实路径不会被打断）：回到的必须是第 7 章
await page.evaluate(() => { window.Modal.orekiTutorial._priority = 0; });
await page.evaluate(() => window.Modal.message.show("模拟顶掉", {}, 3));
await new Promise(r => setTimeout(r, 700));
const interrupted = await state();
await page.evaluate(() => { window.Modal.orekiTutorial._priority = 4; });
const coveredOk = check("【模拟】教程被消息顶掉", interrupted.cur === "MessageModal" && !interrupted.open,
  `current=${interrupted.cur}`);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  if (btns.length) btns[btns.length - 1].click();
});
await new Promise(r => setTimeout(r, 900));
const afterInterrupt = await state();
if (coveredOk) {
  check("【模拟】被打断回来后仍是第 7 章（附录没污染章节位置）",
    !afterInterrupt.isAppendix && afterInterrupt.title.includes("第 7 章"),
    `实际：${afterInterrupt.title}`);
}

// ── 6. Esc 关闭附录后重开：不粘旧附录、滚动归零 ──────────────────────
await clickApx(3);
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  if (box) box.scrollTop = 500;
});
await new Promise(r => setTimeout(r, 400));
await page.keyboard.press("Escape");
await new Promise(r => setTimeout(r, 600));
const escClosed = await state();
check("按 Esc 能关闭附录", !escClosed.open, JSON.stringify({ open: escClosed.open, cur: escClosed.cur }));

await openTutorial();
const afterEsc = await state();
check("Esc 关闭后重开不粘旧附录（回到章节）", !afterEsc.isAppendix, `实际：${afterEsc.title}`);
check("Esc 关闭后重开滚动归零", afterEsc.scrollTop === 0, `实际 ${afterEsc.scrollTop}px`);

// ── 7. 附录不影响章节进度链：无阶段徽标 ───────────────────────────────
await clickApx(0);
const apxNoDot = await page.evaluate(() => {
  const active = document.querySelector(".c-oreki-tut__nav-btn--apx.c-oreki-tut__nav-btn--active");
  return {
    dots: active ? active.querySelectorAll(".c-oreki-tut__dot").length : -1,
    hasNextBlock: !!document.querySelector(".c-oreki-tut__done"),
  };
});
check("附录不显示阶段徽标、不渲染「完成判据」块", apxNoDot.dots === 0 && !apxNoDot.hasNextBlock,
  JSON.stringify(apxNoDot));

// ── 8. 全程无 pageerror ──────────────────────────────────────────────
check("全程无 pageerror", pageErrors.length === 0, `${pageErrors.length} 条`);

console.log("");
const failed = results.filter(r => !r.pass).length;
console.log(`合计 ${results.length} 项，通过 ${results.length - failed}，失败 ${failed}`);
await browser.close();
process.exit(failed ? 1 : 0);
