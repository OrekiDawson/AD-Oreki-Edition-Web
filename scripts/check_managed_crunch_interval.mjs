#!/usr/bin/env node
// ---------------------------------------------------------------------------
// [R96 第三十四轮] 大坍缩「受管节拍」逻辑夹具（Web 侧）
//
// 验收目标（与 Android 参数契约逐条对应，改一侧必须同步另一侧）：
//   1. 玩家把托管间隔手改后，**下一帧不抢写**；
//   2. 到**下一次策略 tick**（全局节拍跨度）按届时最新目标恢复**恰好一次**；
//   3. 恢复后的再下一帧不再重复写（相等则跳过）；
//   4. 目标切换时按新目标写；
//   5. 值相等时不写盘、不抖动；
//   6. 只覆盖 crunch 间隔这一项，不碰模式、不碰其它设置。
//
// 只测纯逻辑（不启动浏览器、不跑游戏主循环），通过注入 player / 时钟桩实现。
// 运行：node scripts/check_managed_crunch_interval.mjs
// ---------------------------------------------------------------------------

import assert from "node:assert";

let checks = 0;
const fails = [];

function check(name, fn) {
  checks += 1;
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (e) {
    fails.push(`${name}  ← ${e.message}`);
    console.log(`  FAIL ${name}  ← ${e.message}`);
  }
}

// ---- 桩：可变时钟 + player.auto.bigCrunch + OrekiSmartExecutor.intervalSec ----
let fakeNow = 1_000_000;
globalThis.performance = { now: () => fakeNow };

const bigCrunch = { mode: 1, time: 30, amount: 1, xHighest: 1 };
globalThis.player = { break: true, auto: { bigCrunch } };
globalThis.OrekiSmartExecutor = { intervalSec: 10 };

// OrekiCrunchPolicy 由模块内部 import；这里不 mock，直接用它真实的 decide()。
const { OrekiManagedCrunchInterval, CRUNCH_ETERNITY_GROW_SECONDS, CRUNCH_PAUSE_SECONDS } =
  await import("../src/core/oreki-managed-crunch-interval.js");

const M = OrekiManagedCrunchInterval;

// ---------------------------------------------------------------- 1. 基线采纳
check("首观测把当前值当基线（不写盘）", () => {
  M.resetForTest();
  bigCrunch.time = 30;
  const wrote = M.apply(CRUNCH_ETERNITY_GROW_SECONDS, "pause:eternity-grow");
  assert.strictEqual(wrote, false, "首帧应只采纳基线，不应写盘");
  assert.strictEqual(bigCrunch.time, 30);
  assert.strictEqual(M.describe().written, 30);
});

// ------------------------------------------- 2. 玩家手改 → 下一帧不抢写（关键）
check("玩家手改 30→3600 后，下一帧不抢写", () => {
  M.resetForTest();
  bigCrunch.time = 30;
  M.apply(30, "pause:eternity-grow"); // 基线采纳
  bigCrunch.time = 3600; // 玩家手改
  const before = M.describe().writes;
  const wrote = M.apply(30, "pause:eternity-grow");
  assert.strictEqual(wrote, false, "玩家占用期间不得写盘");
  assert.strictEqual(bigCrunch.time, 3600, "必须保留玩家手改值");
  assert.strictEqual(M.describe().writes, before, "写入次数不得增加");
  assert.strictEqual(M.describe().playerOwned, true, "应判定为玩家占用");
});

// ------------------------------------ 3. 下一策略 tick 恢复一次（按当时最新目标）
check("到下一次策略 tick 按最新目标恢复，且只恢复一次", () => {
  // 承接上一项状态：玩家占用中，目标 30，实际 3600
  fakeNow += 10 * 1000 + 1; // 跨过一个全局节拍（10 s）
  const wrote = M.apply(30, "pause:eternity-grow");
  assert.strictEqual(wrote, true, "到点应写回策略值");
  assert.strictEqual(bigCrunch.time, 30, "应恢复为策略目标 30");
  assert.strictEqual(M.describe().restores, 1, "只恢复一次");
  assert.strictEqual(M.describe().playerOwned, false, "恢复后归属交还 MOD");
});

// ------------------------------------------------- 4. 再下一帧不重复写（幂等）
check("恢复后的再下一帧相等则跳过（不抖动）", () => {
  const before = M.describe().writes;
  const wrote = M.apply(30, "pause:eternity-grow");
  assert.strictEqual(wrote, false, "相等不应写盘");
  assert.strictEqual(M.describe().writes, before, "写入次数不得增加");
  assert.strictEqual(bigCrunch.time, 30);
});

// ------------------------------------------------------- 5. 目标切换按新目标写
check("目标切换 30→3600 时按新目标写一次", () => {
  const wrote = M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target");
  assert.strictEqual(wrote, true, "目标变化应写盘");
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
});

// ------------------------------------------------ 6. 只动 interval，不碰 mode
check("只覆盖 crunch 间隔，不改 mode 与其它字段", () => {
  const modeBefore = bigCrunch.mode;
  const amountBefore = bigCrunch.amount;
  M.apply(60, "resume:x");
  assert.strictEqual(bigCrunch.mode, modeBefore, "不得改写 mode");
  assert.strictEqual(bigCrunch.amount, amountBefore, "不得改写 amount");
  assert.strictEqual(bigCrunch.time, 60);
});

// ------------------------------------- 7. 玩家连续微调不会导致永不恢复（只登记一次）
check("玩家连续微调只登记一次恢复时机（不会无限推迟）", () => {
  M.resetForTest();
  bigCrunch.time = 30;
  M.apply(30, "pause:eternity-grow"); // 基线
  bigCrunch.time = 3600;
  M.apply(30, "pause:eternity-grow"); // 登记 defer
  const d1 = M.describe().pendingRestore;
  fakeNow += 2000;
  bigCrunch.time = 7200; // 又改一次
  M.apply(30, "pause:eternity-grow");
  assert.strictEqual(d1, true, "应已登记恢复时机");
  assert.strictEqual(M.describe().pendingRestore, true, "仍在待恢复状态");
  fakeNow += 10 * 1000;
  const wrote = M.apply(30, "pause:eternity-grow");
  assert.strictEqual(wrote, true, "到点仍会恢复（未被微调无限推迟）");
  assert.strictEqual(bigCrunch.time, 30);
});

console.log(
  `\nR96 受管大坍缩节拍夹具（Web）：${checks} 项检查，失败 ${fails.length} 项`
);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
process.exit(0);
