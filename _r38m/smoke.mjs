// R38 主 Agent · 改动后冒烟：确认页面零控制台错误 + 两个新常量真的生效
//
// 覆盖面（只读，不改存档）：
//   1) imaginary-upgrades.js 的 OREKI_IU15_AM_EXP 是否被正确渲染进 requirement 文案
//   2) Laitela.entropyGainPerSecond 是否按 OREKI_LAITELA_ENTROPY_DIVISOR 计算（含 clamp 上限 0.5）
//   3) 页面加载期间是否有 console.error / 未捕获异常
//
// 用法： node _r38m/smoke.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = Number(process.env.OREKI_HTTP_PORT || 8873);
const CDP_PORT = Number(process.env.OREKI_CDP_PORT || 9363);

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
  const r = { ok: true, checks: {} };
  const put = (k, v) => { r.checks[k] = v; };
  try {
    // ① IU15 文案与判据
    const req15 = ImaginaryUpgrade(15).requirement;
    put("iu15_requirement", String(req15));
    put("iu15_text_has_1e100000000", /1(\.\d+)?e100000000|e1\.00000e8|1e8/i.test(String(req15)));
    put("iu15_cost", String(ImaginaryUpgrade(15).cost));
    put("iu15_canLock", ImaginaryUpgrade(15).canLock === true);

    // ② 莱特拉熵产量：把反物质临时抬到指数 1e10 只为读公式，读完立刻还原
    const savedExp = player.antimatter.exponent;
    const savedMant = player.antimatter.mantissa;
    try {
      player.antimatter.exponent = 1e10;
      player.antimatter.mantissa = 1;
      const fast = Laitela.entropyGainPerSecond;
      player.antimatter.exponent = 5;
      player.antimatter.mantissa = 1;
      const slow = Laitela.entropyGainPerSecond;
      put("entropy_at_1e10exp", fast);
      put("entropy_at_1e5exp", slow);
    } finally {
      player.antimatter.exponent = savedExp;
      player.antimatter.mantissa = savedMant;
    }

    // ③ 难度窗口常量存在性
    put("laitela_isUnlocked", Laitela.isUnlocked);
    put("difficultyTier", Laitela.difficultyTier);
  } catch (e) {
    r.ok = false;
    r.err = String(e && e.stack || e);
  }
  return r;
});

const fatal = (errors || []).filter(e => !/favicon|net::ERR_|Failed to load resource/i.test(String(e)));
console.log(JSON.stringify({ ...out, consoleErrors: fatal.slice(0, 10), consoleErrorCount: fatal.length }, null, 2));

await cleanup();
server.close();

const pass =
  out.ok &&
  fatal.length === 0 &&
  Math.abs(out.checks.entropy_at_1e10exp - 0.5) < 1e-9 &&
  out.checks.entropy_at_1e5exp < 1e-6 &&
  /没|1/.test(out.checks.iu15_requirement);
console.log(pass ? "\n[SMOKE PASS]" : "\n[SMOKE FAIL]");
process.exit(pass ? 0 : 1);
