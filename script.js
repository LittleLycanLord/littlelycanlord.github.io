/**
 * Generic timeline renderer for career and project sections.
 * Data format is documented in /data/career.json and /data/projects.json.
 */
async function renderTimeline(targetId, dataPath) {
  const timeline = document.getElementById(targetId);
  if (!timeline) return;

  try {
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error(`Failed to load ${dataPath}`);

    const items = await response.json();

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "timeline-item";
      card.setAttribute("role", "listitem");

      card.innerHTML = `
        <p class="timeline-date">${item.period}</p>
        <h3 class="timeline-title">${item.title}</h3>
        ${item.subtitle ? `<p class="timeline-subtitle">${item.subtitle}</p>` : ""}
        <p class="timeline-description">${item.description}</p>
      `;

      timeline.appendChild(card);
    });
  } catch (error) {
    timeline.innerHTML = "<p>Timeline data could not be loaded.</p>";
    console.error(error);
  }
}

function setupBackToTopButton() {
  const button = document.getElementById("backToTop");
  const homeSection = document.getElementById("home");
  if (!button || !homeSection) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      button.classList.toggle("is-visible", !entry.isIntersecting);
    },
    { threshold: 0.2 }
  );

  observer.observe(homeSection);
  button.addEventListener("click", () => {
    homeSection.scrollIntoView({ behavior: "smooth" });
  });
}

renderTimeline("careerTimeline", "data/career.json");
renderTimeline("projectsTimeline", "data/projects.json");
setupBackToTopButton();
setupTextDecode();
setupGalleryCarousels();

function setupGalleryCarousels() {
  document.querySelectorAll("[data-gallery-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".gallery-carousel__track");
    const previous = carousel.querySelector(".gallery-carousel__button--prev");
    const next = carousel.querySelector(".gallery-carousel__button--next");
    if (!track || !previous || !next) return;

    let selectedIndex = 0;
    let items = [];

    function refreshItems() {
      items = Array.from(track.children);
      if (!items.length) {
        previous.disabled = true;
        next.disabled = true;
        return;
      }

      selectedIndex = Math.min(selectedIndex, items.length - 1);
      items.forEach((item, index) => {
        item.classList.add("gallery-carousel__item");
        item.classList.toggle("is-selected", index === selectedIndex);
        item.setAttribute("aria-current", index === selectedIndex ? "true" : "false");
      });
      previous.disabled = selectedIndex === 0;
      next.disabled = selectedIndex === items.length - 1;
    }

    function select(index) {
      if (!items.length) return;
      const nextIndex = Math.max(0, Math.min(index, items.length - 1));
      if (nextIndex === selectedIndex) return false;
      selectedIndex = nextIndex;
      refreshItems();
      items[selectedIndex].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return true;
    }

    previous.addEventListener("click", () => select(selectedIndex - 1));
    next.addEventListener("click", () => select(selectedIndex + 1));

    track.addEventListener("wheel", (event) => {
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
      if (!delta) return;
      if (select(selectedIndex + (delta > 0 ? 1 : -1))) {
        event.preventDefault();
      }
    }, { passive: false });

    track.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        select(selectedIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        select(selectedIndex + 1);
      }
    });

    refreshItems();

    const mutationObserver = new MutationObserver(refreshItems);
    mutationObserver.observe(track, { childList: true });
  });
}

function setupTextDecode() {
  const selector = ".hero__name, .section__heading h2, .about-card h3, .timeline-title";
  const glyphs = "!<>-_\\/[]{}=+*^?#@$%&ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observedHeadings = new WeakSet();
  const states = new WeakMap();

  function prepareHeading(heading) {
    if (observedHeadings.has(heading)) return;

    const finalText = heading.textContent.trim();
    if (!finalText) return;

    heading.classList.add("decode-heading");
    heading.setAttribute("aria-label", finalText);
    heading.textContent = "";

    const text = document.createElement("span");
    text.className = "decode-heading__text";
    text.setAttribute("aria-hidden", "true");
    text.textContent = finalText;
    heading.appendChild(text);

    observedHeadings.add(heading);
    states.set(heading, { finalText, text, frame: 0, run: 0 });
  }

  function randomGlyph() {
    return glyphs[Math.floor(Math.random() * glyphs.length)];
  }

  function resetHeading(heading) {
    const state = states.get(heading);
    if (!state) return;

    state.run += 1;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.text.textContent = reducedMotion.matches
      ? state.finalText
      : state.finalText.replace(/[^ \n]/g, randomGlyph);
  }

  function decodeHeading(heading) {
    const state = states.get(heading);
    if (!state) return;

    state.run += 1;
    const run = state.run;
    if (state.frame) cancelAnimationFrame(state.frame);

    if (reducedMotion.matches) {
      state.text.textContent = state.finalText;
      state.frame = 0;
      return;
    }

    const startedAt = performance.now();
    const duration = Math.max(480, state.finalText.length * 55);
    const settleWindow = 220;

    function render(now) {
      if (run !== state.run) return;

      const progress = Math.min(1, (now - startedAt) / duration);
      const settledCount = Math.floor(progress * state.finalText.length);
      state.text.textContent = Array.from(state.finalText, (character, index) => {
        if (character === " " || index < settledCount) return character;
        return randomGlyph();
      }).join("");

      if (progress < 1) {
        state.frame = requestAnimationFrame(render);
      } else {
        state.text.textContent = state.finalText;
        state.frame = 0;
      }
    }

    state.frame = requestAnimationFrame(render);
  }

  function observeHeadings() {
    document.querySelectorAll(selector).forEach(prepareHeading);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          decodeHeading(entry.target);
        } else {
          resetHeading(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );

  observeHeadings();
  document.querySelectorAll(selector).forEach((heading) => observer.observe(heading));

  const mutations = new MutationObserver(() => {
    observeHeadings();
    document.querySelectorAll(selector).forEach((heading) => {
      if (!states.has(heading)) observer.observe(heading);
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  reducedMotion.addEventListener("change", () => {
    document.querySelectorAll(selector).forEach((heading) => {
      prepareHeading(heading);
      resetHeading(heading);
    });
  });
}

/* Lightbox for Who am I? gallery */
(function setupLightbox() {
  const dialog = document.getElementById("lightbox");
  if (!dialog) return;

  const stageImg = dialog.querySelector('.lightbox__img');
  const prevBtn = dialog.querySelector('.lightbox__nav--prev');
  const nextBtn = dialog.querySelector('.lightbox__nav--next');
  const closeBtn = dialog.querySelector('.lightbox__close');

  const galleryImgs = Array.from(document.querySelectorAll('.about-ribbon .about-card img'));
  if (!galleryImgs.length) return;

  const items = galleryImgs.map(img => ({ src: img.src, alt: img.alt }));
  let current = 0;
  let lastFocusedElement = null;

  function setBodyScrollLocked(isLocked) {
    document.body.classList.toggle('lightbox-open', isLocked);
    document.documentElement.classList.toggle('lightbox-open', isLocked);
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image failed to load: ${src}`));
      img.src = src;
    });
  }

  async function showIndex(index) {
    current = ((index % items.length) + items.length) % items.length;
    const nextItem = items[current];

    stageImg.style.opacity = '0';
    stageImg.style.transform = 'scale(0.98)';

    try {
      await preloadImage(nextItem.src);
      stageImg.src = nextItem.src;
      stageImg.alt = nextItem.alt || '';
      stageImg.style.opacity = '1';
      stageImg.style.transform = 'scale(1)';
    } catch (error) {
      console.error(error);
      stageImg.style.opacity = '1';
      stageImg.style.transform = 'scale(1)';
    }
  }

  function restoreFocus() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  async function openAt(index) {
    current = ((index % items.length) + items.length) % items.length;
    if (!lastFocusedElement || !galleryImgs.includes(lastFocusedElement)) {
      lastFocusedElement = galleryImgs[current] || document.activeElement || null;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
      setBodyScrollLocked(true);
    }

    await showIndex(current);
    closeBtn.focus();
    setBodyScrollLocked(true);
  }

  galleryImgs.forEach((imgEl, idx) => {
    imgEl.style.cursor = 'zoom-in';
    imgEl.addEventListener('click', (event) => {
      event.preventDefault();
      lastFocusedElement = imgEl;
      openAt(idx);
    });
    imgEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        lastFocusedElement = imgEl;
        openAt(idx);
      }
    });
    if (!imgEl.hasAttribute('tabindex')) imgEl.setAttribute('tabindex', '0');
  });

  prevBtn.addEventListener('click', () => {
    showIndex(current - 1);
  });

  nextBtn.addEventListener('click', () => {
    showIndex(current + 1);
  });

  closeBtn.addEventListener('click', () => {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showIndex(current - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showIndex(current + 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  });

  dialog.addEventListener('close', () => {
    setBodyScrollLocked(false);
    stageImg.style.opacity = '0';
    stageImg.style.transform = 'scale(0.98)';
    setTimeout(() => {
      stageImg.src = '';
      stageImg.alt = '';
      restoreFocus();
    }, 180);
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    }
  });
})();
