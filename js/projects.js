/**
 * Featured projects carousel.
 *
 * Shows projects marked `featured` (via data/overrides/projects.json); if none
 * are featured, shows the most recent ones. All projects also appear on the
 * timeline.
 */
import { el, icon, ICONS } from "./dom.js";
import { isExternal } from "./data.js";
import { setupCarousel } from "./carousel.js";
import { languageColor, periodNodes } from "./format.js";

const MAX_SLIDES = 8;

export function renderProjects(mount, projects) {
  if (!projects.length) {
    mount.replaceChildren(
      el("div", { className: "empty-state" }, [
        el("p", {}, [el("strong", { text: "Projects are on their way." })]),
        el("p", { text: "I'm picking which repositories to showcase here. In the meantime, everything is public on GitHub." }),
        el("a", { className: "btn btn--ghost", text: "Browse my GitHub", attrs: { href: "https://github.com/LittleLycanLord" } }),
      ]),
    );
    return;
  }

  const featured = projects.filter((p) => p.featured);
  const shown = (featured.length ? featured : projects).slice(0, MAX_SLIDES);

  const carousel = el("div", {
    className: "carousel",
    attrs: { "data-carousel": "peek", "data-carousel-label": "Featured projects", "data-carousel-item": "project" },
  }, [
    el("div", { className: "carousel__viewport" }, [
      el("div", { className: "carousel__track" }, shown.map(renderProjectCard)),
    ]),
  ]);

  const nodes = [carousel];
  if (projects.length > shown.length) {
    nodes.push(el("p", { className: "projects__more" }, [
      `Showing ${shown.length} of ${projects.length} projects. `,
      el("a", { text: "See them all on the timeline", attrs: { href: "#journey" } }),
      ".",
    ]));
  }
  mount.replaceChildren(...nodes);
  setupCarousel(carousel);
}

function initials(title) {
  const words = title.split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2)).toUpperCase();
}

function renderMedia(project) {
  if (project.image) {
    const { src, alt, width, height } = project.image;
    return el("button", {
      className: "project-card__media",
      attrs: { type: "button", "data-lightbox": "projects", "aria-label": `Enlarge image: ${alt}` },
    }, [
      el("img", { attrs: { src, alt, width, height, loading: "lazy", decoding: "async" } }),
    ]);
  }
  const cover = el("div", { className: "project-card__cover", attrs: { "aria-hidden": "true" } }, [
    el("span", { className: "project-card__monogram", text: initials(project.title) }),
  ]);
  const primary = project.languages[0]?.name;
  if (primary) cover.style.setProperty("--lang", languageColor(primary));
  return cover;
}

function formatPercent(value) {
  return value >= 10 ? `${Math.round(value)}%` : `${value.toFixed(1)}%`;
}

export function renderLangbar(languages, max = 4) {
  if (!languages.length) return null;
  const summary = languages.map((l) => `${l.name} ${formatPercent(l.percent)}`).join(", ");
  const track = el("div", { className: "langbar__track", attrs: { role: "img", "aria-label": `Languages: ${summary}` } },
    languages.map((l) => {
      const seg = el("span", { className: "langbar__seg" });
      seg.style.setProperty("--lang", languageColor(l.name));
      seg.style.flexBasis = `${l.percent}%`;
      return seg;
    }),
  );
  const legend = el("ul", { className: "langbar__legend", attrs: { "aria-hidden": "true" } },
    languages.slice(0, max).map((l) => {
      const item = el("li", {}, [l.name, " ", el("span", { text: formatPercent(l.percent) })]);
      item.style.setProperty("--lang", languageColor(l.name));
      return item;
    }),
  );
  return el("div", { className: "langbar" }, [track, legend]);
}

export function renderTags(tags) {
  if (!tags.length) return null;
  return el("ul", { className: "tag-list", attrs: { "aria-label": "Tags" } },
    tags.map((tag) => el("li", { className: "tag", text: tag })));
}

export function renderLinks(links, context) {
  if (!links.length) return null;
  return el("ul", { className: "links" }, links.map((link) => {
    const external = isExternal(link.href);
    const attrs = { href: link.href };
    if (external) Object.assign(attrs, { target: "_blank", rel: "noopener noreferrer" });
    return el("li", {}, [
      el("a", { attrs }, [
        icon(ICONS[link.kind] || ICONS.link),
        link.label,
        el("span", { className: "visually-hidden", text: ` for ${context}${external ? " (opens in a new tab)" : ""}` }),
      ]),
    ]);
  }));
}

function renderMeta(project) {
  const parts = [el("span", {}, periodNodes(project.start, project.end, project.ongoing))];
  if (project.ongoing && !project.archived) parts.push(el("span", { className: "badge badge--now", text: "Active" }));
  if (project.archived) parts.push(el("span", { className: "badge badge--muted", text: "Archived" }));
  if (project.status) parts.push(el("span", { text: project.status }));
  if (project.stars > 0) {
    parts.push(el("span", {}, [
      el("span", { text: `★ ${project.stars}`, attrs: { "aria-hidden": "true" } }),
      el("span", { className: "visually-hidden", text: `${project.stars} GitHub star${project.stars > 1 ? "s" : ""}` }),
    ]));
  }
  return el("p", { className: "project-card__meta" }, parts);
}

export function renderProjectCard(project) {
  return el("article", { className: "project-card" }, [
    renderMedia(project),
    el("div", { className: "project-card__body" }, [
      renderMeta(project),
      el("h3", { className: "project-card__title", text: project.title }),
      project.role ? el("p", { className: "project-card__role", text: project.role }) : null,
      project.description ? el("p", { className: "project-card__desc", text: project.description }) : null,
      project.highlights.length
        ? el("ul", { className: "project-card__highlights" }, project.highlights.slice(0, 3).map((h) => el("li", { text: h })))
        : null,
      renderLangbar(project.languages),
      renderTags(project.tags),
      renderLinks(project.links, project.title),
    ]),
  ]);
}
