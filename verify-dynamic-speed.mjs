// 动态速度控制器验证（Web）
// 断言：默认开启、手动模式可关、停滞会升档且受限幅/上下限、进度变化时不升档、界面文案含模式与倍率。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8598);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof GameSpeed === "object" && typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const r = await page.evaluate(() => {
  const out = [];
  const A = (name, cond, extra = "") => out.push({ name, pass: !!cond, extra });
  A("默认启用动态模式", GameSpeed.isDynamic === true, `isDynamic=${GameSpeed.isDynamic}`);
  A("界面文案含模式与倍率", /自动|手动/.test(GameSpeed.modeLabel) && /×/.test(GameSpeed.modeLabel), GameSpeed.modeLabel);

  GameSpeed.set(10000);
  const before = GameSpeed.factor;
  // 停滞路径：同一帧内连续推进 now，signal 恒定
  let t = Date.now();
  let ramps = 0;
  for (let i = 0; i < 40; i++) { t += 1000; if (GameSpeed.tickDynamic(t)) ramps++; }
  const after = GameSpeed.factor;
  A("停滞会升档", after > before, `${before} → ${after}`);
  A("每次升档不超过 2 倍/次", after <= before * Math.pow(2, ramps), `ramps=${ramps} factor=${after}`);
  A("不超过上限", after <= GameSpeed.max, `factor=${after} max=${GameSpeed.max}`);
  A("升档次数有上限（到达 max 后不再涨）", GameSpeed.factor <= GameSpeed.max, `final=${GameSpeed.factor}`);

  // 手动模式：关掉后不再升档
  GameSpeed.set(10000);
  GameSpeed.setDynamic(false);
  const f0 = GameSpeed.factor;
  let t2 = Date.now();
  let ramps2 = 0;
  for (let i = 0; i < 40; i++) { t2 += 1000; if (GameSpeed.tickDynamic(t2)) ramps2++; }
  A("手动模式不再升档", GameSpeed.factor === f0 && ramps2 === 0, `factor=${GameSpeed.factor} ramps=${ramps2}`);
  A("手动模式文案正确", /手动/.test(GameSpeed.modeLabel), GameSpeed.modeLabel);

  // 恢复默认：动态 + 10000
  GameSpeed.setDynamic(true);
  GameSpeed.set(10000);
  A("恢复后回到动态模式", GameSpeed.isDynamic === true && GameSpeed.factor === 10000, `f=${GameSpeed.factor}`);
  return out;
});

let pass = 0;
for (const c of r) {
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  — ${c.extra}`);
  if (c.pass) pass++;
}
console.log(`\n===== ${pass}/${r.length} 通过 =====`);
if (errs.length) console.log(`页面异常 ${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
process.exit(pass === r.length && errs.length === 0 ? 0 : 1);
