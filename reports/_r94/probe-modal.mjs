import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const ROOT = process.cwd(); const PORT=8128, CDP=9228;
const EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE=path.join(os.tmpdir(),`oreki-r94-m-${process.pid}`);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,["serve.mjs",String(PORT)],{cwd:ROOT,stdio:"ignore"});
const edge=spawn(EDGE,[`--remote-debugging-port=${CDP}`,`--user-data-dir=${PROFILE}`,"--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions","--window-size=1280,900","about:blank"],{stdio:"ignore"});
try {
  let wsUrl=null;
  for(let i=0;i<80&&!wsUrl;i++){ try{ const l=await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); const p=l.find(t=>t.type==="page"&&t.webSocketDebuggerUrl); if(p) wsUrl=p.webSocketDebuggerUrl; }catch{} if(!wsUrl) await sleep(250); }
  const ws=new WebSocket(wsUrl); await new Promise(r=>ws.addEventListener("open",r,{once:true}));
  let id=0; const pend=new Map(); const evts=[];
  ws.addEventListener("message",ev=>{const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}else if(m.method)evts.push(m);});
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const evl=async e=>{const r=await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true,userGesture:true});return r.exceptionDetails?{ERR:r.exceptionDetails.text,D:r.exceptionDetails.exception?.description}:r.result.value;};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate",{url:`http://127.0.0.1:${PORT}/`});
  for(let i=0;i<40;i++){ const ok=await evl("typeof Modal!=='undefined' && !!Modal.orekiTutorial && !!document.getElementById('oreki-tutorial-entry')").catch(()=>false); if(ok) break; await sleep(300); }
  const meta=await evl("(()=>{const m=Modal.orekiTutorial; return {keys:Object.keys(m).slice(0,15), showType:typeof m.show, isOpen:m.isOpen, ctor:Object.getPrototypeOf(m)?.constructor?.name};})()");
  console.log("modal meta:", JSON.stringify(meta));
  const showRes=await evl("(()=>{try{Modal.orekiTutorial.show();return {ok:true};}catch(e){return {err:String(e&&e.message),stack:String(e&&e.stack).slice(0,300)};}})()");
  console.log("show:", JSON.stringify(showRes));
  await sleep(1200);
  const after=await evl("(()=>({cur:Modal.current? (Modal.current.constructor?.name||'obj'):null, ov:[...document.querySelectorAll('[class*=overlay]')].length, tut:!!document.querySelector('.c-oreki-tut'), bodyLen:document.body.innerText.length, hasTutText:document.body.innerText.includes('教程')}))()");
  console.log("after:", JSON.stringify(after));
  const errs=evts.filter(e=>e.method==="Runtime.exceptionThrown"||(e.method==="Log.entryAdded"&&e.params?.entry?.level==="error"));
  console.log("errs:", errs.length);
  for (const e of errs.slice(0,5)) console.log(" -", JSON.stringify(e).slice(0,300));
  ws.close();
} finally { try{edge.kill();}catch{} try{server.kill();}catch{} try{fs.rmSync(PROFILE,{recursive:true,force:true});}catch{} }
