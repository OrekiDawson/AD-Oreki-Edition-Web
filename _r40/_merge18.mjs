// 一次性结构补丁：18 章重排 + 合并 agent-e 的 ch09 / ch17 + 顶层 appendices。
import fs from "node:fs";
import path from "node:path";

const ROOT = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web";
const JSON_PATH = path.join(ROOT, "AD-Oreki-Edition/src/core/oreki-tutorial-data.json");
const E_JSON = path.join(ROOT, "_tools/_r40/R40E-ch09-ch16.json");
const E_APX = path.join(ROOT, "_tools/_r40/R40E-附录草稿.md");

const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const delivered = JSON.parse(fs.readFileSync(E_JSON, "utf8"));
const eCh09 = delivered.find(c => c.id === "ch09");
const eCh17 = delivered.find(c => c.id === "ch16");

const old = data.chapters;
const byId = id => old.find(c => c.id === id);

// ── 1. 取出要保留的章节（ch00~ch14 + 佩勒），丢旧的 ch09/ch16 ─────────
const kept = old.slice(0, 15).filter(c => c.id !== "ch09"); // ch00~ch14（去掉 ch09）
const pelpe = byId("ch15"); // 佩勒与终局
if (!kept.length || !pelpe) throw new Error("章节结构不符合预期");

// ch14 原来含莱特拉，标题与副标题都要收窄
const c14 = kept.find(c => c.id === "ch14");
c14.title = "第 14 章　天神（二）：薇、太阳神";
c14.subtitle = c14.subtitle.replace(/莱特拉/g, "").replace(/、\s*$/, "");
c14.next = "进第 15 章：莱特拉的暗物质维度与符文炼金。";
if (typeof c14.stageGoal === "string") c14.stageGoal = c14.stageGoal.replace(/莱特拉/g, "");

// ── 2. 新增莱特拉章（占位，随后单独写正文）──────────────────────────
const latela = {
  id: "ch15",
  title: "第 15 章　莱特拉（暗物质维度 / 虚幻升级 / 符文炼金 / 连续统 / 奇点）",
  subtitle: "1e9 iM 起：五套机制一屏放不下，单独成章",
  stageKey: "celestials",
  draft: true,
  stageGoal: "待写。",
  entry: "待写。",
  steps: [],
  buyOrder: [],
  automation: "",
  challenges: null,
  numbers: [],
  done: "待写。",
  next: "进第 16 章：佩勒与终局。",
  traps: [],
  table: null,
  note: null,
};

// ── 3. 组装并整段重排 id / 标题序号 ────────────────────────────────
const chapters = [
  ...kept.slice(0, 9),      // ch00~ch08
  eCh09,                    // ch09（agent-e）
  ...kept.slice(9),         // ch10~ch14
  latela,                   // ch15（新）
  pelpe,                    // ch16 佩勒
  eCh17,                    // ch17 隐藏条件与成就总表（agent-e）
];

for (const [i, c] of chapters.entries()) {
  c.id = `ch${String(i).padStart(2, "0")}`;
  const rest = String(c.title).replace(/^第\s*\d+\s*章\s*/u, "");
  c.title = `第 ${i} 章　${rest}`;
}

// stageKey 跟语义走，不跟编号走
const stageById = {
  ch13: "celestials",
  ch14: "celestials",
  ch15: "celestials",
  ch16: "doomed",
  ch17: null,
};
for (const [id, key] of Object.entries(stageById)) {
  const c = chapters.find(x => x.id === id);
  if (c) c.stageKey = key;
}

data.chapters = chapters;

// ── 4. 附录：解析 R40E-附录草稿.md ─────────────────────────────────
const md = fs.readFileSync(E_APX, "utf8").replace(/\r\n/gu, "\n");
const sectionRe = /^## (apx_[a-z0-9_]+)\s*$/gmu;
const marks = [...md.matchAll(sectionRe)].map(m => ({ id: m[1], start: m.index, bodyStart: m.index + m[0].length }));
const sections = marks.map((m, i) => ({
  id: m.id,
  body: md.slice(m.bodyStart, i + 1 < marks.length ? marks[i + 1].start : md.length).trim(),
}));

const TITLES = {
  apx_terms: "附录 A　术语表",
  apx_achievements: "附录 B　隐藏成就速查",
  apx_notation: "附录 C　记数法",
  apx_bilingual: "附录 D　中英界面对照",
  apx_blockers: "附录 E　卡住时的症状对照",
  apx_automation: "附录 F　自动化总览",
};

const appendices = sections.map(s => {
  let body = s.body;
  if (s.id === "apx_terms") {
    // 删掉第四节「禁用写法」：游戏内附录只列正确译名，禁用清单属于 docs/TUTORIAL_GLOSSARY.md
    const cut = body.search(/^###\s*四、禁用写法/mu);
    if (cut >= 0) body = body.slice(0, cut).trim();
  }
  return { id: s.id, title: TITLES[s.id], body };
});

appendices.push({ id: "apx_automation", title: TITLES.apx_automation, auto: "automation" });

data.appendices = appendices;
data.updatedAt = "2026-10-30";

fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`章节 ${data.chapters.length}：${data.chapters.map(c => c.id).join(",")}`);
console.log(`附录 ${appendices.length}：${appendices.map(a => a.id + (a.auto ? "（auto）" : `（${a.body.length} 字符）`)).join("、")}`);
