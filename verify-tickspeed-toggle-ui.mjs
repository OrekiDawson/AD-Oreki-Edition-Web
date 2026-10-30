// Tick Speed 自动购买器间隔缩放：设置页入口、与 AD 开关的独立性、持久化
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8094);
const AD_KEY = "oreki-autobuyer-interval-scale";
const TS_KEY = "oreki-tickspeed-autobuyer-interval-scale";

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
await page.setViewport({ width: 1280, height: 1000 });
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const load = async () => {
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
  await sleep(6000);
};

const openGameplayOptions = async () => {
  await page.evaluate(() => {
    player.antimatter = new Decimal("1e100");
    player.records.totalAntimatter = new Decimal("1e100");
    GameUI.update();
    const opt = Tabs.all.find(t => t.config.key === "options");
    if (opt) {
      opt.show();
      const sub = opt.subtabs.find(s => s.key === "gameplay");
      if (sub) sub.show();
    }
  });
  await sleep(1200);
};

const state = () => page.evaluate(({ AD_KEY, TS_KEY }) => {
  const ts = document.querySelector(".c-oreki-speed__tickspeed-toggle");
  const ad = document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)");
  const adB = Autobuyer.antimatterDimension.zeroIndexed[0];
  const tsB = Autobuyer.tickspeed;
  return {
    factor: getGlobalSpeedFactor(),
    adFlag: GameSpeed.scaleAutobuyerInterval,
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    adStored: window.localStorage.getItem(AD_KEY),
    tsStored: window.localStorage.getItem(TS_KEY),
    tsText: ts ? ts.textContent.replace(/\s+/gu, " ").trim() : "(缺失)",
    adText: ad ? ad.textContent.replace(/\s+/gu, " ").trim() : "(缺失)",
    hasTsHint: document.body.innerText.includes("Tick Speed 自动购买器的购买间隔会按游戏速度倍率缩短"),
    hasTsScope: document.body.innerText.includes("仅影响 Tick Speed 自动购买器"),
    ad: { interval: adB.interval, eff: adB.effectiveInterval },
    ts: { interval: tsB.interval, eff: tsB.effectiveInterval },
    others: ["dimboost", "galaxy", "bigCrunch"].map(k => ({
      key: k, same: Autobuyer[k].effectiveInterval === Autobuyer[k].interval,
    })),
  };
}, { AD_KEY, TS_KEY });

const click = async sel => {
  await page.evaluate(s => document.querySelector(s).click(), sel);
  await sleep(500);
};

// ---------- 1. 冷启动默认 ----------
await load();
await page.evaluate(({ AD_KEY, TS_KEY }) => {
  window.localStorage.removeItem(AD_KEY);
  window.localStorage.removeItem(TS_KEY);
}, { AD_KEY, TS_KEY });
await load();
const cold = await state();
check("冷启动两个开关都默认关闭", cold.adFlag === false && cold.tsFlag === false,
  `ad=${cold.adFlag} tickspeed=${cold.tsFlag}`);
check("冷启动未写入 Tick Speed 的 localStorage 键", cold.tsStored === null, `key=${JSON.stringify(cold.tsStored)}`);
check("冷启动两个购买器的生效间隔都等于原间隔",
  cold.ts.eff === cold.ts.interval && cold.ad.eff === cold.ad.interval,
  `ts ${cold.ts.interval}→${cold.ts.eff}；ad ${cold.ad.interval}→${cold.ad.eff}`);

// ---------- 2. 入口与文案 ----------
await openGameplayOptions();
const ui0 = await state();
check("设置页出现 Tick Speed 开关", ui0.tsText !== "(缺失)", `「${ui0.tsText}」`);
check("Tick Speed 开关默认显示「关闭」", ui0.tsText.includes("Tick Speed 购买器间隔随倍率缩短") && ui0.tsText.endsWith("关闭"), ui0.tsText);
check("文案说明作用范围（仅 Tick Speed）", ui0.hasTsScope);
check("文案说明「间隔按倍率缩短」", ui0.hasTsHint);
check("AD 开关仍然独立存在且为关闭", ui0.adText.endsWith("关闭"), ui0.adText);

// ---------- 3. 独立性：只开 AD 开关不牵动 Tick Speed ----------
await click(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)");
const adOn = await state();
check("打开 AD 开关后 Tick Speed 间隔不变（开关互不牵连）",
  adOn.adFlag === true && adOn.tsFlag === false && adOn.ts.eff === adOn.ts.interval,
  `adEff=${adOn.ad.eff} tsEff=${adOn.ts.eff} tsFlag=${adOn.tsFlag}`);
check("打开 AD 开关后 Tick Speed 的 localStorage 键仍未被写入", adOn.tsStored === null, `key=${JSON.stringify(adOn.tsStored)}`);

// ---------- 4. 只开 Tick Speed 开关 ----------
await click(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)"); // 关掉 AD
await click(".c-oreki-speed__tickspeed-toggle");
const tsOn = await state();
check("打开 Tick Speed 开关后写入 localStorage = 1", tsOn.tsStored === "1", `key=${JSON.stringify(tsOn.tsStored)}`);
check("界面显示「开启」", tsOn.tsText.endsWith("开启"), tsOn.tsText);
check("Tick Speed 间隔被缩放到 interval / 倍率",
  Math.abs(tsOn.ts.eff - tsOn.ts.interval / 10000) < 1e-9,
  `${tsOn.ts.interval} → ${tsOn.ts.eff}`);
check("AD 间隔不受 Tick Speed 开关影响",
  tsOn.adFlag === false && tsOn.ad.eff === tsOn.ad.interval,
  `adEff=${tsOn.ad.eff} adInterval=${tsOn.ad.interval}`);
check("维度提升/星系/大坍塌 间隔不受影响", tsOn.others.every(x => x.same),
  tsOn.others.map(x => `${x.key}:${x.same}`).join(", "));

// ---------- 5. 刷新后保持 ----------
await load();
const afterReload = await page.evaluate(() => ({
  ts: GameSpeed.scaleTickspeedAutobuyerInterval, ad: GameSpeed.scaleAutobuyerInterval,
}));
check("刷新后 Tick Speed 开关仍为开启、AD 仍为关闭",
  afterReload.ts === true && afterReload.ad === false, `ts=${afterReload.ts} ad=${afterReload.ad}`);
await openGameplayOptions();
const uiReload = await state();
check("刷新后界面状态与持久化一致", uiReload.tsText.endsWith("开启") && uiReload.adText.endsWith("关闭"),
  `ts「${uiReload.tsText}」 ad「${uiReload.adText}」`);

// ---------- 6. 关闭 ----------
await click(".c-oreki-speed__tickspeed-toggle");
const tsOff = await state();
check("关闭后写入 localStorage = 0", tsOff.tsStored === "0", `key=${JSON.stringify(tsOff.tsStored)}`);
check("关闭后间隔恢复原值", tsOff.ts.eff === tsOff.ts.interval, `${tsOff.ts.interval} → ${tsOff.ts.eff}`);
check("关闭后界面显示「关闭」", tsOff.tsText.endsWith("关闭"), tsOff.tsText);

// ---------- 7. 刷新后保持关闭 ----------
await load();
const offReload = await page.evaluate(() => GameSpeed.scaleTickspeedAutobuyerInterval);
check("刷新后开关仍为关闭", offReload === false, `ts=${offReload}`);

// ---------- 8. F=1 时行为不变 ----------
const f1 = await page.evaluate(() => {
  OrekiSpeed.set(1);
  GameSpeed.setScaleTickspeedAutobuyerInterval(true);
  const b = Autobuyer.tickspeed;
  return { factor: getGlobalSpeedFactor(), interval: b.interval, eff: b.effectiveInterval };
});
check("×1 下开启开关不改变 Tick Speed 间隔",
  f1.factor === 1 && f1.eff === f1.interval, `factor=${f1.factor} ${f1.interval} → ${f1.eff}`);

// ---------- 9. 端到端：开启后同现实窗口内的触发次数显著增加，×1 时完全一致 ----------
const behavior = await page.evaluate(() => {
  // 上一节 reload 过页面，这里是全新存档：先满足 Tick Speed 的购买前置（解锁第二维度 + 给足反物质）
  player.antimatter = new Decimal("1e200");
  AntimatterDimension(2).bought = 1; // bought 是 number 字段，走 setter 而不是塞 Decimal
  const b = Autobuyer.tickspeed;
  if (!b.isBought) b.data.isBought = true;
  b.isActive = true;
  player.auto.autobuyersOn = true;
  const orig = b.tick.bind(b);
  let n = 0;
  b.tick = (...args) => { n++; return orig(...args); };

  const runFrames = (frames, ms) => { for (let i = 0; i < frames; i++) gameLoop(ms); };
  const avail = () => ({
    available: Tickspeed.isAvailableForPurchase,
    affordable: Tickspeed.isAffordable,
    canTick: b.canTick,
  });

  OrekiSpeed.set(10000);
  GameSpeed.setScaleTickspeedAutobuyerInterval(false);
  const diagOff = avail();
  n = 0; runFrames(120, 20);
  const off = n;
  GameSpeed.setScaleTickspeedAutobuyerInterval(true);
  n = 0; runFrames(120, 20);
  const on = n;
  const diagOn = avail();

  OrekiSpeed.set(1);
  player.antimatter = new Decimal("1e200");
  GameSpeed.setScaleTickspeedAutobuyerInterval(false);
  n = 0; runFrames(60, 20);
  const offF1 = n;
  GameSpeed.setScaleTickspeedAutobuyerInterval(true);
  n = 0; runFrames(60, 20);
  const onF1 = n;

  delete b.tick;
  GameSpeed.setScaleTickspeedAutobuyerInterval(false);
  OrekiSpeed.resetDefault();
  return { off, on, offF1, onF1, diagOff, diagOn };
});
check("Tick Speed 购买前置成立（否则行为断言无意义）",
  behavior.diagOff.available && behavior.diagOff.affordable,
  `available=${behavior.diagOff.available} affordable=${behavior.diagOff.affordable}`);
check("F=10000 同窗口内 Tick Speed 触发次数显著增加（≥3×）",
  behavior.off >= 1 && behavior.on >= behavior.off * 3,
  `off ${behavior.off} 次 → on ${behavior.on} 次（${(behavior.on / Math.max(behavior.off, 1)).toFixed(1)}×）`);
check("×1 下同窗口触发次数完全一致（行为不变）",
  behavior.offF1 === behavior.onF1, `off ${behavior.offF1} 次 vs on ${behavior.onF1} 次`);

// ---------- 10. 存档结构未被污染 ----------
const pollution = await page.evaluate(() => Object.keys(player.options)
  .filter(k => /autobuyer.*(scale|interval)|scaleAutobuyer|tickspeed.*scale/i.test(k)));
check("未向存档 player.options 新增开关字段", pollution.length === 0, pollution.join(",") || "无新增字段");

// ---------- 10. 运行时错误 ----------
check("无未捕获的运行时异常", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

// 还原默认
await page.evaluate(({ AD_KEY, TS_KEY }) => {
  OrekiSpeed.resetDefault();
  GameSpeed.setScaleAutobuyerInterval(false);
  GameSpeed.setScaleTickspeedAutobuyerInterval(false);
  window.localStorage.removeItem(AD_KEY);
  window.localStorage.removeItem(TS_KEY);
}, { AD_KEY, TS_KEY });

await browser.close();
server.close();

const failed = results.filter(r => !r.pass);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
