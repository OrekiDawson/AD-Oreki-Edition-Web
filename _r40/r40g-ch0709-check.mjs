// R40-G 补充验收（ch07~ch09）：独立于 edge-launch，直接用 puppeteer.launch 起 Edge。
// 只读：清 localStorage → 新档 → 打开教程 → 逐项断言 → 不改存档、不提交。
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8138);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webm": "video/webm",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
if (process.env.OREKI_NO_SERVER === "1") server.close();
else await new Promise(r => server.listen(port, "127.0.0.1", r));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900", "--lang=zh-CN",
    "--no-proxy-server", "--proxy-bypass-list=*", "--disable-features=NetworkServiceInProcess"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", m => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/googletagmanager|Content Security Policy/iu.test(t)) return;
  consoleErrors.push(t);
});
page.on("pageerror", e => consoleErrors.push("pageerror: " + String(e && e.message || e)));

const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

console.log("URL:", `http://127.0.0.1:${port}/index.html`);
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
console.log("after reload url:", page.url(), "title:", await page.title());
for (let i = 0; i < 300; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof GameUI === "object" && GameUI.initialized && typeof player === "object"; } catch { return false; }
  });
  if (ok) break;
  await wait(200);
}
await wait(2000);

// 关掉开局弹窗
await page.evaluate(() => { try { if (globalThis.Modal?.current) globalThis.Modal.current.hide(); } catch (e) {} });
await wait(400);

// 打开教程（入口按钮）
await page.waitForSelector("#oreki-tutorial-entry", { timeout: 10000 }).catch(() => {});
await page.evaluate(() => { const b = document.getElementById("oreki-tutorial-entry"); if (b) b.click(); });
let opened = false;
for (let i = 0; i < 30; i++) {
  if (await page.$(".c-oreki-tut__layout")) { opened = true; break; }
  await wait(200);
}
check("教程弹窗能打开", opened);

// 目录条数 = JSON 章节数
const meta = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  return { count: mod.TUTORIAL_CHAPTERS.length, ids: mod.TUTORIAL_CHAPTERS.map(c => c.id) };
});
const navCount = await page.evaluate(() => document.querySelectorAll(".c-oreki-tut__nav-btn").length);
check("目录条数与 JSON 章节数一致", navCount === meta.count, `DOM ${navCount} / JSON ${meta.count}`);

// 逐章点开 ch07 / ch08 / ch09，检查七块齐全
// 注意：游戏会在弹出其它 Modal 时把当前 Modal 顶掉（既有行为，与本教程无关），
// 所以每章断言前先确保弹窗在开着，点完立刻读，不给它被顶掉的时间窗。
const ensureOpen = async () => {
  for (let i = 0; i < 6; i++) {
    if (await page.$(".c-oreki-tut__layout")) return true;
    await page.evaluate(() => document.getElementById("oreki-tutorial-entry")?.click());
    await wait(400);
  }
  return !!(await page.$(".c-oreki-tut__layout"));
};
for (const [idx, id] of [[7, "ch07"], [8, "ch08"], [9, "ch09"]]) {
  await ensureOpen();
  const ok = await page.evaluate(i => {
    const items = document.querySelectorAll(".c-oreki-tut__nav-btn");
    if (!items[i]) return false;
    items[i].scrollIntoView({ block: "nearest" });
    items[i].click();
    return true;
  }, idx);
  if (!ok) { check(`${id} 目录可点击`, false); continue; }
  await wait(250);
  const info = await page.evaluate(() => {
    const body = document.querySelector(".c-oreki-tut__scroll");
    const text = body ? body.innerText : "";
    const tables = [...document.querySelectorAll(".c-oreki-tut__table")];
    const withHead = tables.find(t => t.querySelector("thead"));
    return {
      blocks: ["阶段目标", "进入条件", "具体操作", "购买优先级", "自动化配置", "完成判据", "下一步路线", "常见卡点"]
        .filter(label => text.includes(label)),
      auto: document.querySelectorAll(".c-oreki-tut__auto").length,
      rows: withHead ? withHead.querySelectorAll("tbody tr").length : 0,
      nums: document.querySelectorAll(".c-oreki-tut__src").length,
      len: text.length,
      title: (document.querySelector(".c-oreki-tut__head-title") || {}).innerText || "",
    };
  });
  check(`${id} 七个必备标签块齐全（挑战攻略为 null 时不渲染）`, info.blocks.length >= 7, `${info.blocks.length}/8，标题「${info.title}」，正文 ${info.len} 字`);
  check(`${id} 有「已自动化」徽标`, info.auto > 0, `${info.auto} 个`);
  check(`${id} 对照表已渲染成真表格`, info.rows > 0, `${info.rows} 行`);
  check(`${id} 关键数值带出处`, info.nums > 0, `${info.nums} 条`);
}

// ch09 表格应有 12 行
await page.evaluate(() => document.querySelectorAll(".c-oreki-tut__nav-btn")[9]?.click());
await wait(800);
const ecRows = await page.evaluate(() => {
  const tables = [...document.querySelectorAll(".c-oreki-tut__table")];
  const withHead = tables.find(t => t.querySelector("thead"));
  return withHead ? withHead.querySelectorAll("tbody tr").length : 0;
});
check("ch09 EC 对照表 12 行", ecRows === 12, `${ecRows} 行`);

// 切章 scrollTop 归零
const scrollOk = await page.evaluate(async () => {
  const body = document.querySelector(".c-oreki-tut__scroll");
  if (!body) return false;
  body.scrollTop = 400;
  const before = body.scrollTop;
  document.querySelectorAll(".c-oreki-tut__nav-btn")[3]?.click();
  await new Promise(r => setTimeout(r, 300));
  const after = document.querySelector(".c-oreki-tut__scroll").scrollTop;
  return before > 0 && after === 0;
});
check("切章后内容区 scrollTop 归零", scrollOk);

check("全程无 console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

const failed = results.filter(r => !r.pass);
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
