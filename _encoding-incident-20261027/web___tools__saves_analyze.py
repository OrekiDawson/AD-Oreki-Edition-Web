# -*- coding: utf-8 -*-
"""鍙瑙ｇ爜 1123 涓瓨妗ｅ苟鐩樼偣鏃堕棿鐩稿叧瀛楁鍒嗗竷銆備笉瑙ｅ帇钀界洏銆佷笉淇敼浠讳綍瀛樻。銆?""
import base64
import json
import os
import re
import zipfile
import zlib

ZIP = r"C:\Users\Oreki\Downloads\鍙嶇墿璐ㄧ淮搴team缃戦〉鍏ㄥ瓨妗?1123涓?zip"
OUT = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_saves"
START = "AntimatterDimensionsSavefileFormat"
END = "EndOfSavefile"


def decode_save(text):
    """杩斿洖 (player_dict, meta) 鎴栨姏寮傚父銆傚吋瀹规柊鏍煎紡涓庢棫寮忕函 base64銆?""
    text = text.strip().replace("\r", "").replace("\n", "")
    meta = {"format": "unknown"}
    body = text
    if text.startswith(START):
        meta["format"] = "prefixed"
        ver = text[len(START):len(START) + 3]
        meta["savever"] = ver
        body = text[len(START) + 3:]
        if body.endswith(END):
            body = body[:-len(END)]
        body = body.replace("0b", "+").replace("0c", "/").replace("0a", "0")
        raw = base64.b64decode(body + "=" * (-len(body) % 4))
        try:
            raw = zlib.decompress(raw)
            meta["codec"] = "deflate"
        except zlib.error:
            meta["codec"] = "plain"
    else:
        meta["format"] = "legacy-base64"
        raw = base64.b64decode(body + "=" * (-len(body) % 4))
        meta["codec"] = "plain"
    payload = raw.decode("utf-8")
    obj = json.loads(payload)
    return obj, meta


def has(d, path):
    cur = d
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return False
        cur = cur[k]
    return True


def get(d, path, default=None):
    cur = d
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def num(v):
    """鎶婂彲鑳戒负 'Infinity' 瀛楃涓?缂哄け鐨勫€煎綊涓€涓?float 鎴?None銆?""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def main():
    with zipfile.ZipFile(ZIP, "r") as zf:
        names = [i.filename for i in zf.infolist()
                 if i.filename.startswith("anti2/") and i.filename.endswith(".txt")]
        names.sort()
        print("鍊欓€夊瓨妗ｆ枃浠?", len(names))
        rows = []
        fails = []
        for idx, name in enumerate(names):
            try:
                obj, meta = decode_save(zf.read(name).decode("utf-8", "replace"))
            except Exception as e:
                fails.append({"name": name, "error": repr(e)})
                continue
            rec = obj.get("records", {}) if isinstance(obj.get("records"), dict) else {}
            row = {
                "name": os.path.basename(name),
                "version": obj.get("version"),
                "format": meta["format"],
                "savever": meta.get("savever"),
                "codec": meta.get("codec"),
                "hasRecords": isinstance(obj.get("records"), dict),
                "realities": num(obj.get("realities")),
                "eternities": num(obj.get("eternities")),
                "infinities": num(obj.get("infinities")),
                "dilation": num(get(obj, "dilation.time", None)) is not None or bool(get(obj, "dilation", {})),
            }
            # 璁板綍瀛楁瀛樺湪鎬?            for f in ["totalTimePlayed", "realTimePlayed", "realTimeDoomed", "previousRunRealTime",
                      "timePlayedAtBHUnlock"]:
                row["rec." + f] = f in rec
            for layer in ["bestInfinity", "thisInfinity", "bestEternity", "thisEternity",
                          "bestReality", "thisReality"]:
                row["rec." + layer] = isinstance(rec.get(layer), dict)
                row["rec." + layer + ".time"] = has(rec, layer + ".time")
                row["rec." + layer + ".realTime"] = has(rec, layer + ".realTime")
            for arr in ["recentInfinities", "recentEternities", "recentRealities"]:
                a = rec.get(arr)
                row["rec." + arr] = isinstance(a, list)
                row["rec." + arr + ".len"] = len(a) if isinstance(a, list) else 0
                row["rec." + arr + ".firstRowLen"] = len(a[0]) if isinstance(a, list) and a and isinstance(a[0], list) else 0
            # 鍏抽敭鏁板€?            row["bestReality.time"] = num(get(rec, "bestReality.time"))
            row["bestReality.realTime"] = num(get(rec, "bestReality.realTime"))
            row["bestEternity.time"] = num(get(rec, "bestEternity.time"))
            row["bestEternity.realTime"] = num(get(rec, "bestEternity.realTime"))
            row["bestInfinity.time"] = num(get(rec, "bestInfinity.time"))
            row["bestInfinity.realTime"] = num(get(rec, "bestInfinity.realTime"))
            row["thisReality.time"] = num(get(rec, "thisReality.time"))
            row["thisReality.realTime"] = num(get(rec, "thisReality.realTime"))
            row["totalTimePlayed"] = num(rec.get("totalTimePlayed"))
            row["realTimePlayed"] = num(rec.get("realTimePlayed"))
            # 鎸戞垬鏈€浣虫椂闂?            row["challenge.normal.bestTimes"] = isinstance(get(obj, "challenge.normal.bestTimes"), list)
            row["challenge.infinity.bestTimes"] = isinstance(get(obj, "challenge.infinity.bestTimes"), list)
            row["speedrun"] = isinstance(obj.get("speedrun"), dict)
            rows.append(row)
            if (idx + 1) % 250 == 0:
                print(f"  ...{idx + 1}/{len(names)}")

        print("瑙ｇ爜澶辫触:", len(fails), fails[:5])
        print("鎴愬姛:", len(rows))

        # 姹囨€?        def pct(key):
            n = sum(1 for r in rows if r.get(key))
            return f"{n}/{len(rows)} ({n * 100 // max(1, len(rows))}%)"

        print("\n=== 瀛楁瀛樺湪鐜?===")
        for key in sorted(rows[0].keys()):
            if key in ("name",):
                continue
            if isinstance(rows[0].get(key), bool):
                print(f"{key:38s} {pct(key)}")

        vers = {}
        fmts = {}
        for r in rows:
            vers[str(r["version"])] = vers.get(str(r["version"]), 0) + 1
            fmts[r["format"] + "/" + str(r.get("savever"))] = fmts.get(r["format"] + "/" + str(r.get("savever")), 0) + 1
        print("\n=== player.version ===", json.dumps(vers, ensure_ascii=False))
        print("=== 搴忓垪鍖栨牸寮?===", json.dumps(fmts, ensure_ascii=False))

        # 杩涘害鍒嗙被
        def stage(r):
            if (r["realities"] or 0) > 0:
                return "reality+"
            if (r["eternities"] or 0) > 0:
                return "eternity+"
            if (r["infinities"] or 0) > 0:
                return "infinity+"
            return "pre-infinity"

        stages = {}
        for r in rows:
            stages[stage(r)] = stages.get(stage(r), 0) + 1
        print("=== 杩涘害鍒嗗竷 ===", json.dumps(stages, ensure_ascii=False))

        # 鏃х粨鏋勶紙缂?records / 缂?realTime锛?        no_records = [r["name"] for r in rows if not r["hasRecords"]]
        no_rt = [r["name"] for r in rows if r["hasRecords"] and not r["rec.realTimePlayed"]]
        print("缂?records:", len(no_records), no_records[:5])
        print("鏈?records 浣嗙己 realTimePlayed:", len(no_rt), no_rt[:5])

        # 鐜板疄鏃堕棿 / 娓告垙鏃堕棿 姣斾緥鍒嗗竷锛堣瘖鏂紓甯革級
        ratios = []
        for r in rows:
            t, rt = r["bestReality.time"], r["bestReality.realTime"]
            if t and rt and rt < 9e11 and t < 9e11 and rt > 0:
                ratios.append((t / rt, r["name"]))
        ratios.sort()
        if ratios:
            print(f"\n=== bestReality.time / realTime === n={len(ratios)} "
                  f"min={ratios[0][0]:.3f} max={ratios[-1][0]:.1f}")
            print("  <1 鐨勬牱鏈暟:", sum(1 for x, _ in ratios if x < 1), [n for x, n in ratios if x < 1][:5])

        with open(os.path.join(OUT, "analysis.json"), "w", encoding="utf-8") as f:
            json.dump({"rows": rows, "fails": fails,
                       "stages": stages, "versions": vers, "formats": fmts}, f, ensure_ascii=False)
        print("\n宸插啓鍑?_saves/analysis.json")


if __name__ == "__main__":
    main()
