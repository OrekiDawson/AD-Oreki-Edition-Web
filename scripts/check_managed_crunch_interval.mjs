#!/usr/bin/env node
// ---------------------------------------------------------------------------
// [R96 / R116-02] 大坍缩「受管节拍」纯逻辑夹具（调度器托管 Tick 版）
//
// 验收目标：
//   1. 同一托管 Tick 不重复写；逐帧调用不刷写。
//   2. 玩家手改间隔后，同一 Tick 保留；下一次有效 Tick 按最新目标恢复一次。
//   3. 实际值已等于目标 ⇒ 不写（幂等）。
//   4. 目标变化 ⇒ 下一 Tick 写新目标。
//   5. MOD 总开关关闭 ⇒ 不写、不消费 Tick；重开后恢复托管。
//   6. 只覆盖 crunch 间隔，不改 mode / amount / 其它字段。
//
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

let fakeNow = 1_000_000;
globalThis.performance = { now: () => fakeNow };
const bigCrunch = { mode: 1, time: 30, amount: 1, xHighest: 1 };
globalThis.player = { break: true, auto: { bigCrunch } };
globalThis.OrekiSmartExecutor = { enabled: true };

const { OrekiManagedCrunchInterval, CRUNCH_ETERNITY_GROW_SECONDS, CRUNCH_PAUSE_SECONDS } =
  await import("../src/core/oreki-managed-crunch-interval.js");
const M = OrekiManagedCrunchInterval;

function reset({ time = 30, enabled = true } = {}) {
  M.resetForTest();
  bigCrunch.time = time;
  bigCrunch.mode = 1;
  bigCrunch.amount = 1;
  bigCrunch.xHighest = 1;
  globalThis.OrekiSmartExecutor.enabled = enabled;
}

// ---------------------------------------------------------------- 1. 基线
check("首 Tick 实际值=目标 ⇒ 不写盘，只消费 Tick", () => {
  reset({ time: 30 });
  const wrote = M.apply(30, "pause:eternity-grow", 1);
  assert.strictEqual(wrote, false);
  assert.strictEqual(bigCrunch.time, 30);
  assert.strictEqual(M.describe().lastTick, 1);
  assert.strictEqual(M.describe().writes, 0);
});

// ------------------------------------------- 2. 玩家手改 → 同一 Tick 不抢写
check("玩家手改 30→3600 后，同一 Tick 不抢写", () => {
  reset({ time: 30 });
  M.apply(30, "pause:eternity-grow", 1);
  bigCrunch.time = 3600; // 玩家手改
  const before = M.describe().writes;
  const wrote = M.apply(30, "pause:eternity-grow", 1);
  assert.strictEqual(wrote, false, "同一 Tick 不得写盘");
  assert.strictEqual(bigCrunch.time, 3600, "必须保留玩家手改值");
  assert.strictEqual(M.describe().writes, before);
});

// ------------------------------------ 3. 下一有效 Tick 恢复一次（按最新目标）
check("下一有效 Tick 按最新目标恢复，且只恢复一次", () => {
  const wrote = M.apply(30, "pause:eternity-grow", 2);
  assert.strictEqual(wrote, true, "新 Tick 应写回策略值");
  assert.strictEqual(bigCrunch.time, 30, "应恢复为策略目标 30");
  assert.strictEqual(M.describe().writes, 1);
});

// ------------------------------------------------- 4. 再下一 Tick 幂等
check("恢复后下一 Tick 相等则跳过（不抖动）", () => {
  const before = M.describe().writes;
  const wrote = M.apply(30, "pause:eternity-grow", 3);
  assert.strictEqual(wrote, false);
  assert.strictEqual(M.describe().writes, before);
  assert.strictEqual(bigCrunch.time, 30);
});

// ------------------------------------------------------- 5. 目标切换
check("目标切换 30→3600 时按新目标写一次", () => {
  const wrote = M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 4);
  assert.strictEqual(wrote, true);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
});

// ------------------------------------------------ 6. 只动 interval
check("只覆盖 crunch 间隔，不改 mode / amount / xHighest", () => {
  const modeBefore = bigCrunch.mode;
  const amountBefore = bigCrunch.amount;
  const xBefore = bigCrunch.xHighest;
  M.apply(60, "resume:x", 5);
  assert.strictEqual(bigCrunch.mode, modeBefore);
  assert.strictEqual(bigCrunch.amount, amountBefore);
  assert.strictEqual(bigCrunch.xHighest, xBefore);
  assert.strictEqual(bigCrunch.time, 60);
});

// ------------------------------------- 7. 总开关
check("MOD 总开关关闭 ⇒ 不写、不消费 Tick；重开后同 Tick 恢复", () => {
  reset({ time: 30 });
  M.apply(30, "pause:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  bigCrunch.time = 3600;
  const off = M.apply(30, "pause:x", 2);
  assert.strictEqual(off, false);
  assert.strictEqual(bigCrunch.time, 3600, "关闭时不得写");
  assert.strictEqual(M.describe().lastTick, 1, "关闭时不得消费 Tick");
  globalThis.OrekiSmartExecutor.enabled = true;
  const on = M.apply(30, "pause:x", 2);
  assert.strictEqual(on, true, "重开后同一 Tick 恢复");
  assert.strictEqual(bigCrunch.time, 30);
});

// ------------------------------------- 8. 无 Tick 注入
check("没有可读/注入的托管 Tick ⇒ 不写", () => {
  reset({ time: 30 });
  bigCrunch.time = 3600;
  const wrote = M.apply(30, "pause:x");
  assert.strictEqual(wrote, false);
  assert.strictEqual(bigCrunch.time, 3600);
});

// ------------------------------------- 9. 策略路径目标
check("applyFromPolicy：允许坍缩 + 已 Break ⇒ 5 秒下限", () => {
  reset({ time: 60 });
  globalThis.player.break = true;
  const wrote = M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1);
  assert.strictEqual(wrote, true);
  assert.strictEqual(bigCrunch.time, 5);
});

check("applyFromPolicy：暂停（非 eternity-grow）⇒ 1 小时硬暂停", () => {
  reset({ time: 5 });
  const wrote = M.applyFromPolicy({ allow: false, reason: "no-target" }, 1);
  assert.strictEqual(wrote, true);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
});

check("applyFromPolicy：永恒层等待 ⇒ 自适应成长窗口（>=60 秒）", () => {
  reset({ time: 3600 });
  const wrote = M.applyFromPolicy({ allow: false, reason: "eternity-grow" }, 1);
  assert.strictEqual(wrote, true);
  assert.ok(bigCrunch.time >= CRUNCH_ETERNITY_GROW_SECONDS,
    `成长窗口应 >= ${CRUNCH_ETERNITY_GROW_SECONDS}，实际 ${bigCrunch.time}`);
});

console.log(`\nR116-02 受管大坍缩节拍夹具：${checks} 项检查，失败 ${fails.length} 项`);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
process.exit(0);
