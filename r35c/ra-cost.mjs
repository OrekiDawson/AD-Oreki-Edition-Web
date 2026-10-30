// R35-C 总账用：Ra 宠物记忆成本 vs 180 分钟可得记忆（公式逐行对齐 ra.js:276-285 / :145-175 / :212）
const T = 180 * 60;                       // 180 分钟
const cap = 25;
function req(L) {                          // ra.js:280-285
  if (L >= cap) return Infinity;
  const adj = L + Math.pow(L, 2) / 10;
  return Math.floor(Math.pow(adj, 5.52) * Math.pow(1.5, Math.max(0, L - 15)) * 1e6);
}
let cum = 0, rows = [];
for (let L = 0; L < 20; L++) { cum += req(L); if (L >= 17) rows.push([L, req(L), cum]); }
console.log("累计到 20 级所需记忆 =", cum.toExponential(3));
for (const [L, r, c] of rows) console.log(`  ${L}→${L + 1} 级: ${r.toExponential(3)}（累计 ${c.toExponential(3)}）`);

// 记忆产出模型（ra.js:206-214）：chunks 线性累积，memories = ∫ chunks·mult dt = 0.5·R·mult·T²
const rawCPS = 4 * Math.pow(4088528 / 3e5, 2);   // 实测 timeShards 1e4.09e6
console.log("\n基础 memoryChunks/秒（teresa, 实测时间碎片）= ", rawCPS.toFixed(0));

// 升级上限：memoryUpgradeCost 1000*5^n、chunkUpgradeCost 5000*25^n，
// 上限判据 cost >= 0.5*req(24)（ra.js:168-175）
const halfCap = 0.5 * req(cap - 1);
const nMem = Math.floor(Math.log(halfCap / 1000) / Math.log(5));
const nChunk = Math.floor(Math.log(halfCap / 5000) / Math.log(25));
const memMult = Math.pow(1.3, nMem), chunkMult = Math.pow(1.5, nChunk);
console.log(`升级上限: memoryUpgrades=${nMem}(×${memMult.toFixed(1)}), chunkUpgrades=${nChunk}(×${chunkMult.toFixed(1)})`);

for (const [label, mm, cm] of [
  ["满级上限", memMult, chunkMult],
  ["半程(10/5 级)", Math.pow(1.3, 10), Math.pow(1.5, 5)],
  ["不买升级", 1, 1],
]) {
  const mem = 0.5 * rawCPS * cm * mm * T * T;
  console.log(`${label.padEnd(12)} 产率基数=${(rawCPS * cm * mm).toExponential(2)}/s → 180min 可得记忆 ${mem.toExponential(3)}（覆盖 ${(mem / cum * 100).toFixed(2)}%）`);
}
const mem = 0.5 * rawCPS * chunkMult * memMult * T * T;
console.log(`\n要让 20 级进入 180 分钟：记忆产出需 ×${(cum / mem).toExponential(2)}`);
console.log(`或把 requiredMemories 曲线整体 ÷${(cum / mem).toExponential(2)}（等价于 1e6 常数改为 ${(1e6 / (cum / mem)).toExponential(2)}）`);
