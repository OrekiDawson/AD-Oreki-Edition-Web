// 线上站点验收：真实 URL，不依赖本地预览
// 用法: node verify-live.mjs [url]
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const URL = process.argv[2] ?? "https://orekidawson.github.io/";
const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--proxy-server=http://127.0.0.1:7897",
    "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [], failed = [];
page.on("pageerror", e => errs.push(String(e.message).slice(0, 160)));
page.on("requestfailed", r => failed.push(`${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`));
page.on("response", r => { if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 80)}`); });

const resp = await page.goto(URL, { waitUntil: "load", timeout: 120000 });
check("线上首页返回 200", resp && resp.status() === 200, `HTTP ${resp && resp.status()}`);
// 轮询等待游戏初始化完成（首次冷启动可能较慢，固定等待不可靠）
let ready = false;
const tWait = Date.now();
for (let i = 0; i < 30; i++) {
  ready = await page.evaluate(() => typeof window.player !== "undefined" && typeof window.getGlobalSpeedFactor === "function").catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 2000));
}
check("游戏初始化完成（player 已就绪）", ready, `等待 ${((Date.now() - tWait) / 1000).toFixed(1)}s`);
if (!ready) {
  console.log(`\n===== ${pass}/${pass + 1} 通过（初始化失败，后续跳过） =====`);
  await browser.close();
  process.exit(1);
}

const info = await page.evaluate(() => {
  const am0 = String(player.antimatter);
  return {
    title: document.title,
    url: location.href,
    factor: typeof getGlobalSpeedFactor === "function" ? getGlobalSpeedFactor() : null,
    am0,
    version: player.version,
    topKeys: Object.keys(player).length,
    uiText: (document.getElementById("ui")?.innerText ?? "").slice(0, 160),
    hasSpeedBox: !!document.querySelector(".c-oreki-speed"),
    lang: document.documentElement.lang,
  };
});

check("页面标题为 AD: Oreki Edition", info.title.includes("Oreki Edition"), info.title);
check("默认速度因子 = 10000", info.factor === 10000, String(info.factor));
check("存档版本 = 25", info.version === 25, `v${info.version}`);
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll(".o-tab-btn")].map(b => b.innerText.trim()).filter(Boolean));
const hasZhTabs = tabs.some(t => /维度|选项|成就|统计/.test(t));
check("主标签栏为中文", hasZhTabs, tabs.slice(0, 8).join(" / ") || "(未取到标签)");

// 游戏是否真的在跑（先买下第 1 反物质维度，否则初始产量为 0）
const growth = await page.evaluate(async () => {
  player.antimatter = new Decimal(100);
  buyOneDimension(1);
  await new Promise(r => setTimeout(r, 1500));
  const a = String(player.antimatter);
  await new Promise(r => setTimeout(r, 2000));
  return { a, b: String(player.antimatter), bought: AntimatterDimension(1).bought };
});
check("游戏主循环在运行（购买维度后反物质增长）", growth.a !== growth.b && growth.bought >= 1,
  `买 ${growth.bought} 个后 ${growth.a} → ${growth.b}`);

// 游戏时间 / 现实时间比值
const ratio = await page.evaluate(async () => {
  const g0 = player.records.totalTimePlayed, r0 = player.records.realTimePlayed, w0 = Date.now();
  await new Promise(r => setTimeout(r, 2000));
  const w = Date.now() - w0;
  return {
    game: (player.records.totalTimePlayed - g0) / w,
    real: (player.records.realTimePlayed - r0) / w,
    factor: getGlobalSpeedFactor(),
  };
});
check("游戏时间按 10000× 推进", Math.abs(ratio.game - 10000) / 10000 < 0.1, `${ratio.game.toFixed(0)}×`);
check("现实时间统计为 1×（未被加速）", ratio.real > 0.8 && ratio.real < 1.3, `${ratio.real.toFixed(2)}×`);

// 设置页里的速度区块（选项 → 游戏玩法）
await page.evaluate(() => {
  const opt = Tabs.all.find(t => t.config.key === "options");
  if (opt) {
    opt.show();
    const sub = opt.subtabs.find(s => s.key === "gameplay");
    if (sub) sub.show();
  }
});
await new Promise(r => setTimeout(r, 1500));
const optInfo = await page.evaluate(() => ({
  hasBox: !!document.querySelector(".c-oreki-speed"),
  hasField: !!document.querySelector(".c-oreki-speed__field"),
  hasPresets: document.querySelectorAll(".c-oreki-speed__preset").length,
  text: (document.body.innerText.match(/游戏速度：×[^\n]*/) ?? [""])[0],
}));
check("设置页存在「游戏速度」区块", optInfo.hasBox && optInfo.hasField,
  optInfo.hasBox ? `${optInfo.text}（预设 ${optInfo.hasPresets} 个）` : "未找到 .c-oreki-speed");

// 手机视口
const mp = await browser.newPage();
await mp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
await mp.goto(URL, { waitUntil: "load", timeout: 120000 });
for (let i = 0; i < 30; i++) {
  const ok = await mp.evaluate(() => typeof window.player !== "undefined").catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 2000));
}
await new Promise(r => setTimeout(r, 1500));
const mob = await mp.evaluate(() => {
  const b = document.querySelectorAll("button");
  const hs = [...b].map(x => x.getBoundingClientRect().height).filter(h => h > 0);
  return {
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    innerW: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
    am: String(player.antimatter),
    minBtn: hs.length ? Math.min(...hs).toFixed(0) : "n/a",
    buttons: b.length,
  };
});
check("手机视口无横向溢出", mob.noOverflow, `innerWidth=${mob.innerW} scrollWidth=${mob.scrollW}`);
check("手机视口游戏可启动", mob.am !== "0" && mob.am !== "undefined", `反物质=${mob.am}`);
check("手机视口存在可点击按钮", mob.buttons > 0, `${mob.buttons} 个`);

console.log("\n──── 网络与控制台 ────");
const realFailed = failed.filter(f => !/googletagmanager|google-analytics|adsbygoogle|doubleclick/i.test(f));
check("无资源加载失败（已排除统计脚本）", realFailed.length === 0,
  realFailed.slice(0, 4).join(" | ") || "无");
const realErrs = errs.filter(e => !/googletagmanager|ads|Content Security Policy/i.test(e));
check("无未捕获的运行时异常", realErrs.length === 0, realErrs.slice(0, 3).join(" | ") || "无");

console.log(`\n===== ${pass}/${pass + fail} 通过 =====`);
if (errs.length || failed.length) {
  console.log("（以下为被排除的第三方条目，供参考）");
  [...errs.slice(0, 3), ...failed.slice(0, 5)].forEach(x => console.log("   ", x));
}

await browser.close();
process.exit(fail === 0 ? 0 : 1);
