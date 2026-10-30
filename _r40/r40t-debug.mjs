import puppeteer from "puppeteer-core";
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await puppeteer.launch({ executablePath: EXE, headless: "new", args: ["--no-sandbox", "--disable-gpu"], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(String(e.message)));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:8288/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => globalThis.GameUI && GameUI.initialized === true, { timeout: 90000 }).catch(() => {});
await new Promise(r => setTimeout(r, 2500));

const info = await page.evaluate(() => {
  const out = {};
  out.hasModal = typeof globalThis.Modal;
  out.modalKeys = globalThis.Modal ? Object.keys(globalThis.Modal).slice(0, 40) : null;
  out.hasOrekiTutorial = Boolean(globalThis.Modal?.orekiTutorial);
  out.orekiTutorialType = globalThis.Modal?.orekiTutorial ? typeof globalThis.Modal.orekiTutorial : null;
  // 打开
  try { globalThis.Modal?.orekiTutorial?.show?.(); out.showCalled = true; } catch (e) { out.showErr = String(e && e.message); }
  return out;
});
await new Promise(r => setTimeout(r, 1200));

const after = await page.evaluate(() => ({
  modalDom: document.querySelectorAll(".l-modal").length,
  layout: document.querySelectorAll(".c-oreki-tut__layout").length,
  navBtn: document.querySelectorAll(".c-oreki-tut__nav-btn").length,
  anyTut: document.querySelectorAll("[class*='oreki-tut']").length,
  modalHtml: (document.querySelector(".l-modal")?.outerHTML || "").slice(0, 1200),
  classes: [...document.querySelectorAll("[class*='oreki-tut']")].map(n => n.className),
  modalCurrentName: globalThis.Modal?.current?.$options?.name || globalThis.Modal?.current?.name || null,
}));
console.log(JSON.stringify({ info, after, errs: errs.slice(0, 10) }, null, 2));
await browser.close();
