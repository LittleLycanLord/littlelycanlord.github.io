/**
 * Renderers for JSON-driven sections. Each returns DOM nodes built with
 * textContent/setAttribute only — never innerHTML.
 */
import { el, icon, ICONS } from "./dom.js";
import { isExternal } from "./data.js";

const PLACEHOLDER_HINT = "Sample content — replace with real details in the data file.";

function placeholderBadge() {
  return el("span", {
    className: "badge badge--placeholder",
    text: "Placeholder",
    attrs: { title: PLACEHOLDER_HINT },
  });
}

function placeholderNote(file) {
  return el("p", { className: "placeholder-note", text: `Sample entry — edit or remove it in ${file}.` });
}

function tagList(tags, { placeholder = false } = {}) {
  if (!tags.length) return null;
  return el(
    "ul",
    { className: "tag-list", attrs: { "aria-label": "Technologies" } },
    tags.map((tag) => el("li", { className: `tag${placeholder ? " is-placeholder" : ""}`, text: tag }))
  );
}

/** Status text → a stable data-status value for colour (the text itself always carries meaning). */
function statusKey(status) {
  return status.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

function monogram(title) {
  const words = title.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2);
  return letters.toUpperCase();
}

/* ---------------------------------------------------------------- Career */
export function renderCareerCard(entry) {
  const orgLine = [entry.organization, entry.location].filter(Boolean).join(" · ") || entry.subtitle;

  return el("article", { className: `card career-card${entry.placeholder ? " is-placeholder" : ""}` }, [
    el("div", { className: "career-card__top" }, [
      entry.period ? el("p", { className: "career-card__period", text: entry.period }) : null,
      el("div", { className: "career-card__badges" }, [
        entry.type ? el("span", { className: "badge badge--type", text: entry.type }) : null,
        entry.placeholder ? placeholderBadge() : null,
      ]),
    ]),
    el("h3", { text: entry.title }),
    orgLine ? el("p", { className: "career-card__org", text: orgLine }) : null,
    entry.description ? el("p", { className: "career-card__desc", text: entry.description }) : null,
    entry.highlights.length
      ? el("ul", { className: "career-card__highlights" }, entry.highlights.map((h) => el("li", { text: h })))
      : null,
    tagList(entry.tags, { placeholder: entry.placeholder }),
    entry.placeholder ? placeholderNote("data/career.json") : null,
  ]);
}

/* -------------------------------------------------------------- Projects */
function projectMedia(entry) {
  if (entry.image) {
    const img = el("img", {
      attrs: {
        src: entry.image.src,
        alt: entry.image.alt,
        width: String(entry.image.width),
        height: String(entry.image.height),
        loading: "lazy",
        decoding: "async",
      },
    });
    const trigger = el(
      "button",
      {
        attrs: {
          type: "button",
          "data-lightbox": "projects",
          "aria-label": `Enlarge image: ${entry.title}`,
        },
      },
      [img]
    );
    return el("div", { className: "project-card__media" }, [trigger]);
  }
  return el("div", { className: "project-card__media", attrs: { "aria-hidden": "true" } }, [
    el("div", { className: "project-card__art" }, [
      el("span", { className: "project-card__monogram", text: monogram(entry.title) }),
    ]),
  ]);
}

function projectLink(link) {
  const content = [icon(ICONS[link.kind] || ICONS.link), el("span", { text: link.label })];

  if (!link.href) {
    return el("li", {}, [
      el("span", { className: "link-pill is-unavailable" }, [
        ...content,
        el("span", { className: "visually-hidden", text: " — " }),
        el("span", { className: "badge badge--placeholder", text: "Not available yet" }),
      ]),
    ]);
  }

  const external = isExternal(link.href);
  const attrs = { href: link.href };
  if (external) {
    attrs.target = "_blank";
    attrs.rel = "noopener noreferrer";
  }
  return el("li", {}, [
    el("a", { className: "link-pill", attrs }, [
      ...content,
      external ? el("span", { className: "visually-hidden", text: " (opens in a new tab)" }) : null,
      external ? icon(ICONS.external) : null,
    ]),
  ]);
}

export function renderProjectCard(entry) {
  const facts = [
    ["Role", entry.role],
    ["Timeline", entry.period],
  ].filter(([, value]) => value);

  return el("article", { className: `card project-card${entry.placeholder ? " is-placeholder" : ""}` }, [
    projectMedia(entry),
    el("div", { className: "project-card__body" }, [
      el("div", { className: "project-card__badges" }, [
        entry.type ? el("span", { className: "badge badge--type", text: entry.type }) : null,
        entry.status
          ? el("span", {
              className: "badge badge--status",
              text: entry.status,
              attrs: { "data-status": statusKey(entry.status) },
            })
          : null,
        entry.placeholder ? placeholderBadge() : null,
      ]),
      el("h3", { className: "project-card__title", text: entry.title }),
      entry.subtitle ? el("p", { className: "project-card__subtitle", text: entry.subtitle }) : null,
      entry.description ? el("p", { className: "project-card__desc", text: entry.description }) : null,
      facts.length
        ? el(
            "dl",
            { className: "facts" },
            facts.map(([term, value]) => el("div", {}, [el("dt", { text: term }), el("dd", { text: value })]))
          )
        : null,
      tagList(entry.tags, { placeholder: entry.placeholder }),
      entry.links.length
        ? el("ul", { className: "link-list", attrs: { "aria-label": `${entry.title} links` } }, entry.links.map(projectLink))
        : null,
      entry.placeholder ? placeholderNote("data/projects.json") : null,
    ]),
  ]);
}

/* ---------------------------------------------------------------- Skills */
export function renderSkillGroup(group) {
  return el("article", { className: `card skill-group${group.placeholder ? " is-placeholder" : ""}` }, [
    el("div", { className: "skill-group__head" }, [
      el("h3", { text: group.title }),
      group.placeholder ? placeholderBadge() : null,
    ]),
    tagList(group.items, { placeholder: group.placeholder }),
  ]);
}

/* ---------------------------------------------------------- Data states */
export function renderEmptyState(message) {
  return el("p", { className: "data-state", text: message });
}

export function renderErrorState(message, onRetry) {
  const retry = el("button", { className: "btn btn--ghost", text: "Try again", attrs: { type: "button" } });
  retry.addEventListener("click", onRetry);
  return el("div", { className: "data-state data-state--error", attrs: { role: "alert" } }, [
    el("p", { text: message }),
    retry,
  ]);
}
