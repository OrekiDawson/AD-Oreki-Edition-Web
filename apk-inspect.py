#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""离线 APK 校验（无 Java 环境可用）

用法：
  python _tools/apk-inspect.py <apk> [<apk> ...] [--json out.json]

做四件事：
  1. 解析二进制 AndroidManifest.xml（包名 / versionName / versionCode / minSdk / targetSdk / split）
  2. 列出 zip 内 ABI 目录与 native 库
  3. 解析 APK Signing Block（v2 / v3），取签名证书并输出 SHA-256 / SHA-1 指纹
  4. 用 openssl 验证「签名 + 内容摘要」，不只是列出证书

不依赖 apksigner / apkanalyzer（它们需要 Java）。第 4 步的密码学运算全部交给 openssl。
"""
import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import zipfile

# ---------------- 二进制 AndroidManifest.xml ----------------

def _read_string_pool(data, pos):
    _, hsize, csize = struct.unpack_from("<HHI", data, pos)
    str_count, style_count, flags, str_start, _ = struct.unpack_from("<IIIII", data, pos + 8)
    offs = struct.unpack_from("<%dI" % str_count, data, pos + 28)
    utf8 = bool(flags & (1 << 8))
    base = pos + str_start
    out = []
    for off in offs:
        p = base + off
        if utf8:
            n = data[p]; p += 1
            if n & 0x80:
                n = ((n & 0x7F) << 8) | data[p]; p += 1
            b = data[p]; p += 1
            if b & 0x80:
                b = ((b & 0x7F) << 8) | data[p]; p += 1
            out.append(data[p:p + b].decode("utf-8", "replace"))
        else:
            n = struct.unpack_from("<H", data, p)[0]; p += 2
            if n & 0x8000:
                n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", data, p)[0]; p += 2
            out.append(data[p:p + n * 2].decode("utf-16-le", "replace"))
    return out


def parse_axml(data):
    strings, elements = [], []
    pos = 8
    while pos + 8 <= len(data):
        ctype, hsize, csize = struct.unpack_from("<HHI", data, pos)
        if csize <= 0:
            break
        if ctype == 0x0001:
            strings = _read_string_pool(data, pos)
        elif ctype == 0x0102:  # start element
            ns_i, name_i, attr_start, attr_size, attr_count = struct.unpack_from("<IIHHH", data, pos + 16)
            attrs = {}
            ap = pos + 16 + attr_start
            for i in range(attr_count):
                a_ns, a_name, a_raw, _sz, _r0, v_type, v_data = struct.unpack_from("<IIIHBBI", data, ap + i * attr_size)
                key = strings[a_name] if a_name < len(strings) else str(a_name)
                if a_raw != 0xFFFFFFFF and a_raw < len(strings):
                    val = strings[a_raw]
                elif v_type == 0x03 and v_data < len(strings):
                    val = strings[v_data]
                elif v_type == 0x12:
                    val = bool(v_data)
                elif v_type in (0x10, 0x11):
                    val = v_data
                else:
                    val = "0x%x" % v_data
                attrs[key] = val
            elements.append({"name": strings[name_i] if name_i < len(strings) else "?",
                             "attrs": attrs})
        pos += csize
    return elements


def manifest_info(zf):
    info = {}
    try:
        elems = parse_axml(zf.read("AndroidManifest.xml"))
    except KeyError:
        return {"error": "APK 内没有 AndroidManifest.xml"}
    for e in elems:
        a = e["attrs"]
        if e["name"] == "manifest":
            info["package"] = a.get("package")
            info["versionName"] = a.get("versionName")
            info["versionCode"] = a.get("versionCode")
            info["split"] = a.get("split")
            info["compileSdkVersion"] = a.get("compileSdkVersion")
        elif e["name"] == "uses-sdk":
            info["minSdk"] = a.get("minSdkVersion")
            info["targetSdk"] = a.get("targetSdkVersion")
        elif e["name"] == "uses-split":
            info.setdefault("usesSplits", []).append(a.get("name"))
        elif e["name"] == "application":
            info["appLabelRef"] = a.get("label")
    return info


# ---------------- 签名块 ----------------

UBER = b"APK Sig Block 42"


def _lp(buf, pos):
    n = struct.unpack_from("<I", buf, pos)[0]
    return buf[pos + 4:pos + 4 + n], pos + 4 + n


def _lp_seq(buf):
    items, pos = [], 0
    while pos < len(buf):
        item, pos = _lp(buf, pos)
        items.append(item)
    return items


def signing_block(data):
    idx = data.rfind(UBER)
    if idx < 0:
        return None
    trailer = struct.unpack_from("<Q", data, idx - 8)[0]
    # 布局：[size u64][payload][size u64][magic 16]
    # trailer = payload + 8 + 16 → blockStart = idx - trailer + 8，payload 结束于 idx-8
    start = idx - trailer + 8
    pos, end = start + 8, idx - 8
    out = {}
    while pos < end:
        ln = struct.unpack_from("<Q", data, pos)[0]
        bid = struct.unpack_from("<I", data, pos + 8)[0]
        out[bid] = data[pos + 12:pos + 8 + ln]
        pos += 8 + ln
    return {"start": start, "blocks": out}


def parse_v2(block):
    # v2/v3 块值 = uint32(签名者序列长度) + 签名者序列；每个签名者再各自 lp
    seq_raw = _lp(block, 0)[0]
    signers = []
    for signer in _lp_seq(seq_raw):
        signed_data, p = _lp(signer, 0)
        sigs_raw, p = _lp(signer, p)
        pubkey, p = _lp(signer, p)
        digests = []
        for d in _lp_seq(_lp(signed_data, 0)[0]):
            alg = struct.unpack_from("<I", d, 0)[0]
            digests.append((alg, _lp(d, 4)[0]))
        certs_raw, q = _lp(signed_data, _lp(signed_data, 0)[1])
        certs = _lp_seq(certs_raw)
        sigs = []
        for s in _lp_seq(sigs_raw):
            alg = struct.unpack_from("<I", s, 0)[0]
            sigs.append((alg, _lp(s, 4)[0]))
        signers.append({"signed_data": signed_data, "digests": digests,
                        "certs": certs, "sigs": sigs, "pubkey": pubkey})
    return signers


def content_digest(data, block_start, algo):
    """按 v2 规则计算内容摘要：两个「段」各自 1MB 分块"""
    eocd = data.rfind(b"PK\x05\x06")
    cd_off = struct.unpack_from("<I", data, eocd + 16)[0]
    sections = [data[:block_start], data[cd_off:eocd]]
    chunks = []
    for sec in sections:
        for i in range(0, len(sec), 1024 * 1024):
            chunks.append(sec[i:i + 1024 * 1024])
    h = hashlib.new(algo)
    digests = b""
    for c in chunks:
        ch = hashlib.new(algo)
        ch.update(b"\xa5")
        ch.update(struct.pack("<I", len(c)))
        ch.update(c)
        digests += ch.digest()
    h.update(b"\x5a")
    h.update(struct.pack("<I", len(chunks)))
    h.update(digests)
    return h.digest(), len(chunks)


def openssl(args, stdin=None):
    return subprocess.run(["openssl"] + args, input=stdin,
                          capture_output=True, text=True)


def cert_info(der):
    with tempfile.NamedTemporaryFile(suffix=".der", delete=False) as f:
        f.write(der)
        path = f.name
    try:
        r = openssl(["x509", "-inform", "DER", "-in", path, "-noout",
                     "-subject", "-issuer", "-dates"])
        text = (r.stdout or "") + (r.stderr or "")
        info = {"sha256": hashlib.sha256(der).hexdigest(),
                "sha1": hashlib.sha1(der).hexdigest(),
                "subject": None, "issuer": None, "notBefore": None, "notAfter": None}
        for line in text.splitlines():
            t = line.strip()
            if t.startswith("subject="):
                info["subject"] = t[8:]
            elif t.startswith("issuer="):
                info["issuer"] = t[7:]
            elif t.startswith("notBefore="):
                info["notBefore"] = t[10:]
            elif t.startswith("notAfter="):
                info["notAfter"] = t[9:]
        return info
    finally:
        os.unlink(path)


def verify_signature(signed_data, sig, pubkey_der, digest_name):
    with tempfile.TemporaryDirectory() as d:
        sd = os.path.join(d, "signed.bin")
        sg = os.path.join(d, "sig.bin")
        pk = os.path.join(d, "pub.der")
        pem = os.path.join(d, "pub.pem")
        open(sd, "wb").write(signed_data)
        open(sg, "wb").write(sig)
        open(pk, "wb").write(pubkey_der)
        r = openssl(["pkey", "-pubin", "-inform", "DER", "-in", pk, "-out", pem])
        if r.returncode != 0:
            return False, "公钥解析失败: " + (r.stderr or "").strip()[:120]
        r = openssl(["dgst", "-" + digest_name, "-verify", pem, "-signature", sg, sd])
        ok = r.returncode == 0 and "Verified OK" in (r.stdout or "")
        return ok, ((r.stdout or "") + (r.stderr or "")).strip()[:200]


# 签名算法 id（AOSP apksig 定义）：0x0101 SHA-256 / 0x0102 SHA-512 /
# 0x0103 SHA-256-verity / 0x0104 SHA-512-verity
ALG = {1: ("sha256", "SHA-256"), 2: ("sha512", "SHA-512"),
       0x0101: ("sha256", "SHA-256"), 0x0102: ("sha512", "SHA-512"),
       0x0103: ("sha256", "SHA-256(verity)"), 0x0104: ("sha512", "SHA-512(verity)")}


def inspect(path):
    rec = {"path": os.path.abspath(path), "size": os.path.getsize(path)}
    with open(path, "rb") as f:
        data = f.read()
    rec["fileSha256"] = hashlib.sha256(data).hexdigest()
    with zipfile.ZipFile(path) as zf:
        rec["manifest"] = manifest_info(zf)
        libs = [n for n in zf.namelist() if n.startswith("lib/")]
        rec["abis"] = sorted({n.split("/")[1] for n in libs})
        rec["nativeLibCount"] = len(libs)
        rec["nativeLibs"] = libs[:6]
        rec["hasV1Signature"] = any(n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))
                                    for n in zf.namelist())

    blk = signing_block(data)
    if not blk:
        rec["signature"] = {"error": "没有 APK Signing Block（无 v2/v3 签名）"}
        return rec
    rec["signatureBlockIds"] = ["0x%08x" % k for k in blk["blocks"]]
    v2 = blk["blocks"].get(0x7109871A)
    v3 = blk["blocks"].get(0xF05368C0)
    payload = v2 or v3
    if not payload:
        rec["signature"] = {"error": "有签名块但没有 v2/v3 方案"}
        return rec
    try:
        signers = parse_v2(payload)
    except Exception as e:  # noqa: BLE001
        rec["signature"] = {"error": "签名结构解析失败: %s" % e}
        return rec

    sig_out = {"scheme": "v2" if v2 else "v3", "signers": []}
    for s in signers:
        entry = {"certs": [cert_info(c) for c in s["certs"]]}
        # 内容摘要
        for alg, expect in s["digests"]:
            algo, name = ALG.get(alg, (None, "alg-%d" % alg))
            if not algo or "verity" in name:
                entry.setdefault("digestChecks", []).append(
                    {"alg": name, "verified": None, "note": "未实现（verity 需 Merkle 树）"})
                continue
            actual, nchunks = content_digest(data, blk["start"], algo)
            entry.setdefault("digestChecks", []).append(
                {"alg": name, "chunks": nchunks, "verified": actual == expect,
                 "expected": expect.hex(), "actual": actual.hex()})
        # 签名本身
        for alg, sig in s["sigs"]:
            algo, name = ALG.get(alg, (None, "alg-%d" % alg))
            if not algo:
                continue
            ok, msg = verify_signature(s["signed_data"], sig, s["pubkey"], algo)
            entry.setdefault("signatureChecks", []).append(
                {"alg": name, "verified": ok, "openssl": msg})
        sig_out["signers"].append(entry)
    rec["signature"] = sig_out
    return rec


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    json_out = None
    if "--json" in sys.argv:
        json_out = sys.argv[sys.argv.index("--json") + 1]
        args = [a for a in args if a != json_out]
    if not args:
        print("用法: python _tools/apk-inspect.py <apk> [--json out.json]")
        return 2
    results = []
    for p in args:
        r = inspect(p)
        results.append(r)
        print("=" * 70)
        print("文件       :", r["path"])
        print("大小       :", r["size"])
        print("SHA-256    :", r["fileSha256"])
        m = r["manifest"]
        if "error" in m:
            print("清单       :", m["error"])
        else:
            print("包名       :", m.get("package"))
            print("versionName:", m.get("versionName"), " versionCode:", m.get("versionCode"))
            print("minSdk     :", m.get("minSdk"), " targetSdk:", m.get("targetSdk"))
            if m.get("split"):
                print("split      :", m.get("split"))
            if m.get("usesSplits"):
                print("依赖 split :", m.get("usesSplits"))
        print("ABI        :", r["abis"], " 原生库数:", r["nativeLibCount"])
        if r["nativeLibs"]:
            print("原生库示例 :", r["nativeLibs"][:3])
        sig = r.get("signature", {})
        if "error" in sig:
            print("签名       :", sig["error"])
        else:
            print("签名方案   :", sig["scheme"], "块:", r.get("signatureBlockIds"))
            for i, s in enumerate(sig["signers"]):
                for c in s["certs"]:
                    print("  证书[%d] SHA-256: %s" % (i, c["sha256"]))
                    print("  证书[%d] SHA-1  : %s" % (i, c["sha1"]))
                    print("  主题          :", c["subject"])
                    print("  颁发者        :", c["issuer"])
                    print("  有效期        :", c["notBefore"], "→", c["notAfter"])
                for d in s.get("digestChecks", []):
                    print("  内容摘要[%s]: %s" % (d["alg"], d.get("verified", d.get("note"))))
                for d in s.get("signatureChecks", []):
                    print("  签名校验[%s]: %s (%s)" % (d["alg"], d["verified"], d["openssl"]))
        print("V1 签名    :", r["hasV1Signature"])
    if json_out:
        with open(json_out, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print("\nJSON 已写入:", json_out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
