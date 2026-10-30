// 全量核对：src/core + src/game.js 归一化后仍存在的逻辑差异
import fs from "node:fs";
import path from "node:path";

const A = "upstream/ADChinese";
const B = "upstream/ADfaster";

const norm = l => l.replace(/\r$/, "")
  .replace(/(from\s+["'][^"']*)\.js(["'])/g, "$1$2")
  .replace(/"(?:[^"\\]|\\.)*"/g, '<S>')
  .replace(/'(?:[^'\\]|\\.)*'/g, '<S>')
  .replace(/`/g, '`');

function walk(d, base, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else if (e.name.endsWith(".js")) out.push(path.relative(base, p));
  }
  return out;
}

const files = walk(path.join(A, "src/core"), A).concat(["src/game.js"]);

function align(la, lb) {
  const n = la.length, m = lb.length;
  const na = la.map(norm), nb = lb.map(norm);
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const res = [];
  let i = 0, j = 0, del = [], ins = [];
  const flush = () => {
    const k = Math.max(del.length, ins.length);
    for (let x = 0; x < k; x++) res.push([del[x] || null, ins[x] || null]);
    del = []; ins = [];
  };
  while (i < n && j < m) {
    if (na[i] === nb[j]) { flush(); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { del.push({ ln: i + 1, t: la[i] }); i++; }
    else { ins.push({ ln: j + 1, t: lb[j] }); j++; }
  }
  while (i < n) { del.push({ ln: i + 1, t: la[i] }); i++; }
  while (j < m) { ins.push({ ln: j + 1, t: lb[j] }); j++; }
  flush();
  return res.filter(([a, b]) => (a ? a.t : "").trim() !== "" || (b ? b.t : "").trim() !== "");
}

const report = [];
for (const f of files) {
  const pa = path.join(A, f), pb = path.join(B, f);
  if (!fs.existsSync(pb)) { report.push([f, -1, "仅中文版存在"]); continue; }
  const pairs = align(fs.readFileSync(pa, "utf8").split("\n"), fs.readFileSync(pb, "utf8").split("\n"));
  if (pairs.length) report.push([f, pairs.length, pairs]);
}

const onlyZh = report.filter(r => r[1] === -1);
console.log(`仅中文版存在的 core 文件: ${onlyZh.map(r => r[0]).join(", ") || "无"}`);
console.log(`\n存在逻辑差异的文件: ${report.filter(r => r[1] > 0).length}\n`);

for (const [f, n, pairs] of report) {
  if (n <= 0) continue;
  console.log(`\n===== ${f}  (${n}) =====`);
  for (const [a, b] of pairs.slice(0, 14)) {
    console.log(`  - ${a ? `L${a.ln}: ${a.t.trim().slice(0, 130)}` : "(无)"}`);
    console.log(`  + ${b ? `L${b.ln}: ${b.t.trim().slice(0, 130)}` : "(无)"}`);
  }
  if (pairs.length > 14) console.log(`  ... 还有 ${pairs.length - 14} 处`);
}
