// R38-M 主 Agent · 终局判据与佩勒驱动的静态/单元探针
//
// 目的（全部只读 + 一次纯函数级验证，不写存档）：
//   1) 页面零 console.error / 未捕获异常（确认 oreki-endgame-automation.js 的 import 改动没炸）
//   2) `GameEnd.endState` 在若干反物质指数下的取值 —— 验证单调性与「E >= TARGET 才 >= 1」
//      这一步是**公式单测**，用内存里临时赋值完成，不落盘、不算通关证据
//   3) `OrekiEndgameAutomation._stopDoomedResets` 存在且可调用
//   4) `Autobuyer` 已经能从 endgame-automation 拿到（import 路径正确）
//
// 用法： node _r38m/endprobe.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8875);
const CDP_PORT = Number(process.env.OREKI_CDP_PORT || 9365);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: CDP_PORT, headless: true });
const { page, errors } = await openGame(browser, { port: PORT });

const out = await page.evaluate(() => {
  const r = { checks: {} };
  const put = (k, v) => { r.checks[k] = v; };
  try {
    put("endState_zero", GameEnd.endState);
    // 公式单测：临时改写内存里的峰值字段，逐个指数读 endState，读完还原
    const rec = player.celestials.pelle.records.totalAntimatter;
    const sweep = {};
    for (const e of [1, 10, 50, 100, 300, 999, 1000, 1001, 2000, 1e4]) {
      player.celestials.pelle.records.totalAntimatter = new Decimal(10).pow(e);
      sweep["e" + e] = Number(GameEnd.endState.toFixed(4));
    }
    player.celestials.pelle.records.totalAntimatter = rec;
    put("sweep", sweep);
    put("monotonic", (() => {
      const ks = Object.keys(sweep);
      for (let i = 1; i < ks.length; i++) if (sweep[ks[i]] < sweep[ks[i - 1]]) return `${ks[i - 1]}->${ks[i]} 下降`;
      return true;
    })());
    put("reach1_at_e1000", sweep.e1000 >= 1);
    put("below1_at_e999", sweep.e999 < 1);
    put("stopDoomedResets_isFn", typeof OrekiEndgameAutomation._stopDoomedResets === "function");
    put("autobuyer_bigCrunch_active", (() => { try { return Autobuyer.bigCrunch.isActive; } catch (e) { return "err:" + e.message; } })());
    put("doomResetsOff", OrekiEndgameAutomation._doomResetsOff);
    put("lastErr", OrekiEndgameAutomation._lastError);
    put("gameLoaded", typeof GameEnd === "object" && typeof player === "object");
  } catch (e) {
    r.err = String((e && e.stack) || e);
  }
  return r;
});

console.log(JSON.stringify(out, null, 1));
const real = errors.filter(e => !/googletagmanager|Content Security Policy|kaspersky/i.test(e));
console.log("console-errors:", real.length, real.slice(0, 5));

await cleanup();
server.close();
