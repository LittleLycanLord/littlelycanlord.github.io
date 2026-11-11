/**
 * Entry point. Loads JSON content, renders it, then enhances the page.
 * Each section loads independently, so one broken file never blocks the rest.
 */
import { loadJson, normaliseCareer, normaliseProject, normaliseSkillGroup } from "./data.js";
import { renderCareerCard, renderProjectCard, renderSkillGroup, renderEmptyState, renderErrorState } from "./render.js";
import { setupCarousel } from "./carousel.js";
import { setupLightbox } from "./lightbox.js";
import { setupScrollspy, setupBackToTop, setupTextDecode } from "./navigation.js";

const SECTIONS = {
  career: { normalise: normaliseCareer, render: renderCareerCard, noun: "career entries" },
  projects: { normalise: normaliseProject, render: renderProjectCard, noun: "projects" },
  skills: { normalise: normaliseSkillGroup, render: renderSkillGroup, noun: "toolkit groups" },
};

async function populate(container) {
  const config = SECTIONS[container.dataset.kind];
  const source = container.dataset.source;
  if (!config || !source) {
    console.error("[portfolio] Data container is missing a valid data-kind or data-source", container);
    return;
  }

  container.setAttribute("aria-busy", "true");
  const carouselRoot = container.closest("[data-carousel]");

  try {
    const raw = await loadJson(source);
    const entries = raw.map(config.normalise).filter(Boolean);
    container.replaceChildren(
      ...(entries.length ? entries.map(config.render) : [renderEmptyState(`No ${config.noun} to show yet.`)])
    );
    if (carouselRoot && entries.length) setupCarousel(carouselRoot);
  } catch (error) {
    console.error(`[portfolio] Could not load ${source}:`, error);
    const hint = location.protocol === "file:"
      ? " Open the site through a local web server (see README) — browsers block data files on file:// pages."
      : "";
    container.replaceChildren(
      renderErrorState(`Sorry — the ${config.noun} could not be loaded.${hint}`, () => populate(container))
    );
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

function init() {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  // Static carousels (About) enhance immediately; data-driven ones after loading.
  document.querySelectorAll("[data-carousel]").forEach((root) => {
    if (!root.querySelector("[data-source]")) setupCarousel(root);
  });

  setupLightbox();
  setupScrollspy();
  setupBackToTop();
  setupTextDecode();

  document.querySelectorAll("[data-source]").forEach(populate);
}

init();
