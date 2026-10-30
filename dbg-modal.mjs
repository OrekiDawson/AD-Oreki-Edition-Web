import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("../AD-Oreki-Edition"); const port = 8077;
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => srv.listen(port, "127.0.0.1", r));
const pup = (await import("puppeteer-core")).default;
const b = await pup.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 950 });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await new Promise(r => setTimeout(r, 6000));
await p.evaluate(() => { player.antimatter = new Decimal("1e100"); GameUI.update(); const o = Tabs.all.find(t => t.config.key === "options"); o.show(); o.subtabs.find(s => s.key === "gameplay").show(); });
await new Promise(r => setTimeout(r, 600));
await p.evaluate(() => Modal.orekiAchievement.show());
await new Promise(r => setTimeout(r, 900));
const dbg = await p.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].map(x => ({ t: x.textContent.trim().slice(0, 16), inUi: !!x.closest("#ui") }));
  const tool = document.querySelector(".c-oreki-tool");
  const chain = [];
  let e = tool;
  while (e && chain.length < 7) { chain.push(e.id ? `#${e.id}` : (e.className || e.tagName)); e = e.parentElement; }
  return { chain, btns };
});
console.log(JSON.stringify(dbg, null, 1));
await b.close(); srv.close();
