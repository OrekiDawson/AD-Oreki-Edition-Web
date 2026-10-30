// 定向探针：维度 bought 写入后能否被 multiplier 读到，以及是否会被游戏循环重置
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(process.argv[2] ?? "../_deploy/site");
const PORT = Number(process.argv[3] ?? 8401);
const OFFICIAL = "https://ivark.github.io/AntimatterDimensions/";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain", ".json": "application/json" };
function serve(root, port) {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const p = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(root, p);
      if (p.endsWith("/")) f = path.join(f, "index.html");
      if (!f.startsWith(root)) { rq.writeHead(403).end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { rq.writeHead(404).end("nf"); return; }
        rq.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
        rq.end(d);
      });
    });
    s.listen(port, "127.0.0.1", () => res(s));
  });
}
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));

const s = await serve(ROOT, PORT);
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--proxy-server=http://127.0.0.1:7897", "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"] });

async function probe(url, label) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await new Promise(r => setTimeout(r, url.startsWith("http://127") ? 7000 : 12000));

  // A. 同一 evaluate 内写入 + 读取
  const same = await page.evaluate(() => {
    player.dimensions.antimatter[0].bought = 10;
    player.dimensions.antimatter[7].bought = 50;
    return {
      bought1: player.dimensions.antimatter[0].bought,
      bought8: player.dimensions.antimatter[7].bought,
      mult1: AntimatterDimension(1).multiplier.toString(),
      mult8: AntimatterDimension(8).multiplier.toString(),
      cost1: AntimatterDimension(1).cost.toString(),
    };
  });

  // B. 等一个 tick 后再读（跨 evaluate）
  await new Promise(r => setTimeout(r, 600));
  const later = await page.evaluate(() => ({
    bought1: player.dimensions.antimatter[0].bought,
    bought8: player.dimensions.antimatter[7].bought,
    mult1: AntimatterDimension(1).multiplier.toString(),
    mult8: AntimatterDimension(8).multiplier.toString(),
    am: String(player.antimatter).slice(0, 20),
    infinities: String(Currency.infinities.value),
    break: String(player.break),
  }));

  console.log(`\n===== ${label} =====`);
  console.log("同一 evaluate 内 :", JSON.stringify(same));
  console.log("等 600ms 后      :", JSON.stringify(later));
  await page.close();
}

await probe(OFFICIAL, "官方原版");
await probe(`http://127.0.0.1:${PORT}/index.html`, "本项目");

await browser.close();
s.close();
