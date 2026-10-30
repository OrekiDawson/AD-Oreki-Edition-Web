// 两组对照的按时刻对齐比较（只读 jsonl）
import fs from "node:fs";

const files = process.argv.slice(2);
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f, "no file"); continue; }
  const L = fs.readFileSync(f, "utf8").trim().split("\n").map(s => JSON.parse(s));
  const at = t => [...L].reverse().find(r => r.t <= t) ?? null;
  console.log(`=== ${f} n=${L.length} lastT=${L[L.length - 1].t}`);
  for (const t of [10, 60, 120, 180, 240, 300, 400, 500, 600, 700, 800]) {
    const r = at(t);
    if (!r) continue;
    console.log(`  t=${t} stage=${r.smStage} real=${r.realities} amE=${r.amE} endState=${r.endState} totAML=${r.totAML} tut=${r.tutOpen}/${r.tutNodes} "${r.tutTitle}"`);
  }
}
