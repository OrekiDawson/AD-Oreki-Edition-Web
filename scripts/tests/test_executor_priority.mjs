import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};

const { OrekiSmartExecutor } = await import("../../src/core/oreki-smart-executor.js");

test("阶段紧迫提示先于饥饿轮转且只改变尝试顺序", () => {
  const calls = [];
  const task = id => () => {
    calls.push(id);
    return false;
  };
  const tasks = [
    ["a", 5, task("a")],
    ["b", 10, task("b")],
    ["eternityReset", 31, task("eternityReset")],
  ];

  OrekiSmartExecutor.setEnabled(true);
  OrekiSmartExecutor.setIntervalSec(1);
  OrekiSmartExecutor.setStrictGlobal(false);
  OrekiSmartExecutor.setPriorityHint("");
  OrekiSmartExecutor.runCycle(tasks);
  assert.deepEqual(calls, ["a", "b", "eternityReset"]);

  calls.length = 0;
  OrekiSmartExecutor.setPriorityHint("eternityReset");
  const result = OrekiSmartExecutor.runCycle([
    ["a", 5, () => {
      calls.push("a");
      return true;
    }],
    ["b", 10, () => {
      calls.push("b");
      return true;
    }],
    ["eternityReset", 31, () => {
      calls.push("eternityReset");
      return true;
    }],
  ]);

  assert.deepEqual(calls, ["eternityReset"]);
  assert.equal(result.eternityReset, true);
  assert.equal(OrekiSmartExecutor.debugState().beat.log.at(-1).task, "eternityReset");
});
