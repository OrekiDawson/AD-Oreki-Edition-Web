// 专项探针：为什么 Modal.orekiTutorial.show() 之后 DOM 里没有教程内容。
// 只读探测，不改游戏状态（最后 hideAll 复原）。
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://127.0.0.1:8123/index.html";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 300)));
page.on("console", m => { if (m.type() === "error") errs.push("console:" + m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction("window.GameUI && window.GameUI.initialized === true", { timeout: 60000 });

const probe = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = { steps: [] };
  const snap = label => {
    const q = window.ui?.view?.modal?.queue ?? [];
    const cur = window.ui?.view?.modal?.current;
    out.steps.push({
      label,
      queueLen: q.length,
      queueNames: q.map(m => m?._component?.name ?? "?"),
      current: cur ? (cur._component?.name ?? "?") : null,
      tutNodes: document.querySelectorAll("[class*='oreki-tut']").length,
      modalNodes: document.querySelectorAll(".l-modal-overlay").length,
    });
  };

  snap("初始");

  try { window.Modal.orekiTutorial.show(); } catch (e) { out.showError = String(e).slice(0, 200); }
  snap("show() 之后立即");
  await sleep(100); snap("+100ms");
  await sleep(400); snap("+500ms");
  await sleep(1000); snap("+1.5s");

  // 直接看组件实例是否存在、data 是否正常
  try {
    const inst = window.Modal.orekiTutorial;
    out.instance = {
      hasComponent: Boolean(inst._component),
      uniqueID: inst._uniqueID,
      priority: inst.priority,
      isOpen: inst.isOpen,
    };
  } catch (e) { out.instance = "throw:" + String(e).slice(0, 150); }

  // 队列里如果是别的 modal 压着，看是谁
  const cur = window.ui?.view?.modal?.current;
  out.currentProps = cur?._props ? Object.keys(cur._props) : null;

  try { window.Modal.hideAll(); } catch (e) { /* 忽略 */ }
  return out;
});

console.log(JSON.stringify({ probe, pageErrors: errs.slice(0, 5) }, null, 1));
await browser.close();
