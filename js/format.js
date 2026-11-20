/**
 * Formatting helpers shared by the projects carousel, timeline, and toolkit.
 * Dates are partial ISO strings: "2024" or "2024-03". `null` end = ongoing.
 */
import { el } from "./dom.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** <time> elements for a period: "Jan 2024 – Present", "2019 – 2023", "Feb 2023". */
export function periodNodes(start, end, ongoing) {
  const time = (value) => el("time", { text: formatDate(value), attrs: { datetime: value } });
  if (!start && !end) return [ongoing ? "Ongoing" : ""];
  if (!start) return [time(end)];
  if (ongoing) return [time(start), " – Present"];
  if (!end || end === start) return [time(start)];
  return [time(start), " – ", time(end)];
}

export function periodText(start, end, ongoing) {
  return periodNodes(start, end, ongoing)
    .map((node) => (typeof node === "string" ? node : node.textContent))
    .join("");
}

function toMonthIndex(value, edge) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + (month ? month - 1 : edge === "end" ? 11 : 0);
}

/** "2 yrs 3 mos", inclusive of both months. Empty when there's no start. */
export function durationText(start, end, ongoing, now = new Date()) {
  if (!start) return "";
  const endIndex = ongoing || !end ? now.getFullYear() * 12 + now.getMonth() : toMonthIndex(end, "end");
  const months = endIndex - toMonthIndex(start, "start") + 1;
  if (months < 1) return "";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rest) parts.push(`${rest} mo${rest > 1 ? "s" : ""}`);
  return parts.join(" ");
}

/** Sort key: ongoing first, then latest end, then latest start. */
export function compareByRecency(a, b) {
  const endKey = (item) => (item.ongoing ? "9999-99" : item.end || item.start || "0000");
  return endKey(b).localeCompare(endKey(a)) || (b.start || "").localeCompare(a.start || "");
}

export const KIND_LABELS = { work: "Work", education: "Education", project: "Project" };

// Colours for common languages; anything else gets a stable hue from its name.
const LANGUAGE_COLORS = {
  "C++": "#f34b7d",
  "C#": "#68d391",
  C: "#a8b9cc",
  JavaScript: "#f1e05a",
  TypeScript: "#5aa9e6",
  HTML: "#e96d4c",
  CSS: "#a78bfa",
  Python: "#5b9bd5",
  Java: "#d9a35b",
  Lua: "#7b8cff",
  GDScript: "#6fb8d8",
  ShaderLab: "#9aa5b1",
  HLSL: "#b07cc6",
  GLSL: "#7fb6a4",
  CMake: "#73c991",
  Rust: "#dea584",
  Go: "#4fc3d9",
  Kotlin: "#b38bff",
  Swift: "#ff8a5c",
  PHP: "#8892bf",
  Shell: "#89e051",
  PowerShell: "#5391fe",
};

export function languageColor(name) {
  if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) % 360;
  return `hsl(${hash} 55% 65%)`;
}
