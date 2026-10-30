# -*- coding: utf-8 -*-
"""给 build_mod.py 增加 [4c] START perk / R0 提示一致性断言。保持 CRLF。"""
from pathlib import Path

P = Path(r"C:\Users\Oreki\WorkBuddy\2026-10-24-01-19-39\AD_Oreki_Edition_Android\scripts\build_mod.py")
txt = P.read_bytes().decode("utf-8")
assert "\r\n" in txt

ANCHOR = '    note("[4b] 旧全成就类零外部引用通过")\r\n'
assert txt.count(ANCHOR) == 1, "锚点未唯一命中"

BLOCK = '''
    # --- [4c] START perk 与 R0 提示一致性（2026-10-25 复核新增）---
    # 证据链：eg3.a = Reality perk id 0 = START（strings.xml perk_0_name）；
    #   rf3.k() = cc4.B() && !rf3.K() = JS 的 Perk.canBeApplied；
    #   e30 :pswitch_1 在 eg3.a.k() 为真时跳过前 13 行成就循环。
    # 因此 R0 提示必须随 START 状态切换，不能无条件宣称「13 行是门槛」。
    def _body(sig_text, text):
        i = text.index(sig_text)
        j = text.index(".end method", i)
        return text[i:j]

    sp = _body(".method public static startPerk()Z", sa)
    assert "Leg3;->a:Ldg3;" in sp, "startPerk 未指向原版 START perk 实例（eg3.a）"
    assert "Lrf3;->k()Z" in sp, "startPerk 未复用原版判定 rf3.k()（与 e30 同源）"
    assert "achievements/a;->" not in sp, "startPerk 不应触碰成就表"

    h13 = _body(".method private static hintRows13()Ljava/lang/String;", sa)
    assert h13.count("StageAssist;->startPerk()Z") == 1, \\
        "hintRows13 必须且只能有一处 START 判定"
    i_sp = h13.index("StageAssist;->startPerk()Z")
    i_guard = h13.index("if-eqz", i_sp)
    i_waived = h13.index("成就门槛已被移除")
    i_gate = h13.index("第 1\\u201313 行是 Reality 的门槛")
    m_label = re.search(r"^\\s*:noStart\\s*$", h13, re.M)
    assert m_label is not None, "hintRows13 缺少 :noStart 分支标签"
    i_no_start = m_label.start()
    assert i_guard < i_no_start, "START 判定之后应跳到未购分支"
    assert i_waived < i_no_start, "START 已购文案必须位于未购分支之前"
    assert i_no_start < i_gate, "门槛文案必须落在 START 未购分支内"
    assert i_guard < i_gate, "门槛文案未受 START 分支保护（会无条件显示）"
    assert sa.count("第 1\\u201313 行是 Reality 的门槛") == 1, \\
        "门槛文案重复出现，可能被无条件复用"
    assert sa.count("成就门槛已被移除") == 1, "START 分支文案缺失或重复"
    assert "买最后一个 Time Study" not in sa, "未区分 START 的旧门槛文案仍在"

    r0 = _body(".method public static summaryR0()Ljava/lang/String;", sa)
    assert "StageAssist;->startPerk()Z" in r0, "R0 卡片摘要未显示 START 状态"
    assert "START perk 已购：" in r0, "R0 卡片摘要缺少 START 状态标签"
    note("[4c] START perk 一致性自检通过（startPerk -> rf3.k()；门槛文案仅存在于未购分支）")
'''

new = ANCHOR + BLOCK.replace("\n", "\r\n")
txt = txt.replace(ANCHOR, new)
P.write_bytes(txt.encode("utf-8"))
print("patched", P)
