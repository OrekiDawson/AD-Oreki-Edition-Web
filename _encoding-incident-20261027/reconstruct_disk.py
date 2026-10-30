# -*- coding: utf-8 -*-
"""从小步闭环重建：磁盘版 = 重放版 + 插入片段（机械逆转损坏）。
验证金标准：sim(重建版) 必须与损坏备份逐字节相等。
用法: python reconstruct_disk.py <name> [--install]"""
import difflib, os, subprocess, sys

S = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
name = sys.argv[1]
install = "--install" in sys.argv
hole_choices = {}
if "--choices" in sys.argv:
    _cs = sys.argv[sys.argv.index("--choices") + 1].split(",")
    hole_choices = {i: int(c, 16) for i, c in enumerate(_cs)}

def rd(p):
    with open(p, "rb") as f:
        return f.read()

replayed_b = rd(os.path.join(S, "replayed", name + ".mjs"))
bak_b = rd(os.path.join(S, "web___tools__" + name + ".mjs"))
replayed = replayed_b.decode("utf-8")
bak = bak_b.decode("utf-8")
sim = rd(os.path.join(S, "_sim_" + name + ".bin")).decode("utf-8")

# 1) 找出 bak 相对 sim 的插入片段
sm = difflib.SequenceMatcher(None, sim, bak, autojunk=False)
frags = []  # (sim_pos, bak_fragment)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "insert" and bak[j1:j2] == "\ufeff":
        continue  # BOM 伪影
    if tag in ("insert", "replace"):
        frags.append((i1, i2, bak[j1:j2]))
print(f"插入/替换片段数: {len(frags)}")

# 2) 片段逆转：cp936 编码回字节（.NET 权威映射表），'?' 视为 2 字节空洞
CP936_MAP = {}
with open(os.path.join(S, "cp936_map.txt")) as _f:
    for _line in _f:
        _c, _l, _t = _line.split()
        CP936_MAP[int(_c)] = bytes([int(_l), int(_t)])

def frag_to_original(frag):
    holes = frag.count("?")
    out = bytearray()
    hole_positions = []
    for ch in frag:
        cp = ord(ch)
        if ch == "?":
            hole_positions.append(len(out))
            out += b"\x00\x00"  # 占位 2 字节
        elif cp < 0x80:
            out.append(cp)
        elif cp == 0x20AC:
            out.append(0x80)  # .NET CP936: 0x80 → U+20AC
        else:
            b = CP936_MAP.get(cp)
            assert b is not None, f"映射表缺字符 U+{cp:04X}"
            out += b
    assert len(hole_positions) == holes, f"?'数不匹配 {holes} vs {len(hole_positions)}"
    return bytes(out), hole_positions

def fill_holes(data, hole_positions, hole_choices=None):
    """机械填洞：空洞 = [汉字第3续字节][空格0x20]。
    hole_choices: {hole_index: cont_byte} 人工依据语义选定，最终由整文件 sim 验证裁决。"""
    data = bytearray(data)
    for idx, hp in enumerate(hole_positions):
        b1, b2 = data[hp - 2], data[hp - 1]
        if 0xE0 <= b1 <= 0xEF and 0x80 <= b2 <= 0xBF:
            # E0-EF 需 2 个续字节，已有 1 个 → 空洞第 1 字节 = 第 2 续字节
            if hole_choices and idx in hole_choices:
                h1 = hole_choices[idx]
            else:
                # 默认尝试：打印候选并要求指定
                cands = []
                for c in range(0x80, 0xC0):
                    try:
                        ch = bytes([b1, b2, c]).decode("utf-8")
                        cands.append(f"U+{ord(ch):04X} {ch}")
                    except UnicodeDecodeError:
                        pass
                raise SystemExit(f"洞{idx} 上下文 {b1:02X} {b2:02X} 候选: {' '.join(cands)}")
            data[hp] = h1
            data[hp + 1] = 0x20
        else:
            raise SystemExit(f"洞{idx} 前不是[lead+cont]结构: {b1:02X} {b2:02X} —— 需人工判断")
    return bytes(data)

reconstructed_frags = []
for i1, i2, frag in frags:
    raw, holes = frag_to_original(frag)
    if holes:
        raw = fill_holes(raw, holes, hole_choices)
    text = raw.decode("utf-8")  # 必须是合法 UTF-8
    reconstructed_frags.append((i1, text))
    print(f"  sim@{i1}: 还原片段 {len(text)} 字符: {text[:70]!r}")

# 3) 定位插入点：用 ASCII 锚点在 replayed 中顺序查找
result = replayed
cursor = 0  # 在 result 中的搜索起点
inserted = 0
for i1, text in reconstructed_frags:
    # sim 上下文锚点（ASCII 化）
    left = sim[max(0, i1 - 150):i1]
    right = sim[i1:i1 + 150]
    # 取 left 的最长 ASCII 后缀（至少 8 字符）
    L = ""
    for ch in reversed(left):
        if ord(ch) < 128 and ch != "\t":
            L = ch + L
        else:
            break
    R = ""
    for ch in right:
        if ord(ch) < 128 and ch != "\t":
            R += ch
        else:
            break
    # 特判：插入点若紧跟锚内（片段本身以 ASCII 开头），L 可能已包含片段开头
    # 找 L 在 result[cursor:] 中的位置
    pos = result.find(L, cursor)
    assert pos >= 0, f"锚点未找到: {L[:60]!r}"
    insert_at = pos + len(L)
    # 校验 R 也在插入点之后（若 R 非空且片段为纯 ASCII 插入，R 应在片段之后出现）
    result = result[:insert_at] + text + result[insert_at:]
    cursor = insert_at + len(text)
    inserted += 1
print(f"已插入 {inserted} 处")

# 4) 写候选文件
cand_path = os.path.join(S, f"_cand_{name}.mjs")
with open(cand_path, "w", encoding="utf-8", newline="") as f:
    f.write(result)
print(f"候选文件: {cand_path} ({len(result.encode('utf-8'))} bytes)")
