# littlelycanlord.github.io

Personal portfolio for my game development and programming projects, plus my work and education history.

**Live site:** https://littlelycanlord.github.io/

The site keeps itself up to date:

- **Projects** come from my GitHub repositories tagged `portfolio`.
- **Work and education** come from my LinkedIn data export.
- A nightly GitHub Action refreshes both and redeploys.

The site itself is plain HTML, CSS, and JavaScript with no framework or build step. The data scripts are standard-library Python.

## Sections

| Section | Content source |
| --- | --- |
| **Hero**: intro, links, live counts | `index.html`. Counts come from the data. |
| **Projects**: featured carousel | `data/generated/projects.json` (GitHub) |
| **Journey**: interactive timeline of work, education, and projects | `data/generated/career.json` (LinkedIn) + projects |
| **About**: working style and toolkit | `index.html`. Languages are measured from GitHub, tools come from `data/toolkit.json`. |
| **Contact** | `index.html` (real links only) |

## Updating content

| I want to… | Do this |
| --- | --- |
| Add a project | On GitHub, give the repo a description and the `portfolio` topic (repo page → ⚙ next to **About**). It appears after the next nightly sync, or run **Actions → Sync and deploy → Run workflow**. |
| Remove a project | Remove the `portfolio` topic, or set `"hidden": true` for it in `data/overrides/projects.json`. |
| Feature a project, add a screenshot, role, or video | Add an entry for the repo in `data/overrides/projects.json`. Put images in `assets/img/projects/`. |
| Add a job or degree | Update LinkedIn, request a new data export, and replace `content/linkedin/Positions.csv` / `Education.csv`. Pushing triggers a rebuild. |
| Fix or hide a timeline entry, or add one that isn't on LinkedIn | `data/overrides/career.json` |
| Change the tools list | `data/toolkit.json` |
| Add a contact channel | Copy the GitHub card in the `#contact` section of `index.html`. |
| Show a LinkedIn button in the hero | Follow the comment next to the GitHub button in `index.html`. |

More detail lives in `docs/`:

- [docs/GUIDE.md](docs/GUIDE.md): step-by-step guides for first-time setup, adding a project, adding a job, and troubleshooting.
- [docs/DATA.md](docs/DATA.md): every field, the override format, and how the automation works.
- [docs/REVIEW.md](docs/REVIEW.md): what the rebuild changed and a checklist for testing it.
- [docs/PLAN.md](docs/PLAN.md): the design decisions.

## Project structure

```
index.html                 Page markup and metadata (SEO / Open Graph / JSON-LD)
css/site.css               Design tokens (custom properties) and all styles
js/
  main.js                  Entry point: loads data, renders sections
  data.js                  Loading, validation, URL sanitising, demo mode
  projects.js              Featured projects carousel and project cards
  timeline.js              Interactive timeline (filters, expandable entries)
  toolkit.js               Language stats and tool groups
  carousel.js              Accessible carousel
  lightbox.js              <dialog> image viewer
  nav.js                   Header scrollspy
  format.js, dom.js        Date/colour helpers, safe DOM helpers
data/
  generated/               Written by the sync scripts. Don't edit by hand.
  overrides/               Hand-written tweaks applied during sync
  toolkit.json             Hand-written tool groups
  demo/                    Fictional sample data for local previews (never deployed)
content/linkedin/          The two LinkedIn CSVs (nothing else from the export)
scripts/                   sync_github.py, import_linkedin.py
tests/                     Unit tests for the scripts
.github/workflows/         Nightly sync + deploy
```

## Running locally

The site loads JSON with `fetch`, which browsers block on `file://` pages. Serve the folder instead:

```bash
python -m http.server 8000
```

- http://localhost:8000 shows the real data.
- http://localhost:8000/?demo fills every section with clearly fictional samples, so you can preview the layout before your repos are tagged. A banner marks demo mode, and it only works on localhost.

To refresh the data locally and run the tests:

```bash
python scripts/sync_github.py
python scripts/import_linkedin.py
python -m unittest discover -s tests
```

## Design system

All colours, type sizes, spacing, radii, and motion timings are CSS custom properties at the top of `css/site.css`. Each timeline entry type has a colour (work: amber, education: violet, project: teal), and every entry also shows a text label, so meaning never depends on colour alone.

## Accessibility

- Skip link, semantic landmarks, logical heading order, and visible `:focus-visible` outlines
- **Projects carousel:** `role="region"` with `aria-roledescription="carousel"`, labelled slides, hidden slides `inert`, ← → Home End keys, swipe, labelled buttons and dots, and polite announcements after interaction
- **Timeline:** filter chips are toggle buttons (`aria-pressed`) with a live count, entry titles are disclosure buttons (`aria-expanded`), and the horizontal view is a labelled, keyboard-scrollable region with scroll buttons
- Native `<dialog>` lightbox: focus is trapped, Escape closes it, and focus returns to the image that opened it
- `prefers-reduced-motion` turns off transitions and smooth scrolling
- All data is rendered with DOM APIs, never `innerHTML`. Only `http(s)`, `mailto`, and relative URLs are allowed.

## Social preview image (optional)

There's no `og:image` yet. To add one, create a 1200×630 PNG at `assets/og-image.png`. Then add these to `<head>` and change `twitter:card` to `summary_large_image`:

```html
<meta property="og:image" content="https://littlelycanlord.github.io/assets/og-image.png" />
<meta property="og:image:alt" content="LittleLycanLord — Game Developer & Software Engineer" />
```

## Deploying to GitHub Pages

Deployment is handled by the **Sync and deploy** GitHub Action (`.github/workflows/sync-and-deploy.yml`). It runs nightly, on every push to `production`, and on demand. Each run refreshes projects from GitHub and career data from the LinkedIn export, then publishes the site. See [docs/DATA.md](docs/DATA.md#automation).

1. One-time setup: set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
2. Push to `production`, or run the workflow from the **Actions** tab.
3. Wait for the run to finish, then visit https://littlelycanlord.github.io/.

All asset paths are relative. If the domain changes, update the absolute URLs in the `<head>` of `index.html` (`canonical`, `og:url`, JSON-LD) and in `robots.txt` and `sitemap.xml`.
