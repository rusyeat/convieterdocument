// Initialize before the stylesheet to avoid a flash of the wrong theme.
(function () {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let saved;
  try { saved = localStorage.getItem("qalam.theme"); } catch (_) {}
  let explicit = saved === "light" || saved === "dark";
  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(theme === "dark")));
  }
  apply(explicit ? saved : media.matches ? "dark" : "light");
  media.addEventListener("change", (e) => { if (!explicit) apply(e.matches ? "dark" : "light"); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    explicit = true;
    apply(theme);
    try { localStorage.setItem("qalam.theme", theme); } catch (_) {}
  });
})();
