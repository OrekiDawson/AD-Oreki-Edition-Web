// R42-B · 教程正文里的源码引用核对（纯静态，不需要浏览器）
//
// 做两件事：
//   1) 把 `oreki-tutorial-data.json` 里出现的每个 `xxx.js:123` / `yyy.js:10-20` 引用解析出来，
//      检查文件是否存在、行号是否还在文件范围内 —— 代码一改，教程里的行号最容易悄悄失效。
//   2) 统计每个 `numbers[].src` 的引用分布，供人工复核数值。
//
// 运行：node _tools/_r42b/tutorial-citation-check.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("AD-Oreki-Edition");
const DATA = path.join(ROOT, "src/core/oreki-tutorial-data.json");
const doc = JSON.parse(fs.readFileSync(DATA, "utf8"));

const lineCount = f => {
  try { return fs.readFileSync(f, "utf8").split("\n").length; } catch { return null; }
};

// 只认「看起来像仓库内相对路径」的引用，避免把 1.8e308 之类当文件名
// 扩展名后面必须是非单词字符：否则 ".js" 会把 ".jsonl" 的前缀也吃掉（本轮踩过）
const REF_RE = /([A-Za-z0-9_@./-]*[A-Za-z0-9_-]\.(?:jsonl|mjs|json|js|css|smali|py|html))(?![\w])(?::(\d+)(?:\s*[-~–]\s*(\d+))?)?/g;

const refs = [];
const addRef = (raw, where) => {
  // 以 : 结尾的裸行号（如「见 oreki.css:659」）单独再抓一次
  for (const m of raw.matchAll(REF_RE)) {
    refs.push({ file: m[1], from: m[2] ? Number(m[2]) : null, to: m[3] ? Number(m[3]) : m[2] ? Number(m[2]) : null, where });
  }
};

const strings = (obj, where, out = []) => {
  if (typeof obj === "string") out.push({ s: obj, where });
  else if (Array.isArray(obj)) obj.forEach((v, i) => strings(v, where, out));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) strings(v, `${where}.${k}`, out);
  return out;
};

for (const [i, ch] of doc.chapters.entries()) {
  for (const { s, where } of strings(ch, ch.id)) addRef(s, where);
}
for (const apx of doc.appendices) {
  for (const { s, where } of strings(apx, apx.id)) addRef(s, where);
}

// 解析真实路径：教程里的路径有多种写法（src/core/x.js、core/x.js、web/AD-Oreki-Edition/src/...）
// 文件名 → 路径索引（教程里经常只写文件名，不带目录）
const index = new Map();
(function walk(dir, depth) {
  if (depth > 8) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "build") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (!index.has(e.name)) index.set(e.name, p);
  }
})(ROOT, 0);

const CANDIDATE_BASES = [
  ROOT,
  path.resolve(ROOT, ".."),
  path.resolve(ROOT, "..", ".."),
];
const resolveFile = f => {
  const cleaned = f.replace(/^\.\//, "");
  for (const base of CANDIDATE_BASES) {
    const p = path.resolve(base, cleaned);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  // 只给了文件名（如 oreki.css）：在仓库里按名递归找一次（跳过 node_modules）
  const name = path.basename(cleaned);
  const hit = index.get(name);
  return hit || null;
};

const results = refs.map(r => {
  const p = resolveFile(r.file);
  if (!p) return { ...r, status: "missing-file" };
  if (r.from == null) return { ...r, status: "ok-no-line", resolved: path.relative(ROOT, p) };
  const n = lineCount(p);
  if (n == null) return { ...r, status: "unreadable", resolved: path.relative(ROOT, p) };
  if (r.from > n || (r.to && r.to > n)) return { ...r, status: "line-out-of-range", lines: n, resolved: path.relative(ROOT, p) };
  return { ...r, status: "ok", lines: n, resolved: path.relative(ROOT, p) };
});

const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

const problems = results.filter(r => r.status !== "ok" && r.status !== "ok-no-line");
const withLine = results.filter(r => r.from != null);

console.log("引用总数（去重前）:", results.length);
console.log("状态分布:", JSON.stringify(byStatus));
console.log("带行号的引用:", withLine.length);
if (problems.length) {
  console.log("\n=== 有问题的引用 ===");
  for (const p of problems) {
    console.log(`[${p.status}] ${p.file}${p.from != null ? ":" + p.from + (p.to && p.to !== p.from ? "-" + p.to : "") : ""}` +
      `${p.lines ? " (文件共 " + p.lines + " 行)" : ""}  ← ${p.where}`);
  }
} else {
  console.log("\n所有引用都能解析且行号未越界。");
}

// numbers[].src 单独列一份，便于人眼对数值
console.log("\n=== numbers[].src 清单 ===");
for (const ch of doc.chapters) {
  if (!Array.isArray(ch.numbers)) continue;
  for (const n of ch.numbers) {
    console.log(`${ch.id}\t${n.label}\t${n.value}\t${n.src || "（无 src）"}`);
  }
}

fs.writeFileSync(path.join("_tools/_r42b", "tutorial-citation-report.json"),
  JSON.stringify({ at: new Date().toISOString(), byStatus, problems, results, numbers: doc.chapters.flatMap(c => (c.numbers || []).map(n => ({ ch: c.id, ...n }))) }, null, 2));
console.log("\n报告写入 _tools/_r42b/tutorial-citation-report.json");
process.exit(0);
