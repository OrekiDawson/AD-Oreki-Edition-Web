#!/usr/bin/env node
/**
 * Kody GitHub App 明确返回 skipped 时退还共享 Kody 配额。
 * 只处理 GitHub 的受信任 check_run 完成事件，不读取或执行 PR 代码。
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  SHARED_QUOTA_REPOSITORIES,
  markKodySkippedQuota,
} from "../codex/audit-quota.mjs";

export function confirmedKodySkip(event) {
  const check = event?.check_run;
  return event?.action === "completed" &&
    check?.status === "completed" &&
    check?.conclusion === "skipped" &&
    check?.name === "Kody Code Review" &&
    check?.app?.slug === "kody-ai" &&
    SHARED_QUOTA_REPOSITORIES.includes(String(event?.repository?.full_name ?? "")) &&
    /^[a-f0-9]{40}$/iu.test(String(check?.head_sha ?? "")) &&
    Number.isSafeInteger(Number(check?.id)) && Number(check?.id) > 0;
}

export function kodySkipPullRequests(event) {
  if (!confirmedKodySkip(event)) return [];
  const check = event.check_run;
  const repository = event.repository.full_name;
  const unique = new Set();
  const output = [];
  for (const pr of check.pull_requests ?? []) {
    const number = Number(pr?.number);
    if (!Number.isSafeInteger(number) || number < 1 || unique.has(number)) continue;
    unique.add(number);
    output.push({
      repository,
      pr: number,
      headSha: check.head_sha,
      checkRunId: check.id,
      checkUrl: check.html_url ?? "",
    });
  }
  return output;
}

export async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const matches = kodySkipPullRequests(event);
  if (!matches.length) {
    console.log("Kody skip: 无可信的 Kody skipped Check 与 PR 关联，保持原有计数等待人工核对。");
    return;
  }
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required");
  for (const match of matches) {
    const result = await markKodySkippedQuota(token, match);
    console.log(
      `Kody skip: ${match.repository}#${match.pr}@${match.headSha} ` +
      `CheckRun=${match.checkRunId} => ${result.reason}; ` +
      `counts=${result.counts?.used ?? "unchanged"}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Kody skip quota reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
