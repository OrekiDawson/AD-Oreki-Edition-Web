import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root=path.resolve(process.argv[2]||"../AD-Oreki-Edition"); const port=Number(process.argv[3]||8510);
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".json":"application/json",".png":"image/png",".mp3":"audio/mpeg",".ttf":"font/ttf",".ico":"image/x-icon"};
const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]); if(p.endsWith("/"))p+="index.html"; const f=path.resolve(root,"."+p); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404).end();return;} r.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"}); r.end(d); });});
await new Promise(r=>s.listen(port,"127.0.0.1",r));
const pup=(await import("puppeteer-core")).default;
const b=await pup.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:"new",args:["--no-sandbox","--disable-gpu"]});
const p=await b.newPage(); await p.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"load",timeout:60000});
await new Promise(r=>setTimeout(r,7000));
const out=await p.evaluate(()=>{
  const names=["InfinityDimension","InfinityDimensions","InfinityUpgrade","Autobuyer","breakInfinity","gainedInfinityPoints","Player","NormalChallenge"];
  const t={}; for(const n of names) t[n]=typeof globalThis[n];
  let idProbe=null;
  try{ idProbe = typeof InfinityDimensions==="object" ? Object.keys(InfinityDimensions).slice(0,6) : null; }catch(e){ idProbe=String(e); }
  let id1=null;
  try{ const d=InfinityDimension(1); id1={cost:String(d.cost),can:d.canBeBought,avail:d.isAvailableForPurchase,bought:d.bought}; }catch(e){ id1=String(e); }
  return {t,idProbe,id1};
});
console.log(JSON.stringify(out,null,1));
await b.close(); s.close();
