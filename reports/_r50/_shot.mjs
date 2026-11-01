// R50-TUT-01 教程截图：用 headless Edge + CDP 打开真实游戏页面，点开教程弹窗，逐页截屏。
//
// 为什么不用现成截图工具：本机没有 playwright/puppeteer，而 .NET 截屏被安全策略拦掉。
// Edge 自带 --headless=new 与 --remote-debugging-port，Node 22 自带 WebSocket，
// 两者拼起来就能在**真实页面**上取图，不用另装依赖。
//
// 用法：node reports/_r50/_shot.mjs
// 产物：reports/_r50/shots/*.png

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "_r50", "shots");
const URL_GAME = process.argv[2] ?? "http://localhost:8080/";
const PORT = 9333;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForEndpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      // 还没起来
    }
    await sleep(300);
  }
  throw new Error("Edge 调试端口没起来");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", event => {
      const msg = JSON.parse(event.data);
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

  async eval(expr, awaitPromise = true) {
    const result = await this.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(`页面脚本失败：${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ""}`);
    return result.result.value;
  }
}

async function shoot(cdp, name, clip) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  const file = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  截图 ${path.relative(ROOT, file)}`);
}

const NEXT = `(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "下一章");
  if (!btn) return false;
  btn.click();
  return true;
})()`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "r50-shot-"));
  console.log(`启动 headless Edge（profile ${profile}）`);
  const proc = spawn(EDGE, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1120,1500",
    "--hide-scrollbars",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForEndpoint();
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === "page");
    if (!page) throw new Error("找不到页面 target");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1120, height: 1500, deviceScaleFactor: 1, mobile: false });

    console.log(`打开 ${URL_GAME}`);
    await cdp.send("Page.navigate", { url: URL_GAME });
    await sleep(4000);

    // 等游戏主界面出现
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`Boolean(document.querySelector(".c-oreki-tut-open, #tutorial-button, body"))`);
      if (ready) break;
      await sleep(500);
    }

    // 点开教程（页面还没稳定时点击会被吞，所以重试到弹窗真的出现为止）
    let hasModal = false;
    for (let attempt = 0; attempt < 6 && !hasModal; attempt++) {
      const opened = await cdp.eval(`(() => {
        const nodes = [...document.querySelectorAll("*")].filter(n => n.children.length === 0);
        const hit = nodes.find(n => n.textContent.includes("打开 Oreki 中文教程"));
        if (!hit) return "no-button";
        (hit.closest("button, a, [role=button]") ?? hit).click();
        return "clicked";
      })()`);
      await sleep(1500);
      hasModal = await cdp.eval(`Boolean(document.querySelector(".c-oreki-tut"))`);
      console.log(`教程按钮：${opened}，弹窗：${hasModal ? "已打开" : "未出现"}`);
    }
    if (!hasModal) throw new Error("教程没打开，后面没法截图");
    await sleep(800);

    // 弹窗是分页的，从当前章一路「下一章」翻到目标章
    const goTo = async index => {
      // 先回到第 1 章：点「上一章」直到点不动
      for (let i = 0; i < 40; i++) {
        const moved = await cdp.eval(`(() => {
          const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "上一章");
          if (!btn || btn.disabled) return false;
          btn.click();
          return true;
        })()`);
        if (!moved) break;
        await sleep(120);
      }
      for (let i = 0; i < index; i++) {
        await cdp.eval(NEXT);
        await sleep(150);
      }
      const title = await cdp.eval(`document.querySelector(".c-oreki-tut h1, .c-oreki-tut__title")?.textContent?.trim() ?? ""`);
      return title;
    };

    const scrollBody = async top => cdp.eval(`(() => {
      const box = [...document.querySelectorAll(".c-oreki-tut *")].find(n => n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== "visible");
      if (!box) return null;
      box.scrollTop = ${top};
      return { h: box.scrollHeight, c: box.clientHeight, top: box.scrollTop };
    })()`);

    // 附录不在「下一章」的翻页链里，得点左下导航里的那一项
    const goAppendix = async name => cdp.eval(`(() => {
      const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes(${JSON.stringify(name)}));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);

    const targets = [
      { index: 7, name: "ch07_01_top", scroll: 0 },
      { index: 7, name: "ch07_02_body", scroll: 520 },
      { index: 12, name: "ch12_01_top", scroll: 0 },
      { index: 12, name: "ch12_02_body", scroll: 420 },
      { index: 12, name: "ch12_03_body", scroll: 900 },
      { index: 12, name: "ch12_04_body", scroll: 1400 },
      { index: 14, name: "ch14_v_01_top", scroll: 0 },
      { index: 14, name: "ch14_v_02_body", scroll: 520 },
      { index: 17, name: "ch17_01_achieve", scroll: 0 },
      { index: 17, name: "ch17_02_achieve", scroll: 600 },
      { appendix: "附录 A", name: "apxA_01_term", scroll: 0 },
      { appendix: "附录 A", name: "apxA_02_term", scroll: 520 },
    ];

    let current = null;
    for (const target of targets) {
      const key = target.appendix ?? target.index;
      if (key !== current) {
        if (target.appendix) {
          const ok = await goAppendix(target.appendix);
          console.log(`跳到 ${target.appendix}：${ok ? "成功" : "没找到导航项"}`);
          current = key;
          await sleep(400);
        } else {
          const title = await goTo(target.index);
          console.log(`第 ${target.index} 页：${title}`);
          current = key;
          await sleep(300);
        }
      }
      await scrollBody(target.scroll);
      await sleep(250);
      await shoot(cdp, target.name);
    }

    ws.close();
  } finally {
    proc.kill();
  }
}

main().catch(err => {
  console.error(`失败：${err.message}`);
  process.exit(1);
});
