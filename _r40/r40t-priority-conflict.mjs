// R40-T priority 4 的副作用探针：教程开着时，priority 1 的「确认类」弹窗会怎样
//
// 目的：team-lead 想让报告写「所有 priority ≤ 3 的弹窗都是事后通知而非阻塞询问」。
// 这句话与源码不符（priority 1 恰好是 20 个大坍缩/永恒/现实/删除符文这类确认框），
// 所以这里不验那句话，而是验「真实的后果」到底可不可接受：
//   A. 教程开着时排进一个 priority 1 确认框 → 教程不被顶掉、确认框老实排队；
//   B. 关掉教程 → 确认框补发，选择权回到玩家手里（不是被吞）；
//   C. 教程开着时，屏幕中心点命中的是遮罩/弹窗，不是底层游戏按钮 → 玩家点不出确认框。
import puppeteer from "puppeteer-core";

const port = Number(process.argv[2] || 8153);
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
const pageErrors = [];
page.on("pageerror", e => { pageErrors.push(e.message); console.log("[pageerror]", e.message); });
page.on("console", m => {
  const t = m.text();
  if (/googletagmanager|Content Security/iu.test(t)) return;
  if (m.type() === "error") console.log("[console.error]", t.slice(0, 200));
});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui && window.Modal))) break;
  await new Promise(r => setTimeout(r, 200));
}

// ── 0. 先看 priority 分布：这是「≤3 全是事后通知」这句话的反例本身 ──────
const spread = await page.evaluate(() => {
  const byPrio = {};
  const names = {};
  for (const [key, val] of Object.entries(window.Modal)) {
    if (!(val instanceof window.Modal)) continue;
    const p = val._priority;
    byPrio[p] = (byPrio[p] || 0) + 1;
    (names[p] = names[p] || []).push(key);
  }
  return { byPrio, names };
});
const p1 = spread.names[1] || [];
console.log(`priority 分布：${Object.entries(spread.byPrio).map(([k, v]) => `${k}=${v} 个`).join("，")}`);
console.log(`priority 1 的实例：${p1.join(" / ")}`);
check("priority 1 确实是「确认类」弹窗而不是通知", p1.length >= 10 &&
  ["bigCrunch", "eternity", "reality", "hardReset"].every(k => p1.includes(k)),
  `priority 1 共 ${p1.length} 个，含 ${["bigCrunch", "eternity", "reality", "hardReset"].filter(k => p1.includes(k)).join("/")}`);

// ── 1. 打开教程 ────────────────────────────────────────────────────────
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
const readState = () => page.evaluate(() => ({
  cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
  queue: window.ui.view.modal.queue.map(m => `${m._component.name}#${m._priority}`),
  tutDom: !!document.querySelector(".c-oreki-tut"),
}));
const opened = await readState();
check("教程是 current", opened.cur === "OrekiTutorialModal", `cur=${opened.cur}`);

// ── 2. 【模拟】教程开着时，排一个 priority 1 的确认框（永恒确认）────────
const showed = await page.evaluate(() => {
  try { window.Modal.eternity.show(); return "ok"; } catch (e) { return String(e && e.message); }
});
await new Promise(r => setTimeout(r, 500));
const during = await readState();
check("【模拟】priority 1 确认框排进来后，教程仍是 current 且 DOM 还在",
  during.cur === "OrekiTutorialModal" && during.tutDom === true,
  `show=${showed} cur=${during.cur} queue=${JSON.stringify(during.queue)}`);
check("【模拟】确认框没有被丢弃，仍在队列里等着",
  during.queue.some(q => q.startsWith("EternityModal#1")),
  `queue=${JSON.stringify(during.queue)}`);

// ── 3. 关掉教程 → 确认框补发 ───────────────────────────────────────────
await page.evaluate(() => {
  const btn = document.querySelector(".c-modal__close-btn");
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 700));
const after = await readState();
check("【模拟】关掉教程后确认框补发成 current（没被吞）",
  after.cur === "EternityModal", `cur=${after.cur} queue=${JSON.stringify(after.queue)}`);

// ── 4. 遮挡：教程开着时屏幕中心点不到底层按钮 ──────────────────────────
await page.evaluate(() => { window.Modal.hideAll(); });
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
const hit = await page.evaluate(() => {
  const el = document.elementFromPoint(640, 450);
  if (!el) return { tag: "null", inOverlay: false };
  const overlay = el.closest(".l-modal-overlay, .c-modal, .c-modal-message, .l-modal");
  return {
    tag: `${el.tagName}.${(el.className || "").toString().split(" ").slice(0, 2).join(".")}`,
    inOverlay: !!overlay,
    hasOverlay: !!document.querySelector(".l-modal-overlay"),
  };
});
check("教程开着时屏幕中心命中的是弹窗/遮罩，不是底层游戏按钮",
  hit.inOverlay === true, `elementFromPoint(640,450)=${hit.tag} inOverlay=${hit.inOverlay} overlay存在=${hit.hasOverlay}`);

check("全程无 pageerror", pageErrors.length === 0, `${pageErrors.length} 条`);

await browser.close();
const pass = results.filter(r => r.pass).length;
console.log(`\n合计 ${results.length} 项，通过 ${pass}，失败 ${results.length - pass}`);
process.exit(pass === results.length ? 0 : 1);
