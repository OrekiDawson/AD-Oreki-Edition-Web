#!/usr/bin/env python3
"""R108-01 · 汇总 run-default/samples.jsonl → milestones / 节奏 / 停滞区间 / 资源表。

只读统计，不做任何判定性伪造；里程碑墙钟取「首次采到该状态」的 wall（采样 2s 粒度）。
"""
import json, sys, os
from collections import OrderedDict

OUT = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(OUT, os.environ.get("RUN_DIR", "run-default"))
S = os.path.join(RUN, "samples.jsonl")

def load():
    rows = []
    with open(S) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception as e:
                rows.append({"parse_error": str(e)})
    return rows

def lg(v):
    """把 'rmLog10' 之类的字段规范化成 float/None/'-inf'。"""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        if v in ("-Infinity", "NaN"):
            return float("-inf") if v == "-Infinity" else float("nan")
        try:
            return float(v)
        except Exception:
            return None
    return None

rows = [r for r in load() if "wall" in r]
if not rows:
    print("NO SAMPLES"); sys.exit(1)

MILESTONES = [
    ("firstReality", lambda r: (r.get("realities") or 0) >= 1),
    ("realities5", lambda r: (r.get("realities") or 0) >= 5),
    ("realities10", lambda r: (r.get("realities") or 0) >= 10),
    ("realities15", lambda r: (r.get("realities") or 0) >= 15),
    ("realities20", lambda r: (r.get("realities") or 0) >= 20),
    ("realities30", lambda r: (r.get("realities") or 0) >= 30),
    ("realities50", lambda r: (r.get("realities") or 0) >= 50),
    ("realities75", lambda r: (r.get("realities") or 0) >= 75),
    ("realities100", lambda r: (r.get("realities") or 0) >= 100),
    ("ep4000", lambda r: (r.get("maxEpExp") or 0) >= 4000),
    ("ruAllBought", lambda r: r.get("ruAll") is True),
    ("teresaUnlocked", lambda r: r.get("teresaUnl") is True),
    ("teresaPoured1e24", lambda r: (lg(r.get("teresaPouredLog10")) or -999) >= 24),
    ("effarigUnlocked", lambda r: r.get("teresaEffarig") is True),
    ("effarigStage2", lambda r: (r.get("effarigStage") or 0) >= 2),
    ("effarigStage3", lambda r: (r.get("effarigStage") or 0) >= 3),
    ("enslavedUnlocked", lambda r: r.get("enslavedUnl") is True),
    ("vUnlocked", lambda r: r.get("vUnl") is True),
    ("raUnlocked", lambda r: r.get("raUnl") is True),
    ("laitelaUnlocked", lambda r: r.get("laitelaUnl") is True),
    ("laitelaTier8", lambda r: (r.get("laitelaTier") or 0) >= 8),
    ("iu15", lambda r: r.get("iu15") is True),
    ("iu25", lambda r: r.get("iu25") is True),
    ("pelleUnlocked", lambda r: r.get("pelleUnl") is True),
    ("doomed", lambda r: r.get("doomed") is True),
    ("endState>=1", lambda r: (r.get("endState") or 0) >= 1),
    ("gameEnd", lambda r: r.get("gameEnd") is True),
]

marks = OrderedDict()
for name, pred in MILESTONES:
    for r in rows:
        try:
            if pred(r):
                marks[name] = r["wall"]
                break
        except Exception:
            continue

# 关键派生节奏
intervals = {}
prev = None
for r in rows:
    if prev is None:
        prev = r; continue
    if (r.get("realities") or 0) > (prev.get("realities") or 0):
        key = "r%s" % prev.get("realities")
        intervals.setdefault(key, []).append(round(r["wall"] - prev["wall"], 1))
    prev = r

# 每 60s 一行进度
sample_every60 = []
next_mark = 60
for r in rows:
    if r["wall"] >= next_mark:
        sample_every60.append({k: r.get(k) for k in
            ("wall","realities","rmLog10","ruCount","glyphsActive","glyphMaxLevel",
             "teresaPouredLog10","effarigStage","vUnl","laitelaUnl","laitelaTier",
             "iu15","iu25","pelleUnl","doomed","endState","pelleTotalAMLog10","stage","goal","speed","effInterval","imLog10")})
        next_mark += 60

# 停滞检测：某「进度指标」连续 > 120s 完全不变
def stall(metric, thr=120):
    out = []
    start = None; val = None
    for r in rows:
        v = r.get(metric)
        if v != val:
            if start is not None and val is not None and r["wall"] - start >= thr:
                out.append({"metric": metric, "from": start, "to": r["wall"], "seconds": round(r["wall"] - start, 1), "stuckAt": val, "stage": r.get("stage")})
            start = r["wall"]; val = v
    if start is not None and val is not None and rows[-1]["wall"] - start >= thr:
        out.append({"metric": metric, "from": start, "to": rows[-1]["wall"], "seconds": round(rows[-1]["wall"] - start, 1), "stuckAt": val, "stage": rows[-1].get("stage")})
    return out

stalls = []
for m in ("realities", "rmLog10", "glyphsActive", "teresaPouredLog10", "teresaUnl", "laitelaTier", "iu15", "iu25", "pelleUnl", "endState"):
    stalls += stall(m)

# 配置审计：实际生效节拍 / 速度变化
speeds = []
prev_speed = None
for r in rows:
    if r.get("speed") != prev_speed:
        speeds.append({"wall": r["wall"], "speed": r.get("speed"), "dynamic": r.get("dynamic")})
        prev_speed = r.get("speed")
effs = OrderedDict()
for r in rows:
    k = str(r.get("effInterval"))
    effs.setdefault(k, r["wall"])

summary = {}
sp = os.path.join(RUN, "summary.json")
if os.path.exists(sp):
    summary = json.load(open(sp))

out = {
    "source": S,
    "out": OUT,
    "samples": len(rows),
    "observedWallSec": rows[-1]["wall"],
    "configAudit": {
        "configuredIntervalSeen": sorted(set(str(r.get("cfgInterval")) for r in rows)),
        "effectiveIntervalFirstSeen": effs,
        "speedChanges": speeds,
        "injected": {"interval": False, "speed": False, "dynamicSpeed": "default(true)"},
    },
    "milestones": marks,
    "realityIntervalSecDistribution": {k: (min(v), max(v), len(v)) for k, v in list(intervals.items())[:40]},
    "gapBetweenRealities": intervals,
    "progressEvery60s": sample_every60,
    "stallsOver120s": stalls,
    "finalState": rows[-1],
    "runnerSummaryStatus": summary.get("status"),
    "pageErrors": summary.get("pageErrors"),
    "consoleErrors": (summary.get("consoleErrors") or [])[:5],
}
with open(os.path.join(OUT, "analysis.json"), "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print("samples=%d wall=%.1fs" % (len(rows), rows[-1]["wall"]))
print("milestones:", json.dumps(marks, ensure_ascii=False))
print("config:", json.dumps(out["configAudit"], ensure_ascii=False))
print("stalls>120s:", json.dumps(stalls[:12], ensure_ascii=False))
print("final:", json.dumps({k: rows[-1].get(k) for k in
      ("wall","realities","rmLog10","ruCount","glyphsActive","teresaUnl","teresaPouredLog10",
       "effarigStage","vUnl","laitelaUnl","laitelaTier","iu15","iu25","pelleUnl","doomed",
       "endState","gameEnd","pelleTotalAMLog10","stage","goal")}, ensure_ascii=False))
