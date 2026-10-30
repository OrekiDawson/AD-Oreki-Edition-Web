import puppeteer from "puppeteer-core";
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await puppeteer.launch({ executablePath: EXE, headless:"new", args:["--no-sandbox","--disable-gpu"], defaultViewport:{width:1280,height:800} });
const p = await b.newPage();
const logs = [];
p.on("console", m => logs.push(m.type()+": "+m.text().slice(0,300)));
p.on("pageerror", e => logs.push("PAGEERROR: "+String(e.message).slice(0,300)));
await p.goto("http://127.0.0.1:8288/index.html", { waitUntil:"domcontentloaded" });
await p.waitForFunction(()=>globalThis.GameUI && GameUI.initialized===true,{timeout:90000}).catch(()=>{});
await new Promise(r=>setTimeout(r,3000));
await p.evaluate(()=>{ globalThis.__snap=[]; const f=()=>{const a=document.querySelector(".l-modal-content--centered");const c=document.querySelector(".c-oreki-tut__layout");const n=document.querySelectorAll(".c-oreki-tut__nav-btn").length;globalThis.__snap.push({t:Date.now(),len:a?a.innerHTML.length:0,layout:!!c,nav:n});}; setInterval(f,200); });
await p.evaluate(()=>{ try{ globalThis.Modal.orekiTutorial.show(); }catch(e){ globalThis.__showErr=String(e&&e.stack); } });
await new Promise(r=>setTimeout(r,3000));
const out = await p.evaluate(()=>({
  err: globalThis.__showErr||null,
  snaps: globalThis.__snap,
  finalLen: (document.querySelector(".l-modal-content--centered")?.innerHTML||"").length,
  head: (document.querySelector(".l-modal-content--centered")?.innerHTML||"").slice(0,600),
  navBtns: document.querySelectorAll(".c-oreki-tut__nav-btn").length,
  chaptersLen: (globalThis.TUTORIAL_CHAPTERS && globalThis.TUTORIAL_CHAPTERS.length) || null,
}));
console.log(JSON.stringify({out, logs: logs.slice(0,20)}, null, 2).slice(0, 4000));
await b.close();
