#!/usr/bin/env python3
"""Import work experience and education from a LinkedIn data export.

Reads ONLY these two files (copied from the export) and only the columns listed
below, applies `data/overrides/career.json`, and writes
`data/generated/career.json`:

    content/linkedin/Positions.csv  Company Name, Title, Description, Location, Started On, Finished On
    content/linkedin/Education.csv  School Name, Start Date, End Date, Degree Name, Field Of Study (if present)

    python scripts/import_linkedin.py

If neither CSV exists yet, the career list is written empty with a warning, so
the rest of the site still builds.
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

from portfolio_common import (
    GENERATED_DIR,
    OVERRIDES_DIR,
    ROOT,
    DataError,
    apply_overrides,
    load_overrides,
    rel,
    run,
    slugify,
    warn,
    write_generated,
)

LINKEDIN_DIR = ROOT / "content" / "linkedin"

POSITION_COLUMNS = {
    "organization": "Company Name",
    "title": "Title",
    "description": "Description",
    "location": "Location",
    "start": "Started On",
    "end": "Finished On",
}
EDUCATION_COLUMNS = {
    "organization": "School Name",
    "degree": "Degree Name",
    "field": "Field Of Study",
    "start": "Start Date",
    "end": "End Date",
}

OVERRIDE_SCHEMA = {
    "title": "nonempty",
    "organization": "string",
    "location": "string",
    "description": "string",
    "employmentType": "string",
    "start": "date",
    "end": "date_or_null",
    "highlights": "str_list",
    "tags": "str_list",
    "links": "links",
    "order": "int",
    "hidden": "bool",
}
EXTRA_SCHEMA = {**OVERRIDE_SCHEMA, "id": "nonempty", "kind": "nonempty"}
KINDS = {"work", "education"}

MONTHS = {name: i for i, name in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_date(value: str, where: str) -> str | None:
    """LinkedIn dates -> "YYYY-MM" or "YYYY". Empty -> None (ongoing / not given)."""
    text = (value or "").strip()
    if not text:
        return None
    # "Jan 2023", "January 2023", "Sept 2023"
    match = re.fullmatch(r"([A-Za-z]+)\.?\s+(\d{4})", text)
    if match and match.group(1)[:3].lower() in MONTHS:
        return f"{match.group(2)}-{MONTHS[match.group(1)[:3].lower()]:02d}"
    # "2023"
    if re.fullmatch(r"\d{4}", text):
        return text
    # "2023-01", "2023-01-15"
    match = re.fullmatch(r"(\d{4})-(\d{1,2})(?:-\d{1,2})?", text)
    if match and 1 <= int(match.group(2)) <= 12:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    # "01/2023", "1/15/2023" (month first, as LinkedIn uses)
    match = re.fullmatch(r"(\d{1,2})/(?:\d{1,2}/)?(\d{4})", text)
    if match and 1 <= int(match.group(1)) <= 12:
        return f"{match.group(2)}-{int(match.group(1)):02d}"
    raise DataError(f'{where}: unrecognised date "{text}" (expected e.g. "Jan 2023" or "2023")')


def read_rows(path: Path, required: list[str]) -> list[tuple[int, dict[str, str]]]:
    """Return (line number, row) pairs. Finds the header row even if the export adds note lines above it."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    for header_index, header in enumerate(rows):
        names = [h.strip() for h in header]
        if all(col in names for col in required):
            break
    else:
        raise DataError(f"{rel(path)}: no header row with columns {', '.join(required)}. Is this the right file?")

    result = []
    for offset, values in enumerate(rows[header_index + 1:], start=header_index + 2):
        if not any(v.strip() for v in values):
            continue
        result.append((offset, {name: (values[i].strip() if i < len(values) else "") for i, name in enumerate(names)}))
    return result


def check_range(entry: dict, where: str) -> None:
    if entry["start"] and entry["end"] and entry["end"] < entry["start"]:
        raise DataError(f"{where}: ends ({entry['end']}) before it starts ({entry['start']})")


def parse_positions(path: Path) -> list[dict]:
    cols = POSITION_COLUMNS
    items = []
    for line, row in read_rows(path, [cols["organization"], cols["title"], cols["start"]]):
        where = f"{rel(path)} line {line}"
        title, org = row.get(cols["title"], ""), row.get(cols["organization"], "")
        if not title:
            warn(f"{where}: skipped (no Title)")
            continue
        start = parse_date(row.get(cols["start"], ""), f"{where} {cols['start']}")
        entry = {
            "id": slugify(org, title, start or ""),
            "kind": "work",
            "source": "linkedin",
            "title": title,
            "organization": org,
            "location": row.get(cols["location"], ""),
            "description": row.get(cols["description"], ""),
            "start": start,
            "end": parse_date(row.get(cols["end"], ""), f"{where} {cols['end']}"),
        }
        if not start:
            warn(f"{where}: no start date; it will sort last on the timeline")
        check_range(entry, where)
        items.append(entry)
    return items


def parse_education(path: Path) -> list[dict]:
    cols = EDUCATION_COLUMNS
    items = []
    for line, row in read_rows(path, [cols["organization"]]):
        where = f"{rel(path)} line {line}"
        school = row.get(cols["organization"], "")
        if not school:
            warn(f"{where}: skipped (no School Name)")
            continue
        degree, field = row.get(cols["degree"], ""), row.get(cols["field"], "")
        start = parse_date(row.get(cols["start"], ""), f"{where} {cols['start']}")
        title = ", ".join(p for p in (degree, field) if p) or school
        entry = {
            "id": slugify(school, degree, start or ""),
            "kind": "education",
            "source": "linkedin",
            "title": title,
            "organization": school,
            "location": "",
            "description": "",
            "start": start,
            "end": parse_date(row.get(cols["end"], ""), f"{where} {cols['end']}"),
        }
        check_range(entry, where)
        items.append(entry)
    return items


def dedupe_ids(items: list[dict]) -> None:
    seen: dict[str, int] = {}
    for item in items:
        base = item["id"]
        seen[base] = seen.get(base, 0) + 1
        if seen[base] > 1:
            item["id"] = f"{base}-{seen[base]}"


def sort_career(items: list[dict]) -> list[dict]:
    """Ongoing first, then most recent end, then latest start; `order` overrides."""
    items = sorted(items, key=lambda i: i.get("start") or "", reverse=True)
    items = sorted(items, key=lambda i: i.get("end") or "9999-99", reverse=True)
    return sorted(items, key=lambda i: i.get("order", 1_000_000))


def build_career(positions: list[dict], education: list[dict], overrides: dict, extra: list) -> list[dict]:
    items = positions + education
    dedupe_ids(items)
    for i, entry in enumerate(extra):
        if entry.get("kind") not in KINDS:
            raise DataError(f'career overrides: extra[{i}].kind must be one of {", ".join(sorted(KINDS))}')
    merged = apply_overrides(items, overrides, extra, label="career overrides",
                             extra_defaults={"source": "manual", "organization": "", "location": "",
                                             "description": "", "start": None, "end": None})
    return sort_career(merged)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Import career data from a LinkedIn export.")
    parser.add_argument("--input-dir", default=str(LINKEDIN_DIR), help="folder holding Positions.csv / Education.csv")
    parser.add_argument("--output", default=str(GENERATED_DIR / "career.json"))
    parser.add_argument("--overrides", default=str(OVERRIDES_DIR / "career.json"))
    args = parser.parse_args()

    overrides, extra = load_overrides(Path(args.overrides), OVERRIDE_SCHEMA, EXTRA_SCHEMA)

    input_dir = Path(args.input_dir)
    positions_csv, education_csv = input_dir / "Positions.csv", input_dir / "Education.csv"
    positions = parse_positions(positions_csv) if positions_csv.exists() else []
    education = parse_education(education_csv) if education_csv.exists() else []
    if not positions_csv.exists() and not education_csv.exists():
        warn(f"no LinkedIn export found in {rel(input_dir)} (Positions.csv / Education.csv); "
             "writing only 'extra' entries from the overrides file")

    items = build_career(positions, education, overrides, extra)
    output = Path(args.output)
    changed = write_generated(output, "linkedin-export", items)
    print(f"{rel(output)}: {len(items)} entr{'y' if len(items) == 1 else 'ies'} "
          f"({len(positions)} positions, {len(education)} education) "
          f"({'updated' if changed else 'unchanged'})")
    return 0


if __name__ == "__main__":
    run(main)
