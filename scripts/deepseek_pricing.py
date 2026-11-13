#!/usr/bin/env python3
"""DeepSeek API billing window in Asia/Shanghai (no external dependencies).

Official pricing: peak Mon-Fri 09:00-12:00 and 14:00-18:00,
excluding Chinese statutory holidays; weekends, including makeup
workdays on Saturdays/Sundays, are off-peak (explicit overrides below).

2026: 国办发明电〔2025〕7号 (2025-11-04)
https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
2027: 国办发明电〔2026〕10号 (2026-11-05)
https://paper.people.com.cn/rmrb/pc/content/202611/06/content_30189674.html

Update the table when a new official notice is published. For unknown
years, never assume an unlisted weekday is a holiday: default to
weekday peak windows (conservative cost behavior).
"""

from datetime import datetime
from zoneinfo import ZoneInfo

BEIJING = ZoneInfo("Asia/Shanghai")
HOLIDAY_SPANS = {
    2026: (
        ("2026-01-01", "2026-01-03"),
        ("2026-02-15", "2026-02-23"),
        ("2026-04-04", "2026-04-06"),
        ("2026-05-01", "2026-05-05"),
        ("2026-06-19", "2026-06-21"),
        ("2026-09-25", "2026-09-27"),
        ("2026-10-01", "2026-10-07"),
    ),
    2027: (
        ("2027-01-01", "2027-01-03"),
        ("2027-02-05", "2027-02-13"),
        ("2027-04-03", "2027-04-05"),
        ("2027-05-01", "2027-05-05"),
        ("2027-06-09", "2027-06-09"),
        ("2027-09-15", "2027-09-15"),
        ("2027-10-01", "2027-10-07"),
    ),
}


# Make-up workdays explicitly remain off-peak, even though they are
# administratively designated workdays. This is also the requested policy
# if an exceptional make-up date were ever on a weekday.
MAKEUP_WORKDAYS = {
    2026: frozenset((
        "2026-01-04", "2026-02-14", "2026-02-28",
        "2026-05-09", "2026-09-20", "2026-10-10",
    )),
    2027: frozenset((
        "2027-01-31", "2027-02-14", "2027-05-08",
        "2027-09-26", "2027-10-09",
    )),
}


def pricing_window(moment: datetime | None = None) -> tuple[str, str]:
    """Return ("peak"|"offpeak", reason) using real Beijing local time.

    Input must be timezone-aware; a missing input uses the current time
    (only once). End boundaries 12:00 and 18:00 are exclusive.
    """
    if moment is None:
        local = datetime.now(BEIJING)
    elif moment.tzinfo is None:
        raise ValueError("pricing_window requires a timezone-aware datetime")
    else:
        local = moment.astimezone(BEIJING)

    today = local.date().isoformat()
    if any(start <= today <= end for start, end in HOLIDAY_SPANS.get(local.year, ())):
        return "offpeak", "statutory-holiday"
    if today in MAKEUP_WORKDAYS.get(local.year, ()):
        return "offpeak", "makeup-workday"
    if local.weekday() >= 5:
        return "offpeak", "weekend"

    minute = local.hour * 60 + local.minute
    if 9 * 60 <= minute < 12 * 60 or 14 * 60 <= minute < 18 * 60:
        return "peak", "weekday-peak-window"
    return "offpeak", "outside-peak-window"
