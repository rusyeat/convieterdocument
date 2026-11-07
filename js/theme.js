// Initialize before the stylesheet to avoid a flash of the wrong theme.
(function () {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let saved;
  let busy = false;
  try { saved = localStorage.getItem("qalam.theme"); } catch (_) {}
  let explicit = saved === "light" || saved === "dark";
  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(theme === "dark")));
  }
  apply(explicit ? saved : media.matches ? "dark" : "light");
  media.addEventListener("change", (e) => { if (!explicit) apply(e.matches ? "dark" : "light"); });

  async function changeTheme(theme) {
    if (reducedMotion.matches || !document.body || !Element.prototype.animate) {
      apply(theme);
      return;
    }
    busy = true;
    const wave = document.createElement("div");
    wave.className = "theme-wave" + (theme === "light" ? " theme-wave-up" : "");
    wave.setAttribute("aria-hidden", "true");
    // The opaque curtain hides the palette change; no document clones or canvas snapshots.
    const direction = theme === "dark" ? 1 : -1;
    const start = "translate3d(0," + (-direction * 110) + "%,0)";
    const end = "translate3d(0," + (direction * 110) + "%,0)";
    wave.style.transform = start;
    document.body.appendChild(wave);
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-busy", "true"));
    try {
      await wave.animate([{ transform: start }, { transform: "translate3d(0,0,0)" }],
        { duration: 460, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" }).finished;
      apply(theme);
      await wave.animate([{ transform: "translate3d(0,0,0)" }, { transform: end }],
        { duration: 540, easing: "cubic-bezier(.4,0,.15,1)", fill: "forwards" }).finished;
    } catch (_) {
      // Cancellation must never leave a curtain or an unsaved visual state behind.
      apply(theme);
    } finally {
      wave.remove();
      document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.removeAttribute("aria-busy"));
      busy = false;
    }
  }
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element) || !e.target.closest("[data-theme-toggle]") || busy) return;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    explicit = true;
    try { localStorage.setItem("qalam.theme", theme); } catch (_) {}
    changeTheme(theme);
  });
})();

