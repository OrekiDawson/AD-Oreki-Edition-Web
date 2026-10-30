// 静态服务器（验收用）。用法：node serve-static.mjs [端口] [站点根目录]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] || 8142);
const root = path.resolve(process.argv[3] || "../AD-Oreki-Edition");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webm": "video/webm",
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
}).listen(port, "127.0.0.1", () => console.log(`serve ${root} on ${port}`));
