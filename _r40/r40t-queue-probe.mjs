// 临时探针：只打印队列演化，不做断言
import puppeteer from "puppeteer-core";
const port = Number(process.argv[2] || 8153);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--lang=zh-CN", "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui))) break;
  await new Promise(r => setTimeout(r, 200));
}
const dump = async (tag) => {
  const s = await page.evaluate(() => ({
    cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
    q: window.ui.view.modal.queue.map(m => `${m._component.name}#${m._priority}`),
    tut: !!document.querySelector(".c-oreki-tut"),
    msg: !!document.querySelector(".c-modal-message"),
    title: (document.querySelector(".c-oreki-tut__head-title") || {}).textContent || "",
    msgtext: ((document.querySelector(".c-modal-message__text") || {}).textContent || "").slice(0, 80),
  }));
  console.log(tag, JSON.stringify(s));
};

await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await dump("open   ");
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".c-oreki-tut__nav-btn")].find(x => (x.textContent || "").includes("第 10 章"));
  b && b.click();
});
await new Promise(r => setTimeout(r, 400));
await dump("ch10   ");
await page.evaluate(() => {
  const box = document.querySelector(".c-oreki-tut__scroll");
  box.scrollTop = 420;
  return box.scrollTop;
});
await dump("scroll ");

await page.evaluate(() => window.Modal.message.show("测试消息", {}, 3));
await new Promise(r => setTimeout(r, 600));
await dump("msg on ");

await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-modal-message .o-primary-btn, .c-modal-message button")];
  console.log("clickables:", btns.length);
  if (btns.length) btns[btns.length - 1].click();
});
await new Promise(r => setTimeout(r, 900));
await dump("msg off");

await page.keyboard.press("Escape");
await new Promise(r => setTimeout(r, 700));
await dump("esc    ");

await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 700));
await dump("reopen ");
await browser.close();
