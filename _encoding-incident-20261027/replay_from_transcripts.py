# -*- coding: utf-8 -*-
"""从旧会话 transcript 重放 Write/Edit/MultiEdit，重建 2026-10-27 编码事故损坏的脚本内容。"""
import json, os

targets = ["baseline-progression.mjs","cmp-key-files.mjs","cmp-official-steam.mjs",
 "diag-ad-bulk.mjs","diag-automator-pass.mjs","diag-dimboost-galaxy.mjs",
 "exp-autobuyer-blocked.mjs","exp-autobuyer-candidates2.mjs","exp-autobuyer-scaling.mjs",
 "exp-automator-cadence.mjs","exp-bulk-ab.mjs","exp-decision-granularity.mjs",
 "exp-idtd-ab.mjs","exp-microstep-proto.mjs","exp-ra-memory.mjs","exp-refresh-rate.mjs",
 "exp-target-ab.mjs","probe-async-cadence.mjs","probe-async-singlebatch.mjs",
 "probe-offline-deep.mjs","probe-offline.mjs","probe-progression.mjs",
 "saves_analyze.py","saves_common.py","saves_inventory.py","trace-rebuild.mjs",
 "verify-async-cleanup.mjs","verify-automator-import-adopt.mjs","verify-automator-import-ui.mjs",
 "verify-automator-wait-hang.mjs","verify-community-scripts-compat.mjs",
 "verify-community-scripts-runtime.mjs","verify-doomed-speed-parity.mjs",
 "verify-live-tickspeed.mjs","verify-pelle-buymax.mjs","verify-time-dynamics.mjs",
 "verify-time-enslaved.mjs","verify-time-equivalence.mjs","verify-time-rupg.mjs","verify-time-ui.mjs",
 "patch_build_assert.py","patch_stage_start.py","map_js_time_achievements.py"]
tset = set(targets)

transcripts = [
 r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-16-17-46-55",
 r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-24-00-34-44",
 r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-24-01-19-39",
 r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-26-23-25-57",
 r"C:\Users\Oreki\.workbuddy\projects\c-Users-Oreki-WorkBuddy-2026-10-27-16-56-11",
]

def iter_calls(obj):
    if isinstance(obj, dict):
        if "name" in obj and "arguments" in obj and isinstance(obj.get("arguments"), str):
            yield obj
        for v in obj.values():
            yield from iter_calls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_calls(v)

ops = {k: [] for k in targets}
seen = set()
for tdir in transcripts:
    for fn in sorted(os.listdir(tdir)):
        if not fn.endswith(".jsonl"):
            continue
        with open(os.path.join(tdir, fn), encoding="utf-8", errors="replace") as f:
            for line in f:
                if '"Write"' not in line and '"Edit"' not in line and '"MultiEdit"' not in line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                for call in iter_calls(e):
                    cid = call.get("callId")
                    if cid:
                        if cid in seen:
                            continue
                        seen.add(cid)
                    name = call["name"]
                    if name not in ("Write", "Edit", "MultiEdit"):
                        continue
                    try:
                        args = json.loads(call["arguments"])
                    except Exception:
                        continue
                    base = os.path.basename(str(args.get("file_path", "")))
                    if base in tset:
                        ops[base].append((name, args))

def apply_ops(ops_list):
    content = None
    warn = []
    for name, args in ops_list:
        if name == "Write":
            content = args.get("content", "")
        elif content is None:
            warn.append(name + "-before-Write")
        elif name == "Edit":
            old = args.get("old_string", ""); new = args.get("new_string", "")
            if args.get("replace_all"):
                if old in content:
                    content = content.replace(old, new)
                else:
                    warn.append("Edit-miss")
            else:
                idx = content.find(old)
                if idx >= 0:
                    content = content[:idx] + new + content[idx + len(old):]
                else:
                    warn.append("Edit-miss")
        elif name == "MultiEdit":
            for ed in args.get("edits", []):
                old = ed.get("old_string", ""); new = ed.get("new_string", "")
                if ed.get("replace_all"):
                    content = content.replace(old, new)
                else:
                    idx = content.find(old)
                    if idx >= 0:
                        content = content[:idx] + new + content[idx + len(old):]
                    else:
                        warn.append("MultiEdit-miss")
    return content, warn

outdir = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027\replayed"
os.makedirs(outdir, exist_ok=True)
saved = 0
print("=== 重放报告 ===")
for k in targets:
    content, warn = apply_ops(ops[k])
    flag = "OK  " if content is not None else "MISS"
    print(f"{flag} ops={len(ops[k]):3d} {k}" + (f"  warn={warn[:3]}" if warn else ""))
    if content is not None:
        with open(os.path.join(outdir, k), "w", encoding="utf-8", newline="") as f:
            f.write(content)
        saved += 1
print(f"保存重放内容: {saved}/{len(targets)}")
