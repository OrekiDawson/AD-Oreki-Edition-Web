const WS="ws://127.0.0.1:9222/devtools/page/0";
let seq=0;const pend=new Map();const ws=new WebSocket(WS);
const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pend.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}));setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("timeout "+m));}},20000);});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result);}};
await new Promise(r=>{ws.onopen=r;});
const ev=async x=>{const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)return {__error:r.exceptionDetails.exception?.description};return r.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send("Runtime.enable");
const before=await ev(`document.querySelectorAll(".l-modal-overlay").length`);
console.log("overlays before:",before);
const box=await ev(`(()=>{const e=document.querySelector(".c-modal-celestial-quote__end");if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width)};})()`);
console.log("end box:",JSON.stringify(box));
if(box){
  const p={x:box.x,y:box.y,radiusX:10,radiusY:10,force:1,id:1};
  await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});
  await sleep(60);
  await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  for(let i=0;i<14;i++){
    await sleep(150);
    const n=await ev(`document.querySelectorAll(".l-modal-overlay").length`);
    console.log(`t+${(i+1)*150}ms overlays=${n}`);
    if(n===0){console.log("CLOSED");break;}
  }
}
const after=await ev(`(()=>{const o=document.querySelector(".l-modal-overlay");
  return {n:document.querySelectorAll(".l-modal-overlay").length,
    cls:o?String(o.firstElementChild?.className||"").slice(0,60):null,
    text:o?(o.innerText||"").replace(/\s+/g," ").trim().slice(0,80):null};})()`);
console.log("after:",JSON.stringify(after));
ws.close();process.exit(0);
