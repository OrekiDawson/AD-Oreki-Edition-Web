# -*- coding: utf-8 -*-
"""查看磁盘版相对重放版的全部非插入差异上下文。"""
import difflib, os, sys

S = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
name = sys.argv[1]

def rd(p):
    with open(p, "rb") as f:
        return f.read()

base = rd(os.path.join(S, "replayed", name + ".mjs")).decode("utf-8")
base = (base.replace("2026-10-24-00-34-44\\", "AD-Oreki-Unified\\web\\")
            .replace("2026-10-24-00-34-44", "AD-Oreki-Unified/web")
            .replace("2026-10-24-01-19-39\\", "AD-Oreki-Unified\\android\\")
            .replace("2026-10-24-01-19-39", "AD-Oreki-Unified/android"))
raw = rd(os.path.join(S, "web___tools__" + name + ".mjs")).decode("utf-8")
bak = raw[1:] if raw.startswith("\ufeff") else raw
sm = difflib.SequenceMatcher(None, base, bak, autojunk=False)
n = 0
for t, i1, i2, j1, j2 in sm.get_opcodes():
    if t != "equal":
        n += 1
        print(f"[{t}] base@{i1} len{i2-i1} -> bak len{j2-j1}")
        print(f"  前: {base[max(0,i1-70):i1]!r}")
        print(f"  旧: ◆{base[i1:i2][:200]!r}◆")
        print(f"  新: ◆{bak[j1:j2][:200]!r}◆")
        print(f"  后: {bak[j2:j2+70]!r}")
        print()
print(f"非 equal 操作数: {n}")
