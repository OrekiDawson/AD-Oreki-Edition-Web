// 生成可执行的移植清单：对每个文件做行级对齐 diff，输出「中文侧原行 → 英文侧新行」
// 只输出涉及速度逻辑的变更
import fs from "node:fs";
import path from "node:path";

const A = "upstream/ADChinese";   // 中文基线
const B = "upstream/ADfaster";    // 英文加速版

const TOKENS = /getGlobalSpeedFactor|globalSpeedFactor|blackHoleDiff|realDiff/;

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

const norm = l => l.replace(/\r$/, "")
  .replace(/(from\s+["'][^"']*)\.js(["'])/g, "$1$2")
  .replace(/"(?:[^"\\]|\\.)*"/g, '<S>')
  .replace(/'(?:[^'\\]|\\.)*'/g, '<S>');

function align(la, lb) {
  const n = la.length, m = lb.length;
  const na = la.map(norm), nb = lb.map(norm);
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  let i = 0, j = 0;
  let del = [], ins = [];
  const flush = () => {
    const k = Math.max(del.length, ins.length);
    for (let x = 0; x < k; x++) pairs.push([del[x] || null, ins[x] || null]);
    del = []; ins = [];
  };
  while (i < n && j < m) {
    if (na[i] === nb[j]) { flush(); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { del.push({ ln: i + 1, txt: la[i] }); i++; }
    else { ins.push({ ln: j + 1, txt: lb[j] }); j++; }
  }
  while (i < n) { del.push({ ln: i + 1, txt: la[i] }); i++; }
  while (j < m) { ins.push({ ln: j + 1, txt: lb[j] }); j++; }
  flush();
  return pairs;
}

for (const f of files) {
  const pa = path.join(A, f), pb = path.join(B, f);
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) { console.log(`!! MISSING ${f}`); continue; }
  const la = fs.readFileSync(pa, "utf8").split("\n");
  const lb = fs.readFileSync(pb, "utf8").split("\n");
  const pairs = align(la, lb);
  const hits = pairs.filter(([a, b]) =>
    (b && TOKENS.test(b.txt)) || (a && TOKENS.test(a.txt)) ||
    // 中文侧行与英文侧行内容不同且英文侧不是纯译文 —— 由 token 判定，这里只看 token
    false);
  if (!hits.length) { console.log(`\n### ${f} — 无速度相关差异`); continue; }
  console.log(`\n### ${f}  (${hits.length} 处)`);
  for (const [a, b] of hits) {
    console.log(`  L${a ? a.ln : "-"}  << ${a ? a.txt.trim().slice(0, 150) : "(无对应行)"}`);
    console.log(`  L${b ? b.ln : "-"}  >> ${b ? b.txt.trim().slice(0, 150) : "(被删除)"}`);
  }
}
