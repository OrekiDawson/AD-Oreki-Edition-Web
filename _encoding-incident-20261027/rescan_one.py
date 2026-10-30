# -*- coding: utf-8 -*-
"""重扫描 transcript，输出 verify-async-cleanup.mjs 的全部捕获操作明细。"""
import json, os

W_DIR = r"C:\Users\Oreki\.workbuddy\projects"
TARGET = "verify-async-cleanup.mjs"

def iter_calls(obj):
    if isinstance(obj, dict):
        if "name" in obj and "arguments" in obj and isinstance(obj.get("arguments"), str):
            yield obj
        for v in obj.values():
            yield from iter_calls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_calls(v)

for tdir in sorted(os.listdir(W_DIR)):
    p = os.path.join(W_DIR, tdir)
    if not os.path.isdir(p):
        continue
    for fn in sorted(os.listdir(p)):
        if not fn.endswith(".jsonl"):
            continue
        full = os.path.join(p, fn)
        n = 0
        with open(full, encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f, 1):
                if '"Write"' not in line and '"Edit"' not in line and '"MultiEdit"' not in line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    print(f"  [JSON解析失败] {tdir}/{fn}:{i}")
                    continue
                for c in iter_calls(e):
                    try:
                        args = json.loads(c["arguments"])
                    except Exception as ex:
                        if os.path.basename(str(c)) == TARGET or TARGET in c.get("arguments", "")[:2000]:
                            print(f"  [args解析失败] {tdir}/{fn}:{i} name={c.get('name')} err={str(ex)[:100]}")
                        continue
                    if os.path.basename(str(args.get("file_path", ""))) == TARGET:
                        n += 1
                        clen = len(args.get("content", ""))
                        oldlen = len(args.get("old_string", ""))
                        print(f"  HIT {tdir}/{fn}:{i} {c.get('name')} content={clen} old={oldlen} lineNo={i}")
        if n:
            print(f"→ {tdir}/{fn}: {n} ops")
