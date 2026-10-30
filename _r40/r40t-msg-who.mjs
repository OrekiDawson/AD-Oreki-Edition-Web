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
await page.evaluate(() => {
  window.__MSGS__ = [];
  const m = window.Modal.message;
  const orig = m.show.bind(m);
  m.show = function (text, props, prio) {
    window.__MSGS__.push(`@${Math.round(performance.now())}ms prio=${prio} text=${String(text).slice(0, 80)} :: ` +
      new Error().stack.split("\n").slice(2, 8).join(" | "));
    return orig(text, props, prio);
  };
});
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 6000));
const s = await page.evaluate(() => ({
  msgs: window.__MSGS__,
  q: window.ui.view.modal.queue.map(m => (m._component && m._component.name)),
  cur: window.ui.view.modal.current && window.ui.view.modal.current._component.name,
}));
console.log(JSON.stringify(s, null, 2));
await browser.close();
