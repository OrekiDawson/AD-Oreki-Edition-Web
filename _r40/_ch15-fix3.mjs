// ch15 自查修正（第三轮：炼金的解锁门槛写错了）
import fs from "node:fs";
const PATH = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(PATH, "utf8"));
const c = data.chapters.find(x => x.id === "ch15");

// ── 正文：炼金不是 IU15 解锁的 ──────────────────────────────────────────
c.steps[6].text = "连续统由 IU15 顺带解锁：它让游戏时间按固定速率推进，不再被产量波动卡住。符文炼金不在这条线上——它要太阳神的「鹿颈长宠物 2 级」才开，开了之后精炼符文才能换炼金资源，能换的种类随鹿颈长等级增加。两者都不是通关必需。";

// ── 数值表：改一条、加一条 ──────────────────────────────────────────────
const alchemyRow = c.numbers.find(n => n.label === "炼金资源数量");
alchemyRow.value = "21 种；前 5 种与五类基础符文同名（力量 / 无限 / 时间 / 复制 / 膨胀），第 6 种是「基数」，鹿颈长对应第 11 种；能解锁多少种由鹿颈长等级决定";
alchemyRow.src = "src/core/secret-formula/celestials/alchemy.js:8-439";

const unlockRow = {
  label: "符文炼金的解锁门槛",
  value: "太阳神的鹿颈长宠物到 2 级（不是 IU15，也不随莱特拉解锁）",
  src: "src/core/secret-formula/celestials/ra.js:112-117 + src/components/tabs/glyphs/sidebar/GlyphFilterPanel.js:78",
};
const idx = c.numbers.indexOf(alchemyRow);
c.numbers.splice(idx, 0, unlockRow);

// ── 表格：改一行 ────────────────────────────────────────────────────────
for (const row of c.table.rows) {
  if (row[0] === "符文炼金") {
    row[1] = "太阳神·鹿颈长宠物 2 级";
    row[3] = "把符文词条转成资源与反应（非通关必需）";
  }
}

// ── 坑：补一条 ──────────────────────────────────────────────────────────
c.traps.push("符文炼金不在莱特拉这条线上：它要太阳神的鹿颈长宠物 2 级。也就是说跳过第 14 章就没有炼金，而炼金也不是通关必需——终局链只用到暗物质维度与奇点。");

fs.writeFileSync(PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("ch15 第三轮修正已写入；numbers 现有", c.numbers.length, "条");
