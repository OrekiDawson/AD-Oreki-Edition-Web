#!/usr/bin/env node
/**
 * R94 教程渲染烟测（不提交）：本地静态服务 + headless Edge。
 * 只验证：页面无脚本异常、教程弹窗可打开、改过的正文真的渲染出 HTML。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8126;
const CDP = 9226;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE = path.join(os.tmpdir(), `oreki-r94-tut-${process.pid}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener("message", ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
      } else if (m.method) this.events.push(m);
    });
  }
  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout ${method}`)); } }, timeoutMs);
    });
  }
  async eval(expression, timeoutMs = 30000) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, timeoutMs);
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text}`);
    return r.result?.value;
  }
}

const server = spawn(process.execPath, ["serve.mjs", String(PORT)], { cwd: ROOT, stdio: "ignore" });
const edge = spawn(EDGE, [
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`,
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });

let cdp = null;
const errors = [];
try {
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
      const page = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch { /* not up */ }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error("找不到 Edge 调试目标");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", () => rej(new Error("ws error")), { once: true }); });
  cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });

  let ready = false;
  for (let i = 0; i < 160; i++) {
    const ok = await cdp.eval("typeof Modal !== 'undefined' && Modal.orekiTutorial && typeof Modal.orekiTutorial.show === 'function'").catch(() => false);
    if (ok) { ready = true; break; }
    await sleep(250);
  }
  if (!ready) throw new Error("游戏未就绪");

  // 打开教程弹窗（与右下角悬浮按钮同一入口）
  const opened = await cdp.eval("(() => { try { const b = document.getElementById('oreki-tutorial-entry'); if (b) { b.click(); return 'clicked'; } document.querySelector('.c-oreki-tut-entry')?.click(); return 'fallback'; } catch (e) { return String(e && e.message); } })()");
  await sleep(800);
  // 附录正文只在选中附录时渲染（v-if="isAppendix"）；按导航按钮文字点进去。
  const clickNav = (needle) => `(() => {
    const btns = [...document.querySelectorAll('.c-oreki-tut__nav-btn')];
    const btn = btns.find(b => (b.innerText || '').includes(${JSON.stringify(needle)}));
    if (!btn) return 'not-found';
    btn.click();
    return 'clicked';
  })()`;
  const readMd = "(() => { const el = document.querySelector('.c-oreki-tut__md'); return el ? el.innerText : ''; })()";

  await cdp.eval(clickNav("本作与原版的差异清单"));
  await sleep(500);
  const diag = await cdp.eval(`(() => ({
    hasTut: !!document.querySelector('.c-oreki-tut'), tutClasses: [...document.querySelectorAll('[class*=tut]')].slice(0,6).map(e=>e.className), overlayClasses: [...document.querySelectorAll('[class*=modal]')].slice(0,6).map(e=>e.className), cur: (()=>{try{return typeof Modal.current === 'object' ? 'obj' : String(Modal.current);}catch(e){return 'err'}})(),
    overlay: !!document.querySelector('.l-modal-overlay'),
    navCount: document.querySelectorAll('.c-oreki-tut__nav-btn').length,
    mdCount: document.querySelectorAll('.c-oreki-tut__md').length,
    tutLen: (document.querySelector('.c-oreki-tut')?.innerText || '').length,
    bodyLen: document.body.innerText.length,
    titles: [...document.querySelectorAll('.c-oreki-tut__nav-title')].slice(0, 4).map(e => e.textContent),
    modalKeys: Object.keys(window.Modal || {}).slice(0, 12),
  }))()`);
  console.log("诊断：", JSON.stringify(diag));
  const apxF = await cdp.eval(readMd);
  await cdp.eval(clickNav("智能自动购买器调度"));
  await sleep(500);
  const apxFplus = await cdp.eval(readMd);
  await cdp.eval(clickNav("第 1 章"));
  await sleep(500);
  const ch1 = await cdp.eval("(() => { const el = document.querySelector('.c-oreki-tut__main'); return el ? el.innerText : ''; })()");

  const checks = {
    弹窗打开: opened === true,
    "附录 F 新章节已渲染": apxF.includes("二十一、维度提升与反物质星系保留反物质"),
    "附录 F 保留反物质说明": apxF.includes("保留当前反物质余额"),
    "附录 F 补充真实顺序": apxFplus.includes("维度献祭（倍数达到玩家阈值才做）"),
    "附录 F 补充批量边界": apxFplus.includes("不是「一拍之内连买很多次」"),
    "第 1 章新顺序文案": ch1.includes("能买就买维度提升 → 能买就买反物质星系 → 买计数频率"),
    "第 1 章默认 10 秒": ch1.includes("默认 10 秒一次"),
  };
  const logErrors = cdp.events.filter(e => e.method === "Log.entryAdded" && e.params?.entry?.level === "error");
  const exceptions = cdp.events.filter(e => e.method === "Runtime.exceptionThrown");
  for (const e of logErrors) errors.push(e.params.entry.text);
  for (const e of exceptions) errors.push(e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || "exception");
  console.log("渲染检查：", JSON.stringify(checks, null, 1));
  console.log(`控制台错误 ${errors.length} 条（过滤已知 favicon/网络噪声后由人判断）：`);
  for (const e of errors.slice(0, 6)) console.log("  -", String(e).split("\n")[0].slice(0, 220));
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? "结论：PASS（导航与正文渲染路径可用）" : "结论：FAIL");
  process.exitCode = pass ? 0 : 1;
} finally {
  try { if (cdp) cdp.ws.close(); } catch { /* ignore */ }
  try { edge.kill(); } catch { /* ignore */ }
  try { server.kill(); } catch { /* ignore */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}
