import os
"""Oreki Audit Bot 静态/单元测试（不联网、不调用模型、不接触任何密钥）。"""
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "audit"))

import checks_adapter  # noqa: E402
import preflight  # noqa: E402

SHA = "a" * 40
BJ = timezone(timedelta(hours=8))


class PeakWindow(unittest.TestCase):
    def test_weekday_peak(self):
        self.assertTrue(preflight.is_peak(datetime(2026, 11, 16, 9, 0, tzinfo=BJ)))
        self.assertTrue(preflight.is_peak(datetime(2026, 11, 16, 17, 59, tzinfo=BJ)))
        self.assertTrue(preflight.is_peak(datetime(2026, 11, 16, 2, 30, tzinfo=timezone.utc)))  # 10:30 CST

    def test_weekday_offpeak(self):
        self.assertFalse(preflight.is_peak(datetime(2026, 11, 16, 12, 0, tzinfo=BJ)))
        self.assertFalse(preflight.is_peak(datetime(2026, 11, 16, 13, 59, tzinfo=BJ)))
        self.assertFalse(preflight.is_peak(datetime(2026, 11, 16, 18, 0, tzinfo=BJ)))

    def test_weekend_offpeak(self):
        self.assertFalse(preflight.is_peak(datetime(2026, 11, 21, 10, 0, tzinfo=BJ)))


class Balance(unittest.TestCase):
    def test_threshold(self):
        self.assertFalse(preflight.balance_allows(None))
        self.assertFalse(preflight.balance_allows(Decimal("9.99")))
        self.assertTrue(preflight.balance_allows(Decimal("10.00")))
        self.assertTrue(preflight.balance_allows(Decimal("97.78")))


class Idempotency(unittest.TestCase):
    def test_stable_and_sha_scoped(self):
        a = preflight.idempotency_key("O/R", 7, SHA)
        self.assertEqual(a, preflight.idempotency_key("o/r", 7, SHA))
        self.assertNotEqual(a, preflight.idempotency_key("o/r", 7, "b" * 40))
        self.assertNotEqual(a, preflight.idempotency_key("o/r", 8, SHA))
        self.assertNotEqual(a, preflight.idempotency_key("o/r", 7, SHA, "other-rules"))


class Trust(unittest.TestCase):
    def test_same_repo_default_branch_ok(self):
        ok, reasons = preflight.trust_gate(trigger="pull_request_target", head_repo="o/r",
                                           base_repo="o/r", author_is_bot=False,
                                           base_ref="main", default_branch="main")
        self.assertTrue(ok, reasons)

    def test_rejections(self):
        cases = [
            dict(trigger="pull_request", head_repo="o/r", base_repo="o/r", author_is_bot=False,
                 base_ref="main", default_branch="main"),
            dict(trigger="pull_request_target", head_repo="fork/r", base_repo="o/r", author_is_bot=False,
                 base_ref="main", default_branch="main"),
            dict(trigger="pull_request_target", head_repo="o/r", base_repo="o/r", author_is_bot=True,
                 base_ref="main", default_branch="main"),
            dict(trigger="pull_request_target", head_repo="o/r", base_repo="o/r", author_is_bot=False,
                 base_ref="dev", default_branch="main"),
        ]
        for case in cases:
            ok, reasons = preflight.trust_gate(**case)
            self.assertFalse(ok, case)
            self.assertTrue(reasons)


class DiffCap(unittest.TestCase):
    def test_cap(self):
        self.assertTrue(preflight.diff_within_cap(0))
        self.assertTrue(preflight.diff_within_cap(preflight.MAX_DIFF_CHARS))
        self.assertFalse(preflight.diff_within_cap(preflight.MAX_DIFF_CHARS + 1))


class Verdict(unittest.TestCase):
    def _body(self, sha=SHA, p0=0, p1=0, p2=1):
        return ("review text\n<!-- oreki-audit-verdict " +
                json.dumps({"p0": p0, "p1": p1, "p2": p2, "reviewed_sha": sha}) + " -->\n")

    def test_parse(self):
        v = checks_adapter.parse_verdict(self._body())
        self.assertEqual((v["p0"], v["p1"], v["p2"]), (0, 0, 1))
        self.assertIsNone(checks_adapter.parse_verdict("no trailer"))
        self.assertIsNone(checks_adapter.parse_verdict("<!-- oreki-audit-verdict {bad} -->"))

    def test_conclusions(self):
        c = checks_adapter.conclusion
        self.assertEqual(c(verdict=checks_adapter.parse_verdict(self._body()), review_posted=True,
                           executed=True, head_sha=SHA)[0], "success")
        self.assertEqual(c(verdict=checks_adapter.parse_verdict(self._body(p1=1)), review_posted=True,
                           executed=True, head_sha=SHA)[0], "failure")
        self.assertEqual(c(verdict=checks_adapter.parse_verdict(self._body()), review_posted=False,
                           executed=True, head_sha=SHA)[0], "failure")
        self.assertEqual(c(verdict=checks_adapter.parse_verdict(self._body()), review_posted=True,
                           executed=False, head_sha=SHA)[0], "failure")

    def test_stale_sha_fails_closed(self):
        stale = checks_adapter.parse_verdict(self._body(sha="b" * 40))
        concl, reason = checks_adapter.conclusion(verdict=stale, review_posted=True,
                                                  executed=True, head_sha=SHA)
        self.assertEqual(concl, "failure")
        self.assertIn("sha-mismatch", reason)

    def test_missing_trailer_fails_closed(self):
        concl, reason = checks_adapter.conclusion(verdict=None, review_posted=True,
                                                  executed=True, head_sha=SHA, body="[P1] bug")
        self.assertEqual(concl, "failure")
        self.assertIn("untagged", reason)

    def test_payload_shape(self):
        p = checks_adapter.check_payload(head_sha=SHA, conclusion_value="failure", reason="x",
                                         pr=3, repo="o/r", external_id="k")
        self.assertEqual(p["name"], "Oreki Audit / review")
        self.assertEqual(p["head_sha"], SHA)
        self.assertEqual(p["external_id"], "k")
        self.assertEqual(p["status"], "completed")


if __name__ == "__main__":
    unittest.main()


class AutoTriggerEvent(unittest.TestCase):
    def setUp(self):
        import oreki_auto_runner as runner  # noqa: E402
        self.runner = runner
        self.pr = {
            "draft": False, "state": "open",
            "base": {"ref": "main"},
            "head": {"sha": "a" * 40, "repo": {"full_name": "OrekiDawson/AD-Oreki-Edition-Android"}},
        }

    def test_opened_triggers(self):
        ok, reasons = self.runner.validate_event(
            event_name="pull_request_target", action="opened", pr=self.pr,
            repo="OrekiDawson/AD-Oreki-Edition-Android")
        self.assertTrue(ok, reasons)

    def test_synchronize_and_ready_trigger(self):
        for action in ("synchronize", "ready_for_review", "reopened"):
            ok, reasons = self.runner.validate_event(
                event_name="pull_request_target", action=action, pr=self.pr,
                repo="OrekiDawson/AD-Oreki-Edition-Android")
            self.assertTrue(ok, (action, reasons))

    def test_draft_skipped(self):
        pr = dict(self.pr, draft=True)
        ok, reasons = self.runner.validate_event(
            event_name="pull_request_target", action="opened", pr=pr,
            repo="OrekiDawson/AD-Oreki-Edition-Android")
        self.assertFalse(ok)
        self.assertIn("draft-pr", reasons)

    def test_forbidden_cases(self):
        cases = [
            dict(event_name="pull_request", action="opened", pr=self.pr,
                 repo="OrekiDawson/AD-Oreki-Edition-Android", actor_type="User"),
            dict(event_name="pull_request_target", action="opened", pr=self.pr,
                 repo="someone/other", actor_type="User"),
            dict(event_name="pull_request_target", action="opened", pr=self.pr,
                 repo="OrekiDawson/AD-Oreki-Edition-Android", actor_type="Bot"),
            dict(event_name="pull_request_target", action="closed", pr=self.pr,
                 repo="OrekiDawson/AD-Oreki-Edition-Android", actor_type="User"),
        ]
        for case in cases:
            ok, reasons = self.runner.validate_event(**case)
            self.assertFalse(ok, case)
            self.assertTrue(reasons)

    def test_fork_and_base(self):
        fork = dict(self.pr, head={"sha": "a" * 40, "repo": {"full_name": "evil/fork"}})
        ok, reasons = self.runner.validate_event(
            event_name="pull_request_target", action="opened", pr=fork,
            repo="OrekiDawson/AD-Oreki-Edition-Android")
        self.assertFalse(ok)
        self.assertIn("fork-pr-not-auto-reviewed", reasons)
        devbase = dict(self.pr, base={"ref": "dev"})
        ok, reasons = self.runner.validate_event(
            event_name="pull_request_target", action="opened", pr=devbase,
            repo="OrekiDawson/AD-Oreki-Edition-Android")
        self.assertFalse(ok)
        self.assertIn("base-not-main", reasons)


class AutoTriggerOutcome(unittest.TestCase):
    def setUp(self):
        import oreki_auto_runner as runner  # noqa: E402
        self.runner = runner
        self.sha = "c" * 40

    def _decide(self, **kw):
        base = dict(preflight_allow=True, preflight_reasons=[], draft={"summary": "x"},
                    current_head_sha=self.sha, reviewed_sha=self.sha, truncated=0, verdict=None)
        base.update(kw)
        return self.runner.decide_outcome(**base)

    def test_preflight_block_policy(self):
        # 可自愈阻断（高峰/余额）→ neutral，避免 Required Check 在高峰锁死仓库；
        # 不可自愈阻断（不可信触发、Diff 超限）→ failure。
        self.assertEqual(self._decide(preflight_allow=False, preflight_reasons=["peak-window"])[0], "neutral")
        self.assertEqual(
            self._decide(preflight_allow=False, preflight_reasons=["untrusted-trigger:issue_comment"])[0],
            "failure")

    def test_no_diff_and_truncated_are_failure(self):
        self.assertEqual(self._decide(draft=None)[0], "failure")
        concl, reason = self._decide(truncated=3)
        self.assertEqual(concl, "failure")
        self.assertIn("truncated", reason)

    def test_stale_sha_is_failure(self):
        concl, reason = self._decide(reviewed_sha="d" * 40)
        self.assertEqual(concl, "failure")
        self.assertIn("stale", reason)

    def test_missing_verdict_is_failure(self):
        self.assertEqual(self._decide(verdict=None)[0], "failure")

    def test_blocking_vs_clean(self):
        bad = checks_adapter.parse_verdict(
            '<!-- oreki-audit-verdict {"p0":1,"p1":0,"p2":0,"reviewed_sha":"' + self.sha + '"} -->')
        good = checks_adapter.parse_verdict(
            '<!-- oreki-audit-verdict {"p0":0,"p1":0,"p2":2,"reviewed_sha":"' + self.sha + '"} -->')
        self.assertEqual(self._decide(verdict=bad)[0], "failure")
        self.assertEqual(self._decide(verdict=good)[0], "success")



class CommentTriggerAndRetry(unittest.TestCase):
    """Codex P1 回归：评论触发、Check 端点、token 变量、被阻断后的重试。"""

    def test_issue_comment_member_allowed(self):
        ok, reasons = preflight.trust_gate(
            trigger="issue_comment", head_repo="o/r", base_repo="o/r", author_is_bot=False,
            base_ref="main", default_branch="main", author_association="MEMBER")
        self.assertTrue(ok, reasons)

    def test_issue_comment_non_member_and_bot_rejected(self):
        ok, reasons = preflight.trust_gate(
            trigger="issue_comment", head_repo="o/r", base_repo="o/r", author_is_bot=False,
            base_ref="main", default_branch="main", author_association="NONE")
        self.assertFalse(ok)
        self.assertTrue(any("untrusted-comment-author" in r for r in reasons))
        ok, reasons = preflight.trust_gate(
            trigger="issue_comment", head_repo="o/r", base_repo="o/r", author_is_bot=True,
            base_ref="main", default_branch="main", author_association="MEMBER")
        self.assertFalse(ok)
        self.assertIn("self-authored-comment", reasons)

    def test_pull_request_event_still_rejected(self):
        ok, _ = preflight.trust_gate(
            trigger="pull_request", head_repo="o/r", base_repo="o/r", author_is_bot=False,
            base_ref="main", default_branch="main")
        self.assertFalse(ok)

    def test_check_runs_endpoint_is_commit_scoped(self):
        url = checks_adapter.check_runs_list_url("https://api.github.com", "o/r", "a" * 40)
        self.assertIn("/commits/" + "a" * 40 + "/check-runs", url)
        self.assertNotIn("/repos/o/r/check-runs", url)

    def test_token_fallback_gh_token(self):
        import os as _os
        old = dict(_os.environ)
        try:
            _os.environ.pop("GITHUB_TOKEN", None)
            _os.environ["GH_TOKEN"] = "tok-gh"
            self.assertEqual(checks_adapter.resolve_token(), "tok-gh")
        finally:
            _os.environ.clear()
            _os.environ.update(old)

    def test_blocked_failure_can_retry_but_real_review_skips(self):
        import oreki_auto_runner as runner  # noqa: E402
        blocked = {"status": "completed", "output": {"summary": "preflight-blocked:peak-window"}}
        self.assertFalse(runner.prior_review_skippable(blocked))
        self.assertFalse(runner.prior_review_skippable({"status": "in_progress", "output": {"summary": "clean:P2=0"}}))
        self.assertTrue(runner.prior_review_skippable({"status": "completed", "output": {"summary": "clean:P2=0"}}))
        self.assertTrue(runner.prior_review_skippable(
            {"status": "completed", "output": {"summary": "blocking-findings:P0=1,P1=0"}}))



class BacklogScan(unittest.TestCase):
    """schedule/workflow_dispatch 积压扫描（原 NOT RUN，本轮补齐）。"""

    def setUp(self):
        import oreki_auto_runner as runner  # noqa: E402
        self.runner = runner
        self.repo = "OrekiDawson/AD-Oreki-Edition-Android"

    def _pr(self, number, updated, draft=False, base="main", head_repo=None, state="open"):
        return {"number": number, "updated_at": updated, "draft": draft, "state": state,
                "base": {"ref": base},
                "head": {"sha": ("%040x" % number), "repo": {"full_name": head_repo or self.repo}}}

    def test_picks_newest_eligible(self):
        prs = [self._pr(1, "2026-11-16T01:00:00Z"), self._pr(2, "2026-11-16T05:00:00Z")]
        picked = self.runner.select_backlog_pr(prs, lambda p: False, self.repo)
        self.assertEqual(picked["number"], 2)

    def test_skips_draft_fork_non_main_closed(self):
        prs = [
            self._pr(1, "2026-11-16T06:00:00Z", draft=True),
            self._pr(2, "2026-11-16T05:30:00Z", head_repo="evil/fork"),
            self._pr(3, "2026-11-16T05:00:00Z", base="dev"),
            self._pr(4, "2026-11-16T04:00:00Z", state="closed"),
            self._pr(5, "2026-11-16T03:00:00Z"),
        ]
        picked = self.runner.select_backlog_pr(prs, lambda p: False, self.repo)
        self.assertEqual(picked["number"], 5)

    def test_skips_already_reviewed(self):
        prs = [self._pr(1, "2026-11-16T05:00:00Z"), self._pr(2, "2026-11-16T04:00:00Z")]
        picked = self.runner.select_backlog_pr(prs, lambda p: p["number"] == 1, self.repo)
        self.assertEqual(picked["number"], 2)

    def test_none_when_backlog_empty(self):
        self.assertIsNone(self.runner.select_backlog_pr([], lambda p: False, self.repo))
        self.assertIsNone(self.runner.select_backlog_pr(
            [self._pr(1, "2026-11-16T05:00:00Z")], lambda p: True, self.repo))



class PricingDelegation(unittest.TestCase):
    """峰谷判定必须复用 scripts/deepseek_pricing.py（唯一事实源），不得各自硬编码。"""

    def test_matches_authoritative_module(self):
        import sys
        from pathlib import Path as _P
        sys.path.insert(0, str(_P(__file__).resolve().parents[2] / "scripts"))
        from deepseek_pricing import pricing_window as authoritative
        samples = [
            datetime(2026, 11, 16, 9, 0, tzinfo=BJ),
            datetime(2026, 11, 16, 11, 59, tzinfo=BJ),
            datetime(2026, 11, 16, 12, 0, tzinfo=BJ),
            datetime(2026, 11, 16, 14, 0, tzinfo=BJ),
            datetime(2026, 11, 16, 17, 59, tzinfo=BJ),
            datetime(2026, 11, 16, 18, 0, tzinfo=BJ),
            datetime(2026, 11, 21, 10, 0, tzinfo=BJ),   # 周六
            datetime(2026, 5, 1, 10, 0, tzinfo=BJ),     # 劳动节法定假日
            datetime(2026, 2, 14, 10, 0, tzinfo=BJ),    # 调休上班日（官方口径仍低谷）
            datetime(2026, 11, 16, 2, 30, tzinfo=timezone.utc),  # 10:30 CST
        ]
        for moment in samples:
            with self.subTest(moment=moment.isoformat()):
                self.assertEqual(preflight.pricing_window(moment), authoritative(moment))
                self.assertEqual(preflight.is_peak(moment), authoritative(moment)[0] == "peak")

    def test_holiday_and_makeup_are_offpeak(self):
        self.assertFalse(preflight.is_peak(datetime(2026, 10, 1, 10, 0, tzinfo=BJ)))
        self.assertFalse(preflight.is_peak(datetime(2026, 9, 20, 10, 0, tzinfo=BJ)))  # 调休上班日

    def test_fallback_is_conservative_and_labelled(self):
        import builtins
        real_import = builtins.__import__

        def fake_import(name, *a, **kw):
            if name == "deepseek_pricing":
                raise ImportError("simulated missing module")
            return real_import(name, *a, **kw)

        builtins.__import__ = fake_import
        try:
            window, reason = preflight.pricing_window(datetime(2026, 11, 16, 10, 0, tzinfo=BJ))
            self.assertEqual(window, "peak")
            self.assertTrue(reason.startswith("fallback:"))
            window2, reason2 = preflight.pricing_window(datetime(2026, 11, 16, 12, 30, tzinfo=BJ))
            self.assertEqual(window2, "offpeak")
            self.assertTrue(reason2.startswith("fallback:"))
        finally:
            builtins.__import__ = real_import

    def test_decide_reports_pricing_source(self):
        r = preflight.decide(now=datetime(2026, 11, 16, 12, 30, tzinfo=BJ), check_balance=False,
                             api_key=None, repo="OrekiDawson/AD-Oreki-Edition-Android", pr=1,
                             sha="a" * 40, trigger="pull_request_target",
                             head_repo="OrekiDawson/AD-Oreki-Edition-Android",
                             base_repo="OrekiDawson/AD-Oreki-Edition-Android", base_ref="main",
                             default_branch="main", author_is_bot=False, diff_chars=100)
        self.assertEqual(r["pricing_source"], "deepseek_pricing")
        self.assertFalse(r["peak"])
        self.assertTrue(r["allow"], r["reasons"])



class LlmEnvBridge(unittest.TestCase):
    """上游 Config.from_env 直接读 LLM_API_KEY；仓库 secret 名为 OREKI_AUDIT_LLM_KEY，必须桥接。"""

    def setUp(self):
        import oreki_auto_runner as runner
        self.runner = runner
        self._saved = {k: os.environ.get(k) for k in ("LLM_API_KEY", "OREKI_AUDIT_LLM_KEY")}

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_maps_repo_secret_name_to_upstream_env(self):
        os.environ.pop("LLM_API_KEY", None)
        got = self.runner.ensure_llm_env("sk-test")
        self.assertEqual(got, "sk-test")
        self.assertEqual(os.environ["LLM_API_KEY"], "sk-test")

    def test_does_not_override_existing_llm_api_key(self):
        os.environ["LLM_API_KEY"] = "sk-existing"
        got = self.runner.ensure_llm_env("sk-other")
        self.assertEqual(got, "sk-existing")
        self.assertEqual(os.environ["LLM_API_KEY"], "sk-existing")

    def test_empty_key_leaves_env_untouched(self):
        os.environ.pop("LLM_API_KEY", None)
        self.assertEqual(self.runner.ensure_llm_env(""), "")
        self.assertNotIn("LLM_API_KEY", os.environ)

    def test_config_env_requirement_is_satisfied(self):
        """桥接后 Config.from_env 不再因 LLM_API_KEY 缺失抛 KeyError。"""
        os.environ.pop("LLM_API_KEY", None)
        self.runner.ensure_llm_env("sk-test")
        self.assertIn("LLM_API_KEY", os.environ)



class VerdictContract(unittest.TestCase):
    """判决尾注契约必须写进送给审查引擎的请求体，且带当前 head SHA。"""

    def setUp(self):
        import oreki_auto_runner as runner
        self.runner = runner

    def test_body_contains_exact_trailer_with_sha(self):
        sha = "6ae666ed3f0402fcec1061f44984b202e1272355"
        body = self.runner.build_trigger_body(sha)
        self.assertIn("reviewed_sha", body)
        self.assertIn(sha, body)
        self.assertIn("oreki-audit-verdict", body)
        for key in ('"p0"', '"p1"', '"p2"'):
            self.assertIn(key, body)
        self.assertIn("最后单独一行", body)

    def test_parse_verdict_accepts_documented_shape(self):
        import checks_adapter as ca
        sha = "a" * 40
        text = ('审查摘要\n\n<!-- oreki-audit-verdict '
                '{"p0":0,"p1":0,"p2":2,"reviewed_sha":"%s"} -->' % sha)
        v = ca.parse_verdict(text)
        self.assertIsNotNone(v)
        self.assertEqual((v["p0"], v["p1"], v["p2"]), (0, 0, 2))
        self.assertEqual(v["reviewed_sha"], sha)



class DeferredPreflightBlocks(unittest.TestCase):
    """高峰/余额类阻断必须 neutral（不锁死 PR），其余阻断才是 failure。"""

    def setUp(self):
        import oreki_auto_runner as runner
        self.runner = runner

    def test_empty_or_missing_reasons_fail_closed(self):
        self.assertEqual(self.runner.classify_block([])[0], "failure")
        self.assertEqual(self.runner.classify_block(None)[0], "failure")
        self.assertIn("unknown", self.runner.classify_block([])[1])

    def test_peak_window_is_neutral(self):
        c, r = self.runner.classify_block(["peak-window"])
        self.assertEqual(c, "neutral")
        self.assertIn("peak-window", r)

    def test_balance_reasons_are_neutral(self):
        for reason in ("balance-below-min:9.99", "balance-key-missing", "balance-query-failed:TimeoutError"):
            with self.subTest(reason=reason):
                self.assertEqual(self.runner.classify_block([reason])[0], "neutral")

    def test_untrusted_and_diff_are_failure(self):
        self.assertEqual(self.runner.classify_block(["untrusted-trigger:issue_comment"])[0], "failure")
        self.assertEqual(self.runner.classify_block(["diff-too-large:200000>180000"])[0], "failure")

    def test_mixed_reasons_fail_closed(self):
        self.assertEqual(self.runner.classify_block(["peak-window", "diff-too-large:1>0"])[0], "failure")

    def test_decide_outcome_uses_classification(self):
        c, r = self.runner.decide_outcome(preflight_allow=False, preflight_reasons=["peak-window"],
                                          draft=None, current_head_sha="a" * 40, reviewed_sha=None,
                                          truncated=0, verdict=None)
        self.assertEqual(c, "neutral")
        self.assertIn("preflight-blocked", r)

