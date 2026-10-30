// 细分：哪些 .js 逻辑文件不同；.vue 差异是否只来自构建产物
import fs from "node:fs";
import path from "node:path";

const OFF = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/upstream/official/src";
const STM = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/steam/src/src";

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

console.log("== .js 逻辑文件 ==");
console.log("  逐字节相同:", stats.jsSame);
console.log("  内容不同:", stats.jsDiff.length);
for (const f of stats.jsDiff) console.log("    -", f);
console.log("== .vue 单文件组件 ==");
console.log("  相同:", stats.vueSame, " 不同:", stats.vueDiff, "（sourcemap 里 .vue 是编译分片，不是原始 SFC）");
console.log("== 其它类型 ==");
console.log("  相同:", stats.otherSame, " 不同:", stats.otherDiff.length);
for (const f of stats.otherDiff) console.log("    -", f);
console.log("== 仅官方有 ==");
for (const f of off) if (!stmSet.has(f)) console.log("    -", f);
