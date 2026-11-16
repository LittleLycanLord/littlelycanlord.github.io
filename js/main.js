/**
 * Entry point: loads the data, renders each section, and wires page features.
 * Datasets load independently, so one broken file never blocks the rest; any
 * failure is shown in the affected section with a "Try again" button.
 */
import { el } from "./dom.js";
import { DEMO_MODE, loadDataset } from "./data.js";
import { renderProjects } from "./projects.js";
import { renderTimeline } from "./timeline.js";
import { aggregateLanguages, renderToolkit } from "./toolkit.js";
import { setupLightbox } from "./lightbox.js";
import { setupScrollspy } from "./nav.js";

const mounts = {
  projects: document.getElementById("projectsMount"),
  timeline: document.getElementById("timelineMount"),
  toolkit: document.getElementById("toolkitMount"),
};

function errorNotice(error) {
  const hint = location.protocol === "file:"
    ? " This page is opened as a file; serve the folder over HTTP instead (see README)."
    : "";
  console.error("[portfolio]", error);
  const notice = el("div", { className: "data-state data-state--error", attrs: { role: "alert" } }, [
    el("p", { text: `Something went wrong while loading this section. ${error.message}${hint}` }),
    el("button", { className: "btn btn--ghost", text: "Try again", attrs: { type: "button" } }),
  ]);
  notice.querySelector("button").addEventListener("click", load);
  return notice;
}

function setBusy(busy) {
  Object.values(mounts).forEach((mount) => mount?.setAttribute("aria-busy", String(busy)));
}

function renderHeroStats(projects, career) {
  const stats = document.getElementById("heroStats");
  if (!stats) return;
  const rows = [
    ["Projects", projects.length],
    ["Languages", aggregateLanguages(projects).length],
    ["Roles", career.filter((e) => e.kind === "work").length],
  ].filter(([, value]) => value > 0);
  stats.replaceChildren(...rows.map(([label, value]) => el("div", {}, [el("dt", { text: label }), el("dd", { text: String(value) })])));
  stats.hidden = rows.length === 0;
}

function renderSyncedAt(...timestamps) {
  const node = document.getElementById("syncedAt");
  const latest = timestamps.filter(Boolean).sort().pop();
  if (!node || !latest) return;
  const label = new Date(latest).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  node.replaceChildren("Data last synced ", el("time", { text: label, attrs: { datetime: latest } }));
  node.hidden = false;
}

async function load() {
  setBusy(true);
  const [projectsResult, careerResult, toolkitResult] = await Promise.allSettled([
    loadDataset("projects"),
    loadDataset("career"),
    loadDataset("toolkit"),
  ]);
  const ok = (result) => (result.status === "fulfilled" ? result.value : null);
  const projects = ok(projectsResult)?.items ?? [];
  const career = ok(careerResult)?.items ?? [];
  const groups = ok(toolkitResult)?.items ?? [];

  // Projects carousel
  if (projectsResult.status === "fulfilled") renderProjects(mounts.projects, projects);
  else mounts.projects.replaceChildren(errorNotice(projectsResult.reason));

  // Timeline: render whatever loaded; flag anything that didn't.
  if (projectsResult.status === "rejected" && careerResult.status === "rejected") {
    mounts.timeline.replaceChildren(errorNotice(careerResult.reason));
  } else {
    renderTimeline(mounts.timeline, [...career, ...projects]);
    if (careerResult.status === "rejected") mounts.timeline.prepend(errorNotice(careerResult.reason));
  }

  // Toolkit
  renderToolkit(mounts.toolkit, projects, groups);
  if (toolkitResult.status === "rejected") mounts.toolkit.prepend(errorNotice(toolkitResult.reason));

  renderHeroStats(projects, career);
  renderSyncedAt(ok(projectsResult)?.syncedAt, ok(careerResult)?.syncedAt);
  setBusy(false);
}

function init() {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
  if (DEMO_MODE) document.getElementById("demoBanner").hidden = false;
  setupLightbox();
  setupScrollspy();
  load();
}

init();
