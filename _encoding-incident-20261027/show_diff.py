# -*- coding: utf-8 -*-
"""提取磁盘版(损坏备份)相对重放版模拟的独有区域。"""
import difflib, sys

S = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
name = sys.argv[1] if len(sys.argv) > 1 else "verify-time-ui"

def rd(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()

sim = rd(S + r"\_sim_" + name + ".bin")
bak = rd(S + r"\web___tools__" + name + ".mjs")

sm = difflib.SequenceMatcher(None, sim, bak, autojunk=False)
n_ins = 0
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag in ("insert", "replace"):
        frag = bak[j1:j2]
        n_ins += 1
        print(f"--- [{tag}] sim[{i1}:{i2}] -> bak[{j1}:{j2}] ({j2-j1} chars) ---")
        print(frag[:1500])
        if j2 - j1 > 1500:
            print(f"...(共 {j2-j1} 字符)")
print(f"\n== 磁盘版独有区域数: {n_ins} ==")
