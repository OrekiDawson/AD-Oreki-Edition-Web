// 只读分析：把「每个现实里 amE 首次越过 1e8 / 4e8 / 1e10 时的 thisRealSec」做成分布摘要
// amE 在这里 = player.antimatter.exponent（= log10(反物质)），与 LAT_RUN_MIN_AM_EXP 同一量纲。
import fs from "node:fs";

const files = process.argv.slice(2);
for (const file of files) {
  const rows = fs.readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const segs = [];
  let cur = null;
  for (const r of rows) {
    if (!cur || r.thisRealSec < cur.lastSec || r.thisRealSec === 0) {
      cur = { start: r.t, rows: [], lastSec: r.thisRealSec };
      segs.push(cur);
    }
    cur.rows.push(r);
    cur.lastSec = r.thisRealSec;
  }
  const out = [];
  for (const s of segs) {
    if (s.rows.length < 3) continue;
    const rec = { start: s.start, end: s.rows[s.rows.length - 1].t };
    for (const th of [1e8, 4e8, 1e10]) {
      const hit = s.rows.find(r => typeof r.amE === "number" && r.amE >= th);
      rec[th] = hit ? hit.thisRealSec : null;
    }
    out.push(rec);
  }
  const stat = th => {
    const v = out.map(r => r[th]).filter(x => x !== null).sort((a, b) => a - b);
    if (!v.length) return `${th}: 0 段`;
    const q = p => v[Math.min(v.length - 1, Math.floor(v.length * p))];
    return `${th.toExponential(0)}: ${v.length}/${out.length} 段达到，现实秒 min=${v[0]} p50=${q(0.5)} p90=${q(0.9)} max=${v[v.length - 1]}；<15 s 的 ${v.filter(x => x < 15).length} 段`;
  };
  console.log(`\n=== ${file.split("/").pop()}  段=${out.length} 采样=${rows.length}`);
  console.log("  " + stat(1e8));
  console.log("  " + stat(4e8));
  console.log("  " + stat(1e10));
  // 列出 4e8 的 2 个例外与 1e10 的全部
  const ex4 = out.filter(r => r[4e8] !== null && r[4e8] >= 15);
  if (ex4.length) console.log("  4e8 例外(>=15s):", JSON.stringify(ex4.map(r => ({ start: r.start, sec: r[4e8] }))));
  const ex10 = out.filter(r => r[1e10] !== null);
  if (ex10.length) console.log("  1e10 命中:", JSON.stringify(ex10.map(r => r[1e10])));
}
