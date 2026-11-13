"""Tests for the data pipeline scripts. All data here is synthetic.

    python -m unittest discover -s tests
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import import_linkedin as li  # noqa: E402
import sync_github as gh  # noqa: E402
from portfolio_common import DataError, load_overrides, write_generated  # noqa: E402

NOW = datetime(2026, 11, 13, tzinfo=timezone.utc)


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def fake_repo(name: str, **extra) -> dict:
    repo = {
        "name": name,
        "full_name": f"someone/{name}",
        "html_url": f"https://github.com/someone/{name}",
        "languages_url": f"https://api.github.com/repos/someone/{name}/languages",
        "description": "A test repo",
        "homepage": "",
        "topics": ["portfolio", "unity"],
        "language": "C#",
        "stargazers_count": 3,
        "archived": False,
        "fork": False,
        "private": False,
        "created_at": "2024-03-01T00:00:00Z",
        "pushed_at": "2025-01-10T00:00:00Z",
    }
    repo.update(extra)
    return repo


class TempDirTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()


# ---------------------------------------------------------------------------
# LinkedIn import
# ---------------------------------------------------------------------------

class ParseDateTests(unittest.TestCase):
    def test_formats(self):
        cases = {
            "Jan 2023": "2023-01",
            "September 2021": "2021-09",
            "Sept 2021": "2021-09",
            "2020": "2020",
            "2022-7": "2022-07",
            "2022-07-15": "2022-07",
            "03/2019": "2019-03",
            "3/15/2019": "2019-03",
            "": None,
            "   ": None,
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(li.parse_date(text, "test"), expected)

    def test_rejects_garbage(self):
        for text in ("Present", "Smarch 2020", "13/2020", "20xx"):
            with self.subTest(text=text), self.assertRaises(DataError):
                li.parse_date(text, "test")


POSITIONS_CSV = """﻿Company Name,Title,Description,Location,Started On,Finished On
Example Studio,Gameplay Programmer,"Built systems, shipped things.","Remote",Jan 2024,
Sample Corp,Intern,,Somewhere,Jun 2022,Aug 2022
,No company but titled,,,2021,2021
Missing Title Inc,,,,2020,2020
"""

EDUCATION_CSV = """School Name,Start Date,End Date,Notes,Degree Name,Activities
Example University,2019,2023,private notes that must not be copied,Bachelor of Science,Chess club
Night School,,,,,
"""


class LinkedInImportTests(TempDirTest):
    def test_positions(self):
        path = write(self.tmp / "Positions.csv", POSITIONS_CSV)
        items = li.parse_positions(path)
        self.assertEqual([i["title"] for i in items], ["Gameplay Programmer", "Intern", "No company but titled"])
        first = items[0]
        self.assertEqual(first["organization"], "Example Studio")
        self.assertEqual(first["start"], "2024-01")
        self.assertIsNone(first["end"])
        self.assertEqual(first["description"], "Built systems, shipped things.")
        self.assertEqual(first["id"], "example-studio-gameplay-programmer-2024-01")
        self.assertEqual(first["kind"], "work")

    def test_education_reads_only_needed_columns(self):
        path = write(self.tmp / "Education.csv", EDUCATION_CSV)
        items = li.parse_education(path)
        self.assertEqual(items[0]["title"], "Bachelor of Science")
        self.assertEqual(items[0]["start"], "2019")
        self.assertEqual(items[1]["title"], "Night School")
        dumped = json.dumps(items)
        self.assertNotIn("private notes", dumped)
        self.assertNotIn("Chess club", dumped)

    def test_header_after_note_lines(self):
        text = 'Notes:\n"Some preamble LinkedIn adds"\n\n' + POSITIONS_CSV.lstrip("﻿")
        items = li.parse_positions(write(self.tmp / "Positions.csv", text))
        self.assertEqual(len(items), 3)

    def test_wrong_file_is_an_error(self):
        path = write(self.tmp / "Positions.csv", "First Name,Last Name\nA,B\n")
        with self.assertRaises(DataError):
            li.parse_positions(path)

    def test_end_before_start_is_an_error(self):
        path = write(self.tmp / "Positions.csv", "Company Name,Title,Started On,Finished On\nX,Y,2024,2020\n")
        with self.assertRaises(DataError):
            li.parse_positions(path)

    def test_build_sorts_and_applies_overrides(self):
        positions = li.parse_positions(write(self.tmp / "Positions.csv", POSITIONS_CSV))
        education = li.parse_education(write(self.tmp / "Education.csv", EDUCATION_CSV))
        overrides = {
            "sample-corp-intern-2022-06": {"highlights": ["Did a thing"]},
            "no-company-but-titled-2021": {"hidden": True},
        }
        extra = [{"id": "jam", "kind": "work", "title": "Game jam organiser", "start": "2023-02", "end": "2023-02"}]
        items = li.build_career(positions, education, overrides, extra)
        titles = [i["title"] for i in items]
        self.assertEqual(titles[0], "Gameplay Programmer")  # ongoing first
        self.assertNotIn("No company but titled", titles)
        intern = next(i for i in items if i["title"] == "Intern")
        self.assertEqual(intern["highlights"], ["Did a thing"])
        jam = next(i for i in items if i["id"] == "jam")
        self.assertEqual(jam["source"], "manual")

    def test_extra_needs_valid_kind(self):
        with self.assertRaises(DataError):
            li.build_career([], [], {}, [{"id": "x", "kind": "hobby", "title": "X"}])

    def test_duplicate_ids_are_made_unique(self):
        csv_text = "Company Name,Title,Started On,Finished On\nA,B,2020,2021\nA,B,2020,2022\n"
        items = li.build_career(li.parse_positions(write(self.tmp / "Positions.csv", csv_text)), [], {}, [])
        self.assertEqual(len({i["id"] for i in items}), 2)


# ---------------------------------------------------------------------------
# GitHub sync
# ---------------------------------------------------------------------------

class GitHubSyncTests(unittest.TestCase):
    def test_select_by_topic(self):
        repos = [
            fake_repo("shown"),
            fake_repo("untagged", topics=["unity"]),
            fake_repo("no-topics", topics=None),
            fake_repo("private", private=True),
        ]
        self.assertEqual([r["name"] for r in gh.select_repos(repos, "portfolio")], ["shown"])

    def test_to_project(self):
        repo = fake_repo("My-Cool_Game", homepage="https://example.com/play", pushed_at="2026-10-01T00:00:00Z")
        project = gh.to_project(repo, {"C#": 750, "ShaderLab": 250}, "portfolio", NOW)
        self.assertEqual(project["title"], "My Cool Game")
        self.assertEqual(project["tags"], ["unity"])
        self.assertEqual(project["start"], "2024-03")
        self.assertIsNone(project["end"])  # pushed recently -> ongoing
        self.assertEqual(project["languages"], [{"name": "C#", "percent": 75.0}, {"name": "ShaderLab", "percent": 25.0}])
        self.assertEqual([l["kind"] for l in project["links"]], ["repo", "demo"])

    def test_inactive_and_archived_have_end_dates(self):
        old = gh.to_project(fake_repo("old"), {}, "portfolio", NOW)
        self.assertEqual(old["end"], "2025-01")
        archived = gh.to_project(fake_repo("arch", archived=True, pushed_at="2026-11-01T00:00:00Z"), {}, "portfolio", NOW)
        self.assertEqual(archived["end"], "2026-11")

    def test_unsafe_homepage_is_dropped(self):
        project = gh.to_project(fake_repo("x", homepage="javascript:alert(1)"), {}, "portfolio", NOW)
        self.assertEqual([l["kind"] for l in project["links"]], ["repo"])

    def test_build_with_overrides_and_order(self):
        repos = [fake_repo("a", pushed_at="2023-01-01T00:00:00Z"), fake_repo("b"), fake_repo("c")]
        overrides = {"c": {"featured": True, "title": "Project C"}, "b": {"hidden": True}}
        extra = [{"id": "jam-game", "title": "Jam Game", "start": "2022-05", "end": "2022-05"}]
        items = gh.build_projects(repos, {}, "portfolio", overrides, extra, NOW)
        self.assertEqual([i["id"] for i in items], ["c", "a", "jam-game"])
        self.assertEqual(items[0]["title"], "Project C")
        self.assertEqual(items[2]["source"], "manual")


# ---------------------------------------------------------------------------
# Overrides + output
# ---------------------------------------------------------------------------

class OverridesTests(TempDirTest):
    def load(self, payload):
        path = write(self.tmp / "o.json", payload if isinstance(payload, str) else json.dumps(payload))
        return load_overrides(path, gh.OVERRIDE_SCHEMA, gh.EXTRA_SCHEMA)

    def test_missing_file_is_empty(self):
        self.assertEqual(load_overrides(self.tmp / "nope.json", gh.OVERRIDE_SCHEMA, gh.EXTRA_SCHEMA), ({}, []))

    def test_valid(self):
        overrides, extra = self.load({
            "overrides": {"repo": {"role": "Lead", "image": {"src": "assets/img/x.webp", "alt": "X", "width": 10, "height": 5}}},
            "extra": [{"id": "e", "title": "E", "links": [{"kind": "video", "url": "https://example.com/v"}]}],
        })
        self.assertIn("repo", overrides)
        self.assertEqual(extra[0]["id"], "e")

    def test_errors(self):
        bad = [
            "{ not json",
            [],
            {"overides": {}},
            {"overrides": {"r": {"titel": "typo"}}},
            {"overrides": {"r": {"start": "March 2024"}}},
            {"overrides": {"r": {"links": [{"kind": "demo", "url": "javascript:alert(1)"}]}}},
            {"overrides": {"r": {"image": {"src": "javascript:x", "alt": "a"}}}},
            {"overrides": {"r": {"featured": "yes"}}},
            {"extra": [{"title": "no id"}]},
            {"extra": [{"id": "x", "title": "A"}, {"id": "x", "title": "B"}]},
        ]
        for payload in bad:
            with self.subTest(payload=payload), self.assertRaises(DataError):
                self.load(payload)


class WriteGeneratedTests(TempDirTest):
    def test_synced_at_kept_when_unchanged(self):
        path = self.tmp / "out.json"
        self.assertTrue(write_generated(path, "test", [{"id": "a"}]))
        first = json.loads(path.read_text(encoding="utf-8"))
        self.assertFalse(write_generated(path, "test", [{"id": "a"}]))
        self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["syncedAt"], first["syncedAt"])
        self.assertTrue(write_generated(path, "test", [{"id": "b"}]))


if __name__ == "__main__":
    unittest.main()
