// 涓存椂璇婃柇锛氭棫瀛樻。杞藉叆 + 鍗曞抚 + 绂荤嚎妯℃嫙鐨勬椂闂村閲?import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = 8096;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(root, p), (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const names = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const file = names.find(f => f.startsWith("861.")) || names.find(f => f.startsWith("861"));
const text = fs.readFileSync(path.join(SAVE_DIR, file), "utf-8");

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const out = await page.evaluate(async (saveText) => {
  const log = {};
  try { GameIntervals.gameLoop.stop(); } catch {}
  GameStorage.offlineEnabled = false;
  GameSpeed.set(10000);
  player = GameSaveSerializer.deserialize(saveText);
  player.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(player);
  player.lastUpdate = Date.now();
  try { GameIntervals.gameLoop.stop(); } catch {}
  log.afterLoad = {
    factor: getGlobalSpeedFactor(),
    rawFactor: getGlobalSpeedFactorRaw(),
    simLocked: OrekiSpeed.isSimulationLocked,
    totalRaw: player.records.totalTimePlayed,
    totalInGame: player.records.totalInGameTime,
    thisInGame: player.records.thisInfinity.inGameTime,
    thisRaw: player.records.thisInfinity.time,
    paused: player.options.gamePaused,
    ach188: Achievement(188).isUnlocked,
    bhUnlocked: BlackHoles.areUnlocked,
    bhPaused: BlackHoles.arePaused,
    releaseTick: Enslaved.isReleaseTick,
    nextTickDiff: Enslaved.nextTickDiff,
    storedGame: player.celestials.enslaved.stored,
    gameSpeedStorage: player.celestials.enslaved.isStoring,
    gameSpeedStorageReal: player.celestials.enslaved.isStoringReal,
  };
  const snap = () => ({ raw: player.records.totalTimePlayed, inGame: player.records.totalInGameTime, real: player.records.realTimePlayed });
  let a = snap();
  gameLoop(100);
  let b = snap();
  log.oneTick = { dRaw: b.raw - a.raw, dInGame: b.inGame - a.inGame, dReal: b.real - a.real, factorNow: getGlobalSpeedFactor() };

  a = snap();
  simulateTime(1, true, true);
  b = snap();
  log.offline = {
    dRaw: b.raw - a.raw, dInGame: b.inGame - a.inGame, dReal: b.real - a.real,
    ratioRawInGame: (b.raw - a.raw) / (b.inGame - a.inGame),
    factorAfter: getGlobalSpeedFactor(), simLockedAfter: OrekiSpeed.isSimulationLocked,
  };
  return log;
}, text);

console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
