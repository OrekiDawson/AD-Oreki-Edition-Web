"""Regression checks for DeepSeek API peak/off-peak billing (Beijing time)."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts") if
                Path(__file__).resolve().parent.name == "tests" and
                (Path(__file__).resolve().parents[1] / "scripts").exists() else
                str(Path(__file__).resolve().parents[1]))
from deepseek_pricing import pricing_window

BJ = ZoneInfo("Asia/Shanghai")


def at(date: str, hm: str):
    return datetime.fromisoformat(f"{date}T{hm}:00").replace(tzinfo=BJ)


class DeepSeekPricingTests(unittest.TestCase):
    def test_regular_weekday_exact_boundaries(self):
        expected = {
            "08:59": "offpeak",
            "09:00": "peak",
            "11:59": "peak",
            "12:00": "offpeak",
            "13:59": "offpeak",
            "14:00": "peak",
            "17:59": "peak",
            "18:00": "offpeak",
            "23:59": "offpeak",
        }
        for hour, result in expected.items():
            with self.subTest(hour=hour):
                self.assertEqual(pricing_window(at("2026-11-13", hour))[0], result)

    def test_2026_statutory_holidays(self):
        dates = ["2026-01-01", "2026-02-16", "2026-04-06", "2026-05-04",
                 "2026-06-19", "2026-09-25", "2026-10-01", "2026-10-07"]
        for day in dates:
            with self.subTest(day=day):
                self.assertEqual(pricing_window(at(day, "09:30")),
                                 ("offpeak", "statutory-holiday"))

    def test_2027_statutory_holidays(self):
        dates = ["2027-01-01", "2027-02-05", "2027-02-12", "2027-04-05",
                 "2027-05-05", "2027-06-09", "2027-09-15", "2027-10-01",
                 "2027-10-07"]
        for day in dates:
            with self.subTest(day=day):
                self.assertEqual(pricing_window(at(day, "14:00"))[0], "offpeak")

    def test_weekends_including_makeup_workdays(self):
        # Official pricing says Mon-Fri, not 'all administratively working days'.
        self.assertEqual(pricing_window(at("2026-11-14", "09:30")),
                         ("offpeak", "weekend"))
        for day in ["2026-01-04", "2026-02-14", "2026-02-28",
                    "2026-05-09", "2026-09-20", "2026-10-10",
                    "2027-01-31", "2027-02-14", "2027-05-08",
                    "2027-09-26", "2027-10-09"]:
            with self.subTest(day=day):
                self.assertEqual(pricing_window(at(day, "09:30")),
                                 ("offpeak", "makeup-workday"))
                self.assertEqual(pricing_window(at(day, "14:00"))[0],
                                 "offpeak")

    def test_utc_conversion_and_unknown_year(self):
        self.assertEqual(
            pricing_window(datetime(2026, 11, 13, 1, 0, tzinfo=timezone.utc))[0],
            "peak")
        self.assertEqual(
            pricing_window(datetime(2026, 11, 13, 4, 0, tzinfo=timezone.utc))[0],
            "offpeak")
        self.assertEqual(pricing_window(at("2028-01-03", "10:00"))[0], "peak")

    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            pricing_window(datetime(2026, 11, 13, 10))


if __name__ == "__main__":
    unittest.main()
