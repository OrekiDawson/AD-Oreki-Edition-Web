#!/usr/bin/env node
/**
 * [R117-01-03b] MOD 总开关关闭后，大坍缩策略闸门必须完全让路。
 *
 * 为什么执行真实 getter 体：字符串存在/顺序检查无法发现生产条件被改坏
 * （例如把 enabled !== false 取反仍会全绿）。本脚本从 big-crunch-autobuyer.js
 * 切出真实 willInfinity 方法体，用 Function 构造执行，只注入受控桩；
 * 并额外做一次“条件取反”自检，证明本用例能捕获该回归。
 *
 * 覆盖：
 *   · 策略 deny + 无执行器（Node 夹具）⇒ 仍走策略 ⇒ false
 *   · 策略 deny + 执行器开启 ⇒ 走策略 ⇒ false
 *   · 策略 deny + 执行器关闭 ⇒ 跳过策略 ⇒ true
 *   · 策略 allow + TIME 模式 ⇒ 按原版 time 判定（真实分支仍生效）
 *   · 反向自检：把条件取反后，开启态会被误判为放行（本用例必须失败）
 *
 * 用法：node scripts/检查关闭MOD后大坍缩闸门.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "src", "core", "autobuyers", "big-crunch-autobuyer.js"), "utf-8");

let checks = 0;
const fails = [];
function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) fails.push(detail ? name + "  ← " + detail : name);
}

/** 与 scripts/check_crunch_policy.mjs 同一契约：按大括号配平切出真实方法体。 */
function extractGetterBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error("找不到 " + signature + "（源码结构变了？）");
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error(signature + " 的大括号不配平");
  return source.slice(open + 1, end);
}

let body;
try {
  body = extractGetterBody(SRC, "get willInfinity() {");
  check("结构：能从源码切出 willInfinity 方法体", body.length > 0);
} catch (error) {
  check("结构：能从源码切出 willInfinity 方法体", false, String(error));
}

const AUTO_CRUNCH_MODE = { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 };

function buildRunner(methodBody) {
  return new Function(
    "player", "Player", "OrekiCrunchPolicy", "AUTO_CRUNCH_MODE", "gainedInfinityPoints", "Time",
    methodBody,
  );
}

let runner = null;
try {
  runner = buildRunner(body);
  check("结构：真实方法体可编译", typeof runner === "function");
} catch (error) {
  check("结构：真实方法体可编译", false, String(error));
}

const playerStub = { break: true };
const playerApiStub = { isInAntimatterChallenge: false };
const timeStub = { thisInfinityRealTime: { totalSeconds: 100 } };
const gainedIpStub = () => ({ gte: () => true });
const denyPolicy = { decide: () => ({ allow: false, reason: "id-peak-wait" }) };
const allowPolicy = { decide: () => ({ allow: true, reason: "pre-break-ip" }) };

function runWillInfinity({ executor, policy, mode = AUTO_CRUNCH_MODE.TIME, time = 0, methodRunner = runner }) {
  const previous = globalThis.OrekiSmartExecutor;
  globalThis.OrekiSmartExecutor = executor;
  try {
    const instance = {
      mode, time, amount: 1, xHighest: 10, highestPrevPrestige: 10,
    };
    return methodRunner.call(
      instance, playerStub, playerApiStub, policy, AUTO_CRUNCH_MODE, gainedIpStub, timeStub,
    );
  } finally {
    globalThis.OrekiSmartExecutor = previous;
  }
}

// ------------------------------------------------ 真实方法体三态断言
const noExecutor = runWillInfinity({ executor: undefined, policy: denyPolicy });
check("语义：无执行器（Node 夹具）仍走策略 ⇒ false", noExecutor === false, "actual=" + String(noExecutor));

const executorOn = runWillInfinity({ executor: { enabled: true }, policy: denyPolicy });
check("语义：执行器开启时走策略 ⇒ false", executorOn === false, "actual=" + String(executorOn));

const executorOff = runWillInfinity({ executor: { enabled: false }, policy: denyPolicy });
check("语义：执行器关闭时跳过策略 ⇒ true", executorOff === true, "actual=" + String(executorOff));

// ------------------------------------------------ 真实 TIME 分支仍生效
const allowDue = runWillInfinity({ executor: { enabled: true }, policy: allowPolicy, mode: AUTO_CRUNCH_MODE.TIME, time: 0 });
check("语义：策略 allow 时 TIME 到期仍放行 ⇒ true", allowDue === true, "actual=" + String(allowDue));

const allowNotDue = runWillInfinity({ executor: { enabled: true }, policy: allowPolicy, mode: AUTO_CRUNCH_MODE.TIME, time: 100 });
check("语义：策略 allow 时 TIME 未到期仍拦截 ⇒ false", allowNotDue === false, "actual=" + String(allowNotDue));

// ------------------------------------------------ 条件取反自检
const mutatedBody = body.replace("orekiExecutor.enabled !== false", "orekiExecutor.enabled === false");
const mutationApplied = mutatedBody !== body;
check("自检：条件取反脚本确实被改写", mutationApplied);
if (mutationApplied) {
  try {
    const mutatedRunner = buildRunner(mutatedBody);
    const mutated = runWillInfinity({ executor: { enabled: true }, policy: denyPolicy, methodRunner: mutatedRunner });
    check("自检：条件取反后开启态被误判为放行（本用例应失败）", mutated === true, "actual=" + String(mutated));
  } catch (error) {
    check("自检：条件取反后开启态被误判为放行（本用例应失败）", false, String(error));
  }
}

console.log("\nR117-01-03b 关闭 MOD 后大坍缩闸门（真实 getter 体）：" + checks + " 项检查，失败 " + fails.length + " 项");
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
process.exit(0);
