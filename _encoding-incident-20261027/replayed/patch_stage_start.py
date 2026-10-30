# -*- coding: utf-8 -*-
"""给 StageAssist 增加 START perk 判定，并让 R0 提示随 START 状态切换。
保持 CRLF。"""
from pathlib import Path
import sys

ROOT = Path(r"C:\Users\Oreki\WorkBuddy\2026-10-24-01-19-39\AD_Oreki_Edition_Android")
SA = ROOT / "scripts/payload/smali/kajfosz/antimatterdimensions/oreki/StageAssist.smali"

raw = SA.read_bytes()
txt = raw.decode("utf-8")
assert "\r\n" in txt

OLD_HEADER = """#       stage 1 = 第 1-13 行：Reality 的成就门槛（wiki.gg /wiki/Reality：
#                 买最后一个 Time Study 需 e4000 EP + 前 13 行成就；且 Reality
#                 重置会清空第 1-13 行）。窗口 = 解锁 Reality 之前 / 重置之后。"""

NEW_HEADER = """#       stage 1 = 第 1-13 行：Reality 的成就门槛。三向印证（2026-10-25 复核）：
#                 研究树「Unlock Reality」（dilation study id 6）的要求 =
#                   TimeDimension8 已买 && maxEP.exponent >= 4000 &&
#                   (START perk 已买 || 前 13 行全解锁) && !Pelle.isDoomed
#                 JS   : secret-formula/eternity/time-studies/dilation-time-studies.js id 6
#                 Smali: e30.smali:352-364（START 为真则跳过 13 行循环）、
#                        e30.smali:74-110（描述按 START 切换两张 requirement 文案）
#                 窗口 = 解锁 Reality 之前 / 重置之后。
#                 * START（= perk_0，eg3.a，id 0）已买时成就门槛被移除，
#                   本卡片文案必须随之改写，否则就是在说谎。
#                 * Reality 重置清空这 13 行，由 ACHNR（= perk_205，eg3.V，
#                   id 0xcd）豁免；ACHNR 购买时还会立即补齐这 13 行。
#                   见 prestige/f.smali:7147-7213。"""

assert txt.count(OLD_HEADER.replace("\n", "\r\n")) == 1, "旧头部注释未唯一命中"
txt = txt.replace(OLD_HEADER.replace("\n", "\r\n"), NEW_HEADER.replace("\n", "\r\n"))

NEW_METHODS = """.method public static startPerk()Z
    .locals 1

    # START = Reality perk id 0（eg3.a / strings.xml perk_0_name）。
    # 复用原版判定，不另实现购买状态查询：
    #   rf3.k() = cc4.B() && !rf3.K()
    #     cc4.B() = 已购列表（Player$Reality.t()）包含该 perk id
    #     rf3.K() = Pelle.isDoomed && uselessPerks 含该 id（START id 0 不在列表内）
    #   => JS 的 Perk.canBeApplied；e30.smali:352-364 的 Reality 需求判定用的就是它。
    # 语义：START 已购买 -> Reality 研究的成就门槛被移除。
    sget-object v0, Leg3;->a:Ldg3;

    invoke-virtual {v0}, Lrf3;->k()Z

    move-result v0

    return v0
.end method


.method private static hintRows13()Ljava/lang/String;
    .locals 5

    const/4 v0, 0x1

    const/16 v1, 0xd

    invoke-static {v0, v1}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->countUnlockedRows(II)I

    move-result v2

    invoke-static {v0, v1}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->countTotalRows(II)I

    move-result v3

    sub-int v4, v3, v2

    new-instance v0, Ljava/lang/StringBuilder;

    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V

    # START 已购 -> 门槛被移除；未购 -> 13 行仍是门槛。两条路径互斥，不并存。
    invoke-static {}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->startPerk()Z

    move-result v1

    if-eqz v1, :noStart

    const-string v1, "START（Reality perk 0）已购买：Reality 的成就门槛已被移除——研究树上的「Unlock Reality」只要求前置研究与 e4000 EP，这 13 行不再是门槛。此时点亮它们只剩行内解锁与成就倍率（整行 ×1.25、每个 ×1.03）的收益。"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    goto :tail

    :noStart
    const-string v1, "第 1–13 行是 Reality 的门槛：研究树上的「Unlock Reality」要求 e4000 EP 且这 13 行全满；Reality 重置会把这 13 行清空（已买 ACHNR 后不再清空，并会立即补齐这 13 行）。请在解锁 Reality 之前使用，或重置后发现行数掉光时用来恢复。"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    :tail
    if-nez v4, :gap

    const-string v1, "\\n当前这 13 行已满：再执行不会解锁任何成就。"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    goto :fin

    :gap
    const-string v1, "\\n当前缺口 "

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0, v4}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    const-string v1, " 个：现在执行可提前拿到行内解锁（41 两个无限升级 / 75 第四无限维度 / 118 牺牲不再重置 AD / 133 开局自带全部无限挑战 / 138 移除研究负面）与 ×1.03、×1.25 倍率。"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    :fin
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method"""

start = txt.index(".method private static hintRows13()Ljava/lang/String;")
end = txt.index(".end method", start) + len(".end method")
txt = txt[:start] + NEW_METHODS.replace("\n", "\r\n") + txt[end:]

# R0 摘要追加 START 状态行
OLD_R0 = """    const-string v1, "\\n现实升级全买：\""""
NEW_R0 = """    const-string v1, "\\nSTART perk 已购："

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-static {}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->startPerk()Z

    move-result v1

    invoke-static {v1}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->yn(Z)Ljava/lang/String;

    move-result-object v1

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    const-string v1, "\\n现实升级全买：\""""
r0_start = txt.index(".method public static summaryR0()Ljava/lang/String;")
r0_end = txt.index(".end method", r0_start)
r0_body = txt[r0_start:r0_end]
assert r0_body.count(OLD_R0.replace("\n", "\r\n")) == 1, "R0 摘要锚点未唯一命中"
txt = txt[:r0_start] + r0_body.replace(OLD_R0.replace("\n", "\r\n"),
                                       NEW_R0.replace("\n", "\r\n")) + txt[r0_end:]

assert "0x12" not in txt, "误引入第 18 行常量"
SA.write_bytes(txt.encode("utf-8"))
print("patched", SA, len(txt.encode("utf-8")))
