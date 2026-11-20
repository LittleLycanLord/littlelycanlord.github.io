# Portfolio rebuild plan

_Agreed 2026-11-13. This file is the source of truth for the site's direction. Update it when plans change._

## Goal

A portfolio that presents my **work experience** and **projects** as carousels and interactive timelines. It should **update itself** when I add a new job on LinkedIn or a new project on GitHub, with as little manual work as possible.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| LinkedIn | **Data export + import script.** I download my LinkedIn data export, add `Positions.csv` and `Education.csv` to the repo, and a script converts them into the career timeline. | LinkedIn's API doesn't expose work history to personal apps (Sign In with LinkedIn only returns name/email/photo). Scraping breaks LinkedIn's terms and breaks whenever their markup changes. |
| GitHub selection | **Opt-in via the `portfolio` topic.** Only repos tagged `portfolio` appear. | 20 public repos, many of them coursework or templates. Tagging keeps curation on GitHub itself. |
| GitHub enrichment | `data/overrides/projects.json`, keyed by repo name, can add a nicer title, role, period, screenshots, and highlights. | GitHub metadata is thin (no role, no images). |
| Sync | **Nightly GitHub Action** that also runs on demand and on pushes to content files. | Fast page loads, no per-visitor API rate limits, and the data history is kept in git. |
| Foundation | **Fresh rebuild** of layout and design. Plain HTML/CSS/JS, no framework, no build step for the site itself. | Requested. Static hosting stays simple. |
| Branching | Build on a `rebuild` branch and merge to `production` when it's ready. | The current live site stays up in the meantime. |

## Architecture

```
content/linkedin/Positions.csv      ← copied from LinkedIn export (only these files)
content/linkedin/Education.csv
data/overrides/career.json          ← optional manual tweaks / hidden entries
data/overrides/projects.json        ← optional per-repo enrichment
scripts/sync_github.py              ← GitHub API → data/generated/projects.json
scripts/import_linkedin.py          ← CSV → data/generated/career.json
.github/workflows/sync-and-deploy.yml
index.html, css/, js/               ← the site; reads data/generated/*.json
```

- The scripts are **Python standard library only**, so there's nothing to install. They run identically locally and in CI.
- The generated JSON is committed by the workflow. The site never calls GitHub or LinkedIn at runtime.
- **Workflow:** triggered nightly (cron), by `workflow_dispatch`, and by pushes touching `content/**` or `data/overrides/**`. Steps: sync → import → commit if changed → deploy to Pages with `actions/deploy-pages`.
  - This needs **Settings → Pages → Source: GitHub Actions** (one-time switch from "Deploy from a branch").
- **Privacy:** the LinkedIn export also contains messages, connections, and contact details. Only `Positions.csv` and `Education.csv` are committed. `.gitignore` blocks everything else under `content/linkedin/`, and the import script only reads the columns it needs.

## Data pulled automatically

**GitHub (per `portfolio`-tagged repo):** name, description, homepage/demo URL, primary language and language breakdown, topics (as tags), stars, created and last-pushed dates, archived flag, and the repo URL. Optionally, the first image in the README or the repo's social preview, if one is set.

**LinkedIn export:** company, title, location, start and end dates, and description for positions; school, degree, field, and dates for education.

A "Last synced" timestamp is shown on the site.

## Site structure (fresh design)

1. **Hero:** name, one-line value proposition, CTAs (Projects, Experience, Contact), and links to GitHub and LinkedIn.
2. **Featured projects carousel:** GitHub-sourced cards with screenshot, tags, language bar, and links (repo / demo / video). Keyboard, swipe, and dots.
3. **Interactive timeline:** one chronological axis combining Work, Education, and Projects.
   - Filter chips by type.
   - Click or Enter on an entry to expand its details.
   - Horizontal on desktop, vertical on mobile.
   - "Now" marker for current roles and active projects.
4. **About / toolkit:** languages are derived from GitHub language stats, plus manual additions.
5. **Contact:** real links only. No placeholders shown on the live site.

Carried forward from the previous version: accessibility standards (skip link, focus states, ARIA carousel/dialog patterns, reduced motion), safe DOM rendering (no `innerHTML` for data), validated JSON with visible error states, and SEO metadata.

## Phases

1. **Data pipeline** *(done)*: both scripts, JSON schemas, override files, and sample runs against my real GitHub. Testable before any UI exists.
2. **Automation** *(done; the Pages source switch happens at merge)*: GitHub Action for sync, commit, and deploy, plus the Pages source switch.
3. **Site rebuild** *(done)*: new layout, design system, projects carousel, interactive timeline, about, and contact.
4. **Polish and docs** *(done; see docs/REVIEW.md)*: responsive, a11y, and performance passes. README guide: "how to add a job" and "how to add a project".

## What I need to do (owner tasks)

- [ ] Add the `portfolio` topic, plus a description (and ideally a homepage/demo link), to each repo I want shown.
- [ ] Request the LinkedIn export: LinkedIn → Settings & Privacy → Data privacy → **Get a copy of your data** → select *Positions* and *Education* (or the full archive). It arrives by email, usually within minutes, sometimes up to a day.
- [ ] Switch **Settings → Pages → Source** to **GitHub Actions** when phase 2 lands.

## Updating content later

- **New project:** push the repo, add a description and the `portfolio` topic. It appears after the next nightly sync, or run the workflow manually.
- **New job or degree:** update LinkedIn, re-export, and replace the two CSVs in `content/linkedin/`. The push triggers the rebuild.
