# -*- coding: utf-8 -*-
"""决定论磁盘版重建 v2。
1) 用 .NET 权威字节对表精确复刻损坏变换（含字符位置映射）
2) 自检: python_sim(重放版) 必须 == 损坏备份(去BOM) —— 验证复刻正确
3) diff 出磁盘版插入片段 → 逆转回原文 → 按映射位置拼接
4) 金标准: simulate_corrupt(候选) 逐字节 == 损坏备份
用法: python reconstruct_v2.py <name> [--choices 8C,8E,B1] [--install]"""
import bisect, difflib, os, subprocess, sys

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

# ---------- 1) 加载 .NET CP936 表 ----------
PAIR = {}          # (lead,trail) -> char
CHAR2BYTES = {}    # char -> bytes (逆转编码用)
with open(os.path.join(S, "cp936_pairs.txt")) as f:
    for line in f:
        l, t, c = line.split()
        ch = chr(int(c))
        PAIR[(int(l), int(t))] = ch
        if ch not in CHAR2BYTES:
            CHAR2BYTES[ch] = bytes([int(l), int(t)])

TRAIL_OK = lambda b: 0x40 <= b <= 0x7E or 0x80 <= b <= 0xFE

def net_decode(data):
    """复刻 .NET CP936 解码。返回 (字符串, sim字符idx -> 源字节偏移 列表)。"""
    out = []
    src = []  # 每个输出字符的源起始字节偏移
    i, n = 0, len(data)
    while i < n:
        b = data[i]
        if b < 0x80:
            out.append(chr(b)); src.append(i); i += 1
        elif b == 0x80:
            out.append("\u20ac"); src.append(i); i += 1
        elif 0x81 <= b <= 0xFE:
            if i + 1 < n and TRAIL_OK(data[i+1]) and (b, data[i+1]) in PAIR:
                out.append(PAIR[(b, data[i+1])]); src.append(i); i += 2
            elif i + 1 < n:
                out.append("?"); src.append(i); i += 2
            else:
                out.append("?"); src.append(i); i += 1
        else:
            raise SystemExit(f"未预期的字节 {b:02X} @ {i}")
    return "".join(out), src

# ---------- 2) 自检 ----------
replayed_b = rd(os.path.join(S, "replayed", name + ".mjs"))
bak_b = rd(os.path.join(S, "web___tools__" + name + ".mjs"))
bak = bak_b.decode("utf-8")
bak_cmp = bak[1:] if bak.startswith("\ufeff") else bak

# 损坏时在字符串域做过路径替换；重放版可能仍含旧路径 → 先补做同样替换
base = replayed_b.decode("utf-8")
base = (base.replace("2026-10-24-00-34-44\\", "AD-Oreki-Unified\\web\\")
            .replace("2026-10-24-00-34-44", "AD-Oreki-Unified/web")
            .replace("2026-10-24-01-19-39\\", "AD-Oreki-Unified\\android\\")
            .replace("2026-10-24-01-19-39", "AD-Oreki-Unified/android"))
base_b = base.encode("utf-8")

py_sim, src_map = net_decode(base_b)
# 自检: 差异必须为纯插入（无 replace/delete），否则复刻有问题
_sm0 = difflib.SequenceMatcher(None, py_sim, bak_cmp, autojunk=False)
_pure = all(t in ("equal", "insert") for t, *_ in _sm0.get_opcodes())
if not _pure:
    for t, i1, i2, j1, j2 in _sm0.get_opcodes():
        if t not in ("equal", "insert"):
            print(f"自检失败: 非{t}操作 py[{i1}:{i2}]={py_sim[i1:i2][:60]!r} bak[{j1}:{j2}]={bak_cmp[j1:j2][:60]!r}")
            raise SystemExit(1)
print("自检通过: py复刻 与 损坏备份 的差异全部为纯插入")

# 重放版字符字节起点表
char_starts = [0]
for ch in replayed_b.decode("utf-8"):
    char_starts.append(char_starts[-1] + len(ch.encode("utf-8")))
replayed = base

def sim_pos_to_char_idx(sim_i):
    """sim 插入边界 sim_i → 重放版字符 idx（在该字符前插入）。"""
    if sim_i >= len(src_map):
        return len(replayed)
    byte_off = src_map[sim_i]
    return bisect.bisect_left(char_starts, byte_off) - 1 if byte_off in char_starts else None

# 用字节偏移直接找字符 idx
def sim_pos_to_char_idx2(sim_i):
    if sim_i >= len(src_map):
        return len(replayed)
    byte_off = src_map[sim_i]
    # char_starts 单调，找包含 byte_off 的字符
    j = bisect.bisect_right(char_starts, byte_off) - 1
    return j

# ---------- 3) diff 片段 + 逆转 ----------
sm = difflib.SequenceMatcher(None, py_sim, bak_cmp, autojunk=False)
frags = []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "insert" and bak_cmp[j1:j2] == "":
        continue
    if tag in ("insert", "replace"):
        frags.append((i1, i2, bak_cmp[j1:j2]))
print(f"插入/替换片段数: {len(frags)}")

def frag_to_original(frag):
    out = bytearray()
    hole_positions = []
    for ch in frag:
        cp = ord(ch)
        if ch == "?":
            hole_positions.append(len(out))
            out += b"\x00\x00"
        elif cp < 0x80:
            out.append(cp)
        elif cp == 0x20AC:
            out.append(0x80)
        else:
            b = CHAR2BYTES.get(ch)
            assert b is not None, f"逆转表缺 U+{cp:04X}"
            out += b
    # 填洞: [lead+cont][?=[第3续字节][0x20]]
    data = bytearray(out)
    for idx, hp in enumerate(hole_positions):
        b1, b2 = data[hp - 2], data[hp - 1]
        assert 0xE0 <= b1 <= 0xEF and 0x80 <= b2 <= 0xBF, f"洞{idx} 前结构异常 {b1:02X} {b2:02X}"
        if idx in hole_choices:
            h1 = hole_choices[idx]
        else:
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
    return bytes(data).decode("utf-8")

inserts = []  # (replayed_char_idx, original_text)
for i1, i2, frag in frags:
    text = frag_to_original(frag)
    cidx = sim_pos_to_char_idx2(i1)
    inserts.append((cidx, text))
    print(f"  sim@{i1} → 重放字符@{cidx}: {text[:60]!r}")

# ---------- 4) 拼接 ----------
result = replayed
for cidx, text in sorted(inserts, key=lambda x: -x[0]):
    result = result[:cidx] + text + result[cidx:]

cand_path = os.path.join(S, f"_cand_{name}.mjs")
with open(cand_path, "w", encoding="utf-8", newline="") as f:
    f.write(result)
print(f"候选文件: {cand_path} ({len(result.encode('utf-8'))} bytes)")

# ---------- 5) 金标准验证由外部 PowerShell 执行 ----------
print("下一步: simulate_corrupt 候选文件并与损坏备份逐字节比对")
