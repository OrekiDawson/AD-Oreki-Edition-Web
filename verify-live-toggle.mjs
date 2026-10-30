// 线上验收：设置页开关是否已随部署更新（只读浏览 + 抛一次性浏览器配置）
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const URL = process.argv[2] ?? "https://oreki.net/";
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
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio",
    // 直连：经本机代理时证书校验器会被中间人替换，模块会整批 ERR_CERT_VERIFIER_CHANGED
    "--no-proxy-server", "--ignore-certificate-errors"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message).slice(0, 160)));

const resp = await page.goto(URL, { waitUntil: "load", timeout: 120000 });
check("线上首页返回 200", resp && resp.status() === 200, `HTTP ${resp && resp.status()}`);

let ready = false;
for (let i = 0; i < 40; i++) {
  // 本项目的全局挂在全局词法环境（不是 window 属性），必须用裸标识符探测
  ready = await page.evaluate(() => {
    try {
      return typeof player !== "undefined" && typeof Tabs !== "undefined" && typeof GameSpeed !== "undefined";
    } catch (e) {
      return false;
    }
  }).catch(() => false);
  if (ready) break;
  await sleep(2000);
}
check("游戏初始化完成（player / GameSpeed 就绪）", ready);
if (!ready) {
  await browser.close();
  process.exit(1);
}

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
await sleep(1500);

const before = await page.evaluate(() => {
  const t = document.querySelector(".c-oreki-speed__autobuyer-toggle");
  return {
    hasToggle: !!t,
    text: t ? t.textContent.replace(/\s+/gu, " ").trim() : "",
    flag: GameSpeed.scaleAutobuyerInterval,
    hasHint: document.body.innerText.includes("反物质维度自动购买器的购买间隔会按游戏速度倍率缩短"),
  };
});
check("线上设置页出现开关", before.hasToggle, `「${before.text}」`);
check("线上默认关闭", before.flag === false && before.text.endsWith("关闭"), `flag=${before.flag}`);
check("线上文案包含作用说明", before.hasHint);

if (before.hasToggle) {
  await page.evaluate(() => document.querySelector(".c-oreki-speed__autobuyer-toggle").click());
  await sleep(500);
  const after = await page.evaluate(() => {
    const ad = Autobuyer.antimatterDimension.zeroIndexed[0];
    return {
      flag: GameSpeed.scaleAutobuyerInterval,
      stored: window.localStorage.getItem("oreki-autobuyer-interval-scale"),
      text: document.querySelector(".c-oreki-speed__autobuyer-toggle").textContent.replace(/\s+/gu, " ").trim(),
      adScaled: ad.usesSpeedScaledInterval,
      adInterval: ad.interval,
      adEffective: ad.effectiveInterval,
      tickspeedSame: Autobuyer.tickspeed.effectiveInterval === Autobuyer.tickspeed.interval,
    };
  });
  check("线上点击后开关生效并持久化", after.flag === true && after.stored === "1" && after.text.endsWith("开启"),
    `flag=${after.flag} stored=${after.stored}`);
  check("线上开关影响反物质维度间隔、不影响 Tick Speed",
    after.adScaled && Math.abs(after.adEffective - after.adInterval / 10000) < 1e-9 && after.tickspeedSame,
    `AD ${after.adInterval} → ${after.adEffective}`);
}

check("线上无未捕获异常", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n===== ${pass}/${pass + fail} 通过 =====`);
process.exit(fail ? 1 : 0);
