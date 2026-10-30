# -*- coding: utf-8 -*-
"""有界扫描：为 3 个目标文件寻找可信恢复来源。
只找：Write/Edit/Bash 调用 + Read 结果快照。带时间戳输出摘要。"""
import json, os, re

TARGETS = ["verify-time-ui.mjs", "verify-time-dynamics.mjs", "verify-async-cleanup.mjs"]
TSET = set(TARGETS)

PDIR = r"C:\Users\Oreki\.workbuddy\projects"
TRANSCRIPT_DIRS = [
    "c-Users-Oreki-WorkBuddy-2026-10-16-17-46-55",
    "c-Users-Oreki-WorkBuddy-2026-10-24-00-34-44",
    "c-Users-Oreki-WorkBuddy-2026-10-24-01-19-39",
    "c-Users-Oreki-WorkBuddy-2026-10-26-23-25-57",
    "c-Users-Oreki-WorkBuddy-2026-10-27-16-56-11",
]

def iter_calls(obj):
    if isinstance(obj, dict):
        if "name" in obj and isinstance(obj.get("arguments"), str):
            yield obj
        for v in obj.values():
            yield from iter_calls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_calls(v)

# 找 tool_result：结构探测用宽松策略——任何 dict 含 "content" 字符串且提及目标文件路径
def iter_results(obj):
    if isinstance(obj, dict):
        c = obj.get("content")
        if isinstance(c, str) and len(c) > 200:
            yield c
        elif isinstance(c, list):
            for v in c:
                if isinstance(v, dict) and isinstance(v.get("text"), str):
                    yield v["text"]
        for v in obj.values():
            yield from iter_results(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_results(v)

events = {t: [] for t in TARGETS}
snapshots = {t: [] for t in TARGETS}

for td in TRANSCRIPT_DIRS:
    d = os.path.join(PDIR, td)
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".jsonl"):
            continue
        p = os.path.join(d, fn)
        with open(p, encoding="utf-8", errors="replace") as f:
            for line in f:
                # 快速预筛
                hit = [t for t in TARGETS if t in line]
                if not hit:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                ts = str(e.get("timestamp", ""))[:19]
                for call in iter_calls(e):
                    args = call["arguments"]
                    for t in hit:
                        if t in args:
                            name = call["name"]
                            size = len(args)
                            events[t].append((ts, fn[:8], name, size, args))
                for content in iter_results(e):
                    for t in hit:
                        # Read 快照特征：内容含文件路径或 cat -n 格式且较长
                        if (t in content) and len(content) > 1500 and ("     1\t" in content or "     1 " in content):
                            snapshots[t].append((ts, fn[:8], len(content), content))

OUT = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027\source_scan"
os.makedirs(OUT, exist_ok=True)
for t in TARGETS:
    print(f"===== {t} =====")
    print(f"  工具调用: {len(events[t])} 条；Read快照: {len(snapshots[t])} 份")
    for ts, src, name, size, _ in sorted(events[t]):
        print(f"    {ts} {src} {name:8s} args={size}")
    for ts, src, size, content in sorted(snapshots[t]):
        print(f"    SNAP {ts} {src} len={size}")
    # 保存详情
    with open(os.path.join(OUT, t + ".calls.txt"), "w", encoding="utf-8") as f:
        for ts, src, name, size, args in sorted(events[t]):
            f.write(f"\n########## {ts} {src} {name} ({size} chars) ##########\n")
            f.write(args if name == "Bash" else args[:20000])
    for i, (ts, src, size, content) in enumerate(sorted(snapshots[t])):
        with open(os.path.join(OUT, f"{t}.snap-{ts.replace(':','')}-{i}.txt"), "w", encoding="utf-8") as f:
            f.write(content)
print("\n明细已保存到", OUT)
