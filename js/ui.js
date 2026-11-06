// Shared UI helpers: translations, lazy library loading, icons, small utilities.
(function () {
  const UI = {};

  // ---------- i18n ----------
  UI.lang = (() => { try { return localStorage.getItem("qalam.lang") || "kk"; } catch (_) { return "kk"; } })();
  if (!I18N[UI.lang]) UI.lang = "kk";
  UI.t = (key, vars) => {
    let s = (I18N[UI.lang] && I18N[UI.lang][key]) ?? I18N.en[key] ?? I18N.kk[key] ?? key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  };
  UI.setLang = (code) => {
    UI.lang = code;
    try { localStorage.setItem("qalam.lang", code); } catch (_) {}
    document.documentElement.lang = code;
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
  };

  // ---------- lazy-loaded libraries (pinned versions) ----------
  const CDN = {
    pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfjsWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    pdflib: "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
    fontkit: "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js",
    jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
    xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    pptx: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  };
  const loaded = {};
  function script(url) {
    if (!loaded[url]) loaded[url] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url; s.onload = res; s.onerror = () => { delete loaded[url]; rej(new Error("Network: " + url)); };
      document.head.appendChild(s);
    });
    return loaded[url];
  }
  UI.need = async (...names) => {
    for (const n of names) {
      await script(CDN[n]);
      if (n === "pdfjs") pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
    }
  };
  let fontCache = null;
  UI.fontBytes = async () => {
    if (!fontCache) fontCache = fetch("assets/fonts/NotoSans-Regular.ttf").then((r) => r.arrayBuffer());
    return fontCache;
  };

  // ---------- utilities ----------
  UI.$ = (sel, el = document) => el.querySelector(sel);
  UI.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  UI.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  UI.size = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
  UI.ext = (name) => (name.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  UI.base = (name) => name.replace(/\.[^.]+$/, "");
  UI.save = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  UI.toast = (msg) => {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
  UI.canvasBlob = (canvas, type = "image/jpeg", q = 0.9) => new Promise((res) => canvas.toBlob(res, type, q));
  UI.MIME = {
    pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg", png: "image/png", zip: "application/zip", txt: "text/plain",
  };

  // ---------- icons ----------
  const P = {
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    sheet: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 12v6M13 12v6M10 15h6"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20 16-5-5-7 8"/>',
    slides: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
    merge: '<rect x="8" y="3" width="11" height="14" rx="1.5"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
    split: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M4 13h16" stroke-dasharray="2 2"/>',
    compress: '<path d="M7 3h7l5 5v13H7z"/><path d="M12 10v7M9 14l3 3 3-3"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    sign: '<path d="M3 17c3-6 5-9 7-9s-1 8 1 8 3-5 5-5 1 4 3 4 2-2 2-2"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    edit: '<path d="M7 3h7l5 5v4"/><path d="M7 3v18h5"/><path d="m14 21 1-3 6-6 2 2-6 6z"/>',
    ocr: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8.5 16 3.5-9 3.5 9M9.8 13h4.4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    pencil: '<path d="m4 20 1-4L16 5l3 3L8 19z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    highlight: '<path d="m9 15 7-7 3 3-7 7H9z"/><path d="M4 21h16"/>',
    eraser: '<path d="m7 21-4-4 10-10 6 6-8 8z"/><path d="M21 21H7"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    device: '<rect x="3" y="4" width="14" height="11" rx="1.5"/><rect x="15" y="9" width="6" height="11" rx="1.5"/><path d="M7 19h6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    ai: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    alignL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alignC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alignR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  };
  UI.svg = (name, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ""}</svg>`;
  const TINT = { blue: ["#2b6cf0", "#e8f0fe"], green: ["#18a058", "#e7f6ee"], orange: ["#f07a2b", "#fdeee4"], purple: ["#5236ec", "#efecfe"], red: ["#e5484d", "#fdecec"], sky: ["#1b9bd8", "#e5f4fb"] };
  UI.ico = (name, tint = "purple") => {
    const [c, bg] = TINT[tint];
    return `<span class="ico" style="background:${bg};color:${c}">${UI.svg(name)}</span>`;
  };
  UI.fileIco = (ext) => {
    const map = { pdf: ["doc", "red"], docx: ["doc", "blue"], doc: ["doc", "blue"], xlsx: ["sheet", "green"], pptx: ["slides", "orange"], jpg: ["image", "orange"], jpeg: ["image", "orange"], png: ["image", "orange"], zip: ["layers", "purple"], txt: ["text", "sky"] };
    const [n, t] = map[ext] || ["doc", "purple"];
    return UI.ico(n, t);
  };
  UI.logo = `<svg viewBox="0 0 32 32"><path d="M6 4h14l6 6v16a2 2 0 0 1-2 2H6z" fill="#5236ec"/><path d="M20 4v6h6z" fill="#a99bff"/><path d="M4 8l12-4v24L4 28z" fill="#7b63ff" opacity=".85"/></svg>`;
  UI.art = `<svg viewBox="0 0 180 130" class="drop-art"><g transform="rotate(-8 55 70)"><rect x="18" y="18" width="74" height="96" rx="8" fill="#d9d2ff"/><rect x="18" y="18" width="74" height="96" rx="8" fill="url(#g1)"/><rect x="30" y="38" width="40" height="5" rx="2.5" fill="#fff" opacity=".7"/><rect x="30" y="50" width="50" height="5" rx="2.5" fill="#fff" opacity=".7"/><rect x="22" y="74" width="46" height="22" rx="5" fill="#e5484d"/><text x="45" y="90" font-size="13" font-weight="800" fill="#fff" text-anchor="middle" font-family="Inter,sans-serif">PDF</text></g><g transform="rotate(6 120 78)"><rect x="86" y="30" width="74" height="96" rx="8" fill="#eef2ff" stroke="#c9d6ff"/><rect x="98" y="50" width="48" height="5" rx="2.5" fill="#b9c9ff"/><rect x="98" y="62" width="40" height="5" rx="2.5" fill="#b9c9ff"/><rect x="92" y="86" width="56" height="22" rx="5" fill="#2b6cf0"/><text x="120" y="102" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="Inter,sans-serif">DOCX</text></g><path d="M140 14l4-9M152 22l8-5M128 10l-1-8" stroke="#5236ec" stroke-width="3" stroke-linecap="round"/><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8a9ff"/><stop offset="1" stop-color="#e6e0ff"/></linearGradient></defs></svg>`;

  window.UI = UI;
})();
