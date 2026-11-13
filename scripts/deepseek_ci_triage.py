#!/usr/bin/env python3
"""Advisory-only CI failure diagnosis. Never alters test, check or release status."""
import json
import os
import re
import sys
import urllib.error
import urllib.request

from deepseek_pricing import pricing_window

API = "https://api.deepseek.com/chat/completions"
REPO = os.environ["GITHUB_REPOSITORY"]
RUN_ID = os.environ["SOURCE_RUN_ID"]
TOKEN = os.environ["GH_TOKEN"]
KEY = os.environ.get("DEEPSEEK_API_KEY", "")
SUMMARY = os.environ["GITHUB_STEP_SUMMARY"]

def write(message):
    with open(SUMMARY, "a", encoding="utf-8") as out:
        out.write(message + "\n")

def github(path):
    req = urllib.request.Request(
        "https://api.github.com/" + path,
        headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/vnd.github+json",
                 "User-Agent": "oreki-ci-diagnostic"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)

def scrub(value):
    value = re.sub(r"(?i)(sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,}|github_pat_[a-z0-9_]{12,})",
                   "[REDACTED_TOKEN]", value)
    value = re.sub(r"(?i)(authorization|api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s,;]+",
                   r"\1=[REDACTED]", value)
    value = re.sub(r"(?i)https?://[^\s/@]+:[^\s/@]+@", "https://[REDACTED]@", value)
    return value[:10000]

def main():
    write("## DeepSeek CI failure diagnosis (advisory only)")
    write("Original CI failure remains **FAIL**. AI diagnosis cannot approve a release.")
    # Hard billing guard: skip BEFORE querying GitHub or contacting DeepSeek.
    # Only optional AI commentary becomes green; the source workflow still FAILs.
    period, reason = pricing_window()
    if period == "peak":
        write("**SKIPPED (peak hours, green advisory):** 09:00-12:00 / "
              "14:00-18:00 Beijing weekdays. No DeepSeek API request was made.")
        return
    write(f"**Off-peak billing window:** {reason}; DeepSeek calls permitted.")
    if not KEY:
        write("**SKIPPED:** `DEEPSEEK_API_KEY` is not configured in this repository.")
        return
    try:
        jobs = github(f"repos/{REPO}/actions/runs/{RUN_ID}/jobs?per_page=100")["jobs"]
        failed = [job for job in jobs if job.get("conclusion") == "failure"]
        if not failed:
            write("**SKIPPED:** no failed jobs found in the triggering run.")
            return
        data = [{"job": j["name"], "failed_steps": [
            s["name"] for s in j.get("steps", []) if s.get("conclusion") == "failure"
        ]} for j in failed[:12]]
        # Do not send raw job logs, environment variables, source files or artifacts
        # to a third party. Job/step names and the run URL are sufficient for triage.
        payload = json.dumps({"repository": REPO, "run_id": RUN_ID,
                              "failed_jobs": data}, ensure_ascii=False)
        body = json.dumps({
            "model": "deepseek-flash", "temperature": 0.1, "max_tokens": 700,
            "messages": [
                {"role": "system", "content": "You are a CI triage assistant. Answer in concise Simplified Chinese. Infer only from the provided job and step names. Distinguish facts from hypotheses. Never claim a check passed, suggest bypassing a gate, or request credentials. Provide next diagnostic actions."},
                {"role": "user", "content": scrub(payload)}
            ]}).encode("utf-8")
        req = urllib.request.Request(API, data=body, headers={
            "Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504):
                write(f"**SKIPPED (green advisory):** DeepSeek busy / rate-limited (HTTP {exc.code}). Original CI status is unchanged.")
                return
            write(f"**SKIPPED:** DeepSeek API returned HTTP {exc.code}. Check the secret and API account.")
            return
        analysis = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not analysis:
            write("**SKIPPED:** empty model response.")
            return
        write("\n" + scrub(analysis)[:5000])
    except (OSError, ValueError, KeyError, TimeoutError) as exc:
        write("**SKIPPED:** diagnostic service unavailable; original CI result unchanged.")
        print(f"Advisory diagnosis skipped: {type(exc).__name__}", file=sys.stderr)

if __name__ == "__main__":
    main()
