import puppeteer from "puppeteer-core";
const port = Number(process.argv[2] || 8151);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox","--disable-gpu","--window-size=1280,900","--lang=zh-CN","--no-proxy-server","--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i=0;i<300;i++){ if(await page.evaluate(()=>!!(window.GameUI&&GameUI.initialized&&window.ui))) break; await new Promise(r=>setTimeout(r,200)); }
await page.evaluate(() => window.Modal.orekiTutorial.show());
// 等到被 MessageModal 顶掉
for (let i=0;i<60;i++){ await new Promise(r=>setTimeout(r,200));
  const cur = await page.evaluate(()=>window.ui.view.modal.current && window.ui.view.modal.current._component.name);
  if (cur === "MessageModal") break; }
console.log("before click:", await page.evaluate(()=>JSON.stringify({
  q: window.ui.view.modal.queue.map(m=>m._component.name),
  cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
  dom: !!document.querySelector(".c-oreki-tut") })));
// 点消息弹窗的确认按钮（模拟玩家关掉成就说明）
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  if (!btns.length) return "no-btn";
  btns[btns.length-1].click();
  return btns.map(b=>b.textContent.trim()).join("|");
});
console.log("clicked buttons:", clicked);
await new Promise(r=>setTimeout(r,800));
console.log("after click:", await page.evaluate(()=>JSON.stringify({
  q: window.ui.view.modal.queue.map(m=>m._component.name),
  cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
  dom: !!document.querySelector(".c-oreki-tut") })));
await browser.close();
