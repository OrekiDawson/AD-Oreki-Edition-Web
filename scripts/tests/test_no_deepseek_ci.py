"""CI policy: do not call paid LLM APIs from ordinary CI workflows.

Kodus Cloud is an external hosted GitHub App: its reviews do not run in this
repository's Actions. Historical Oreki Audit execution must not return.
"""
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
class NoDeepSeekReviewInCi(unittest.TestCase):
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
            with self.subTest(path=path.name):
                body=path.read_text(encoding="utf-8")
                for marker in ("DEEPSEEK_API_KEY","api.deepseek.com","deepseek_ci_triage.py","OREKI_AUDIT_LLM_KEY","oreki_auto_runner.py"):
                    self.assertNotIn(marker, body)
if __name__ == "__main__":
    unittest.main()
