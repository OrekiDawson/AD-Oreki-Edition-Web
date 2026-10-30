# -*- coding: utf-8 -*-
"""缁?build_mod.py 澧炲姞 [4c] START perk / R0 鎻愮ず涓€鑷存€ф柇瑷€銆備繚鎸?CRLF銆?""
from pathlib import Path

P = Path(r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\android\AD_Oreki_Edition_Android\scripts\build_mod.py")
txt = P.read_bytes().decode("utf-8")
assert "\r\n" in txt

ANCHOR = '    note("[4b] 鏃у叏鎴愬氨绫婚浂澶栭儴寮曠敤閫氳繃")\r\n'
assert txt.count(ANCHOR) == 1, "閿氱偣鏈敮涓€鍛戒腑"

BLOCK = '''
    # --- [4c] START perk 涓?R0 鎻愮ず涓€鑷存€э紙2026-10-25 澶嶆牳鏂板锛?--
    # 璇佹嵁閾撅細eg3.a = Reality perk id 0 = START锛坰trings.xml perk_0_name锛夛紱
    #   rf3.k() = cc4.B() && !rf3.K() = JS 鐨?Perk.canBeApplied锛?    #   e30 :pswitch_1 鍦?eg3.a.k() 涓虹湡鏃惰烦杩囧墠 13 琛屾垚灏卞惊鐜€?    # 鍥犳 R0 鎻愮ず蹇呴』闅?START 鐘舵€佸垏鎹紝涓嶈兘鏃犳潯浠跺绉般€?3 琛屾槸闂ㄦ銆嶃€?    def _body(sig_text, text):
        i = text.index(sig_text)
        j = text.index(".end method", i)
        return text[i:j]

    sp = _body(".method public static startPerk()Z", sa)
    assert "Leg3;->a:Ldg3;" in sp, "startPerk 鏈寚鍚戝師鐗?START perk 瀹炰緥锛坋g3.a锛?
    assert "Lrf3;->k()Z" in sp, "startPerk 鏈鐢ㄥ師鐗堝垽瀹?rf3.k()锛堜笌 e30 鍚屾簮锛?
    assert "achievements/a;->" not in sp, "startPerk 涓嶅簲瑙︾鎴愬氨琛?

    h13 = _body(".method private static hintRows13()Ljava/lang/String;", sa)
    assert h13.count("StageAssist;->startPerk()Z") == 1, \\
        "hintRows13 蹇呴』涓斿彧鑳芥湁涓€澶?START 鍒ゅ畾"
    i_sp = h13.index("StageAssist;->startPerk()Z")
    i_guard = h13.index("if-eqz", i_sp)
    i_waived = h13.index("鎴愬氨闂ㄦ宸茶绉婚櫎")
    i_gate = h13.index("绗?1\\u201313 琛屾槸 Reality 鐨勯棬妲?)
    m_label = re.search(r"^\\s*:noStart\\s*$", h13, re.M)
    assert m_label is not None, "hintRows13 缂哄皯 :noStart 鍒嗘敮鏍囩"
    i_no_start = m_label.start()
    assert i_guard < i_no_start, "START 鍒ゅ畾涔嬪悗搴旇烦鍒版湭璐垎鏀?
    assert i_waived < i_no_start, "START 宸茶喘鏂囨蹇呴』浣嶄簬鏈喘鍒嗘敮涔嬪墠"
    assert i_no_start < i_gate, "闂ㄦ鏂囨蹇呴』钀藉湪 START 鏈喘鍒嗘敮鍐?
    assert i_guard < i_gate, "闂ㄦ鏂囨鏈彈 START 鍒嗘敮淇濇姢锛堜細鏃犳潯浠舵樉绀猴級"
    assert sa.count("绗?1\\u201313 琛屾槸 Reality 鐨勯棬妲?) == 1, \\
        "闂ㄦ鏂囨閲嶅鍑虹幇锛屽彲鑳借鏃犳潯浠跺鐢?
    assert sa.count("鎴愬氨闂ㄦ宸茶绉婚櫎") == 1, "START 鍒嗘敮鏂囨缂哄け鎴栭噸澶?
    assert "涔版渶鍚庝竴涓?Time Study" not in sa, "鏈尯鍒?START 鐨勬棫闂ㄦ鏂囨浠嶅湪"

    r0 = _body(".method public static summaryR0()Ljava/lang/String;", sa)
    assert "StageAssist;->startPerk()Z" in r0, "R0 鍗＄墖鎽樿鏈樉绀?START 鐘舵€?
    assert "START perk 宸茶喘锛? in r0, "R0 鍗＄墖鎽樿缂哄皯 START 鐘舵€佹爣绛?
    note("[4c] START perk 涓€鑷存€ц嚜妫€閫氳繃锛坰tartPerk -> rf3.k()锛涢棬妲涙枃妗堜粎瀛樺湪浜庢湭璐垎鏀級")
'''

new = ANCHOR + BLOCK.replace("\n", "\r\n")
txt = txt.replace(ANCHOR, new)
P.write_bytes(txt.encode("utf-8"))
print("patched", P)
