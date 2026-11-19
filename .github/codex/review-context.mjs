#!/usr/bin/env node
/**
 * 确定性地分类 PR 文件，并从对端 main 提取少量相关源码。
 *
 * 该脚本只读取文件名和 GitHub Contents API 文本，不执行 PR 代码，不调用模型。
 * 两端仓库保留同一实现，确保分类规则、预算和输出格式一致。
 */

import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPOS = Object.freeze({
  android: "AD-Oreki-Edition-Android",
  web: "AD-Oreki-Edition-Web",
});

const ANDROID_ROOT = "app/src/main/kotlin/kajfosz/antimatterdimensions/oreki/";

const RULES = Object.freeze({
  android: [
    {
      id: "scheduler",
      paths: [
        `${ANDROID_ROOT}OrekiAutomationScheduler.kt`,
        `${ANDROID_ROOT}OrekiStageAuto.kt`,
        `${ANDROID_ROOT}OrekiAutobuyerBeat.kt`,
        `${ANDROID_ROOT}OrekiManagedAutobuyerAuthority.kt`,
        `${ANDROID_ROOT}OrekiPlayerIntent.kt`,
        `${ANDROID_ROOT}OrekiAutomationUiListener.kt`,
      ],
    },
    {
      id: "stage-gates",
      match: /Oreki(?:AutoEternity|Crunch|Ec|Eternity|Reality|GuiStage|GamePace)|GameApi\.kt$/i,
    },
    {
      id: "economy",
      match: /Oreki(?:EpGainScale|IpGainScale|ImCapScale|BootstrapScale|DilationCostScale|EcRequirementScale|EternityEconomy|RealityUpgrades|RealityPacing)\.kt$/i,
    },
    {
      id: "saves",
      match: /(?:GameApi|Save|Storage|Migration|PlayerIntent)\.kt$/i,
    },
    {
      id: "endgame",
      match: /Oreki(?:Pelle|Endgame|Celestial)\w*\.kt$/i,
    },
  ],
  web: [
    {
      id: "scheduler",
      match: /^src\/core\/oreki-(?:smart-executor|smart-strategy|managed-autobuyer-state|managed-crunch-interval)\.js$/i,
    },
    {
      id: "stage-gates",
      match: /^(?:src\/game\.js|src\/core\/(?:oreki-(?:eternity|early|break|crunch|reality|instant|iu15)|autobuyers\/|eternity(?:-challenge)?\.js$|big-crunch\.js$|reality\.js$))/i,
    },
    {
      id: "economy",
      match: /^src\/core\/(?:speed-config|dimboost|tickspeed|sacrifice|reality-upgrades)\.js$|^src\/core\/oreki-.*(?:scale|pacing|economy).*\.js$/i,
    },
    {
      id: "saves",
      match: /^src\/core\/storage\//i,
    },
    {
      id: "endgame",
      match: /^src\/core\/(?:oreki-(?:endgame|celestial)|celestials\/(?:laitela|pelle)\/)/i,
    },
  ],
});

const PEER_FILES = Object.freeze({
  android: {
    scheduler: [
      "src/core/oreki-smart-executor.js",
      "src/core/oreki-managed-autobuyer-state.js",
      "src/core/oreki-managed-crunch-interval.js",
      "src/core/constants.js",
      "scripts/check_managed_autobuyer_state.mjs",
    ],
    "stage-gates": [
      "src/game.js",
      "src/core/oreki-eternity-automation.js",
      "src/core/oreki-early-automation.js",
      "src/core/oreki-reality-automation.js",
      "scripts/test-stage-beat-cap.mjs",
    ],
    economy: [
      "src/core/speed-config.js",
      "src/core/oreki-crunch-policy.js",
      "src/core/reality-upgrades.js",
    ],
    saves: [
      "src/core/storage/storage.js",
      "src/core/storage/migrations.js",
    ],
    endgame: [
      "src/core/oreki-endgame-automation.js",
      "src/core/celestials/pelle/game-end.js",
      "src/core/celestials/laitela/laitela.js",
    ],
  },
  web: {
    scheduler: [
      `${ANDROID_ROOT}OrekiAutomationScheduler.kt`,
      `${ANDROID_ROOT}OrekiStageAuto.kt`,
      `${ANDROID_ROOT}OrekiManagedAutobuyerAuthority.kt`,
      `${ANDROID_ROOT}OrekiPlayerIntent.kt`,
    ],
    "stage-gates": [
      `${ANDROID_ROOT}GameApi.kt`,
      `${ANDROID_ROOT}OrekiAutoEternityGate.kt`,
      `${ANDROID_ROOT}OrekiEcAutomation.kt`,
      `${ANDROID_ROOT}OrekiEternityRules.kt`,
    ],
    economy: [
      `${ANDROID_ROOT}OrekiGamePace.kt`,
      `${ANDROID_ROOT}OrekiCrunchPolicy.kt`,
      `${ANDROID_ROOT}OrekiRealityPacing.kt`,
      `${ANDROID_ROOT}OrekiIpGainScale.kt`,
    ],
    saves: [
      `${ANDROID_ROOT}GameApi.kt`,
      `${ANDROID_ROOT}OrekiPlayerIntent.kt`,
    ],
    endgame: [
      `${ANDROID_ROOT}OrekiPelle.kt`,
      `${ANDROID_ROOT}OrekiEndgameAutomation.kt`,
    ],
  },
});

const SECTION_TERMS = [
  "interval", "autobuyer", "managed", "unlock", "gate", "reality", "eternity",
  "pelle", "save", "storage", "migration", "userClosed", "crunch", "mode",
  "reconcile", "apply", "MANAGED", "INTERVAL", "hostingTick", "gameEnd",
];

function linesFromFile(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
}

export function classify(source, paths) {
  if (!(source in RULES)) throw new Error(`unknown source repo: ${source}`);
  const normalized = [...new Set(paths.map(path => path.replaceAll("\\", "/")))].sort();
  const categories = RULES[source]
    .filter(rule => normalized.some(path =>
      rule.paths ? rule.paths.includes(path) : rule.match.test(path)))
    .map(rule => rule.id);
  const matched = new Set(categories);
  const uncertain = normalized.filter(path => {
    if (source === "android") {
      return path.startsWith(ANDROID_ROOT) &&
        !RULES.android.some(rule => rule.paths?.includes(path) || rule.match?.test(path));
    }
    return path.startsWith("src/core/") &&
      !/(tutorial|translation|i18n|locale)/i.test(path) &&
      !RULES.web.some(rule => rule.paths?.includes(path) || rule.match?.test(path));
  });
  const peerRepo = REPOS[source === "android" ? "web" : "android"];
  const peerFiles = [...new Set(categories.flatMap(id => PEER_FILES[source][id] || []))];
  return {
    schema: 1,
    source,
    sourceFiles: normalized,
    categories,
    crossRepo: categories.length > 0,
    peerRepo,
    peerFiles,
    manualRequired: uncertain.length > 0,
    uncertainFiles: uncertain,
    matchedRuleIds: [...matched],
  };
}

export function extractRelevant(text, {
  maxBytes = 5000,
  contextLines = 5,
} = {}) {
  const lines = text.split(/\r?\n/u);
  const ranges = [];
  for (let index = 0; index < lines.length; index += 1) {
    const lower = lines[index].toLowerCase();
    if (!SECTION_TERMS.some(term => lower.includes(term.toLowerCase()))) continue;
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length, index + contextLines + 1);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else ranges.push([start, end]);
  }
  if (ranges.length === 0) ranges.push([0, Math.min(lines.length, 40)]);
  const chunks = [];
  let bytes = 0;
  for (const [start, end] of ranges) {
    const chunk = `--- lines ${start + 1}-${end} ---\n${lines.slice(start, end).join("\n")}\n`;
    if (bytes + Buffer.byteLength(chunk) > maxBytes) break;
    chunks.push(chunk);
    bytes += Buffer.byteLength(chunk);
  }
  return { text: chunks.join(""), bytes, truncated: ranges.some(([start, end]) =>
    !chunks.some(chunk => chunk.startsWith(`--- lines ${start + 1}-${end} ---`))) };
}

export async function buildPeerContext({ classification, token, owner, peerSha }) {
  const header = [
    `CROSS_REPO=${classification.crossRepo}`,
    `SOURCE_REPO=${classification.source}`,
    `PEER_REPO=${classification.peerRepo}`,
    `PEER_SHA=${peerSha || "unknown"}`,
    `CATEGORIES=${classification.categories.join(",")}`,
    `MANUAL_REQUIRED=${classification.manualRequired}`,
    `UNCERTAIN_FILES=${classification.uncertainFiles.join(",")}`,
    "",
  ];
  if (!classification.crossRepo) {
    header.push("该 PR 未命中共享玩法路径；未读取对端仓库。");
    return { text: header.join("\n"), filesRead: [], truncated: false };
  }

  const body = [];
  const filesRead = [];
  let truncated = false;
  let totalBytes = Buffer.byteLength(header.join("\n"));
  // 质量优先：保留必要常量与行为测试，单批最多 24 KiB；超限明确标记，不静默截断。
  const maxTotal = 24000;
  for (const path of classification.peerFiles.slice(0, 12)) {
    if (totalBytes >= maxTotal) {
      truncated = true;
      break;
    }
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${classification.peerRepo}/contents/` +
      `${path.split("/").map(encodeURIComponent).join("/")}?ref=${peerSha}`,
      {
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "oreki-audit-review-context",
        },
      },
    );
    if (!response.ok) {
      body.push(`## ${path}\n读取失败：HTTP ${response.status}`);
      truncated = true;
      continue;
    }
    const source = await response.text();
    const excerpt = extractRelevant(source, {
      maxBytes: Math.min(5000, Math.max(800, maxTotal - totalBytes)),
    });
    const section = `## ${path}\n${excerpt.text}\n`;
    body.push(section);
    filesRead.push(path);
    totalBytes += Buffer.byteLength(section);
    if (excerpt.truncated) truncated = true;
  }
  header.push(`PEER_FILES_READ=${filesRead.join(",")}`);
  header.push(`PEER_CONTEXT_TRUNCATED=${truncated}`);
  return {
    text: `${header.join("\n")}\n${body.join("\n")}`,
    filesRead,
    truncated,
  };
}

const PATCH_EXCLUDES = [
  /^reports\//,
  /^docs\//,
  /\.(?:png|jpe?g|webp|zip|apk|jar|lock)$/i,
  /^pnpm-lock\.yaml$/,
];

export function patchPriority(source, path) {
  const keyPaths = source === "android"
    ? [
        `${ANDROID_ROOT}OrekiAutomationScheduler.kt`,
        `${ANDROID_ROOT}OrekiManagedAutobuyerAuthority.kt`,
        `${ANDROID_ROOT}OrekiPlayerIntent.kt`,
        `${ANDROID_ROOT}OrekiStageAuto.kt`,
      ]
    : [
        "src/core/oreki-smart-executor.js",
        "src/core/oreki-managed-autobuyer-state.js",
        "src/core/oreki-managed-crunch-interval.js",
        "src/game.js",
      ];
  if (keyPaths.includes(path)) return 0;
  if (source === "android") {
    if (path.startsWith(ANDROID_ROOT)) return 5;
    if (path.startsWith("scripts/payload/smali/")) return 10;
    if (path.includes("/src/test/") || path.startsWith("scripts/tests/")) return 20;
    if (path.startsWith(".github/")) return 30;
    if (path.startsWith("scripts/")) return 25;
    return 40;
  }
  if (path.startsWith("src/core/")) return 5;
  if (path.startsWith("src/")) return 10;
  if (path.startsWith("scripts/tests/") || path.includes("/test/")) return 20;
  if (path.startsWith("scripts/")) return 25;
  if (path.startsWith(".github/")) return 30;
  return 40;
}

export function splitPatchHunks(patch) {
  const lines = patch.split(/(?<=\n)/u);
  const firstHunk = lines.findIndex(line => line.startsWith("@@"));
  if (firstHunk < 0) return { header: patch, hunks: [] };
  const header = lines.slice(0, firstHunk).join("");
  const hunks = [];
  for (let index = firstHunk; index < lines.length;) {
    let end = index + 1;
    while (end < lines.length && !lines[end].startsWith("@@")) end += 1;
    hunks.push(lines.slice(index, end).join(""));
    index = end;
  }
  return { header, hunks };
}

export function planPatchBatches(
  source,
  entries,
  maxBytes = 48000,
  sourceFiles = entries.map(entry => entry.path),
) {
  const entryPaths = new Set(entries.map(entry => entry.path));
  const unreviewableFiles = [];
  const ordered = entries
    .filter(entry => !PATCH_EXCLUDES.some(pattern => pattern.test(entry.path)))
    .map(entry => ({ ...entry, priority: patchPriority(source, entry.path) }))
    .sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path));
  const builders = [];
  let current = { bytes: 0, pieces: [], files: new Map(), oversized: [] };

  const closeBatch = () => {
    if (!current.pieces.length) return;
    builders.push({
      ...current,
      text: current.pieces.join(""),
      files: [...current.files.values()],
    });
    current = { bytes: 0, pieces: [], files: new Map(), oversized: [] };
  };

  for (const entry of ordered) {
    const { header, hunks } = splitPatchHunks(entry.patch);
    if (hunks.length === 0) {
      unreviewableFiles.push(entry.path);
      continue;
    }
    const pieces = hunks.map(hunk => `${header}${hunk}`);
    const categories = classify(source, [entry.path]).categories;
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      const size = Buffer.byteLength(piece);
      if (current.bytes > 0 && current.bytes + size > maxBytes) closeBatch();
      if (size > maxBytes && current.pieces.length === 0) current.oversized.push(entry.path);
      current.pieces.push(piece);
      current.bytes += size;
      const previous = current.files.get(entry.path) || {
        path: entry.path,
        categories,
        totalHunks: hunks.length,
        includedHunks: [],
      };
      previous.includedHunks.push(hunks.length ? index + 1 : 0);
      current.files.set(entry.path, previous);
    }
  }
  closeBatch();

  return {
    batches: builders.map((batch, index) => {
      const id = `b${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        bytes: batch.bytes,
        oversized: [...new Set(batch.oversized)],
        categories: [...new Set(batch.files.flatMap(file => file.categories))],
        files: batch.files,
        text: batch.text,
      };
    }),
    rawBytes: ordered.reduce((sum, entry) => sum + Buffer.byteLength(entry.patch), 0),
    excludedFiles: entries
      .filter(entry => PATCH_EXCLUDES.some(pattern => pattern.test(entry.path)))
      .map(entry => entry.path),
    emptyFiles: sourceFiles.filter(path =>
      !entryPaths.has(path) || unreviewableFiles.includes(path)),
    unreviewableFiles,
    sourceFiles,
  };
}

function readPatchEntries(files, base, head) {
  return files
    .map(path => ({
      path,
      patch: execFileSync("git", [
        "diff", "--function-context", "--no-ext-diff", "--diff-filter=ACDMR",
        `${base}...${head}`, "--", path,
      ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }),
    }))
    .filter(entry => entry.patch.length > 0);
}

function peerContextForCategory(classification, category, token, owner, peerSha) {
  return buildPeerContext({
    classification: {
      ...classification,
      categories: [category],
      peerFiles: PEER_FILES[classification.source][category] || [],
      crossRepo: true,
    },
    token,
    owner,
    peerSha,
  });
}

async function buildBatchPlan({
  source,
  files,
  base,
  head,
  maxBytes = 48000,
  classification,
  owner,
  peerSha,
  peerToken,
}) {
  const entries = readPatchEntries(files, base, head);
  const rawPlan = planPatchBatches(source, entries, maxBytes, files);
  const includedCategories = [...new Set(rawPlan.batches.flatMap(batch => batch.categories))];
  const peerTextByCategory = new Map();
  if (classification.crossRepo) {
    for (const category of includedCategories) {
      try {
        const peer = await peerContextForCategory(
          classification, category, peerToken, owner, peerSha,
        );
        peerTextByCategory.set(category, peer.text);
      } catch (error) {
        peerTextByCategory.set(
          category,
          `PEER_CONTEXT_UNAVAILABLE=true\nCATEGORY=${category}\nERROR=${String(error.message || error)}`,
        );
      }
    }
  }
  return {
    ...rawPlan,
    classification,
    peerSha,
    maxBytes,
    batches: rawPlan.batches.map(batch => {
      const peerContexts = batch.categories.map(category => `peer-${category}.md`);
      const context = `${batch.text}\n${batch.categories
        .map(category => peerTextByCategory.get(category) || "").join("\n")}`;
      return {
        id: batch.id,
        bytes: batch.bytes,
        oversized: batch.oversized,
        categories: batch.categories,
        files: batch.files,
        peerContexts,
        contextSha: crypto.createHash("sha256").update(context).digest("hex"),
      };
    }),
    peerTextByCategory: Object.fromEntries(peerTextByCategory),
    batchTextById: Object.fromEntries(rawPlan.batches.map(batch => [batch.id, batch.text])),
  };
}

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const mode = argument("mode");
  const out = argument("out");
  if (!out) throw new Error("--out is required");
  if (mode === "classify") {
    const source = argument("source");
    const files = linesFromFile(argument("files"));
    const result = classify(source, files);
    fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (mode === "peer") {
    const classification = JSON.parse(fs.readFileSync(argument("classification"), "utf8"));
    const owner = argument("owner");
    const peerSha = argument("peer-sha");
    const token = process.env.GITHUB_TOKEN;
    if (!owner || !peerSha || !token) throw new Error("owner, peer-sha and GITHUB_TOKEN are required");
    const result = await buildPeerContext({ classification, token, owner, peerSha });
    fs.writeFileSync(out, `${result.text}\n`);
    return;
  }
  if (mode === "patch") {
    const source = argument("source");
    const files = linesFromFile(argument("files"));
    const result = planPatchBatches(
      source,
      readPatchEntries(files, argument("base"), argument("head")),
      Number(argument("max-bytes", "48000")),
    );
    fs.writeFileSync(out, result.batches.map(batch => batch.text).join(""));
    fs.writeFileSync(argument("manifest-out"), `${JSON.stringify({
      ...result,
      batches: result.batches.map(({ text, ...batch }) => batch),
    }, null, 2)}\n`);
    return;
  }
  if (mode === "plan") {
    const source = argument("source");
    const files = linesFromFile(argument("files"));
    const classification = JSON.parse(
      fs.readFileSync(argument("classification"), "utf8"),
    );
    const outDir = argument("out-dir");
    const plan = await buildBatchPlan({
      source,
      files,
      base: argument("base"),
      head: argument("head"),
      maxBytes: Number(argument("max-bytes", "48000")),
      classification,
      owner: argument("owner"),
      peerSha: argument("peer-sha"),
      peerToken: process.env.GITHUB_TOKEN,
    });
    fs.mkdirSync(outDir, { recursive: true });
    for (const [category, text] of Object.entries(plan.peerTextByCategory)) {
      fs.writeFileSync(`${outDir}/peer-${category}.md`, `${text}\n`);
    }
    for (const batch of plan.batches) {
      fs.writeFileSync(`${outDir}/batch-${batch.id}.patch`, plan.batchTextById[batch.id]);
      const manifest = [
        `BATCH_ID=${batch.id}`,
        `BASE_SHA=${argument("base")}`,
        `HEAD_SHA=${argument("head")}`,
        `CATEGORIES=${batch.categories.join(",")}`,
        `BATCH_BYTES=${batch.bytes}`,
        `OVERSIZED_FILES=${batch.oversized.join(",")}`,
        `PEER_SHA=${plan.peerSha}`,
        `MANUAL_REQUIRED=${plan.classification.manualRequired === true}`,
        `UNCERTAIN_FILES=${(plan.classification.uncertainFiles || []).join(",")}`,
        "HUNK_POLICY=complete-hunks-only",
        "--- covered files ---",
        ...batch.files.map(file =>
          `${file.path} totalHunks=${file.totalHunks} included=${file.includedHunks.join(",")}`),
      ].join("\n");
      fs.writeFileSync(`${outDir}/manifest-${batch.id}.txt`, `${manifest}\n`);
    }
    const persisted = {
      schema: 1,
      source,
      base: argument("base"),
      head: argument("head"),
      maxBytes: plan.maxBytes,
      peerSha: plan.peerSha,
      classification,
      sourceFiles: plan.sourceFiles,
      rawBytes: plan.rawBytes,
      excludedFiles: plan.excludedFiles,
      emptyFiles: plan.emptyFiles,
      unreviewableFiles: plan.unreviewableFiles,
      batchCount: plan.batches.length,
      batches: plan.batches,
    };
    fs.writeFileSync(argument("plan-out"), `${JSON.stringify(persisted, null, 2)}\n`);
    return;
  }
  throw new Error(`unknown mode: ${mode}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
