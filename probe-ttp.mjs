// 探针：查明导入后 totalTimePlayed 为何与导出值不同
// 用法: node probe-ttp.mjs <mineDir> <port>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(process.argv[2] ?? "../_deploy/site");
const PORT = Number(process.argv[3] ?? 8201);
const BASE = path.resolve("..", "upstream", "ADChinese");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".webm": "video/webm", ".mp3": "audio/mpeg", ".ttf": "font/ttf",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain",
};

function serve(root, port) {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(root, urlPath);
      if (urlPath.endsWith("/")) f = path.join(f, "index.html");
      if (!f.startsWith(root)) { rq.writeHead(403).end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { rq.writeHead(404).end("not found"); return; }
        rq.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
        rq.end(d);
      });
    });
    s.listen(port, "127.0.0.1", () => res(s));
  });
}

const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

const s1 = await serve(BASE, PORT);
const s2 = await serve(ROOT, PORT + 1);
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox"] });

const pb = await browser.newPage();
await pb.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));

const base = await pb.evaluate(() => {
  player.records.totalTimePlayed = 123456789;
  player.records.realTimePlayed = 98765432;
  GameUI.update();
  const text = GameStorage.exportModifiedSave();
  // 解码存档，看文本里真正存了什么
  const decoded = GameSaveSerializer.deserialize(text);
  return {
    text,
    inMemory: player.records.totalTimePlayed,
    inSave: decoded.records.totalTimePlayed,
    inSaveReal: decoded.records.realTimePlayed,
    lastUpdate: decoded.lastUpdate,
    nowAtExport: Date.now(),
  };
});
console.log("=== 基线导出 ===");
console.log("内存中 totalTimePlayed :", base.inMemory);
console.log("存档中 totalTimePlayed :", base.inSave);
console.log("存档中 realTimePlayed  :", base.inSaveReal);
console.log("存档 lastUpdate        :", base.lastUpdate);

const pm = await browser.newPage();
await pm.goto(`http://127.0.0.1:${PORT + 1}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));

const r = await pm.evaluate((saveText) => {
  const before = player.records.totalTimePlayed;
  GameStorage.import(saveText);
  const rightAfter = player.records.totalTimePlayed;
  const decoded = GameSaveSerializer.deserialize(saveText);
  return {
    before, rightAfter,
    saveValue: decoded.records.totalTimePlayed,
    saveReal: decoded.records.realTimePlayed,
    lastUpdateInSave: decoded.lastUpdate,
    now: Date.now(),
    factor: getGlobalSpeedFactor(),
  };
}, base.text);

console.log("\n=== 本项目导入 ===");
console.log("导入前(本页自己的值)   :", r.before);
console.log("导入后立即读取         :", r.rightAfter);
console.log("存档里的值             :", r.saveValue);
console.log("存档里的 realTime      :", r.saveReal);
console.log("存档 lastUpdate        :", r.lastUpdateInSave);
console.log("导入时刻 now           :", r.now);
console.log("墙钟间隔 (ms)          :", r.now - r.lastUpdateInSave);
console.log("倍率                   :", r.factor);
console.log("预期增量 = 间隔×倍率    :", (r.now - r.lastUpdateInSave) * r.factor);
console.log("实际增量               :", r.rightAfter - r.saveValue);
console.log("差值是否吻合           :", Math.abs((r.rightAfter - r.saveValue) - (r.now - r.lastUpdateInSave) * r.factor) < 5e6);

await new Promise(r2 => setTimeout(r2, 400));
const after = await pm.evaluate(() => player.records.totalTimePlayed);
console.log("再等 400ms 后          :", after, "（增量", after - r.rightAfter, "≈ 400×倍率）");

await browser.close();
s1.close(); s2.close();
