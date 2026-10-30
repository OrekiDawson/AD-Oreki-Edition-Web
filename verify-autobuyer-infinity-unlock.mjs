// 定向断言：自动购买器「首次无限后接管」规则（R5.6 [Oreki AU2]）
//
// 目的：证明 Web 端的解锁时机符合本轮设计——
//   首次无限之前（infinities = 0 且未购买自动购买器）→ isUnlocked === false，自动器不接管；
//   完成过无限之后（infinities >= 1）→ isUnlocked === true，自动器接管；
//   且不依赖「伪造购买记录」（isBought 始终为 false）。
//
// 用法：node verify-autobuyer-infinity-unlock.mjs ../AD-Oreki-Edition 8450
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8450);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof GameUI === "object" && typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const probe = () => page.evaluate(() => {
  const list = (typeof Autobuyers !== "undefined" && Autobuyers.all) || [];
  const dim = list.find(a => a.tier === 1 && typeof a.interval !== "undefined" && !a.isTickspeed);
  const tick = list.find(a => a.constructor.name.includes("Tickspeed"));
  const boost = list.find(a => a.constructor.name.includes("DimBoost"));
  const galaxy = list.find(a => a.constructor.name.includes("Galaxy"));
  const crunch = list.find(a => a.constructor.name.includes("BigCrunch"));
  const snapshot = a => a ? { name: a.constructor.name, isUnlocked: a.isUnlocked, isBought: !!a.isBought, isActive: a.isActive } : null;
  return {
    count: list.length,
    dim: snapshot(dim),
    tick: snapshot(tick),
    boost: snapshot(boost),
    galaxy: snapshot(galaxy),
    crunch: snapshot(crunch),
    infinities: String(player.infinities),
    names: list.slice(0, 12).map(a => a.constructor.name),
  };
});

const setInf = (n) => page.evaluate((v) => {
  player.infinities = new Decimal(v);
  GameUI.update();
}, n);

const results = [];
const check = (name, pass, detail = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const base = await probe();
check("能定位维度自动购买器与速度自动购买器", !!base.dim && !!base.tick, JSON.stringify({ dim: base.dim, tick: base.tick, n: base.count }));
if (!base.dim) { console.log("自动购买器列表样例：" + base.names.join(", ")); }

// 首次无限之前
await setInf(0);
await new Promise(r => setTimeout(r, 600));
const before = await probe();
check("首次无限前：维度自动器未解锁（不接管手动开局）", before.dim && before.dim.isUnlocked === false, `isUnlocked=${before.dim && before.dim.isUnlocked}`);
check("首次无限前：速度自动器未解锁", !!before.tick && before.tick.isUnlocked === false, `isUnlocked=${before.tick && before.tick.isUnlocked}`);
check("首次无限前：维度提升自动器未解锁", !!before.boost && before.boost.isUnlocked === false, `isUnlocked=${before.boost && before.boost.isUnlocked}`);
check("首次无限前：反物质星系自动器未解锁", !!before.galaxy && before.galaxy.isUnlocked === false, `isUnlocked=${before.galaxy && before.galaxy.isUnlocked}`);

// 完成一次无限之后
await setInf(1);
await new Promise(r => setTimeout(r, 600));
const after = await probe();
check("首次无限后：维度自动器解锁", after.dim && after.dim.isUnlocked === true, `isUnlocked=${after.dim && after.dim.isUnlocked}`);
check("首次无限后：速度自动器解锁", !!after.tick && after.tick.isUnlocked === true, `isUnlocked=${after.tick && after.tick.isUnlocked}`);
check("首次无限后：维度提升自动器解锁", !!after.boost && after.boost.isUnlocked === true, `isUnlocked=${after.boost && after.boost.isUnlocked}`);
check("首次无限后：反物质星系自动器解锁", !!after.galaxy && after.galaxy.isUnlocked === true, `isUnlocked=${after.galaxy && after.galaxy.isUnlocked}`);
check("首次无限后：大坍缩自动器解锁", !!after.crunch && after.crunch.isUnlocked === true, `isUnlocked=${after.crunch && after.crunch.isUnlocked}`);
check("未伪造购买记录（isBought 仍为 false）", after.dim ? after.dim.isBought === false : false, `isBought=${after.dim && after.dim.isBought}`);
check("无未捕获异常", errs.length === 0, errs.slice(0, 2).join(" | "));

// [AU3] 真实购买验证：不手动点击，靠自动器把维度提升买上去
const beforeBoosts = await page.evaluate(() => player.dimensionBoosts);
await page.evaluate(() => {
  // 先暂停大坍缩自动器：坍缩会重置维度提升，否则本段测不出提升自动器的效果
  player.auto.bigCrunch.isActive = false;
  player.antimatter = new Decimal("1e80");
  player.records.totalAntimatter = new Decimal("1e80");
  // 满足提升门槛：20 个第四维度
  player.dimensions.antimatter[3].amount = new Decimal(1e30);
  player.dimensions.antimatter[3].bought = 100;
  GameUI.update();
});
await new Promise(r => setTimeout(r, 12000));
const afterBoosts = await page.evaluate(() => {
  player.auto.bigCrunch.isActive = true;
  return { boosts: player.dimensionBoosts, am: String(player.antimatter) };
});
check("维度提升自动器真实购买（无需点击）", afterBoosts.boosts > beforeBoosts, `dimensionBoosts ${beforeBoosts} → ${afterBoosts.boosts}，AM=${afterBoosts.am.slice(0, 10)}`);

// [AU4] 真实坍缩验证：把反物质推到无限阈值，观察是否零点击自动坍缩
const beforeCrunch = await page.evaluate(() => ({
  infinities: String(player.infinities),
  ip: String(player.infinityPoints),
}));
await page.evaluate(() => {
  player.break = false;
  player.auto.autobuyersOn = true;
  player.records.thisInfinity.maxAM = new Decimal("1.8e308");
  player.antimatter = new Decimal("1.8e308");
  GameUI.update();
});
await new Promise(r => setTimeout(r, 15000));
const afterCrunch = await page.evaluate(() => ({
  infinities: String(player.infinities),
  ip: String(player.infinityPoints),
  am: String(player.antimatter).slice(0, 12),
}));
check("大坍缩自动器真实执行（反物质重置、无限次数增加）",
  Number(afterCrunch.infinities) > Number(beforeCrunch.infinities),
  `infinities ${beforeCrunch.infinities} → ${afterCrunch.infinities}，IP ${beforeCrunch.ip} → ${afterCrunch.ip}`);

await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n===== ${results.length - failed}/${results.length} 通过 =====`);
if (failed) process.exitCode = 1;
