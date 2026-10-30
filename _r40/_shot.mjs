import puppeteer from "puppeteer-core";
const port = 8153;
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--no-sandbox","--disable-gpu","--lang=zh-CN","--no-proxy-server","--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 } });
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.reload({ waitUntil: "load" });
for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui))) break; await new Promise(r => setTimeout(r, 200)); }
await p.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 800));
await p.evaluate(() => { const bs = [...document.querySelectorAll(".c-oreki-tut__nav-btn--apx")]; if (bs[6]) bs[6].click(); });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => { const n = document.querySelector(".c-oreki-tut__nav"); if (n) n.scrollTop = n.scrollHeight; });
await new Promise(r => setTimeout(r, 600));
await p.screenshot({ path: "_apx_nav.png" });
console.log(JSON.stringify(await p.evaluate(() => {
  const t = document.querySelector(".c-oreki-tut__md table");
  const box = document.querySelector(".c-oreki-tut__scroll");
  return { tableW: t ? t.getBoundingClientRect().width : -1, boxW: box ? box.clientWidth : -1,
    contentW: box ? box.scrollWidth : -1, hScroll: box ? box.scrollWidth > box.clientWidth : null };
})));
await b.close();
