// 线上验收：Tick Speed 购买器间隔缩放开关（默认关闭 / 与 AD 开关独立 / 生效）
// 用法：
//   node verify-live-tickspeed.mjs                  → 直接打 https://oreki.net
//   node verify-live-tickspeed.mjs --serve-deploy   → 本地托管 _deploy/site（与线上同字节）后验收
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";

const SERVE_DEPLOY = process.argv.includes("--serve-deploy");
const DEPLOY_DIR = path.resolve("C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_deploy/site");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ttf": "font/ttf",
  ".woff": "font/woff", ".woff2": "font/woff2", ".otf": "font/otf", ".ico": "image/x-icon" };

let server = null;
let URL = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "https://oreki.net/";
if (SERVE_DEPLOY) {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(DEPLOY_DIR, p);
    if (!f.startsWith(DEPLOY_DIR)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404).end("nf"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(8098, "127.0.0.1", r));
  URL = "http://127.0.0.1:8098/";
}

const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--no-proxy-server", "--ignore-certificate-errors"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message).slice(0, 160)));

const resp = await page.goto(URL, { waitUntil: "load", timeout: 120000 });
check("线上首页返回 200", resp && resp.status() === 200, `HTTP ${resp && resp.status()}`);

let ready = false;
for (let i = 0; i < 40; i++) {
  ready = await page.evaluate(() => {
    try { return typeof player !== "undefined" && typeof Tabs !== "undefined" && typeof GameSpeed !== "undefined"; } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await sleep(2000);
}
check("游戏初始化完成", ready);
if (!ready) { await browser.close(); process.exit(1); }

// 清掉本机遗留的开关状态，模拟首次访问
await page.evaluate(() => {
  window.localStorage.removeItem("oreki-autobuyer-interval-scale");
  window.localStorage.removeItem("oreki-tickspeed-autobuyer-interval-scale");
});
await page.reload({ waitUntil: "load", timeout: 120000 });
for (let i = 0; i < 40; i++) {
  ready = await page.evaluate(() => { try { return typeof player !== "undefined"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await sleep(2000);
}

await page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  opt.show();
  opt.subtabs.find(s => s.key === "gameplay").show();
});
await sleep(1500);

const before = await page.evaluate(() => {
  const ts = document.querySelector(".c-oreki-speed__tickspeed-toggle");
  const ad = document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)");
  return {
    hasTs: !!ts, hasAd: !!ad,
    tsText: ts ? ts.textContent.replace(/\s+/gu, " ").trim() : "",
    adText: ad ? ad.textContent.replace(/\s+/gu, " ").trim() : "",
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    adFlag: GameSpeed.scaleAutobuyerInterval,
    hasScope: document.body.innerText.includes("仅影响 Tick Speed 自动购买器"),
  };
});
check("线上设置页出现 Tick Speed 开关", before.hasTs, `「${before.tsText}」`);
check("线上两个开关都默认关闭", before.tsFlag === false && before.adFlag === false && before.tsText.endsWith("关闭"),
  `ts=${before.tsFlag} ad=${before.adFlag}`);
check("线上文案包含作用范围", before.hasScope);

// 打开 AD 开关：Tick Speed 必须不受影响
await page.evaluate(() => document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)").click());
await sleep(400);
const adOnly = await page.evaluate(() => {
  const adB = Autobuyer.antimatterDimension.zeroIndexed[0];
  const tsB = Autobuyer.tickspeed;
  return {
    adFlag: GameSpeed.scaleAutobuyerInterval,
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    adEff: adB.effectiveInterval, adRaw: adB.interval,
    tsEff: tsB.effectiveInterval, tsRaw: tsB.interval,
  };
});
check("只开 AD 开关时 Tick Speed 间隔不变（线上确认互相独立）",
  adOnly.adFlag === true && adOnly.tsFlag === false && adOnly.tsEff === adOnly.tsRaw,
  `ad ${adOnly.adRaw}→${adOnly.adEff}；ts ${adOnly.tsRaw}→${adOnly.tsEff}`);

// 关 AD、开 Tick Speed
await page.evaluate(() => document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)").click());
await sleep(300);
await page.evaluate(() => document.querySelector(".c-oreki-speed__tickspeed-toggle").click());
await sleep(500);
const tsOn = await page.evaluate(() => {
  const adB = Autobuyer.antimatterDimension.zeroIndexed[0];
  const tsB = Autobuyer.tickspeed;
  return {
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    stored: window.localStorage.getItem("oreki-tickspeed-autobuyer-interval-scale"),
    text: document.querySelector(".c-oreki-speed__tickspeed-toggle").textContent.replace(/\s+/gu, " ").trim(),
    tsEff: tsB.effectiveInterval, tsRaw: tsB.interval,
    adEff: adB.effectiveInterval, adRaw: adB.interval,
    factor: getGlobalSpeedFactor(),
  };
});
check("线上点击后 Tick Speed 开关生效并持久化",
  tsOn.tsFlag === true && tsOn.stored === "1" && tsOn.text.endsWith("开启"),
  `flag=${tsOn.tsFlag} stored=${tsOn.stored}`);
check("线上 Tick Speed 间隔 = interval / 倍率、AD 不受牵连",
  Math.abs(tsOn.tsEff - tsOn.tsRaw / tsOn.factor) < 1e-9 && tsOn.adEff === tsOn.adRaw,
  `ts ${tsOn.tsRaw}→${tsOn.tsEff}（F=${tsOn.factor}）；ad ${tsOn.adRaw}→${tsOn.adEff}`);

check("线上无未捕获异常", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
if (server) server.close();
console.log(`\n===== ${pass}/${pass + fail} 通过 =====`);
process.exit(fail ? 1 : 0);
