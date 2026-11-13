"""CI policy: external DeepSeek AI review and failure-triage must stay disabled.

DeepSeek pricing-window tests are unrelated and remain enabled.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class NoDeepSeekReviewInCi(unittest.TestCase):
    def test_legacy_ai_triage_entrypoints_removed(self):
        self.assertFalse((ROOT / ".github/workflows/deepseek-triage.yml").exists())
        self.assertFalse((ROOT / "scripts/deepseek_ci_triage.py").exists())

    def test_workflows_do_not_call_deepseek_api(self):
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            with self.subTest(path=path.name):
                text = path.read_text(encoding="utf-8")
                for forbidden in ("DEEPSEEK_API_KEY", "api.deepseek.com", "deepseek_ci_triage.py"):
                    self.assertNotIn(forbidden, text)


if __name__ == "__main__":
    unittest.main()
