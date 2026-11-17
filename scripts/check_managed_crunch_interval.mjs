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
// 持久化记录用内存 localStorage 模拟；生产代码通过 localStorage 跨刷新恢复原值。
const storage = new Map();
globalThis.localStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
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
  storage.clear();
  bigCrunch.time = time;
  bigCrunch.mode = 1;
  bigCrunch.amount = 1;
  bigCrunch.xHighest = 1;
  globalThis.OrekiSmartExecutor.enabled = enabled;
  infinitiesToken = 0;
  maxAMLog = 100;
  player.records.gameCreatedTime = 111;
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
check("MOD 总开关关闭 ⇒ 不写新目标、清空托管 Tick；重开后恢复托管", () => {
  reset({ time: 30 });
  M.apply(30, "pause:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  bigCrunch.time = 3600; // 玩家手改，且此前从未托管写入
  const off = M.apply(30, "pause:x", 2);
  assert.strictEqual(off, false);
  assert.strictEqual(bigCrunch.time, 3600, "未被托管过的值不得在关闭时覆盖");
  assert.strictEqual(M.describe().lastTick, 0, "关闭时必须清空托管 Tick");
  globalThis.OrekiSmartExecutor.enabled = true;
  const on = M.apply(30, "pause:x", 2);
  assert.strictEqual(on, true, "重开后恢复托管");
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

check("仅 realTime 重置也识别真实大坍缩消费（maxAMLog 不变）", () => {
  reset({ time: 30 });
  globalThis.OrekiSmartExecutor.hostingIntervalMs = 1000;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 1);
  M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1);
  player.records.thisInfinity.realTime = 0; // 仅 realTime 归零，maxAMLog 保持 100
  fakeNow += 250;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 2);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  assert.strictEqual(M.hasPendingRelease(), false);
});

check("标记不可读时不继续强制 5s（fail-safe 清 release）", () => {
  reset({ time: 30 });
  globalThis.OrekiSmartExecutor.hostingIntervalMs = 1000;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 1);
  M.applyFromPolicy({ allow: true, reason: "eternity-cycle" }, 1);
  player.records.thisInfinity.realTime = undefined; // 读档瞬间：标记不可读
  fakeNow += 250;
  M.applyFromPolicy({ allow: false, reason: "no-target" }, 2);
  assert.strictEqual(M.hasPendingRelease(), false);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
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
    // 同帧微步：原生自动器在一次 tick 内真实坍缩后，后续微步不得复用旧 allow
    P.resetForTest();
    player.records.gameCreatedTime = 111;
    player.records.thisInfinity.realTime = 100;
    maxAMLog = 100;
    let microCalls = 0;
    P.evaluate = () => {
      microCalls += 1;
      return microCalls === 1
        ? { allow: true, reason: "ip-jump" }
        : { allow: false, reason: "eternity-grow" };
    };
    P.beginFrame();
    const preMicro = P.decide();
    player.records.thisInfinity.realTime = 0;
    maxAMLog = -Infinity;
    const postMicro = P.decide(); // 同一帧，不调用 beginFrame
    check("同帧内 Infinity run 重置后决策缓存失效", () => {
      assert.strictEqual(preMicro.allow, true);
      assert.strictEqual(postMicro.allow, false, "坍缩后不得继续复用旧 allow");
      assert.strictEqual(postMicro.reason, "eternity-grow");
      assert.strictEqual(microCalls, 2, "必须重新 evaluate");
    });

    // 同帧内 release 被真实坍缩消费：缓存与 pendingRelease 必须在同帧清掉
    P.resetForTest();
    player.records.gameCreatedTime = 111;
    player.records.thisInfinity.realTime = 100;
    maxAMLog = 100;
    let releaseCalls = 0;
    P.evaluate = () => {
      releaseCalls += 1;
      return releaseCalls === 1
        ? { allow: true, reason: "eternity-cycle" }
        : { allow: false, reason: "eternity-grow" };
    };
    P.beginFrame();
    const releaseAllow = P.decide();
    player.records.thisInfinity.realTime = 0;
    maxAMLog = -Infinity;
    const releaseAfterCrunch = P.decide(); // 同一帧，不调用 beginFrame
    check("同帧内 release 被消费后立即返回 deny 并清 pendingRelease", () => {
      assert.strictEqual(releaseAllow.allow, true);
      assert.strictEqual(releaseAfterCrunch.allow, false);
      assert.strictEqual(releaseAfterCrunch.reason, "eternity-grow");
      assert.strictEqual(releaseCalls, 2);
    });

    // 标记不可读：不得静默复用坍缩前 allow
    P.resetForTest();
    player.records.thisInfinity.realTime = 100;
    maxAMLog = 100;
    let unreadableCalls = 0;
    P.evaluate = () => {
      unreadableCalls += 1;
      return unreadableCalls === 1
        ? { allow: true, reason: "ip-jump" }
        : { allow: false, reason: "eternity-grow" };
    };
    P.beginFrame();
    const readableAllow = P.decide();
    player.records.thisInfinity.realTime = undefined; // 标记不可读
    const unreadableDeny = P.decide();
    check("标记不可读时同帧缓存失效，不复用坍缩前 allow", () => {
      assert.strictEqual(readableAllow.allow, true);
      assert.strictEqual(unreadableDeny.allow, false);
      assert.strictEqual(unreadableCalls, 2);
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

// ------------------------- 7. [R117-01-03b] 关闭总开关写回玩家原值
check("首次托管写入前记录原值；关闭后写回并清空 lastTick", () => {
  reset({ time: 30 });
  M.apply(30, "pause:eternity-grow", 1); // 与目标相等，不写
  const wrote = M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2);
  assert.strictEqual(wrote, true, "应写入暂停值 3600");
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  globalThis.OrekiSmartExecutor.enabled = false;
  const released = M.releaseToPlayer();
  assert.strictEqual(released, true, "关闭后应写回原值");
  assert.strictEqual(bigCrunch.time, 30, "应恢复玩家原值 30");
  assert.strictEqual(M.describe().lastTick, 0, "必须清空托管 Tick");
});

check("玩家在两次托管写入之间手改 ⇒ 以玩家最新值为原值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  assert.strictEqual(bigCrunch.time, 60);
  bigCrunch.time = 15; // 玩家手改
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2);
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 15, "应恢复玩家最后一次手改值");
});

check("玩家在最后一次托管写入后手改 ⇒ 关闭时不覆盖玩家值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2);
  bigCrunch.time = 20; // 关闭前玩家手改
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), false);
  assert.strictEqual(bigCrunch.time, 20, "不得覆盖玩家最后的手改值");
});

check("从未托管写入过 ⇒ 关闭时不写任何值", () => {
  reset({ time: 30 });
  M.apply(30, "pause:eternity-grow", 1); // 不写
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), false);
  assert.strictEqual(bigCrunch.time, 30);
});

check("apply() 检测到总开关关闭也会写回（不依赖界面按钮）", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  const wrote = M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2);
  assert.strictEqual(wrote, false, "关闭状态不得继续写策略目标");
  assert.strictEqual(bigCrunch.time, 30, "apply 路径同样写回原值");
  assert.strictEqual(M.describe().lastTick, 0);
});

check("页面刷新（内存态丢失）后仍按持久化记录写回原值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1); // 记录 original=30 / written=60
  M.resetForTest();           // 模拟页面刷新，内存态清空但 localStorage 保留
  assert.strictEqual(bigCrunch.time, 60);
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2); // 读取持久化 original=30
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 30, "不得把 3600 当原值");
});

check("换档后不采用上一档的持久化原值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1); // saveId=111, original=30
  M.resetForTest();
  player.records.gameCreatedTime = 222; // 换档
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2); // 新档原值应为 60
  assert.strictEqual(bigCrunch.time, CRUNCH_PAUSE_SECONDS);
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 60, "新档不得写回旧档原值 30");
  player.records.gameCreatedTime = 111;
});

check("重复释放幂等；释放后重新开启再关闭仍写回基线", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 30);
  assert.strictEqual(M.releaseToPlayer(), false, "第二次释放不得重复写");
  globalThis.OrekiSmartExecutor.enabled = true;
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 2);
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 30, "重新关闭应回到释放后的基线 30");
});

check("applyFromPolicy 在总开关关闭时同样写回原值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  const wrote = M.applyFromPolicy({ allow: false, reason: "id-peak-wait" }, 2, 1000);
  assert.strictEqual(wrote, false, "关闭状态不得写策略目标");
  assert.strictEqual(bigCrunch.time, 30, "applyFromPolicy 入口也必须写回");
});

check("释放后清理 localStorage 记录", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  assert.ok(storage.has("oreki.crunchInterval.managed"), "写入后应有持久化记录");
  globalThis.OrekiSmartExecutor.enabled = false;
  M.releaseToPlayer();
  assert.strictEqual(storage.get("oreki.crunchInterval.managed"), undefined,
    "释放后不得保留记录");
});

check("刷新后存档落后一拍（actual 命中历史写出值）仍写回原值", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  M.apply(5, "resume:x", 2);
  M.apply(CRUNCH_PAUSE_SECONDS, "pause:no-target", 3); // 记录 recent=[60,5,3600]
  M.resetForTest(); // 模拟刷新，且存档只落盘到上一拍的 5
  bigCrunch.time = 5;
  globalThis.OrekiSmartExecutor.enabled = false;
  assert.strictEqual(M.releaseToPlayer(), true);
  assert.strictEqual(bigCrunch.time, 30, "命中历史写出值也应恢复玩家原值");
});

check("关闭期间重复释放不再读写 localStorage", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1);
  globalThis.OrekiSmartExecutor.enabled = false;
  M.releaseToPlayer();
  let io = 0;
  const getItem = localStorage.getItem;
  const setItem = localStorage.setItem;
  const removeItem = localStorage.removeItem;
  localStorage.getItem = (...args) => { io += 1; return getItem(...args); };
  localStorage.setItem = (...args) => { io += 1; return setItem(...args); };
  localStorage.removeItem = (...args) => { io += 1; return removeItem(...args); };
  try {
    for (let i = 0; i < 20; i += 1) M.releaseToPlayer();
  } finally {
    localStorage.getItem = getItem;
    localStorage.setItem = setItem;
    localStorage.removeItem = removeItem;
  }
  assert.strictEqual(io, 0, "已释放后不得每帧读写 localStorage");
});

check("刷新后玩家已在最后一次写入后手改 ⇒ 跳过覆盖并记录日志", () => {
  reset({ time: 30 });
  M.apply(60, "resume:x", 1); // 持久化 original=30 / written=60
  M.resetForTest();           // 模拟刷新
  bigCrunch.time = 500;       // 玩家手改，且不等于任何托管写出值
  globalThis.OrekiSmartExecutor.enabled = false;
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args.join(" "));
  let released;
  try { released = M.releaseToPlayer(); } finally { console.info = originalInfo; }
  assert.strictEqual(released, false);
  assert.strictEqual(bigCrunch.time, 500, "不得覆盖玩家手改");
  assert.ok(logs.some(line => line.includes("player override")),
    "应记录 player override 日志: " + logs.join(" | "));
});

console.log(`\nR116-02 受管大坍缩节拍夹具：${checks} 项检查，失败 ${fails.length} 项`);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
process.exit(0);
