// 从 full1 的 jsonl 里抽取里程碑墙钟与 amE/IM 曲线（只读）
import fs from "node:fs";
const dir = new URL("./", import.meta.url);
const files = fs.readdirSync(dir).filter(x => x.endsWith(".jsonl"))
  .map(x => ({ x, m: fs.statSync(new URL(x, dir)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
const f = files[0].x;
const lines = fs.readFileSync(new URL(f, dir), "utf8").trim().split("\n").map(JSON.parse);
console.log(`文件 ${f}，样本 ${lines.length}，t=${lines[0].t}..${lines[lines.length - 1].t}s`);

const first = (pred, name) => {
  const hit = lines.find(pred);
  console.log(hit ? `  ${name.padEnd(22)} t=${hit.t}s  (r=${hit.realities}, amE=${Number(hit.amE).toExponential(2)}, im=${hit.imL?.toFixed?.(0)})` : `  ${name.padEnd(22)} 未达成`);
};
console.log("里程碑：");
first(l => l.realities >= 60, "realities>=60");
first(l => l.laiUnl === true, "Laitela 解锁");
first(l => l.iu15 === true, "IU15 已买入");
first(l => (l.laiTier ?? 0) >= 1, "Laitela tier>=1");
first(l => (l.laiTier ?? 0) >= 4, "Laitela tier>=4");
first(l => (l.laiTier ?? 0) >= 8, "Laitela tier=8");
first(l => l.iu25 === true, "IU25 已买入");
first(l => l.pelleUnl === true, "Pelle 解锁");
first(l => l.doomed === true, "进入毁灭现实");
first(l => l.gameEnd === true, "isGameEnd");

const maxAmE = lines.reduce((a, l) => Math.max(a, Number(l.amE) || 0), 0);
console.log(`峰值 amE = ${maxAmE.toExponential(3)}`);
const last = lines[lines.length - 1];
console.log("末态：", JSON.stringify({
  t: last.t, r: last.realities, amE: Number(last.amE).toExponential(2), iu15: last.iu15,
  laiTier: last.laiTier, iu25: last.iu25, pelle: last.pelleUnl, doomed: last.doomed, gameEnd: last.gameEnd,
  im: last.imL?.toFixed?.(0), sp: last.sp,
}));
