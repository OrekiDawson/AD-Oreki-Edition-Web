// ch15 自查修正（第二轮核查发现 5 处）
import fs from "node:fs";
const PATH = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(PATH, "utf8"));
const c = data.chapters.find(x => x.id === "ch15");
const set = (obj, key, value) => {
  if (obj[key] === undefined) throw new Error("字段不存在: " + key);
  obj[key] = value;
};

// ── 正文：三处措辞与数值 ────────────────────────────────────────────────
set(c.steps[0], "text",
  "虚幻机器（IM）不是新按钮：现实机器涨到硬上限 1e1000 之后，IM 开始按指数曲线逼近当前上限，上限随 RM 的对数增长（本作还乘了 100 倍系数）。IU 页签里的升级全部花 IM。");

set(c.steps[3], "text",
  "难度层级是这条线的主轴：每次完成现实时真实用时 < 30 秒，层级 +1。可用普通维度层数 = 8 − 层级，降到 0 就是「完全不稳定」，所有普通维度被禁。源码只做这一个减法，没有额外上限判断。");

set(c.steps[4], "text",
  "暗物质维度一共 4 层，分别由 IU15 / IU16 / IU17 / IU18 解锁。每层三种升级：间隔（10 暗物质起、价格 ×5、间隔 ×0.92，最低压到 10 秒）、暗物质强度（10 暗物质起、价格 ×10）、暗能量强度（10 暗能量起、价格按层 ×1.65 / ×1.6 / ×1.55 / ×1.5）。四层的起始价不是同一条等比：分别是 10、10×1200²、10×1200⁵、10×1200¹³。");

set(c.steps[5], "text",
  "飞升的判据是「间隔已经压到 10 秒下限」：这时点飞升，飞升次数 +1，暗物质强度与暗能量强度各 +500，然后程序把买得起的间隔升级一次性重买，直到重新压回 10 秒或暗物质不够。所以飞升是这条线的循环单位。");

// ── 数值表：五条改写 ────────────────────────────────────────────────────
const byLabel = label => {
  const found = c.numbers.find(n => n.label === label);
  if (!found) throw new Error("找不到 numbers: " + label);
  return found;
};

set(byLabel("莱特拉的解锁条件"), "src",
  "src/core/celestials/laitela/laitela.js:36-38");

set(byLabel("熵的增长公式"), "src",
  "src/core/celestials/laitela/laitela.js:81-83 + src/core/celestials/laitela/laitela.js:30");

set(byLabel("难度层级与可用维度"), "value",
  "完成时真实用时 < 30 秒则层级 +1；可用普通维度层数 = 8 − 层级，到 0 即「完全不稳定」；源码无额外上限判断");
set(byLabel("难度层级与可用维度"), "src",
  "src/game.js:1134-1136 + src/core/celestials/laitela/laitela.js:53-55");

set(byLabel("暗物质维度的升级价格"), "value",
  "间隔 10 DM 起、价格 ×5、间隔 ×0.92、最低压到 10 秒；暗物质强度 10 DM 起、价格 ×10；暗能量强度 10 DE 起、价格按层 ×1.65/×1.6/×1.55/×1.5；四层起始价分别是 10 / 10×1200² / 10×1200⁵ / 10×1200¹³");
set(byLabel("暗物质维度的升级价格"), "src",
  "src/core/celestials/laitela/dark-matter-dimension.js:6-19 + src/core/celestials/laitela/dark-matter-dimension.js:109-112");

set(byLabel("飞升的收益与判据"), "value",
  "间隔压到 10 秒下限才能飞升；每次 +500 暗物质强度、+500 暗能量强度；飞升后把买得起的间隔升级一次性重买");
set(byLabel("飞升的收益与判据"), "src",
  "src/core/celestials/laitela/dark-matter-dimension.js:13-16, :215-221, :163");

set(byLabel("炼金资源数量"), "value",
  "21 种；前 5 种与五类基础符文同名（力量 / 无限 / 时间 / 复制 / 膨胀），第 6 种是「基数」，鹿颈长对应第 11 种");
set(byLabel("炼金资源数量"), "src",
  "src/core/secret-formula/celestials/alchemy.js:8-439");

// ── 坑：一条措辞 ────────────────────────────────────────────────────────
c.traps[3] = "飞升不会重置暗物质维度本身，只重置间隔升级并立刻重买。所以间隔还没压到 10 秒下限时点飞升是没有意义的。";

// ── 表格：一行修正 ──────────────────────────────────────────────────────
for (const row of c.table.rows) {
  if (row[0] === "暗物质维度") {
    row[2] = "4 层；四层起始价 10 / 10×1200² / 10×1200⁵ / 10×1200¹³";
  }
}

fs.writeFileSync(PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("ch15 自查修正已写入");
