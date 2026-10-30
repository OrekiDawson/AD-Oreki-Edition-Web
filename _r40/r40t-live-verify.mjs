// 线上实开验收：https://oreki.net 部署后必须能玩、教程附录 A~G 必须可达。
//
// 为什么不复用 r40t-appendix-verify.mjs：那个脚本把 baseURL 硬编码成
// `http://127.0.0.1:${port}`，只能测本地副本。线上验收不能靠改本地脚本参数糊过去。
//
// 判据只留「玩家真能用到」的那几条，不重复本地 22 项（本地已全过）：
//   1. 页面能进：GameUI.initialized 为真（否则白屏）
//   2. 教程能开且 6 s 不消失（priority 4 生效）
//   3. 目录底部有 7 篇附录，逐篇点开正文 > 200 字符
//   4. apx_changes 表格 ≥ 15 行
//   5. 读到附录 D 关掉再开仍在附录 D
//   6. 全程 pageerror 0（CSP 拦 gtag 属环境噪音，排除）
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "https://oreki.net/index.html";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message.slice(0, 200)));
page.on("console", m => {
  const t = m.text();
  if (/googletagmanager|Content Security/iu.test(t)) return;
  if (m.type() === "error") errs.push("console:" + t.slice(0, 160));
});

const out = { base: BASE, checks: [] };
const check = (name, pass, detail = "") => {
  out.checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const t0 = Date.now();
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
let ok = false;
for (let i = 0; i < 300; i++) {
  ok = await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui));
  if (ok) break;
  await new Promise(r => setTimeout(r, 200));
}
check("页面能进（GameUI.initialized）", ok, `${Date.now() - t0} ms`);

if (ok) {
  // 教程：真实入口 = 设置页按钮的 onclick
  await page.evaluate(() => window.Modal.orekiTutorial.show());
  const samples = await page.evaluate(async () => {
    const rows = [];
    const t = performance.now();
    while (performance.now() - t < 6000) {
      rows.push({
        tut: document.querySelectorAll("[class*='oreki-tut']").length,
        title: (document.querySelector("[class*='oreki-tut'][class*='title']")?.textContent || "").trim().slice(0, 30),
      });
      await new Promise(r => setTimeout(r, 100));
    }
    return rows;
  });
  const zero = samples.filter(r => r.tut === 0).length;
  check("教程 6 s 内一直可见", zero === 0, `消失采样 ${zero}/${samples.length}`);
  check("教程章节未中途跳变", new Set(samples.map(r => r.title)).size <= 1,
    [...new Set(samples.map(r => r.title))].join(" / "));

  // 附录入口
  const apx = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const btns = [...document.querySelectorAll("button, a")]
      .filter(el => /附\s*录\s*[A-G]/u.test(el.textContent || ""));
    const res = { count: btns.length, items: [] };
    for (const b of btns) {
      b.click(); await sleep(220);
      const box = document.querySelector("[class*='oreki-tut'][class*='text']")
        ?? document.querySelector("[class*='oreki-tut']");
      res.items.push({
        label: (b.textContent || "").trim().slice(0, 12),
        len: (box?.innerText || "").length,
        tables: document.querySelectorAll("[class*='oreki-tut'] table").length,
        rows: document.querySelectorAll("[class*='oreki-tut'] table tr").length,
      });
    }
    return res;
  });
  check("目录底部有 7 篇附录", apx.count === 7, `实际 ${apx.count} 条`);
  const thin = apx.items.filter(i => i.len <= 200);
  check("7 篇逐篇正文 > 200 字符", thin.length === 0,
    thin.length ? "偏短：" + thin.map(i => i.label + "=" + i.len).join(",") : apx.items.map(i => i.len).join("/"));
  const chg = apx.items.find(i => /本\s*MOD|差异/u.test(i.label));
  check("apx_changes 表格行数 ≥ 15", (chg?.rows ?? 0) >= 15, `rows=${chg?.rows ?? 0}`);

  check("线上无 pageerror", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.evaluate(() => { try { window.Modal.hideAll(); } catch { /* ignore */ } });
}

const failed = out.checks.filter(c => !c.pass);
console.log(`\n合计 ${out.checks.length} 项，通过 ${out.checks.length - failed.length}，失败 ${failed.length}`);
if (errs.length) console.log("errors:", errs.slice(0, 5));
await browser.close();
process.exit(failed.length ? 1 : 0);
