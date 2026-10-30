// 关键文件：官方 vs 本项目 —— 区分「原版继承 / Mod 定制 / 本次修复」
import fs from "node:fs";

const OFF = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/upstream/official/src/";
const OURS = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition/src/";

const FILES = [
  "game.js",
  "core/normal-challenges.js",
  "core/infinity-challenges.js",
  "core/reality.js",
  "core/time.js",
  "core/big-crunch.js",
  "core/eternity.js",
  "core/player.js",
  "core/secret-formula/reality/reality-upgrades.js",
];

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const count = (s, re) => (s.match(re) || []).length;

console.log("文件 | 官方行数 | 本项目行数 | 官方 getGlobalSpeedFactor | 本项目 getGlobalSpeedFactor | 官方 inGameTime | 本项目 inGameTime | 官方 bestRealTimes | 本项目 bestRealTimes");
console.log("---|---|---|---|---|---|---|---|---");
for (const f of FILES) {
  const o = read(OFF + f);
  const u = read(OURS + f);
  console.log([
    f,
    o.split("\n").length,
    u.split("\n").length,
    count(o, /getGlobalSpeedFactor/g),
    count(u, /getGlobalSpeedFactor/g),
    count(o, /inGameTime/g),
    count(u, /inGameTime/g),
    count(o, /bestRealTimes/g),
    count(u, /bestRealTimes/g),
  ].join(" | "));
}

// 逐行对比：忽略纯注释/纯字符串翻译的差异，找出「代码行」差异
function codeLines(src) {
  return src
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"))
    // 去掉中文注释尾巴（行尾 // ...）
    .map(l => l.replace(/\s*\/\/.*$/, ""));
}

console.log("\n=== 代码行差异（忽略注释与空行）===");
for (const f of FILES) {
  const o = codeLines(read(OFF + f));
  const u = codeLines(read(OURS + f));
  // 只统计「官方有、本项目无」的行，避免被中文翻译淹没
  const uSet = new Set(u);
  const missing = o.filter(l => !uSet.has(l));
  const logic = missing.filter(l => !/["'`][^"'`]*[\u4e00-\u9fa5]/.test(l));
  console.log(`${f}: 官方代码行 ${o.length}，本项目代码行 ${u.length}，官方独有 ${missing.length}（其中不含中文的非翻译行 ${logic.length}）`);
  for (const l of logic.slice(0, 12)) console.log("    - " + l.slice(0, 120));
  if (logic.length > 12) console.log(`    ... 另有 ${logic.length - 12} 行`);
}
