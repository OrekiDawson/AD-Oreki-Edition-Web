#!/usr/bin/env python3
"""Oreki Audit Bot：模型调用前的服务端硬性守卫（高峰 / 余额 / 规模 / 信任 / 幂等）。

设计要点：
- 只做判定，不修改游戏源码、不写仓库文件、不打印任何密钥。
- 任何一项无法确认都 fail-closed（宁可不出审查，也不冒充 PASS）。
- 供 .github/workflows/oreki-audit.yml 在调用 LLM 之前执行；
  exit 0 = 允许继续；exit 1 = 阻断（工作流必须发布非 SUCCESS 的检查）。

用法：
  python3 scripts/audit/preflight.py --repo owner/name --pr 123 --sha <head_sha> \
      --trigger pull_request_target --head-repo owner/name --base-repo owner/name \
      --base-ref main --default-branch main --author-is-bot false \
      --diff-chars 12345 [--now 2026-11-16T13:30:00+08:00] [--check-balance]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

BEIJING = timezone(timedelta(hours=8))
# 工作日高峰（北京时间）：09:00-12:00、14:00-18:00
PEAK_WINDOWS = ((9, 12), (14, 18))
MIN_BALANCE_CNY = Decimal("10.00")
MAX_DIFF_CHARS = 200_000
RULES_VERSION = "android-2026-11-16"
BALANCE_URL = "https://api.deepseek.com/user/balance"


def pricing_window(now: datetime) -> tuple[str, str]:
    """用项目唯一事实源 `scripts/deepseek_pricing.py` 判定峰谷。

    该模块已实现：北京时间（Asia/Shanghai）、工作日 09:00-12:00 / 14:00-18:00（右开区间）、
    周末（含调休上班日仍算低谷）、2026/2027 中国法定节假日、以及未知年份的保守默认。
    这里不复制粘贴日期表，避免两处事实漂移。

    失败时（模块缺失/导入错误/非法输入）回退到内置保守窗口，并用 `fallback:` 前缀标注来源，
    使调用方可追踪——绝不因异常而放行付费调用。
    """
    try:
        import sys as _sys
        from pathlib import Path as _Path
        scripts_dir = _Path(__file__).resolve().parents[2] / "scripts"
        if str(scripts_dir) not in _sys.path:
            _sys.path.insert(0, str(scripts_dir))
        from deepseek_pricing import pricing_window as _pw  # type: ignore
        return _pw(now)
    except Exception as exc:  # 模块不可用 → 保守回退（与官方窗口一致）
        bj = now.astimezone(BEIJING)
        in_window = any(start <= bj.hour < end for start, end in PEAK_WINDOWS)
        peak = bj.weekday() < 5 and in_window
        return ("peak" if peak else "offpeak"), "fallback:" + type(exc).__name__


def is_peak(now: datetime) -> bool:
    """是否处于 DeepSeek 高峰计费窗口（由 `pricing_window` 计算，含节假日/调休）。"""
    return pricing_window(now)[0] == "peak"


def balance_cny(api_key: str, url: str = BALANCE_URL, timeout: int = 20) -> Decimal | None:
    """读取同一付费账号的 CNY 余额；缺失或不可解析返回 None（调用方按失败处理）。"""
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + api_key})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    for info in data.get("balance_infos", []) or []:
        if info.get("currency") == "CNY":
            try:
                return Decimal(str(info.get("total_balance")))
            except (InvalidOperation, TypeError):
                return None
    return None


def balance_allows(balance: Decimal | None) -> bool:
    return balance is not None and balance >= MIN_BALANCE_CNY


def idempotency_key(repo: str, pr: int, sha: str, rules_version: str = RULES_VERSION) -> str:
    """同一仓库/PR/完整 head SHA/规则版本 → 稳定键；新 SHA 必然产生新键。"""
    raw = "|".join([repo.strip().lower(), str(int(pr)), sha.strip().lower(), rules_version.strip()])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def diff_within_cap(chars: int, cap: int = MAX_DIFF_CHARS) -> bool:
    return 0 <= chars <= cap


TRUSTED_ASSOCIATIONS = ("MEMBER", "OWNER", "COLLABORATOR")
AUTO_TRIGGERS = ("pull_request_target", "schedule", "workflow_dispatch")


def trust_gate(*, trigger: str, head_repo: str, base_repo: str, author_is_bot: bool,
               base_ref: str, default_branch: str, pr_open: bool = True,
               author_association: str | None = None) -> tuple[bool, list[str]]:
    """受信任事件判定。

    - pull_request_target：同仓（非 fork）、默认分支、非 Bot 自触发；
    - issue_comment：由仓库成员/所有者/协作者显式触发的手动复审（文档里的 @oreki-audit review）；
    - schedule / workflow_dispatch：只做积压恢复，仍需其它门禁（余额/高峰）通过。
    任何其它事件一律拒绝。
    """
    reasons: list[str] = []
    if trigger not in AUTO_TRIGGERS + ("issue_comment",):
        reasons.append("untrusted-trigger:" + trigger)
    if trigger == "issue_comment":
        if (author_association or "").upper() not in TRUSTED_ASSOCIATIONS:
            reasons.append("untrusted-comment-author:" + str(author_association))
    else:
        if head_repo.strip().lower() != base_repo.strip().lower():
            reasons.append("fork-pr-requires-manual-trigger")
        if base_ref != default_branch:
            reasons.append("base-not-default")
    if not pr_open:
        reasons.append("pr-not-open")
    if author_is_bot:
        reasons.append("self-authored-comment")
    return (not reasons), reasons


def decide(*, now: datetime, check_balance: bool, api_key: str | None, repo: str, pr: int, sha: str,
           trigger: str, head_repo: str, base_repo: str, base_ref: str, default_branch: str,
           author_is_bot: bool, diff_chars: int, rules_version: str = RULES_VERSION,
           pr_open: bool = True, author_association: str | None = None) -> dict:
    key = idempotency_key(repo, pr, sha, rules_version)
    reasons: list[str] = []
    window, window_reason = pricing_window(now)
    if window == "peak":
        reasons.append("peak-window")
    if not diff_within_cap(diff_chars):
        reasons.append("diff-too-large:%d>%d" % (diff_chars, MAX_DIFF_CHARS))
    ok_trust, trust_reasons = trust_gate(trigger=trigger, head_repo=head_repo, base_repo=base_repo,
                                         author_is_bot=author_is_bot, base_ref=base_ref,
                                         default_branch=default_branch, pr_open=pr_open,
                                         author_association=author_association)
    if not ok_trust:
        reasons.extend(trust_reasons)
    balance = None
    if check_balance:
        if not api_key:
            reasons.append("balance-key-missing")
        else:
            try:
                balance = balance_cny(api_key)
            except Exception as exc:  # 网络/认证失败均 fail-closed
                reasons.append("balance-query-failed:" + type(exc).__name__)
            else:
                if not balance_allows(balance):
                    reasons.append("balance-below-min:%s" % (balance,))
    result = {
        "allow": not reasons,
        "reasons": reasons,
        "idempotency_key": key,
        "rules_version": rules_version,
        "head_sha": sha,
        "pr": int(pr),
        "repo": repo,
        "peak": window == "peak",
        "pricing_window": window,
        "pricing_reason": window_reason,
        "pricing_source": "fallback" if window_reason.startswith("fallback:") else "deepseek_pricing",
        "diff_chars": diff_chars,
        "balance_cny": str(balance) if balance is not None else None,
        "checked_balance": bool(check_balance),
    }
    return result


def _parse_now(text: str | None) -> datetime:
    if not text:
        return datetime.now(tz=BEIJING)
    return datetime.fromisoformat(text)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Oreki Audit preflight guards")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--sha", required=True)
    ap.add_argument("--trigger", required=True)
    ap.add_argument("--head-repo", required=True)
    ap.add_argument("--base-repo", required=True)
    ap.add_argument("--base-ref", required=True)
    ap.add_argument("--default-branch", default="main")
    ap.add_argument("--author-is-bot", default="false")
    ap.add_argument("--pr-open", default="true")
    ap.add_argument("--diff-chars", type=int, required=True)
    ap.add_argument("--rules-version", default=RULES_VERSION)
    ap.add_argument("--now")
    ap.add_argument("--check-balance", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args(argv)

    api_key = os.environ.get("OREKI_AUDIT_LLM_KEY") or None
    result = decide(
        now=_parse_now(args.now),
        check_balance=args.check_balance,
        api_key=api_key,
        repo=args.repo,
        pr=args.pr,
        sha=args.sha,
        trigger=args.trigger,
        head_repo=args.head_repo,
        base_repo=args.base_repo,
        base_ref=args.base_ref,
        default_branch=args.default_branch,
        author_is_bot=args.author_is_bot.strip().lower() == "true",
        diff_chars=args.diff_chars,
        rules_version=args.rules_version,
        pr_open=args.pr_open.strip().lower() == "true",
    )
    text = json.dumps(result, ensure_ascii=False)
    print(text)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return 0 if result["allow"] else 1


if __name__ == "__main__":
    sys.exit(main())
