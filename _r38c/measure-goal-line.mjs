// [R38-C] 量一下 375 宽下佩勒页终局提示行几种写法的实际换行情况（只测量，不截图）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.env.R38C_HTTP_PORT || 8873);
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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", `--remote-debugging-port=${process.env.R38C_CDP_PORT || 9375}`],
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await new Promise(r => setTimeout(r, 6500));

const res = await page.evaluate(() => {
  const variants = [
    { size: "1.8rem", text: "终局目标：反物质最大值达到 1×10<sup>1000</sup>" },
    { size: "1.8rem", text: "终局目标：反物质最大值 1×10<sup>1000</sup>" },
    { size: "1.6rem", text: "终局目标：反物质最大值达到 1×10<sup>1000</sup>" },
    { size: "1.7rem", text: "终局目标：反物质最大值达到 1×10<sup>1000</sup>" },
  ];
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:375px;visibility:hidden;";
  document.body.appendChild(host);
  const out = variants.map(v => {
    const d = document.createElement("div");
    d.style.cssText = `max-width:100%;margin:0.4rem 0 1.2rem;padding:0 0.6rem;font-size:${v.size};` +
      "line-height:1.45;text-align:center;color:var(--color-pelle--base);";
    d.innerHTML = v.text;
    host.appendChild(d);
    const r = d.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(d);
    const lines = range.getClientRects().length;
    const res = { size: v.size, text: d.textContent, boxW: Math.round(r.width), boxH: Math.round(r.height), lineRects: lines };
    d.remove();
    return res;
  });
  host.remove();
  return out;
});
console.log(JSON.stringify(res, null, 2));

await browser.close();
server.close();
