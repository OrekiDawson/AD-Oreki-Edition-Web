// R35-C 总账数值（IM 链），公式对齐 machines.js:26-66
const epLog = 1.43e7;                 // 实测 EP log10 峰值（_r34b-final300 t=266），1300s 反而只有 5.8e6 → 已饱和
const rmLog = epLog => 3 * (epLog / 4000 - 1);          // machines.js:33-34
const imCap = rmL => Math.pow(Math.max(rmL - 1000, 0), 2) * Math.pow(Math.max(rmL - 1e5, 1), 0.2);
console.log("EPlog =", epLog.toExponential(3), "→ log10RM =", rmLog(epLog).toFixed(0), "→ IM 上限 =", imCap(rmLog(epLog)).toExponential(3));
const epFor = cost => { const rmL = 1000 + Math.sqrt(cost); return 4000 * (rmL / 3 + 1); };
for (const c of [5e7, 3.5e8, 1e9, 3e12, 1.6e15]) {
  console.log(`cost ${c.toExponential(2).padStart(9)} → 需 log10RM ≥ ${(1000 + Math.sqrt(c)).toFixed(0)} → 需 EPlog ≥ ${epFor(c).toExponential(3)}  (×${(epFor(c) / epLog).toFixed(1)} 于实测)`);
}
// 若只放大 baseIMCap 指数
const rmL = rmLog(epLog), target = 1.6e15;
console.log("\n要把 1.6e15 拉进当前 EPlog：baseIMCap 指数 2 →", (Math.log(target) / Math.log(rmL - 1000)).toFixed(2));
console.log("或 baseIMCap 整体 ×", (target / imCap(rmL)).toExponential(2));
// RU1 星系：AD8 需求
const gal = g => (80 + 60 * g + (g >= 100 ? (g - 99) ** 2 + (g - 99) : 0)) * (g >= 800 ? Math.pow(1.002, g - 799) : 1);
console.log("\nRU1 星系 → 需要第 8 反物质维度总量");
const base = gal(1471);
for (const g of [1471, 4000, 4300, 4600, 4900, 5200, 5500]) {
  console.log(`  ${String(g).padStart(5)} 个 → AD8 ${gal(g).toExponential(3)}  (相对实测 1471 的 ×${(gal(g) / base).toFixed(0)})`);
}
