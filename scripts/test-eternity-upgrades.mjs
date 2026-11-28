/** R81：直接加载生产自动化对象，验证永恒商店扣费与停止边界，不伪造奖励。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// 游戏对象在 VM 内隔离；测试升级按真实成本扣余额，能发现重复购买和无条件写入。
const source = readFileSync(new URL("../src/core/oreki-eternity-automation.js", import.meta.url), "utf8")
  .replace(/^import .*;\s*$/mg, "")
  .replace("export const OrekiEternityAutomation", "const OrekiEternityAutomation");
const context = {
  player: { auto: { autobuyersOn: true } },
  NormalChallenge: { isRunning: false }, InfinityChallenge: { isRunning: false },
  EternityChallenge: { isRunning: false }, Pelle: { isDoomed: false },
  firstDimension: { bought: 1 }, balance: 15, calls: 0,
};
context.TimeDimension = () => context.firstDimension;
// 六项一次性升级的起始两项成本为 5/10 EP，购买本身维护已购状态。
context.EternityUpgrade = { all: [5, 10].map(cost => ({
  isBought: false,
  get canBeBought() { return !this.isBought && context.balance >= cost; },
  purchase() {
    if (!this.canBeBought) return false;
    context.balance -= cost;
    this.isBought = true;
    context.calls++;
    return true;
  },
})) };
vm.createContext(context);
vm.runInContext(source + "\nglobalThis.automation = OrekiEternityAutomation;", context);
const automation = context.automation;
// 总开关、挑战、毁灭和首个时间维度均为生产代码实际门禁。
context.player.auto.autobuyersOn = false;
assert.equal(automation.buyEternityUpgrades(), false);
context.player.auto.autobuyersOn = true;
for (const guard of [context.NormalChallenge, context.InfinityChallenge, context.EternityChallenge]) {
  guard.isRunning = true;
  assert.equal(automation.buyEternityUpgrades(), false);
  guard.isRunning = false;
}
context.Pelle.isDoomed = true;
assert.equal(automation.buyEternityUpgrades(), false);
context.Pelle.isDoomed = false;
context.firstDimension.bought = 0;
assert.equal(automation.buyEternityUpgrades(), false);
assert.equal(context.balance, 15);
context.firstDimension.bought = 1;
assert.equal(automation.buyEternityUpgrades(), true);
assert.equal(context.calls, 1);
assert.equal(context.balance, 10);
assert.equal(automation.buyEternityUpgrades(), true);
assert.equal(context.balance, 0);
assert.equal(automation.buyEternityUpgrades(), false);
assert.equal(context.calls, 2);

context.Autobuyer = { epMult: { isUnlocked: true, isActive: true } };
let perkChecks = 0;
context.applyEU2 = () => { perkChecks++; };
context.EternityUpgrade.epMult = {
  buyMax(auto) {
    assert.equal(auto, true);
    if (context.balance < 500) return false;
    context.balance -= 500;
    return true;
  },
};
context.balance = 600;
automation.eternityUpgradeReserve = () => 1000;
assert.equal(automation.buyEternityUpgrades(), false);
assert.equal(context.balance, 600);
assert.equal(perkChecks, 0);
automation.eternityUpgradeReserve = () => null;
assert.equal(automation.buyEternityUpgrades(), true);
assert.equal(context.balance, 100);
assert.equal(perkChecks, 1);
assert.equal(automation.buyEternityUpgrades(), false);
assert.equal(context.balance, 100);
console.log("PASS：总开关、挑战限制、启动资金、升级限购和 EP 倍率支出");
