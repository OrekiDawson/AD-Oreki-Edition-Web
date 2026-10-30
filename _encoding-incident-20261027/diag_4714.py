# -*- coding: utf-8 -*-
"""逐行诊断：4714 行的调用提取链路。"""
import json, os

W = r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-24-00-34-44\40aa0eee-d96e-4765-a05b-d368ff7c43e5.jsonl"

def iter_calls(obj):
    if isinstance(obj, dict):
        if "name" in obj and "arguments" in obj and isinstance(obj.get("arguments"), str):
            yield obj
        for v in obj.values():
            yield from iter_calls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_calls(v)

with open(W, encoding="utf-8", errors="replace") as f:
    for i, line in enumerate(f, 1):
        if i != 4714:
            continue
        e = json.loads(line)
        calls = list(iter_calls(e))
        print(f"iter_calls 命中: {len(calls)}")
        for c in calls:
            print("  name:", c.get("name"), " callId:", c.get("callId"))
            try:
                args = json.loads(c["arguments"])
                print("  arguments 解析 OK, keys:", list(args.keys())[:6])
                print("  file_path:", args.get("file_path"))
                print("  content 长度:", len(args.get("content", "")))
                print("  content 前80:", args.get("content", "")[:80].replace("\n", "\\n"))
            except Exception as ex:
                print("  arguments 解析失败:", str(ex)[:200])
        break
