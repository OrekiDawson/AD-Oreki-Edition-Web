#!/usr/bin/env python3
"""Validate staged Pages bytes BEFORE git push. No external dependencies."""
from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "link" and values.get("href"):
            self.refs.append(values["href"])
        if tag in {"script", "source", "img"} and values.get("src"):
            self.refs.append(values["src"])


def validate_site(folder: Path) -> list[str]:
    root = folder.resolve()
    errors: list[str] = []
    for name in (".nojekyll", "index.html", "src/main.js", "public/icon.png"):
        if not (root / name).is_file():
            errors.append(f"Missing required file: {name}")
    for name in ("src", "modules", "public"):
        if not (root / name).is_dir():
            errors.append(f"Missing required directory: {name}")
    domain = root / "CNAME"
    if not domain.is_file() or domain.read_text(encoding="utf-8").strip() != "oreki.net":
        errors.append("CNAME must contain only oreki.net")
    index = root / "index.html"
    if not index.is_file():
        return errors
    parser = References()
    parser.feed(index.read_text(encoding="utf-8"))
    for url in parser.refs:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        try:
            decoded = unquote(parsed.path)
            target = (root / decoded.lstrip("/")).resolve()
            target.relative_to(root)
        except (ValueError, OSError):
            errors.append(f"Unsafe local asset path: {url}")
            continue
        if not target.is_file():
            errors.append(f"Missing local HTML asset: {url}")
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_pages_staging.py <staged-pages-directory>", file=sys.stderr)
        return 2
    errors = validate_site(Path(sys.argv[1]))
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("PASS: Staged Pages deployment has a valid domain, entrypoint and local assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
