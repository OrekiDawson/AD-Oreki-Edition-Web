"""CI 策略：默认禁止工作流调用外部 DeepSeek API；仅受信任的 Oreki Audit 工作流可豁免。

DeepSeek 峰谷计价日历测试与本策略无关，保持启用。
"""
from __future__ import annotations

import re
import sys
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_DIR = ROOT / ".github/workflows"

# 唯一被信任、允许出现模型端点/密钥引用的工作流。
#
# 为什么只有它可以豁免：R115-01 接入的 Oreki Audit 是独立 GitHub App 审查机器人，
# 必须真的调用模型才能产出审查；因此把「全仓禁止」收敛为「单文件白名单 + 对该文件的
# 严格安全断言」，而**不是**删除测试或放宽到所有工作流：
#   * 只用 pull_request_target / schedule / workflow_dispatch 触发，绝不出现 pull_request；
#   * 只检出默认分支，persist-credentials: false，绝不 checkout/执行 PR head；
#   * 模型调用前必须经 scripts/audit/preflight.py 的高峰窗口 / CNY 余额≥¥10 / 规模 / 信任守卫；
#   * 所有 Action 固定到 40 位 SHA 或明确 tag，权限只保留只读与 checks:write。
# 任何其它工作流（含以后新增的 CI）仍然禁止出现 DEEPSEEK_API_KEY / api.deepseek.com /
# deepseek_ci_triage.py，也不得复用审计机器人的 LLM 密钥或 runner 入口。
# 要扩大白名单，必须同步补充等价的安全断言，否则本测试失败。
TRUSTED_LLM_WORKFLOWS = frozenset({"oreki-audit.yml"})

FORBIDDEN_MODEL_TOKENS = (
    "DEEPSEEK_API_KEY",
    "api.deepseek.com",
    "deepseek_ci_triage.py",
    # 审计机器人的密钥与入口只允许出现在白名单文件里，避免其它工作流「借道」调用模型。
    "OREKI_AUDIT_LLM_KEY",
    "oreki_auto_runner.py",
)
ALLOWED_TRIGGERS = frozenset({"pull_request_target", "schedule", "workflow_dispatch"})
# 允许的 Action 固定形式：40 位小写 SHA，或明确 tag（v1 / v7 / v1.2.3）。
PINNED_REF_RE = re.compile(r"^(?:[0-9a-f]{40}|v\d+(?:\.\d+){0,2})$")
USES_RE = re.compile(r"^\s*(?:-\s*)?uses:\s*(\S+)\s*$")


def _workflow_files() -> list[Path]:
    return sorted(WORKFLOW_DIR.glob("*.yml")) + sorted(WORKFLOW_DIR.glob("*.yaml"))


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _block_after(lines: list[str], start: int, indent: int) -> list[str]:
    """返回 `start` 之后缩进大于 `indent` 的行，遇到同级/更外层非空行即停止。"""
    block: list[str] = []
    for line in lines[start + 1:]:
        if line.strip() and _indent(line) <= indent:
            break
        block.append(line)
    return block


def _trigger_keys(text: str) -> set[str]:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.rstrip() in ("on:", "'on':", '"on":'):
            keys: set[str] = set()
            for sub in _block_after(lines, index, 0):
                match = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", sub)
                if match:
                    keys.add(match.group(1))
            return keys
    raise AssertionError("找不到顶层 `on:` 触发声明")


def _job_blocks(lines: list[str]) -> dict[str, list[str]]:
    for index, line in enumerate(lines):
        if line.rstrip() != "jobs:":
            continue
        end = index + 1
        while end < len(lines):
            if lines[end].strip() and _indent(lines[end]) == 0:
                break
            end += 1
        region = lines[index + 1:end]
        starts: list[tuple[int, str]] = []
        for offset, region_line in enumerate(region):
            match = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", region_line)
            if match:
                starts.append((offset, match.group(1)))
        jobs: dict[str, list[str]] = {}
        for position, (offset, name) in enumerate(starts):
            next_offset = starts[position + 1][0] if position + 1 < len(starts) else len(region)
            jobs[name] = region[offset:next_offset]
        return jobs
    return {}


def _permissions_in(block: list[str], indent: int) -> dict[str, str] | None:
    for index, line in enumerate(block):
        if _indent(line) == indent and line.strip() == "permissions:":
            values: dict[str, str] = {}
            for sub in _block_after(block, index, indent):
                match = re.match(r"^\s+([A-Za-z0-9_-]+):\s*(\S+)\s*$", sub)
                if match:
                    values[match.group(1)] = match.group(2)
            return values
    return None


def _step_blocks(text: str) -> list[list[str]]:
    lines = text.splitlines()
    steps_indent = None
    for line in lines:
        if line.strip() == "steps:":
            steps_indent = _indent(line)
            break
    if steps_indent is None:
        return []
    item_indent = steps_indent + 2
    starts = [
        index for index, line in enumerate(lines)
        if _indent(line) == item_indent and line.lstrip().startswith("- ")
    ]
    blocks: list[list[str]] = []
    for position, start in enumerate(starts):
        end = starts[position + 1] if position + 1 < len(starts) else len(lines)
        blocks.append(lines[start:end])
    return blocks


def _step_index_containing(blocks: list[list[str]], needle: str) -> int:
    for index, block in enumerate(blocks):
        if needle in "\n".join(block):
            return index
    return -1


class NoDeepSeekReviewInCi(unittest.TestCase):
    def test_legacy_ai_triage_entrypoints_removed(self):
        self.assertFalse((ROOT / ".github/workflows/deepseek-triage.yml").exists())
        self.assertFalse((ROOT / "scripts/deepseek_ci_triage.py").exists())

    def test_trusted_workflow_allowlist_points_to_existing_workflow(self):
        present = {path.name for path in _workflow_files()}
        missing = TRUSTED_LLM_WORKFLOWS - present
        self.assertFalse(missing, f"白名单引用了不存在的工作流：{sorted(missing)}")

    def test_untrusted_workflows_do_not_call_deepseek_api(self):
        files = _workflow_files()
        self.assertTrue(files, "未找到任何 GitHub 工作流")
        for path in files:
            if path.name in TRUSTED_LLM_WORKFLOWS:
                continue
            with self.subTest(path=path.name):
                text = path.read_text(encoding="utf-8")
                for forbidden in FORBIDDEN_MODEL_TOKENS:
                    self.assertNotIn(
                        forbidden,
                        text,
                        f"{path.name} 不允许引用模型端点/密钥：{forbidden}",
                    )

    def test_trusted_audit_workflow_has_strict_security_invariants(self):
        path = WORKFLOW_DIR / "oreki-audit.yml"
        self.assertTrue(path.is_file(), "受信任的 oreki-audit.yml 必须存在")
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()

        # 1) 触发方式：只允许受信任事件，绝不允许直接 pull_request / issue_comment。
        triggers = _trigger_keys(text)
        self.assertEqual(
            triggers, set(ALLOWED_TRIGGERS),
            "审计工作流只允许 pull_request_target / schedule / workflow_dispatch 触发",
        )
        self.assertNotIn("pull_request:", text, "禁止直接使用 pull_request 触发（会执行 PR 代码）")

        # 2) 检出默认分支、不保存凭据、绝不 checkout/执行 PR head。
        blocks = _step_blocks(text)
        self.assertTrue(blocks, "未解析到审计工作流步骤")
        checkout_blocks = [
            block for block in blocks
            if any(
                (match := USES_RE.match(line)) and match.group(1).startswith("actions/checkout@")
                for line in block
            )
        ]
        self.assertEqual(len(checkout_blocks), 1, "只允许一次 actions/checkout")
        checkout_text = "\n".join(checkout_blocks[0])
        self.assertIn("persist-credentials: false", checkout_text, "checkout 必须关闭凭据持久化")
        self.assertNotRegex(checkout_text, r"(?m)^\s+ref:", "checkout 不得指定 ref（禁止检出 PR head）")
        self.assertNotRegex(
            text, r"ref:\s*\$\{\{[^}]*pull_request",
            "禁止把 PR head 作为 checkout ref",
        )
        self.assertNotIn("github.event.pull_request.head.ref", text)
        self.assertNotIn("refs/pull/", text)

        # 3) 模型调用前必须有 preflight 守卫，且真正执行审计 runner。
        self.assertIn("scripts/audit/preflight.py", text, "必须引用 scripts/audit/preflight.py 守卫")
        self.assertIn("python3 scripts/audit/oreki_auto_runner.py", text, "必须执行审计 runner")
        preflight_step = _step_index_containing(blocks, "scripts/audit/preflight.py")
        audit_step = _step_index_containing(blocks, "python3 scripts/audit/oreki_auto_runner.py")
        self.assertGreaterEqual(preflight_step, 0, "缺少执行 preflight.py 的步骤")
        self.assertGreaterEqual(audit_step, 0, "缺少执行审计 runner 的步骤")
        self.assertLess(preflight_step, audit_step, "preflight 守卫必须先于模型调用")

        # 4) 所有 Action 固定版本，禁止 @main / @master 等浮动引用。
        uses_targets = [match.group(1) for line in lines if (match := USES_RE.match(line))]
        self.assertTrue(uses_targets, "未解析到任何 Action 引用")
        for target in uses_targets:
            self.assertIn("@", target, f"Action 未固定版本：{target}")
            ref = target.rsplit("@", 1)[1]
            self.assertRegex(ref, PINNED_REF_RE, f"Action 版本必须固定为 40 位 SHA 或明确 tag：{target}")

        # 5) App Token 权限保持最小：内容/PR 只读 + 仅 checks 可写。
        top_permissions = _permissions_in(lines, 0)
        self.assertEqual(
            top_permissions,
            {"contents": "read", "pull-requests": "read"},
            "工作流级权限必须只读",
        )
        bot_jobs = [
            block for block in _job_blocks(lines).values()
            if any(
                (match := USES_RE.match(line)) and match.group(1).startswith(
                    "actions/create-github-app-token@"
                )
                for line in block
            )
        ]
        self.assertEqual(len(bot_jobs), 1, "只允许一个作业签发审计 App Token")
        job_permissions = _permissions_in(bot_jobs[0], 4)
        self.assertEqual(
            job_permissions,
            {"contents": "read", "pull-requests": "read", "checks": "write"},
            "App Token 作业权限必须是最小集合",
        )
        self.assertNotIn("write-all", text)
        for block in _job_blocks(lines).values():
            values = _permissions_in(block, 4)
            if not values:
                continue
            for scope, level in values.items():
                if level == "write":
                    self.assertEqual(scope, "checks", f"除 checks:write 外不允许写权限：{scope}:write")
        self.assertNotIn("contents: write", text)

    def test_trusted_audit_workflow_defers_to_preflight_guards(self):
        """白名单不是绕过口：模型调用必须真的先经 preflight，且守卫常量未被弱化。"""
        runner = ROOT / "scripts/audit/oreki_auto_runner.py"
        preflight_path = ROOT / "scripts/audit/preflight.py"
        self.assertTrue(runner.is_file(), "缺少审计 runner")
        self.assertTrue(preflight_path.is_file(), "缺少 preflight 守卫")

        runner_text = runner.read_text(encoding="utf-8")
        self.assertIn("import preflight", runner_text, "runner 必须导入 preflight 守卫")
        self.assertRegex(
            runner_text, r"pf\.decide\([^;]{0,400}?check_balance=True",
            "runner 必须调用 preflight.decide 且强制检查余额",
        )
        decide_at = runner_text.index("pf.decide(")
        model_at = runner_text.index("from reviewbot")
        self.assertLess(decide_at, model_at, "preflight 判定必须先于模型客户端导入/调用")

        sys.path.insert(0, str((ROOT / "scripts/audit").resolve()))
        try:
            import preflight  # noqa: PLC0415
        finally:
            sys.path.pop(0)

        self.assertGreaterEqual(preflight.MIN_BALANCE_CNY, Decimal("10.00"), "CNY 余额下限被弱化")
        self.assertIn((9, 12), preflight.PEAK_WINDOWS, "上午高峰窗口被弱化")
        self.assertIn((14, 18), preflight.PEAK_WINDOWS, "下午高峰窗口被弱化")
        self.assertTrue(preflight.balance_allows(Decimal("10.00")))
        self.assertFalse(preflight.balance_allows(Decimal("9.99")))
        self.assertTrue(preflight.is_peak(datetime(2026, 11, 16, 9, 0, tzinfo=preflight.BEIJING)))
        self.assertFalse(preflight.is_peak(datetime(2026, 11, 16, 12, 0, tzinfo=preflight.BEIJING)))
        ok, _ = preflight.trust_gate(
            trigger="issue_comment", head_repo="o/r", base_repo="o/r",
            author_is_bot=False, base_ref="main", default_branch="main",
        )
        self.assertFalse(ok, "信任门禁被弱化：issue_comment 必须被拒绝")


if __name__ == "__main__":
    unittest.main()
