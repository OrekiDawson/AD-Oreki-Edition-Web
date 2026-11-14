"""CI 展示名称中文化与跨仓库机器契约回归测试。"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


class CiDisplayNameTests(unittest.TestCase):
    def test_workflow_names_are_simplified_chinese(self):
        ci = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        self.assertIn("name: Web 持续集成", ci)
        self.assertIn("name: 申请已批准的 Web Pages 部署", deploy)

    def test_cross_repository_job_contracts_remain_english(self):
        deploy = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        self.assertIn('select(.name=="Node checks"', deploy)
        self.assertIn('select(.name=="Mobile Chromium smoke"', deploy)


if __name__ == "__main__":
    unittest.main()
