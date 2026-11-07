// Apply before the stylesheet; animate only deliberate theme changes.
(function () {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let saved, timer;
  try { saved = localStorage.getItem("qalam.theme"); } catch (_) {}
  let explicit = saved === "dark" || saved === "light";
  function apply(theme, animate = false) {
    clearTimeout(timer);
    root.classList.toggle("theme-changing", animate && !reduced.matches);
    root.dataset.theme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "dark"));
    });
    if (animate) timer = setTimeout(() => root.classList.remove("theme-changing"), 500);
  }
  apply(explicit ? saved : media.matches ? "dark" : "light");
  media.addEventListener("change", (e) => { if (!explicit) apply(e.matches ? "dark" : "light", true); });
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest("[data-theme-toggle]")) return;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    explicit = true;
    apply(theme, true);
    try { localStorage.setItem("qalam.theme", theme); } catch (_) {}
  });
})();
