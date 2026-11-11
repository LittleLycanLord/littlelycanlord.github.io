/**
 * Small DOM helpers. All text goes through textContent, so JSON content can
 * never inject markup.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string> }} [options]
 * @param {Array<Node | string | null | undefined | false>} [children]
 */
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(name, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Build a stroked 24×24 icon from path data. Paths are static strings defined in code. */
export function icon(pathData, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}

export const ICONS = {
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  external: "M7 17 17 7M8 7h9v9",
  repo: "M9 19c-4 1.5-4-2-5.5-2m11 4v-3.1c0-1 .1-1.4-.5-2 2.8-.3 5.7-1.4 5.7-6.1a4.8 4.8 0 0 0-1.3-3.4A4.5 4.5 0 0 0 18.3 2S17.2 1.7 15 3.2a13.6 13.6 0 0 0-6 0C6.8 1.7 5.7 2 5.7 2a4.5 4.5 0 0 0-.1 3.3 4.8 4.8 0 0 0-1.3 3.4c0 4.7 2.9 5.8 5.7 6.1-.6.6-.6 1.1-.5 2V21",
  demo: "M5 4l14 8-14 8Z",
  video: "M3 6h12v12H3ZM15 10l6-3v10l-6-3",
  "case-study": "M6 3h9l4 4v14H6ZM14 3v5h5M9 13h7M9 17h5",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
};

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
