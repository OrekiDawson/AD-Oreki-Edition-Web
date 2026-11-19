#!/usr/bin/env node
/** 合并矩阵审查批次；只把实际成功返回的文件计入覆盖。 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function findingKey(finding) {
  return [
    finding.path || "",
    finding.line || "",
    finding.side || "RIGHT",
    String(finding.title || "").trim().toLowerCase(),
  ].join("|");
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter(finding => {
    const key = findingKey(finding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeBatchResults(plan, batchFiles) {
  const findings = [];
  const unmapped = [];
  const plannedUnits = new Map();
  const coveredUnits = new Set();
  const batches = [];
  let succeeded = 0;
  let partial = false;
  let modelStarted = false;
  let modelCalls = 0;
  let unknownBatchState = false;

  for (const batch of plan.batches || []) {
    for (const file of batch.files || []) {
      const units = plannedUnits.get(file.path) || new Set();
      for (const hunk of file.includedHunks || []) units.add(hunk);
      plannedUnits.set(file.path, units);
    }
  }

  for (const batch of plan.batches) {
    const result = readJson(path.join(batchFiles, `batch-${batch.id}.json`));
    const storedMeta = readJson(path.join(batchFiles, `meta-${batch.id}.json`));
    if (!storedMeta) unknownBatchState = true;
    const meta = storedMeta || {
      status: "not_executed",
      reason: "result artifact missing",
    };
    if (meta.modelStarted === true) {
      modelStarted = true;
      modelCalls += 1;
    }
    const batchFilesByName = new Map((batch.files || []).map(file => [file.path, file]));
    if (!result) {
      partial = true;
      batches.push({
        id: batch.id,
        status: meta.status,
        reason: meta.reason || "",
        model_started: meta.modelStarted === true,
        covered_hunks: [],
        uncovered_hunks: [...batchFilesByName.values()].flatMap(file =>
          (file.includedHunks || []).map(hunk => `${file.path}#${hunk}`)),
      });
      continue;
    }
    succeeded += 1;
    findings.push(...(result.findings || []));
    unmapped.push(...(result.unmapped_findings || []));
    const resultCovered = new Set(
      (result.covered_files || []).filter(file => batchFilesByName.has(file)),
    );
    const coveredHunks = [];
    const uncoveredHunks = [];
    for (const file of batchFilesByName.values()) {
      const units = resultCovered.has(file.path) ? coveredHunks : uncoveredHunks;
      for (const hunk of file.includedHunks || []) units.push(`${file.path}#${hunk}`);
      if (resultCovered.has(file.path)) {
        for (const hunk of file.includedHunks || []) coveredUnits.add(`${file.path}#${hunk}`);
      }
    }
    if (result.status !== "complete") partial = true;
    batches.push({
      id: batch.id,
      status: result.status,
      reason: meta.reason || "",
      model_started: meta.modelStarted === true,
      files: batch.files.map(file => file.path),
      covered_hunks: coveredHunks,
      uncovered_hunks: uncoveredHunks,
      oversized: batch.oversized || [],
    });
  }

  if ((plan.batches || []).some(batch => (batch.oversized || []).length > 0)) {
    partial = true;
  }

  const coverage = [...plannedUnits.entries()]
    .map(([file, units]) => {
      const total = [...units].sort((a, b) => a - b);
      const covered = total.filter(hunk => coveredUnits.has(`${file}#${hunk}`));
      return {
        path: file,
        total_hunks: total.length,
        covered_hunks: covered,
        uncovered_hunks: total.filter(hunk => !covered.includes(hunk)),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const covered = coverage
    .filter(file => file.total_hunks > 0 && file.uncovered_hunks.length === 0)
    .map(file => file.path);
  const uncovered = coverage
    .filter(file => file.uncovered_hunks.length > 0)
    .map(file => file.path);
  const uncertainFiles = plan.classification?.uncertainFiles || [];
  if (plan.classification?.manualRequired === true) partial = true;
  const incompleteReasons = [...new Set(batches
    .filter(batch => batch.status !== "success" && batch.status !== "reused")
    .map(batch => batch.reason)
    .filter(Boolean))];

  let status = "complete";
  if (succeeded === 0) {
    status = modelStarted || unknownBatchState ? "failed" : "not_executed";
  }
  else if (partial || succeeded < plan.batchCount || uncovered.length > 0) status = "partial";

  const coveredHunkCount = coveredUnits.size;
  const totalHunkCount = coverage.reduce((sum, file) => sum + file.total_hunks, 0);
  const oversizedFiles = [...new Set((plan.batches || [])
    .flatMap(batch => batch.oversized || []))];

  return {
    status,
    summary: [
      `批次 ${succeeded}/${plan.batchCount} 返回结果，实际模型调用 ${modelCalls} 次；`,
      `覆盖 ${coveredHunkCount}/${totalHunkCount} 个计划 hunk。`,
      (plan.excludedFiles || []).length
        ? `另有 ${(plan.excludedFiles || []).length} 个文档/二进制文件按规则排除；`
        : "",
      uncertainFiles.length
        ? `共享玩法分类待人工确认：${uncertainFiles.join(", ")}；`
        : "",
      incompleteReasons.length
        ? `未完成批次原因：${incompleteReasons.join(", ")}。`
        : "",
      oversizedFiles.length
        ? `超出单批预算但按完整 hunk 保留：${oversizedFiles.join(", ")}。`
        : "",
      status === "complete"
        ? "计划审查范围已完整覆盖。"
        : "存在未覆盖或失败的批次，详见批次状态。",
    ].join(""),
    findings: uniqueFindings(findings),
    unmapped_findings: uniqueFindings(unmapped),
    covered_files: covered,
    uncovered_files: uncovered,
    excluded_files: [...new Set(plan.excludedFiles || [])].sort(),
    empty_files: [...new Set(plan.emptyFiles || [])].sort(),
    manual_required: plan.classification?.manualRequired === true,
    uncertain_files: uncertainFiles,
    coverage,
    batches,
    model_calls: modelCalls,
    peer_sha: plan.peerSha || "",
    head_sha: plan.head,
    token_usage: "unknown",
  };
}

const argument = (name, fallback = "") => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plan = readJson(argument("plan"));
  if (!plan) throw new Error("batch plan is missing or invalid");
  const merged = mergeBatchResults(plan, argument("results-dir"));
  fs.writeFileSync(argument("out"), `${JSON.stringify(merged, null, 2)}\n`);
}
