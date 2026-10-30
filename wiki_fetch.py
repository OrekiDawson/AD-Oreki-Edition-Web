#!/usr/bin/env python3
"""拉取 MediaWiki 页面的 wikitext 并粗洗成纯文本，用于时间语义审计的站外核对。

用法:
  python wiki_fetch.py fandom "Time Dilation"
  python wiki_fetch.py wikigg "Time Dilation"
  python wiki_fetch.py fandom --search "game speed"
产物写入 _research/wiki/<site>/<slug>.txt 与 .wikitext
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

SITES = {
    "fandom": "https://antimatter-dimensions.fandom.com/api.php",
    "wikigg": "https://antimatterdimensions.wiki.gg/api.php",
}
PROXY = os.environ.get("WIKI_PROXY", "http://127.0.0.1:7897")
OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_research", "wiki")


def call(api, params):
    url = api + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/json",
    })
    handlers = []
    if PROXY:
        handlers.append(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))
    opener = urllib.request.build_opener(*handlers)
    with opener.open(req, timeout=45) as r:
        return json.loads(r.read().decode("utf-8", "replace")), url


def strip_wiki(text):
    """把 wikitext 粗洗成可读文本：去模板、去标签、保留表格单元格。"""
    # 表格行转成 " | " 分隔，便于阅读数值表
    text = re.sub(r"\{\{\s*\|", "\n{{|", text)
    text = re.sub(r"^\s*\{\|.*$", "\n[TABLE]", text, flags=re.M)
    text = re.sub(r"^\s*\|\}", "[ENDTABLE]\n", text, flags=re.M)
    text = re.sub(r"^\s*\|[^|]*\|", " | ", text, flags=re.M)
    text = re.sub(r"^\s*\|", " | ", text, flags=re.M)
    text = re.sub(r"^\s*!", " | ", text, flags=re.M)
    text = re.sub(r"^\s*-{3,}.*$", "", text, flags=re.M)
    # 去掉引用/模板（含嵌套，多轮）
    for _ in range(6):
        new = re.sub(r"\{\{[^{}]*\}\}", "", text)
        if new == text:
            break
        text = new
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[https?://\S+\s+([^\]]+)\]", r"\1", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("site", choices=list(SITES))
    ap.add_argument("page", nargs="?", default=None)
    ap.add_argument("--search", default=None)
    ap.add_argument("--limit", type=int, default=4000)
    args = ap.parse_args()
    api = SITES[args.site]

    if args.search:
        data, url = call(api, {"action": "query", "list": "search", "srsearch": args.search,
                               "srlimit": 20, "format": "json"})
        print(f"# search: {url}")
        for item in data.get("query", {}).get("search", []):
            print(f"  {item['title']}")
        return

    data, url = call(api, {"action": "parse", "page": args.page, "prop": "wikitext",
                           "format": "json", "formatversion": 2, "redirects": 1})
    print(f"# api: {url}")
    if "error" in data:
        print(f"# ERROR: {data['error'].get('code')} / {data['error'].get('info')}")
        sys.exit(2)
    parse = data["parse"]
    title = parse["title"]
    wikitext = parse["wikitext"]
    slug = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", title)[:80]
    outdir = os.path.join(OUT_ROOT, args.site)
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, slug + ".wikitext"), "w", encoding="utf-8") as f:
        f.write(wikitext)
    plain = strip_wiki(wikitext)
    with open(os.path.join(outdir, slug + ".txt"), "w", encoding="utf-8") as f:
        f.write(plain)
    print(f"# title: {title}  (chars: wikitext={len(wikitext)}, plain={len(plain)})")
    print("#" + "-" * 70)
    print(plain[:args.limit])


if __name__ == "__main__":
    main()
