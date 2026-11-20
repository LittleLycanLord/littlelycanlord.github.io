"""Shared helpers for the portfolio data scripts.

Standard library only, so the scripts run the same locally and in CI with
nothing to install. Both scripts write `data/generated/*.json` in the shape:

    {
      "schemaVersion": 1,
      "source": "...",
      "syncedAt": "2026-11-13T02:00:00Z",
      "items": [ ... ]
    }

`syncedAt` only changes when `items` changes, so the nightly workflow does not
create a commit when nothing new happened.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = ROOT / "data" / "generated"
OVERRIDES_DIR = ROOT / "data" / "overrides"
SCHEMA_VERSION = 1

# "2024", "2024-03"
PARTIAL_DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2]))?$")


class DataError(Exception):
    """A problem with input data that must stop the run and be fixed."""


def warn(message: str) -> None:
    print(f"warning: {message}", file=sys.stderr)


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(*parts: str) -> str:
    text = "-".join(p for p in parts if p)
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "entry"


# ---------------------------------------------------------------------------
# Field validation (used for override files)
# ---------------------------------------------------------------------------

def _is_partial_date(value: Any) -> bool:
    return isinstance(value, str) and bool(PARTIAL_DATE.match(value))


def _is_str_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(v, str) and v.strip() for v in value)


def _is_image(value: Any) -> bool:
    if not isinstance(value, dict) or not isinstance(value.get("src"), str) or not isinstance(value.get("alt"), str):
        return False
    if set(value) - {"src", "alt", "width", "height"}:
        return False
    if not is_safe_url(value["src"]):
        return False
    return all(isinstance(value.get(k), int) and value[k] > 0 for k in ("width", "height") if k in value)


LINK_KINDS = {"repo", "demo", "video", "case-study", "link"}


def _is_links(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    for link in value:
        if not isinstance(link, dict) or set(link) - {"kind", "label", "url"}:
            return False
        if link.get("kind") not in LINK_KINDS or not isinstance(link.get("url"), str):
            return False
        if "label" in link and not isinstance(link["label"], str):
            return False
        if not is_safe_url(link["url"]):
            return False
    return True


def is_safe_url(url: str) -> bool:
    """http(s) URLs or site-relative paths only."""
    if url.startswith(("https://", "http://")):
        return True
    return bool(url) and not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", url) and not url.startswith("//")


# name -> (check, human description)
FIELD_TYPES: dict[str, tuple[Any, str]] = {
    "string": (lambda v: isinstance(v, str), "a string"),
    "nonempty": (lambda v: isinstance(v, str) and bool(v.strip()), "a non-empty string"),
    "bool": (lambda v: isinstance(v, bool), "true or false"),
    "int": (lambda v: isinstance(v, int) and not isinstance(v, bool), "a whole number"),
    "date": (_is_partial_date, 'a date like "2024" or "2024-03"'),
    "date_or_null": (lambda v: v is None or _is_partial_date(v), 'a date like "2024-03", or null for "present"'),
    "str_list": (_is_str_list, "a list of non-empty strings"),
    "image": (_is_image, 'an object {"src", "alt", "width"?, "height"?} with an http(s) or relative src'),
    "links": (_is_links, 'a list of {"kind", "label"?, "url"} with kind in ' + ", ".join(sorted(LINK_KINDS)) + " and an http(s) or relative url"),
}


def validate_fields(entry: Any, schema: dict[str, str], where: str) -> None:
    if not isinstance(entry, dict):
        raise DataError(f"{where}: must be an object")
    unknown = sorted(set(entry) - set(schema) - {"$comment"})
    if unknown:
        raise DataError(f"{where}: unknown field(s) {', '.join(unknown)}. Allowed: {', '.join(sorted(schema))}")
    for key, value in entry.items():
        if key == "$comment":
            continue
        check, description = FIELD_TYPES[schema[key]]
        if not check(value):
            raise DataError(f"{where}.{key}: must be {description}, got {json.dumps(value)}")


def load_overrides(path: Path, schema: dict[str, str], extra_schema: dict[str, str]) -> tuple[dict[str, dict], list[dict]]:
    """Read an overrides file: {"overrides": {id: {...}}, "extra": [{...}]}.

    Missing file -> no overrides. Malformed file -> DataError (never ignored).
    """
    if not path.exists():
        return {}, []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise DataError(f"{rel(path)}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc

    where = rel(path)
    if not isinstance(data, dict):
        raise DataError(f'{where}: top level must be an object with "overrides" and/or "extra"')
    unknown = sorted(set(data) - {"$comment", "overrides", "extra"})
    if unknown:
        raise DataError(f"{where}: unknown top-level key(s) {', '.join(unknown)}")

    overrides = data.get("overrides", {})
    extra = data.get("extra", [])
    if not isinstance(overrides, dict):
        raise DataError(f'{where}: "overrides" must be an object keyed by id')
    if not isinstance(extra, list):
        raise DataError(f'{where}: "extra" must be a list')

    for key, patch in overrides.items():
        validate_fields(patch, schema, f"{where}: overrides[{json.dumps(key)}]")
    seen: set[str] = set()
    for i, entry in enumerate(extra):
        entry_where = f"{where}: extra[{i}]"
        validate_fields(entry, extra_schema, entry_where)
        for required in ("id", "title"):
            if not isinstance(entry.get(required), str) or not entry[required].strip():
                raise DataError(f'{entry_where}: "{required}" is required')
        if entry["id"] in seen:
            raise DataError(f'{entry_where}: duplicate id "{entry["id"]}"')
        seen.add(entry["id"])
    return overrides, extra


def apply_overrides(items: list[dict], overrides: dict[str, dict], extra: list[dict], *, label: str, extra_defaults: dict) -> list[dict]:
    """Patch items by id, drop hidden ones, append extras. Warn about unmatched override ids."""
    known = {item["id"] for item in items}
    for key in overrides:
        if key not in known:
            warn(f'{label}: override "{key}" matches no entry (typo, or not selected yet?)')

    result = []
    for item in items:
        patch = overrides.get(item["id"], {})
        merged = {**item, **{k: v for k, v in patch.items() if k != "$comment"}}
        if not merged.pop("hidden", False):
            result.append(merged)

    for entry in extra:
        if entry["id"] in known:
            raise DataError(f'{label}: extra entry id "{entry["id"]}" clashes with a generated entry; use "overrides" to change it')
        merged = {**extra_defaults, **{k: v for k, v in entry.items() if k != "$comment"}}
        if not merged.pop("hidden", False):
            result.append(merged)
    return result


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_generated(path: Path, source: str, items: list[dict], meta: dict | None = None) -> bool:
    """Write the generated file. Returns True if the content changed.

    `syncedAt` is preserved when items and meta are unchanged, which keeps
    the nightly run from committing a timestamp-only diff.
    """
    meta = meta or {}
    previous = None
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            warn(f"{rel(path)} was not valid JSON and will be regenerated")

    unchanged = (
        isinstance(previous, dict)
        and previous.get("schemaVersion") == SCHEMA_VERSION
        and previous.get("source") == source
        and previous.get("items") == items
        and all(previous.get(k) == v for k, v in meta.items())
    )
    if unchanged:
        return False

    payload = {"schemaVersion": SCHEMA_VERSION, "source": source, "syncedAt": utc_now_iso(), **meta, "items": items}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def run(main) -> None:
    """Run a script entry point; print DataError cleanly and exit 1."""
    try:
        sys.exit(main())
    except DataError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
