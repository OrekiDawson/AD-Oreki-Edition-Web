#!/usr/bin/env node
/** 校验结构化审查结果，并一次性发布 GitHub Pull Request Review。 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://api.github.com";
const MARKER = "<!-- oreki-audit-review:v2 -->";
const COMMENT_MARKER = "<!-- oreki-codex-deepseek-review:v2 -->";

function jsonFromOutput(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("review output does not contain a JSON object");
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function validDiffLines(files) {
  const result = new Map();
  for (const file of files) {
    const valid = { RIGHT: new Set(), LEFT: new Set() };
    let oldLine = 0;
    let newLine = 0;
    for (const row of String(file.patch || "").split(/\r?\n/u)) {
      const header = row.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
      if (header) {
        oldLine = Number(header[1]);
        newLine = Number(header[2]);
        continue;
      }
      if (row.startsWith("+") && !row.startsWith("+++")) {
        valid.RIGHT.add(newLine++);
      } else if (row.startsWith("-") && !row.startsWith("---")) {
        valid.LEFT.add(oldLine++);
      } else if (row.startsWith(" ")) {
        valid.RIGHT.add(newLine++);
        valid.LEFT.add(oldLine++);
      }
    }
    result.set(file.filename, valid);
  }
  return result;
}

export function findingLocationValid(finding, diffLines) {
  const valid = diffLines.get(finding.path);
  if (!valid) return false;
  const side = finding.side || "RIGHT";
  if (!valid[side]?.has(finding.line)) return false;
  if (finding.start_line) {
    const startSide = finding.start_side || side;
    if (startSide !== side || finding.start_line > finding.line || !valid[side]?.has(finding.start_line)) {
      return false;
    }
  }
  return true;
}

export function findingBody(finding) {
  const lines = [
    `**${String(finding.severity).toUpperCase()} · ${safeText(finding.title)}**`,
    "",
    `原因：${safeText(finding.reason)}`,
    "",
    `触发条件：${safeText(finding.trigger)}`,
    "",
    `最小修复：${safeText(finding.fix)}`,
  ];
  if (finding.suggestion) {
    const fence = finding.suggestion.includes("```") ? "````" : "```";
    lines.push("", `${fence}suggestion`, finding.suggestion.replace(/\n$/u, ""), fence);
  }
  return lines.join("\n");
}

function unmappedBody(findings) {
  if (!findings.length) return "";
  return [
    "### 未映射到当前 Diff 的问题",
    "",
    ...findings.map(finding =>
      safeText(`- **${String(finding.severity).toUpperCase()} · ${finding.title}**：${finding.reason} ` +
        `触发条件：${finding.trigger} 最小修复：${finding.fix}`)),
  ].join("\n");
}

function safeText(value) {
  return String(value || "")
    .replaceAll(MARKER, "")
    .replaceAll(COMMENT_MARKER, "")
    .replaceAll("REVIEW_IDENTITY:", "REVIEW_IDENTITY_ESCAPED:")
    .replaceAll("REVIEW_CONFIG_VERSION:", "REVIEW_CONFIG_VERSION_ESCAPED:")
    .replaceAll("@", "@\u200b");
}

async function api(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oreki-audit-publisher",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function paginate(path, token) {
  const output = [];
  for (let page = 1; ; page += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const items = await api(`${path}${sep}per_page=100&page=${page}`, token);
    output.push(...items);
    if (items.length < 100) return output;
  }
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replaceAll("\n", " ")}\n`);
  }
}

async function fallbackComment({ token, repository, pr, identity, notice, text }) {
  const [owner, repo] = repository.split("/");
  const body = [
    COMMENT_MARKER,
    "### Oreki Audit（行内审查未能发布）",
    "",
    "AI_REVIEW_NOT_EXECUTED",
    "",
    `REVIEW_IDENTITY: ${identity}`,
    "",
    safeText(notice || text),
  ].join("\n");
  const comments = await paginate(`/repos/${owner}/${repo}/issues/${pr}/comments`, token);
  const previous = comments.find(comment =>
    comment.user?.login === "oreki-audit[bot]" && comment.body?.includes(COMMENT_MARKER));
  if (previous) {
    return api(`/repos/${owner}/${repo}/issues/comments/${previous.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  }
  return api(`/repos/${owner}/${repo}/issues/${pr}/comments`, token, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const [owner, repo] = repository.split("/");
  const pr = Number(process.env.PR_NUMBER);
  const headSha = process.env.HEAD_SHA;
  const identity = process.env.REVIEW_IDENTITY;
  const notice = String(process.env.QUOTA_NOTICE || "").trim();
  const resultPath = process.env.REVIEW_RESULT_PATH;
  const reviewToken = process.env.REVIEW_TOKEN || "";
  const commentToken = process.env.COMMENT_TOKEN || "";
  if (!owner || !repo || !pr || !headSha || !identity) throw new Error("missing review metadata");

  let result = null;
  if (resultPath && fs.existsSync(resultPath) && fs.statSync(resultPath).size > 0) {
    result = jsonFromOutput(fs.readFileSync(resultPath, "utf8"));
  }
  const text = result
    ? `状态：${result.status}\n\n${result.summary}`
    : notice || "本次未发起 AI 审查。";

  if (!reviewToken) {
    await fallbackComment({
      token: commentToken,
      repository,
      pr,
      identity,
      notice,
      text,
    });
    output("mode", "comment-fallback");
    return;
  }

  try {
    const current = await api(`/repos/${owner}/${repo}/pulls/${pr}`, reviewToken);
    if (current.head?.sha !== headSha) throw new Error("PR head changed before publish");
    const existing = await paginate(`/repos/${owner}/${repo}/pulls/${pr}/reviews`, reviewToken);
    const identityMarker = `REVIEW_IDENTITY: ${identity}`;
    const duplicate = existing.find(review =>
      review.user?.login === "oreki-audit[bot]" &&
      review.commit_id === headSha && review.body?.includes(MARKER) &&
      review.body?.includes(identityMarker));
    if (duplicate) {
      output("mode", "review-existing");
      output("review_url", duplicate.html_url);
      output("threads", 0);
      return;
    }

    if (!result) {
      await fallbackComment({ token: commentToken, repository, pr, identity, notice, text });
      output("mode", "comment-fallback");
      return;
    }

    const files = await paginate(`/repos/${owner}/${repo}/pulls/${pr}/files`, reviewToken);
    const diffLines = validDiffLines(files);
    const comments = [];
    const unmapped = [...(result.unmapped_findings || [])];
    for (const finding of result.findings || []) {
      if (!findingLocationValid(finding, diffLines)) {
        unmapped.push({
          severity: finding.severity,
          title: finding.title,
          reason: `${finding.path}:${finding.line} 无法绑定到当前 Diff。${finding.reason}`,
          trigger: finding.trigger,
          fix: finding.fix,
        });
        continue;
      }
      const comment = {
        path: finding.path,
        line: finding.line,
        side: finding.side || "RIGHT",
        body: findingBody(finding),
      };
      if (finding.start_line) {
        comment.start_line = finding.start_line;
        comment.start_side = finding.start_side || finding.side || "RIGHT";
      }
      comments.push(comment);
    }
    const body = [
      MARKER,
      "REVIEW_IDENTITY: " + identity,
      `REVIEW_CONFIG_VERSION: ${process.env.REVIEW_CONFIG_VERSION || "unknown"}`,
      "",
      `状态：**${result.status}**`,
      "",
      safeText(result.summary),
      "",
      unmappedBody(unmapped),
      "",
      `> 覆盖 ${result.covered_files?.length || 0} 个文件；未覆盖 ${result.uncovered_files?.length || 0} 个文件。`,
    ].filter(Boolean).join("\n");
    const review = await api(`/repos/${owner}/${repo}/pulls/${pr}/reviews`, reviewToken, {
      method: "POST",
      body: JSON.stringify({ commit_id: headSha, event: "COMMENT", body, comments }),
    });
    output("mode", "review");
    output("review_url", review.html_url);
    output("threads", comments.length);
    output("suggestions", comments.filter(comment => comment.body.includes("```suggestion")).length);
  } catch (error) {
    await fallbackComment({
      token: commentToken,
      repository,
      pr,
      identity,
      notice: `GitHub Review 发布失败：${error.message}`,
      text,
    });
    output("mode", "comment-fallback");
    output("publish_error", error.message);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
