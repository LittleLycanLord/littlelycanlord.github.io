# Portfolio data pipeline

Two scripts turn GitHub and LinkedIn into JSON for the site. They are standard-library Python, so there's nothing to install.

```bash
python scripts/sync_github.py          # GitHub → data/generated/projects.json
python scripts/sync_github.py --list   # which repos are tagged / have descriptions (no writes)
python scripts/import_linkedin.py      # content/linkedin/*.csv → data/generated/career.json
python -m unittest discover -s tests   # tests (synthetic data only)
```

Both scripts exit with an error, naming the file, line, and field, when an input is malformed. They never skip bad data silently. Missing inputs, such as no tagged repos or no export yet, produce a warning and an empty list, so the site can still build.

**Don't edit `data/generated/` by hand.** The next sync overwrites it. Put changes in `data/overrides/` instead.

## Sources

| Data | Where it comes from | How to change it |
| --- | --- | --- |
| Projects | Public GitHub repos of `LittleLycanLord` with the **`portfolio`** topic | Add or remove the topic, edit the description or website on GitHub |
| Work and education | `content/linkedin/Positions.csv` and `Education.csv` from a LinkedIn data export | Update LinkedIn, re-export, and replace the CSVs |
| Anything else | `data/overrides/projects.json` and `data/overrides/career.json` | Edit the JSON |

Set `GITHUB_TOKEN` locally if you hit GitHub's anonymous limit (60 requests an hour). In Actions, the token is provided automatically.

## Generated files

Both files share an envelope. `syncedAt` only changes when `items` changes, so a nightly run with nothing new makes no commit.

```json
{
  "schemaVersion": 1,
  "source": "github",
  "syncedAt": "2026-11-13T12:45:19Z",
  "items": []
}
```

Dates are `"YYYY-MM"` or `"YYYY"`. An `end` of `null` means **ongoing**: a current job, or a project pushed to in the last 120 days and not archived. The timeline shows these at "Now".

### `projects.json` item

| Field | Notes |
| --- | --- |
| `id` | Repo name (stable key for overrides) |
| `source` | `"github"` or `"manual"` (from `extra`) |
| `title` | Repo name with `-`/`_` turned into spaces. Override it for a nicer title. |
| `description` | GitHub description |
| `url` | Repo URL |
| `language`, `languages` | Primary language; breakdown `[{ "name", "percent" }]` |
| `tags` | GitHub topics, except `portfolio` |
| `stars`, `archived`, `fork`, `createdAt`, `pushedAt` | From GitHub |
| `start`, `end` | Created month; last-push month, or `null` if active |
| `links` | `[{ "kind", "label", "url" }]`. The repo link always comes first, then the demo link if the repo's *Website* is set. |
| `featured` | `false` unless overridden |

Order: featured first, then `order` (lowest first), then ongoing, then most recent.

### `career.json` item

| Field | Notes |
| --- | --- |
| `id` | `organization-title-start` slug, e.g. `example-studio-gameplay-programmer-2024-01` |
| `kind` | `"work"` or `"education"` |
| `source` | `"linkedin"` or `"manual"` |
| `title` | Job title, or for education: degree and field (or the school's name) |
| `organization` | Company or school |
| `location`, `description` | From Positions.csv. Empty for education. |
| `start`, `end` | Parsed from "Jan 2023", "2023", and similar |

Order: ongoing first, then most recent end. Set `order` to force a position.

## Overrides

Both override files have the same shape:

```json
{
  "overrides": { "<id>": { "field": "value" } },
  "extra": [ { "id": "unique-id", "title": "…" } ]
}
```

- **`overrides`** patches a generated entry by `id`. `"hidden": true` removes it. An id that matches nothing prints a warning, which usually means a typo or a repo that isn't tagged yet.
- **`extra`** adds entries that don't exist at the source, such as a game jam on itch.io or a job you don't list on LinkedIn. `id` and `title` are required. Career extras also need `"kind": "work"` or `"education"`.
- Unknown fields and wrong types are errors, so a typo like `"titel"` fails loudly instead of being ignored.

### Project fields

`title`, `description`, `role`, `status`, `start`, `end`, `highlights` (list of strings), `tags`, `image`, `links`, `featured`, `order`, `hidden`

```json
{
  "overrides": {
    "GDPROG3-PANOPHOBIA-REBUILD": {
      "title": "Panophobia",
      "role": "Gameplay programmer",
      "highlights": ["Rebuilt the engine layer in C++"],
      "image": { "src": "assets/img/projects/panophobia.webp", "alt": "Dark corridor lit by a flashlight", "width": 1600, "height": 900 },
      "links": [
        { "kind": "repo", "label": "Source code", "url": "https://github.com/LittleLycanLord/GDPROG3-PANOPHOBIA-REBUILD" },
        { "kind": "video", "label": "Gameplay video", "url": "https://www.youtube.com/watch?v=…" }
      ],
      "featured": true
    }
  }
}
```

The example values above are illustrative. Replace them with real details.

- `links` replaces the whole list, so include the repo link if you still want it.
- `kind` is one of `repo`, `demo`, `video`, `case-study`, or `link`.
- URLs must be `http(s)://` or relative.
- `image.src` should be a local file under `assets/img/projects/`.

### Career fields

`title`, `organization`, `location`, `description`, `employmentType`, `start`, `end`, `highlights`, `tags`, `links`, `order`, `hidden`. Extras also take `kind`.

## Automation

The workflow is [`.github/workflows/sync-and-deploy.yml`](../.github/workflows/sync-and-deploy.yml).

| Trigger | What runs |
| --- | --- |
| Every night (03:17 UTC) | tests → sync GitHub → import LinkedIn → commit `data/generated/` if it changed → deploy |
| Push to `production` (site edits, new CSVs, override changes) | same |
| **Actions → Sync and deploy → Run workflow** | same, on demand (e.g. right after tagging a repo) |
| Pull request | tests and override validation only |

- **Only `production` deploys.** A manual run on another branch syncs and commits there, but never replaces the live site.
- **What gets published:** only the site files (`index.html`, `css/`, `js/`, `data/` minus overrides and demo data, `assets/`, `robots.txt`, `sitemap.xml`). Scripts, tests, docs, and the LinkedIn CSVs stay out of the deployed site, though they remain visible in the public repo.
- **When nothing changed,** no commit is made. The bot's own data commits don't trigger another run.
- **If a run fails** (for example, a typo in an override file or a malformed CSV), the live site keeps its last good version. GitHub emails you about failed scheduled runs, and the log names the file and line.

**One-time setup:** in the repo's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. Do this when the workflow reaches `production`. Until then, the old branch-based deployment keeps serving the current site.

## Privacy

Only `Positions.csv` and `Education.csv` may live in `content/linkedin/`. `.gitignore` blocks every other file there, and blocks raw export archives anywhere in the repo. The import script reads only the columns listed in [content/linkedin/README.md](../content/linkedin/README.md). For example, Education's *Notes* and *Activities* columns are never copied.
