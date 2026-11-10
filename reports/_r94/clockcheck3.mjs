const list = await (await fetch("http://127.0.0.1:9224/json/list")).json();
for (const page of list.filter(t=>t.type==="page")) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, {once:true}));
  let id=0; const pend=new Map();
  ws.addEventListener("message", ev => { const m=JSON.parse(ev.data); if (m.id&&pend.has(m.id)){pend.get(m.id)(m.result); pend.delete(m.id);} });
  const send=(method,params={})=>new Promise(res=>{const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method,params}));});
  const r = await send("Runtime.evaluate",{expression:"JSON.stringify({d:Date.now(), p:performance.now(), t0:globalThis.__r94T0??null, hasPlayer: typeof player!=='undefined'})",returnByValue:true});
  console.log(page.url, "=>", r.result.value);
  ws.close();
}
console.log("node now:", Date.now());
