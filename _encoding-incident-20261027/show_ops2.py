# -*- coding: utf-8 -*-
"""对比 py_sim（复刻损坏）vs bak，输出全部非插入操作。"""
import difflib, os, sys

S = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
name = sys.argv[1]

PAIR = {}
with open(os.path.join(S, "cp936_pairs.txt")) as f:
    for line in f:
        l, t, c = line.split()
        PAIR[(int(l), int(t))] = chr(int(c))
TRAIL_OK = lambda b: 0x40 <= b <= 0x7E or 0x80 <= b <= 0xFE

def net_decode(data):
    out = []; i = 0; n = len(data)
    while i < n:
        b = data[i]
        if b < 0x80: out.append(chr(b)); i += 1
        elif b == 0x80: out.append("\u20ac"); i += 1
        elif 0x81 <= b <= 0xFE:
            if i + 1 < n and TRAIL_OK(data[i+1]) and (b, data[i+1]) in PAIR:
                out.append(PAIR[(b, data[i+1])]); i += 2
            elif i + 1 < n: out.append("?"); i += 2
            else: out.append("?"); i += 1
        else: raise SystemExit(f"byte {b:02X}@{i}")
    return "".join(out)

def rd(p):
    with open(p, "rb") as f: return f.read()

base = rd(os.path.join(S, "replayed", name + ".mjs")).decode("utf-8")
base = (base.replace("2026-10-24-00-34-44\\", "AD-Oreki-Unified\\web\\")
            .replace("2026-10-24-00-34-44", "AD-Oreki-Unified/web")
            .replace("2026-10-24-01-19-39\\", "AD-Oreki-Unified\\android\\")
            .replace("2026-10-24-01-19-39", "AD-Oreki-Unified/android"))
raw = rd(os.path.join(S, "web___tools__" + name + ".mjs")).decode("utf-8")
bak = raw[1:] if raw.startswith("\ufeff") else raw
py_sim = net_decode(base.encode("utf-8"))
sm = difflib.SequenceMatcher(None, py_sim, bak, autojunk=False)
n = 0
for t, i1, i2, j1, j2 in sm.get_opcodes():
    if t != "equal":
        n += 1
        print(f"[{t}] pysim@{i1} len{i2-i1} -> bak len{j2-j1}")
        print(f"  前: {py_sim[max(0,i1-70):i1]!r}")
        print(f"  旧: ◆{py_sim[i1:i2][:250]!r}◆")
        print(f"  新: ◆{bak[j1:j2][:250]!r}◆")
        print(f"  后: {bak[j2:j2+70]!r}")
        print()
print(f"非 equal 操作数: {n}")
