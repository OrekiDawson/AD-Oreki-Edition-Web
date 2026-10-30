// 只读探针：确认 Web 端 Scientific / Mixed scientific 在超大指数下的真实输出与耗时。
// 不修改任何游戏代码。
import { ADNotations } from "../AD-Oreki-Edition/modules/notations.js";
import Decimal from "../AD-Oreki-Edition/modules/break_infinity.js";

const { ScientificNotation, MixedScientificNotation, StandardNotation, EngineeringNotation, Settings } = ADNotations;

// 与 src/core/storage.js:486-487 / new-game.js:93-94 一致的默认档位
Settings.exponentCommas.show = true;
Settings.exponentCommas.min = 10 ** 5;
Settings.exponentCommas.max = 10 ** 9;

function dec(s) {
  return Decimal.fromString ? Decimal.fromString(s) : new Decimal(s);
}

const cases = [
  "8.62e27810000000", // 主 Agent 报的失败案例
  "1e4226885349",     // vchain 停摆前一刻的 antimatter
  "1e170000000",      // 同一时刻的 IP（10^1.7e8，用合法串重测）
  "1e45",
  "1e34",
  "1e33",
  "1e10",
  "12345",
];

const notes = {
  Scientific: new ScientificNotation(),
  "Mixed scientific": new MixedScientificNotation(),
  Engineering: new EngineeringNotation(),
  Standard: new StandardNotation(),
};

let maxUs = 0;
for (const label of cases) {
  const v = dec(label);
  for (const [name, n] of Object.entries(notes)) {
    let out = null, err = null;
    const t0 = process.hrtime.bigint();
    try { out = n.format(v, 3, 3, 3); } catch (e) { err = `${e.constructor.name}: ${e.message}`; }
    const us = Number(process.hrtime.bigint() - t0) / 1000;
    if (us > maxUs) maxUs = us;
    console.log(`x=${label.padEnd(14)} ${name.padEnd(18)} -> ${err ? "THROW " + err : JSON.stringify(out)}  (${us.toFixed(0)} us)`);
  }
}
console.log(`\n单次格式化最大耗时: ${maxUs.toFixed(0)} us`);

// 递归深度探针：直接数 formatDecimal 的重入次数
class DepthProbe extends ScientificNotation {
  constructor() { super(); this.depth = 0; this.maxDepth = 0; }
  formatDecimal(v, p, pe) {
    this.depth++; this.maxDepth = Math.max(this.maxDepth, this.depth);
    try { return super.formatDecimal(v, p, pe); } finally { this.depth--; }
  }
}
const probe = new DepthProbe();
for (const label of ["8.62e27810000000", "1e4226885349"]) {
  const out = probe.format(dec(label), 3, 3, 3);
  console.log(`x=${label} formatDecimal 最大重入深度: ${probe.maxDepth}，Scientific 输出 ${JSON.stringify(out)}`);
  probe.maxDepth = 0;
}
