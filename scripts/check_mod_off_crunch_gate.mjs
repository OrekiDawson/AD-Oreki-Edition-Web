#!/usr/bin/env node
/**
 * [R117-01-03] MOD 总开关关闭后，大坍缩策略闸门必须完全让路。
 *
 * 缺陷：原生 BigCrunchAutobuyerState.willInfinity 无条件调用
 * `OrekiCrunchPolicy.decide().allow`；该策略属于 MOD 托管层，关闭「智能自动操作」
 * 后仍会拦截玩家自己的大坍缩自动购买器（Android OrekiStageAuto.applyCrunchPolicy()
 * 在调度器关闭时直接 return，不参与原生判定）。
 *
 * 本脚本做两层校验：
 *   1. 静态：willInfinity 内先读 OrekiSmartExecutor.enabled，再决定是否查询策略；
 *   2. 语义：按源码同一条件模拟「执行器缺失 / 开启 / 关闭」三种情形。
 *
 * 用法：node scripts/check_mod_off_crunch_gate.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "..", "src", "core", "autobuyers", "big-crunch-autobuyer.js"), "utf-8");

let checks = 0;
const fails = [];
function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) fails.push(detail ? name + "  ← " + detail : name);
}

const willStart = SRC.indexOf("get willInfinity()");
const willEnd = SRC.indexOf("get waitingForId1Peak()");
const block = willStart >= 0 && willEnd > willStart ? SRC.slice(willStart, willEnd) : "";
check("静态：找到 willInfinity 实现", block.length > 0);

const executorIdx = block.indexOf("globalThis.OrekiSmartExecutor");
const decideIdx = block.indexOf("OrekiCrunchPolicy.decide().allow");
check("静态：willInfinity 读取执行器总开关", executorIdx >= 0);
check("静态：策略查询位于执行器判断之后", executorIdx >= 0 && decideIdx > executorIdx,
  "executor=" + executorIdx + " decide=" + decideIdx);
check("静态：关闭态跳过策略（enabled !== false）", /enabled\s*!==\s*false/u.test(block));
check("静态：取不到执行器时保持旧语义（Node 夹具）",
  /!orekiExecutor\s*\|\|\s*orekiExecutor\.enabled\s*!==\s*false/u.test(block));

/**
 * 与源码同一条件：返回「是否允许策略闸门生效」。
 * @param {{enabled?: boolean}|undefined} executor
 */
function policyGateApplies(executor) {
  return !executor || executor.enabled !== false;
}
check("语义：无执行器（Node 夹具）仍走策略", policyGateApplies(undefined) === true);
check("语义：执行器开启时走策略", policyGateApplies({ enabled: true }) === true);
check("语义：执行器关闭时跳过策略", policyGateApplies({ enabled: false }) === false);

console.log("\nR117-01-03 MOD 关闭后大坍缩闸门：" + checks + " 项检查，失败 " + fails.length + " 项");
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
process.exit(0);
