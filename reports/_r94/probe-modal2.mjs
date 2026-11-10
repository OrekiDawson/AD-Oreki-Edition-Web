import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const ROOT = process.cwd(); const PORT=8129, CDP=9229;
const EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE=path.join(os.tmpdir(),`oreki-r94-q-${process.pid}`);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,["serve.mjs",String(PORT)],{cwd:ROOT,stdio:"ignore"});
const edge=spawn(EDGE,[`--remote-debugging-port=${CDP}`,`--user-data-dir=${PROFILE}`,"--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions","--window-size=1280,900","about:blank"],{stdio:"ignore"});
try {
  let wsUrl=null;
  for(let i=0;i<80&&!wsUrl;i++){ try{ const l=await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); const p=l.find(t=>t.type==="page"&&t.webSocketDebuggerUrl); if(p) wsUrl=p.webSocketDebuggerUrl; }catch{} if(!wsUrl) await sleep(250); }
  const ws=new WebSocket(wsUrl); await new Promise(r=>ws.addEventListener("open",r,{once:true}));
  let id=0; const pend=new Map();
  ws.addEventListener("message",ev=>{const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const evl=async e=>{const r=await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true,userGesture:true});return r.exceptionDetails?{ERR:r.exceptionDetails.text,D:r.exceptionDetails.exception?.description}:r.result.value;};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate",{url:`http://127.0.0.1:${PORT}/`});
  let ready=false;
  for(let i=0;i<120;i++){ const ok=await evl("typeof GameUI!=='undefined' && GameUI.initialized === true").catch(()=>false); if(ok){ready=true;break;} await sleep(500); }
  console.log("GameUI.initialized ready =", ready);
  const clickRes=await evl("(()=>{const b=document.getElementById('oreki-tutorial-entry'); if(!b) return 'no-button'; b.click(); return 'clicked';})()");
  await sleep(1500);
  const st=await evl("(()=>({clicked:'"+clickRes+"', tut:!!document.querySelector('.c-oreki-tut'), nav:document.querySelectorAll('.c-oreki-tut__nav-btn').length, md:document.querySelectorAll('.c-oreki-tut__md').length}))()");
  console.log("after click:", JSON.stringify(st));
  const apx=await evl(`(()=>{const btns=[...document.querySelectorAll('.c-oreki-tut__nav-btn')]; const b=btns.find(x=>(x.innerText||'').includes('本作与原版的差异清单')); if(!b) return 'nav-missing'; b.click(); return 'ok';})()`);
  await sleep(800);
  const apxF=await evl("(()=>{const el=document.querySelector('.c-oreki-tut__md'); return el?el.innerText:'';})()");
  console.log("apx click:", apx, "len:", apxF.length);
  console.log("含新章节:", apxF.includes('二十一、维度提升与反物质星系保留反物质'));
  console.log("含保留反物质表:", apxF.includes('保留当前反物质余额'));
  const apx2=await evl(`(()=>{const btns=[...document.querySelectorAll('.c-oreki-tut__nav-btn')]; const b=btns.find(x=>(x.innerText||'').includes('智能自动购买器调度')); if(!b) return 'nav-missing'; b.click(); return 'ok';})()`);
  await sleep(800);
  const apxFplus=await evl("(()=>{const el=document.querySelector('.c-oreki-tut__md'); return el?el.innerText:'';})()");
  console.log("F+ click:", apx2, "含献祭顺序:", apxFplus.includes('维度献祭（倍数达到玩家阈值才做）'), "含批量边界:", apxFplus.includes('不是「一拍之内连买很多次」'));
  const ch=await evl(`(()=>{const btns=[...document.querySelectorAll('.c-oreki-tut__nav-btn')]; const b=btns.find(x=>(x.innerText||'').includes('第 1 章')); if(!b) return 'nav-missing'; b.click(); return 'ok';})()`);
  await sleep(800);
  const chText=await evl("(()=>{const el=document.querySelector('.c-oreki-tut__main'); return el?el.innerText:'';})()");
  console.log("ch1 click:", ch, "含新顺序:", chText.includes('能买就买维度提升 → 能买就买反物质星系 → 买计数频率'), "含默认10秒:", chText.includes('默认 10 秒一次'));
  ws.close();
} finally { try{edge.kill();}catch{} try{server.kill();}catch{} try{fs.rmSync(PROFILE,{recursive:true,force:true});}catch{} }
