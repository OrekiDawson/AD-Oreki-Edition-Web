import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const DEFAULT_PLAYWRIGHT_ROOTS = [
  "/tmp/pwtest",
  "/home/oreki/.npm/_npx/e41f203b7505f1fb",
  "/home/oreki/.codex/node_modules",
  "/home/oreki/.npm-global/lib/node_modules",
];

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  })[ext] || "application/octet-stream";
}

/** 从显式候选根或机器现有安装中解析 Playwright。 */
export function loadPlaywright(candidateRoots = []) {
  const tried = [];
  for (const root of [...candidateRoots, ...DEFAULT_PLAYWRIGHT_ROOTS]) {
    try {
      const require = createRequire(path.join(root, "noop.js"));
      return require("playwright");
    } catch (error) {
      tried.push(`${root}: ${error.message}`);
    }
  }
  try {
    return createRequire(import.meta.url)("playwright");
  } catch (error) {
    throw new Error(`找不到 playwright。候选与错误：\n${tried.join("\n")}`);
  }
}

/** 为真实浏览器验收启动只读静态服务。 */
export function startStaticServer(root) {
  const rootPath = path.resolve(root);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = pathname === "/"
      ? path.join(rootPath, "index.html")
      : path.resolve(rootPath, "." + pathname);
    if (!file.startsWith(rootPath + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": mime(file),
        "cache-control": "no-store",
      });
      res.end(data);
    });
  });
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}/`,
    }));
  });
}
