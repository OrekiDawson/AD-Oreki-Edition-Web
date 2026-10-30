// RUPG22 / RUPG23 在不同 F 下的公式对比（纯计算，不改游戏）
// RUPG22 官方公式: effect = 10 ^ ((1 + 2*log10(days + 1)) ^ 1.6)，days = thisReality.time / 1 天
//   - 现状（本项目）: days = F × R / 1440
//   - 忠实方案      : days = R / 1440          （= 官方在 F=1 时的值）
// RUPG23 官方: 门槛 thisReality.totalMinutes < 15；效果 15 / clamp(bestReality.totalMinutes, 1/12, 15)

const rupg22 = (days) => Math.pow(10, Math.pow(1 + 2 * Math.log10(days + 1), 1.6));
const rupg23 = (bestMinutes) => 15 / Math.min(Math.max(bestMinutes, 1 / 12), 15);

const fmt = (x) => {
  if (!Number.isFinite(x)) return "∞";
  if (x >= 1e6) return x.toExponential(3) + "×";
  return x.toFixed(2) + "×";
};

const REALS = [1, 5, 15, 60, 720];   // 本次现实消耗的现实分钟数（speedup 视为 1）
const FS = [1, 10, 100, 1000, 10000];

console.log("=== RUPG22「超越时光」：时间维度倍率加成 ===");
console.log("公式: 10^((1+2·log10(days+1))^1.6)，days = 本次现实已花的「游戏时间」天数\n");
console.log("R(现实分钟) |      F | 现状 days |        现状加成 | 忠实 days |        忠实加成 |      倍数差");
console.log("------------|--------|-----------|-----------------|-----------|-----------------|-----------");
for (const R of REALS) {
  for (const F of FS) {
    const dNow = (F * R) / 1440;
    const dFaith = R / 1440;
    const vNow = rupg22(dNow);
    const vFaith = rupg22(dFaith);
    console.log(
      `${String(R).padStart(11)} | ${String(F).padStart(6)} | ${dNow.toExponential(3).padStart(9)} | ${fmt(vNow).padStart(15)} | ${dFaith.toExponential(3).padStart(9)} | ${fmt(vFaith).padStart(15)} | ${(vNow / vFaith).toFixed(2).padStart(8)}`
    );
  }
  console.log("------------|--------|-----------|-----------------|-----------|-----------------|-----------");
}

console.log("\n=== RUPG23「快速复现」：复制器速度加成 ===");
console.log("门槛: 本次现实 < 15 分钟（官方=游戏时间；本项目=游戏时间/F）");
console.log("效果: 15 / clamp(最快现实分钟, 1/12, 15)，上限 180×\n");
console.log("最快现实(现实分钟) |  官方/忠实效果 | 旧实现(bestTime 未剥F时)");
for (const m of [0.05, 1 / 12, 1, 5, 10, 15, 30]) {
  console.log(`${String(m.toFixed(4)).padStart(18)} | ${fmt(rupg23(m)).padStart(14)} | 同左（bestReality 一直是剥 F 的）`);
}

console.log("\n=== 结论摘要 ===");
const r15 = 15;
for (const F of [1, 10000]) {
  console.log(`F=${F}: 玩家现实 15 分钟 → 现状加成 ${fmt(rupg22((F * r15) / 1440))}，忠实加成 ${fmt(rupg22(r15 / 1440))}`);
}
