// 缁嗗垎锛氬摢浜?.js 閫昏緫鏂囦欢涓嶅悓锛?vue 宸紓鏄惁鍙潵鑷瀯寤轰骇鐗?import fs from "node:fs";
import path from "node:path";

const OFF = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/upstream/official/src";
const STM = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/steam/src/src";

function walk(root) {
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  rec(root);
  return out;
}

const off = walk(OFF);
const stm = walk(STM);
const stmSet = new Set(stm);
const offSet = new Set(off);

const stats = { jsSame: 0, jsDiff: [], vueSame: 0, vueDiff: 0, otherSame: 0, otherDiff: [] };
for (const f of off) {
  if (!stmSet.has(f)) continue;
  const a = fs.readFileSync(path.join(OFF, f), "utf8").replace(/\r\n/g, "\n");
  const b = fs.readFileSync(path.join(STM, f), "utf8").replace(/\r\n/g, "\n");
  const eq = a === b;
  if (f.endsWith(".js")) {
    if (eq) stats.jsSame++; else stats.jsDiff.push(f);
  } else if (f.endsWith(".vue")) {
    if (eq) stats.vueSame++; else stats.vueDiff++;
  } else {
    if (eq) stats.otherSame++; else stats.otherDiff.push(f);
  }
}

console.log("== .js 閫昏緫鏂囦欢 ==");
console.log("  閫愬瓧鑺傜浉鍚?", stats.jsSame);
console.log("  鍐呭涓嶅悓:", stats.jsDiff.length);
for (const f of stats.jsDiff) console.log("    -", f);
console.log("== .vue 鍗曟枃浠剁粍浠?==");
console.log("  鐩稿悓:", stats.vueSame, " 涓嶅悓:", stats.vueDiff, "锛坰ourcemap 閲?.vue 鏄紪璇戝垎鐗囷紝涓嶆槸鍘熷 SFC锛?);
console.log("== 鍏跺畠绫诲瀷 ==");
console.log("  鐩稿悓:", stats.otherSame, " 涓嶅悓:", stats.otherDiff.length);
for (const f of stats.otherDiff) console.log("    -", f);
console.log("== 浠呭畼鏂规湁 ==");
for (const f of off) if (!stmSet.has(f)) console.log("    -", f);
