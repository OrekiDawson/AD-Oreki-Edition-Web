#!/usr/bin/env node
/**
 * R94 诊断探针（**不提交**，仅本地取证）：真实游戏 + 桌面 headless Edge，
 * 从全新存档起步，按 250 ms 采样早期阶段计数，回答：
 *   1) 每次 routine 调度拍实际买到几次维度提升 / 星系（批量到底有没有生效）；
 *   2) 献祭（sacrificed）在「有提升的拍」里是否也能发生（顺序是否饿死它）；
 *   3) 首次无限前后的关键数值（maxAM / IP / infinities）。
 *
 * 用法：node serve.mjs 8124   （另开终端）
 *       node reports/_r94/probe-early.mjs --port 8124 --max 420
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "_r94");
const argv = process.argv.slice(2);
const argOf = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt; };
const PORT = Number(argOf("--port", "8124"));
const MAX_SEC = Number(argOf("--max", "420"));
const SAMPLE_MS = Number(argOf("--sample", "250"));
const INTERVAL = argOf("--interval", ""); // 空 = 保持默认
const URL_BASE = `http://127.0.0.1:${PORT}/`;
const EDGE = process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const DEBUG_PORT = Number(argOf("--cdp", "9224"));
const PROFILE = path.join(os.tmpdir(), `oreki-r94-edge-${process.pid}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, timeoutMs);
    });
  }
  async eval(expression, timeoutMs = 30000) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, timeoutMs);
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ""}`);
    return r.result?.value;
  }
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 15000);
  });
  return new Cdp(ws);
}
async function findPageTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error("找不到 Edge 页面调试目标");
}

const SAMPLE_EXPR = `(() => {
  const g = globalThis;
  const exp = (v) => { try { if (v == null) return null; if (typeof v.exponent === "number") return v.exponent; return null; } catch { return null; } };
  const num = (v) => { try { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; } catch { return null; } };
  const p = g.player || {};
  const d = (() => { try { return g.OrekiSmartExecutor && g.OrekiSmartExecutor.debugState ? g.OrekiSmartExecutor.debugState() : null; } catch (e) { return null; } })();
  return {
    t: Math.round((Date.now() - g.__r94T0) / 100) / 100,
    am: exp(p.antimatter),
    boosts: num(p.dimensionBoosts),
    galaxies: num(p.galaxies),
    tick: num(p.totalTickBought),
    sac: exp(p.sacrificed),
    maxAM: exp(p.records && p.records.thisInfinity && p.records.thisInfinity.maxAM),
    etMaxAM: exp(p.records && p.records.thisEternity && p.records.thisEternity.maxAM),
    inf: num(p.infinities),
    ip: exp(p.infinityPoints),
    brk: p.break === true,
    crush: (() => { try { return g.Player ? g.Player.canCrunch === true : null; } catch { return null; } })(),
    speed: (() => { try { return g.GameSpeed ? g.GameSpeed.current : null; } catch { return null; } })(),
    en: d ? d.enabled : null,
    iv: d ? d.intervalSec : null,
    served: d && d.beat ? d.beat.served : null,
    lastBeat: d && d.beat && d.beat.log && d.beat.log.length ? d.beat.log[d.beat.log.length - 1] : null,
    err: d ? d.error : null,
  };
})()`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `early-${Date.now()}.jsonl`);
  const fh = fs.openSync(outPath, "w");

  const server = spawn(process.execPath, ["serve.mjs", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  const edge = spawn(EDGE, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--window-size=1280,800", "about:blank",
  ], { stdio: "ignore" });

  let cdp = null;
  const startedAt = Date.now();
  try {
    await sleep(800);
    const wsUrl = await findPageTarget();
    cdp = await connect(wsUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await cdp.send("Page.navigate", { url: URL_BASE });
    await sleep(1500);
    await cdp.eval("localStorage.clear(); sessionStorage.clear(); 'cleared'");
    if (INTERVAL !== "") {
      await cdp.eval(`localStorage.setItem('oreki.automation.intervalSec', '${INTERVAL}'); 'ok'`);
    }
    await cdp.send("Page.reload", { ignoreCache: true });
    let ready = false;
    for (let i = 0; i < 160; i++) {
      const ok = await cdp.eval("typeof player !== 'undefined' && typeof OrekiSmartExecutor !== 'undefined'").catch(() => false);
      if (ok) { ready = true; break; }
      await sleep(250);
    }
    if (!ready) throw new Error("游戏对象未就绪");
    await cdp.eval("globalThis.__r94T0 = Date.now(); 'ok'");
    console.log(`[R94] 起跑，interval=${INTERVAL || "默认"}，最大 ${MAX_SEC}s，采样 ${SAMPLE_MS}ms -> ${outPath}`);

    let last = null;
    const total = Math.ceil((MAX_SEC * 1000) / SAMPLE_MS);
    for (let i = 0; i < total; i++) {
      await sleep(SAMPLE_MS);
      let s;
      try { s = await cdp.eval(SAMPLE_EXPR); } catch (e) { s = { t: -1, error: String(e.message || e) }; }
      last = s;
      fs.writeSync(fh, JSON.stringify(s) + "\n");
      if (i % 40 === 0) {
        console.log(`  t=${s.t} am=${s.am} boosts=${s.boosts} gal=${s.galaxies} tick=${s.tick} sac=${s.sac} maxAM=${s.maxAM} inf=${s.inf} ip=${s.ip} brk=${s.brk} served=${JSON.stringify(s.served)}`);
      }
    }
    fs.writeFileSync(path.join(OUT_DIR, "early-last.json"), JSON.stringify(last, null, 2), "utf-8");
    console.log("[R94] 结束，末态：" + JSON.stringify(last));
  } finally {
    fs.closeSync(fh);
    try { if (cdp) cdp.ws.close(); } catch { /* ignore */ }
    try { edge.kill(); } catch { /* ignore */ }
    try { server.kill(); } catch { /* ignore */ }
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.writeFileSync(path.join(OUT_DIR, "early-wall.txt"), `started=${new Date(startedAt).toISOString()} wallSec=${(Date.now() - startedAt) / 1000}\n`); } catch { /* ignore */ }
  }
}
main().catch((e) => { console.error("[R94] 探针失败：" + (e && e.stack || e)); process.exit(1); });
