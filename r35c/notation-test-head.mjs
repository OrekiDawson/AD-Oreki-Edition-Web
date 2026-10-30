// R35-C 记数法回归：Scientific（用户选定标准科学记数法）vs Mixed scientific（对照，必须不变）
import Decimal from "./head/break_infinity.js";
import { ADNotations } from "./head/notations.js";

const sci = new ADNotations.ScientificNotation();
const mixed = new ADNotations.MixedScientificNotation();

const cases = [
  ["1e10", "1e10"],
  ["1e45", "1e45"],
  ["1e99999", "1e99999"],
  ["1e123456", "1e123456"],
  ["8.62e27810000000", "8.62e27810000000"],
  ["1e(1e21)", "1e" + "0".repeat(0)],
];
const list = [
  ["1e10", new Decimal(1).times(Decimal.pow(10, 10))],
  ["1e45", new Decimal("1e45")],
  ["1e99999", new Decimal("1e99999")],
  ["1.234e123456", new Decimal("1.234e123456")],
  ["8.62e27810000000", new Decimal("8.62e27810000000")],
];
for (const [label, d] of list) {
  let s, m;
  try { s = sci.format(d, 2); } catch (e) { s = "ERR " + e.message; }
  try { m = mixed.format(d, 2); } catch (e) { m = "ERR " + e.message; }
  console.log(`${label.padEnd(20)} Scientific=${String(s).padEnd(30)} MixedScientific=${m}`);
}
const probe = new Decimal("8.62e27810000000");
console.log("exponent(floor) =", Math.floor(probe.log(10)), "| 显示 =", sci.format(probe, 2));
console.log("Decimal.MAX_VALUE 显示 =", sci.format(Decimal.MAX_VALUE, 2));
