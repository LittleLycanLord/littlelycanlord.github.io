/**
 * Accessible carousel used by About, Career, and Projects.
 *
 * Markup (works as a native horizontal scroller without JS):
 *   <div class="carousel" data-carousel="peek|single" data-carousel-label="…" data-carousel-item="card">
 *     <div class="carousel__viewport"><div class="carousel__track"> …slides… </div></div>
 *   </div>
 *
 * - "peek":   selected slide aligned left, next slide peeks in dimmed (About, Career)
 * - "single": one slide visible, stacked so height never jumps (Projects)
 *
 * Controls (prev/next, dots, counter) are generated here so they never appear
 * without JS. Hidden slides are `inert` so keyboard users only reach the
 * visible slide. Supports ← → Home End, swipe, and horizontal trackpad scroll.
 */
import { el, icon, ICONS } from "./dom.js";

const instances = new WeakMap();

export function setupCarousel(root) {
  instances.get(root)?.destroy();
  const instance = createCarousel(root);
  if (instance) instances.set(root, instance);
  return instance;
}

function createCarousel(root) {
  const mode = root.dataset.carousel === "single" ? "single" : "peek";
  const label = root.dataset.carouselLabel || "Carousel";
  const itemName = root.dataset.carouselItem || "slide";
  const viewport = root.querySelector(".carousel__viewport");
  const track = root.querySelector(".carousel__track");
  if (!viewport || !track) return null;

  const slides = Array.from(track.children).filter((node) => node.matches("article, li, .carousel__slide"));
  if (!slides.length) return null;

  const cleanup = [];
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  };

  let index = 0;
  const count = slides.length;

  root.classList.add("is-enhanced");
  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", label);

  slides.forEach((slide, i) => {
    slide.classList.add("carousel__slide");
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    const heading = slide.querySelector("h3");
    slide.setAttribute("aria-label", `${i + 1} of ${count}${heading ? `: ${heading.textContent.trim()}` : ""}`);
  });

  // ---- Controls -----------------------------------------------------------
  const prev = el("button", {
    className: "icon-btn carousel__prev",
    attrs: { type: "button", "aria-label": `Previous ${itemName}` },
  }, [icon(ICONS.prev)]);
  const next = el("button", {
    className: "icon-btn carousel__next",
    attrs: { type: "button", "aria-label": `Next ${itemName}` },
  }, [icon(ICONS.next)]);

  const dots = slides.map((slide, i) => {
    const heading = slide.querySelector("h3");
    const name = heading ? heading.textContent.trim() : `${itemName} ${i + 1}`;
    const dot = el("button", {
      className: "carousel__dot",
      attrs: { type: "button", "aria-label": `Show ${itemName} ${i + 1}: ${name}` },
    });
    on(dot, "click", () => select(i));
    return dot;
  });

  const counter = el("p", { className: "carousel__counter", attrs: { "aria-atomic": "true" } });
  const controls = el("div", { className: "carousel__controls" }, [
    prev,
    el("div", { className: "carousel__dots", attrs: { role: "group", "aria-label": `Choose ${itemName}` } }, dots),
    counter,
    next,
  ]);

  if (count > 1) root.append(controls);

  // ---- Behaviour ----------------------------------------------------------
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function position() {
    if (mode !== "peek") return;
    // Align the selected slide to the start; clamp so the last slide never leaves a gap.
    const maxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const offset = Math.min(slides[index].offsetLeft, maxOffset);
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  }

  function render() {
    slides.forEach((slide, i) => {
      const selected = i === index;
      slide.classList.toggle("is-selected", selected);
      slide.inert = !selected;
      slide.setAttribute("aria-hidden", String(!selected));
    });
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });

    // If focus sits on a button that is about to be disabled, move it to its sibling.
    const active = document.activeElement;
    prev.disabled = index === 0;
    next.disabled = index === count - 1;
    if (active === prev && prev.disabled) next.focus();
    if (active === next && next.disabled) prev.focus();

    counter.replaceChildren(el("strong", { text: pad(index + 1) }), ` / ${pad(count)}`);
    position();
  }

  function select(target, { announce = true } = {}) {
    const clamped = Math.max(0, Math.min(target, count - 1));
    if (clamped === index && slides[index].classList.contains("is-selected")) return false;
    index = clamped;
    // Announce changes only after user interaction, never on initial render.
    if (announce) counter.setAttribute("aria-live", "polite");
    render();
    return true;
  }

  on(prev, "click", () => select(index - 1));
  on(next, "click", () => select(index + 1));

  on(root, "keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;
    const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: count - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key]);
  });

  // Swipe (touch/pen). Vertical page scrolling is untouched thanks to touch-action: pan-y.
  let startX = null;
  let startY = null;
  on(viewport, "pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    startX = event.clientX;
    startY = event.clientY;
  });
  on(viewport, "pointerup", (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) select(index + (dx < 0 ? 1 : -1));
  });
  on(viewport, "pointercancel", () => {
    startX = null;
  });

  // Horizontal trackpad / shift+wheel only — vertical wheel always scrolls the page.
  let wheelLock = 0;
  on(viewport, "wheel", (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 8) return;
    event.preventDefault();
    const now = performance.now();
    if (now < wheelLock) return;
    if (select(index + (event.deltaX > 0 ? 1 : -1))) wheelLock = now + 450;
  }, { passive: false });

  const resizeObserver = new ResizeObserver(() => position());
  resizeObserver.observe(viewport);
  cleanup.push(() => resizeObserver.disconnect());

  render();

  return {
    select,
    destroy() {
      cleanup.forEach((fn) => fn());
      controls.remove();
      track.style.transform = "";
      root.classList.remove("is-enhanced");
    },
  };
}
