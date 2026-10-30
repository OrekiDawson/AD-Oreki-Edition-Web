// 社区自动机脚本兼容性探针
//
// 目的：用本项目真实的自动机编译器（src/core/automator/compiler.js 的 compile）
//       逐个校验 _research/_decoded_scripts/ 下已解码的社区脚本，判断：
//       1) 现有语言是否已完整支持社区脚本用到的语法；
//       2) 是否存在「社区脚本能跑、我们这里报错」的真实缺口。
//
// 说明：社区脚本大量依赖自定义常量（TREE_MAIN 等）与时间研究预设，
//       因此先从 AutomatorData 段还原常量/预设再校验，否则会误判为错误。
//
// 用法：node verify-community-scripts-compat.mjs [--save=xxx.txt]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SCRIPT_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/_decoded_scripts";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/community-scripts-compat.json";
const argStr = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  return h ? h.split("=")[1] : d;
};
const SAVE = argStr("save", "999._9.73e14iM+Cel6+1.00e45SG.txt");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

// AutomatorData 序列化格式：5 位长度 + 段内容，重复
function splitAutomatorData(str) {
  const parts = [];
  let rem = str;
  while (rem.length > 0) {
    const len = Number(rem.slice(0, 5));
    rem = rem.slice(5);
    if (!Number.isFinite(len) || len < 0 || rem.length < len) return null;
    parts.push(rem.slice(0, len));
    rem = rem.slice(len);
  }
  return parts;
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8495, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`);
});
await page.goto("http://127.0.0.1:8495/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof AutomatorBackend === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
await page.evaluate(t => {
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  player = GameSaveSerializer.deserialize(t);
  player.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(player);
  player.lastUpdate = Date.now();
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
}, saveText);

await page.evaluate(async () => {
  window.__ac = await import("/src/core/automator/compiler.js");
});

const files = fs.readdirSync(SCRIPT_DIR).filter(f => f.endsWith(".txt")).sort();
const rows = [];
for (const f of files) {
  const decoded = fs.readFileSync(path.join(SCRIPT_DIR, f), "utf-8");
  const parts = splitAutomatorData(decoded);
  if (!parts) {
    rows.push({ name: f, status: "数据段异常", constants: 0, lines: 0, errors: ["无法切分 5 位长度段"] });
    console.log(`BAD       ${f}`);
    continue;
  }
  const content = parts[parts.length - 1];
  const presetPart = parts.length >= 4 ? parts[1] : "";
  const constantPart = parts.length >= 4 ? parts[2] : "";
  const row = await page.evaluate(({ text, presetPart: pp, constantPart: cp, name }) => {
    const injected = [];
    for (const entry of pp.split("*").filter(Boolean)) {
      const segs = entry.split(":");
      const target = player.timestudy.presets[Number(segs[0])];
      if (target && segs[2]) {
        target.name = segs[1] || "";
        target.studies = segs[2];
      }
    }
    for (const entry of cp.split("*").filter(Boolean)) {
      const idx = entry.indexOf(":");
      if (idx === -1) continue;
      player.reality.automator.constants[entry.slice(0, idx)] = entry.slice(idx + 1);
      injected.push(entry.slice(0, idx));
    }
    const result = window.__ac.compile(text, true);
    return {
      name,
      status: result.errors.length === 0 ? "PASS" : "ERROR",
      constants: injected.length,
      lines: text.split("\n").length,
      errors: result.errors.slice(0, 3).map(e => `L${e.startLine}: ${e.info}`),
      errorCount: result.errors.length,
    };
  }, { text: content, presetPart, constantPart, name: f });
  rows.push(row);
  const mark = row.status === "PASS" ? "PASS" : `ERR(${row.errorCount})`;
  console.log(`${mark.padEnd(10)} ${f.padEnd(46)} 常量=${String(row.constants).padStart(2)} 行=${String(row.lines).padStart(4)}` +
    (row.errors.length ? `\n           ${row.errors.join("\n           ")}` : ""));
}

const pass = rows.filter(r => r.status === "PASS").length;
const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  save: SAVE,
  total: rows.length,
  pass,
  fail: rows.length - pass,
  rows,
  errors: errs,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1), "utf-8");
console.log(`\n合计 ${rows.length}：PASS ${pass} / 失败 ${rows.length - pass}`);
if (errs.length) console.log(`控制台错误 ${errs.length} 条：\n- ${errs.join("\n- ")}`);
console.log(`数据已写入 ${OUT}`);

await browser.close();
server.close();
process.exit(0);
