// 探针：确认 @scroll 是否真的把位置写进 TutorialReadingPosition
import puppeteer from "puppeteer-core";
const port = Number(process.argv[2] || 8153);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--lang=zh-CN", "--no-proxy-server", "--proxy-bypass-list=*"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on("console", m => { if (m.type() === "log") console.log("[page]", m.text()); });
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => !!(window.GameUI && GameUI.initialized && window.ui))) break;
  await new Promise(r => setTimeout(r, 200));
}
await page.evaluate(() => window.Modal.orekiTutorial.show());
await new Promise(r => setTimeout(r, 800));
const r = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  const box = document.querySelector(".c-oreki-tut__scroll");
  const before = mod.TutorialReadingPosition.scrollTop;
  box.scrollTop = 420;
  const immediate = mod.TutorialReadingPosition.scrollTop;
  return { before, immediate, dom: box.scrollTop };
});
console.log("set 之后立刻读:", JSON.stringify(r));
await new Promise(r2 => setTimeout(r2, 800));
const after = await page.evaluate(async () => {
  const mod = await import("/src/core/oreki-tutorial.js");
  const box = document.querySelector(".c-oreki-tut__scroll");
  return { stored: Math.round(mod.TutorialReadingPosition.scrollTop), dom: Math.round(box.scrollTop) };
});
console.log("800ms 后:", JSON.stringify(after));
await browser.close();
