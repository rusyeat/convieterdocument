// PDF editor: add text, images, signatures, highlights and white-out boxes,
// rotate/delete pages, then write everything into the PDF with pdf-lib.
// Element coordinates are stored in PDF points of the page *as displayed*
// (top-left origin) and mapped to PDF space with pdf.js convertToPdfPoint.
(function () {
  const { t, svg, esc, base, need } = UI;
  const FONTS = {
    noto: { label: "Noto Sans", css: "'Noto Sans', sans-serif" },
    notob: { label: "Noto Sans Bold", css: "'Noto Sans', sans-serif", weight: 700 },
    helv: { label: "Helvetica", css: "Helvetica, Arial, sans-serif", std: "Helvetica" },
    times: { label: "Times", css: "'Times New Roman', Times, serif", std: "TimesRoman" },
    courier: { label: "Courier", css: "'Courier New', Courier, monospace", std: "Courier" },
  };
  const COLORS = ["#1a1a1a", "#5236ec", "#2b6cf0", "#18a058", "#f0a020", "#e5484d", "#888888"];
  const LH = 1.25; // line height used both on screen and in the PDF

  function render(root, file, mode) {
    const S = { bytes: null, name: "", pdf: null, pages: [], els: [], sel: null, tool: mode === "sign" ? "sign" : mode === "text" ? "text" : null,
      scale: 1, hist: [], fut: [], sig: null, sigTab: "draw", textDefaults: { font: "noto", size: 16, color: "#1a1a1a", align: "left" }, current: 0 };
    let uid = 1;

    root.innerHTML = `<div class="ed">
      <div class="ed-top"><a class="logo" href="#/">${UI.logo}<span>Qalam PDF</span></a><span class="fname" id="fn"></span><span class="sp"></span>
        ${UI.themeButton()}
        <button class="icon-btn" id="undo" title="Undo">${svg("undo")}</button><button class="icon-btn" id="redo" title="Redo">${svg("redo")}</button>
        <button class="btn btn-outline btn-sm" id="openBtn">${t("ed_open")}</button>
        <button class="btn btn-primary btn-sm" id="save" disabled>${svg("download", 'width="18"')} ${t("download")}</button></div>
      <div class="ed-tools" id="tools">
        ${[["text", "text", t("ed_text")], ["image", "image", t("ed_image")], ["sign", "sign", t("ed_sign")], ["highlight", "highlight", t("ed_highlight")], ["whiteout", "eraser", t("ed_whiteout")], ["pages", "layers", t("ed_pages")]]
          .map(([k, i, l]) => `<button data-tool="${k}">${svg(i)}<span>${l}</span></button>`).join("")}
      </div>
      <div class="ed-main"><aside class="ed-pages" id="thumbs"></aside><div class="ed-canvas" id="area"></div><aside class="ed-props" id="props"></aside></div>
      <input type="file" id="pdfIn" accept=".pdf" hidden><input type="file" id="imgIn" accept="image/png,image/jpeg" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const area = $("#area"), thumbs = $("#thumbs"), props = $("#props");

    // ---------- loading ----------
    async function load(bytes, keepEls) {
      await need("pdfjs", "pdflib");
      S.bytes = bytes;
      S.pdf = await pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
      S.pages = [];
      for (let i = 1; i <= S.pdf.numPages; i++) {
        const p = await S.pdf.getPage(i);
        S.pages.push({ page: p, vp: p.getViewport({ scale: 1 }) });
      }
      if (!keepEls) S.els = [];
      $("#save").disabled = false;
      $("#fn").textContent = S.name;
      await drawPages();
      drawThumbs();
      drawProps();
    }
    async function openFile(f) {
      if (!f) return;
      S.name = f.name; S.hist = []; S.fut = [];
      try { await load(new Uint8Array(await f.arrayBuffer())); }
      catch (e) { console.error(e); UI.toast(t("err_open")); }
    }

    function emptyState() {
      area.innerHTML = `<div class="ed-empty"><div class="drop" id="edz" style="max-width:520px"><div class="drop-in">${UI.art}<div class="drop-cta"><button class="btn btn-primary" id="pick">${svg("upload", 'width="18"')} ${t("ed_open")}</button><p class="muted small">${t("ed_open_hint")}</p></div></div></div></div>`;
      Tools.bindDrop($("#edz"), (fl) => openFile(fl[0]), () => $("#pdfIn").click());
      thumbs.innerHTML = `<h4>${t("ed_pages_n", { n: 0 })}</h4>`;
      drawProps();
    }

    // ---------- drawing ----------
    async function drawPages() {
      const avail = Math.max(280, area.clientWidth - 48);
      const maxW = Math.max(...S.pages.map((p) => p.vp.width));
      S.scale = Math.min(1.5, avail / maxW);
      area.innerHTML = "";
      for (let i = 0; i < S.pages.length; i++) {
        const { page } = S.pages[i];
        const vp = page.getViewport({ scale: S.scale * (window.devicePixelRatio || 1) });
        const wrap = document.createElement("div");
        wrap.className = "ed-page"; wrap.dataset.p = i;
        wrap.style.width = S.pages[i].vp.width * S.scale + "px"; wrap.style.height = S.pages[i].vp.height * S.scale + "px";
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height; c.style.width = "100%"; c.style.height = "100%";
        wrap.appendChild(c);
        const layer = document.createElement("div");
        layer.className = "ed-layer"; layer.dataset.p = i;
        wrap.appendChild(layer);
        area.appendChild(wrap);
        page.render({ canvasContext: c.getContext("2d"), viewport: vp });
        // preventDefault keeps focus on a freshly placed text box (the browser would blur it)
        layer.onmousedown = (e) => { if (e.target === layer) { if (S.tool && S.tool !== "pages") e.preventDefault(); onLayerDown(e, i, layer); } };
        layer.ontouchstart = (e) => { if (e.target === layer && S.tool) { e.preventDefault(); onLayerDown(e.touches[0], i, layer); } };
      }
      drawEls();
    }

    async function drawThumbs() {
      thumbs.innerHTML = `<h4>${t("ed_pages_n", { n: S.pages.length })}</h4>`;
      for (let i = 0; i < S.pages.length; i++) {
        const { page } = S.pages[i];
        const vp = page.getViewport({ scale: 0.22 });
        const d = document.createElement("div");
        d.className = "ed-thumb" + (i === S.current ? " on" : "");
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        d.appendChild(c);
        d.insertAdjacentHTML("beforeend", `<div class="row"><button class="icon-btn" data-rot="${i}" title="${t("ed_rotate")}">${svg("rotate")}</button><span style="align-self:center">${i + 1}</span><button class="icon-btn" data-del="${i}" title="${t("ed_delete")}">${svg("trash")}</button></div>`);
        c.onclick = () => { S.current = i; area.querySelector(`.ed-page[data-p="${i}"]`).scrollIntoView({ behavior: "smooth", block: "start" }); thumbs.querySelectorAll(".ed-thumb").forEach((x, k) => x.classList.toggle("on", k === i)); };
        thumbs.appendChild(d);
        page.render({ canvasContext: c.getContext("2d"), viewport: vp });
      }
      thumbs.querySelectorAll("[data-rot]").forEach((b) => (b.onclick = () => pageOp("rot", +b.dataset.rot)));
      thumbs.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => pageOp("del", +b.dataset.del)));
    }

    function elStyle(el) {
      const s = S.scale;
      return `left:${el.x * s}px;top:${el.y * s}px;` + (el.type === "text" ? "" : `width:${el.w * s}px;height:${el.h * s}px;`);
    }
    function drawEls() {
      area.querySelectorAll(".el").forEach((n) => n.remove());
      for (const el of S.els) {
        const layer = area.querySelector(`.ed-layer[data-p="${el.page}"]`);
        if (!layer) continue;
        const n = document.createElement("div");
        n.className = "el" + (S.sel === el.id ? " sel" : "");
        n.dataset.id = el.id;
        n.style.cssText = elStyle(el);
        if (el.type === "text") {
          const f = FONTS[el.font];
          n.innerHTML = `<div class="el-text" style="font-family:${f.css};font-weight:${f.weight || 400};font-size:${el.size * S.scale}px;color:${el.color};text-align:${el.align}">${esc(el.text)}</div>`;
          const tx = n.firstChild;
          tx.ondblclick = () => startEdit(el, tx);
        } else if (el.type === "image" || el.type === "sign") {
          n.innerHTML = `<img src="${el.src}" alt=""><span class="h"></span>`;
        } else {
          n.classList.add(el.type === "highlight" ? "el-hl" : "el-wo");
          if (el.type === "highlight") n.style.background = hexA(el.color, 0.4);
          n.innerHTML = `<span class="h"></span>`;
        }
        n.onmousedown = (e) => startDrag(e, el, n);
        n.ontouchstart = (e) => { e.preventDefault(); startDrag(e.touches[0], el, n, true); };
        layer.appendChild(n);
      }
    }
    const hexA = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; };

    // ---------- history ----------
    function snap() { S.hist.push({ els: JSON.stringify(S.els), bytes: S.bytes }); if (S.hist.length > 60) S.hist.shift(); S.fut = []; }
    async function restore(st) {
      const pagesChanged = st.bytes !== S.bytes;
      S.els = JSON.parse(st.els); S.sel = null;
      if (pagesChanged) await load(st.bytes, true); else { drawEls(); drawProps(); }
    }
    $("#undo").onclick = async () => { if (!S.hist.length) return; S.fut.push({ els: JSON.stringify(S.els), bytes: S.bytes }); await restore(S.hist.pop()); };
    $("#redo").onclick = async () => { if (!S.fut.length) return; S.hist.push({ els: JSON.stringify(S.els), bytes: S.bytes }); await restore(S.fut.pop()); };

    // ---------- placing ----------
    function onLayerDown(e, pageIdx, layer) {
      const r = layer.getBoundingClientRect();
      const x = (e.clientX - r.left) / S.scale, y = (e.clientY - r.top) / S.scale;
      S.current = pageIdx;
      if (!S.tool || S.tool === "pages") { select(null); return; }
      if (S.tool === "image") { S.pendingPos = { page: pageIdx, x, y }; $("#imgIn").click(); return; }
      if (S.tool === "sign") {
        if (!S.sig) { UI.toast(t("ed_sign_title") + ": " + t("ed_apply")); return; }
        snap();
        const w = 160, h = 160 * S.sig.h / S.sig.w;
        add({ type: "sign", page: pageIdx, x: x - w / 2, y: y - h / 2, w, h, src: S.sig.src });
        return;
      }
      snap();
      if (S.tool === "text") {
        const d = S.textDefaults;
        const el = add({ type: "text", page: pageIdx, x, y: y - d.size * 0.6, text: t("ed_new_text"), font: d.font, size: d.size, color: d.color, align: d.align });
        const node = area.querySelector(`.el[data-id="${el.id}"] .el-text`);
        if (node) startEdit(el, node, true);
      } else if (S.tool === "highlight") add({ type: "highlight", page: pageIdx, x: x - 60, y: y - 9, w: 120, h: 18, color: "#ffe600" });
      else if (S.tool === "whiteout") add({ type: "whiteout", page: pageIdx, x: x - 60, y: y - 12, w: 120, h: 24 });
    }
    function add(el) { el.id = uid++; S.els.push(el); S.sel = el.id; drawEls(); drawProps(); return el; }
    function select(id) { S.sel = id; area.querySelectorAll(".el").forEach((n) => n.classList.toggle("sel", +n.dataset.id === id)); drawProps(); }

    function startEdit(el, node, selectAll) {
      node.contentEditable = "true"; node.focus();
      if (selectAll) document.execCommand("selectAll", false, null);
      node.onblur = () => {
        node.contentEditable = "false";
        const v = node.innerText.replace(/\n$/, "");
        if (!v.trim()) S.els = S.els.filter((x) => x.id !== el.id);
        else if (v !== el.text) { if (!S.hist.length || S.hist[S.hist.length - 1].els !== JSON.stringify(S.els)) snap(); el.text = v; }
        drawEls();
      };
      node.onkeydown = (e) => { if (e.key === "Escape") node.blur(); e.stopPropagation(); };
    }

    function startDrag(e, el, node, touch) {
      if (node.querySelector("[contenteditable=true]")) return;
      const resizing = e.target.classList && e.target.classList.contains("h");
      select(el.id);
      const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y, ow = el.w, oh = el.h;
      let moved = false;
      const mv = (ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        const dx = (p.clientX - sx) / S.scale, dy = (p.clientY - sy) / S.scale;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 1) { moved = true; snap(); }
        if (!moved) return;
        if (resizing) {
          el.w = Math.max(10, ow + dx);
          el.h = el.type === "image" || el.type === "sign" ? el.w * oh / ow : Math.max(6, oh + dy);
        } else { el.x = ox + dx; el.y = oy + dy; }
        node.style.cssText = elStyle(el) + (el.type === "highlight" ? `background:${hexA(el.color, 0.4)}` : "");
      };
      const up = () => { document.removeEventListener(touch ? "touchmove" : "mousemove", mv); document.removeEventListener(touch ? "touchend" : "mouseup", up); };
      document.addEventListener(touch ? "touchmove" : "mousemove", mv, { passive: false });
      document.addEventListener(touch ? "touchend" : "mouseup", up);
    }

    document.onkeydown = (e) => {
      if (!root.isConnected) { document.onkeydown = null; return; }
      if ((e.key === "Delete" || e.key === "Backspace") && S.sel && !document.activeElement.isContentEditable && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        snap(); S.els = S.els.filter((x) => x.id !== S.sel); S.sel = null; drawEls(); drawProps();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? $("#redo") : $("#undo")).click(); }
    };

    $("#imgIn").onchange = async () => {
      const f = $("#imgIn").files[0]; $("#imgIn").value = "";
      if (!f || !S.pendingPos) return;
      const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const w = Math.min(200, img.width), h = w * img.height / img.width;
      snap();
      add({ type: "image", page: S.pendingPos.page, x: S.pendingPos.x - w / 2, y: S.pendingPos.y - h / 2, w, h, src });
    };

    // ---------- page operations ----------
    async function pageOp(op, i) {
      snap();
      const doc = await PDFLib.PDFDocument.load(S.bytes, { ignoreEncryption: true });
      if (op === "del") {
        if (doc.getPageCount() <= 1) { S.hist.pop(); UI.toast(t("err_all")); return; }
        doc.removePage(i);
        S.els = S.els.filter((e) => e.page !== i).map((e) => (e.page > i ? Object.assign(e, { page: e.page - 1 }) : e));
      } else {
        const p = doc.getPage(i);
        p.setRotation(PDFLib.degrees((p.getRotation().angle + 90) % 360));
        S.els = S.els.filter((e) => e.page !== i); // positions no longer match the rotated page
      }
      await load(await doc.save(), true);
    }

    // ---------- properties panel ----------
    function drawProps() {
      const el = S.els.find((e) => e.id === S.sel);
      let h = "";
      if (S.tool === "sign" && (!el || el.type !== "sign")) {
        h = `<h4>${t("ed_sign_title")}</h4><div class="seg" style="margin-bottom:12px"><button data-st="draw" class="${S.sigTab === "draw" ? "on" : ""}">${t("ed_draw")}</button><button data-st="type" class="${S.sigTab === "type" ? "on" : ""}">${t("ed_type")}</button></div>` +
          (S.sigTab === "draw" ? `<canvas class="sigpad" id="pad"></canvas>` : `<div class="opt"><input type="text" id="sigName" placeholder="${t("ed_sign_ph")}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:10px"></div><div id="sigPrev" style="font:36px 'Segoe Script','Brush Script MT',cursive;min-height:60px;border:1px dashed var(--line);border-radius:10px;padding:8px;overflow:hidden"></div>`) +
          `<div class="tool-actions" style="margin-top:12px;justify-content:flex-start"><button class="btn btn-outline btn-sm" id="sigClr">${t("ed_clear")}</button><button class="btn btn-primary btn-sm" id="sigOk">${t("ed_apply")}</button></div>` +
          (S.sig ? `<p class="muted small" style="margin-top:12px">${t("ed_hint")}</p><img src="${S.sig.src}" style="max-width:100%;border:1px solid var(--line);border-radius:8px">` : "");
      } else if (el && el.type === "text" || (!el && S.tool === "text")) {
        const v = el || S.textDefaults;
        h = `<h4>${t("ed_text")}</h4>
          <div class="opt"><label>${t("ed_font")}</label><select id="pFont">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${v.font === k ? "selected" : ""}>${f.label}</option>`).join("")}</select></div>
          <div class="opt"><label>${t("ed_size")}</label><select id="pSize">${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((n) => `<option ${+v.size === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <div class="opt"><label>${t("ed_color")}</label><div class="swatches">${COLORS.map((c) => `<button data-c="${c}" class="${v.color === c ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></div>
          <div class="opt"><label>${t("ed_align")}</label><div class="seg">${[["left", "alignL"], ["center", "alignC"], ["right", "alignR"]].map(([a, i]) => `<button data-a="${a}" class="${v.align === a ? "on" : ""}">${svg(i, 'width="18"')}</button>`).join("")}</div></div>
          ${el ? "" : `<p class="muted small">${t("ed_hint")}</p>`}`;
      } else if (el && el.type === "highlight") {
        h = `<h4>${t("ed_highlight")}</h4><div class="opt"><label>${t("ed_color")}</label><div class="swatches">${["#ffe600", "#7ee787", "#79c0ff", "#ff9bce", "#ffa657"].map((c) => `<button data-hc="${c}" class="${el.color === c ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></div>`;
      } else if (S.tool && S.tool !== "pages") {
        h = `<h4>${t("ed_props")}</h4><p class="muted small">${S.bytes ? t("ed_hint") : t("ed_open_hint")}</p>`;
      } else {
        h = `<h4>${t("ed_props")}</h4><p class="muted small">${S.tool === "pages" ? t("ed_pages_n", { n: S.pages.length }) + " — " + t("ed_rotate") + " / " + t("ed_delete") : t("ed_select")}</p>`;
      }
      if (el) h += `<div style="margin-top:18px"><button class="btn btn-outline btn-sm" id="pDel">${svg("trash", 'width="16"')} ${t("ed_remove")}</button></div>`;
      props.innerHTML = h;

      const upd = (k, val) => {
        if (el) { snap(); el[k] = val; drawEls(); } else S.textDefaults[k] = val;
        drawProps();
      };
      const q = (s) => props.querySelector(s);
      if (q("#pFont")) q("#pFont").onchange = (e) => upd("font", e.target.value);
      if (q("#pSize")) q("#pSize").onchange = (e) => upd("size", +e.target.value);
      props.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => upd("color", b.dataset.c)));
      props.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => upd("align", b.dataset.a)));
      props.querySelectorAll("[data-hc]").forEach((b) => (b.onclick = () => { snap(); el.color = b.dataset.hc; drawEls(); drawProps(); }));
      if (q("#pDel")) q("#pDel").onclick = () => { snap(); S.els = S.els.filter((x) => x.id !== el.id); S.sel = null; drawEls(); drawProps(); };
      props.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { S.sigTab = b.dataset.st; drawProps(); }));
      if (q("#pad")) setupPad(q("#pad"));
      if (q("#sigName")) q("#sigName").oninput = (e) => (q("#sigPrev").textContent = e.target.value);
      if (q("#sigClr")) q("#sigClr").onclick = () => { S.sig = null; drawProps(); };
      if (q("#sigOk")) q("#sigOk").onclick = () => {
        let c;
        if (S.sigTab === "draw") c = trimCanvas(q("#pad"));
        else {
          const name = q("#sigName").value.trim();
          if (!name) return;
          c = document.createElement("canvas");
          const ctx = c.getContext("2d");
          ctx.font = "72px 'Segoe Script','Brush Script MT',cursive";
          c.width = Math.ceil(ctx.measureText(name).width) + 20; c.height = 110;
          ctx.font = "72px 'Segoe Script','Brush Script MT',cursive"; ctx.fillStyle = "#1a2a8a"; ctx.textBaseline = "middle";
          ctx.fillText(name, 10, 55);
          c = trimCanvas(c);
        }
        if (!c) return;
        S.sig = { src: c.toDataURL("image/png"), w: c.width, h: c.height };
        S.sel = null; drawProps();
      };
    }

    function setupPad(c) {
      const r = c.getBoundingClientRect();
      c.width = r.width * 2; c.height = r.height * 2;
      const ctx = c.getContext("2d");
      ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a2a8a";
      let drawing = false;
      const pos = (e) => { const b = c.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [(p.clientX - b.left) * 2, (p.clientY - b.top) * 2]; };
      const down = (e) => { e.preventDefault(); drawing = true; ctx.beginPath(); ctx.moveTo(...pos(e)); };
      const move = (e) => { if (!drawing) return; e.preventDefault(); ctx.lineTo(...pos(e)); ctx.stroke(); };
      const up = () => (drawing = false);
      c.onmousedown = down; c.onmousemove = move; c.onmouseup = up; c.onmouseleave = up;
      c.ontouchstart = down; c.ontouchmove = move; c.ontouchend = up;
    }
    function trimCanvas(c) {
      const ctx = c.getContext("2d");
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      const o = document.createElement("canvas");
      o.width = x1 - x0 + 9; o.height = y1 - y0 + 9;
      o.getContext("2d").drawImage(c, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height);
      return o;
    }

    // ---------- toolbar ----------
    root.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.tool;
      S.tool = S.tool === k ? null : k;
      S.sel = null;
      root.querySelectorAll("[data-tool]").forEach((x) => x.classList.toggle("on", x.dataset.tool === S.tool));
      area.querySelectorAll(".ed-layer").forEach((l) => l.classList.toggle("placing", !!S.tool && S.tool !== "pages"));
      props.classList.toggle("show", !!S.tool && S.tool !== "pages");
      drawEls(); drawProps();
    }));
    function syncToolbar() {
      root.querySelectorAll("[data-tool]").forEach((x) => x.classList.toggle("on", x.dataset.tool === S.tool));
      props.classList.toggle("show", !!S.tool && S.tool !== "pages");
    }

    // ---------- export ----------
    async function exportPdf() {
      await need("pdflib", "fontkit");
      const doc = await PDFLib.PDFDocument.load(S.bytes, { ignoreEncryption: true });
      doc.registerFontkit(fontkit);
      const cache = {};
      const getFont = async (key, text) => {
        // standard fonts only cover Latin-1; fall back to Noto Sans for anything else
        if (FONTS[key].std && !/^[\x00-\xff]*$/.test(text)) key = "noto";
        if (!cache[key]) {
          if (FONTS[key].std) cache[key] = await doc.embedFont(PDFLib.StandardFonts[FONTS[key].std]);
          else {
            const file = key === "notob" ? "assets/fonts/NotoSans-Bold.ttf" : "assets/fonts/NotoSans-Regular.ttf";
            cache[key] = await doc.embedFont(await (await fetch(file)).arrayBuffer(), { subset: true });
          }
        }
        return cache[key];
      };
      const pages = doc.getPages();
      for (const el of S.els) {
        const page = pages[el.page], vp = S.pages[el.page].vp;
        // map a display point to PDF space; angle keeps content upright on rotated pages
        const pt = (x, y) => vp.convertToPdfPoint(x, y);
        const angleAt = (x, y) => { const a = pt(x, y), b = pt(x + 1, y); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
        const rot = PDFLib.degrees(angleAt(el.x, el.y) * 180 / Math.PI);
        if (el.type === "text") {
          const font = await getFont(el.font, el.text);
          const lines = el.text.split("\n");
          const widths = lines.map((l) => font.widthOfTextAtSize(l, el.size));
          const boxW = Math.max(...widths);
          const color = Core.hexToRgb(el.color);
          lines.forEach((line, i) => {
            const off = el.align === "center" ? (boxW - widths[i]) / 2 : el.align === "right" ? boxW - widths[i] : 0;
            // baseline: top of the line box + half leading + ascent (~0.95em for Noto/Helvetica)
            const by = el.y + el.size * (LH * i + (LH - 1) / 2 + 0.93);
            const [x, y] = pt(el.x + 2 + off, by);
            page.drawText(line, { x, y, size: el.size, font, color, rotate: rot });
          });
        } else if (el.type === "image" || el.type === "sign") {
          const bytes = await (await fetch(el.src)).arrayBuffer();
          const img = /^data:image\/png/.test(el.src) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const [x, y] = pt(el.x, el.y + el.h);
          page.drawImage(img, { x, y, width: el.w, height: el.h, rotate: rot });
        } else {
          const [x, y] = pt(el.x, el.y + el.h);
          const opts = { x, y, width: el.w, height: el.h, rotate: rot };
          if (el.type === "highlight") page.drawRectangle(Object.assign(opts, { color: Core.hexToRgb(el.color), opacity: 0.4 }));
          else page.drawRectangle(Object.assign(opts, { color: PDFLib.rgb(1, 1, 1) }));
        }
      }
      return doc.save();
    }
    $("#save").onclick = async () => {
      const btn = $("#save");
      btn.disabled = true; const old = btn.innerHTML; btn.textContent = t("ed_saving");
      try {
        const bytes = await exportPdf();
        const blob = new Blob([bytes], { type: "application/pdf" });
        const name = base(S.name || "document") + "-edited.pdf";
        await Store.add(name, blob);
        UI.save(blob, name);
        UI.toast("✓ " + t("saved"));
      } catch (e) { console.error(e); UI.toast(t("err_generic") + e.message); }
      btn.disabled = false; btn.innerHTML = old;
    };
    $("#openBtn").onclick = () => $("#pdfIn").click();
    $("#pdfIn").onchange = () => { openFile($("#pdfIn").files[0]); $("#pdfIn").value = ""; };

    syncToolbar();
    if (file) openFile(file); else emptyState();
  }

  window.Editor = { render, FONTS };
})();
