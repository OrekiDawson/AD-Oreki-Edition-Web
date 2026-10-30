// R40-G 定向验收：教程单源化 + 第 1~6 章正文
//
// 断言面（全部是 DOM / 运行时事实，不看源码文本）：
//   ① 新档能打开教程，目录条数与 JSON 章节数一致；
//   ② 打开时定位到「当前阶段」对应章节（不再固定第 1 章）；
//   ③ ch01~ch06 六章都有正文：阶段目标 / 具体操作 / 自动化配置 / 完成判据 / 下一步 / 关键数值表；
//   ④ 步骤里 auto:true 的条目带「已自动化」徽标，且数量与 JSON 一致；
//   ⑤ ch04 的对照表真的渲染成 <table>；
//   ⑥ 切章把内容区 scrollTop 归零；
//   ⑦ H2P 页签（OrekiTutorial.render）包含同一份正文，且第二次调用命中缓存（不重建字符串）；
//   ⑧ 全程没有未捕获异常 / console error（gtag 被 CSP 拦掉属既有噪声）。
//
// 用法（必须带 patch-launch，否则 Edge 无头启动会 Code: 0 失败）：
//   NODE_OPTIONS="--import=file:///C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/lib/patch-launch.mjs" \
//     node _r40/r40g-tutorial-check.mjs ../AD-Oreki-Edition 8137
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8137);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
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

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9413) });
const { page, errors: pageErrors } = await openGame(browser, { port });

const consoleErrors = [];
page.on("console", m => {
  if (m.type() !== "error") return;
  const text = m.text();
  if (/googletagmanager|Content Security Policy/iu.test(text)) return;
  consoleErrors.push(text);
});

await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
  });
  if (ok) break;
  await new Promise(r => setTimeout(r, 200));
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// 源码侧的期望值（章节数、每章 auto 步骤数、标题）
const expected = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  const chapters = mod.TUTORIAL_CHAPTERS;
  return {
    count: chapters.length,
    titles: chapters.map(c => c.title),
    startIndex: mod.getTutorialStartIndex(),
    stageKey: mod.getTutorialStageSnapshot().key,
    six: chapters.filter(c => ["ch01", "ch02", "ch03", "ch04", "ch05", "ch06"].includes(c.id)).map(c => ({
      id: c.id,
      title: c.title,
      autos: (c.steps || []).filter(s => s.auto).length,
      steps: (c.steps || []).length,
      numbers: (c.numbers || []).length,
      hasTable: Boolean(c.table),
    })),
    schemaVersion: mod.TUTORIAL_SCHEMA_VERSION,
  };
});
console.log(`[ctx] 章节 ${expected.count} 章 / 当前阶段 ${expected.stageKey} / 定位章节下标 ${expected.startIndex}`);

// ① 打开教程
await page.evaluate(() => Modal.orekiTutorial.show());
let opened = false;
for (let i = 0; i < 60; i++) {
  opened = await page.evaluate(() => !!document.querySelector(".c-oreki-tut"));
  if (opened) break;
  await wait(100);
}
check("教程弹窗能打开", opened);

const navCount = await page.$$eval(".c-oreki-tut__nav-btn", els => els.length);
check("目录条数与 JSON 章节数一致", navCount === expected.count, `DOM ${navCount} / JSON ${expected.count}`);

// ② 打开时定位到当前阶段的章节
const activeIndex = await page.$$eval(".c-oreki-tut__nav-btn", els => els.findIndex(el => el.classList.contains("c-oreki-tut__nav-btn--active")));
check("打开时定位到当前阶段对应章节", activeIndex === expected.startIndex, `active=${activeIndex} / 期望 ${expected.startIndex}`);

const headTitle = await page.$eval(".c-oreki-tut__head-title", el => el.textContent.trim());
check("标题与定位章节一致", headTitle === expected.titles[expected.startIndex], `DOM「${headTitle}」`);

// ③④⑤ 六章逐章检查
for (const chapter of expected.six) {
  const index = expected.titles.indexOf(chapter.title);
  await page.evaluate(i => {
    const buttons = document.querySelectorAll(".c-oreki-tut__nav-btn");
    if (buttons[i]) buttons[i].click();
  }, index);
  await wait(150);

  const dom = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".c-oreki-tut__label")].map(el => el.textContent.trim());
    const autoBadges = document.querySelectorAll(".c-oreki-tut__auto").length;
    const numberRows = document.querySelectorAll(".c-oreki-tut__table tbody tr").length;
    const tableCount = document.querySelectorAll(".c-oreki-tut__table").length;
    const stepItems = document.querySelectorAll(".c-oreki-tut__block .c-oreki-tut__list li").length;
    const text = document.querySelector(".c-oreki-tut__scroll")?.textContent.replace(/\s+/gu, " ") || "";
    return { labels, autoBadges, numberRows, tableCount, stepItems, text, title: document.querySelector(".c-oreki-tut__head-title")?.textContent.trim() };
  });

  const need = ["阶段目标", "进入条件", "具体操作", "自动化配置（哪些事不用你做）", "完成判据", "下一步", "关键数值"];
  const missing = need.filter(label => !dom.labels.includes(label));
  check(`${chapter.id} 标题正确`, dom.title === chapter.title, `DOM「${dom.title}」`);
  check(`${chapter.id} 正文七块齐全`, missing.length === 0, missing.length ? `缺少 ${missing.join("、")}` : `${dom.labels.length} 个段落`);
  check(`${chapter.id}「已自动化」徽标数正确`, dom.autoBadges === chapter.autos, `DOM ${dom.autoBadges} / JSON ${chapter.autos}`);
  check(`${chapter.id} 关键数值表有 ${chapter.numbers} 行`, dom.numberRows >= chapter.numbers, `DOM ${dom.numberRows} 行`);
  if (chapter.hasTable) {
    check(`${chapter.id} 对照表渲染成 <table>`, dom.tableCount >= 2, `table 数 ${dom.tableCount}`);
  }
}

// ⑥ 切章 scrollTop 归零
const scrollAfterSwitch = await page.evaluate(async () => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  box.scrollTop = 400;
  const before = box.scrollTop;
  const buttons = document.querySelectorAll(".c-oreki-tut__nav-btn");
  buttons[2].click();
  await new Promise(r => setTimeout(r, 250));
  return { before, after: document.querySelector(".c-oreki-tut__scroll").scrollTop };
});
check("切章后 scrollTop 归零", scrollAfterSwitch.after === 0, `切前 ${scrollAfterSwitch.before} → 切后 ${scrollAfterSwitch.after}`);

// 截图（报告用）
const shot = path.resolve("_r40", "r40g-tutorial-modal.png");
await page.screenshot({ path: shot }).catch(() => { /* ignore */ });

// ⑦ H2P 页签：同一份正文 + 缓存命中
const h2p = await page.evaluate(async () => {
  const mod = await import("/src/components/tutorial/OrekiTutorial.js");
  const t0 = performance.now();
  const first = mod.OrekiTutorial.render();
  const t1 = performance.now();
  const second = mod.OrekiTutorial.render();
  const t2 = performance.now();
  return {
    sameHtml: first === second,
    firstMs: Math.round((t1 - t0) * 100) / 100,
    secondMs: Math.round((t2 - t1) * 100) / 100,
    length: first.length,
    hasChapter6: first.includes("第 6 章"),
    hasAutoBadge: first.includes("已自动化"),
    hasNumbersSrc: first.includes("c-oreki-tut__src"),
  };
});
check("H2P 页签含第 6 章正文", h2p.hasChapter6);
check("H2P 页签含「已自动化」徽标与数值出处", h2p.hasAutoBadge && h2p.hasNumbersSrc);
check("H2P 页签第二次渲染命中缓存（字符串不变）", h2p.sameHtml, `${h2p.length} 字节 · 首次 ${h2p.firstMs}ms / 再次 ${h2p.secondMs}ms`);
check("H2P 页签再次渲染显著更快（缓存生效）", h2p.secondMs < h2p.firstMs, `${h2p.firstMs}ms → ${h2p.secondMs}ms`);

// ⑧ 错误面
const realErrors = [...pageErrors, ...consoleErrors];
check("全程无未捕获异常 / console error", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await cleanup();
server.close();

const failed = results.filter(r => !r.pass);
console.log("");
console.log(`总计 ${results.length} 项：通过 ${results.length - failed.length} / 失败 ${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
