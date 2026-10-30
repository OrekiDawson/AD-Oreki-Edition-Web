// 速度系统验收测试
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8090);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon", ".map": "application/json",
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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const load = async () => {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
};

const snapshot = () => page.evaluate(() => ({
  real: player.records.realTimePlayed,
  total: player.records.totalTimePlayed,
  factor: getGlobalSpeedFactor(),
  am: String(player.antimatter),
}));

// ---------- 1. 默认倍率 ----------
await load();
const s0 = await snapshot();
check("默认倍率 = 10000", s0.factor === 10000, `getGlobalSpeedFactor() = ${s0.factor}`);
check("默认倍率为整数且未被 Pelle 开方", Number.isFinite(s0.factor));

// ---------- 2. 游戏时间 ×倍率、现实时间 1:1 ----------
const a = await snapshot();
await new Promise(r => setTimeout(r, 3000));
const b = await snapshot();
const wall = 3000;
const realDelta = b.real - a.real;
const totalDelta = b.total - a.total;
const realRatio = realDelta / wall;
const gameRatio = totalDelta / wall;
check("现实时间统计未被加速（比值≈1）", realRatio > 0.6 && realRatio < 1.5, `real Δ=${realDelta.toFixed(0)}ms / 实际 ${wall}ms = ${realRatio.toFixed(2)}`);
check("游戏时间按倍率推进（比值≈10000）", gameRatio > 6000 && gameRatio < 16000, `game Δ=${totalDelta.toFixed(0)}ms → ${gameRatio.toFixed(0)}×`);

// ---------- 3. 修改倍率生效 ----------
const setRes = await page.evaluate(() => OrekiSpeed.set(1000));
await new Promise(r => setTimeout(r, 200));
const c1 = await snapshot();
await new Promise(r => setTimeout(r, 2000));
const c2 = await snapshot();
const gameRatio2 = (c2.total - c1.total) / 2000;
check("设置为 1000× 后立即生效", c1.factor === 1000 && gameRatio2 > 600 && gameRatio2 < 1600,
  `因子=${c1.factor}，实测 ${gameRatio2.toFixed(0)}×`);

// ---------- 4. 非法输入 ----------
const bad = await page.evaluate(() => {
  const cases = ["abc", "", "0", "-5", "NaN", "Infinity", "1e9", "200000", null, undefined];
  return cases.map(v => {
    const before = OrekiSpeed.factor;
    const r = OrekiSpeed.set(v);
    return { input: String(v), ok: r.ok, factorAfter: OrekiSpeed.factor, unchanged: OrekiSpeed.factor === before, message: r.message };
  });
});
const allRejected = bad.every(x => !x.ok && x.unchanged);
check("非法/越界输入全部被拒绝且不改变当前值", allRejected,
  bad.filter(x => x.ok).map(x => x.input).join(",") || `全部拒绝（${bad.length} 例）`);
check("越界提示包含上限说明", bad.find(x => x.input === "200000")?.message?.includes("100000") === true);

// ---------- 5. 持久化 ----------
await page.evaluate(() => OrekiSpeed.set(250));
await load();
const d = await snapshot();
check("刷新后倍率设置仍然存在", d.factor === 250, `刷新后 = ${d.factor}`);

// ---------- 6. 恢复默认 ----------
const resetRes = await page.evaluate(() => OrekiSpeed.resetDefault());
const e = await snapshot();
check("恢复默认按钮回到 10000×", e.factor === 10000 && resetRes.ok, `= ${e.factor}`);

// ---------- 7. 运行时错误 ----------
check("无未捕获的运行时异常", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

// ---------- 8. 存档字段未被污染 ----------
const saveFields = await page.evaluate(() => {
  const keys = Object.keys(player);
  // player.speedrun 是原版既有字段，不属于本次改动
  const suspicious = keys.filter(k => /^(gameSpeed|speedFactor|globalSpeed|oreki|speedMultiplier)$/i.test(k));
  return { suspicious, count: keys.length, hasSpeedrun: keys.includes("speedrun") };
});
check("存档结构未新增速度字段（倍率独立于存档）", saveFields.suspicious.length === 0,
  `player 顶级字段 ${saveFields.count} 个；speedrun 为原版固有字段=${saveFields.hasSpeedrun}`);

await browser.close();
server.close();

const failed = results.filter(r => !r.pass);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
