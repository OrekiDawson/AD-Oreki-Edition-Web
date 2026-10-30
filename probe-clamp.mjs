// 探针 v3：确认 clampMin(Number.MAX_VALUE) 的比较行为，这是 Eternity 门槛的真实成因。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8720);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const out = await page.evaluate(() => {
  const st = {};
  const NMAX = Number.MAX_VALUE;
  st.NMAX_string = NMAX.toString();
  const dNMAX = new Decimal(NMAX);
  st.dNMAX_string = dNMAX.toString();
  st.dNMAX_exponent = dNMAX.exponent;
  st.dNMAX_mantissa = dNMAX.mantissa;
  const p215 = Decimal.pow10(215.6);
  st.p215 = p215.toString();
  st.p215_exponent = p215.exponent;
  st.p215_mantissa = p215.mantissa;
  st.p215_lt_dNMAX = p215.lt(dNMAX);
  st.p215_gte_dNMAX = p215.gte(dNMAX);
  st.p215_lt_NMAX_raw = p215.lt(NMAX);
  // 关键：Decimal.lt(number) 走 D(value) 路径
  st.clampMin_result = p215.clampMin(NMAX).toString();
  st.clampMin_exponent = p215.clampMin(NMAX).exponent;
  // 对照：显式比较
  st.cmp_dNMAX = p215.cmp(dNMAX);
  st.dNMAX_sign = dNMAX.s;
  st.p215_sign = p215.s;
  // 检查 D(Number.MAX_VALUE) 是否被截断
  st.dNMAX_e_check = dNMAX.e;
  // ME / ME_NN 的最大值
  st.D_max_e = (() => { try { return D(1e308).e; } catch (e) { return "ERR"; } })();
  // 直接测试：多少指数开始会被 clamp 抬高
  const tests = {};
  for (const e of [215.6, 250, 280, 300, 307, 308, 309, 310]) {
    const v = Decimal.pow10(e);
    tests[e] = { raw: v.toString(), clamped: v.clampMin(NMAX).toString() };
  }
  st.tests = tests;
  return st;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
