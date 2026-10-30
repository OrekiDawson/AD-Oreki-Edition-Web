# -*- coding: utf-8 -*-
"""鍙鐩樼偣 AD 瀛樻。 ZIP锛氱洰褰曠粨鏋勩€佹暟閲忋€侀噸澶嶃€佹崯鍧忋€佸帇缂╂柟寮忋€備笉淇敼鍘熷寘銆?""
import hashlib
import json
import os
import sys
import zipfile

ZIP = r"C:\Users\Oreki\Downloads\鍙嶇墿璐ㄧ淮搴team缃戦〉鍏ㄥ瓨妗?1123涓?zip"
OUT = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_saves"
os.makedirs(OUT, exist_ok=True)


def fix_name(info):
    """ZIP 鍐呬腑鏂囨枃浠跺悕鍙兘鏄?GBK锛泎ipfile 榛樿鎸?cp437 瑙ｇ爜锛岃繖閲屽皾璇曡繕鍘熴€?""
    name = info.filename
    if info.flag_bits & 0x800:
        return name
    try:
        return name.encode("cp437").decode("gbk")
    except Exception:
        return name


def main():
    with zipfile.ZipFile(ZIP, "r") as zf:
        infos = zf.infolist()
        print("ZIP entries:", len(infos))
        dirs = [i for i in infos if i.is_dir()]
        files = [i for i in infos if not i.is_dir()]
        print("directories:", len(dirs), " files:", len(files))

        # 鐩綍缁撴瀯
        tree = {}
        for i in files:
            n = fix_name(i)
            d = os.path.dirname(n) or "(root)"
            tree.setdefault(d, []).append(n)
        print("\n=== 鐩綍鍒嗗竷 ===")
        for d in sorted(tree):
            print(f"{d}\t{len(tree[d])}")

        # 鎵╁睍鍚?        ext = {}
        for i in files:
            e = os.path.splitext(fix_name(i))[1].lower() or "(none)"
            ext[e] = ext.get(e, 0) + 1
        print("\n=== 鎵╁睍鍚?===", json.dumps(ext, ensure_ascii=False))

        # 鍘嬬缉鏂瑰紡
        methods = {}
        for i in files:
            methods[i.compress_type] = methods.get(i.compress_type, 0) + 1
        print("=== 鍘嬬缉鏂瑰紡 (0=store,8=deflate) ===", methods)

        # 澶у皬
        total_u = sum(i.file_size for i in files)
        print(f"=== 鏈帇缂╂€诲ぇ灏? {total_u/1048576:.1f} MiB  鏂囦欢鏁? {len(files)} ===")

        # 鍚嶇О閲嶅
        names = [fix_name(i) for i in files]
        dup_names = {n: names.count(n) for n in set(names) if names.count(n) > 1}
        print("=== 閲嶅鏂囦欢鍚?===", len(dup_names), list(dup_names.items())[:10])

        # CRC 瀹屾暣鎬?+ 鍐呭鍝堝笇锛堝彧璇昏В鍘嬪埌鍐呭瓨锛?        print("\n=== 瀹屾暣鎬?鍐呭鍝堝笇 ===")
        bad_crc = []
        hashes = {}
        records = []
        for idx, i in enumerate(files):
            n = fix_name(i)
            try:
                data = zf.read(i)
            except Exception as e:  # CRC 閿欒 / 瑙ｅ帇澶辫触
                bad_crc.append((n, repr(e)))
                continue
            h = hashlib.sha256(data).hexdigest()
            hashes.setdefault(h, []).append(n)
            records.append({"name": n, "size": len(data), "sha256": h,
                            "compress_type": i.compress_type, "date_time": list(i.date_time)})
            if (idx + 1) % 200 == 0:
                print(f"  ...{idx + 1}/{len(files)}")

        print("CRC/瑙ｅ帇澶辫触:", len(bad_crc), bad_crc[:10])
        dup_content = {h: v for h, v in hashes.items() if len(v) > 1}
        print("鍐呭閲嶅缁勬暟:", len(dup_content), " 娑夊強鏂囦欢:", sum(len(v) for v in dup_content.values()))
        for h, v in list(dup_content.items())[:8]:
            print("  dup:", v[:6])
        print("鍞竴鍐呭鏁?", len(hashes))

        # 鏃ユ湡鑼冨洿
        dates = sorted(set(tuple(r["date_time"][:3]) for r in records))
        print("瀛樻。鏃堕棿鎴宠寖鍥?", dates[0], "~", dates[-1], " 涓嶅悓鏃ユ湡鏁?", len(dates))

        with open(os.path.join(OUT, "inventory.json"), "w", encoding="utf-8") as f:
            json.dump({
                "zip": ZIP,
                "entries": len(infos),
                "files": len(files),
                "dirs": sorted(tree.keys()),
                "ext": ext,
                "records": records,
                "bad": bad_crc,
                "dup_content_groups": {h: v for h, v in dup_content.items()},
                "unique_contents": len(hashes),
                "uncompressed_bytes": total_u,
            }, f, ensure_ascii=False, indent=1)
        print("\n宸插啓鍑?_saves/inventory.json")


if __name__ == "__main__":
    main()
