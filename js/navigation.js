/**
 * Scrollspy, back-to-top button, and the heading text-decode effect.
 */
import { prefersReducedMotion } from "./dom.js";

/* ------------------------------------------------------------- Scrollspy */
export function setupScrollspy() {
  const links = Array.from(document.querySelectorAll(".scrollspy a[href^='#']"));
  const sections = links.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
  if (!sections.length) return;

  let current = null;
  let frame = 0;

  function headerOffset() {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--sticky-header-height");
    return Number.parseFloat(value) || 0;
  }

  function update() {
    frame = 0;
    const line = headerOffset() + window.innerHeight * 0.35;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let active = sections[0];
    if (atBottom) {
      active = sections[sections.length - 1];
    } else {
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) active = section;
      }
    }
    if (active.id === current) return;
    current = active.id;
    links.forEach((link) => {
      if (link.hash === `#${current}`) {
        link.setAttribute("aria-current", "location");
        // Keep the active tab visible in the horizontal mobile bar.
        const list = link.closest("ul");
        if (list && list.scrollWidth > list.clientWidth) {
          list.scrollTo({ left: link.offsetLeft - 16, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        }
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}

/* ----------------------------------------------------------- Back to top */
export function setupBackToTop() {
  const button = document.getElementById("backToTop");
  const hero = document.getElementById("home");
  const heading = hero?.querySelector("h1");
  if (!button || !hero) return;

  new IntersectionObserver(([entry]) => {
    button.hidden = entry.isIntersecting;
  }, { threshold: 0.15 }).observe(hero);

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    // Move focus to the top so keyboard users continue from there.
    heading?.focus({ preventScroll: true });
  });
}

/* ----------------------------------------------------------- Text decode */
const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Scrambles [data-decode] headings into place the first time they scroll into
 * view. The real text stays in the DOM (and in the accessibility tree) the whole
 * time; the scramble is an aria-hidden overlay, so layout never shifts.
 */
export function setupTextDecode() {
  const targets = Array.from(document.querySelectorAll("[data-decode]"));
  if (!targets.length || prefersReducedMotion()) return;

  const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

  function prepare(heading) {
    const text = heading.textContent.trim();
    const wrapper = document.createElement("span");
    wrapper.className = "decode";
    const finalText = document.createElement("span");
    finalText.className = "decode__final";
    finalText.textContent = text;
    wrapper.append(finalText);
    heading.replaceChildren(wrapper);
    return { wrapper, text };
  }

  function run({ wrapper, text }) {
    const overlay = document.createElement("span");
    overlay.className = "decode__anim";
    overlay.setAttribute("aria-hidden", "true");
    wrapper.append(overlay);
    wrapper.classList.add("is-decoding");

    const started = performance.now();
    const duration = Math.min(1100, Math.max(450, text.length * 45));

    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const settled = Math.floor(progress * text.length);
      overlay.textContent = Array.from(text, (char, i) => (char === " " || i < settled ? char : randomGlyph())).join("");
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        overlay.remove();
        wrapper.classList.remove("is-decoding");
      }
    }
    requestAnimationFrame(frame);
  }

  const states = new Map(targets.map((heading) => [heading, prepare(heading)]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      run(states.get(entry.target));
    }
  }, { threshold: 0.6 });

  targets.forEach((heading) => observer.observe(heading));
}
