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

  // Build an array of sources/alt text
  const items = galleryImgs.map(img => ({ src: img.src, alt: img.alt }));
  let current = 0;

  function showIndex(i, direction = 0) {
    current = ((i % items.length) + items.length) % items.length;
    // small scale/fade effect when swapping images
    stageImg.style.opacity = '0';
    stageImg.style.transform = 'scale(0.98)';
    // allow transition to run then swap
    setTimeout(() => {
      stageImg.src = items[current].src;
      stageImg.alt = items[current].alt || '';
      stageImg.style.opacity = '1';
      stageImg.style.transform = 'scale(1)';
    }, 160);
  }

  function openAt(index) {
    showIndex(index);
    // Use showModal for proper accessibility and backdrop
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // fallback: make visible
      dialog.setAttribute('open', '');
    }
    // move focus to close button
    closeBtn.focus();
  }

  galleryImgs.forEach((imgEl, idx) => {
    imgEl.style.cursor = 'zoom-in';
    imgEl.addEventListener('click', (e) => {
      e.preventDefault();
      openAt(idx);
    });
    imgEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAt(idx);
      }
    });
    // make images keyboard-focusable
    if (!imgEl.hasAttribute('tabindex')) imgEl.setAttribute('tabindex', '0');
  });

  prevBtn.addEventListener('click', () => showIndex(current - 1, -1));
  nextBtn.addEventListener('click', () => showIndex(current + 1, 1));
  closeBtn.addEventListener('click', () => dialog.close());

  // Close when clicking on backdrop
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Allow keyboard navigation while open
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showIndex(current - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      showIndex(current + 1);
    }
    // Escape will close automatically on native dialog; keep for non-native
    else if (e.key === 'Escape') {
      dialog.close();
    }
  });

  // Clear image on close to release memory and restore scale for next open
  dialog.addEventListener('close', () => {
    stageImg.style.opacity = '0';
    stageImg.style.transform = 'scale(0.98)';
    // small timeout before clearing src
    setTimeout(() => {
      stageImg.src = '';
      stageImg.alt = '';
    }, 200);
  });
})();
