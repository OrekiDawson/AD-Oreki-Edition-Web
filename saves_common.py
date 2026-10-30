# -*- coding: utf-8 -*-
"""存档 ZIP 解码公共逻辑（只读）。"""
import base64
import json
import zipfile
import zlib

ZIP = r"C:\Users\Oreki\Downloads\反物质维度steam网页全存档-1123个.zip"
OUT = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_saves"
START = "AntimatterDimensionsSavefileFormat"
END = "EndOfSavefile"
SENTINEL = 999999999999


def open_zip():
    return zipfile.ZipFile(ZIP, "r")


def decode_save(text):
    text = text.strip().replace("\r", "").replace("\n", "")
    meta = {}
    body = text
    if text.startswith(START):
        meta["format"] = "prefixed"
        meta["savever"] = text[len(START):len(START) + 3]
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
    return json.loads(raw.decode("utf-8")), meta


def get(d, path, default=None):
    cur = d
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None
