#!/usr/bin/env python3
"""R42-C：装机前判据 —— 直接从 APK 里核教程资产，不看界面。

team-lead 给的判据：CH 行数 = 应该渲染出来的章节数。
装机后界面「章节 N」必须等于 CH 行数；不等就是渲染层还有问题，不是资产问题。

用法：
    python _r42/apk_tut_asset_check.py <apk> [期望CH行数]
退出码 0 = 通过，1 = 不通过。
"""
import sys
import zipfile

EXPECT_CH_DEFAULT = 18
TAGS = ("CH", "TITLE", "SUB", "STAGE", "GOAL", "ENTRY", "STEP", "BUY", "AUTO",
        "CHAL", "NUM", "DONE", "NEXT", "TRAP", "TBL", "NOTE")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    apk = sys.argv[1]
    expect = int(sys.argv[2]) if len(sys.argv) > 2 else EXPECT_CH_DEFAULT

    z = zipfile.ZipFile(apk)
    names = [n for n in z.namelist() if n.endswith("oreki_tutorial.txt")]
    if not names:
        print(f"[FAIL] {apk} 里没有 assets/oreki_tutorial.txt")
        return 1
    raw = z.read(names[0])
    text = raw.decode("utf-8")
    lines = text.splitlines()

    ch = sum(1 for l in lines if l.startswith("CH|"))
    counts = {t: sum(1 for l in lines if l.startswith(t + "|")) for t in TAGS}
    cjk = sum(1 for c in text if "\u4e00" <= c <= "\u9fa5")

    print(f"apk      : {apk}")
    print(f"entry    : {names[0]}")
    print(f"字节     : {len(raw)}")
    print(f"行数     : {len(lines)}")
    print(f"CH 行数  : {ch}   (期望 {expect})")
    print(f"汉字     : {cjk}")
    print("标签分布 : " + "  ".join(f"{k}={v}" for k, v in counts.items() if v))

    # 一致性：TITLE/SUB/STAGE 应与 CH 同数
    for t in ("TITLE", "SUB", "STAGE"):
        if counts[t] != ch:
            print(f"[FAIL] {t}={counts[t]} 与 CH={ch} 不一致")
            return 1
    if ch != expect:
        print(f"[FAIL] CH 行数 {ch} != 期望 {expect}")
        return 1
    if cjk < 20000:
        print(f"[FAIL] 汉字数 {cjk} 明显偏少（<20000）")
        return 1
    print("[PASS] 资产层通过；装机后界面章节数必须等于 %d" % ch)
    return 0


if __name__ == "__main__":
    sys.exit(main())
