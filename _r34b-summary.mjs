// 汇总 _r34b-*.jsonl：maxDT 曲线 / vProg / realities / EC / 膨胀关键事件
// 用法：node _r34b-summary.mjs _r34b-vchain1300.jsonl
import fs from "node:fs";

const file = process.argv[2];
const rows = fs.readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l));
const f = (v, d = 1) => (v === null || v === undefined ? "-" : Number(v).toFixed(d));

console.log(`# ${file}  样本 ${rows.length}，时长 ${rows[rows.length - 1].t}s\n`);
console.log("t(s) | real | dilU act | st seed | tpL   | maxDTL | dtRateL | hold | vCan vUnl | ST");
for (const s of rows) {
  if (s.t % 30 !== 0) continue;
  console.log([
    String(s.t).padStart(4),
    String(s.realities).padStart(4),
    (s.dilUnl ? "1" : "0") + " " + (s.dilActive ? "A" : "-"),
    String(s.dilStarts ?? "-") + " " + String(s.tpSeeds ?? "-"),
    f(s.tpL).padStart(6),
    f(s.maxDTL).padStart(6),
    f(s.dtRateL).padStart(7),
    s.holdV ? "1" : "0",
    (s.vCan ? "Y" : "-") + " " + (s.vUnlocked ? "Y" : "-"),
    String(s.spaceTh),
  ].join(" | "));
}

const firstDt = rows.find(s => s.maxDTL !== null && s.maxDTL !== undefined);
const firstTp = rows.find(s => s.tpL !== null);
const firstDil = rows.find(s => s.dilUnl === true);
const vUnl = rows.find(s => s.vUnlocked === true);
const last = rows[rows.length - 1];
console.log("\n关键事件:");
console.log("  首次 DS1 解锁 @", firstDil?.t, "s");
console.log("  首次 TP>0 @", firstTp?.t, "s  tpL=", f(firstTp?.tpL));
console.log("  首次 maxDT>0 @", firstDt?.t, "s  maxDTL=", f(firstDt?.maxDTL));
console.log("  V 解锁 @", vUnl?.t ?? "未解锁", "s");
console.log("  realities 轨迹:", [0, 60, 120, 180, 240, 300, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320]
  .map(t => { const r = rows.find(s => s.t >= t); return r ? `${r.t}:${r.realities}` : null; })
  .filter(Boolean).join(" "));
console.log("\n末态:", JSON.stringify({
  realities: last.realities, vProg: last.vProg, vCan: last.vCan, vUnlocked: last.vUnlocked,
  vRun: last.vRun, spaceTh: last.spaceTh, maxDTL: last.maxDTL, tpL: last.tpL,
  dilUnl: last.dilUnl, dilStarts: last.dilStarts, tpSeeds: last.tpSeeds,
  ecDone: last.ecDone, ttL: last.ttL, studiesN: last.studiesN, ds1: last.ds1,
  raPet: last.raPet, lait: last.lait, pelle: last.pelle, endState: last.endState,
}, null, 1));
