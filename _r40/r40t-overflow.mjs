import puppeteer from "puppeteer-core";
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await puppeteer.launch({ executablePath: EXE, headless:"new", args:["--no-sandbox","--disable-gpu"], defaultViewport:{width:360,height:760} });
const p = await b.newPage();
await p.goto("http://127.0.0.1:8288/index.html",{waitUntil:"domcontentloaded"});
await p.waitForFunction(()=>globalThis.GameUI&&GameUI.initialized===true,{timeout:90000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>{ globalThis.__wd=setInterval(()=>{ if(document.querySelector(".c-oreki-tut__layout"))return; const c=document.querySelector(".l-modal-content--centered"); if(!c)return; const btn=c.querySelector(".c-modal__confirm-btn,.c-modal-message__okay-btn,.c-modal__close-btn"); if(btn)btn.click(); },120); });
async function open(){ for(let i=0;i<4;i++){ await p.evaluate(()=>{const x=document.getElementById("oreki-tutorial-entry"); if(x)x.click();}); await new Promise(r=>setTimeout(r,450)); if(await p.evaluate(()=>!!document.querySelector(".c-oreki-tut__layout"))) return true; await p.evaluate(()=>{try{globalThis.Modal.orekiTutorial.show();}catch(e){}}); await new Promise(r=>setTimeout(r,600)); } return false; }
const res = {};
for (const idx of [2,3]) {
  await open();
  await p.evaluate(i=>{const n=document.querySelectorAll(".c-oreki-tut__nav-btn"); if(n[i])n[i].click();}, idx);
  await new Promise(r=>setTimeout(r,300));
  res[idx] = await p.evaluate(()=>{
    const sc=document.querySelector(".c-oreki-tut__scroll");
    const right=sc.getBoundingClientRect().right;
    const out=[];
    for (const el of sc.querySelectorAll("*")) {
      const r=el.getBoundingClientRect();
      if (r.width>0 && r.right>right+0.5) {
        out.push({ tag:el.tagName.toLowerCase(), cls:el.className, w:Math.round(r.width), over:Math.round(r.right-right), text:(el.textContent||"").trim().slice(0,70) });
      }
    }
    // 只保留最外层（父节点不在列表里）
    return { scrollW: sc.clientWidth, scrollSW: sc.scrollWidth, items: out.slice(0,12) };
  });
}
console.log(JSON.stringify(res,null,2).slice(0,3000));
await b.close();
