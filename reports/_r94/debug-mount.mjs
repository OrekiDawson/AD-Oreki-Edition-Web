#!/usr/bin/env node
/** R94 调试：页面挂载状态与控制台异常（不提交）。 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8127, CDP = 9227;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE = path.join(os.tmpdir(), `oreki-r94-dbg-${process.pid}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ["serve.mjs", String(PORT)], { cwd: ROOT, stdio: "ignore" });
const edge = spawn(EDGE, [`--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`,
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });

let cdp = null; const evts = [];
try {
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
      const p = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch { /* wait */ }
    if (!wsUrl) await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pend = new Map();
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    else if (m.method) evts.push(m);
  });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evl = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true }); return r.exceptionDetails ? { err: r.exceptionDetails.text, d: r.exceptionDetails.exception?.description } : r.result.value; };
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  for (const wait of [3000, 6000, 10000, 15000, 20000]) {
    await sleep(wait === 3000 ? 3000 : 5000);
    const st = await evl(`(() => ({
      t: ${wait},
      readyState: document.readyState,
      bodyLen: document.body ? document.body.innerText.length : -1,
      bodyHead: (document.body ? document.body.innerText : '').slice(0, 200),
      hasUi: !!document.querySelector('#ui'),
      hasEntry: !!document.querySelector('#oreki-tutorial-entry'),
      hasPlayer: typeof player !== 'undefined',
      modalTut: (() => { try { return typeof Modal !== 'undefined' && typeof Modal.orekiTutorial; } catch (e) { return 'err:' + e.message; } })(),
      hasVue: typeof Vue !== 'undefined',
    }))()`);
    console.log(JSON.stringify(st));
  }
  const errs = evts.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params?.entry?.level === "error"));
  console.log("异常/错误事件 " + errs.length + " 条：");
  for (const e of errs.slice(0, 8)) console.log(" -", JSON.stringify(e).slice(0, 400));
  ws.close();
} finally {
  try { if (cdp) cdp.ws.close(); } catch { /* ignore */ }
  try { edge.kill(); } catch { /* ignore */ }
  try { server.kill(); } catch { /* ignore */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}
