// 探测官方原版页面暴露了哪些全局符号
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: [
    "--no-sandbox",
    "--proxy-server=http://127.0.0.1:7897",
    "--proxy-bypass-list=127.0.0.1;localhost",
    "--ignore-certificate-errors",
  ],
});

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(String(e.message).slice(0, 120)));
await page.goto("https://ivark.github.io/AntimatterDimensions/", { waitUntil: "load", timeout: 120000 });
await new Promise(r => setTimeout(r, 12000));

const info = await page.evaluate(() => {
  const names = [
    "player", "Decimal", "AntimatterDimension", "Currency", "DimensionBoost", "Galaxy",
    "gainedInfinityPoints", "InfinityDimension", "gainedEternities", "EternityChallenge",
    "TimeDimension", "TimeStudy", "Reality", "MachineHandler", "Glyphs", "format",
    "getGlobalSpeedFactor", "GameStorage", "Achievement", "Autobuyer", "Autobuyers",
    "BlackHoles", "Notations", "formatX", "Time",
  ];
  const out = {};
  for (const n of names) {
    try {
      out[n] = typeof globalThis[n];
    } catch { out[n] = "throw"; }
  }
  return {
    types: out,
    title: document.title,
    version: typeof player !== "undefined" ? player.version : null,
    am: typeof player !== "undefined" ? String(player.antimatter) : null,
    uiText: document.getElementById("ui")?.innerText?.slice(0, 120) ?? "(无)",
  };
});

console.log("=== 官方原版页面 ===");
console.log("title:", info.title);
console.log("player.version:", info.version);
console.log("player.antimatter:", info.am);
console.log("界面文本:", JSON.stringify(info.uiText));
console.log("控制台错误:", errs.slice(0, 3).join(" | ") || "无");
console.log("\n=== 全局符号可用性 ===");
for (const [k, v] of Object.entries(info.types)) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}

await browser.close();
