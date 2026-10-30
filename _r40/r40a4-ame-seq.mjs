// 只读分析：按现实周期切段，找每次现实里 amE 首次达到 1e8 / 4e8 / 1e10 时的 thisRealSec
import fs from "node:fs";

const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l));

// 切段：thisRealSec 变小（或归零）视为新现实
const segs = [];
let cur = null;
for (const r of lines) {
  if (!cur || r.thisRealSec < cur.lastSec || r.thisRealSec === 0) {
    cur = { start: r.t, rows: [], lastSec: r.thisRealSec, amEmax: 0 };
    segs.push(cur);
  }
  cur.rows.push(r);
  cur.lastSec = r.thisRealSec;
  if (typeof r.amE === "number" && r.amE > cur.amEmax) cur.amEmax = r.amE;
}

const thresholds = [1e8, 4e8, 1e10];
const out = [];
for (const s of segs) {
  if (s.rows.length < 3) continue;
  const rec = { start: s.start, end: s.rows[s.rows.length - 1].t, n: s.rows.length, amEmax: s.amEmax };
  for (const th of thresholds) {
    const hit = s.rows.find(r => typeof r.amE === "number" && r.amE >= th);
    rec["ge" + th] = hit ? { t: hit.t, sec: hit.thisRealSec, amE: hit.amE, holdR: hit.holdReality } : null;
  }
  out.push(rec);
}

console.log("file=", file, " lines=", lines.length, " segs=", segs.length);
const big = out.filter(r => r.amEmax >= 1e6 || r.n > 20);
console.log("--- 段（amEmax>=1e6 或 长度>20）共", big.length);
for (const r of big) {
  const f = o => o ? `t=${o.t}s/sec=${o.sec}/amE=${o.amE.toExponential(2)}/holdR=${o.holdR ? 1 : 0}` : "—";
  console.log(`[${r.start}→${r.end}] n=${r.n} amEmax=${r.amEmax.toExponential(2)} | 1e8:${f(r["ge100000000"])} | 4e8:${f(r["ge400000000"])} | 1e10:${f(r["ge10000000000"])}`);
}

// 统计：有多少段在 sec<15 时到达 4e8
let ok4 = 0, tot4 = 0;
for (const r of out) {
  if (r["ge400000000"]) { tot4++; if (r["ge400000000"].sec < 15) ok4++; }
}
console.log(`\n到达过 4e8 的现实段: ${tot4}; 其中 sec<15 即到达: ${ok4}`);
let ok10 = 0, tot10 = 0;
for (const r of out) {
  if (r["ge10000000000"]) { tot10++; if (r["ge10000000000"].sec < 15) ok10++; }
}
console.log(`到达过 1e10 的现实段: ${tot10}; 其中 sec<15 即到达: ${ok10}`);
