// [R38-C] 校验教程步骤清单里新增的「终局」步骤（在真实页面上下文里 import 模块后取值）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.env.R38C_HTTP_PORT || 8872);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", `--remote-debugging-port=${process.env.R38C_CDP_PORT || 9374}`],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await new Promise(r => setTimeout(r, 7000));

const result = await page.evaluate(async () => {
  const out = {};
  const mod = await import("/src/components/tutorial/OrekiTutorial.js");
  const steps = mod.OrekiTutorial.steps();
  out.stepCount = steps.length;
  out.lastTwo = steps.slice(-2).map(s => ({ id: s.id, text: s.text, done: s.done }));
  // 终局步骤的 done 应绑定真实字段 player.isGameEnd
  player.isGameEnd = true;
  out.lastStepDoneAfterSet = mod.OrekiTutorial.steps().slice(-1)[0].done;
  player.isGameEnd = false;
  out.lastStepDoneAfterReset = mod.OrekiTutorial.steps().slice(-1)[0].done;
  // 教程数据模块：佩勒阶段的下一步文案
  const tut = await import("/src/core/oreki-tutorial.js");
  player.celestials.pelle.doomed = true;
  const snap = tut.getTutorialStageSnapshot();
  out.stageKey = snap.key;
  out.stageName = snap.name;
  out.focus = snap.focus;
  out.nextSteps = snap.nextSteps;
  player.celestials.pelle.doomed = false;
  return out;
});
console.log(JSON.stringify(result, null, 2));

await browser.close();
server.close();
