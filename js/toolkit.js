/**
 * Toolkit: languages measured from portfolio repositories, plus hand-written
 * groups from data/toolkit.json.
 *
 * A language counts for a project when it makes up at least MIN_SHARE percent
 * of that repo's code. Rows are sorted by how many projects use the language,
 * then by its total share.
 */
import { el } from "./dom.js";
import { languageColor } from "./format.js";

const MIN_SHARE = 5;
const MAX_LANGUAGES = 10;

export function aggregateLanguages(projects) {
  const totals = new Map();
  for (const project of projects) {
    for (const { name, percent } of project.languages) {
      if (percent < MIN_SHARE) continue;
      const entry = totals.get(name) || { name, projects: 0, weight: 0 };
      entry.projects += 1;
      entry.weight += percent;
      totals.set(name, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.projects - a.projects || b.weight - a.weight);
}

export function renderToolkit(mount, projects, groups) {
  const languages = aggregateLanguages(projects).slice(0, MAX_LANGUAGES);
  const cards = [];

  if (languages.length) {
    const most = languages[0].projects;
    cards.push(el("section", { className: "toolkit__group", attrs: { "aria-labelledby": "toolkit-languages" } }, [
      el("h4", { text: "Languages", attrs: { id: "toolkit-languages" } }),
      el("ul", { className: "lang-list" }, languages.map((lang) => {
        const bar = el("span");
        bar.style.setProperty("--share", `${Math.max(6, (lang.projects / most) * 100)}%`);
        const row = el("li", { className: "lang-row" }, [
          el("span", { text: lang.name }),
          el("span", { className: "lang-row__count", text: `${lang.projects} project${lang.projects > 1 ? "s" : ""}` }),
          el("span", { className: "lang-row__bar", attrs: { "aria-hidden": "true" } }, [bar]),
        ]);
        row.style.setProperty("--lang", languageColor(lang.name));
        return row;
      })),
    ]));
  }

  groups.forEach((group, i) => {
    const headingId = `toolkit-group-${i}`;
    cards.push(el("section", { className: "toolkit__group", attrs: { "aria-labelledby": headingId } }, [
      el("h4", { text: group.group, attrs: { id: headingId } }),
      el("ul", { className: "tag-list" }, group.items.map((item) => el("li", { className: "tag", text: item }))),
    ]));
  });

  if (!cards.length) {
    mount.replaceChildren(el("p", { className: "data-state", text: "The toolkit fills in as projects are added." }));
    return;
  }
  mount.replaceChildren(el("div", { className: "toolkit__grid" }, cards));
}
