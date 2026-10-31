#!/usr/bin/env node
// [R42-B] 静态断言：NumberCurrency 的 `.value` 上不得调用 Decimal 专有方法。
//
// 背景（真实事故，两次同类）：
//   · `oreki-endgame-automation.js` 的 `iu25ConditionsReady()` 曾写
//     `Currency.imaginaryMachines.value.gte(成本)`（R39 修）；
//   · 同一文件的 `debugState` 里仍有 `Currency.imaginaryMachines.value.log10()`
//     （R42-B 发现，本轮修）。
//   `Currency.imaginaryMachines` 是 `NumberCurrency`（currency.js:420），
//   `.value` 是**普通 number**，没有任何 Decimal 方法 → 抛 TypeError →
//   被各处的 `catch` 吞掉 → 判据「恒为 false」或诊断字段「恒为 null」，
//   表面上看不出任何异常。
//
// 这份脚本把「哪一类调用会静默失效」变成一次非零退出，避免第四次踩同一个坑。
// 规范依据：AGENTS.md §26.1（断言必须有会 raise 的入口）、§26.2（默认 fail closed）。
//
// 用法：
//   node scripts/validate_number_currency.mjs            # 扫 src/，有问题 exit 1
//   node scripts/validate_number_currency.mjs --selftest # 只跑负例自测
//
// 退出码：0 = 干净；1 = 发现违例；2 = 自测未拦住（断言本身失效）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");

/** currency.js 里 `extends NumberCurrency` 的实例（`.value` 是普通 number） */
const NUMBER_CURRENCIES = [
  "realities", "perkPoints", "relicShards", "imaginaryMachines",
  "darkEnergy", "singularities", "remnants", "galaxyGeneratorGalaxies",
];

/** 只存在于 Decimal（break_infinity.js）上的方法名 */
const DECIMAL_METHODS = [
  "gte", "lte", "gt", "lt", "eq",
  "times", "dividedBy", "plus", "minus", "pow", "reciprocal", "pow_base",
  "log10", "log2", "ln", "log", "exponent", "mantissa", "e",
  "toNumber", "toFixed", "clampMin", "clampMax", "clamp", "floor", "ceil",
  "round", "max", "min", "abs", "neg", "sqrt", "powEffectOf",
];

const RE = new RegExp(
  String.raw`Currency\.(${NUMBER_CURRENCIES.join("|")})\.value\s*\.\s*(${DECIMAL_METHODS.join("|")})\b`,
  "g",
);

/**
 * 返回问题清单（**不抛异常**）。按 §26.1，调用方必须用 `validate()`（会退出）
 * 而不是这个函数单独当断言。
 * @param {string} code 源码文本
 * @param {string} file 用于报告的文件名
 * @returns {{file: string, line: number, col: number, text: string}[]}
 */
export function scanText(code, file) {
  const problems = [];
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过整行注释（行内注释无法可靠区分，宁可多报）
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(line)) !== null) {
      problems.push({ file, line: i + 1, col: m.index + 1, text: m[0] });
    }
  }
  return problems;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith(".js")) out.push(p);
  }
  return out;
}

export function scanRepo(srcDir = SRC) {
  const problems = [];
  for (const f of walk(srcDir)) {
    problems.push(...scanText(fs.readFileSync(f, "utf8"), f));
  }
  return problems;
}

/** 会抛异常的入口：有问题就抛出，自测靠这个判负 */
export function validate(srcDir = SRC) {
  const problems = scanRepo(srcDir);
  if (problems.length) {
    const lines = problems.map(p => `  ${p.file}:${p.line}:${p.col}  ${p.text}`);
    throw new Error(`发现 ${problems.length} 处 NumberCurrency.value 上调用 Decimal 方法：\n${lines.join("\n")}`);
  }
  return true;
}

function selftest() {
  const bad = [
    "const a = Currency.imaginaryMachines.value.gte(5e9);",
    "const b = Currency.imaginaryMachines.value.log10();",
    "if (Currency.realities.value.lt(60)) return false;",
    "x = Currency.perkPoints.value.times(2);",
  ].join("\n");
  const good = [
    "const a = Currency.imaginaryMachines.value >= 5e9;",
    "const b = Math.log10(Currency.imaginaryMachines.value);",
    "if (Currency.realities.value < 60) return false;",
    "if (Currency.realities.lt(60)) return false;", // Currency 对象自己带 gt/gte/lt/lte
    "const c = Currency.infinityPoints.value.log10();", // DecimalCurrency，合法
    "// Currency.realities.value.lt(1) 注释里不算",
  ].join("\n");

  const badHits = scanText(bad, "<neg>");
  if (badHits.length !== 4) {
    console.error(`[自测失败] 负例应命中 4 处，实际 ${badHits.length} 处`);
    process.exit(2);
  }
  const goodHits = scanText(good, "<pos>");
  if (goodHits.length !== 0) {
    console.error(`[自测失败] 正例不应命中，实际 ${goodHits.length} 处：${JSON.stringify(goodHits)}`);
    process.exit(2);
  }
  // 关键的 fail-closed 检查：负例必须能被 validate 的同类入口拦住
  let threw = false;
  try {
    const tmp = path.join(HERE, "..", ".tmp-number-currency-selftest");
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, "x.js"), bad);
    validate(tmp);
  } catch (e) {
    threw = true;
  } finally {
    fs.rmSync(path.join(HERE, "..", ".tmp-number-currency-selftest"), { recursive: true, force: true });
  }
  if (!threw) {
    console.error("[自测失败] validate() 没有对负例抛异常（断言形同不存在，见 §26.1）");
    process.exit(2);
  }
  console.log("[自测通过] 负例 4/4 命中，正例 0 误报，validate() 会抛异常");
}

if (process.argv.includes("--selftest")) {
  selftest();
} else {
  selftest();
  try {
    validate();
    console.log(`[通过] src/ 下 ${NUMBER_CURRENCIES.length} 个 NumberCurrency 均无 Decimal 方法误用`);
  } catch (e) {
    console.error(`[失败] ${e.message}`);
    process.exit(1);
  }
}
