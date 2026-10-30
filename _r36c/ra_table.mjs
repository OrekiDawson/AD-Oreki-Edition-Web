// R36-C · Ra 记忆门槛精确重算（纯源码公式复刻，不猜任何常数）
// 公式来源：web/AD-Oreki-Edition/src/core/celestials/ra/ra.js:304-309
//   requiredMemoriesForLevel(level) =
//     floor( (level + level^2/10)^5.52 * 1.5^max(0, level-15) * TAIL )
// TAIL: 原版 1e6 ; R35 Mod 2.5e3 (÷400)
// 语义（ra.js:124-126, 191-197）：宠物从 level L 升到 L+1，需支付 req(L)。
//   ⇒ 从 level 1 升到 level N 的总花费 = Σ_{L=1}^{N-1} req(L)

const LEVEL_CAP = 25; // ra.js:329-331

function req(level, tail) {
  if (level >= LEVEL_CAP) return Infinity;
  const adjustedLevel = level + Math.pow(level, 2) / 10;
  const post15Scaling = Math.pow(1.5, Math.max(0, level - 15));
  return Math.floor(Math.pow(adjustedLevel, 5.52) * post15Scaling * tail);
}
function cumTo(level, tail) { // 从 level 1 升到 level 累计
  let s = 0;
  for (let L = 1; L <= level - 1; L++) s += req(L, tail);
  return s;
}
const e = (v, d = 4) => (Number.isFinite(v) ? (v === 0 ? "0" : v.toExponential(d)) : "∞");

const TAILS = { "原版 1e6": 1e6, "R35 2.5e3(÷400)": 2.5e3 };

console.log("=== 每级单级门槛 req(L) 与 1→L 累计 ===");
for (const [name, tail] of Object.entries(TAILS)) {
  console.log(`\n--- TAIL = ${name} ---`);
  console.log("  L |  req(L) 单级 |  1→L 累计 |  ÷400 后累计");
  for (let L = 1; L <= LEVEL_CAP - 1; L++) {
    const r = req(L, tail);
    const c = cumTo(L, tail);
    console.log(`  ${String(L).padStart(2)} | ${e(r).padStart(12)} | ${e(c).padStart(12)} |`);
  }
}

// —— 升级上限耦合（ra.js:169-175）——
// memoryUpgradeCapped: 1000*5^n >= 0.5*req(24)
// chunkUpgradeCapped : 5000*25^n >= 0.5*req(24)
function upgradeCaps(tail) {
  const thr = 0.5 * req(LEVEL_CAP - 1, tail);
  let memN = 0; while (1000 * Math.pow(5, memN) < thr) memN++;
  let chunkN = 0; while (5000 * Math.pow(25, chunkN) < thr) chunkN++;
  return { thr, memN, chunkN, memMult: Math.pow(1.3, memN), chunkMult: Math.pow(1.5, chunkN) };
}
console.log("\n=== 升级上限（ra.js:169-175）===");
for (const [name, tail] of Object.entries(TAILS)) {
  const c = upgradeCaps(tail);
  console.log(`  ${name}: 0.5*req(24)=${e(c.thr)}  → 记忆升级 n=${c.memN} (×${c.memMult.toFixed(1)})  记忆块升级 n=${c.chunkN} (×${c.chunkMult.toFixed(1)})`);
}

// —— 各解锁节点所需累计（按 pets 各自独立记忆池）——
// 关键链条（secret-formula/celestials/ra.js 的 unlocks）：
//   teresa L8  → effarigUnlock → 解锁鹿颈长
//   effarig L8 → enslavedUnlock → 解锁无名氏
//   enslaved L8→ vUnlock → 解锁薇
//   totalPetLevel>=20 → remembrance（×5 记忆）
console.log("\n=== 宠物链解锁所需累计记忆（每只宠物独立池）===");
for (const [name, tail] of Object.entries(TAILS)) {
  const t8 = cumTo(8, tail), t20 = cumTo(20, tail);
  // 最小解锁链：teresa 8 + effarig 8 + enslaved 8 = 24 级
  console.log(`  ${name}: teresa→8 需 ${e(t8)} | 单宠→20 需 ${e(t20)} | 链式最低(3宠×8级) 需 ${e(3 * t8)}`);
}

// —— 缩放扫描：找最小指数缩放系数 ——
console.log("\n=== 缩放扫描：目标 totalPetLevel>=20 走「单宠 Teresa 20 级」路线 ===");
console.log("  （注意：remembrance 只要 totalPetLevel>=20，可由多宠分担，见下表）");
const PETS = 4;
for (const mult of [1, 2, 4, 8, 16, 32, 56, 64, 128, 200, 256, 362, 400, 512, 800, 1000, 2000, 4000]) {
  const tail = 1e6 / mult;
  const t20 = cumTo(20, tail);
  const t8 = cumTo(8, tail);
  const caps = upgradeCaps(tail);
  console.log(`  ÷${String(mult).padStart(5)}: teresa 1→20 累计 ${e(t20).padStart(11)} | 3宠×8级 ${e(3 * t8).padStart(11)} | 升级上限 n_mem=${caps.memN} n_chunk=${caps.chunkN} (×${caps.memMult.toFixed(0)}/×${caps.chunkMult.toFixed(0)})`);
}
