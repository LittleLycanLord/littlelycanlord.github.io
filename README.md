# littlelycanlord.github.io

Personal portfolio website for my game development and programming projects, as well as my career and academic experiences.

**Live site:** https://littlelycanlord.github.io/

It's a static single-page site built with plain semantic HTML, CSS, and vanilla JavaScript. There are no dependencies and no build step, and GitHub Pages serves the repository as-is.

## Sections

| Section | Where the content lives |
| --- | --- |
| **Hero**: intro, calls to action, availability status, focus areas | `index.html` |
| **Who am I?**: About carousel with a lightbox for the images | `index.html` + `assets/img/` |
| **Toolkit**: skill groups | `data/skills.json` |
| **My Career**: timeline carousel | `data/career.json` |
| **My Projects**: project carousel with dots | `data/projects.json` |
| **Contact Me**: contact cards | `index.html` |

Profile copy lives in HTML so it still renders without JavaScript. Repeatable lists live in JSON.

## Project structure

```
index.html          Page markup, metadata (SEO / Open Graph / JSON-LD)
styles.css          Design tokens (CSS custom properties) + all component styles
js/
  main.js           Entry point: loads JSON, renders sections, wires features
  data.js           JSON loading, validation, and URL sanitising
  render.js         Card renderers (DOM APIs only, no innerHTML)
  carousel.js       Accessible carousel (peek + single modes)
  lightbox.js       <dialog>-based image viewer
  navigation.js     Scrollspy, back-to-top, heading text-decode effect
  dom.js            Tiny DOM/icon helpers
data/               Editable content (career, projects, skills)
assets/             Favicon/brand mark and local illustrations
robots.txt, sitemap.xml
```

## Running locally

The site loads JSON with `fetch`, and browsers block that on `file://` pages. Serve the folder over HTTP instead:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Editing content

### Placeholders

Any entry marked `"placeholder": true` is sample content. It shows a yellow dashed **Placeholder** badge so it can't be mistaken for real information. Once you replace an entry with real details, delete the `"placeholder": true` line (or set it to `false`). If a sample entry isn't needed, delete it.

Content that is currently placeholder-only:

- All entries in `data/career.json`
- The *Project Atlas* and *Arena AI Sandbox* entries in `data/projects.json`
- The *Game engines*, *Languages*, and *Tools & workflow* groups in `data/skills.json`
- The Email, LinkedIn, and Indeed contact cards in `index.html`
- The hidden availability status in the hero

### Projects: `data/projects.json`

The file is an array of entries. Only `title` is required, and every other field is optional:

```json
{
  "title": "Project name",
  "period": "Feb 2024 – Jul 2024",
  "subtitle": "Engine or one-line summary",
  "type": "Game jam / Prototype / Tool / Website …",
  "role": "Solo developer / Gameplay programmer …",
  "status": "In progress",
  "description": "What it is, what you built, what you learned.",
  "tags": ["Unity", "C#"],
  "image": {
    "src": "assets/img/projects/my-project.webp",
    "alt": "Short description of the screenshot",
    "width": 1600,
    "height": 1000
  },
  "links": [
    { "kind": "repo", "label": "Source code", "url": "https://github.com/…" },
    { "kind": "demo", "label": "Play it", "url": "https://…" },
    { "kind": "video", "label": "Trailer", "url": "https://…" },
    { "kind": "case-study", "label": "Write-up", "url": "https://…" }
  ],
  "placeholder": false
}
```

- **`status`**: any text works. These values also get a matching colour: `Released`, `Shipped`, `Complete` (green); `In progress`, `Active` (cyan); `Prototype`, `Paused` (amber). The text is always shown, so the status never depends on colour alone.
- **`image`**: put images in `assets/img/projects/`. Set `width` and `height` to the image's real pixel size to avoid layout shift. Prefer WebP or AVIF around 1600 px wide and under ~250 KB. Clicking the image opens it in the lightbox. If there's no image, the card shows generated cover art with the project's initials.
- **`links`**: `kind` sets the icon and must be one of `repo`, `demo`, `video`, `case-study`, `link`. A link with an empty `url` is shown as **Not available yet** instead of a broken link. Only `http(s)://`, `mailto:`, and relative URLs are accepted. Anything else is disabled, and the console logs a warning.
- **Order**: the carousel follows the order of the file, and the first entry is shown first.

### Career: `data/career.json`

```json
{
  "title": "Role or milestone",
  "period": "Jan 2024 – Present",
  "organization": "Studio / company / school",
  "location": "Remote",
  "type": "Full-time / Internship / Education …",
  "description": "Summary of the role.",
  "highlights": ["Specific thing you did", "Another one"],
  "tags": ["Unreal Engine", "C++"],
  "placeholder": false
}
```

The card shows `organization` and `location` together on one line. If both are missing, it uses `subtitle`.

### Toolkit: `data/skills.json`

```json
{ "group": "Game engines", "items": ["Unity", "Godot"], "placeholder": false }
```

### Backwards compatibility

The original entry shape (`period`, `title`, `subtitle`, `description`) still works unchanged, and every new field is optional. A file can be a bare array (as now) or `{ "items": [ … ] }`.

### Validation and errors

Entries are validated when the page loads:

- Bad fields are dropped, and the browser console prints a warning that names the file, the entry, and the problem.
- Entries without a `title` are skipped.
- If a file is missing or contains invalid JSON, that section shows an error with a **Try again** button. The rest of the page keeps working.

To validate the JSON from a terminal:

```bash
python -m json.tool data/projects.json
```

### Contact links

Contact cards are in `index.html`, in the `#contact` section. To publish a channel, replace its `<div class="contact-card is-placeholder">…</div>` with a link based on the GitHub card. Change the `href`, label, and value, and remove the placeholder badge:

```html
<a class="contact-card" href="mailto:you@yourdomain.com">…</a>
```

For external sites, keep `target="_blank" rel="noopener noreferrer"` and the visually-hidden "(opens in a new tab)" text.

### Availability status

In the hero, remove the `hidden` attribute from `<p class="status" hidden>` and edit its text.

### About cards and images

Edit the three `<article class="about-card">` blocks in `index.html`. The illustrations are local SVGs in `assets/img/`. If you replace one, update its `alt` text and the button's `aria-label`.

### Social preview image (optional)

There's no `og:image` yet. To add one, create a 1200×630 PNG at `assets/og-image.png`. Then add these to `<head>` and change `twitter:card` to `summary_large_image`:

```html
<meta property="og:image" content="https://littlelycanlord.github.io/assets/og-image.png" />
<meta property="og:image:alt" content="LittleLycanLord — Game Developer & Software Engineer" />
```

## Design system

All colours, type sizes, spacing, radii, shadows, and motion timings are CSS custom properties at the top of `styles.css`. Adjust the look there rather than in individual components. The stylesheet is split into numbered sections, listed in a table of contents at the top of the file.

## Accessibility

- Skip link to `<main>`, semantic landmarks, and a logical heading order
- Visible `:focus-visible` outlines on all interactive elements
- Carousels use `role="region"` with `aria-roledescription="carousel"` and labelled slides. Hidden slides are `inert`. They support ← → Home End, swipe, and labelled prev/next buttons and dots. Slide changes are announced through a polite live region.
- Native `<dialog>` lightbox: focus is trapped, Escape closes it, ← → navigate, and focus returns to the image that opened it
- Scrollspy marks the current section with `aria-current="location"` plus a bold weight, not colour alone
- `prefers-reduced-motion` turns off transitions, smooth scrolling, and the decode effect
- Without JavaScript, the About carousel is a native horizontal scroller, and the JSON sections show a `<noscript>` message

## Deploying to GitHub Pages

1. Push to the branch GitHub Pages publishes from. Check **Settings → Pages → Build and deployment** (this repo uses `production`).
2. Set the source to **Deploy from a branch**, with the folder set to `/ (root)`.
3. Wait for the Pages workflow to finish, then visit https://littlelycanlord.github.io/.

All asset paths are relative, so the site also works from a project subpath or a fork. If the domain changes, update the absolute URLs in the `<head>` of `index.html` (`canonical`, `og:url`, JSON-LD) and in `robots.txt` and `sitemap.xml`.
