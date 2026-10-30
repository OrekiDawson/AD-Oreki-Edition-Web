import puppeteer from "puppeteer-core";
import fs from "node:fs";
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await puppeteer.launch({ executablePath: EXE, headless: "new", args: ["--no-sandbox","--disable-gpu"], defaultViewport:{width:1280,height:800} });
const p = await b.newPage();
await p.goto("http://127.0.0.1:8288/index.html", { waitUntil: "domcontentloaded" });
await p.waitForFunction(() => globalThis.GameUI && GameUI.initialized === true, { timeout: 90000 }).catch(()=>{});
await new Promise(r=>setTimeout(r,2500));
const tpl = await p.evaluate(() => {
  const m = globalThis.Modal?.orekiTutorial;
  return {
    keys: m ? Object.keys(m).slice(0,20) : null,
    name: m && m.name,
    tplHead: m && typeof m.template === "string" ? m.template.slice(0, 400) : (m && m.$options ? String(m.$options.template).slice(0,400) : null),
  };
});
console.log("TPL:", JSON.stringify(tpl, null, 2).slice(0, 1500));
await p.evaluate(() => { try { globalThis.Modal?.orekiTutorial?.show?.(); } catch(e){} });
await new Promise(r=>setTimeout(r,2500));
const html = await p.evaluate(() => (document.querySelector(".l-modal-content--centered")?.outerHTML || document.querySelector(".l-modal")?.outerHTML || ""));
fs.writeFileSync("_r40/_modal.html", html, "utf8");
console.log("len", html.length, "hasLayout", html.includes("__layout"), "hasNavBtn", html.includes("nav-btn"));
await b.close();
