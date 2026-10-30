// 自动购买器间隔缩放：设置页入口验收（默认值 / 点击 / 持久化 / 作用范围）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8091);
const KEY = "oreki-autobuyer-interval-scale";

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

const uiState = () => page.evaluate(() => {
  const toggle = document.querySelector(".c-oreki-speed__autobuyer-toggle");
  const body = document.body.innerText;
  return {
    hasToggle: !!toggle,
    toggleText: toggle ? toggle.textContent.replace(/\s+/gu, " ").trim() : "",
    hasHint: body.includes("反物质维度自动购买器的购买间隔会按游戏速度倍率缩短"),
    hasScopeHint: body.includes("仅影响反物质维度自动购买器"),
    flag: GameSpeed.scaleAutobuyerInterval,
    stored: window.localStorage.getItem("oreki-autobuyer-interval-scale"),
    factor: getGlobalSpeedFactor(),
  };
});

const clickToggle = async () => {
  await page.evaluate(() => {
    const toggle = document.querySelector(".c-oreki-speed__autobuyer-toggle");
    toggle.click();
  });
  await sleep(500);
};

const intervals = () => page.evaluate(() => {
  const ad = Autobuyer.antimatterDimension.zeroIndexed[0];
  const plain = ["tickspeed", "galaxy", "dimboost", "bigCrunch"];
  return {
    ad: { interval: ad.interval, effective: ad.effectiveInterval, scaled: ad.usesSpeedScaledInterval },
    others: plain.map(k => ({
      key: k,
      interval: Autobuyer[k].interval,
      effective: Autobuyer[k].effectiveInterval,
      scaled: Autobuyer[k].usesSpeedScaledInterval,
      same: Autobuyer[k].effectiveInterval === Autobuyer[k].interval,
    })),
    factor: getGlobalSpeedFactor(),
  };
});

// ---------- 1. 冷启动默认值 ----------
await load();
await page.evaluate(k => window.localStorage.removeItem(k), KEY);
await load();
const cold = await uiState();
check("冷启动默认关闭（内存标志）", cold.flag === false, `scaleAutobuyerInterval = ${cold.flag}`);
check("冷启动未写入 localStorage（保持未设置）", cold.stored === null, `key = ${JSON.stringify(cold.stored)}`);
check("冷启动默认倍率仍为 10000", cold.factor === 10000, `factor = ${cold.factor}`);

// ---------- 2. 设置页入口 ----------
await openGameplayOptions();
const ui0 = await uiState();
check("游戏玩法页存在开关按钮", ui0.hasToggle, `按钮文本「${ui0.toggleText}」`);
check("默认显示为「关闭」", ui0.toggleText.includes("自动购买器间隔随倍率缩短") && ui0.toggleText.endsWith("关闭"), ui0.toggleText);
check("文案说明作用范围（仅反物质维度）", ui0.hasScopeHint);
check("文案说明「间隔按倍率缩短」", ui0.hasHint);

// ---------- 3. 手动开启 ----------
await clickToggle();
const on = await uiState();
check("点击后开关打开", on.flag === true, `flag = ${on.flag}`);
check("开启后写入 localStorage = 1", on.stored === "1", `key = ${JSON.stringify(on.stored)}`);
check("开启后界面显示「开启」（PrimaryToggleButton 的 on 文案）", on.toggleText.endsWith("开启"), on.toggleText);

// ---------- 4. 作用范围：只影响反物质维度购买器 ----------
const onIntervals = await intervals();
check("反物质维度购买器声明按倍率缩放", onIntervals.ad.scaled === true);
check("反物质维度间隔被缩放到 interval / 倍率",
  Math.abs(onIntervals.ad.effective - onIntervals.ad.interval / 10000) < 1e-9,
  `interval=${onIntervals.ad.interval} → effective=${onIntervals.ad.effective}`);
check("Tick Speed / 星系 / 维度提升 / 大坍塌 间隔不受影响",
  onIntervals.others.every(x => x.same && x.scaled === false),
  onIntervals.others.map(x => `${x.key}:${x.effective}`).join(", "));

// ---------- 5. 刷新后保持开启 ----------
await load();
const reloadedOn = await page.evaluate(() => GameSpeed.scaleAutobuyerInterval);
check("刷新后开关仍为开启（持久化生效）", reloadedOn === true, `flag = ${reloadedOn}`);
await openGameplayOptions();
const uiOnAfterReload = await uiState();
check("刷新后界面状态与持久化一致（开启）", uiOnAfterReload.toggleText.endsWith("开启"), uiOnAfterReload.toggleText);

// ---------- 6. 手动关闭 ----------
await clickToggle();
const off = await uiState();
check("点击后开关关闭", off.flag === false, `flag = ${off.flag}`);
check("关闭后写入 localStorage = 0", off.stored === "0", `key = ${JSON.stringify(off.stored)}`);
check("关闭后界面显示「关闭」", off.toggleText.endsWith("关闭"), off.toggleText);
const offIntervals = await intervals();
check("关闭后反物质维度间隔恢复为原值", offIntervals.ad.effective === offIntervals.ad.interval,
  `effective=${offIntervals.ad.effective} interval=${offIntervals.ad.interval}`);

// ---------- 7. 刷新后保持关闭 ----------
await load();
const reloadedOff = await page.evaluate(() => GameSpeed.scaleAutobuyerInterval);
check("刷新后开关仍为关闭", reloadedOff === false, `flag = ${reloadedOff}`);

// ---------- 8. F=1 时行为不变 ----------
await page.evaluate(() => OrekiSpeed.set(1));
const f1on = await page.evaluate(() => {
  GameSpeed.setScaleAutobuyerInterval(true);
  const ad = Autobuyer.antimatterDimension.zeroIndexed[0];
  return { factor: getGlobalSpeedFactor(), interval: ad.interval, effective: ad.effectiveInterval };
});
check("×1 下开启开关不改变间隔（与关闭一致）",
  f1on.factor === 1 && f1on.effective === f1on.interval,
  `factor=${f1on.factor} interval=${f1on.interval} effective=${f1on.effective}`);

// ---------- 9. 存档结构未被污染 ----------
const saveFields = await page.evaluate(() => ({
  suspicious: Object.keys(player.options).filter(k => /autobuyer.*(scale|interval)|scaleAutobuyer/i.test(k)),
}));
check("未向存档 player.options 新增开关字段（仍独立存 localStorage）",
  saveFields.suspicious.length === 0, saveFields.suspicious.join(",") || "无新增字段");

// ---------- 10. 运行时错误 ----------
check("无未捕获的运行时异常", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

// 还原到默认：倍率 10000、开关关闭
await page.evaluate(() => {
  OrekiSpeed.resetDefault();
  GameSpeed.setScaleAutobuyerInterval(false);
  window.localStorage.removeItem("oreki-autobuyer-interval-scale");
});

await browser.close();
server.close();

const failed = results.filter(r => !r.pass);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
