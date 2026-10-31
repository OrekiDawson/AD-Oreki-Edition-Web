// [R40-S4b] 验 `checkForUpdates` 修复：路径是否指对、pageErrors 是否归零、更新提示是否真能弹。
//
// 两个模式（分开跑，别混）：
//   node r40s4b-version-fix-check.mjs local 150   # 本地起静态服务，用 LAN IP 打开（避开 isLocalEnvironment 短路）
//   node r40s4b-version-fix-check.mjs live        # 线上 https://oreki.net，只验路径能不能 200，不假装验证已部署的修复
//
// 为什么本地要用 LAN IP：`isLocalEnvironment()` 见 localhost/127.0.0.1 就 return，
// 用 127.0.0.1 打开等于**根本没跑 checkForUpdates**，测了也是空测。
// 为什么不用 serve.mjs：它 `listen(PORT, "127.0.0.1")`，LAN IP 连不上；这里自带静态服务，
// 只用于测试，不改仓库里的 serve.mjs。
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const MODE = process.argv[2] || "local";
const SEC = Number(process.argv[3]) || 150;
const PORT = 8098;
const LAN_IP = "192.168.1.58";
const REPO = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const log = (...a) => console.log(...a);

function waitHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(url, res => { res.resume(); resolve(true); })
        .on("error", () => {
          if (Date.now() > deadline) reject(new Error(`本地服务未起来: ${url}`));
          else setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

let server = null;
if (MODE === "local") {
  server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(REPO, "." + rel);
    if (!file.startsWith(path.resolve(REPO))) { res.writeHead(403).end("Forbidden"); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end("404"); return; }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, "0.0.0.0", r));
  await waitHttp(`http://${LAN_IP}:${PORT}/index.html`);
  log(`[serve] http://${LAN_IP}:${PORT}/ 已就绪（root=${REPO}）`);
}

const target = MODE === "local"
  ? { url: `http://${LAN_IP}`, port: PORT, waitMs: 60000 }
  : { url: "https://oreki.net", port: 443, waitMs: 90000 };

const { browser, cleanup } = await launchBrowser({ port: MODE === "local" ? 9397 : 9398 });
const { page, errors } = await openGame(browser, target);
const tStart = Date.now();
const notFound = [];
const versionHits = [];
page.on("response", r => {
  const u = r.url();
  if (r.status() === 404) notFound.push(u);
  // 只记 version.txt 的实际请求：这是「checkForUpdates 真的跑了、而且请求的是哪个 URL」的铁证
  if (/version\.txt/i.test(u)) versionHits.push({ t: +((Date.now() - tStart) / 1000).toFixed(1), url: u, status: r.status() });
});

// 等游戏真正跑起来（Modal 已初始化、GameUI 已完成初始化）
for (let i = 0; i < 120; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof Modal === "object" && typeof player === "object" && GameUI.initialized === true; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 500));
}

// ── 1. 两条路径各 fetch 一次：新路径必须 200 + 合法 JSON，旧路径应当 404（证明它一直是错的）
const probe = await page.evaluate(async () => {
  const one = async url => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* 不是 JSON */ }
      return { url, status: r.status, ct: r.headers.get("content-type"), isJson: !!json, body: json };
    } catch (e) { return { url, error: String(e) }; }
  };
  return {
    href: location.href,
    newPath: await one("./public/version.txt"),
    oldPath: await one("version.txt"),
    playerVersion: (() => { try { return player.version; } catch { return null; } })(),
  };
});
log("[fetch-probe]", JSON.stringify(probe, null, 1));

// ── 2. 走一次「有新版本」分支：把 player.version 人为压低，等下一次 60 s tick
//     （只在本地模式做；线上不动线上状态）
let prompt = { mode: MODE, triggered: false, skipped: MODE !== "local" };
if (MODE === "local") {
  await page.evaluate(() => {
    try { Modal.hideAll(); } catch (e) { /* ignore */ }
    try { ui.view.modal.queue.length = 0; } catch (e) { /* ignore */ }
    player.version = 1; // version.txt 是 11.5 > 1
  });
  const t0 = Date.now();
  for (let i = 0; i < 45; i++) {           // 最多等 90 s，覆盖一整轮 60 s tick
    const st = await page.evaluate(() => {
      const dom = [...document.querySelectorAll(".c-modal")].map(e => e.innerText || "").join("\n");
      const q = (() => { try { return (ui.view.modal.queue || []).map(m => m.component?.name || "?"); } catch { return []; } })();
      const msg = (() => { try { return Modal.message.message || ""; } catch { return ""; } })();
      return { dom, q, msg, quotes: (() => { try { return !!ui.view.quotes.current; } catch { return null; } })() };
    }).catch(() => null);
    if (st && (st.dom.includes("Refresh now") || st.msg.includes("Refresh now"))) {
      prompt = {
        mode: MODE, triggered: true, afterSec: +((Date.now() - t0) / 1000).toFixed(1),
        via: st.dom.includes("Refresh now") ? "DOM 可见" : "Modal.message.message 已置（可能排在教程后面）",
        quotesBlocking: st.quotes, queue: st.q, msg: st.msg.slice(0, 80),
      };
      break;
    }
    if (i === 44) prompt = { mode: MODE, triggered: false, afterSec: 90, last: st };
    await new Promise(r => setTimeout(r, 2000));
  }
  log("[update-prompt]", JSON.stringify(prompt, null, 1));
}

// ── 3. 剩下的时间什么都不做，只数 pageerror（旧代码在这里每 60 s 丢一条 unhandled rejection）
const remain = Math.max(0, SEC * 1000 - (Date.now() - tStart));
log(`[wait] 继续观察 ${(remain / 1000).toFixed(0)} s，只数 pageerror`);
await new Promise(r => setTimeout(r, remain));

const kinds = {};
for (const e of errors) { const k = e.split("\n")[0].slice(0, 160); kinds[k] = (kinds[k] || 0) + 1; }
console.log(JSON.stringify({
  mode: MODE,
  seconds: +((Date.now() - tStart) / 1000).toFixed(1),
  pageErrorCount: errors.length,
  pageErrorKinds: kinds,
  notFoundUrls: [...new Set(notFound)],
  fetchProbe: { newStatus: probe.newPath?.status, newIsJson: probe.newPath?.isJson, oldStatus: probe.oldPath?.status },
  versionHits,
  updatePrompt: prompt,
}, null, 1));

try { server?.close(); } catch { /* ignore */ }
await cleanup();
process.exit(0);
