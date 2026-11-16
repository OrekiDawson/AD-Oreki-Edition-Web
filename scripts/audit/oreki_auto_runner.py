#!/usr/bin/env python3
"""Oreki Audit Bot：Serge 自动触发适配器（GitHub Actions，无需评论、无需 Webhook 服务）。

为什么需要它：上游 Serge 的 build_review_request() 只接受 issue_comment /
pull_request_review_comment 且要求评论以 mention 开头（reviewbot/triggers.py:35），
因此在 pull_request_target / schedule 下直接调用官方 Action 会被**跳过**。
本适配器不伪造评论事件，而是直接构造 ReviewRequest 并调用上游真实引擎：
  prepare_review(cfg, gh, req) -> ReviewDraft
  publish_review(cfg, gh, draft)
从而保留上游的 Diff 分析、行内评论、规则文件与模型管线。

安全边界：
- 只读 PR 元数据与 Diff（GitHub API），绝不检出/执行 PR 代码。
- 模型调用前先过 scripts/audit/preflight.py 的高峰/余额/规模/信任守卫。
- 幂等键 = repo + PR + head SHA + 规则版本；已完成则不重复付费。
- 任何无法确认的情况（无 Diff、Diff 截断、输出不可解析、SHA 变化、判决缺失）都发布 failure，
  绝不用 success/neutral/skipped 冒充。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks_adapter as ca  # noqa: E402
import preflight as pf  # noqa: E402

ALLOWED_REPOS_DEFAULT = (
    "orekidawson/ad-oreki-edition-android",
    "orekidawson/ad-oreki-edition-web",
)
AUTO_EVENTS = {"pull_request_target", "workflow_dispatch", "schedule", "issue_comment"}


def repo_allowed(repo: str, allowed: tuple[str, ...] = ALLOWED_REPOS_DEFAULT) -> bool:
    return repo.strip().lower() in {a.lower() for a in allowed}


def validate_event(*, event_name: str, action: str | None, pr: dict | None,
                   repo: str, allowed: tuple[str, ...] = ALLOWED_REPOS_DEFAULT,
                   actor_type: str = "User") -> tuple[bool, list[str]]:
    """事件级信任判定：仓库白名单、事件类型、PR 状态、同仓、非 Bot 自触发。"""
    reasons: list[str] = []
    if not repo_allowed(repo, allowed):
        reasons.append("repo-not-allowed")
    if event_name not in AUTO_EVENTS:
        reasons.append("event-not-supported:" + event_name)
    if actor_type == "Bot":
        reasons.append("bot-self-trigger")
    if event_name == "issue_comment":
        if action != "created":
            reasons.append("action-not-reviewable:" + str(action))
        return (not reasons, reasons)
    if event_name == "pull_request_target":
        if action not in ("opened", "reopened", "synchronize", "ready_for_review"):
            reasons.append("action-not-reviewable:" + str(action))
        if not pr:
            reasons.append("missing-pr-payload")
            return (False, reasons)
        if pr.get("draft"):
            reasons.append("draft-pr")
        if pr.get("state") != "open":
            reasons.append("pr-not-open")
        if (pr.get("base") or {}).get("ref") != "main":
            reasons.append("base-not-main")
        head = ((pr.get("head") or {}).get("repo") or {}).get("full_name") or ""
        if head.strip().lower() != repo.strip().lower():
            reasons.append("fork-pr-not-auto-reviewed")
    return (not reasons, reasons)


# 可自愈的阻断原因：等高峰结束/充值/密钥修复后，新的 Commit 或定时任务会自动重审。
# 这类原因发布 neutral（GitHub 视作不阻断），避免 Required Check 在高峰或临时余额不足时
# 把仓库所有 PR 全部锁死；真正的审查失败（P0/P1、模型错误、尾注缺失、被截断）仍是 failure。
DEFERRED_BLOCK_PREFIXES = ("peak-window", "balance-below-min", "balance-key-missing",
                           "balance-query-failed")


def classify_block(preflight_reasons: list[str]) -> tuple[str, str]:
    """把预检阻断映射为 Check 结论：可自愈 → neutral，其余 → failure。"""
    reasons = list(preflight_reasons or ["unknown"])
    reason_text = "preflight-blocked:" + ",".join(reasons)
    deferred = all(any(r.startswith(p) for p in DEFERRED_BLOCK_PREFIXES) for r in reasons)
    return ("neutral" if deferred else "failure"), reason_text


def decide_outcome(*, preflight_allow: bool, preflight_reasons: list[str], draft: dict | None,
                   current_head_sha: str, reviewed_sha: str | None, truncated: int,
                   verdict: dict | None, publish_error: str | None = None) -> tuple[str, str]:
    """把审查结果映射成 Check 结论。fail-closed：只有确证『完整审查且无 P0/P1』才 success。"""
    if not preflight_allow:
        return classify_block(preflight_reasons)
    if publish_error:
        return "failure", "publish-failed:" + publish_error
    if draft is None:
        return "failure", "no-reviewable-diff"
    if truncated and truncated > 0:
        return "failure", "diff-truncated:chunks=%d" % truncated
    if (reviewed_sha or "").lower() != current_head_sha.lower():
        return "failure", "stale-head-sha"
    if verdict is None:
        return "failure", "verdict-trailer-missing"
    if verdict.get("reviewed_sha") != current_head_sha.lower():
        return "failure", "verdict-sha-mismatch"
    if verdict.get("p0", 0) > 0 or verdict.get("p1", 0) > 0:
        return "failure", "blocking-findings:P0=%d,P1=%d" % (verdict["p0"], verdict["p1"])
    return "success", "clean:P2=%d" % verdict.get("p2", 0)


def _read_event() -> tuple[str, dict]:
    path = os.environ.get("GITHUB_EVENT_PATH", "")
    name = os.environ.get("OREKI_AUDIT_EVENT_NAME") or os.environ.get("GITHUB_EVENT_NAME", "")
    if path and Path(path).is_file():
        try:
            return name, json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception:
            return name, {}
    return name, {}


def _pr_payload(payload: dict) -> dict | None:
    if isinstance(payload.get("pull_request"), dict):
        return payload["pull_request"]
    if isinstance(payload.get("issue"), dict) and payload["issue"].get("pull_request"):
        return payload["issue"]
    return None


def _resolve_pr_number(payload: dict) -> int:
    env = os.environ.get("OREKI_AUDIT_PR", "").strip()
    if env.isdigit():
        return int(env)
    for key in ("pull_request", "issue"):
        obj = payload.get(key) or {}
        if isinstance(obj, dict) and obj.get("number"):
            return int(obj["number"])
    return 0


def _existing_check(api_url: str, repo: str, sha: str, token: str, external_id: str) -> bool:
    url = ca.check_runs_list_url(api_url, repo, sha)
    try:
        data = ca._request(url, token)  # noqa: SLF001 - 同模块内复用
    except Exception:
        return False
    for run in data.get("check_runs", []) or []:
        if run.get("external_id") == external_id and prior_review_skippable(run):
            return True
    return False


def build_trigger_body(head_sha: str) -> str:
    """构造送给审查引擎的 `trigger_comment`（会进入 Prompt）。

    审查规则由引擎自行从仓库 `.ai/review-rules.md` 读取；这里额外把**硬性判决尾注契约**
    写进请求体，避免模型漏写导致 fail-closed 误判 `verdict-trailer-missing`。
    """
    sha = (head_sha or "").strip().lower()
    return (
        "自动审查请求（Oreki Audit Bot）。请按仓库 .ai/review-rules.md 的 P0/P1/P2 定义审查本 PR 的完整 diff。\n"
        "硬性输出契约（缺失或格式不符将自动判 FAILURE，无法合并）：\n"
        "在审查正文的**最后单独一行**给出判决尾注，格式严格为：\n"
        f'<!-- oreki-audit-verdict {{"p0":<数量>,"p1":<数量>,"p2":<数量>,"reviewed_sha":"{sha}"}} -->\n'
        f"其中 reviewed_sha 必须是当前 PR head {sha}；p0/p1/p2 填你实际发现的问题数量（整数，无问题填 0）。\n"
        "不要省略这一行，不要修改键名或改成代码块。"
    )


def ensure_llm_env(llm_key: str) -> str:
    """把仓库里的 `OREKI_AUDIT_LLM_KEY` 映射为上游 Serge 读取的 `LLM_API_KEY`。

    上游 `Config.from_env` 用 `os.environ["LLM_API_KEY"]` 直接取值（缺失即 KeyError），
    因此这里显式桥接；已有 `LLM_API_KEY` 时不覆盖（便于本地自定义）。
    返回最终生效的 key（可能为空字符串）。
    """
    effective = os.environ.get("LLM_API_KEY") or (llm_key or "")
    if effective:
        os.environ["LLM_API_KEY"] = effective
    return effective


def select_backlog_pr(prs: list, is_reviewed, repo: str) -> dict | None:
    """定时/补偿任务：按更新时间倒序挑一个值得复审的开放 PR。

    规则与事件触发保持一致：非 draft、state=open、base=main、同仓（非 fork）、
    且该 head SHA 尚未完成过审查（is_reviewed 回调由调用方用 Check 幂等键判定）。
    找不到返回 None（表示积压为空或全部已审）。
    """
    def _sort_key(pr: dict) -> str:
        return str(pr.get("updated_at") or "")

    for pr in sorted(prs or [], key=_sort_key, reverse=True):
        if pr.get("draft") or pr.get("state") != "open":
            continue
        if (pr.get("base") or {}).get("ref") != "main":
            continue
        head = ((pr.get("head") or {}).get("repo") or {}).get("full_name") or ""
        if head.strip().lower() != repo.strip().lower():
            continue
        try:
            if is_reviewed(pr):
                continue
        except Exception:
            continue
        return pr
    return None


REVIEWED_SUMMARY_PREFIXES = ("clean:", "blocking-findings:", "no-blocking-findings:")


def prior_review_skippable(run: dict) -> bool:
    """只有『真的完成过一次审查』才跳过；被高峰/余额/无 Diff/报错拦下的 completed failure 必须允许重试。"""
    if run.get("status") != "completed":
        return False
    summary = str(((run.get("output") or {}).get("summary")) or "")
    return summary.startswith(REVIEWED_SUMMARY_PREFIXES)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--now")
    ap.add_argument("--classify-only", action="store_true",
                    help="只做事件/守卫判定并输出 JSON，不导入 Serge、不调用模型（用于无密钥测试）")
    ap.add_argument("--report", default=os.environ.get("OREKI_AUDIT_REPORT", ""))
    args = ap.parse_args(argv)

    event_name, payload = _read_event()
    repo = os.environ.get("GITHUB_REPOSITORY", "") or ((payload.get("repository") or {}).get("full_name") or "")
    owner, _, name = repo.partition("/")
    pr = _pr_payload(payload)
    action = payload.get("action")
    actor_type = ((payload.get("sender") or {}).get("type")) or "User"
    allowed = tuple(x.strip() for x in os.environ.get(
        "OREKI_AUDIT_REPOS", ",".join(ALLOWED_REPOS_DEFAULT)).split(",") if x.strip())

    ok, reasons = validate_event(event_name=event_name, action=action, pr=pr, repo=repo,
                                 allowed=allowed, actor_type=actor_type)
    pr_number = _resolve_pr_number(payload)
    head_sha = str(((pr or {}).get("head") or {}).get("sha") or "")
    report: dict = {"event": event_name, "action": action, "repo": repo, "pr": pr_number,
                    "head_sha": head_sha, "event_ok": ok, "event_reasons": reasons}

    if args.classify_only:
        print(json.dumps(report, ensure_ascii=False))
        return 0 if ok else 1

    token = ca.resolve_token()
    api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    # schedule / workflow_dispatch 未指定 PR 时：扫描积压，挑一个未审查的最新 PR 复审。
    if event_name in ("schedule", "workflow_dispatch") and not pr_number and owner and name:
        try:
            open_prs = ca._request(api_url.rstrip("/") + "/repos/" + owner + "/" + name +
                                   "/pulls?state=open&per_page=50&sort=updated&direction=desc",
                                   token)  # noqa: SLF001
        except Exception as exc:
            report["backlog_error"] = type(exc).__name__
            open_prs = []
        picked = select_backlog_pr(
            open_prs if isinstance(open_prs, list) else [],
            lambda p: _existing_check(api_url, repo, str(((p.get("head") or {}).get("sha") or "")),
                                      token, pf.idempotency_key(repo, int(p.get("number") or 0),
                                                               str(((p.get("head") or {}).get("sha") or "")))),
            repo)
        report["backlog_scanned"] = len(open_prs) if isinstance(open_prs, list) else 0
        if picked is None:
            report["skipped"] = "backlog-empty"
            print(json.dumps(report, ensure_ascii=False))
            return 0
        pr = picked
        pr_number = int(picked.get("number") or 0)
        head_sha = str(((picked.get("head") or {}).get("sha") or ""))
        report.update({"pr": pr_number, "head_sha": head_sha, "picked_from_backlog": True})
        ok, reasons = validate_event(event_name="pull_request_target", action="synchronize", pr=pr,
                                     repo=repo, allowed=allowed, actor_type="User")
        report["event_ok"], report["event_reasons"] = ok, reasons
        event_name = "pull_request_target"  # 后续 preflight 按 PR 事件口径处理
    # issue_comment / schedule 的 payload 不含完整 PR 对象：用 API 补齐（仍然只读）
    if owner and name and pr_number and (not head_sha or not pr or "head" not in (pr or {})):
        try:
            pr = ca._request(api_url.rstrip("/") + "/repos/" + owner + "/" + name +
                             "/pulls/" + str(pr_number), token)  # noqa: SLF001
            head_sha = str(((pr or {}).get("head") or {}).get("sha") or "")
            report["head_sha"] = head_sha
            ok, reasons = validate_event(event_name=event_name, action=action, pr=pr, repo=repo,
                                         allowed=allowed, actor_type=actor_type)
            report["event_ok"], report["event_reasons"] = ok, reasons
        except Exception as exc:
            report["pr_fetch_error"] = type(exc).__name__
    llm_key = ensure_llm_env(os.environ.get("OREKI_AUDIT_LLM_KEY") or "")
    if not (owner and name and pr_number and head_sha and token):
        report["fatal"] = "missing-context"
        print(json.dumps(report, ensure_ascii=False))
        # 定时/手动补偿在解析不到目标 PR 时安静跳过（不发 Check、不调模型）；
        # 真实 PR 事件缺上下文则视为配置错误，返回非零。
        return 0 if event_name in ("schedule", "workflow_dispatch") else 1

    external_id = pf.idempotency_key(repo, pr_number, head_sha)
    report["external_id"] = external_id
    if _existing_check(api_url, repo, head_sha, token, external_id):
        report["skipped"] = "already-reviewed"
        print(json.dumps(report, ensure_ascii=False))
        return 0

    diff_chars = 0
    try:
        files = ca._request(api_url.rstrip("/") + "/repos/" + owner + "/" + name +
                            "/pulls/" + str(pr_number) + "/files?per_page=100", token)  # noqa: SLF001
        diff_chars = sum(len(f.get("patch") or "") for f in (files or []))
    except Exception as exc:
        report["diff_error"] = type(exc).__name__

    decision = pf.decide(now=pf._parse_now(args.now), check_balance=True, api_key=llm_key,  # noqa: SLF001
                         repo=repo, pr=pr_number, sha=head_sha, trigger=event_name,
                         head_repo=((pr or {}).get("head") or {}).get("repo", {}).get("full_name", repo),
                         base_repo=repo, base_ref=((pr or {}).get("base") or {}).get("ref", "main"),
                         default_branch="main", author_is_bot=actor_type == "Bot",
                         diff_chars=diff_chars,
                         author_association=(payload.get("comment") or {}).get("author_association")) if ok else {
        "allow": False, "reasons": reasons, "idempotency_key": external_id}
    report["preflight"] = decision

    conclusion, reason = decide_outcome(
        preflight_allow=bool(decision.get("allow")), preflight_reasons=decision.get("reasons") or [],
        draft=None, current_head_sha=head_sha, reviewed_sha=None, truncated=0, verdict=None)
    payload_check = ca.check_payload(head_sha=head_sha, conclusion_value=conclusion,
                                     reason=reason, pr=pr_number, repo=repo, external_id=external_id)

    if decision.get("allow"):
        try:
            from reviewbot.config import Config
            from reviewbot.github_client import GitHubClient
            from reviewbot.reviewer import ReviewRequest, prepare_review, publish_review

            cfg = Config.from_env(require_app=False, require_web=False)
            gh = GitHubClient(token)
            req = ReviewRequest(owner=owner, repo=name, number=pr_number, trigger_comment_id=0,
                                trigger_comment_body=build_trigger_body(head_sha),
                                commenter="oreki-audit")
            draft = prepare_review(cfg, gh, req)
            if draft is not None:
                latest = gh.get_pr(owner, name, pr_number)
                current_sha = str(((latest or {}).get("head") or {}).get("sha") or "")
                if current_sha.lower() != head_sha.lower():
                    conclusion, reason = "failure", "head-changed-during-review"
                else:
                    published = publish_review(cfg, gh, draft)
                    verdict = ca.parse_verdict(getattr(draft, "summary", "") or "")
                    conclusion, reason = decide_outcome(
                        preflight_allow=True, preflight_reasons=[], draft={"summary": draft.summary},
                        current_head_sha=current_sha, reviewed_sha=getattr(published, "head_sha", None),
                        truncated=int(getattr(draft, "truncated_chunks", 0) or 0), verdict=verdict)
                    report["metrics"] = getattr(draft, "metrics_line", "")
            payload_check = ca.check_payload(head_sha=head_sha, conclusion_value=conclusion,
                                             reason=reason, pr=pr_number, repo=repo,
                                             external_id=external_id)
        except Exception as exc:  # 含 _UnparseableLLMOutput / EmptyReviewError / 网络失败
            conclusion, reason = "failure", "review-error:" + type(exc).__name__
            payload_check = ca.check_payload(head_sha=head_sha, conclusion_value=conclusion,
                                             reason=reason, pr=pr_number, repo=repo,
                                             external_id=external_id)

    report.update({"conclusion": conclusion, "reason": reason})
    try:
        ca.publish(api_url=api_url, repo=repo, head_sha=head_sha, token=token, payload=payload_check)
        report["check_published"] = True
    except Exception as exc:
        report["check_published"] = False
        report["check_error"] = type(exc).__name__
    if args.report:
        Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if conclusion == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
