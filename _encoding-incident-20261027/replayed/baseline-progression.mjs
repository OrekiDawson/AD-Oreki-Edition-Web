// 通关时间基线（只读，不改机制）
//
// 目的：给「爽玩」目标建立**可复现**的分阶段基准。产出两类数据：
//   Part 1「新存档 → 首个无限」：自动贪心玩家，记录到达首个无限所需的帧数（→ 墙钟推算值）
//   Part 2「阶段基线」：从代表性存档出发，固定墙钟预算内的资源/晋升/里程碑变化
//
// ⚠️ 口径声明（必须与真实计时区分）：
//   · 本脚本用**固定 20ms passDiff** 手动驱动 gameLoop，等价于「稳定 50fps」的理想运行。
//   · 因此「墙钟(推算) = 帧数 × 20ms」是**推算值**，不是真实浏览器计时；
//     真实环境还受主线程阻塞、页面后台节流、帧率波动影响。
//   · 游戏时间(ms) 来自 records.totalTimePlayed，是真实累加值。
//
// 用法: node baseline-progression.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8270);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const FRAME_MS = 20;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

// 注入通用读取器与贪心策略
await page.evaluate(() => {
  window.__b = {
    lg(v) {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    },
    num(v) {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) ? n : NaN;
    },
    snap() {
      const safe = fn => { try { return fn(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: this.lg(Currency.antimatter.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        epLog: this.lg(Currency.eternityPoints.value),
        rmLog: this.lg(Currency.realityMachines.value),
        inf: this.num(Currency.infinities.value),
        eter: this.num(Currency.eternities.value),
        real: player.records.realTimePlayed,
        realities: safe(() => this.num(Currency.realities.value)),
        galaxies: this.num(player.galaxies),
        dimBoosts: this.num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        bh: safe(() => BlackHoles.areUnlocked && !BlackHoles.arePaused),
        dilation: safe(() => !!player.dilation.active),
        doomed: safe(() => Pelle.isDoomed),
        gameEnd: safe(() => GameEnd.endState),
        ach188: safe(() => Achievement(188).isUnlocked),
      };
    },
    // 贪心购买：维度 1-8 买最大、计数频率买最大、维度提升/星系能买就买
    greedy() {
      for (let t = 1; t <= 8; t++) {
        try { buyMaxDimension(t); } catch (e) { /* 未解锁 */ }
      }
      try { buyMaxTickspeed(); } catch (e) { /* ignore */ }
      try { if (canBuyDimensionBoost()) requestDimensionBoost(false); } catch (e) { /* ignore */ }
      try { if (canBuyAntimatterGalaxy()) requestGalaxyReset(false); } catch (e) { /* ignore */ }
      try { if (Player.canCrunch) bigCrunchReset(); } catch (e) { /* ignore */ }
      try { if (Player.canEternity) eternityResetRequest(); } catch (e) { /* ignore */ }
    },
  };
});

// ============ Part 1：新存档 → 首个无限 ============
console.log("========== Part 1：新存档 → 首个无限（贪心自动玩家） ==========");
console.log("口径：固定 20ms/帧；墙钟(推算) = 帧数 × 20ms（等价稳定 50fps，非真实计时）\n");
console.log("     F   结果        帧数     墙钟(推算)    游戏时间(ms)    末尾 AM(log10)  末尾 星系/维度提升");

const freshRows = [];
for (const F of [1, 1000, 10000]) {
  const r = await page.evaluate((F, frameMs, maxFrames) => {
    // 全新开局
    try { GameIntervals.stop(); } catch (e) { /* ignore */ }
    GameSpeed.set(F);
    GameStorage.hardReset?.();
    if (typeof GameStorage.newGame !== "undefined") { /* noop */ }
    // 用一个确定的空存档兜底
    player = Player.defaultStart;
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    try { GameIntervals.stop(); } catch (e) { /* ignore */ }
    GameSpeed.set(F);
    const b = window.__b;
    const start = b.snap();
    let frames = 0;
    let reached = false;
    while (frames < maxFrames) {
      b.greedy();
      gameLoop(frameMs);
      frames++;
      const inf = b.num(Currency.infinities.value);
      if (Number.isFinite(inf) && inf > 0) { reached = true; break; }
    }
    const end = b.snap();
    GameSpeed.set(1);
    return {
      F, reached, frames,
      wallMs: frames * frameMs,
      gameMs: end.game - start.game,
      amLog: end.amLog, galaxies: end.galaxies, dimBoosts: end.dimBoosts,
    };
  }, F, FRAME_MS, 20000);
  freshRows.push(r);
  console.log(`  ${String(F).padStart(6)} ${(r.reached ? "到达首个无限" : "超预算未到达").padEnd(12)} ${String(r.frames).padStart(7)} ${String(r.wallMs).padStart(13)} ${r.gameMs.toExponential(3).padStart(15)} ${String(r.amLog?.toFixed(1) ?? "—").padStart(15)} ${String(r.galaxies)}/${String(r.dimBoosts)}`);
}

// ============ Part 2：阶段基线 ============
const STAGES = [
  { key: "S1-preinf", file: "29._2AG+9DB+1e50AM.txt", name: "无限前（2 AG / 9 DB）" },
  { key: "S2-eternity", file: "132._9.1e137IP.txt", name: "永恒期（9.1e137 IP）" },
  { key: "S3-2R", file: "729._2R+6.9e19EP+167TT.txt", name: "2 次现实" },
  { key: "S4-endgame", file: "1123._Endgame.txt", name: "终局存档" },
];
const BUDGET_FRAMES = 500;   // 10s 墙钟（推算）

console.log("\n\n========== Part 2：阶段基线（固定 10s 墙钟预算） ==========");
console.log(`每格：Δlog10(主资源) ；末尾里程碑状态\n`);

const stageRows = [];
for (const st of STAGES) {
  const saveText = fs.readFileSync(path.join(SAVE_DIR, st.file), "utf-8");
  console.log(`--- ${st.key}：${st.name}（${st.file}）---`);
  console.log("     F   Δlog10(IP)  Δlog10(EP)  Δlog10(RM)   Δ无限      Δ永恒      Δ现实     末尾 speedup  BH激活  膨胀  末日  终局态");
  for (const F of [1, 10000]) {
    const r = await page.evaluate((text, F, frameMs, frames, greedy) => {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      const b = window.__b;
      const s0 = b.snap();
      for (let i = 0; i < frames; i++) {
        if (greedy) b.greedy();
        gameLoop(frameMs);
      }
      const s1 = b.snap();
      GameSpeed.set(1);
      const d = (a, c) => (Number.isFinite(a) && Number.isFinite(c)) ? a - c : NaN;
      return {
        F,
        dIp: d(s1.ipLog, s0.ipLog), dEp: d(s1.epLog, s0.epLog), dRm: d(s1.rmLog, s0.rmLog),
        dInf: d(s1.inf, s0.inf), dEter: d(s1.eter, s0.eter), dReal: d(s1.realities, s0.realities),
        dGame: s1.game - s0.game,
        end: s1,
      };
    }, saveText, F, FRAME_MS, BUDGET_FRAMES, true);
    stageRows.push({ stage: st.key, ...r, name: st.name });
    const e2 = v => (Number.isFinite(v) ? v.toExponential(2) : "—");
    console.log(`  ${String(F).padStart(6)} ${e2(r.dIp).padStart(11)} ${e2(r.dEp).padStart(11)} ${e2(r.dRm).padStart(11)} ${e2(r.dInf).padStart(9)} ${e2(r.dEter).padStart(9)} ${e2(r.dReal).padStart(9)} ${String(r.end.speedup?.toExponential(2) ?? "—").padStart(12)} ${String(r.end.bh).padStart(7)} ${String(r.end.dilation).padStart(5)} ${String(r.end.doomed).padStart(5)} ${String(Number(r.end.gameEnd).toFixed(2)).padStart(6)}`);
  }
}

// 落盘，便于下次对照
const out = {
  generatedAt: new Date().toISOString(),
  frameMs: FRAME_MS,
  part1_fresh: freshRows,
  part2_stages: stageRows,
};
const outFile = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/baseline-progression.json";
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\n已写入基线数据：${outFile}`);

console.log("\n========== 判读提醒 ==========");
console.log("· Part 1 的「墙钟(推算)」= 帧数 × 20ms，是 50fps 理想值，不是真实浏览器计时。");
console.log("· Part 2 的预算固定为 10s 墙钟；**不同阶段/不同 F 的 Δ 只能与同阶段的另一 F 比**，");
console.log("  不能横向比较不同阶段，也不能把「游戏时间推进更多」当成「通关更快」。");
console.log("· 帧内只有一次 greedy()，所以高 F 下自动买相对游戏时间是「每 F 毫秒一次」，本基线已固定这一点。");

await browser.close();
server.close();
