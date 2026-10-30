// 归一化 diff：把字符串字面量内容替换为 <S>，import 去掉 .js 后缀
// 这样纯译文差异会消失，只剩下真正的逻辑差异
import fs from "node:fs";
import path from "node:path";

const A = process.argv[2]; // ADfaster (英文原文)
const B = process.argv[3]; // ADChinese (中文)

const files = [
  "src/game.js",
  "src/core/secret-formula/achievements/normal-achievements.js",
  "src/core/secret-formula/h2p.js",
  "src/core/normal-challenges.js",
  "src/core/secret-formula/reality/reality-upgrades.js",
  "src/core/infinity-challenges.js",
  "src/core/secret-formula/eternity/time-studies/normal-time-studies.js",
  "src/core/secret-formula/challenges/infinity-challenges.js",
  "src/core/secret-formula/challenges/eternity-challenges.js",
  "src/core/reality.js",
  "src/core/eternity.js",
  "src/core/black-hole.js",
  "src/core/big-crunch.js",
  "src/core/automator/automator-commands.js",
  "src/components/ui-modes/FailableEcText.js",
  "src/components/modals/AwayProgressModal.js",
];

function norm(line) {
  let s = line.replace(/\r$/, "");
  // import 路径后缀
  s = s.replace(/(from\s+["'][^"']*)\.js(["'])/g, "$1$2");
  // 字符串字面量内容 -> <S>（保留插值占位，避免过度吞掉）
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '<S>');
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, '<S>');
  // 模板字符串：只替换其中的 CJK 连续片段
  s = s.replace(/[\u4e00-\u9fff][\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]*/g, '<Z>');
  return s;
}

for (const f of files) {
  const pa = path.join(A, f);
  const pb = path.join(B, f);
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) { console.log(`!! MISSING ${f}  a=${fs.existsSync(pa)} b=${fs.existsSync(pb)}`); continue; }
  const na = fs.readFileSync(pa, "utf8").split("\n").map(norm);
  const nb = fs.readFileSync(pb, "utf8").split("\n").map(norm);
  // 简单 LCS diff
  const n = na.length, m = nb.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (na[i] === nb[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(["-", j + 1, nb[j], na[i]]); i++; }
    else { out.push(["+", j + 1, nb[j], na[i]]); j++; }
  }
  while (i < n) { out.push(["-", m, "", na[i]]); i++; }
  while (j < m) { out.push(["+", j + 1, nb[j], ""]); j++; }
  const real = out.filter(([t, , b, a]) => (b || "").trim() !== "" || (a || "").trim() !== "");
  if (!real.length) { console.log(`== ${f}: 归一化后无差异`); continue; }
  console.log(`\n===== ${f}  (${real.length} 行差异) =====`);
  for (const [t, ln, b] of real) {
    console.log(`  ${t === "-" ? "ADfaster(有/中文侧缺)" : "中文侧"}  L${ln}`);
  }
}
