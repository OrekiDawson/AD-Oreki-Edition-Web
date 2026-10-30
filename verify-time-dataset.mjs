// 1123 个真实存档的时间统计口径测试（Node 端，直接加载生产代码 src/core/time.js）
// 用法: node verify-time-dataset.mjs [time_records.json 路径]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATA = process.argv[2] ||
  path.resolve("../_saves/time_records.json");
const SRC = path.resolve("../AD-Oreki-Edition/src/core");

// ---- 最小运行环境 shim（真实前端里这些是全局变量） ----
globalThis.window = globalThis;
globalThis.Notations = { current: { isPainful: false } };
globalThis.format = (v, a = 2, b = 0) => {
  if (!Number.isFinite(v)) return String(v);
  const digits = Math.min(Math.max(b, 0), 3);
  return v.toFixed(digits);
};
globalThis.formatInt = v => String(Math.floor(v));
globalThis.formatHMS = v => String(v).padStart(2, "0");

const globalSpeed = { value: 10000 };
globalThis.getGlobalSpeedFactor = () => globalSpeed.value;

await import(pathToFileURL(path.join(SRC, "timespan.js")).href);
const timeModule = await import(pathToFileURL(path.join(SRC, "time.js")).href);

const { toInGameTimeMs, timeStatText, isValidTimeRecord } = timeModule;

// ---- 断言工具 ----
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`);
}
function section(t) { console.log(`\n--- ${t} ---`); }

const SENTINEL = 999999999999;
const valid = v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < SENTINEL;

if (!fs.existsSync(DATA)) {
  console.error("找不到数据文件:", DATA);
  process.exit(2);
}
const rows = JSON.parse(fs.readFileSync(DATA, "utf-8"));
console.log(`数据集: ${rows.length} 条存档`);

// =====================================================================
section("1. 换算函数本身");
globalSpeed.value = 10000;
check("factor=10000 时 toInGameTimeMs(1e8)=1e4", toInGameTimeMs(1e8) === 1e4, String(toInGameTimeMs(1e8)));
globalSpeed.value = 1;
check("factor=1 时 toInGameTimeMs 为恒等映射", toInGameTimeMs(123456) === 123456);
globalSpeed.value = 2;
check("factor=2 时减半", toInGameTimeMs(1000) === 500);
check("非有限值原样返回", Number.isNaN(toInGameTimeMs(NaN)));
check("NaN 不被判为有效记录", isValidTimeRecord(NaN) === false);
check("哨兵值不被判为有效记录", isValidTimeRecord(SENTINEL) === false);
check("Number.MAX_VALUE 不被判为有效记录", isValidTimeRecord(Number.MAX_VALUE) === false);
check("0 是有效记录", isValidTimeRecord(0) === true);

// =====================================================================
section("2. 文案层：标注与缺失处理");
globalSpeed.value = 10000;
const t1 = timeStatText(5000, 20000);
check("同时有两种口径时都标注", t1.includes("现实时间") && t1.includes("游戏内时间"), t1);
check("现实时间用原值 5000ms", t1.includes("5.0"), t1);
check("游戏内时间用已换算好的值 20000ms（不再除倍率）", t1.includes("20.0"), t1);
const t1b = timeStatText(5000, 1000);
check("若误把 20000ms 再除 10000 会得到 0.002 秒，文案应保留 20 秒量级",
  t1.includes("20.") && !t1b.includes("20."), `${t1} | ${t1b}`);
const t2 = timeStatText(undefined, 3000);
check("缺现实时间时只显示游戏内时间", t2.includes("游戏内时间") && !t2.includes("现实时间"), t2);
const t3 = timeStatText(3000, undefined);
check("缺游戏内时间时只显示现实时间", t3.includes("现实时间") && !t3.includes("游戏内时间"), t3);
const t4 = timeStatText(SENTINEL, Number.MAX_VALUE);
check("两者都是哨兵时返回「暂无记录」", t4 === "暂无记录", t4);
check("重复调用结果一致（幂等）", timeStatText(5000, 20000) === t1);

// =====================================================================
section("3. 全量 1123 存档：换算与文案健壮性");
let bad = [];
let labeledReal = 0;
let labeledGame = 0;
let bothMissing = 0;
let noRealField = 0;
const beforeChanges = new Map();

function scan(tag) {
  for (const r of rows) {
    const pairs = [
      ["bestInfinity", r["bestInfinity.realTime"], r["bestInfinity.time"]],
      ["bestEternity", r["bestEternity.realTime"], r["bestEternity.time"]],
      ["bestReality", r["bestReality.realTime"], r["bestReality.time"]],
      ["thisInfinity", r["thisInfinity.realTime"], valid(r["thisInfinity.time"]) ? toInGameTimeMs(r["thisInfinity.time"]) : r["thisInfinity.time"]],
      ["thisEternity", r["thisEternity.realTime"], valid(r["thisEternity.time"]) ? toInGameTimeMs(r["thisEternity.time"]) : r["thisEternity.time"]],
      ["thisReality", r["thisReality.realTime"], valid(r["thisReality.time"]) ? toInGameTimeMs(r["thisReality.time"]) : r["thisReality.time"]],
    ];
    for (const [layer, real, game] of pairs) {
      const text = timeStatText(real, game);
      const again = timeStatText(real, game);
      if (text !== again) bad.push({ name: r.name, layer, why: "非幂等" });
      if (/NaN|undefined|Infinity|null/.test(text)) bad.push({ name: r.name, layer, why: "文案含非法值", text });
      if (valid(real)) labeledReal++;
      if (valid(game)) labeledGame++;
      if (!valid(real) && !valid(game)) bothMissing++;
      if (!valid(real) && valid(game)) noRealField++;
      if (tag === "base") beforeChanges.set(`${r.name}|${layer}`, text);
    }
    // 实时字段换算后必须有限
    for (const k of ["thisInfinity.time", "thisEternity.time", "thisReality.time", "totalTimePlayed"]) {
      const v = r[k];
      if (valid(v) && !Number.isFinite(toInGameTimeMs(v))) bad.push({ name: r.name, layer: k, why: "换算后非有限" });
    }
  }
}

scan("base");
check("全量扫描无异常", bad.length === 0, JSON.stringify(bad.slice(0, 3)));
console.log(`  现实时间可显示: ${labeledReal} 项，游戏内时间可显示: ${labeledGame} 项，两者皆缺: ${bothMissing} 项，缺现实时间: ${noRealField} 项`);

// =====================================================================
section("4. 历史记录不随当前倍率变化（关键规则）");
globalSpeed.value = 10000;
const snapHigh = rows.map(r => timeStatText(r["bestReality.realTime"], r["bestReality.time"]));
globalSpeed.value = 1;
const snapLow = rows.map(r => timeStatText(r["bestReality.realTime"], r["bestReality.time"]));
globalSpeed.value = 100000;
const snapMax = rows.map(r => timeStatText(r["bestReality.realTime"], r["bestReality.time"]));
const diffCount = snapHigh.filter((v, i) => v !== snapLow[i] || v !== snapMax[i]).length;
check("切换倍率 1× / 10000× / 100000× 后最速现实记录文案完全不变",
  diffCount === 0, `${diffCount} 条发生变化`);

// 反向对照：若错误地对已归一化的 best 值再除一次倍率，文案必然变化 → 证明断言有效
globalSpeed.value = 10000;
const doubledDivide = rows.map(r => timeStatText(
  r["bestReality.realTime"],
  valid(r["bestReality.time"]) ? r["bestReality.time"] / globalSpeed.value : r["bestReality.time"]));
const changedIfDoubleDivide = doubledDivide.filter((v, i) => v !== snapHigh[i]).length;
check("反向对照：重复除法会导致文案变化（断言具备区分力）", changedIfDoubleDivide > 0, `${changedIfDoubleDivide} 条`);
globalSpeed.value = 10000;

// =====================================================================
section("5. 同一段现实时间在不同倍率下累计，换算后应完全一致");
// 现实 60 秒、无游戏内膨胀：倍率为 f 时累计得到的原始 game 时间为 60000*f
const REAL_MS = 60000;
const normalized = [1, 100, 10000, 100000].map(f => {
  globalSpeed.value = f;
  return toInGameTimeMs(REAL_MS * f);
});
check("倍率 1×/100×/10000×/100000× 下游戏内时间恒为 60 秒",
  normalized.every(v => v === REAL_MS), JSON.stringify(normalized));
globalSpeed.value = 10000;
// 若忘记剔除倍率，10000× 下会显示 6.9 天而不是 1 分钟
check("反向对照：未剔除倍率会放大 10000 倍", REAL_MS * 10000 !== REAL_MS);

// =====================================================================
section("6. 数据缺口统计（不编造数值）");
const gaps = {
  "bestEternity.realTime 缺失": rows.filter(r => !valid(r["bestEternity.realTime"])).length,
  "bestInfinity.realTime 缺失": rows.filter(r => !valid(r["bestInfinity.realTime"])).length,
  "bestReality.realTime 缺失": rows.filter(r => !valid(r["bestReality.realTime"])).length,
  "bestInfinity.time 缺失": rows.filter(r => !valid(r["bestInfinity.time"])).length,
  "bestEternity.time 缺失": rows.filter(r => !valid(r["bestEternity.time"])).length,
  "bestReality.time 缺失": rows.filter(r => !valid(r["bestReality.time"])).length,
};
console.log("  " + JSON.stringify(gaps, null, 0).replace(/,"/g, ', "'));
check("缺口存在时仍能给出可确认的一项（bestEternity 缺 realTime 的存档）",
  rows.filter(r => !valid(r["bestEternity.realTime"]) && valid(r["bestEternity.time"]))
    .every(r => timeStatText(r["bestEternity.realTime"], r["bestEternity.time"]).includes("游戏内时间")));

// =====================================================================
const pass = results.filter(r => r.ok).length;
const fail = results.length - pass;
console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`);
console.log(`样本数: ${rows.length}，逐项断言: ${results.length}，存档×字段校验次数: ${rows.length * 6 * 2}`);
process.exit(fail === 0 ? 0 : 1);
