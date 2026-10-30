# -*- coding: utf-8 -*-
"""缁?StageAssist 澧炲姞 START perk 鍒ゅ畾锛屽苟璁?R0 鎻愮ず闅?START 鐘舵€佸垏鎹€?淇濇寔 CRLF銆?""
from pathlib import Path
import sys

ROOT = Path(r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\android\AD_Oreki_Edition_Android")
SA = ROOT / "scripts/payload/smali/kajfosz/antimatterdimensions/oreki/StageAssist.smali"

raw = SA.read_bytes()
txt = raw.decode("utf-8")
assert "\r\n" in txt

OLD_HEADER = """#       stage 1 = 绗?1-13 琛岋細Reality 鐨勬垚灏遍棬妲涳紙wiki.gg /wiki/Reality锛?#                 涔版渶鍚庝竴涓?Time Study 闇€ e4000 EP + 鍓?13 琛屾垚灏憋紱涓?Reality
#                 閲嶇疆浼氭竻绌虹 1-13 琛岋級銆傜獥鍙?= 瑙ｉ攣 Reality 涔嬪墠 / 閲嶇疆涔嬪悗銆?""

NEW_HEADER = """#       stage 1 = 绗?1-13 琛岋細Reality 鐨勬垚灏遍棬妲涖€備笁鍚戝嵃璇侊紙2026-10-25 澶嶆牳锛夛細
#                 鐮旂┒鏍戙€孶nlock Reality銆嶏紙dilation study id 6锛夌殑瑕佹眰 =
#                   TimeDimension8 宸蹭拱 && maxEP.exponent >= 4000 &&
#                   (START perk 宸蹭拱 || 鍓?13 琛屽叏瑙ｉ攣) && !Pelle.isDoomed
#                 JS   : secret-formula/eternity/time-studies/dilation-time-studies.js id 6
#                 Smali: e30.smali:352-364锛圫TART 涓虹湡鍒欒烦杩?13 琛屽惊鐜級銆?#                        e30.smali:74-110锛堟弿杩版寜 START 鍒囨崲涓ゅ紶 requirement 鏂囨锛?#                 绐楀彛 = 瑙ｉ攣 Reality 涔嬪墠 / 閲嶇疆涔嬪悗銆?#                 * START锛? perk_0锛宔g3.a锛宨d 0锛夊凡涔版椂鎴愬氨闂ㄦ琚Щ闄わ紝
#                   鏈崱鐗囨枃妗堝繀椤婚殢涔嬫敼鍐欙紝鍚﹀垯灏辨槸鍦ㄨ璋庛€?#                 * Reality 閲嶇疆娓呯┖杩?13 琛岋紝鐢?ACHNR锛? perk_205锛宔g3.V锛?#                   id 0xcd锛夎眮鍏嶏紱ACHNR 璐拱鏃惰繕浼氱珛鍗宠ˉ榻愯繖 13 琛屻€?#                   瑙?prestige/f.smali:7147-7213銆?""

assert txt.count(OLD_HEADER.replace("\n", "\r\n")) == 1, "鏃уご閮ㄦ敞閲婃湭鍞竴鍛戒腑"
txt = txt.replace(OLD_HEADER.replace("\n", "\r\n"), NEW_HEADER.replace("\n", "\r\n"))

NEW_METHODS = """.method public static startPerk()Z
    .locals 1

    # START = Reality perk id 0锛坋g3.a / strings.xml perk_0_name锛夈€?    # 澶嶇敤鍘熺増鍒ゅ畾锛屼笉鍙﹀疄鐜拌喘涔扮姸鎬佹煡璇細
    #   rf3.k() = cc4.B() && !rf3.K()
    #     cc4.B() = 宸茶喘鍒楄〃锛圥layer$Reality.t()锛夊寘鍚 perk id
    #     rf3.K() = Pelle.isDoomed && uselessPerks 鍚 id锛圫TART id 0 涓嶅湪鍒楄〃鍐咃級
    #   => JS 鐨?Perk.canBeApplied锛沞30.smali:352-364 鐨?Reality 闇€姹傚垽瀹氱敤鐨勫氨鏄畠銆?    # 璇箟锛歋TART 宸茶喘涔?-> Reality 鐮旂┒鐨勬垚灏遍棬妲涜绉婚櫎銆?    sget-object v0, Leg3;->a:Ldg3;

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

    # START 宸茶喘 -> 闂ㄦ琚Щ闄わ紱鏈喘 -> 13 琛屼粛鏄棬妲涖€備袱鏉¤矾寰勪簰鏂ワ紝涓嶅苟瀛樸€?    invoke-static {}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->startPerk()Z

    move-result v1

    if-eqz v1, :noStart

    const-string v1, "START锛圧eality perk 0锛夊凡璐拱锛歊eality 鐨勬垚灏遍棬妲涘凡琚Щ闄も€斺€旂爺绌舵爲涓婄殑銆孶nlock Reality銆嶅彧瑕佹眰鍓嶇疆鐮旂┒涓?e4000 EP锛岃繖 13 琛屼笉鍐嶆槸闂ㄦ銆傛鏃剁偣浜畠浠彧鍓╄鍐呰В閿佷笌鎴愬氨鍊嶇巼锛堟暣琛?脳1.25銆佹瘡涓?脳1.03锛夌殑鏀剁泭銆?

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    goto :tail

    :noStart
    const-string v1, "绗?1鈥?3 琛屾槸 Reality 鐨勯棬妲涳細鐮旂┒鏍戜笂鐨勩€孶nlock Reality銆嶈姹?e4000 EP 涓旇繖 13 琛屽叏婊★紱Reality 閲嶇疆浼氭妸杩?13 琛屾竻绌猴紙宸蹭拱 ACHNR 鍚庝笉鍐嶆竻绌猴紝骞朵細绔嬪嵆琛ラ綈杩?13 琛岋級銆傝鍦ㄨВ閿?Reality 涔嬪墠浣跨敤锛屾垨閲嶇疆鍚庡彂鐜拌鏁版帀鍏夋椂鐢ㄦ潵鎭㈠銆?

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    :tail
    if-nez v4, :gap

    const-string v1, "\\n褰撳墠杩?13 琛屽凡婊★細鍐嶆墽琛屼笉浼氳В閿佷换浣曟垚灏便€?

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    goto :fin

    :gap
    const-string v1, "\\n褰撳墠缂哄彛 "

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0, v4}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    const-string v1, " 涓細鐜板湪鎵ц鍙彁鍓嶆嬁鍒拌鍐呰В閿侊紙41 涓や釜鏃犻檺鍗囩骇 / 75 绗洓鏃犻檺缁村害 / 118 鐗虹壊涓嶅啀閲嶇疆 AD / 133 寮€灞€鑷甫鍏ㄩ儴鏃犻檺鎸戞垬 / 138 绉婚櫎鐮旂┒璐熼潰锛変笌 脳1.03銆伱?.25 鍊嶇巼銆?

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    :fin
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method"""

start = txt.index(".method private static hintRows13()Ljava/lang/String;")
end = txt.index(".end method", start) + len(".end method")
txt = txt[:start] + NEW_METHODS.replace("\n", "\r\n") + txt[end:]

# R0 鎽樿杩藉姞 START 鐘舵€佽
OLD_R0 = """    const-string v1, "\\n鐜板疄鍗囩骇鍏ㄤ拱锛歕""""
NEW_R0 = """    const-string v1, "\\nSTART perk 宸茶喘锛?

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-static {}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->startPerk()Z

    move-result v1

    invoke-static {v1}, Lkajfosz/antimatterdimensions/oreki/StageAssist;->yn(Z)Ljava/lang/String;

    move-result-object v1

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    const-string v1, "\\n鐜板疄鍗囩骇鍏ㄤ拱锛歕""""
r0_start = txt.index(".method public static summaryR0()Ljava/lang/String;")
r0_end = txt.index(".end method", r0_start)
r0_body = txt[r0_start:r0_end]
assert r0_body.count(OLD_R0.replace("\n", "\r\n")) == 1, "R0 鎽樿閿氱偣鏈敮涓€鍛戒腑"
txt = txt[:r0_start] + r0_body.replace(OLD_R0.replace("\n", "\r\n"),
                                       NEW_R0.replace("\n", "\r\n")) + txt[r0_end:]

assert "0x12" not in txt, "璇紩鍏ョ 18 琛屽父閲?
SA.write_bytes(txt.encode("utf-8"))
print("patched", SA, len(txt.encode("utf-8")))
