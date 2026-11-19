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
        self.assertTrue((ROOT / ".github/codex/deepseek-models.json").exists())
        self.assertTrue((ROOT / ".github/codex/review-context.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/audit-quota.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/publish-review.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/review-result.schema.json").exists())
        body = REVIEW_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", body)
        self.assertNotIn("\n  pull_request:\n", body)
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", body)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", body)
        self.assertIn("refs/pull/${PR_NUMBER}/head:refs/review/head", body)
        self.assertIn("working-directory: ${{ runner.temp }}/review", body)
        self.assertIn("PATCH_TRUNCATED=", body)
        self.assertIn("PATCH_EXCLUDED_PATTERNS=", body)
        self.assertNotIn("OREKI_AUDIT_DAILY_LIMIT", body)
        self.assertNotIn("daily-budget", body)
        self.assertIn("audit-quota.mjs", body)
        self.assertIn("daily-quota-exhausted", body)
        self.assertIn("model_started", body)
        self.assertIn("model_succeeded", body)
        self.assertIn("--mode patch", body)
        self.assertNotIn("head -c 24000", body)
        self.assertIn("classify:", body)
        self.assertIn("CATEGORIES=", body)
        self.assertIn("CROSS_REPO=", body)
        self.assertIn("PEER_SHA=", body)
        self.assertIn("PATCH_INCLUDED_FILES=", body)
        self.assertIn("PATCH_SKIPPED_FILES=", body)
        self.assertIn("peer-context.md", body)
        self.assertIn("AD-Oreki-Edition-Android,AD-Oreki-Edition-Web", body)
        self.assertIn("permission-contents: read", body)
        self.assertIn("permission-contents: write", body)
        self.assertIn("permission-issues: write", body)
        self.assertIn("permission-pull-requests: write", body)
        self.assertIn("output-schema-file:", body)
        self.assertIn("publish-review.mjs", body)
        publisher = (ROOT / ".github/codex/publish-review.mjs").read_text(encoding="utf-8")
        self.assertIn("pulls/${pr}/reviews", publisher)
        self.assertIn("event: \"COMMENT\"", publisher)
        self.assertIn("```suggestion", publisher)
        self.assertIn("comment.user?.login === \"oreki-audit[bot]\"", publisher)
        self.assertIn("REVIEW_CONFIG_VERSION", body)
        self.assertIn("openai/codex-action@306c6a196a99dcc6582530c396a19d2672d5e9ec", body)
        self.assertIn("permission-profile: \":read-only\"", body)
        self.assertIn("responses-api-endpoint: \"https://api.deepseek.com/responses\"", body)
        self.assertIn("model: \"deepseek-flash\"", body)
        self.assertIn("OREKI_AUDIT_LLM_KEY", body)
        self.assertIn("OREKI_AUDIT_APP_PRIVATE_KEY", body)
        self.assertIn("fetch-depth: 0", body)
        self.assertIn("minuteOfDay >= 50", body)

if __name__ == "__main__":
    unittest.main()
