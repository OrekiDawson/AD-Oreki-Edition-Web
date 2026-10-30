import puppeteer from "puppeteer-core";
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await puppeteer.launch({ executablePath: EXE, headless:"new", args:["--no-sandbox","--disable-gpu"], defaultViewport:{width:360,height:760} });
const p = await b.newPage();
await p.goto("http://127.0.0.1:8288/index.html",{waitUntil:"domcontentloaded"});
await p.waitForFunction(()=>globalThis.GameUI&&GameUI.initialized===true,{timeout:90000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ globalThis.__wd=setInterval(()=>{ if(document.querySelector(".c-oreki-tut__layout"))return; const c=document.querySelector(".l-modal-content--centered"); if(!c)return; const btn=c.querySelector(".c-modal__confirm-btn,.c-modal-message__okay-btn,.c-modal__close-btn"); if(btn)btn.click(); },120); });
for (let i=0;i<4;i++){ await p.evaluate(()=>{const x=document.getElementById("oreki-tutorial-entry"); if(x)x.click();}); await new Promise(r=>setTimeout(r,450)); if(await p.evaluate(()=>!!document.querySelector(".c-oreki-tut__layout"))) break; await p.evaluate(()=>{try{globalThis.Modal.orekiTutorial.show();}catch(e){}}); await new Promise(r=>setTimeout(r,600)); }
await new Promise(r=>setTimeout(r,400));
const out = await p.evaluate(()=>{
  const nav = document.querySelector(".c-oreki-tut__nav");
  const layout = document.querySelector(".c-oreki-tut__layout");
  const main = document.querySelector(".c-oreki-tut__main");
  const navR = nav?.getBoundingClientRect();
  const lastBtn = document.querySelectorAll(".c-oreki-tut__nav-btn");
  const last = lastBtn[lastBtn.length-1]?.getBoundingClientRect();
  return {
    layoutDisplay: layout ? getComputedStyle(layout).display : null,
    layoutFlexDirection: layout ? getComputedStyle(layout).flexDirection : null,
    navBox: navR ? {w:Math.round(navR.width),h:Math.round(navR.height),x:Math.round(navR.x)} : null,
    navScrollW: nav ? nav.scrollWidth : null,
    navOverflowX: nav ? getComputedStyle(nav).overflowX : null,
    navOver: nav ? nav.scrollWidth - nav.clientWidth : null,
    lastBtnVisible: last ? (last.x + last.width <= window.innerWidth) : null,
    lastBtnX: last ? Math.round(last.x) : null,
    mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
    viewport: window.innerWidth,
  };
});
console.log(JSON.stringify(out,null,2));
await p.screenshot({path:"_r40/shots/r40t-nav-360.png"});
await b.close();
