/**
 * Image lightbox built on the native <dialog> element.
 *
 * Any `<button data-lightbox="group">` containing an <img> opens the viewer.
 * Optional `data-full="path"` on the button points to a larger image.
 * Triggers are discovered on click (event delegation), so images rendered
 * later from JSON work automatically.
 *
 * Keyboard: ← → to navigate, Escape to close (native dialog behaviour).
 * Focus is trapped by showModal() and returned to the trigger on close.
 */
export function setupLightbox() {
  const dialog = document.getElementById("lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const img = dialog.querySelector(".lightbox__img");
  const caption = dialog.querySelector(".lightbox__caption");
  const prevBtn = dialog.querySelector(".lightbox__nav--prev");
  const nextBtn = dialog.querySelector(".lightbox__nav--next");
  const closeBtn = dialog.querySelector(".lightbox__close");

  let items = [];
  let current = 0;
  let opener = null;
  let loadToken = 0;

  function collect(group) {
    return Array.from(document.querySelectorAll(`[data-lightbox="${CSS.escape(group)}"]`))
      .map((trigger) => {
        const source = trigger.querySelector("img");
        return {
          trigger,
          src: trigger.dataset.full || source?.currentSrc || source?.src || "",
          alt: source?.alt || "",
        };
      })
      .filter((item) => item.src);
  }

  function show(index) {
    if (!items.length) return;
    current = (index + items.length) % items.length;
    const item = items[current];
    const token = ++loadToken;

    img.classList.add("is-loading");
    const loader = new Image();
    loader.decoding = "async";
    loader.onload = () => {
      if (token !== loadToken) return;
      img.src = item.src;
      img.alt = item.alt;
      img.classList.remove("is-loading");
    };
    loader.onerror = () => {
      if (token !== loadToken) return;
      console.error(`[portfolio] Lightbox image failed to load: ${item.src}`);
      img.removeAttribute("src");
      img.alt = "";
      img.classList.remove("is-loading");
      caption.textContent = "This image could not be loaded.";
    };
    loader.src = item.src;

    const position = items.length > 1 ? ` (${current + 1} of ${items.length})` : "";
    caption.textContent = `${item.alt || "Image"}${position}`;
    prevBtn.hidden = nextBtn.hidden = items.length < 2;
  }

  function open(trigger) {
    opener = trigger;
    items = collect(trigger.dataset.lightbox);
    const start = Math.max(0, items.findIndex((item) => item.trigger === trigger));
    document.body.classList.add("lightbox-open");
    dialog.showModal();
    show(start);
    closeBtn.focus();
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox]");
    if (!trigger || trigger.closest("dialog")) return;
    event.preventDefault();
    open(trigger);
  });

  prevBtn.addEventListener("click", () => show(current - 1));
  nextBtn.addEventListener("click", () => show(current + 1));
  closeBtn.addEventListener("click", () => dialog.close());

  // Click on the backdrop (the dialog element itself, outside the inner panel) closes.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(current + 1);
    }
  });

  dialog.addEventListener("close", () => {
    loadToken++;
    document.body.classList.remove("lightbox-open");
    img.removeAttribute("src");
    img.alt = "";
    caption.textContent = "";
    if (opener?.isConnected) opener.focus();
    opener = null;
  });
}
