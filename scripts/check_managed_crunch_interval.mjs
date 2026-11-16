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
let maxAMLog = 100;
globalThis.player = {
  break: true,
  auto: { bigCrunch },
  records: {
    gameCreatedTime: 111,
    thisInfinity: { realTime: 100, maxAM: { log10: () => maxAMLog } },
  },
};
globalThis.OrekiSmartExecutor = { enabled: true, hostingIntervalMs: 1000 };
let infinitiesToken = 0;
globalThis.Currency = { infinities: { value: { toNumber: () => infinitiesToken } } };

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
  infinitiesToken = 0;
  maxAMLog = 100;
  player.records.thisInfinity.realTime = 100;
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

// ------------------------------------- 10. 一次性 release 保留（PR #57 review）
check("一次性 eternity-cycle release 落在 tick 之间 ⇒ 下一 Tick 写 5 秒而非暂停", () => {
  reset({ time: 30 });
  globalThis.OrekiSmartExecutor.hostingIntervalMs = 1000;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 1);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  // allow 只在两 tick 之间出现一次（同一 tick 内不写）
  M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS, "同一 Tick 不应写");
  fakeNow += 500;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 2);
  assert.strictEqual(bigCrunch.time, 5, "下一 Tick 必须保留释放窗口，写 5 秒");
  assert.strictEqual(M.describe().releasePending, true);
  assert.strictEqual(M.hasPendingRelease(), true, "启用状态托管据此恢复大坍缩");
});

check("原生大坍缩消费 release 后 ⇒ 下一 Tick 回到暂停目标", () => {
  // 被动无限产生：Currency.infinities 增加但上一无限运行未重置
  infinitiesToken = 1;
  fakeNow += 250;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 3);
  assert.strictEqual(bigCrunch.time, 5, "被动 infinities 增长不得清除 release");
  // 真实大坍缩：maxAM 归零（log10 = -Infinity）；realTime 故意保持 100，
  // 以证明 maxAM 分支本身能识别消费，而不是只靠 realTime。
  maxAMLog = -Infinity;
  fakeNow += 250;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 4);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  assert.strictEqual(M.describe().releasePending, false);
  assert.strictEqual(M.hasPendingRelease(), false);
});

check("release 超时未被消费 ⇒ 不永久保留（回到暂停目标）", () => {
  reset({ time: 30 });
  globalThis.OrekiSmartExecutor.hostingIntervalMs = 1000;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 1);
  M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1);
  fakeNow += 3000; // 超过 max(2000, 2*tick)=2000ms
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 2);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS, "超时后必须回到暂停");
});

check("5s 托管 Tick：调用方显式传入 intervalMs 时保留窗口覆盖到下一 Tick", () => {
  reset({ time: 30 });
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 1, 5000);
  M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1, 5000);
  fakeNow += 4000; // 尚在 10s 保留窗口内、还未到下一 Tick
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 2, 5000);
  assert.strictEqual(bigCrunch.time, 5, "5s Tick 下仍要保留释放窗口");
});

// ------------------------------------- 11. 同帧 decide 缓存与 release 消费（PR #57 review）
{
  const { OrekiCrunchPolicy: P } = await import("../src/core/oreki-crunch-policy.js");
  const origEvaluate = P.evaluate;
  let evalCalls = 0;
  try {
    P.resetForTest();
    P.beginFrame();
    P.evaluate = () => {
      evalCalls += 1;
      return evalCalls === 1
        ? { allow: true, reason: "eternity-cycle" }
        : { allow: false, reason: "eternity-grow" };
    };
    player.records.thisInfinity.realTime = 100;
    maxAMLog = 100;
    const first = P.decide();
    const second = P.decide();
    check("同帧第二次 decide 返回同一 allow（缓存，不重新 evaluate）", () => {
      assert.strictEqual(first.allow, true);
      assert.strictEqual(second, first, "必须返回同一决策对象");
      assert.strictEqual(evalCalls, 1, "同帧只 evaluate 一次");
    });
    P.beginFrame();
    const pending = P.decide();
    check("下一帧 deny 时保留一次性 release", () => {
      assert.strictEqual(pending.allow, true);
      assert.ok(String(pending.reason).startsWith("release-pending:"));
      assert.strictEqual(evalCalls, 1, "pending 期间不重新 evaluate");
    });
    // 被动无限产生：Currency.infinities 增加但未重置 thisInfinity
    infinitiesToken += 5;
    P.beginFrame();
    const passive = P.decide();
    check("被动 infinities 增长不清除 pending release", () => {
      assert.strictEqual(passive.allow, true);
      assert.ok(String(passive.reason).startsWith("release-pending:"));
    });
    // 真实大坍缩：maxAM 归零（-Infinity），realTime 不变，验证 maxAM 分支
    maxAMLog = -Infinity;
    P.beginFrame();
    const consumed = P.decide();
    check("真实大坍缩后才清除 release 并回到 deny", () => {
      assert.strictEqual(consumed.allow, false);
      assert.strictEqual(consumed.reason, "eternity-grow");
      assert.strictEqual(evalCalls, 2);
    });
    // 换存档：上一档 pendingRelease 不得让新档被迫坍缩
    P.resetForTest();
    player.records.gameCreatedTime = 111;
    player.records.thisInfinity.realTime = 100;
    maxAMLog = 100;
    evalCalls = 0;
    P.evaluate = () => {
      evalCalls += 1;
      return evalCalls === 1
        ? { allow: true, reason: "eternity-cycle" }
        : { allow: false, reason: "eternity-grow" };
    };
    P.beginFrame();
    const beforeSwitch = P.decide();
    P.beginFrame();
    player.records.gameCreatedTime = 222; // 换存档，标记不重置
    const afterSwitch = P.decide();
    check("换存档后 pendingRelease 立即失效（不跨档 allow）", () => {
      assert.strictEqual(beforeSwitch.allow, true);
      assert.strictEqual(afterSwitch.allow, false, "新档不得继承上一档 release");
      assert.strictEqual(afterSwitch.reason, "eternity-grow");
      assert.strictEqual(evalCalls, 2, "换档后必须重新 evaluate");
    });
  } finally {
    P.evaluate = origEvaluate;
    P.resetForTest();
  }
}

console.log(`\nR116-02 受管大坍缩节拍夹具：${checks} 项检查，失败 ${fails.length} 项`);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
process.exit(0);
