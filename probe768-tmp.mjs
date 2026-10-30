import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml", ".mp3":"audio/mpeg", ".ttf":"font/ttf", ".ico":"image/x-icon" };
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split("?")[0]); if(p.endsWith("/"))p+="index.html"; const f=path.resolve(root,"."+p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404).end();return;} res.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"}); res.end(d); }); });
await new Promise(r=>server.listen(port,"127.0.0.1",r));
const puppeteer=(await import("puppeteer-core")).default;
const browser=await puppeteer.launch({executablePath:EDGE,headless:"new",args:["--no-sandbox","--disable-gpu","--mute-audio"]});
const CANDS={
 "E: notation max-width 100%": `.l-options-grid__notation { max-width: 100%; }`,
 "F: notation width auto+max100": `.l-options-grid__notation { width: auto !important; max-width: 100%; }`,
 "G: E + expanding box container max-width": `.l-options-grid__notation { max-width: 100%; } .l-expanding-control-box__container { max-width: 100%; }`,
};
for(const [label,css] of Object.entries(CANDS)){
 const p2=await browser.newPage();
 await p2.setViewport({width:768,height:900,deviceScaleFactor:1});
 await p2.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"load",timeout:60000});
 for(let i=0;i<100;i++){const ok=await p2.evaluate(()=>{try{return typeof GameUI==="object"&&GameUI.initialized;}catch{return false;}}).catch(()=>false); if(ok)break; await new Promise(r=>setTimeout(r,400));}
 await new Promise(r=>setTimeout(r,1200));
 await p2.addStyleTag({content:css});
 await new Promise(r=>setTimeout(r,300));
 const out=[];
 for(const w of [620,700,768,820,900,1280]){
  await p2.setViewport({width:w,height:900,deviceScaleFactor:1});
  await new Promise(r=>setTimeout(r,450));
  await p2.evaluate(()=>{Modal.hideAll();Tab.options.show(true,Tab.options.visual);});
  await new Promise(r=>setTimeout(r,650));
  const m=await p2.evaluate(()=>{
   const inTicker=el=>!!el.closest(".c-news-ticker, .c-news-line, .l-notification-container");
   const vis=el=>{const cs=getComputedStyle(el);const r=el.getBoundingClientRect();return cs.display!=="none"&&cs.visibility!=="hidden"&&r.width>0&&r.height>0&&!inTicker(el);};
   const over=[...document.querySelectorAll("#ui *")].filter(vis).filter(el=>el.getBoundingClientRect().right>window.innerWidth+1);
   const btn=document.querySelector(".l-options-grid__notation");
   const br=btn?.getBoundingClientRect();
   // 是否被裁掉：按钮右缘是否在可视区域且未被 overflow:hidden 祖先裁掉
   let clipped=false;
   if(btn){let p=btn.parentElement; while(p){const cs=getComputedStyle(p); if(cs.overflow!=="visible"&&cs.overflowX!=="visible"){const pr=p.getBoundingClientRect(); if(br.right>pr.right+1)clipped=true; break;} p=p.parentElement;}}
   return {n:over.length, over:over.map(e=>Math.round(e.getBoundingClientRect().right-window.innerWidth)), btnW:br?Math.round(br.width):null, clipped};
  });
  out.push(`${w}:${m.n}${m.over.length?"["+m.over.join(",")+"]":""}/btn${m.btnW}${m.clipped?"/CLIPPED":""}`);
 }
 console.log(`${label}\n    ${out.join("  ")}`);
 await p2.close();
}
await browser.close();server.close();
