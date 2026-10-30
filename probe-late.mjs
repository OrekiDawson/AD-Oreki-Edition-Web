// 后期系统探针：逐个尝试调用后期入口，记录是否会抛错（用于判断哪些可做集成验证）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8089);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const out = await page.evaluate(() => {
  const log = [];
  const probe = (name, fn) => {
    try {
      log.push({ name, ok: true, val: String(fn()) });
    } catch (e) {
      log.push({ name, ok: false, val: (e && e.message ? e.message : String(e)).slice(0, 200) });
    }
  };

  // 全局符号是否存在
  probe("Eternity/eternity()", () => typeof eternity);
  probe("Reality/beginProcessReality", () => typeof beginProcessReality);
  probe("GlyphGenerator", () => typeof GlyphGenerator);
  probe("Glyphs", () => typeof Glyphs);
  probe("BlackHoles", () => typeof BlackHoles);
  probe("Enslaved", () => typeof Enslaved);
  probe("Laitela", () => typeof Laitela);
  probe("Pelle", () => typeof Pelle);
  probe("Ra", () => typeof Ra);
  probe("Celestials", () => typeof Celestials);
  probe("AutomatorBackend", () => typeof AutomatorBackend);
  probe("GameEnd", () => typeof GameEnd);
  probe("TimeStudy", () => typeof TimeStudy);
  probe("TimeStudyTree", () => typeof TimeStudyTree);
  probe("AlchemyResource", () => typeof AlchemyResource);
  probe("GlyphSelection", () => typeof GlyphSelection);

  // factor=10000 下 Pelle 的 sqrt 降级
  probe("getGlobalSpeedFactor()", () => getGlobalSpeedFactor());
  probe("OrekiSpeed.factor", () => OrekiSpeed.factor);

  // 黑洞核心方法
  probe("BlackHoles.list.length", () => BlackHoles.list.length);
  probe("updatePhases(1000)", () => { BlackHoles.updatePhases(1000); return "ok"; });
  probe("getGameSpeedupFactor()", () => getGameSpeedupFactor());

  // Eternity
  probe("eternityGoal", () => Player.eternityGoal.toString());
  probe("eternity(true) 强制", () => {
    player.records.thisEternity.maxIP = new Decimal("1e60");
    player.records.thisEternity.time = 3e6;
    eternity(true);
    return `eternities=${Currency.eternities.value} bestTime=${player.records.bestEternity.time}`;
  });

  // Reality
  probe("isRealityAvailable", () => isRealityAvailable());
  probe("player.realities 赋值", () => { player.realities = new Decimal(1); return String(player.realities); });
  probe("TimeStudy.reality.isBought", () => TimeStudy.reality.isBought);
  probe("getRealityProps(true)", () => { const p = getRealityProps(true); return `glyphLevel=${p.glyphLevel} seed=${p.seed}`; });

  // Glyph
  probe("GlyphGenerator.randomGlyph", () => {
    const g = GlyphGenerator.randomGlyph({ seed: 12345, level: 100, type: "power", spec: 0 });
    return `${g.type}/${g.strength}`;
  });
  probe("GlyphGenerator.startingGlyph", () => {
    const g = GlyphGenerator.startingGlyph(gainedGlyphLevel());
    return `${g.type}`;
  });

  // Lai'tela / Enslaved 入口
  probe("Laitela 字段", () => Object.keys(Laitela).join(",").slice(0, 120));
  probe("laitelaRealityTick", () => typeof laitelaRealityTick);
  probe("Enslaved.isStoringRealTime", () => Enslaved.isStoringRealTime);
  probe("Ra.memoryTick", () => typeof Ra.memoryTick);

  return log;
});

for (const r of out) console.log(`${r.ok ? " OK " : "ERR "} ${r.name}  =>  ${r.val}`);
console.log("\n页面异常：", errs.slice(0, 5));

await browser.close();
server.close();
