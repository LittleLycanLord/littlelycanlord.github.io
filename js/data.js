/**
 * Loading and validation for the generated data files.
 *
 * The site reads data/generated/{projects,career}.json (written by the sync
 * scripts) and data/toolkit.json (hand-edited). Every entry is normalised into
 * a predictable shape; bad fields are dropped with a console warning, never
 * silently, and entries without an id or title are skipped.
 *
 * Local preview: on localhost, add ?demo to the URL to load the fictional
 * samples in data/demo/ instead (they are never deployed).
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEMO_MODE =
  new URLSearchParams(location.search).has("demo") && LOCAL_HOSTS.has(location.hostname);

const BASE = DEMO_MODE ? "data/demo/" : "data/generated/";
export const SOURCES = {
  projects: `${BASE}projects.json`,
  career: `${BASE}career.json`,
  toolkit: "data/toolkit.json",
};

const SCHEMA_VERSION = 1;
const LINK_KINDS = new Set(["repo", "demo", "video", "case-study", "link"]);
const CAREER_KINDS = new Set(["work", "education"]);
const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/** Fetch and parse JSON. Throws a descriptive Error on network or parse failure. */
async function fetchJson(path) {
  let response;
  try {
    response = await fetch(path, { cache: "no-cache" });
  } catch (error) {
    throw new Error(`Could not request ${path}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`Request for ${path} failed with HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

/** Load a data file shaped { schemaVersion?, syncedAt?, items: [...] }. */
export async function loadDataset(kind) {
  const path = SOURCES[kind];
  const data = await fetchJson(path);
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error(`${path} must be an object with an "items" array`);
  }
  if (data.schemaVersion !== undefined && data.schemaVersion !== SCHEMA_VERSION) {
    console.warn(`[portfolio] ${path}: schemaVersion ${data.schemaVersion} differs from the version this page understands (${SCHEMA_VERSION}).`);
  }
  const normalise = { projects: normaliseProject, career: normaliseCareer, toolkit: normaliseToolGroup }[kind];
  const items = data.items.map((raw, i) => normalise(raw, reporter(path, i, raw))).filter(Boolean);
  const syncedAt = typeof data.syncedAt === "string" && !Number.isNaN(Date.parse(data.syncedAt)) ? data.syncedAt : null;
  return { items, syncedAt };
}

/**
 * Allow only http(s), mailto, and same-site relative URLs.
 * Returns null for empty, malformed, or unsafe values (e.g. javascript:).
 */
export function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), document.baseURI);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function isExternal(href) {
  try {
    return new URL(href, document.baseURI).origin !== location.origin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

function reporter(path, index, raw) {
  const label = raw && typeof raw === "object" && typeof raw.title === "string" ? `"${raw.title}"` : `#${index + 1}`;
  return (problem) => console.warn(`[portfolio] ${path} entry ${label}: ${problem}`);
}

const str = (value) => (typeof value === "string" ? value.trim() : "");

function strList(value, field, warn) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warn(`"${field}" should be a list; ignored`);
    return [];
  }
  return value.map(str).filter(Boolean);
}

function date(value, field, warn) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && PARTIAL_DATE.test(value)) return value;
  warn(`"${field}" must look like "2024" or "2024-03"; ignored`);
  return null;
}

function links(value, warn) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warn(`"links" should be a list; ignored`);
    return [];
  }
  return value
    .map((link) => {
      if (!link || typeof link !== "object") return null;
      const href = safeUrl(link.url);
      if (!href) {
        warn(`link ${JSON.stringify(link.url)} is not an http(s), mailto, or relative URL; ignored`);
        return null;
      }
      const kind = LINK_KINDS.has(link.kind) ? link.kind : "link";
      return { kind, label: str(link.label) || defaultLinkLabel(kind), href };
    })
    .filter(Boolean);
}

function defaultLinkLabel(kind) {
  return { repo: "Source code", demo: "Live demo", video: "Video", "case-study": "Case study" }[kind] || "Link";
}

function common(raw, warn) {
  if (!raw || typeof raw !== "object") {
    warn("entry is not an object; skipped");
    return null;
  }
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) {
    warn('"id" and "title" are required; skipped');
    return null;
  }
  const end = date(raw.end, "end", warn);
  return {
    id,
    title,
    description: str(raw.description),
    start: date(raw.start, "start", warn),
    end,
    ongoing: raw.end === null || raw.end === undefined || raw.end === "",
    highlights: strList(raw.highlights, "highlights", warn),
    tags: strList(raw.tags, "tags", warn),
    links: links(raw.links, warn),
    source: str(raw.source),
  };
}

export function normaliseProject(raw, warn) {
  const base = common(raw, warn);
  if (!base) return null;

  let languages = [];
  if (Array.isArray(raw.languages)) {
    languages = raw.languages
      .filter((l) => l && typeof l.name === "string" && Number.isFinite(l.percent) && l.percent > 0)
      .map((l) => ({ name: l.name, percent: Math.min(100, l.percent) }));
  }

  let image = null;
  if (raw.image && typeof raw.image === "object") {
    const src = safeUrl(raw.image.src);
    if (src && str(raw.image.alt)) {
      image = {
        src,
        alt: str(raw.image.alt),
        width: Number.isInteger(raw.image.width) ? raw.image.width : null,
        height: Number.isInteger(raw.image.height) ? raw.image.height : null,
      };
    } else {
      warn('"image" needs a safe "src" and an "alt" text; ignored');
    }
  }

  return {
    ...base,
    kind: "project",
    organization: "",
    role: str(raw.role),
    status: str(raw.status),
    languages,
    image,
    featured: raw.featured === true,
    archived: raw.archived === true,
    stars: Number.isInteger(raw.stars) ? raw.stars : 0,
  };
}

export function normaliseCareer(raw, warn) {
  const base = common(raw, warn);
  if (!base) return null;
  if (!CAREER_KINDS.has(raw.kind)) {
    warn(`"kind" must be "work" or "education"; skipped`);
    return null;
  }
  return {
    ...base,
    kind: raw.kind,
    organization: str(raw.organization),
    location: str(raw.location),
    employmentType: str(raw.employmentType),
  };
}

export function normaliseToolGroup(raw, warn) {
  if (!raw || typeof raw !== "object" || !str(raw.group)) {
    warn('"group" is required; skipped');
    return null;
  }
  const items = strList(raw.items, "items", warn);
  if (!items.length) {
    warn('"items" is empty; skipped');
    return null;
  }
  return { group: str(raw.group), items };
}
