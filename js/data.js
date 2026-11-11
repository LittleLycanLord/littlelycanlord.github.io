/**
 * Loading and validation for the JSON content files in /data.
 *
 * Every entry is normalised into a predictable shape. Invalid fields are
 * dropped with a console warning (never silently), and entries without a
 * title are skipped. Older entries that only have period/title/subtitle/
 * description keep working unchanged.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const LINK_KINDS = new Set(["repo", "demo", "video", "case-study", "link"]);

/** Fetch a JSON file and return its array of entries. Throws on network/parse errors. */
export async function loadJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Request for ${path} failed with HTTP ${response.status}`);
  }
  let parsed;
  try {
    parsed = await response.json();
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  // Accept either a bare array (original format) or { "items": [...] }.
  const items = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${path} must contain a JSON array of entries`);
  }
  return items;
}

/**
 * Resolve a URL and allow only http(s), mailto, and same-site relative paths.
 * Returns null for empty, malformed, or unsafe values (e.g. javascript:).
 */
export function safeUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.trim() === "#") return null;
  try {
    const url = new URL(value.trim(), document.baseURI);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function isExternal(href) {
  try {
    const url = new URL(href);
    return url.protocol.startsWith("http") && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function createReporter(source, index) {
  const problems = [];
  return {
    warn(message) {
      problems.push(message);
    },
    flush(title) {
      if (problems.length) {
        console.warn(`[portfolio] ${source} entry ${index + 1}${title ? ` ("${title}")` : ""}:\n  - ${problems.join("\n  - ")}`);
      }
    },
  };
}

function str(raw, key, report, { required = false } = {}) {
  const value = raw[key];
  if (value === undefined || value === null || value === "") {
    if (required) report.warn(`missing required "${key}"`);
    return "";
  }
  if (typeof value !== "string" && typeof value !== "number") {
    report.warn(`"${key}" should be text, got ${typeof value}`);
    return "";
  }
  return String(value).trim();
}

function strList(raw, key, report) {
  const value = raw[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    report.warn(`"${key}" should be an array of strings`);
    return [];
  }
  return value.filter((item, i) => {
    const ok = typeof item === "string" && item.trim() !== "";
    if (!ok) report.warn(`"${key}[${i}]" is not a non-empty string and was skipped`);
    return ok;
  }).map((item) => item.trim());
}

function links(raw, report) {
  const value = raw.links;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    report.warn(`"links" should be an array`);
    return [];
  }
  return value.flatMap((link, i) => {
    if (!link || typeof link !== "object") {
      report.warn(`"links[${i}]" should be an object with "label" and "url"`);
      return [];
    }
    const kind = LINK_KINDS.has(link.kind) ? link.kind : "link";
    if (link.kind && !LINK_KINDS.has(link.kind)) {
      report.warn(`"links[${i}].kind" "${link.kind}" is unknown; use one of ${[...LINK_KINDS].join(", ")}`);
    }
    const label = typeof link.label === "string" && link.label.trim() ? link.label.trim() : defaultLabel(kind);
    const href = safeUrl(link.url);
    if (link.url && !href) report.warn(`"links[${i}].url" is not a valid http(s)/mailto URL and was disabled`);
    // A link without a usable URL is rendered as a clearly-marked "not available yet" pill.
    return [{ kind, label, href }];
  });
}

function defaultLabel(kind) {
  return { repo: "Repository", demo: "Live demo", video: "Video", "case-study": "Case study" }[kind] || "Link";
}

function image(raw, report) {
  const value = raw.image;
  if (value === undefined || value === null || value === "") return null;
  const obj = typeof value === "string" ? { src: value } : value;
  if (typeof obj !== "object") {
    report.warn(`"image" should be an object { src, alt, width, height }`);
    return null;
  }
  const src = safeUrl(obj.src);
  if (!src) {
    report.warn(`"image.src" is missing or invalid`);
    return null;
  }
  if (!obj.alt && obj.alt !== "") report.warn(`"image.alt" is missing — add a short description for screen readers`);
  const width = Number.parseInt(obj.width, 10);
  const height = Number.parseInt(obj.height, 10);
  return {
    src,
    alt: typeof obj.alt === "string" ? obj.alt : "",
    width: Number.isFinite(width) && width > 0 ? width : 1600,
    height: Number.isFinite(height) && height > 0 ? height : 1000,
  };
}

function normaliseCommon(raw, report) {
  return {
    period: str(raw, "period", report),
    title: str(raw, "title", report, { required: true }),
    subtitle: str(raw, "subtitle", report),
    description: str(raw, "description", report),
    tags: strList(raw, "tags", report),
    placeholder: raw.placeholder === true,
  };
}

export function normaliseCareer(raw, index) {
  const report = createReporter("career.json", index);
  if (!raw || typeof raw !== "object") {
    report.warn("entry is not an object");
    report.flush();
    return null;
  }
  const entry = {
    ...normaliseCommon(raw, report),
    organization: str(raw, "organization", report),
    location: str(raw, "location", report),
    type: str(raw, "type", report),
    highlights: strList(raw, "highlights", report),
  };
  report.flush(entry.title);
  return entry.title ? entry : null;
}

export function normaliseProject(raw, index) {
  const report = createReporter("projects.json", index);
  if (!raw || typeof raw !== "object") {
    report.warn("entry is not an object");
    report.flush();
    return null;
  }
  const entry = {
    ...normaliseCommon(raw, report),
    type: str(raw, "type", report),
    role: str(raw, "role", report),
    status: str(raw, "status", report),
    links: links(raw, report),
    image: image(raw, report),
  };
  report.flush(entry.title);
  return entry.title ? entry : null;
}

export function normaliseSkillGroup(raw, index) {
  const report = createReporter("skills.json", index);
  if (!raw || typeof raw !== "object") {
    report.warn("entry is not an object");
    report.flush();
    return null;
  }
  const entry = {
    title: str(raw, "group", report, { required: true }),
    items: strList(raw, "items", report),
    placeholder: raw.placeholder === true,
  };
  report.flush(entry.title);
  return entry.title ? entry : null;
}
