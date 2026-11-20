# Rebuild review: summary and test checklist

Everything here is on the `rebuild` branch. `production` and the live site are unchanged until you merge.

## What was built

| Phase | What it does | Main files |
| --- | --- | --- |
| 1. Data pipeline | Pulls repos tagged `portfolio` from GitHub and turns the LinkedIn CSVs into a career list. Optional overrides add screenshots, roles, and hidden or extra entries. Bad input stops the run with a clear message. | `scripts/`, `data/overrides/`, `tests/` |
| 2. Automation | GitHub Action: nightly, on push to `production`, or on demand. Runs tests, syncs, commits data only if it changed, then deploys. Only `production` deploys. | `.github/workflows/sync-and-deploy.yml` |
| 3. Site rebuild | New design: hero with live counts, featured projects carousel, Journey timeline (filters, expandable entries, Now/year markers, horizontal on desktop and vertical on mobile), toolkit from GitHub languages, and contact. Localhost-only `?demo` preview. | `index.html`, `css/site.css`, `js/` |
| 4. Polish and docs | Accessibility, performance, a 404 page, a how-to guide, and this checklist. | see below |

### Phase 4 changes

- **Accessibility:**
  - The timeline is only a keyboard tab stop when it actually scrolls (wide screens), so phones skip it.
  - Filter chips now read as "Work, 2 entries" instead of "Work2".
  - The 404 page's logo link has an accessible name on phones.
- **Performance:** `modulepreload` hints fetch all nine JS modules in parallel instead of one import level at a time.
- **404 page:** `404.html` matches the site's style and links back home. The deploy step already includes it.
- **Docs:**
  - [GUIDE.md](GUIDE.md) covers first-time setup, adding a project, adding a job, previewing, and troubleshooting.
  - The README links to it and to this file.

### Checked by me

- **Unit tests:** 19 pass, using synthetic data.
- **Scripts:** both ran against the real GitHub account (20 repos, none tagged yet).
- **Layout:** browser checks at 375, 768, 1100, and 1280 px widths, with no horizontal page overflow.
- **Controls:** carousel, filters, expanding entries, and scroll-button logic.
- **Tab order:** logical, from the skip link through the nav, hero, carousel, filters, entries, and contact.
- **Live-data state:** honest empty sections, no demo content, and a sync date in the footer.
- **Error handling:** a missing data file shows an error, and "Try again" recovers.
- **Safety:** hostile text renders as plain text, and `javascript:` links and images are dropped with a console warning.
- **Console:** no errors.

### Not checked yet

- **The workflow on GitHub.** It first runs after the merge.
- **Smooth-scroll animation and real keyboard or screen-reader use.** The browser pane was hidden during testing, so these were checked in code and with scripted events.
- **Older browsers.** The site uses modern CSS (`color-mix`, `inert`) and targets current evergreen browsers.

## What you can test now (locally)

Start a server from the repo folder, on the `rebuild` branch:

```bash
python -m http.server 8000
```

### 1. Demo mode: http://localhost:8000/?demo

All entries here are fictional samples, and a yellow banner says so.

- [ ] **Hero:** the counts (4 projects, 7 languages, 2 roles) appear under the buttons.
- [ ] **Projects carousel:**
  - [ ] Click the arrows and dots.
  - [ ] Press ← → Home End while focus is inside it.
  - [ ] Swipe on a phone or touch screen.
  - [ ] Only the selected card is clickable; the faded one isn't.
- [ ] **Journey timeline:**
  - [ ] On a wide window it runs horizontally, newest on the left, with "Now" first. Use the ‹ › buttons or shift+scroll.
  - [ ] Click a title to expand its details. Click again to collapse.
  - [ ] Toggle the Work / Education / Project chips. The "Showing N of 7" line updates. Turning all off shows a message.
  - [ ] Narrow the window below about 900 px. It switches to a vertical timeline.
- [ ] **Toolkit:** language bars, and the "Tools & workflow" tags.
- [ ] **Header:** the nav highlights the section you're in as you scroll.
- [ ] **Keyboard only:** press Tab from the top. The first stop is "Skip to main content", and every focused item has a visible amber outline.
- [ ] **Phone:** in browser dev tools, pick a phone size. The nav fits and nothing scrolls sideways.
- [ ] **Reduced motion:** turn on "reduce motion" in your OS. Carousel and scroll animations become instant.

### 2. Real data: http://localhost:8000

- [ ] This is what the live site will show right after merging: "Projects are on their way", "The timeline is being set up", your real tools, and the GitHub contact card. There's no demo banner and no fake content.

### 3. See your real projects appear

1. Tag one or two repos with `portfolio` and give them descriptions ([GUIDE.md](GUIDE.md), setup step 1).
2. Run the sync:

   ```bash
   python scripts/sync_github.py
   ```

3. Reload http://localhost:8000. The repos appear in the carousel, on the timeline, and in the toolkit languages.
4. Optional: feature one and give it a nicer title in `data/overrides/projects.json`, re-run the sync, and reload.

### 4. Try the LinkedIn import

1. Copy `Positions.csv` and `Education.csv` from your export into `content/linkedin/`.
2. Run the import:

   ```bash
   python scripts/import_linkedin.py
   ```

3. Reload. Your jobs and education appear on the timeline.
4. Check `git status`. Only those two CSVs should show under `content/linkedin/`, and nothing else from the export.

### 5. Other checks

- [ ] http://localhost:8000/404.html shows the not-found page. On the live site, any wrong URL shows it.
- [ ] Run the tests:

  ```bash
  python -m unittest discover -s tests
  ```

## After you're happy

1. Merge `rebuild` into `production`.
2. Set **Settings → Pages → Source: GitHub Actions**.
3. Run **Actions → Sync and deploy** once, then check the live site.
