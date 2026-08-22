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
