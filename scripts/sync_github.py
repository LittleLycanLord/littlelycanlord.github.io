#!/usr/bin/env python3
"""Sync portfolio projects from GitHub.

Selects the user's public repos tagged with the `portfolio` topic, collects
their metadata and language breakdown, applies `data/overrides/projects.json`,
and writes `data/generated/projects.json`.

    python scripts/sync_github.py            # sync
    python scripts/sync_github.py --list     # show all repos and their topics (no writes)

Set GITHUB_TOKEN to raise the API rate limit (60/hour unauthenticated). The
Actions workflow provides one automatically.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from portfolio_common import (
    GENERATED_DIR,
    OVERRIDES_DIR,
    DataError,
    apply_overrides,
    is_safe_url,
    load_overrides,
    rel,
    run,
    warn,
    write_generated,
)

API = "https://api.github.com"
DEFAULT_USER = "LittleLycanLord"
DEFAULT_TOPIC = "portfolio"
# A repo pushed to within this window counts as active ("Now" on the timeline).
ACTIVE_DAYS = 120

OVERRIDE_SCHEMA = {
    "title": "nonempty",
    "description": "string",
    "role": "string",
    "status": "string",
    "start": "date",
    "end": "date_or_null",
    "highlights": "str_list",
    "tags": "str_list",
    "image": "image",
    "links": "links",
    "featured": "bool",
    "order": "int",
    "hidden": "bool",
}
EXTRA_SCHEMA = {**OVERRIDE_SCHEMA, "id": "nonempty"}


# ---------------------------------------------------------------------------
# GitHub API
# ---------------------------------------------------------------------------

def fetch_json(url: str, token: str | None):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "portfolio-sync-script",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        hint = ""
        if exc.code in (403, 429) and exc.headers.get("X-RateLimit-Remaining") == "0":
            hint = " (rate limit reached; set GITHUB_TOKEN or wait an hour)"
        raise DataError(f"GitHub API {exc.code} for {url}{hint}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise DataError(f"could not reach GitHub ({url}): {exc.reason}") from exc


def fetch_repos(user: str, token: str | None) -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"type": "owner", "per_page": 100, "page": page, "sort": "pushed"})
        batch = fetch_json(f"{API}/users/{urllib.parse.quote(user)}/repos?{query}", token)
        if not isinstance(batch, list):
            raise DataError(f"unexpected response listing repos for {user}")
        repos.extend(batch)
        if len(batch) < 100:
            return repos
        page += 1


def fetch_languages(repo: dict, token: str | None) -> dict[str, int]:
    data = fetch_json(repo["languages_url"], token)
    if not isinstance(data, dict):
        raise DataError(f"unexpected languages response for {repo['full_name']}")
    return {name: count for name, count in data.items() if isinstance(count, int)}


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------

def select_repos(repos: list[dict], topic: str) -> list[dict]:
    return [r for r in repos if not r.get("private") and topic in (r.get("topics") or [])]


def year_month(iso: str | None) -> str | None:
    return iso[:7] if iso else None


def language_breakdown(languages: dict[str, int]) -> list[dict]:
    total = sum(languages.values())
    if not total:
        return []
    ordered = sorted(languages.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"name": name, "percent": round(count * 100 / total, 1)} for name, count in ordered]


def is_active(repo: dict, now: datetime) -> bool:
    if repo.get("archived") or not repo.get("pushed_at"):
        return False
    pushed = datetime.fromisoformat(repo["pushed_at"].replace("Z", "+00:00"))
    return now - pushed <= timedelta(days=ACTIVE_DAYS)


def to_project(repo: dict, languages: dict[str, int], topic: str, now: datetime) -> dict:
    links = [{"kind": "repo", "label": "Source code", "url": repo["html_url"]}]
    homepage = (repo.get("homepage") or "").strip()
    if homepage:
        if homepage.startswith(("https://", "http://")) and is_safe_url(homepage):
            links.append({"kind": "demo", "label": "Live demo", "url": homepage})
        else:
            warn(f"{repo['name']}: ignoring homepage {homepage!r} (must start with http:// or https://)")

    description = (repo.get("description") or "").strip()
    if not description:
        warn(f"{repo['name']}: no description on GitHub; add one there or in data/overrides/projects.json")

    return {
        "id": repo["name"],
        "source": "github",
        "title": repo["name"].replace("-", " ").replace("_", " ").strip(),
        "description": description,
        "url": repo["html_url"],
        "language": repo.get("language"),
        "languages": language_breakdown(languages),
        "tags": sorted(t for t in (repo.get("topics") or []) if t != topic),
        "stars": repo.get("stargazers_count", 0),
        "archived": bool(repo.get("archived")),
        "fork": bool(repo.get("fork")),
        "createdAt": repo.get("created_at"),
        "pushedAt": repo.get("pushed_at"),
        "start": year_month(repo.get("created_at")),
        "end": None if is_active(repo, now) else year_month(repo.get("pushed_at")),
        "links": links,
        "featured": False,
    }


def sort_projects(items: list[dict]) -> list[dict]:
    """Featured first, then explicit `order`, then most recent end (ongoing first), then latest start."""
    items = sorted(items, key=lambda i: i.get("start") or "", reverse=True)
    items = sorted(items, key=lambda i: i.get("end") or "9999-99", reverse=True)
    items = sorted(items, key=lambda i: i.get("order", 1_000_000))
    return sorted(items, key=lambda i: not i.get("featured"))


def build_projects(repos: list[dict], languages_by_repo: dict[str, dict[str, int]], topic: str,
                   overrides: dict, extra: list, now: datetime) -> list[dict]:
    items = [to_project(r, languages_by_repo.get(r["name"], {}), topic, now) for r in repos]
    merged = apply_overrides(items, overrides, extra, label="projects overrides",
                             extra_defaults={"source": "manual", "description": "", "featured": False,
                                             "tags": [], "links": [], "end": None})
    return sort_projects(merged)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Sync portfolio projects from GitHub.")
    parser.add_argument("--user", default=os.environ.get("PORTFOLIO_GITHUB_USER", DEFAULT_USER))
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help="topic that opts a repo in (default: portfolio)")
    parser.add_argument("--list", action="store_true", help="list every public repo with its topics, then exit")
    parser.add_argument("--output", default=str(GENERATED_DIR / "projects.json"))
    parser.add_argument("--overrides", default=str(OVERRIDES_DIR / "projects.json"))
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN") or None
    # Validate overrides before spending API calls.
    overrides, extra = load_overrides(Path(args.overrides), OVERRIDE_SCHEMA, EXTRA_SCHEMA)

    repos = fetch_repos(args.user, token)
    if args.list:
        for repo in sorted(repos, key=lambda r: r["name"].lower()):
            mark = "*" if args.topic in (repo.get("topics") or []) else " "
            topics = ", ".join(repo.get("topics") or []) or "-"
            desc = "yes" if repo.get("description") else "no"
            print(f"{mark} {repo['name']:<40} description: {desc:<3}  topics: {topics}")
        print(f"\n* = tagged '{args.topic}' ({len(select_repos(repos, args.topic))} of {len(repos)})")
        return 0

    selected = select_repos(repos, args.topic)
    if not selected:
        warn(f"no public repos of {args.user} have the '{args.topic}' topic yet; only 'extra' entries will be written")
    languages = {r["name"]: fetch_languages(r, token) for r in selected}
    items = build_projects(selected, languages, args.topic, overrides, extra, datetime.now(timezone.utc))

    output = Path(args.output)
    changed = write_generated(output, "github", items, {"user": args.user, "topic": args.topic})
    print(f"{rel(output)}: {len(items)} project(s) from {len(selected)} tagged of {len(repos)} repos "
          f"({'updated' if changed else 'unchanged'})")
    return 0


if __name__ == "__main__":
    run(main)
