import fs from "node:fs";
const WS="ws://127.0.0.1:9222/devtools/page/0";let seq=0;const pend=new Map();
const ws=new WebSocket(WS);
const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pend.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}));setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("timeout "+m));}},20000);});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result);}};
await new Promise(r=>{ws.onopen=r;});
const ev=async x=>{const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)return{__error:r.exceptionDetails.exception?.description};return r.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tap(x,y){const p={x:Math.round(x),y:Math.round(y),radiusX:10,radiusY:10,force:1,id:1};
  await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});await sleep(50);
  await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await sleep(800);}
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride",{width:360,height:640,deviceScaleFactor:2,mobile:true});
await sleep(1200);
const rows=await ev(`(()=>Array.from(document.querySelectorAll(".l-tab-btn-inner")).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0;}).map(n=>{const r=n.getBoundingClientRect();return{t:(n.innerText||"").replace(/\s+/g," ").trim(),cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2)};}))()`);
const rel=rows.find(r=>r.t==="现实");
console.log("tap 现实 at",JSON.stringify(rel));
await tap(rel.cx,rel.cy);
const geo=await ev(`(()=>{const e=document.querySelector(".c-reality-container");if(!e)return null;
  const r=e.getBoundingClientRect();const cs=getComputedStyle(e);
  const btn=e.querySelector(".l-reality-button");const br=btn?btn.getBoundingClientRect():null;
  return {vw:innerWidth,x:Math.round(r.x),right:Math.round(r.right),w:Math.round(r.width),
    position:cs.position,overflow:cs.overflow,
    btn:br?{x:Math.round(br.x),right:Math.round(br.right),w:Math.round(br.width)}:null,
    btnText:btn?(btn.innerText||"").replace(/\s+/g," ").trim().slice(0,40):null};})()`);
console.log("reality container:",JSON.stringify(geo,null,1));
const sh=await send("Page.captureScreenshot",{format:"png"});
fs.writeFileSync("_r35c_narrow_reality.png",Buffer.from(sh.data,"base64"));
await send("Emulation.clearDeviceMetricsOverride",{}).catch(()=>{});
ws.close();process.exit(0);
