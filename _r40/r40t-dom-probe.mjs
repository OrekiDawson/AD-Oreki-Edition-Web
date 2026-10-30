import puppeteer from "puppeteer-core";
const port = 8151;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox","--disable-gpu","--window-size=1280,900","--lang=zh-CN","--no-proxy-server","--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("[pageerror]", e.message));
page.on("console", m => { const t=m.text(); if(!/googletagmanager|Content Security/iu.test(t)) console.log("[console]", t.slice(0,300)); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i=0;i<300;i++){ if(await page.evaluate(()=>!!(window.GameUI&&GameUI.initialized&&window.ui))) break; await new Promise(r=>setTimeout(r,200)); }
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r=>setTimeout(r,1200));
const info = await page.evaluate(() => {
  const overlay = document.querySelector(".l-modal-overlay");
  const cur = window.ui.view.modal.current;
  return {
    queueLen: window.ui.view.modal.queue.length,
    currentName: cur && cur._component && cur._component.name,
    hasOverlay: !!overlay,
    overlayClass: overlay ? overlay.className : null,
    overlayHTML: overlay ? overlay.innerHTML.slice(0, 600) : null,
    tutCount: document.querySelectorAll(".c-oreki-tut").length,
    cModalMessage: document.querySelectorAll(".c-modal-message").length,
    entryBtn: !!document.getElementById("oreki-tutorial-entry"),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
