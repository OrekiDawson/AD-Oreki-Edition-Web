import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("../AD-Oreki-Edition"); const port = 8078;
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => srv.listen(port, "127.0.0.1", r));
const pup = (await import("puppeteer-core")).default;
const b = await pup.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 950 });
p.on("pageerror", e => console.log("PAGEERROR:", e.message.slice(0, 400)));
p.on("console", m => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await new Promise(r => setTimeout(r, 6000));
const r1 = await p.evaluate(() => {
  try { return { ok: true, info: OrekiSaveTool.getInfo() }; } catch (e) { return { ok: false, err: String(e) }; }
});
console.log("getInfo:", JSON.stringify(r1).slice(0, 600));
await p.evaluate(() => Modal.orekiSave.show());
await new Promise(r => setTimeout(r, 1000));
const r2 = await p.evaluate(() => ({
  hasTool: !!document.querySelector(".c-oreki-tool"),
  hasInfo: !!document.querySelector(".c-oreki-tool__info"),
  body: document.body.innerText.includes("存档工具"),
  modalHtml: (document.querySelector(".c-modal-message")?.outerHTML || "").slice(0, 200),
}));
console.log("render:", JSON.stringify(r2));
await b.close(); srv.close();
