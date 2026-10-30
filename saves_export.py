# -*- coding: utf-8 -*-
"""导出全部存档的时间字段快照（只读），供 Node 侧口径测试使用。"""
import json
import os
from saves_common import OUT, open_zip, decode_save, get, num

FIELDS = [
    ("totalTimePlayed", ("records", "totalTimePlayed")),
    ("realTimePlayed", ("records", "realTimePlayed")),
    ("thisInfinity.time", ("records", "thisInfinity.time")),
    ("thisInfinity.realTime", ("records", "thisInfinity.realTime")),
    ("bestInfinity.time", ("records", "bestInfinity.time")),
    ("bestInfinity.realTime", ("records", "bestInfinity.realTime")),
    ("thisEternity.time", ("records", "thisEternity.time")),
    ("thisEternity.realTime", ("records", "thisEternity.realTime")),
    ("bestEternity.time", ("records", "bestEternity.time")),
    ("bestEternity.realTime", ("records", "bestEternity.realTime")),
    ("thisReality.time", ("records", "thisReality.time")),
    ("thisReality.realTime", ("records", "thisReality.realTime")),
    ("bestReality.time", ("records", "bestReality.time")),
    ("bestReality.realTime", ("records", "bestReality.realTime")),
]


def main():
    zf = open_zip()
    names = sorted(n for n in zf.namelist() if n.startswith("anti2/") and n.endswith(".txt"))
    out = []
    for name in names:
        p, _ = decode_save(zf.read(name).decode("utf-8", "replace"))
        row = {"name": os.path.basename(name)}
        for key, path in FIELDS:
            row[key] = num(get(p, ".".join(path)))
        for k in ["recentInfinities", "recentEternities", "recentRealities"]:
            arr = get(p, "records." + k) or []
            first = arr[0] if arr and isinstance(arr[0], list) else None
            row[k] = {
                "len": len(arr),
                "rowlen": len(first) if first else 0,
                "t0": num(first[0]) if first else None,
                "t1": num(first[1]) if first else None,
            }
        out.append(row)
    dst = os.path.join(OUT, "time_records.json")
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print("写出", dst, len(out), "条")


if __name__ == "__main__":
    main()
