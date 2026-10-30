// 鍏抽敭鏂囦欢锛氬畼鏂?vs 鏈」鐩?鈥斺€?鍖哄垎銆屽師鐗堢户鎵?/ Mod 瀹氬埗 / 鏈淇銆?import fs from "node:fs";

const OFF = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/upstream/official/src/";
const OURS = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/";

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

console.log("鏂囦欢 | 瀹樻柟琛屾暟 | 鏈」鐩鏁?| 瀹樻柟 getGlobalSpeedFactor | 鏈」鐩?getGlobalSpeedFactor | 瀹樻柟 inGameTime | 鏈」鐩?inGameTime | 瀹樻柟 bestRealTimes | 鏈」鐩?bestRealTimes");
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

// 閫愯瀵规瘮锛氬拷鐣ョ函娉ㄩ噴/绾瓧绗︿覆缈昏瘧鐨勫樊寮傦紝鎵惧嚭銆屼唬鐮佽銆嶅樊寮?function codeLines(src) {
  return src
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"))
    // 鍘绘帀涓枃娉ㄩ噴灏惧反锛堣灏?// ...锛?    .map(l => l.replace(/\s*\/\/.*$/, ""));
}

console.log("\n=== 浠ｇ爜琛屽樊寮傦紙蹇界暐娉ㄩ噴涓庣┖琛岋級===");
for (const f of FILES) {
  const o = codeLines(read(OFF + f));
  const u = codeLines(read(OURS + f));
  // 鍙粺璁°€屽畼鏂规湁銆佹湰椤圭洰鏃犮€嶇殑琛岋紝閬垮厤琚腑鏂囩炕璇戞饭娌?  const uSet = new Set(u);
  const missing = o.filter(l => !uSet.has(l));
  const logic = missing.filter(l => !/["'`][^"'`]*[\u4e00-\u9fa5]/.test(l));
  console.log(`${f}: 瀹樻柟浠ｇ爜琛?${o.length}锛屾湰椤圭洰浠ｇ爜琛?${u.length}锛屽畼鏂圭嫭鏈?${missing.length}锛堝叾涓笉鍚腑鏂囩殑闈炵炕璇戣 ${logic.length}锛塦);
  for (const l of logic.slice(0, 12)) console.log("    - " + l.slice(0, 120));
  if (logic.length > 12) console.log(`    ... 鍙︽湁 ${logic.length - 12} 琛宍);
}
