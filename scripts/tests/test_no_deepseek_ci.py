"""CI policy: isolate the authorized paid AI review from ordinary CI.

Kodus Cloud is an external hosted GitHub App: its reviews do not run in this
repository's Actions. The single internal-PR Codex/DeepSeek review workflow is
read-only and non-blocking; legacy triage entrypoints must not return.
"""
import json
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
REVIEW_WORKFLOW = ROOT / ".github/workflows/codex-deepseek-review.yml"


class ScopedDeepSeekReviewInCi(unittest.TestCase):
    def assert_strict_objects(self, schema, path="$"):
        if isinstance(schema, dict):
            if schema.get("type") == "object":
                with self.subTest(path=path):
                    self.assertFalse(schema.get("additionalProperties", True), path)
                    self.assertEqual(
                        set(schema.get("properties", {})),
                        set(schema.get("required", [])),
                        path,
                    )
            for key, value in schema.items():
                self.assert_strict_objects(value, f"{path}.{key}")
        elif isinstance(schema, list):
            for index, value in enumerate(schema):
                self.assert_strict_objects(value, f"{path}[{index}]")

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
        self.assertTrue((ROOT / ".github/codex/review-batches.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/review-policy.md").exists())
        self.assertTrue((ROOT / ".github/codex/audit-quota.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/publish-review.mjs").exists())
        self.assertTrue((ROOT / ".github/codex/review-result.schema.json").exists())
        body = REVIEW_WORKFLOW.read_text(encoding="utf-8")
        workflow = yaml.safe_load(body)
        self.assertIn("pull_request_target:", body)
        self.assertNotIn("\n  pull_request:\n", body)
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", body)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", body)
        self.assertIn("refs/pull/${PR_NUMBER}/head:refs/review/head", body)
        self.assertIn("working-directory: ${{ runner.temp }}/batch", body)
        self.assertNotIn("PATCH_TRUNCATED=", body)
        self.assertNotIn("OREKI_AUDIT_DAILY_LIMIT", body)
        self.assertNotIn("daily-budget", body)
        self.assertIn("audit-quota.mjs", body)
        quota_source = (ROOT / ".github/codex/audit-quota.mjs").read_text(encoding="utf-8")
        self.assertIn("daily-quota-exhausted", quota_source)
        self.assertIn("quota-service-unavailable", body)
        self.assertIn("AI_REVIEW_NOT_EXECUTED", body)
        self.assertIn("plan_notice", body)
        self.assertIn("model_started", body)
        self.assertIn("model_succeeded", body)
        self.assertIn("--mode plan", body)
        self.assertIn("--max-bytes 48000", body)
        self.assertIn("fromJSON(needs.classify.outputs.batches_json)", body)
        self.assertIn("review-batches.mjs", body)
        self.assertIn('batch-${BATCH_ID}.json', body)
        self.assertIn('meta-${BATCH_ID}.json', body)
        context_source = (ROOT / ".github/codex/review-context.mjs").read_text(encoding="utf-8")
        self.assertIn("HUNK_POLICY=complete-hunks-only", context_source)
        self.assertIn("--function-context", context_source)
        self.assertIn("review-policy.md", body)
        self.assertNotIn("head -c 24000", body)
        self.assertIn("classify:", body)
        self.assertIn("本批次类别", body)
        self.assertIn("PEER_CONTEXT", body)
        self.assertIn("AD-Oreki-Edition-Android,AD-Oreki-Edition-Web", body)
        self.assertIn("permission-contents: read", body)
        self.assertIn("permission-contents: write", body)
        self.assertIn("permission-pull-requests: write", body)
        self.assertNotIn("permission-issues: write", body)
        self.assertIn("output-schema-file:", body)
        self.assertIn("publish-review.mjs", body)
        publisher = (ROOT / ".github/codex/publish-review.mjs").read_text(encoding="utf-8")
        self.assertIn("pulls/${pr}/reviews", publisher)
        self.assertIn("pulls/${pr}/comments", publisher)
        self.assertIn("historicalFindingKeys", publisher)
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
        self.assertIn("OREKI_AUDIT_QUOTA_APP_ID", body)
        self.assertIn("OREKI_AUDIT_QUOTA_APP_PRIVATE_KEY", body)
        quota_steps = body.split("- name: 生成共享配额状态令牌", 1)[1]
        quota_steps = quota_steps.split("- name: 原子预占本批配额", 1)[0]
        self.assertIn("permission-contents: write", quota_steps)
        self.assertIn("repositories: AD-Oreki-Edition-Web", quota_steps)
        self.assertNotIn("permission-pull-requests: write", quota_steps)
        review_token_steps = body.split("- name: 生成 Pull Request Review 写令牌", 1)[1]
        self.assertIn("OREKI_AUDIT_APP_PRIVATE_KEY", review_token_steps)
        self.assertNotIn("OREKI_AUDIT_QUOTA_APP_PRIVATE_KEY", review_token_steps)
        models = json.loads(
            (ROOT / ".github/codex/deepseek-models.json").read_text(encoding="utf-8"))
        flash = next(model for model in models["models"] if model["slug"] == "deepseek-flash")
        self.assertGreaterEqual(flash["truncation_policy"]["limit"], 65536)
        self.assertIn("fetch-depth: 0", body)
        self.assertIn("minuteOfDay >= 50", body)
        self.assertEqual(
            {"classify", "review", "aggregate", "publish"},
            set(workflow["jobs"]),
        )
        self.assertIn("fromJSON", workflow["jobs"]["review"]["strategy"]["matrix"]["batch"])
        self.assertIn("review-batches.mjs", body)

    def test_output_schema_uses_strict_objects(self):
        schema = json.loads(
            (ROOT / ".github/codex/review-result.schema.json").read_text(encoding="utf-8"))
        self.assert_strict_objects(schema)

if __name__ == "__main__":
    unittest.main()
