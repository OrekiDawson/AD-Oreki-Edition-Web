# -*- coding: utf-8 -*-
"""只读盘点 AD 存档 ZIP：目录结构、数量、重复、损坏、压缩方式。不修改原包。"""
import hashlib
import json
import os
import sys
import zipfile

ZIP = r"C:\Users\Oreki\Downloads\反物质维度steam网页全存档-1123个.zip"
OUT = r"C:\Users\Oreki\WorkBuddy\2026-10-24-00-34-44\_saves"
os.makedirs(OUT, exist_ok=True)


def fix_name(info):
    """ZIP 内中文文件名可能是 GBK；zipfile 默认按 cp437 解码，这里尝试还原。"""
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

        # 目录结构
        tree = {}
        for i in files:
            n = fix_name(i)
            d = os.path.dirname(n) or "(root)"
            tree.setdefault(d, []).append(n)
        print("\n=== 目录分布 ===")
        for d in sorted(tree):
            print(f"{d}\t{len(tree[d])}")

        # 扩展名
        ext = {}
        for i in files:
            e = os.path.splitext(fix_name(i))[1].lower() or "(none)"
            ext[e] = ext.get(e, 0) + 1
        print("\n=== 扩展名 ===", json.dumps(ext, ensure_ascii=False))

        # 压缩方式
        methods = {}
        for i in files:
            methods[i.compress_type] = methods.get(i.compress_type, 0) + 1
        print("=== 压缩方式 (0=store,8=deflate) ===", methods)

        # 大小
        total_u = sum(i.file_size for i in files)
        print(f"=== 未压缩总大小: {total_u/1048576:.1f} MiB  文件数: {len(files)} ===")

        # 名称重复
        names = [fix_name(i) for i in files]
        dup_names = {n: names.count(n) for n in set(names) if names.count(n) > 1}
        print("=== 重复文件名 ===", len(dup_names), list(dup_names.items())[:10])

        # CRC 完整性 + 内容哈希（只读解压到内存）
        print("\n=== 完整性/内容哈希 ===")
        bad_crc = []
        hashes = {}
        records = []
        for idx, i in enumerate(files):
            n = fix_name(i)
            try:
                data = zf.read(i)
            except Exception as e:  # CRC 错误 / 解压失败
                bad_crc.append((n, repr(e)))
                continue
            h = hashlib.sha256(data).hexdigest()
            hashes.setdefault(h, []).append(n)
            records.append({"name": n, "size": len(data), "sha256": h,
                            "compress_type": i.compress_type, "date_time": list(i.date_time)})
            if (idx + 1) % 200 == 0:
                print(f"  ...{idx + 1}/{len(files)}")

        print("CRC/解压失败:", len(bad_crc), bad_crc[:10])
        dup_content = {h: v for h, v in hashes.items() if len(v) > 1}
        print("内容重复组数:", len(dup_content), " 涉及文件:", sum(len(v) for v in dup_content.values()))
        for h, v in list(dup_content.items())[:8]:
            print("  dup:", v[:6])
        print("唯一内容数:", len(hashes))

        # 日期范围
        dates = sorted(set(tuple(r["date_time"][:3]) for r in records))
        print("存档时间戳范围:", dates[0], "~", dates[-1], " 不同日期数:", len(dates))

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
        print("\n已写出 _saves/inventory.json")


if __name__ == "__main__":
    main()
