# How to update the portfolio

Step-by-step guides for the things you'll do most. For field-level detail, see [DATA.md](DATA.md).

## First-time setup (once)

1. **Tag your showcase repos.** For each repo you want on the site:
   1. Open it on GitHub and click the ⚙ next to **About** (right-hand side).
   2. Write a one-line **Description**.
   3. If it has a playable build or live page, put that URL in **Website**. It becomes the "Live demo" link.
   4. Under **Topics**, add `portfolio`. Add other topics too (e.g. `unity`, `cpp`, `game-jam`); they show as tags.
   5. Save.
2. **Get your LinkedIn data.** LinkedIn → **Settings & Privacy** → **Data privacy** → **Get a copy of your data** → request it. When the email arrives, unzip the archive **outside this repo**, then copy only `Positions.csv` and `Education.csv` into `content/linkedin/`.
3. **Merge the `rebuild` branch into `production`** (or open a pull request and merge it).
4. **Switch Pages to Actions:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. **Run it once:** **Actions → Sync and deploy → Run workflow**. When it goes green, open https://littlelycanlord.github.io/.

## Add a new project

1. Push the repo to GitHub (public).
2. Do step 1 of the setup above: description, website (optional), and the `portfolio` topic.
3. Wait for the nightly run, or start it now: **Actions → Sync and deploy → Run workflow**.

**Optional extras** go in `data/overrides/projects.json`, keyed by the exact repo name:

```json
{
  "overrides": {
    "My-Repo-Name": {
      "title": "Nicer Display Name",
      "role": "Gameplay programmer",
      "highlights": ["One thing you're proud of", "Another"],
      "image": { "src": "assets/img/projects/my-repo.webp", "alt": "What the screenshot shows", "width": 1600, "height": 900 },
      "featured": true
    }
  }
}
```

- **Screenshot:** save it in `assets/img/projects/`, ideally WebP around 1600 px wide and under ~250 KB. Set `width`/`height` to its real size.
- **Featured:** featured projects are the ones in the carousel. If none are featured, the carousel shows the most recent projects.
- **Video or write-up:** add `links`. This replaces the default list, so keep the repo link:

  ```json
  "links": [
    { "kind": "repo", "url": "https://github.com/LittleLycanLord/My-Repo-Name" },
    { "kind": "video", "label": "Gameplay trailer", "url": "https://www.youtube.com/watch?v=…" }
  ]
  ```

- **Not on GitHub** (e.g. a game jam on itch.io)? Add it to `"extra"` instead, with a unique `id`, a `title`, and dates such as `"start": "2025-03", "end": "2025-03"`.

Push the change. The workflow validates it and redeploys. If you made a typo, the run fails with a message naming the file and field, and the live site stays as it was.

## Add a new job or degree

1. Add it to your LinkedIn profile.
2. Request a fresh data export (setup step 2).
3. Replace `content/linkedin/Positions.csv` and/or `Education.csv` with the new files.
4. Commit and push. The push triggers the workflow, and the timeline updates.

**Tweaks without touching LinkedIn** go in `data/overrides/career.json`. The `id` of each entry is in `data/generated/career.json` after a sync (for example `example-studio-gameplay-programmer-2024-01`):

```json
{
  "overrides": {
    "example-studio-gameplay-programmer-2024-01": {
      "highlights": ["Shipped the save system", "Mentored two interns"],
      "tags": ["Unity", "C#"]
    },
    "some-old-entry-id": { "hidden": true }
  },
  "extra": [
    { "id": "game-jam-organiser", "kind": "work", "title": "Game jam organiser", "organization": "Local club", "start": "2024-02", "end": "2024-02" }
  ]
}
```

## Preview before pushing

```bash
python scripts/sync_github.py
python scripts/import_linkedin.py
python -m http.server 8000
```

Open http://localhost:8000. Add `?demo` to see the layout filled with fictional samples instead.

## When something goes wrong

| Symptom | Likely cause |
| --- | --- |
| A project doesn't appear | The repo is private, the topic isn't exactly `portfolio`, or the sync hasn't run yet. Check with `python scripts/sync_github.py --list`. |
| The workflow failed | Open the failed run in **Actions**; the log names the file and the problem (often a typo in an override file). |
| "warning: override … matches no entry" | The key in an override file doesn't match a repo name or career id exactly (it's case-sensitive). |
| A section shows "Something went wrong" | A data file is missing or invalid. The message names it, and the browser console has details. |
