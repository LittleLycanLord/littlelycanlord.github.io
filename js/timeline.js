/**
 * Interactive timeline: work, education, and projects on one axis.
 *
 * - Newest first. Ongoing entries sit under a "Now" marker; the rest are
 *   grouped by the year they ended.
 * - Filter chips are toggle buttons (aria-pressed); a polite status line
 *   announces how many entries are shown.
 * - Each entry title is a disclosure button (aria-expanded) for its details.
 * - Vertical on small screens, horizontal scroller on wide screens (CSS),
 *   with scroll buttons that disable at either end.
 */
import { el, icon, ICONS, prefersReducedMotion } from "./dom.js";
import { compareByRecency, durationText, KIND_LABELS, periodNodes } from "./format.js";
import { renderLangbar, renderLinks, renderTags } from "./projects.js";

const KIND_ORDER = ["work", "education", "project"];
const CHEVRON = "M6 9l6 6 6-6";

export function renderTimeline(mount, entries) {
  if (!entries.length) {
    mount.replaceChildren(
      el("div", { className: "empty-state" }, [
        el("p", {}, [el("strong", { text: "The timeline is being set up." })]),
        el("p", { text: "Work experience, education, and projects will appear here once they're synced." }),
      ]),
    );
    return;
  }

  const sorted = [...entries].sort(compareByRecency);
  const kinds = KIND_ORDER.filter((kind) => sorted.some((e) => e.kind === kind));
  const active = new Set(kinds);
  const open = new Set();

  // ---- Toolbar ------------------------------------------------------------
  const status = el("p", { className: "timeline__status", attrs: { role: "status" } });

  const chips = kinds.map((kind) => {
    const count = sorted.filter((e) => e.kind === kind).length;
    const chip = el("button", {
      className: "chip",
      attrs: { type: "button", "data-kind": kind, "aria-pressed": "true" },
    }, [KIND_LABELS[kind], el("span", { className: "chip__count", text: String(count) })]);
    chip.addEventListener("click", () => {
      if (active.has(kind)) active.delete(kind);
      else active.add(kind);
      chip.setAttribute("aria-pressed", String(active.has(kind)));
      renderList();
    });
    return chip;
  });

  const filters = kinds.length > 1
    ? el("div", { className: "filters", attrs: { role: "group", "aria-label": "Show entry types" } }, chips)
    : null;

  const viewportId = "timeline-viewport";
  const prev = el("button", {
    className: "icon-btn",
    attrs: { type: "button", "aria-label": "Scroll timeline toward newer entries", "aria-controls": viewportId },
  }, [icon(ICONS.prev)]);
  const next = el("button", {
    className: "icon-btn",
    attrs: { type: "button", "aria-label": "Scroll timeline toward older entries", "aria-controls": viewportId },
  }, [icon(ICONS.next)]);
  const scrollControls = el("div", { className: "timeline__scroll" }, [prev, next]);

  const list = el("ol", { className: "timeline__list" });
  const viewport = el("div", {
    className: "timeline__viewport",
    attrs: { id: viewportId, role: "region", "aria-label": "Timeline entries", tabindex: "0" },
  }, [list]);

  mount.replaceChildren(
    el("div", { className: "timeline" }, [
      el("div", { className: "timeline__toolbar" }, [filters, status, scrollControls]),
      viewport,
    ]),
  );

  // ---- Rendering ----------------------------------------------------------
  function renderList() {
    const visible = sorted.filter((e) => active.has(e.kind));
    const items = [];
    let currentGroup = null;

    for (const entry of visible) {
      const group = entry.ongoing ? "now" : (entry.end || entry.start || "").slice(0, 4) || "undated";
      if (group !== currentGroup) {
        currentGroup = group;
        items.push(renderMarker(group));
      }
      items.push(renderEntry(entry));
    }

    if (!visible.length) {
      items.push(el("li", { className: "tl-item" }, [
        el("p", { className: "tl-card", text: "No entry types selected. Turn a filter back on to see entries." }),
      ]));
    }

    list.replaceChildren(...items);
    status.textContent = visible.length === sorted.length
      ? `Showing all ${sorted.length} entries`
      : `Showing ${visible.length} of ${sorted.length} entries`;
    viewport.scrollLeft = 0;
    updateScrollButtons();
  }

  function renderMarker(group) {
    const label = group === "now" ? "Now" : group === "undated" ? "Undated" : group;
    return el("li", {
      className: `tl-item tl-marker${group === "now" ? " tl-marker--now" : ""}`,
      attrs: { "aria-hidden": "true" },
    }, [el("span", { className: "tl-marker__label", text: label })]);
  }

  function renderEntry(entry) {
    const detailsId = `tl-${entry.kind}-${entry.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const isOpen = open.has(detailsId);

    const toggle = el("button", {
      className: "tl-toggle",
      attrs: { type: "button", "aria-expanded": String(isOpen), "aria-controls": detailsId },
    }, [el("span", { className: "tl-toggle__text", text: entry.title }), icon(CHEVRON)]);

    const details = renderDetails(entry, detailsId);
    details.hidden = !isOpen;

    const item = el("li", {
      className: `tl-item tl-entry${entry.ongoing ? " is-ongoing" : ""}${isOpen ? " is-open" : ""}`,
      attrs: { "data-kind": entry.kind },
    }, [
      el("span", { className: "tl-entry__dot", attrs: { "aria-hidden": "true" } }),
      el("div", { className: "tl-card" }, [
        el("p", { className: "tl-card__top" }, [
          el("span", { className: "tl-kind", text: KIND_LABELS[entry.kind] }),
          el("span", { className: "tl-date" }, periodNodes(entry.start, entry.end, entry.ongoing)),
          entry.ongoing
            ? el("span", { className: "badge badge--now", text: entry.kind === "project" ? "Active" : "Current" })
            : null,
        ]),
        el("h3", { className: "tl-card__title" }, [toggle]),
        subtitle(entry),
        details,
      ]),
    ]);

    toggle.addEventListener("click", () => {
      const nowOpen = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(nowOpen));
      details.hidden = !nowOpen;
      item.classList.toggle("is-open", nowOpen);
      if (nowOpen) open.add(detailsId);
      else open.delete(detailsId);
    });

    return item;
  }

  // ---- Horizontal scrolling (wide screens) -------------------------------
  function updateScrollButtons() {
    // A few pixels of slack: scroll snapping can rest just off the edges.
    const max = viewport.scrollWidth - viewport.clientWidth;
    prev.disabled = viewport.scrollLeft <= 8;
    next.disabled = viewport.scrollLeft >= max - 8;
    scrollControls.hidden = max <= 8;
  }

  function scrollByPage(direction) {
    viewport.scrollBy({
      left: direction * viewport.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  prev.addEventListener("click", () => scrollByPage(-1));
  next.addEventListener("click", () => scrollByPage(1));
  viewport.addEventListener("scroll", updateScrollButtons, { passive: true });
  new ResizeObserver(updateScrollButtons).observe(viewport);

  renderList();
}

function subtitle(entry) {
  const parts = [];
  if (entry.kind === "project") {
    if (entry.role) parts.push(entry.role);
    if (entry.languages[0]) parts.push(entry.languages[0].name);
  } else {
    if (entry.organization && entry.organization !== entry.title) parts.push(entry.organization);
    if (entry.employmentType) parts.push(entry.employmentType);
    if (entry.location) parts.push(entry.location);
  }
  return parts.length ? el("p", { className: "tl-card__org", text: parts.join(" · ") }) : null;
}

function renderDetails(entry, id) {
  const duration = durationText(entry.start, entry.end, entry.ongoing);
  return el("div", { className: "tl-details", attrs: { id } }, [
    duration ? el("p", { className: "tl-duration", text: duration }) : null,
    entry.description ? el("p", { className: "tl-details__desc", text: entry.description }) : null,
    entry.highlights.length
      ? el("ul", { className: "tl-details__list" }, entry.highlights.map((h) => el("li", { text: h })))
      : null,
    entry.kind === "project" ? renderLangbar(entry.languages) : null,
    renderTags(entry.tags),
    renderLinks(entry.links, entry.title),
  ]);
}
