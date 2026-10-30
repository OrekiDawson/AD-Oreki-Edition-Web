// 验证：选项→游戏性 页有「自动动态速度」开关，且切换真实写回 GameSpeed
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8620);
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

// 打开 选项 → 游戏性
await page.evaluate(() => {
  try { Tab.options.show(true); } catch (e) { /* ignore */ }
  try { Tab.options.gameplay.show(true); } catch (e) { /* ignore */ }
});
await new Promise(r => setTimeout(r, 1200));

const r = await page.evaluate(() => {
  const out = [];
  const A = (name, cond, extra = "") => out.push({ name, pass: !!cond, extra });
  const text = document.body.innerText;
  A("页面出现「自动动态速度」标签", /自动动态速度/.test(text));
  A("显示当前模式与倍率", /自动（当前|手动（/.test(text), (text.match(/[自动手动]+（当前 [^）]*）/) || ["无"])[0]);

  const toggles = [...document.querySelectorAll("button, input, .o-primary-btn")];
  const toggle = toggles.find(el => /自动动态速度/.test(el.textContent || "") || el.getAttribute?.("aria-label") === "自动动态速度");
  A("找到动态开关元素", !!toggle);

  const before = GameSpeed.isDynamic;
  GameSpeed.setDynamic(!before);
  const afterSet = GameSpeed.isDynamic;
  A("setDynamic 真实写回", afterSet === !before, `${before} → ${afterSet}`);
  GameSpeed.setDynamic(before);
  A("恢复原值", GameSpeed.isDynamic === before, String(GameSpeed.isDynamic));
  return out;
});

let pass = 0;
for (const c of r) { console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  — ${c.extra}`); if (c.pass) pass++; }
console.log(`\n===== ${pass}/${r.length} 通过 =====`);
if (errs.length) console.log(`页面异常 ${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
server.close();
process.exit(pass === r.length && errs.length === 0 ? 0 : 1);
