#!/usr/bin/env python3
"""Guard new tracked content without failing solely on historical repository debt.

This check is intentionally narrow: it detects explicit private key/token
markers, sensitive file additions, CRLF in changed textual files, and (Android)
new Java/Smali payload files. It cannot prove a code change is safe or honest.
"""
from __future__ import annotations

import argparse
from fnmatch import fnmatch
from pathlib import Path
import re
import subprocess

TEXT_SUFFIXES = {
    ".kt", ".java", ".smali", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx",
    ".json", ".md", ".txt", ".yml", ".yaml", ".xml", ".html", ".css",
    ".sh", ".gradle", ".kts", ".properties", ".toml", ".svg",
}
BLOCKED_NEW_NAMES = {
    "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", ".env",
    "credentials.json", "service-account.json",
}
BLOCKED_NEW_SUFFIXES = {".jks", ".keystore", ".p12", ".pfx", ".key"}
SECRET_MARKERS = re.compile(
    rb"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----"
    rb"|github_pat_[A-Za-z0-9_]{20,}"
    rb"|gh[pousr]_[A-Za-z0-9]{20,}"
    rb"|sk-proj-[A-Za-z0-9_-]{20,}"
    rb"|AKIA[A-Z0-9]{16}"
)
SHA = re.compile(r"[0-9a-f]{40}\Z")


def git(*args: str) -> bytes:
    result = subprocess.run(["git", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("Git comparison failed: " + result.stderr.decode("utf-8", "replace").strip())
    return result.stdout


def changed_paths(base: str, filter_name: str) -> set[str]:
    raw = git("diff", "--no-ext-diff", "--name-only", "-z", f"--diff-filter={filter_name}",
              base, "HEAD", "--")
    return {name.decode("utf-8") for name in raw.split(b"\0") if name}


def new_lines(base: str, path: str) -> list[bytes]:
    diff = git("diff", "--no-ext-diff", "--no-color", "--unified=0",
               base, "HEAD", "--", path)
    return [line[1:] for line in diff.splitlines() if line.startswith(b"+") and not line.startswith(b"+++ ")]


def inspect(path: str, blob: bytes, added: list[bytes], is_new: bool, policy: str) -> list[str]:
    issues = []
    name = Path(path).name.lower()
    suffix = Path(path).suffix.lower()
    if is_new and (name in BLOCKED_NEW_NAMES or suffix in BLOCKED_NEW_SUFFIXES
                   or (name.startswith(".env.") and not name.endswith((".example", ".sample", ".template")))):
        issues.append("sensitive credential/key filename added")
    if policy == "android" and is_new and path.startswith("scripts/payload/") and suffix in {".java", ".smali"}:
        issues.append("new Android Java/Smali payload prohibited; Kotlin business only")
    if suffix in TEXT_SUFFIXES and b"\r" in blob:
        issues.append("modified text contains CR instead of LF-only lines")
    if any(SECRET_MARKERS.search(line) for line in added):
        issues.append("new text contains a private-key or credential-shaped marker")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Trusted full 40-digit Git base commit")
    parser.add_argument("--policy", required=True, choices=["android", "web", "private", "pages"])
    args = parser.parse_args()
    if not SHA.fullmatch(args.base):
        parser.error("--base must be an exact 40-character lowercase SHA")
    # Fail closed if a caller supplied an unresolved/stale comparison base.
    git("cat-file", "-e", f"{args.base}^{{commit}}")
    current = changed_paths(args.base, "ACMR")
    added_paths = changed_paths(args.base, "A")
    failures = []
    for path in sorted(current):
        # Read the *tracked blob* rather than potentially untracked workspace edits.
        blob = git("show", f"HEAD:{path}")
        for issue in inspect(path, blob, new_lines(args.base, path), path in added_paths, args.policy):
            failures.append((path, issue))
    if failures:
        for path, issue in failures:
            print(f"FAIL: {path}: {issue}")
        print(f"FAIL: {len(failures)} newly introduced repository policy violation(s)")
        return 1
    print(f"PASS: {len(current)} changed files checked; no new credential/LF/"
          f"{args.policy} source-format violations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
