// 移动端视口扫描（本地副本，只读）
// 用法:
//   export OREKI_PATCH_DIR="$(pwd)"; export NODE_OPTIONS="--import=file://$(pwd -W)/lib/patch-launch.mjs"
//   node verify-viewport.mjs ../AD-Oreki-Edition 8310
//
// 判据（每一档都必须满足）：
//   1. 整页无横向溢出（scrollWidth <= clientWidth + 1）
//   2. 主容器宽度不超过视口
//   3. 页面无未捕获异常
// 只报事实，不做"通过视觉美观"这类无法量化的断言。

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const PORT = Number(process.argv[3] || 8310);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("nf"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const VIEWPORTS = [
  { name: "窄屏 320×640", width: 320, height: 640 },
  { name: "窄屏 360×740", width: 360, height: 740 },
  { name: "常见手机 390×844", width: 390, height: 844 },
  { name: "大屏手机 430×932", width: 430, height: 932 },
  { name: "平板 768×1024", width: 768, height: 1024 },
  { name: "桌面 1280×800", width: 1280, height: 800 },
];

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  (ok ? pass++ : fail++);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

await new Promise(r => server.listen(PORT, "127.0.0.1", r));
console.log(`[serve] http://127.0.0.1:${PORT}/  root=${ROOT}`);

const browser = await puppeteer.launch({ headless: true });

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e.message).slice(0, 120)));
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: vp.width <= 430, hasTouch: vp.width <= 430 });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));

    const m = await page.evaluate(() => {
      const d = document.documentElement;
      const body = document.body;
      // 找出真正撑宽页面的元素（从左边界溢出到视口右边界之外）
      const vw = d.clientWidth;
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && r.left >= -1) {
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
          wide.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`);
        }
        if (wide.length >= 4) break;
      }
      return {
        scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
        bodyScrollWidth: body.scrollWidth, vw,
        overflowing: wide,
      };
    });

    const tag = `[${vp.name}]`;
    check(`${tag} 无整页横向溢出`, m.scrollWidth <= m.clientWidth + 1,
      `scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}`);
    check(`${tag} body 宽不超视口`, m.bodyScrollWidth <= m.clientWidth + 1,
      `body=${m.bodyScrollWidth}`);
    if (m.overflowing.length) {
      console.log(`      超出右边界且未声明横向滚动的元素：${m.overflowing.join(" | ")}`);
    }
    check(`${tag} 无未捕获异常`, errors.length === 0, errors.join(" / "));
    await page.close();
  }

  // 竖屏/横屏切换：同一手机视口旋转后不得出现布局崩坏
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 1500));
    const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check("[横屏 844×390] 旋转后无整页横向溢出", m.s <= m.c + 1, `scrollWidth=${m.s} clientWidth=${m.c}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail === 0 ? 0 : 1);
