#!/usr/bin/env python3
"""Oreki Audit Bot：独立 GitHub Check 适配层（Serge 不自带 Checks 集成）。

职责：
1. 解析本轮审查结论里**机器可读**的判决尾注：
   <!-- oreki-audit-verdict {"p0":0,"p1":0,"p2":2,"reviewed_sha":"<40hex>"} -->
2. 映射为检查结论：P0/P1>0 或判决缺失/审查未执行 → failure；否则 success。
3. 以 GitHub App installation token 创建/更新 Check Run：
   name="Oreki Audit / review"，head_sha=PR 最新 SHA，external_id=幂等键。

fail-closed：任何无法确认的情况都不返回 success，也不用 neutral/skipped 冒充。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request

CHECK_NAME = "Oreki Audit / review"
VERDICT_RE = re.compile(r"<!--\s*oreki-audit-verdict\s*(\{.*?\})\s*-->", re.S)
TAG_RE = re.compile(r"\[(P0|P1)\]")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

EXIT_SUCCESS = "success"
EXIT_FAILURE = "failure"


def parse_verdict(body: str) -> dict | None:
    """解析判决尾注；缺失或结构不合法返回 None（调用方按 failure 处理）。"""
    if not body:
        return None
    m = VERDICT_RE.search(body)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    try:
        p0 = int(data.get("p0", -1))
        p1 = int(data.get("p1", -1))
    except (TypeError, ValueError):
        return None
    if p0 < 0 or p1 < 0:
        return None
    sha = str(data.get("reviewed_sha", "")).strip().lower()
    return {"p0": p0, "p1": p1, "p2": int(data.get("p2", 0) or 0), "reviewed_sha": sha}


def tagged_severities(body: str) -> tuple[int, int]:
    """无判决尾注时的兜底：只认 [P0]/[P1] 显式标记，不做语义猜测。"""
    found = TAG_RE.findall(body or "")
    return found.count("P0"), found.count("P1")


def conclusion(*, verdict: dict | None, review_posted: bool, executed: bool,
               head_sha: str, body: str = "") -> tuple[str, str]:
    """返回 (conclusion, reason)。禁止在未执行/未确认时返回 success。"""
    if not executed:
        return EXIT_FAILURE, "review-not-executed"
    if not review_posted:
        return EXIT_FAILURE, "review-not-posted"
    if not SHA_RE.match((head_sha or "").lower()):
        return EXIT_FAILURE, "invalid-head-sha"
    if verdict is None:
        p0, p1 = tagged_severities(body)
        if p0 or p1:
            return EXIT_FAILURE, "blocking-findings-untagged:P0=%d,P1=%d" % (p0, p1)
        return EXIT_FAILURE, "verdict-trailer-missing"
    if verdict["reviewed_sha"] != head_sha.lower():
        return EXIT_FAILURE, "verdict-sha-mismatch"
    if verdict["p0"] > 0 or verdict["p1"] > 0:
        return EXIT_FAILURE, "blocking-findings:P0=%d,P1=%d" % (verdict["p0"], verdict["p1"])
    return EXIT_SUCCESS, "no-blocking-findings:P2=%d" % verdict["p2"]


def check_payload(*, head_sha: str, conclusion_value: str, reason: str, pr: int,
                  repo: str, external_id: str, title: str | None = None) -> dict:
    return {
        "name": CHECK_NAME,
        "head_sha": head_sha,
        "status": "completed",
        "conclusion": conclusion_value,
        "external_id": external_id,
        "output": {
            "title": title or ("Oreki Audit: " + ("blocked" if conclusion_value == EXIT_FAILURE else "passed")),
            "summary": reason,
            "text": "%s\nrepo=%s pr=%s sha=%s" % (reason, repo, pr, head_sha),
        },
    }


def _request(url: str, token: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body) if body.strip() else {}


def resolve_token(env: dict | None = None) -> str:
    """App/工作流 token：兼容 GITHUB_TOKEN 与 GH_TOKEN（GitHub Actions 两种命名都常见）。"""
    e = env if env is not None else __import__("os").environ
    return (e.get("GITHUB_TOKEN") or e.get("GH_TOKEN") or "").strip()


def check_runs_list_url(api_url: str, repo: str, sha: str) -> str:
    """按 commit 列出 check runs；仓库级 /check-runs 不是受支持的列表端点。"""
    owner, _, name = repo.partition("/")
    return (api_url.rstrip("/") + "/repos/" + owner + "/" + name + "/commits/" + sha +
            "/check-runs?check_name=" + CHECK_NAME.replace(" ", "+") + "&filter=all&per_page=50")


def publish(*, api_url: str, repo: str, head_sha: str, token: str, payload: dict) -> dict:
    """幂等发布：同一 external_id 已存在则 PATCH，否则 POST。"""
    owner, _, name = repo.partition("/")
    base = api_url.rstrip("/") + "/repos/" + owner + "/" + name + "/check-runs"
    existing = _request(check_runs_list_url(api_url, repo, head_sha), token)
    for run in existing.get("check_runs", []) or []:
        if run.get("external_id") == payload.get("external_id") and run.get("head_sha") == head_sha:
            return _request(api_url.rstrip("/") + "/repos/" + owner + "/" + name +
                            "/check-runs/" + str(run["id"]), token, "PATCH", {
                                "conclusion": payload["conclusion"],
                                "status": "completed",
                                "output": payload["output"],
                            })
    return _request(base, token, "POST", payload)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("classify", "publish"), required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--head-sha", required=True)
    ap.add_argument("--external-id", required=True)
    ap.add_argument("--review-file")
    ap.add_argument("--review-posted", default="false")
    ap.add_argument("--executed", default="true")
    ap.add_argument("--api-url", default="https://api.github.com")
    args = ap.parse_args(argv)

    body = ""
    if args.review_file:
        try:
            body = open(args.review_file, encoding="utf-8").read()
        except OSError:
            body = ""
    verdict = parse_verdict(body)
    concl, reason = conclusion(verdict=verdict, review_posted=args.review_posted.strip().lower() == "true",
                               executed=args.executed.strip().lower() == "true",
                               head_sha=args.head_sha, body=body)
    payload = check_payload(head_sha=args.head_sha, conclusion_value=concl, reason=reason,
                            pr=args.pr, repo=args.repo, external_id=args.external_id)
    if args.mode == "classify":
        print(json.dumps({"conclusion": concl, "reason": reason, "payload": payload,
                          "verdict": verdict}, ensure_ascii=False))
        return 0 if concl == EXIT_SUCCESS else 1
    token = resolve_token()
    if not token:
        print(json.dumps({"conclusion": EXIT_FAILURE, "reason": "missing-app-token"}, ensure_ascii=False))
        return 1
    try:
        result = publish(api_url=args.api_url, repo=args.repo, head_sha=args.head_sha,
                         token=token, payload=payload)
    except urllib.error.HTTPError as exc:
        print(json.dumps({"published": False, "status": exc.code, "reason": reason}, ensure_ascii=False))
        return 1
    print(json.dumps({"published": True, "check_id": result.get("id"),
                      "conclusion": concl, "reason": reason}, ensure_ascii=False))
    return 0 if concl == EXIT_SUCCESS else 1


if __name__ == "__main__":
    sys.exit(main())
