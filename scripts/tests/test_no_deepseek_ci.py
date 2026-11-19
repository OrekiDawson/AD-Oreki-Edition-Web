"""CI policy: isolate the authorized paid AI review from ordinary CI.

Kodus Cloud is an external hosted GitHub App: its reviews do not run in this
repository's Actions. The single internal-PR Codex/DeepSeek review workflow is
read-only and non-blocking; legacy triage entrypoints must not return.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVIEW_WORKFLOW = ROOT / ".github/workflows/codex-deepseek-review.yml"


class ScopedDeepSeekReviewInCi(unittest.TestCase):
    def test_legacy_ai_triage_entrypoints_removed(self):
        for path in (
            ".github/workflows/deepseek-triage.yml",
            "scripts/deepseek_ci_triage.py",
            ".github/workflows/oreki-audit.yml",
            "scripts/audit/oreki_auto_runner.py",
        ):
            self.assertFalse((ROOT / path).exists(), path)

    def test_workflows_do_not_call_paid_model_api(self):
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            if path == REVIEW_WORKFLOW:
                continue
            with self.subTest(path=path.name):
                body = path.read_text(encoding="utf-8")
                for marker in (
                    "DEEPSEEK_API_KEY",
                    "api.deepseek.com",
                    "deepseek_ci_triage.py",
                    "OREKI_AUDIT_LLM_KEY",
                    "oreki_auto_runner.py",
                ):
                    self.assertNotIn(marker, body)

    def test_review_workflow_is_isolated_and_read_only(self):
        self.assertTrue(REVIEW_WORKFLOW.exists())
        body = REVIEW_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", body)
        self.assertNotIn("\n  pull_request:\n", body)
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", body)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", body)
        self.assertIn("refs/pull/${PR_NUMBER}/head:refs/review/head", body)
        self.assertIn("working-directory: ${{ runner.temp }}/review", body)
        self.assertIn("PATCH_TRUNCATED=", body)
        self.assertIn("PATCH_EXCLUDED_PATTERNS=", body)
        self.assertIn("OREKI_AUDIT_DAILY_LIMIT", body)
        self.assertIn("daily-budget", body)
        self.assertIn("head -c 24000", body)
        self.assertIn("classify:", body)
        self.assertIn("CATEGORIES=", body)
        self.assertIn("CROSS_REPO=", body)
        self.assertIn("PEER_SHA=", body)
        self.assertIn("peer-context.md", body)
        self.assertIn("AD-Oreki-Edition-Android,AD-Oreki-Edition-Web", body)
        self.assertIn("permission-contents: read", body)
        self.assertIn("REVIEW_CONFIG_VERSION", body)
        self.assertIn("openai/codex-action@306c6a196a99dcc6582530c396a19d2672d5e9ec", body)
        self.assertIn("permission-profile: \":read-only\"", body)
        self.assertIn("responses-api-endpoint: \"https://api.deepseek.com/responses\"", body)
        self.assertIn("model: \"deepseek-flash\"", body)
        self.assertIn("OREKI_AUDIT_LLM_KEY", body)
        self.assertIn("OREKI_AUDIT_APP_PRIVATE_KEY", body)
        self.assertIn("oreki-codex-deepseek-review:v1", body)
        self.assertIn("comment.user.login === 'oreki-audit[bot]'", body)
        self.assertIn("fetch-depth: 0", body)
        self.assertIn("minuteOfDay >= 50", body)

if __name__ == "__main__":
    unittest.main()
