# -*- coding: utf-8 -*-
"""按进度/结构分层 + 选取代表性样本（只读，样本复制到 _saves/samples）。"""
import json
import os
from saves_common import (ZIP, OUT, open_zip, decode_save, get, num, SENTINEL)

SAMPLES = os.path.join(OUT, "samples")


def stage_of(p):
    rec = p.get("records", {})
    if num(get(rec, "bestReality.time")) is not None and get(rec, "bestReality.time") < SENTINEL:
        return "reality"
    if num(get(rec, "bestEternity.time")) is not None and get(rec, "bestEternity.time") < SENTINEL:
        return "eternity"
    if num(get(rec, "bestInfinity.time")) is not None and get(rec, "bestInfinity.time") < SENTINEL:
        return "infinity"
    return "pre-infinity"


def main():
    os.makedirs(SAMPLES, exist_ok=True)
    zf = open_zip()
    names = sorted(n for n in zf.namelist() if n.startswith("anti2/") and n.endswith(".txt"))
    rows = []
    for name in names:
        text = zf.read(name).decode("utf-8", "replace")
        try:
            p, meta = decode_save(text)
        except Exception as e:
            rows.append({"name": os.path.basename(name), "decode_error": repr(e)})
            continue
        rec = p.get("records", {})
        r = {
            "name": os.path.basename(name),
            "zipname": name,
            "version": p.get("version"),
            "stage": stage_of(p),
            "realities": p.get("realities") if isinstance(p.get("realities"), (int, float)) else None,
            "totalTimePlayed": num(rec.get("totalTimePlayed")),
            "realTimePlayed": num(rec.get("realTimePlayed")),
            "bestInfinity.time": num(get(rec, "bestInfinity.time")),
            "bestInfinity.realTime": num(get(rec, "bestInfinity.realTime")),
            "bestEternity.time": num(get(rec, "bestEternity.time")),
            "bestEternity.realTime": num(get(rec, "bestEternity.realTime")),
            "bestReality.time": num(get(rec, "bestReality.time")),
            "bestReality.realTime": num(get(rec, "bestReality.realTime")),
            "thisReality.time": num(get(rec, "thisReality.time")),
            "thisReality.realTime": num(get(rec, "thisReality.realTime")),
            "recentInfinities.len": len(rec.get("recentInfinities") or []),
            "recentEternities.len": len(rec.get("recentEternities") or []),
            "recentRealities.len": len(rec.get("recentRealities") or []),
            "recentRealities.rowlen": len((rec.get("recentRealities") or [[]])[0]),
            "recentEternities.rowlen": len((rec.get("recentEternities") or [[]])[0]),
            "dilationUnlocked": bool(p.get("dilation", {}).get("unlocked")) if isinstance(p.get("dilation"), dict) else False,
            "dilationActive": bool(p.get("dilation", {}).get("active")) if isinstance(p.get("dilation"), dict) else False,
            "enslavedStored": num(get(p, "celestials.enslaved.stored")),
            "hasPelleDoomed": bool(get(p, "celestials.pelle.doomed")),
            "speedrunActive": bool(get(p, "speedrun.hasStarted")),
        }
        if r["bestReality.time"] and r["bestReality.realTime"]:
            r["ratio"] = r["bestReality.time"] / r["bestReality.realTime"]
        else:
            r["ratio"] = None
        rows.append(r)

    ok = [r for r in rows if "stage" in r]
    print("解码成功:", len(ok), " 失败:", len(rows) - len(ok))
    dist = {}
    for r in ok:
        dist[r["stage"]] = dist.get(r["stage"], 0) + 1
    print("进度分层:", json.dumps(dist, ensure_ascii=False))

    print("\n=== 最近记录行长度分布 ===")
    for k in ["recentRealities.rowlen", "recentEternities.rowlen",
              "recentRealities.len", "recentInfinities.len"]:
        d = {}
        for r in ok:
            d[str(r[k])] = d.get(str(r[k]), 0) + 1
        print(f"  {k}: {dict(sorted(d.items(), key=lambda x: int(x[0])))}")

    print("\n=== 异常/边界 ===")
    print("  bestReality.time 为哨兵但有 realities>0:",
          sum(1 for r in ok if r["stage"] == "reality" and False))
    print("  realities>0 但 bestReality.time 仍为哨兵:",
          sum(1 for r in ok if (r["realities"] or 0) > 0 and (r["bestReality.time"] or 0) >= SENTINEL))
    print("  bestInfinity.realTime 为哨兵:", sum(1 for r in ok if (r["bestInfinity.realTime"] or 0) >= SENTINEL))
    print("  bestEternity.realTime 为哨兵:", sum(1 for r in ok if (r["bestEternity.realTime"] or 0) >= SENTINEL))
    print("  thisReality.realTime == 0 且有现实记录:",
          sum(1 for r in ok if (r["thisReality.realTime"] or 0) == 0 and (r["realities"] or 0) > 0))
    print("  totalTimePlayed < realTimePlayed:",
          sum(1 for r in ok if r["totalTimePlayed"] and r["realTimePlayed"]
              and r["totalTimePlayed"] < r["realTimePlayed"]))
    rat = sorted([r for r in ok if r["ratio"]], key=lambda r: r["ratio"])
    if rat:
        print(f"  bestReality time/realTime 比值: min={rat[0]['ratio']:.3f} "
              f"median={rat[len(rat)//2]['ratio']:.2f} max={rat[-1]['ratio']:.1f}")

    # ---- 选样本 ----
    picks = []

    def add(r, why):
        if r and r["name"] not in [x[0]["name"] for x in picks]:
            picks.append((r, why))

    by_stage = {s: [r for r in ok if r["stage"] == s] for s in dist}
    add(sorted(by_stage.get("pre-infinity", []), key=lambda r: r["realTimePlayed"] or 0)[0]
        if by_stage.get("pre-infinity") else None, "最早阶段：尚无无限记录")
    add(sorted(by_stage.get("pre-infinity", []), key=lambda r: -(r["realTimePlayed"] or 0))[0]
        if by_stage.get("pre-infinity") else None, "无限前阶段中游玩最久")
    add(sorted(by_stage.get("infinity", []), key=lambda r: r["bestInfinity.time"] or 0)[0]
        if by_stage.get("infinity") else None, "仅无限阶段：最速无限")
    add(sorted(by_stage.get("eternity", []), key=lambda r: r["bestEternity.time"] or 0)[0]
        if by_stage.get("eternity") else None, "永恒阶段：最速永恒")
    real = sorted(by_stage.get("reality", []), key=lambda r: r["realities"] or 0)
    for i, why in [(0, "刚进入现实"), (len(real) // 4, "现实前期"),
                   (len(real) // 2, "现实中段"), (-1, "现实后期")]:
        if real:
            add(real[i], why)
    add(rat[0] if rat else None, "time/realTime 比值最小（膨胀最弱）")
    add(rat[-1] if rat else None, "time/realTime 比值最大（膨胀最强）")
    add(next((r for r in ok if r["dilationActive"]), None), "存档时时间膨胀处于激活态")
    add(next((r for r in ok if r["dilationUnlocked"]), None), "已解锁时间膨胀")
    add(next((r for r in ok if (r["enslavedStored"] or 0) > 0), None), "无名氏时间储存非零")
    add(next((r for r in ok if r["hasPelleDoomed"]), None), "已进入毁灭现实")
    add(next((r for r in ok if r["speedrunActive"]), None), "速通进行中")
    add(sorted(ok, key=lambda r: -(r["realTimePlayed"] or 0))[0], "总现实游玩时长最长")
    add(sorted(ok, key=lambda r: -(r["totalTimePlayed"] or 0))[0], "总游戏内时长最长")

    manifest = []
    print("\n=== 选中样本 ===")
    for r, why in picks:
        dst = os.path.join(SAMPLES, r["name"].replace(" ", "_"))
        with open(dst, "wb") as f:
            f.write(zf.read(r["zipname"]))
        print(f"  [{why}] {r['name']}  stage={r['stage']} R={r['realities']} "
              f"bestReality={r['bestReality.time']} ratio={r['ratio']}")
        manifest.append({"file": os.path.basename(dst), "why": why, **r})

    with open(os.path.join(OUT, "samples_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "profile.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"\n样本 {len(manifest)} 个 -> _saves/samples/ ，清单 _saves/samples_manifest.json")


if __name__ == "__main__":
    main()
