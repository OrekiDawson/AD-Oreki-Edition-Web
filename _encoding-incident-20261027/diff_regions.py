# -*- coding: utf-8 -*-
"""对比 sim(R) 与损坏备份 B'，提取磁盘版独有的内容区域，
并将该区域的 mojibake 恢复为可读文本（'?' 表示丢失字节）。"""
import os, subprocess

INC = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
REP = os.path.join(INC, "replayed")
SIM = os.path.join(INC, "simulate_corrupt.ps1")

def load_backup(base):
    for fn in os.listdir(INC):
        if fn.endswith((".mjs", ".py")) and "__" in fn and fn.split("__")[-1] == base:
            d = open(os.path.join(INC, fn), "rb").read()
            return d[3:] if d.startswith(b"\xef\xbb\xbf") else d
    return None

def sim_corrupt(path):
    out = os.path.join(INC, "_sim.bin")
    subprocess.run(["powershell","-NoProfile","-File",SIM,"-InFile",path,"-OutFile",out],
                   capture_output=True)
    d = open(out,"rb").read()
    return d[3:] if d.startswith(b"\xef\xbb\xbf") else d

def region_diff(a, b, ctx=60):
    """返回 (first_diff, a_end, b_end)：从尾部对齐找公共后缀，中间即差异区。"""
    n = min(len(a), len(b))
    first = next((i for i in range(n) if a[i] != b[i]), n)
    # 公共后缀
    s = 0
    while s < n - first and a[len(a)-1-s] == b[len(b)-1-s]:
        s += 1
    return first, len(a)-s, len(b)-s

def readable(b_bytes):
    """把损坏字节(UTF-8 of mojibake)恢复为可读：char→CP936字节→按UTF-8尽力解码。"""
    s = b_bytes.decode("utf-8")
    enc = "".join(chr(ord(c)) for c in s)
    out = []
    buf = bytearray()
    # 逐字符编码到 CP936 字节流（'?' 保留为占位），再按 UTF-8 解码并标记洞
    raw = bytearray()
    holes = []
    for c in s:
        if c == "?":
            holes.append(len(raw))
            raw.append(0xFF)  # 临时占位
        else:
            try:
                raw += c.encode("cp936")
            except Exception:
                raw += c.encode("utf-8")  # PUA 等无法编码——罕见，标记
                holes.append(None)
    # 尝试 UTF-8 解码，遇占位 0xFF 时跳过并输出 ◊
    i = 0
    res = []
    while i < len(raw):
        b = raw[i]
        if b == 0xFF:
            res.append("◊"); i += 1; continue
        ln = 1
        if b >= 0xF0: ln = 4
        elif b >= 0xE0: ln = 3
        elif b >= 0xC0: ln = 2
        chunk = raw[i:i+ln]
        try:
            res.append(chunk.decode("utf-8"))
            i += ln
        except Exception:
            res.append(f"<{b:02X}>"); i += 1
    return "".join(res)

for base in ["verify-async-cleanup.mjs", "verify-time-dynamics.mjs", "verify-time-ui.mjs",
             "verify-time-equivalence.mjs", "verify-time-rupg.mjs", "verify-time-enslaved.mjs",
             "verify-automator-import-adopt.mjs", "verify-doomed-speed-parity.mjs",
             "verify-pelle-buymax.mjs", "verify-community-scripts-compat.mjs"]:
    bak = load_backup(base)
    rep = os.path.join(REP, base)
    if bak is None:
        print(f"### {base}: 无备份"); continue
    sim = sim_corrupt(rep)
    first, a_end, b_end = region_diff(sim, bak)
    if first >= min(len(sim), len(bak)) and len(sim) == len(bak):
        print(f"### {base}: 一致"); continue
    print(f"### {base}: sim[{first}:{a_end}] bak[{first}:{b_end}] (sim尾部={a_end-first}B, bak独有={b_end-first}B)")
    # 损坏备份的独有区域 → 可读
    reg = readable(bak[first:b_end])
    print("--- 磁盘版独有区域（◊=丢失字节, <XX>=未解码字节）---")
    print(reg[:3000])
    print()
