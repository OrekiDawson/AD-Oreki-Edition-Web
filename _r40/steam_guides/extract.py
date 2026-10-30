# -*- coding: utf-8 -*-
"""从 Steam 指南页面 HTML 提取正文为 Markdown。

Steam 指南正文结构（2026-10 实测）：
  <div class="guide subSections">
    <div class="subSection detailBox" id="...">
      <div class="subSectionTitle"> 章节标题 </div>
      <div class="subSectionDesc"> 正文 HTML </div>

用法：python extract.py
输出：guide_<id>.md（同目录）
"""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

BLOCK = re.compile(
    r'<div class="subSection detailBox"[^>]*>\s*'
    r'<div class="subSectionTitle">(.*?)</div>\s*'
    r'<div class="subSectionDesc">(.*?)</div>\s*</div>',
    re.S,
)

TAG = re.compile(r"<[^>]+>")


def _clean_inline(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|div|li|tr|h[1-6])>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "  - ", s, flags=re.I)
    s = re.sub(r"<img[^>]*>", "", s, flags=re.I)
    s = TAG.sub("", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")
    lines = [ln.rstrip() for ln in s.split("\n")]
    out = []
    blank = 0
    for ln in lines:
        if not ln.strip():
            blank += 1
            if blank > 1:
                continue
        else:
            blank = 0
        out.append(ln)
    return "\n".join(out).strip()


def extract(path: str) -> str:
    raw = open(path, "rb").read().decode("utf-8", "replace")
    m = re.search(r'<div class="guide subSections">(.*)', raw, re.S)
    body = m.group(1) if m else raw
    blocks = BLOCK.findall(body)
    title = re.search(r"<title>(.*?)</title>", raw, re.S)
    title = html.unescape(TAG.sub("", title.group(1))).strip() if title else os.path.basename(path)

    parts = ["# %s" % title, "",
             "> 来源：%s" % os.path.basename(path),
             "> 自动提取自 Steam 社区指南页面，仅作内部参照，请勿再分发。", ""]
    for head, desc in blocks:
        h = _clean_inline(head)
        d = _clean_inline(desc)
        if h:
            parts.append("## " + h)
            parts.append("")
        if d:
            parts.append(d)
            parts.append("")
    return "\n".join(parts)


def main():
    for fn in sorted(os.listdir(HERE)):
        if not (fn.startswith("raw_") and fn.endswith(".html")):
            continue
        gid = fn[4:-5]
        text = extract(os.path.join(HERE, fn))
        outp = os.path.join(HERE, "guide_%s.md" % gid)
        with open(outp, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        print("%s -> %s  chars=%d lines=%d" % (fn, os.path.basename(outp), len(text), text.count("\n") + 1))


if __name__ == "__main__":
    main()
