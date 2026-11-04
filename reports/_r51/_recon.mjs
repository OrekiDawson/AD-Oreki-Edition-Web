// R51 探查：开一个视口，把加载后的 DOM 骨架、可见按钮、弹窗都 dump 出来。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 9333;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_GAME = process.argv[2] ?? "http://127.0.0.1:8080/";
const W = Number(process.argv[3] ?? 360);
const H = Number(process.argv[4] ?? 740);

const sleep = ms => new Promise(r => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", e => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description ?? ""));
    return r.result.value;
  }
}

const main = async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "r51-recon-"));
  const proc = spawn(EDGE, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required", "about:blank",
  ], { stdio: "ignore" });
  try {
    let info;
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { info = await r.json(); break; } } catch {}
      await sleep(300);
    }
    if (!info) throw new Error("调试端口没起来");
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    await cdp.send("Page.navigate", { url: URL_GAME });
    await sleep(6000);

    const dump = await cdp.eval(`(() => {
      const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
      const cls = el => (el.className && typeof el.className === "string" ? el.className : "").trim().split(/\\s+/).slice(0,3).join(".");
      const buttons = [...document.querySelectorAll("button, .o-primary-btn, [role=button], input[type=button]")]
        .filter(vis).map(b => { const r = b.getBoundingClientRect();
          return { t: (b.textContent||"").trim().replace(/\\s+/g," ").slice(0,28), c: cls(b), id: b.id||"",
                   x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
      const modals = [...document.querySelectorAll(".l-modal, .c-modal, [class*=modal]")].filter(vis).map(m => ({ c: cls(m), id: m.id||"",
        t: (m.textContent||"").trim().replace(/\\s+/g," ").slice(0,80) }));
      const topLevel = [...document.querySelectorAll("#ui > *, body > *")].filter(vis).map(el => { const r = el.getBoundingClientRect();
        return { tag: el.tagName, c: cls(el), id: el.id||"", x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
      return {
        title: document.title,
        scroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
                  sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight },
        bodyClass: document.body.className,
        uiChildren: document.getElementById("ui") ? document.getElementById("ui").children.length : -1,
        topLevel, buttons, modals,
        errs: (window.errorMessages||[]).slice(0,5),
      };
    })()`);
    console.log(JSON.stringify(dump, null, 1));

    const extra = await cdp.eval(`(() => {
      const rect = el => { const r = el.getBoundingClientRect();
        return { c: (typeof el.className==="string"?el.className:"").split(/\\s+/).slice(0,2).join("."), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const dims = [...document.querySelectorAll(".l-dimensions-container > *")].slice(0,12).map(rect);
      const rows = [...document.querySelectorAll(".l-dimension-row, [class*=dimension-row]")].slice(0,10).map(rect);
      let st = {};
      try { st = { antimatter: String(player.antimatter), dims: player.dimensions.antimatter.map(d=>String(d.amount)),
                  infinityUnlocked: player.break, tab: player.tab, subtab: player.subtab,
                  infinityPoints: String(player.infinityPoints) }; } catch (e) { st = { err: String(e) }; }
      return { dims, rows, st, lsKeys: Object.keys(localStorage) };
    })()`);
    console.log("=== EXTRA ===");
    console.log(JSON.stringify(extra, null, 1));
    ws.close();
  } finally { proc.kill(); }
};
main().catch(e => { console.error("失败：" + e.message); process.exit(1); });
