# -*- coding: utf-8 -*-
"""检测 transcript 行 JSON 解析失败率，定位重放遗漏原因。"""
import json

W = r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-24-00-34-44\40aa0eee-d96e-4765-a05b-d368ff7c43e5.jsonl"
bad = 0; total = 0; badlines = []
line4714 = None
with open(W, encoding="utf-8", errors="replace") as f:
    for i, line in enumerate(f, 1):
        total += 1
        if i == 4714:
            line4714 = line
        try:
            json.loads(line)
        except Exception as e:
            bad += 1
            if len(badlines) < 5:
                badlines.append((i, str(e)[:150], len(line)))
print(f"总行数={total} 解析失败={bad}")
for b in badlines:
    print("  ", b)
if line4714 is not None:
    try:
        json.loads(line4714)
        print("4714: 解析OK")
    except Exception as e:
        print("4714: 解析失败:", str(e)[:300])
