/**
 * Scrollspy for the header nav: marks the link of the section currently in
 * view with aria-current="location" (styled with a background and underline,
 * not colour alone).
 */
export function setupScrollspy() {
  const links = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
  const sections = links
    .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!sections.length) return;

  let frame = 0;
  function update() {
    frame = 0;
    const line = window.innerHeight * 0.35;
    let current = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section;
    }
    // At the very bottom, the last section is current even if it's short.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections[sections.length - 1];
    }
    links.forEach((link) => {
      if (current && link.getAttribute("href") === `#${current.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}
