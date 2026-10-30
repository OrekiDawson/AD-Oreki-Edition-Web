// R35-C：复刻 auto-glyph-processor.js:232-360 的等级算法（默认权重 25/25/25/25、无 Effarig 调整、
// 无 perkShop/singularity/Ra shard），用来回答「达到 RU8 各层级需要多少 maxDT」。
// 这是 [静态推导]，公式逐行对齐源码；实测量测值见 _r35c-glyph400.jsonl。
import Decimal from "../../AD-Oreki-Edition/modules/break_infinity.js";

const preScale = 5;
const blendExp = 1 / 3;

function adjust(value, weightPct) {
  const powEffect = Math.pow(4 * (weightPct / 100), blendExp);
  return value > 0 ? Math.pow(value * preScale, powEffect) / preScale : 0;
}

function softcap(level, begin, rate) {
  if (level < begin) return level;
  const excess = (level - begin) / rate;
  return begin + 0.5 * rate * (Math.sqrt(1 + 4 * excess) - 1);
}

export function glyphLevel({ maxDTL, maxEpL, maxRepL, etL, weights = [25, 25, 25, 25] }) {
  const epBase = Math.pow(Math.max(1, maxEpL), 0.5) * 0.016;
  const replBase = Math.pow(Math.max(1, maxRepL), 0.4) * 0.025;
  const dtBase = Math.pow(Math.max(1, maxDTL), 1.3) * 0.025;
  const eterBase = Math.max(1, Math.sqrt(Math.max(0, etL) + 1) * 0.45);
  const ep = adjust(epBase, weights[0]);
  const repl = adjust(replBase, weights[1]);
  const dt = adjust(dtBase, weights[2]);
  const eter = adjust(eterBase, weights[3]);
  const base = ep * repl * dt * eter;
  let scaled = softcap(base, 1000, 500);
  scaled = softcap(scaled, 4000, 400);
  return { base, actual: Math.max(1, Math.floor(scaled)), dtBase, epBase, replBase, eterBase };
}

// 真实新档 R34 final300 末态（maxEpL 7.41e6 / maxRepL 2.6e4 / etL 88.4），扫 maxDT
const env = { maxEpL: 7412408, maxRepL: 26129, etL: 88.35 };
console.log("maxDT(log10) | dtBase | baseLevel | actualLevel");
for (const e of [0, 3, 7.66, 20, 60, 100, 175, 300, 1000, 3000, 10000, 27000, 100000]) {
  const r = glyphLevel({ ...env, maxDTL: e });
  console.log(String(e).padStart(12), "|", r.dtBase.toFixed(4).padStart(9), "|",
    r.base.toFixed(1).padStart(12), "|", String(r.actual).padStart(8));
}
// 反解：RU8 各层级所需 baseLevel / maxDT(log10)
const need = { 6500: 0, 7000: 0, 8000: 0, 9000: 0, 10000: 0, 6000: 0 };
function baseFor(level) {
  // 反解两级软上限
  const inv = (target, begin, rate) => begin + ((Math.pow((target - begin) / (0.5 * rate) + 1, 2) - 1) / 4) * rate;
  let s = target => target;
  let after = inv(level, 4000, 400);
  if (level < 4000) after = level;
  let base = inv(after, 1000, 500);
  if (after < 1000) base = after;
  return base;
}
console.log("\nRU8 层级 → 需要的 baseLevel → 需要的 maxDT(log10)（其余因子取 R34 末态）");
const others = environment => {
  const o = {};
  o.ep = adjust(Math.pow(Math.max(1, environment.maxEpL), 0.5) * 0.016, 25);
  o.repl = adjust(Math.pow(Math.max(1, environment.maxRepL), 0.4) * 0.025, 25);
  o.eter = adjust(Math.max(1, Math.sqrt(environment.etL + 1) * 0.45), 25);
  return o;
};
const o = others(env);
for (const lv of [4000, 5000, 6000, 6500, 7000, 8000, 9000, 10000]) {
  const base = baseFor(lv);
  const dtNeeded = base / (o.ep * o.repl * o.eter);
  // dtBase = x^1.3*0.025 → x = (dtNeeded/0.025)^(1/1.3)
  const x = Math.pow(dtNeeded / 0.025, 1 / 1.3);
  console.log(String(lv).padStart(6), "→ base", base.toExponential(3).padStart(10),
    "→ maxDT 1e" + x.toExponential(3));
}
