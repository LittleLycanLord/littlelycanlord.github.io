# littlelycanlord.github.io
Personal portfolio website for my game development and programming projects, as well as my career and academic experiences.

## Single-page portfolio template

This repository now includes a clean, single-page portfolio template with the following sections:

- **Home** (banner + section navigation buttons)
- **Who am I?** (horizontal ribbon cards with image-left/text-right layout)
- **My Career** (data-driven horizontal timeline)
- **My Projects** (data-driven horizontal timeline)
- **Contact Me** (social/contact buttons)

### Files and how to customize

- `/index.html` - semantic section layout and labeled content blocks.
- `/styles.css` - organized, documented styling tokens/components.
- `/script.js` - reusable timeline renderer + floating back-to-top button behavior.
- `/data/career.json` - manually editable career timeline entries.
- `/data/projects.json` - manually editable project timeline entries.

To update career/project items, edit the JSON files with this shape:

```json
{
  "period": "Month YYYY or range",
  "title": "Entry title",
  "subtitle": "Optional subtitle",
  "description": "Entry details"
}
```
