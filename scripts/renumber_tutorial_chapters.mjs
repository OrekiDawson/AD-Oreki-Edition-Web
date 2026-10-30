// 教程章节自动编号（只在「章被增删导致 id 与位置错位」时生效）
//
// 契约
// ────
// 输入  : src/core/oreki-tutorial-data.json 的 chapters 数组。**数组顺序即真值**。
// 触发  : 数组长度/顺序与现有 id（ch00…chNN）不一致时才会改动。纯正文改动下本脚本是 no-op。
// 输出  : ① 重排后的 chapters（id 按位置重写为 ch00…chNN）
//         ② 「旧 id → 新 id」映射表
//         ③ 跨章引用改写清单（每一条都给出位置、改写前、改写后）
//
// 引用面（凡是玩家能看到的字符串都扫）
//   chapter 的 title / subtitle / stageGoal / entry / automation / challenges / done / next / note、
//   steps[].text / buyOrder[] / traps[] / numbers[].label·value·src / table.head·rows[][]
//   appendices[].body（附录正文里也会写「见第 12 章」）
//
// 改写规则
//   「第 N 章」里的 N 视为**旧编号**，按映射换成新编号。
//   单次扫描 + 查表，不做链式替换（否则 1→2 再 2→3 会把第 1 章写成第 3 章）。
//
// 安全
//   默认 --dry-run，不写盘。只有显式 --apply 才写。两者都会打印完整清单。
//
// 用法
//   node scripts/renumber_tutorial_chapters.mjs                      只检查（预期 no-op）
//   node scripts/renumber_tutorial_chapters.mjs --simulate-insert-after ch08
//                                                                    演示：在第 8 章后插一章草稿，打印映射与引用改写（不写盘）
//   node scripts/renumber_tutorial_chapters.mjs --apply              真正落盘
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = path.join(ROOT, "src", "core", "oreki-tutorial-data.json");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const simulateAfter = (() => {
  const i = args.indexOf("--simulate-insert-after");
  return i >= 0 ? args[i + 1] : null;
})();

const pad = n => String(n).padStart(2, "0");
const idOf = index => `ch${pad(index)}`;

const raw = fs.readFileSync(JSON_PATH, "utf-8");
const data = JSON.parse(raw);
const chapters = data.chapters;
const appendices = Array.isArray(data.appendices) ? data.appendices : [];

// ── 1. 老编号：现有 id 去掉前缀后的数字 ────────────────────────────────
const oldIndexOf = new Map();
chapters.forEach((chapter, position) => {
  const match = /^ch(\d+)$/u.exec(chapter.id || "");
  oldIndexOf.set(chapter, match ? Number(match[1]) : position);
});

// ── 2. 目标顺序（演示模式下先插一个草稿占位） ──────────────────────────
let ordered = [...chapters];
if (simulateAfter) {
  const at = ordered.findIndex(chapter => chapter.id === simulateAfter);
  if (at < 0) {
    console.error(`找不到章节 ${simulateAfter}`);
    process.exit(1);
  }
  ordered = [
    ...ordered.slice(0, at + 1),
    {
      id: "__new__",
      title: "第 ? 章　（演示用占位）",
      subtitle: "占位",
      stageKey: ordered[at].stageKey,
      draft: true,
      stageGoal: "占位。",
      entry: "占位。",
      steps: [],
      buyOrder: [],
      automation: "",
      challenges: null,
      numbers: [],
      done: "占位。",
      next: "",
      traps: [],
    },
    ...ordered.slice(at + 1),
  ];
}

// ── 3. 映射：旧编号 → 新编号 ────────────────────────────────────────────
const mapping = ordered.map((chapter, newIndex) => ({
  chapter,
  oldId: chapter.id === "__new__" ? "(新章)" : chapter.id,
  oldIndex: chapter.id === "__new__" ? null : oldIndexOf.get(chapter),
  newIndex,
  newId: idOf(newIndex),
}));

const moved = mapping.filter(row => row.oldIndex !== null && row.oldIndex !== row.newIndex);
const unchanged = mapping.every(row => row.oldIndex === null || row.oldIndex === row.newIndex);

// 旧编号 → 新编号（只收老章；新章没有旧编号）
const oldToNew = new Map();
for (const row of mapping) {
  if (row.oldIndex !== null) oldToNew.set(row.oldIndex, row.newIndex);
}

// ── 4. 引用改写：单次扫描，把「第 N 章」按旧编号查表 ────────────────────
const CHAPTER_REF = /第\s*(\d+)\s*章/gu;
const rewrites = [];

function rewriteString(where, value) {
  if (typeof value !== "string" || value.length === 0) return value;
  const next = value.replace(CHAPTER_REF, (whole, digits) => {
    const oldNumber = Number(digits);
    if (!oldToNew.has(oldNumber)) return whole;
    const newNumber = oldToNew.get(oldNumber);
    if (newNumber === oldNumber) return whole;
    rewrites.push({ where, before: whole, after: `第 ${newNumber} 章` });
    return `第 ${newNumber} 章`;
  });
  return next;
}

function rewriteChapter(chapter, newIndex) {
  const at = `chapters[${newIndex}](${chapter.id})`;
  const scalar = ["title", "subtitle", "stageGoal", "entry", "automation", "challenges", "done", "next", "note"];
  for (const field of scalar) {
    if (typeof chapter[field] === "string") {
      chapter[field] = rewriteString(`${at}.${field}`, chapter[field]);
    }
  }
  for (const field of ["steps", "buyOrder", "traps"]) {
    if (!Array.isArray(chapter[field])) continue;
    chapter[field].forEach((item, i) => {
      if (typeof item === "string") {
        chapter[field][i] = rewriteString(`${at}.${field}[${i}]`, item);
      } else if (item && typeof item.text === "string") {
        item.text = rewriteString(`${at}.${field}[${i}].text`, item.text);
      }
    });
  }
  if (Array.isArray(chapter.numbers)) {
    chapter.numbers.forEach((num, i) => {
      for (const field of ["label", "value"]) {
        if (typeof num[field] === "string") {
          num[field] = rewriteString(`${at}.numbers[${i}].${field}`, num[field]);
        }
      }
    });
  }
  if (chapter.table) {
    (chapter.table.head || []).forEach((cell, i) => {
      chapter.table.head[i] = rewriteString(`${at}.table.head[${i}]`, cell);
    });
    (chapter.table.rows || []).forEach((row, ri) => {
      row.forEach((cell, ci) => {
        row[ci] = rewriteString(`${at}.table.rows[${ri}][${ci}]`, cell);
      });
    });
  }
}

// 先算映射再改文案：改的时候用的还是旧编号（正文里写的也是旧编号）
mapping.forEach(row => rewriteChapter(row.chapter, row.newIndex));
appendices.forEach((apx, i) => {
  if (typeof apx.body === "string") apx.body = rewriteString(`appendices[${i}](${apx.id}).body`, apx.body);
});
// 章节自己的 id 最后写
mapping.forEach(row => {
  row.chapter.id = row.newId;
});

// ── 5. 报告 ────────────────────────────────────────────────────────────
console.log("── 章节编号检查 ─────────────────────────────");
console.log(`文件      : ${path.relative(ROOT, JSON_PATH)}`);
console.log(`章节数    : ${mapping.length}`);
console.log(`模式      : ${APPLY ? "APPLY（写盘）" : "DRY-RUN（不写盘）"}${simulateAfter ? ` · 演示插入于 ${simulateAfter} 之后` : ""}`);
console.log("");

if (unchanged && !simulateAfter) {
  console.log("id 已与位置一致，无需重编号。");
  console.log("（纯正文改动不会让本脚本产生任何变更；只有增删章才会。）");
  process.exit(0);
}

console.log("旧 id → 新 id：");
for (const row of mapping) {
  const mark = row.oldIndex === null ? "＋" : (row.oldIndex === row.newIndex ? "  " : "→ ");
  console.log(`  ${mark}${String(row.oldId).padEnd(22)} → ${row.newId}   ${row.chapter.title}`);
}
console.log("");
console.log(`改号 ${moved.length} 章；新增 ${mapping.filter(r => r.oldIndex === null).length} 章。`);
console.log("");

if (rewrites.length === 0) {
  console.log("跨章引用：无需改写。");
} else {
  console.log(`跨章引用改写 ${rewrites.length} 处：`);
  const grouped = new Map();
  for (const item of rewrites) {
    if (!grouped.has(item.where)) grouped.set(item.where, []);
    grouped.get(item.where).push(item);
  }
  for (const [where, list] of grouped) {
    console.log(`  · ${where}: ${list.map(x => `${x.before} → ${x.after}`).join("；")}`);
  }
}

if (APPLY && simulateAfter) {
  console.error("\n拒绝执行：--apply 与 --simulate-insert-after 不能同时使用（演示不写盘）。");
  process.exit(1);
}

if (APPLY) {
  data.chapters = mapping.map(row => row.chapter);
  fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("\n已写入。记得接着跑：node scripts/gen_tutorial_module.mjs && node scripts/validate_tutorial.mjs --stats");
} else {
  console.log("\n（DRY-RUN：未写盘。确认映射无误后加 --apply。）");
}
