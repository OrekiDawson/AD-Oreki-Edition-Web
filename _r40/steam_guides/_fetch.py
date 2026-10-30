#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[R40E] Steam 社区指南抓取器（只读取证用）

用法：
    export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897
    python _fetch.py 3181166341 ...

产出：steam_guide_<slug>.md（正文原样转 Markdown，保留标题层级、列表、表格、链接）
不写入游戏仓库任何源码目录，只落在 web/_tools/_r40/steam_guides/。
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

SLUG = {
    "2902999812": "ad-cn-pre-reality",
    "2936619880": "ad-cn-pre-reality-supplement",
    "2917210272": "ad-cn-reality-onward",
    "3181166341": "ad-cn-full-run",
    "3817468561": "ad-cn-p1-from-zero",
    "3817477040": "ad-cn-p2-eternity",
    "3817477410": "ad-cn-p3-eternity-challenges",
    "3817477688": "ad-cn-p4-dilation-reality",
    "3817478070": "ad-cn-ec-cheatsheet",
    "2909710573": "ad-en-eternity-and-ec-ninjatsu",
    "2963610414": "ad-en-time-theorems",
    "2907622156": "ad-en-secret-achievements",
}

BLOCK = {"div", "p", "section", "br", "tr", "table", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4"}


class Html2Md(HTMLParser):
    """够用就好的 HTML→Markdown：标题/段落/列表/粗斜体/表格/链接/换行。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.stack = []
        self.in_table = 0
        self.row = []
        self.cell = None
        self.list_stack = []

    # ---- 工具 ----
    def _nl(self, n=1):
        tail = "".join(self.out[-3:])
        if not tail.endswith("\n" * n):
            self.out.append("\n" * n)

    def _emit(self, s):
        self.out.append(s)

    # ---- 解析 ----
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "") or ""
        if tag in ("script", "style"):
            self.stack.append(tag)
            return
        if self.stack and self.stack[-1] in ("script", "style"):
            self.stack.append(tag)
            return

        if tag == "br":
            self._emit("\n")
            return
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            self._nl(2)
            self._emit("#" * int(tag[1]) + " ")
        elif tag == "b" or tag == "strong":
            self._emit("**")
        elif tag == "i" or tag == "em":
            self._emit("*")
        elif tag == "u":
            pass
        elif tag == "ul":
            self._nl(1)
            self.list_stack.append("ul")
        elif tag == "ol":
            self._nl(1)
            self.list_stack.append("ol")
        elif tag == "li":
            self._nl(1)
            depth = max(0, len(self.list_stack) - 1)
            if self.list_stack and self.list_stack[-1] == "ol":
                self._emit("  " * depth + "1. ")
            else:
                self._emit("  " * depth + "- ")
        elif tag == "table":
            self.in_table += 1
            self._nl(2)
        elif tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.cell = []
        elif tag == "img":
            alt = a.get("alt", "")
            if alt:
                self._emit(f"[图: {alt}]")
        elif tag == "a":
            href = a.get("href", "")
            self.stack.append(("a", href))
            self._emit("[")
            return
        elif tag in BLOCK:
            self._nl(1)
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif self.stack and self.stack[-1] in ("script", "style"):
            self.stack.pop()
            return
        if tag in ("h1", "h2", "h3", "h4", "h5"):
            self._nl(2)
        elif tag == "b" or tag == "strong":
            self._emit("**")
        elif tag == "i" or tag == "em":
            self._emit("*")
        elif tag == "li":
            self._nl(1)
        elif tag in ("ul", "ol"):
            if self.list_stack:
                self.list_stack.pop()
            self._nl(1)
        elif tag in ("td", "th"):
            if self.cell is not None:
                self.row.append(" ".join("".join(self.cell).split()))
                self.cell = None
        elif tag == "tr":
            if self.row:
                self._nl(1)
                self._emit("| " + " | ".join(self.row) + " |")
                self._nl(1)
            self.row = []
        elif tag == "table":
            self.in_table = max(0, self.in_table - 1)
            self._nl(2)
        elif tag == "a":
            href = ""
            for i in range(len(self.stack) - 1, -1, -1):
                if isinstance(self.stack[i], tuple):
                    href = self.stack[i][1]
                    del self.stack[i]
                    break
            self._emit("]")
            if href and not href.startswith("#"):
                self._emit("(" + clean_link(href) + ")")
        elif tag in BLOCK:
            self._nl(1)

    def handle_data(self, data):
        if self.stack and self.stack[-1] in ("script", "style"):
            return
        t = data.replace("\r", "")
        if self.cell is not None:
            self.cell.append(t)
        self._emit(t)

    def text(self):
        s = "".join(self.out)
        s = re.sub(r"[ \t]+\n", "\n", s)
        s = re.sub(r"\n{3,}", "\n\n", s)
        s = re.sub(r"\n(?![-*#|\d\s])", "\n", s)
        return s.strip()


def clean_link(href):
    href = html.unescape(href)
    if "linkfilter" in href:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
        if "u" in q:
            href = q["u"][0]
    return href


def to_md(fragment):
    p = Html2Md()
    p.feed(convert_bb_tables(fragment))
    p.close()
    return p.text()


def convert_bb_tables(s):
    """Steam 正文表格是 div.bb_table（不是 <table>），先转成真表格再进 HTMLParser。"""
    out = []
    pos = 0
    while True:
        i = s.find('<div class="bb_table">', pos)
        if i < 0:
            out.append(s[pos:])
            break
        out.append(s[pos:i])
        # 括号配平找到 bb_table 的结束位置
        depth = 0
        j = i
        end = -1
        for m in re.finditer(r"<div\b|</div>", s[i:]):
            if m.group(0) == "<div":
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    end = i + m.end()
                    break
        if end < 0:
            out.append(s[i:])
            break
        block = s[i:end]
        rows = re.split(r'<div class="bb_table_tr">', block)[1:]
        md_rows = []
        head_done = False
        for r in rows:
            cells = re.findall(r'<div class="bb_table_(th|td)"[^>]*>(.*?)</div>', r, re.S)
            if not cells:
                continue
            vals = [" ".join(to_md(c[1]).split()) for c in cells]
            md_rows.append("| " + " | ".join(vals) + " |")
            if not head_done and all(c[0] == "th" for c in cells):
                md_rows.append("|" + " --- |" * len(cells))
                head_done = True
        out.append("\n\n" + "\n".join(md_rows) + "\n\n" if md_rows else "")
        pos = end
    return "".join(out)


def get(url, tries=4):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                print(f"    429, 等待 {60 * (i + 1)}s 后重试…")
                time.sleep(60 * (i + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def between(s, start_pat, end_pat, flags=0):
    m = re.search(start_pat, s, flags)
    if not m:
        return ""
    rest = s[m.end():]
    e = re.search(end_pat, rest, flags)
    return rest[:e.start()] if e else rest[:4000]


def slice_div_balanced(s, open_idx):
    """从某个 <div 的起始位置切到与它配对的 </div>（含），用于精确取出正文块。"""
    depth = 0
    for m in re.finditer(r"<div\b|</div>", s[open_idx:]):
        if m.group(0) == "<div":
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                return s[open_idx:open_idx + m.end()]
    return s[open_idx:]


OPEN_DESC = '<div class="subSectionDesc">'


def parse_guide(gid):
    url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={gid}&l=schinese"
    h = get(url)

    title = html.unescape(between(h, r'class="workshopItemTitle">', r"</div>"))
    author = html.unescape(between(h, r'class="guideAuthors">', r"</div>"))
    author = re.sub(r"^(由|Created by|作成者)\s*", "", author).strip()

    dates = re.findall(r'class="detailsStatRight">([^<]+)</div>', h)
    visitors = re.search(r"([\d,]+)\s*(?:Unikalni odwiedzający|Unique Visitors|位不重复的访客|名独立访客|位独立访客)", h)
    favs = re.search(r"([\d,]+)\s*(?:Obecne ulubione|Current Favorites|当前收藏)", h)

    # 正文分节
    sections = []
    for m in re.finditer(r'<div class="subSection detailBox" id="(\d+)">', h):
        start = m.end()
        nxt = h.find('<div class="subSection detailBox"', start)
        block = h[start:nxt if nxt > 0 else len(h)]
        st = between(block, r'class="subSectionTitle">', r"</div>")
        k = block.find(OPEN_DESC)
        desc_html = ""
        if k >= 0:
            seg = slice_div_balanced(block, k)
            desc_html = seg[len(OPEN_DESC):-len("</div>")] if seg.endswith("</div>") else seg[len(OPEN_DESC):]
        sections.append({
            "sid": m.group(1),
            "title": html.unescape(" ".join(st.split())),
            "md": to_md(desc_html).strip(),
        })

    toc = re.findall(r'SelectGuideSection\(\s*\'(-?\d+)\'', h)
    return {
        "id": gid,
        "url": f"https://steamcommunity.com/sharedfiles/filedetails/?id={gid}",
        "title": title,
        "author": author,
        "dates": dates[:2],
        "visitors": visitors.group(1) if visitors else "",
        "favorites": favs.group(1) if favs else "",
        "sections": sections,
        "toc_count": len([t for t in toc if t != "-1"]),
    }


def write(g):
    slug = SLUG.get(g["id"], "ad-guide")
    path = os.path.join(OUT_DIR, f"steam_guide_{slug}_{g['id']}.md")
    lines = [
        f"# {g['title']}",
        "",
        f"- 指南 ID：{g['id']}",
        f"- 链接：{g['url']}",
        f"- 作者：{g['author'] or '【未取到】'}",
        f"- 发表于 / 更新：{' / '.join(g['dates']) if g['dates'] else '【未取到】'}",
        f"- 独立访客 / 收藏：{g['visitors'] or '?'} / {g['favorites'] or '?'}",
        f"- 目录条目数（TOC）：{g['toc_count']}　正文章节数：{len(g['sections'])}",
        f"- 抓取时间：2026-10-30，界面语言 schinese，经 http://127.0.0.1:7897 代理",
        "- 说明：正文由 Steam 页面 HTML 原样转 Markdown（仅换行/列表/表格/链接形式变化），未做任何改写。",
        "",
        "---",
        "",
    ]
    for s in g["sections"]:
        lines.append(f"## {s['title']}")
        lines.append("")
        lines.append(s["md"])
        lines.append("")
    open(path, "w", encoding="utf-8").write("\n".join(lines))
    return path, len("\n".join(lines))


def main(ids):
    meta = []
    for gid in ids:
        try:
            g = parse_guide(gid)
            path, n = write(g)
            meta.append({k: g[k] for k in ("id", "title", "author", "url", "dates", "toc_count")}
                        | {"sections": len(g["sections"]), "chars": n,
                           "file": os.path.basename(path)})
            print(f"[OK] {gid} {g['title']}  sections={len(g['sections'])} chars={n}")
        except Exception as e:  # noqa: BLE001
            print(f"[FAIL] {gid}: {e}")
            meta.append({"id": gid, "error": str(e)})
        time.sleep(30)
    open(os.path.join(OUT_DIR, "_index.json"), "w", encoding="utf-8").write(
        json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
