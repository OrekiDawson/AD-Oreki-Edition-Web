# -*- coding: utf-8 -*-
"""通用算子重放重建 v3。
equal→继承 base；insert/replace→bak 侧逆转为原文；delete→删除。
空洞需 --choices-file JSON: {"frag_idx/hole_idx": "8C"} 或逐洞枚举。
用法: python reconstruct_v3.py <name> [--choices-file f.json] [--install]"""
import bisect, difflib, json, os, sys

S = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
name = sys.argv[1]
install = "--install" in sys.argv
choices_file = None
if "--choices-file" in sys.argv:
    choices_file = sys.argv[sys.argv.index("--choices-file") + 1]
choices = {}
if choices_file and os.path.exists(choices_file):
    choices = {int(k): int(v, 16) for k, v in json.load(open(choices_file)).items()}

PAIR = {}
CHAR2BYTES = {}
with open(os.path.join(S, "cp936_pairs.txt")) as f:
    for line in f:
        l, t, c = line.split()
        ch = chr(int(c))
        PAIR[(int(l), int(t))] = ch
        CHAR2BYTES.setdefault(ch, bytes([int(l), int(t)]))
TRAIL_OK = lambda b: 0x40 <= b <= 0x7E or 0x80 <= b <= 0xFE

def net_decode(data):
    out = []; src = []; i = 0; n = len(data)
    while i < n:
        b = data[i]
        if b < 0x80: out.append(chr(b)); src.append(i); i += 1
        elif b == 0x80: out.append("\u20ac"); src.append(i); i += 1
        elif 0x81 <= b <= 0xFE:
            if i + 1 < n and TRAIL_OK(data[i+1]) and (b, data[i+1]) in PAIR:
                out.append(PAIR[(b, data[i+1])]); src.append(i); i += 2
            elif i + 1 < n: out.append("?"); src.append(i); i += 2
            else: out.append("?"); src.append(i); i += 1
        else: raise SystemExit(f"byte {b:02X}@{i}")
    return "".join(out), src

def rd(p):
    with open(p, "rb") as f: return f.read()

base = rd(os.path.join(S, "replayed", name + ".mjs")).decode("utf-8")
base = (base.replace("2026-10-24-00-34-44\\", "AD-Oreki-Unified\\web\\")
            .replace("2026-10-24-00-34-44", "AD-Oreki-Unified/web")
            .replace("2026-10-24-01-19-39\\", "AD-Oreki-Unified\\android\\")
            .replace("2026-10-24-01-19-39", "AD-Oreki-Unified/android"))
raw = rd(os.path.join(S, "web___tools__" + name + ".mjs")).decode("utf-8")
bak = raw[1:] if raw.startswith("\ufeff") else raw
py_sim, src_map = net_decode(base.encode("utf-8"))

char_starts = [0]
for ch in base:
    char_starts.append(char_starts[-1] + len(ch.encode("utf-8")))

def sim_pos_to_char_idx(sim_i):
    if sim_i >= len(src_map):
        return len(base)
    return bisect.bisect_right(char_starts, src_map[sim_i]) - 1

def bak_to_original(frag, frag_id):
    """bak 域文本 → 原文字符串。返回 (text, holes_info)。"""
    out = bytearray(); holes = []
    for ch in frag:
        cp = ord(ch)
        if ch == "?":
            holes.append(len(out)); out += b"\x00\x00"
        elif cp < 0x80: out.append(cp)
        elif cp == 0x20AC: out.append(0x80)
        else:
            b = CHAR2BYTES.get(ch)
            assert b is not None, f"逆转表缺 U+{cp:04X}"
            out += b
    data = bytearray(out)
    for idx, hp in enumerate(holes):
        key = frag_id * 1000 + idx
        b1, b2 = data[hp - 2], data[hp - 1]
        if key in choices:
            data[hp] = choices[key]; data[hp + 1] = 0x20
            continue
        if 0xE0 <= b1 <= 0xEF and 0x80 <= b2 <= 0xBF:
            cands = []
            for c in range(0x80, 0xC0):
                try:
                    ch2 = bytes([b1, b2, c]).decode("utf-8")
                    cands.append(f"{c:02X}={ch2}")
                except UnicodeDecodeError:
                    pass
            ctx = data[max(0,hp-30):hp].decode("utf-8", errors="replace")
            after = data[hp+2:hp+30].decode("utf-8", errors="replace")
            print(f"洞 frag{frag_id}#{idx} key={key} 前={ctx!r} 后={after!r}")
            print(f"  候选: {' '.join(cands)}")
            raise SystemExit("需要 --choices-file")
        else:
            ctx = data[max(0,hp-30):hp].decode("utf-8", errors="replace")
            after = data[hp+2:hp+30].decode("utf-8", errors="replace")
            print(f"洞 frag{frag_id}#{idx} key={key} 非标准结构 前={ctx!r} 后={after!r} b1={b1:02X} b2={b2:02X}")
            raise SystemExit("需要人工分析")
    return bytes(data).decode("utf-8")

sm = difflib.SequenceMatcher(None, py_sim, bak, autojunk=False)
ops = list(sm.get_opcodes())
result = []
base_cursor = 0        # base 字符游标
insert_plan = []       # (char_idx, text) — 插入与替换统一处理
deletes = []           # (start, end)
for fid, (t, i1, i2, j1, j2) in enumerate(ops):
    if t == "equal":
        continue
    if t == "delete":
        deletes.append((i1, i2))
        continue
    # insert / replace: bak 侧文本在 sim 边界 i1 插入（replace 时 base 侧 i1:i2 删除）
    text = bak_to_original(bak[j1:j2], fid)
    cidx = sim_pos_to_char_idx(i1)
    insert_plan.append((cidx, text))
    if t == "replace":
        deletes.append((i1, i2))

# 应用：先删（按 base 坐标），后插（从后往前）
del_sets = sorted(deletes, key=lambda x: -x[0])
result = base
for s, e in del_sets:
    cs = sim_pos_to_char_idx(s); ce = sim_pos_to_char_idx(e)
    result = result[:cs] + result[ce:]
# 插入坐标基于原 base —— 删除后错位。改为统一构建：
pieces = []
prev = 0
events = []
for s, e in deletes:
    events.append((sim_pos_to_char_idx(s), sim_pos_to_char_idx(e), ""))
for cidx, text in insert_plan:
    events.append((cidx, cidx, text))
events.sort(key=lambda x: (x[0], x[1]))
pos = 0
outp = []
for a, b, text in events:
    outp.append(base[pos:a])
    outp.append(text)
    pos = max(pos, b)
outp.append(base[pos:])
result = "".join(outp)

cand_path = os.path.join(S, f"_cand_{name}.mjs")
with open(cand_path, "w", encoding="utf-8", newline="") as f:
    f.write(result)
print(f"候选: {cand_path} {len(result.encode('utf-8'))} bytes（{len(events)} 个事件）")
