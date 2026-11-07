// R94：附录 C（记数法）定向回归测试
// 缺陷来源：旧文本用 `ee15.955`（《指数增量》的写法）冒充本作记数法，且工程记数法示例
// `1.23e45` / `12.3e42` 数值并不相等。本测试对照本作真实实现（modules/notations.js
// + src/core/new-game.js 的 exponentCommas 阈值 + player.js 的 notationDigits 默认值）
// 断言附录 C 的描述与示例必须一致，并防止旧错误回归。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const data = JSON.parse(read("src/core/oreki-tutorial-data.json"));
const appendix = (data.appendices || []).find((a) => (a.title || "").includes("记数法"));
if (!appendix) {
  console.error("FAIL 找不到附录 C（记数法）");
  process.exit(1);
}
const body = appendix.body || "";

let pass = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? "  — " + detail : ""}`); }
  else { fails.push(name); console.log(`FAIL ${name}${detail ? "  — " + detail : ""}`); }
}

// 1) 两层指数必须用本作真实形态：指数里再带 e
check("附录 C 给出 `1.23e1.00e9` 两层指数示例", body.includes("1.23e1.00e9"));
check("附录 C 给出对数记数法的 `e1.00e9` 形态", body.includes("e1.00e9"));
check("附录 C 不再给出 `ee15.955` 旧错误示例", !body.includes("ee15.955"));
check("附录 C 不把 `ee` 前缀当成本作写法", !/没有.*以 `ee` 开头/.test(body) ? false : true);

// 2) 工程记数法示例必须数值相等
const eng = /`12\.3e45`/.test(body) && /`1\.23e46`/.test(body);
check("附录 C 工程记数法示例同时给出 `12.3e45` 与 `1.23e46`", eng);
check("工程记数法示例数值严格相等（12.3e45 === 1.23e46）",
  Math.abs(12.3e45 - 1.23e46) <= 1.23e46 * 1e-12,
  `${12.3e45} vs ${1.23e46}`);

// 3) 对数记数法示例与真实公式一致：e45.09 = 10^45.09 ≈ 1.23e45
check("附录 C 对数示例 `e45.09` 存在", body.includes("e45.09"));
const logValue = Math.pow(10, 45.09);
check("`e45.09` 与 `1.23e45` 一致（误差 < 1%）", Math.abs(logValue - 1.23e45) < 1.23e45 * 0.01,
  `${logValue.toExponential(3)}`);

// 4) 阈值必须与代码默认值一致：comma=5 → 1e5；notation=9 → 1e9
const playerSrc = read("src/core/player.js");
const commaDigits = Number((playerSrc.match(/\bcomma:\s*(\d+)/) || [])[1]);
const notationDigits = Number((playerSrc.match(/\bnotation:\s*(\d+)/) || [])[1]);
check("player.js 默认 notationDigits 为 comma=5 / notation=9",
  commaDigits === 5 && notationDigits === 9, `comma=${commaDigits}, notation=${notationDigits}`);
check("附录 C 阈值与代码一致（1e5 千分位、1e9 折叠）",
  body.includes("1e5") && body.includes("1e9") &&
  Math.pow(10, commaDigits) === 1e5 && Math.pow(10, notationDigits) === 1e9);

// 5) 实现侧对照：notations.js 的两层逻辑是「指数再 formatDecimal」，不是 ee 前缀
const notationSrc = read("modules/notations.js");
check("notations.js 的 formatExponent 用递归 formatDecimal 产生嵌套指数",
  /formatDecimal\(new Decimal/.test(notationSrc.replace(/\s+/g, " ")) ||
  notationSrc.includes("return this.formatDecimal(new Decimal(exponent)"));
check("notations.js 不含 `ee` 前缀写法", !notationSrc.includes('"ee"'));

// 6) 生成物同步（.gen.js 必须已包含新文本）
const gen = read("src/core/oreki-tutorial-data.gen.js");
check("生成模块已同步新文本（含 1.23e1.00e9）", gen.includes("1.23e1.00e9"));
check("生成模块不含旧错误（ee15.955）", !gen.includes("ee15.955"));

console.log(`\n附录 C 记数法定向测试：${pass} 项通过，失败 ${fails.length} 项`);
if (fails.length) { fails.forEach((f) => console.log("  FAIL", f)); process.exit(1); }
console.log("  全部通过");