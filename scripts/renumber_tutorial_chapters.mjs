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
//   --apply 落盘前先写 <json>.bak（原样字节），成功后打印备份路径 —— 2.8 万字重写一次成本太高。
//   --self-test 在临时副本上连跑两次 --apply，断言第二次是「无需重编号」且逐字节不变。
//
// 用法
//   node scripts/renumber_tutorial_chapters.mjs                      只检查（预期 no-op）
//   node scripts/renumber_tutorial_chapters.mjs --simulate-insert-after ch08
//                                                                    演示：在第 8 章后插一章草稿，打印映射与引用改写（不写盘）
//   node scripts/renumber_tutorial_chapters.mjs --apply              真正落盘（先备份 .bak）
//   node scripts/renumber_tutorial_chapters.mjs --self-test          幂等自测（只动临时副本）
//   node scripts/renumber_tutorial_chapters.mjs --file <path> …      对指定文件操作（自测用）
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF_PATH = fileURLToPath(import.meta.url);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const SELF_TEST = args.includes("--self-test");
const fileArgAt = args.indexOf("--file");
const FILE_ARG = fileArgAt >= 0 ? args[fileArgAt + 1] : null;
const JSON_PATH = FILE_ARG
  ? path.resolve(process.cwd(), FILE_ARG)
  : path.join(ROOT, "src", "core", "oreki-tutorial-data.json");
const simulateAfter = (() => {
  const i = args.indexOf("--simulate-insert-after");
  return i >= 0 ? args[i + 1] : null;
})();

const md5 = text => crypto.createHash("md5").update(text).digest("hex");

/**
 * 幂等自测：临时副本里插一个假章（id 故意写错 → 触发重编号），然后连跑两次 --apply。
 * 断言：① 第二次打印「无需重编号」；② 两次之后字节完全一致。
 * 不碰真数据 —— 真数据为了测幂等去插章再删会污染正文。
 */
function runSelfTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oreki-renumber-"));
  const copy = path.join(tmpDir, "tutorial.json");
  const original = fs.readFileSync(JSON_PATH, "utf-8");
  const data = JSON.parse(original);
  const at = data.chapters.findIndex(chapter => chapter.id === "ch08");
  if (at < 0) {
    console.error("自测失败：找不到 ch08");
    return 1;
  }
  data.chapters.splice(at + 1, 0, {
    id: "chXX",
    title: "第 8 章　（自测占位）",
    subtitle: "自测",
    stageKey: data.chapters[at].stageKey,
    draft: true,
    stageGoal: "自测占位。",
    entry: "自测占位。",
    steps: [],
    buyOrder: [],
    automation: "",
    challenges: null,
    numbers: [],
    done: "自测占位。",
    next: "见第 9 章。",
    traps: [],
  });
  const seeded = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(copy, seeded, "utf8");

  console.log("── 幂等自测（临时副本，不碰真数据）───────────");
  console.log(`源文件    : ${JSON_PATH}`);
  console.log(`临时副本  : ${copy}`);
  console.log(`副本 chapter 数 : ${data.chapters.length}（插了一个 id=chXX 的假章）`);
  console.log(`副本初始 md5 : ${md5(seeded)}`);
  console.log("");

  const call = () => spawnSync(process.execPath, [SELF_PATH, "--file", copy, "--apply"], {
    encoding: "utf-8",
    cwd: ROOT,
  });

  const first = call();
  const afterFirst = fs.readFileSync(copy, "utf-8");
  const firstOk = first.status === 0;
  console.log(`第一次 --apply 退出码 ${first.status}，md5 ${md5(afterFirst)}`);
  const second = call();
  const afterSecond = fs.readFileSync(copy, "utf-8");
  const secondSaidNoop = /无需重编号/u.test(second.stdout || "");
  console.log(`第二次 --apply 退出码 ${second.status}，md5 ${md5(afterSecond)}，输出含「无需重编号」=${secondSaidNoop}`);

  const checks = [
    ["第一次 --apply 成功", firstOk],
    ["第一次之后 id 全部是 ch00…ch18", (JSON.parse(afterFirst).chapters || [])
      .every((chapter, i) => chapter.id === `ch${String(i).padStart(2, "0")}`)],
    ["第二次 --apply 是 no-op（打印「无需重编号」）", secondSaidNoop],
    ["两次之后逐字节相同", md5(afterFirst) === md5(afterSecond)],
  ];
  console.log("");
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failed += 1;
  }
  console.log("");
  console.log(failed === 0 ? "幂等自测通过。" : `幂等自测失败 ${failed} 项。`);
  if (failed === 0) fs.rmSync(tmpDir, { recursive: true, force: true });
  else console.log(`临时目录保留供排查：${tmpDir}`);
  return failed === 0 ? 0 : 1;
}

if (SELF_TEST) {
  process.exit(runSelfTest());
}


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
  const output = `${JSON.stringify(data, null, 2)}\n`;
  // 先备份原样字节，再写。写失败时原文件不受影响，备份保留。
  const backupPath = `${JSON_PATH}.bak`;
  fs.writeFileSync(backupPath, raw, "utf8");
  try {
    fs.writeFileSync(JSON_PATH, output, "utf8");
  } catch (e) {
    console.error(`\n写入失败：${e && e.message}。原文件未改动。备份保留在 ${backupPath}`);
    process.exit(1);
  }
  console.log(`\n已写入。原文件 md5 ${md5(raw)} → 新文件 md5 ${md5(output)}`);
  console.log(`备份：${backupPath}（原样字节，确认无误后可删）`);
  console.log("记得接着跑：node scripts/gen_tutorial_module.mjs && node scripts/validate_tutorial.mjs --stats");
} else {
  console.log("\n（DRY-RUN：未写盘。确认映射无误后加 --apply。）");
}
