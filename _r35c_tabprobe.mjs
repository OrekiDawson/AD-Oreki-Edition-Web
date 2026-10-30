import fs from "node:fs";
const WS="ws://127.0.0.1:9222/devtools/page/0";let seq=0;const pend=new Map();
const ws=new WebSocket(WS);
const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pend.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}));setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("timeout "+m));}},20000);});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result);}};
await new Promise(r=>{ws.onopen=r;});
const ev=async x=>{const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)return{__error:r.exceptionDetails.exception?.description};return r.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send("Runtime.enable");
const snap=`(() => {
  const rows = Array.from(document.querySelectorAll(".l-tab-btn-inner"))
    .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return rows.map(n => {
    const chain = [];
    let e = n;
    for (let i = 0; i < 4 && e; i++) { chain.push(String(e.className).slice(0, 48)); e = e.parentElement; }
    const r = n.getBoundingClientRect();
    return { text: (n.innerText||"").replace(/\s+/g," ").trim(), chain,
      cx: Math.round(r.x + r.width/2), cy: Math.round(r.y + r.height/2) };
  });
})()`;
const a = await ev(snap);
console.log("BEFORE:");
for (const r of a) console.log(" ", r.text.padEnd(6), JSON.stringify(r.chain));
const target = a.find(r => r.text === "挑战");
console.log("tap 挑战 at", target.cx, target.cy);
const p={x:target.cx,y:target.cy,radiusX:10,radiusY:10,force:1,id:1};
await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});
await sleep(60);
await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
await sleep(900);
const b = await ev(snap);
console.log("AFTER:");
for (const r of b) console.log(" ", r.text.padEnd(6), JSON.stringify(r.chain));
const vis = await ev(`(() => {
  const t = s => (s||"").replace(/\s+/g," ").trim();
  return Array.from(document.querySelectorAll(".o-tab-btn--subtab"))
    .filter(n => { const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; })
    .map(n => t(n.innerText).slice(0, 14));
})()`);
console.log("visible subtabs:", JSON.stringify(vis));
const r=await send("Page.captureScreenshot",{format:"png"});
fs.writeFileSync("_r35c_tab_challenge.png",Buffer.from(r.data,"base64"));
ws.close();process.exit(0);
