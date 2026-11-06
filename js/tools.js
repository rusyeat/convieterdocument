// Tool catalogue + the page that runs a single tool.
(function () {
  const { t, svg, ico, esc, size, ext, base, need } = UI;

  const TOOLS = [
    { id: "pdf_word", icon: "doc", tint: "blue", cats: ["from"], accept: ["pdf"], out: "docx" },
    { id: "pdf_excel", icon: "sheet", tint: "green", cats: ["from"], accept: ["pdf"], out: "xlsx", beta: true },
    { id: "pdf_jpg", icon: "image", tint: "orange", cats: ["from", "images"], accept: ["pdf"], out: "jpg" },
    { id: "pdf_ppt", icon: "slides", tint: "orange", cats: ["from"], accept: ["pdf"], out: "pptx" },
    { id: "word_pdf", icon: "doc", tint: "purple", cats: ["to"], accept: ["docx"], out: "pdf" },
    { id: "excel_pdf", icon: "sheet", tint: "green", cats: ["to"], accept: ["xlsx", "xls", "csv", "ods"], out: "pdf" },
    { id: "jpg_pdf", icon: "image", tint: "red", cats: ["to", "images"], accept: ["jpg", "jpeg", "png", "webp", "gif", "bmp"], multi: true, out: "pdf" },
    { id: "merge", icon: "merge", tint: "purple", cats: ["pages"], accept: ["pdf"], multi: true, min: 2, out: "pdf" },
    { id: "split", icon: "split", tint: "red", cats: ["pages"], accept: ["pdf"], out: "pdf" },
    { id: "compress", icon: "compress", tint: "green", cats: ["pages"], accept: ["pdf"], out: "pdf" },
    { id: "edit", icon: "edit", tint: "purple", cats: ["edit"], accept: ["pdf"], editor: "text" },
    { id: "sign", icon: "sign", tint: "purple", cats: ["edit"], accept: ["pdf"], editor: "sign" },
    { id: "watermark", icon: "drop", tint: "sky", cats: ["edit"], accept: ["pdf"], out: "pdf" },
    { id: "rotate", icon: "rotate", tint: "purple", cats: ["pages"], accept: ["pdf"], out: "pdf" },
    { id: "ocr", icon: "ocr", tint: "purple", cats: ["other"], accept: ["pdf", "jpg", "jpeg", "png"], beta: true, out: "docx" },
    { id: "delete", icon: "trash", tint: "red", cats: ["pages"], accept: ["pdf"], out: "pdf" },
    { id: "add_text", icon: "text", tint: "sky", cats: ["edit"], accept: ["pdf"], editor: "text" },
    // AI tool: machine-learning model (js/classifier.js, trained in ml/train.py)
    { id: "ai_classify", icon: "ai", tint: "purple", cats: ["other"], accept: ["pdf", "txt"], ai: true },
  ];
  // what to do next with each document type the model can detect
  const AI_SUGGEST = {
    contract: ["sign", "edit", "pdf_word", "watermark"], application: ["sign", "add_text", "pdf_word"],
    invoice: ["pdf_excel", "compress", "merge"], resume: ["pdf_word", "compress", "pdf_jpg"],
    academic: ["pdf_word", "merge", "split", "compress"], letter: ["sign", "watermark", "pdf_word"],
  };
  const POPULAR = ["pdf_word", "word_pdf", "pdf_excel", "pdf_jpg", "merge", "split", "compress", "edit"];
  const byId = Object.fromEntries(TOOLS.map((x) => [x.id, x]));
  const MAX = 100 * 1024 * 1024;

  function card(tool, compact) {
    return `<a class="tcard" href="#/tool/${tool.id}">${ico(tool.icon, tool.tint)}<div><b>${t("t_" + tool.id)}</b>${compact ? "" : `<span>${t("d_" + tool.id)}</span>`}</div>${compact ? "" : `<span class="go">${svg("arrow", 'width="18" class="flip"')}</span>`}${tool.beta ? `<i class="badge">${t("beta")}</i>` : ""}${tool.ai ? `<i class="badge badge-ai">AI</i>` : ""}</a>`;
  }

  // ---------- page rendering helpers ----------
  async function openPdfJs(bytes) {
    await need("pdfjs");
    return pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  }
  async function renderPage(pdf, n, scale) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas: c, w: page.getViewport({ scale: 1 }).width, h: page.getViewport({ scale: 1 }).height };
  }
  async function zipFiles(files) {
    await need("jszip");
    const z = new JSZip();
    files.forEach((f) => z.file(f.name, f.data));
    return z.generateAsync({ type: "blob" });
  }
  const pdfBlob = (bytes) => new Blob([bytes], { type: "application/pdf" });

  // Renders HTML (from Word/Excel) onto A4 pages. Page cuts are moved up to
  // the nearest blank pixel row so lines of text are not sliced in half.
  async function htmlToPdf(html, prog) {
    await need("html2canvas", "pdflib");
    const box = document.createElement("div");
    box.className = "render-box";
    box.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;padding:56px 60px;background:#fff;color:#000;font:14px/1.5 Calibri,'Noto Sans',Arial,sans-serif";
    box.innerHTML = `<style>.render-box table{border-collapse:collapse;margin:0 0 16px;font-size:12px}.render-box td,.render-box th{border:1px solid #bbb;padding:3px 6px;vertical-align:top}.render-box img{max-width:100%}.render-box h3{margin:0 0 8px}</style>` + html;
    document.body.appendChild(box);
    prog(0.4);
    const scale = 2;
    let canvas;
    try { canvas = await html2canvas(box, { scale, backgroundColor: "#fff", windowWidth: 794 }); }
    finally { box.remove(); }
    prog(0.7);
    const pageH = Math.round(794 * (297 / 210) * scale);
    const ctx = canvas.getContext("2d");
    const doc = await PDFLib.PDFDocument.create();
    let y = 0;
    while (y < canvas.height - 2) {
      let cut = Math.min(y + pageH, canvas.height);
      if (cut < canvas.height) {
        for (let yy = cut; yy > cut - 160 * scale; yy--) {
          const row = ctx.getImageData(0, yy, canvas.width, 1).data;
          let blank = true;
          for (let i = 0; i < row.length; i += 16) if (row[i] < 245 || row[i + 1] < 245 || row[i + 2] < 245) { blank = false; break; }
          if (blank) { cut = yy; break; }
        }
      }
      const slice = document.createElement("canvas");
      slice.width = canvas.width; slice.height = pageH;
      const sctx = slice.getContext("2d");
      sctx.fillStyle = "#fff"; sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, y, canvas.width, cut - y, 0, 0, canvas.width, cut - y);
      const jpg = await (await UI.canvasBlob(slice, "image/jpeg", 0.9)).arrayBuffer();
      const img = await doc.embedJpg(jpg);
      doc.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
      y = cut;
    }
    return doc.save();
  }

  async function imageInfo(file) {
    const bmp = await createImageBitmap(file);
    const e = ext(file.name);
    if (e === "jpg" || e === "jpeg" || e === "png") {
      const info = { bytes: await file.arrayBuffer(), type: e === "png" ? "png" : "jpg", width: bmp.width, height: bmp.height };
      bmp.close && bmp.close();
      return info;
    }
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    return { bytes: await (await UI.canvasBlob(c, "image/png")).arrayBuffer(), type: "png", width: c.width, height: c.height };
  }

  // ---------- runners: (files, opts, prog) -> { blob, name, note? } ----------
  const RUN = {
    // AI: extract the text, run the in-browser classifier, show type + confidence
    async ai_classify([f], o, prog) {
      let text;
      if (ext(f.name) === "txt") text = await f.text();
      else {
        await need("pdfjs");
        const pages = await Core.readTextPages(await f.arrayBuffer(), (i, n) => prog(0.1 + 0.6 * i / n, t("page_of", { a: i, b: n })));
        text = pages.map((p) => p.items.map((it) => it.str).join(" ")).join("\n");
      }
      if (text.replace(/\s/g, "").length < 20) throw new Error("short");
      prog(0.85);
      const model = await Classifier.load();
      return { ai: model.predict(text.slice(0, 20000)), name: f.name };
    },
    async pdf_word([f], o, prog) {
      await need("pdfjs", "jszip");
      const r = await Core.pdfToDocx(await f.arrayBuffer(), (i, n) => prog(0.1 + 0.8 * i / n, t("page_of", { a: i, b: n })));
      return { blob: r.blob, name: base(f.name) + ".docx", note: t("note_images") };
    },
    async pdf_excel([f], o, prog) {
      await need("pdfjs", "xlsx");
      const r = await Core.pdfToXlsx(await f.arrayBuffer(), (i, n) => prog(0.1 + 0.8 * i / n, t("page_of", { a: i, b: n })));
      return { blob: new Blob([r.bytes], { type: UI.MIME.xlsx }), name: base(f.name) + ".xlsx" };
    },
    async pdf_jpg([f], o, prog) {
      const pdf = await openPdfJs(await f.arrayBuffer());
      const out = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const { canvas } = await renderPage(pdf, i, 2);
        out.push({ name: `${base(f.name)}-${i}.jpg`, data: await UI.canvasBlob(canvas, "image/jpeg", 0.92) });
        prog(0.1 + 0.8 * i / pdf.numPages, t("page_of", { a: i, b: pdf.numPages }));
      }
      if (out.length === 1) return { blob: out[0].data, name: out[0].name };
      return { blob: await zipFiles(out), name: base(f.name) + "-jpg.zip" };
    },
    async pdf_ppt([f], o, prog) {
      await need("pptx");
      const pdf = await openPdfJs(await f.arrayBuffer());
      const pptx = new PptxGenJS();
      let layoutSet = false;
      for (let i = 1; i <= pdf.numPages; i++) {
        const { canvas, w, h } = await renderPage(pdf, i, 2);
        if (!layoutSet) { pptx.defineLayout({ name: "PDF", width: w / 72, height: h / 72 }); pptx.layout = "PDF"; layoutSet = true; }
        pptx.addSlide().addImage({ data: canvas.toDataURL("image/jpeg", 0.9), x: 0, y: 0, w: w / 72, h: h / 72 });
        prog(0.1 + 0.8 * i / pdf.numPages, t("page_of", { a: i, b: pdf.numPages }));
      }
      return { blob: await pptx.write({ outputType: "blob" }), name: base(f.name) + ".pptx" };
    },
    async word_pdf([f], o, prog) {
      await need("mammoth");
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
      prog(0.3);
      return { blob: pdfBlob(await htmlToPdf(value, prog)), name: base(f.name) + ".pdf" };
    },
    async excel_pdf([f], o, prog) {
      await need("xlsx");
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
      const html = wb.SheetNames.map((n) => `<h3>${esc(n)}</h3>` + XLSX.utils.sheet_to_html(wb.Sheets[n], { header: "", footer: "" })).join("");
      prog(0.3);
      return { blob: pdfBlob(await htmlToPdf(html, prog)), name: base(f.name) + ".pdf" };
    },
    async jpg_pdf(files, o, prog) {
      await need("pdflib");
      const imgs = [];
      for (let i = 0; i < files.length; i++) { imgs.push(await imageInfo(files[i])); prog(0.1 + 0.7 * (i + 1) / files.length); }
      return { blob: pdfBlob(await Core.imagesToPdf(imgs, o.pageSize)), name: base(files[0].name) + ".pdf" };
    },
    async merge(files, o, prog) {
      await need("pdflib");
      const list = [];
      for (const f of files) list.push(await f.arrayBuffer());
      prog(0.5);
      return { blob: pdfBlob(await Core.merge(list)), name: "merged.pdf" };
    },
    async split([f], o, prog) {
      await need("pdflib");
      const parts = await Core.split(await f.arrayBuffer(), o.mode, o.ranges);
      prog(0.8);
      if (parts.length === 1) return { blob: pdfBlob(parts[0].bytes), name: `${base(f.name)}-${parts[0].label}.pdf` };
      return { blob: await zipFiles(parts.map((p) => ({ name: `${base(f.name)}-${p.label}.pdf`, data: p.bytes }))), name: base(f.name) + "-split.zip" };
    },
    async compress([f], o, prog) {
      await need("pdflib");
      const orig = await f.arrayBuffer();
      const q = { low: [1.0, 0.5], med: [1.4, 0.65], high: [2.0, 0.8] }[o.quality];
      const pdf = await openPdfJs(orig.slice(0));
      const doc = await PDFLib.PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        const { canvas, w, h } = await renderPage(pdf, i, q[0]);
        const img = await doc.embedJpg(await (await UI.canvasBlob(canvas, "image/jpeg", q[1])).arrayBuffer());
        doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
        prog(0.1 + 0.8 * i / pdf.numPages, t("page_of", { a: i, b: pdf.numPages }));
      }
      const bytes = await doc.save();
      if (bytes.length >= orig.byteLength) return { blob: pdfBlob(orig), name: base(f.name) + "-compressed.pdf", note: t("no_gain") };
      return { blob: pdfBlob(bytes), name: base(f.name) + "-compressed.pdf", note: t("size_change", { a: size(orig.byteLength), b: size(bytes.length) }) };
    },
    async rotate([f], o, prog) {
      await need("pdflib");
      return { blob: pdfBlob(await Core.rotate(await f.arrayBuffer(), o.angle, o.ranges)), name: base(f.name) + "-rotated.pdf" };
    },
    async watermark([f], o, prog) {
      await need("pdflib", "fontkit");
      const bytes = await Core.watermark(await f.arrayBuffer(), { text: o.text || "Qalam PDF", size: +o.size, opacity: +o.opacity / 100, color: o.color }, await UI.fontBytes());
      return { blob: pdfBlob(bytes), name: base(f.name) + "-watermark.pdf" };
    },
    async delete([f], o, prog) {
      await need("pdflib");
      return { blob: pdfBlob(await Core.deletePages(await f.arrayBuffer(), [...o.deleted])), name: base(f.name) + "-edited.pdf" };
    },
    async ocr([f], o, prog) {
      await need("tesseract", "jszip");
      const sources = [];
      if (ext(f.name) === "pdf") {
        const pdf = await openPdfJs(await f.arrayBuffer());
        for (let i = 1; i <= pdf.numPages; i++) sources.push(async () => (await renderPage(pdf, i, 2)).canvas);
      } else sources.push(async () => f);
      prog(0.05, t("processing"));
      const worker = await Tesseract.createWorker(o.lang);
      const texts = [];
      try {
        for (let i = 0; i < sources.length; i++) {
          const { data } = await worker.recognize(await sources[i]());
          texts.push(data.text);
          prog(0.1 + 0.85 * (i + 1) / sources.length, t("page_of", { a: i + 1, b: sources.length }));
        }
      } finally { await worker.terminate(); }
      if (o.output === "txt") return { blob: new Blob([texts.join("\n\n\f")], { type: "text/plain" }), name: base(f.name) + ".txt" };
      return { blob: await Core.textToDocx(texts), name: base(f.name) + ".docx" };
    },
  };

  // ---------- option panels ----------
  function optionsHtml(tool, o) {
    const seg = (key, items) => `<div class="seg" data-seg="${key}">${items.map(([v, label]) => `<button type="button" data-v="${v}" class="${String(o[key]) === String(v) ? "on" : ""}">${label}</button>`).join("")}</div>`;
    switch (tool.id) {
      case "split": return `<div class="opt"><label>${t("o_split_mode")}</label>${seg("mode", [["each", t("o_split_each")], ["ranges", t("o_split_ranges")]])}</div>` +
        (o.mode === "ranges" ? `<div class="opt"><label>${t("o_ranges")}</label><input type="text" data-k="ranges" value="${esc(o.ranges)}" placeholder="${t("o_ranges_hint")}"></div>` : "");
      case "compress": return `<div class="opt"><label>${t("o_quality")}</label>${seg("quality", [["low", t("o_low")], ["med", t("o_med")], ["high", t("o_high")]])}</div>`;
      case "rotate": return `<div class="opt"><label>${t("o_angle")}</label>${seg("angle", [[90, "90°"], [180, "180°"], [270, "270°"]])}</div><div class="opt"><label>${t("o_ranges")}</label><input type="text" data-k="ranges" value="${esc(o.ranges)}" placeholder="${t("o_pages_all")} · ${t("o_ranges_hint")}"></div>`;
      case "watermark": return `<div class="opt"><label>${t("o_wm_text")}</label><input type="text" data-k="text" value="${esc(o.text)}"></div><div class="opt"><label>${t("o_size")}: <span data-show="size">${o.size}</span></label><input type="range" min="16" max="120" data-k="size" value="${o.size}"></div><div class="opt"><label>${t("o_opacity")}: <span data-show="opacity">${o.opacity}</span>%</label><input type="range" min="5" max="100" data-k="opacity" value="${o.opacity}"></div><div class="opt"><label>${t("o_color")}</label><input type="color" data-k="color" value="${o.color}"></div>`;
      case "jpg_pdf": return `<div class="opt"><label>${t("o_page_size")}</label>${seg("pageSize", [["fit", t("o_fit")], ["a4", t("o_a4")]])}</div>`;
      case "ocr": return `<div class="opt"><label>${t("o_ocr_lang")}</label><select data-k="lang"><option value="kaz+rus+eng">Қазақша + Русский + English</option><option value="rus+eng">Русский + English</option><option value="eng">English</option><option value="deu">Deutsch</option><option value="fra">Français</option><option value="spa">Español</option><option value="ita">Italiano</option><option value="dan">Dansk</option><option value="ara">العربية</option><option value="chi_sim">简体中文</option><option value="kor">한국어</option></select></div><div class="opt"><label>${t("o_output")}</label>${seg("output", [["docx", "Word (.docx)"], ["txt", "Text (.txt)"]])}</div>`;
      default: return "";
    }
  }
  const DEFAULTS = { split: { mode: "each", ranges: "" }, compress: { quality: "med" }, rotate: { angle: 90, ranges: "" }, watermark: { text: "Qalam PDF", size: 60, opacity: 25, color: "#5236ec" }, jpg_pdf: { pageSize: "fit" }, ocr: { lang: "kaz+rus+eng", output: "docx" }, delete: {} };

  // ---------- tool page ----------
  function renderToolPage(root, id) {
    const tool = byId[id];
    if (!tool) { location.hash = "#/tools"; return; }
    const acceptAttr = tool.accept.map((e) => "." + e).join(",");
    const st = { files: [], o: Object.assign({}, DEFAULTS[id] || {}), busy: false, result: null, err: "", progress: 0, status: "" };
    if (id === "delete") st.o.deleted = new Set();

    root.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <div class="crumbs"><a href="#/">${t("home")}</a> › <a href="#/tools">${t("nav_tools")}</a> › ${t("t_" + id)}</div>
        <h1>${t("t_" + id)}${tool.beta ? ` <small class="badge" style="position:static;vertical-align:middle">${t("beta")}</small>` : ""}</h1>
        <p>${t("d_" + id)}</p>
      </div></section>
      <section class="sec" style="padding-top:20px"><div class="wrap"><div class="tool-box" id="tb"></div></div></section>
      <input type="file" id="tf" accept="${acceptAttr}" ${tool.multi ? "multiple" : ""} hidden>`;
    const box = root.querySelector("#tb");
    const input = root.querySelector("#tf");

    function addFiles(list) {
      st.err = "";
      for (const f of list) {
        if (!tool.accept.includes(ext(f.name))) { st.err = t("err_type"); continue; }
        if (f.size > MAX) { st.err = t("err_size"); continue; }
        if (tool.multi) st.files.push(f); else st.files = [f];
      }
      if (tool.editor && st.files[0]) { App.openEditor(st.files[0], tool.editor); return; }
      if (id === "delete" && st.files[0]) loadThumbs();
      draw();
    }
    input.onchange = () => { addFiles(input.files); input.value = ""; };
    if (App.pendingFiles) { const pf = App.pendingFiles; App.pendingFiles = null; setTimeout(() => addFiles(pf)); }

    async function loadThumbs() {
      st.thumbs = null; draw();
      try {
        const pdf = await openPdfJs(await st.files[0].arrayBuffer());
        st.thumbs = [];
        for (let i = 1; i <= pdf.numPages; i++) st.thumbs.push((await renderPage(pdf, i, 0.35)).canvas);
      } catch (e) { st.err = t("err_open"); st.files = []; }
      draw();
    }

    function draw() {
      if (st.result) return drawResult();
      const files = st.files;
      if (!files.length) {
        box.innerHTML = `<div class="drop" id="dz" style="box-shadow:none;padding:0"><div class="drop-in">${UI.art}<div class="drop-sep"></div><div class="drop-cta"><button class="btn btn-primary btn-lg" id="pick">${svg("upload", 'width="20"')} ${t("choose_file")}</button><p class="muted">${t("or_drop")}</p><p class="muted small">${tool.accept.map((e) => e.toUpperCase()).join(", ")} · ≤ 100 MB</p></div></div></div>${st.err ? `<p class="err">${st.err}</p>` : ""}`;
        bindDrop(box.querySelector("#dz"), addFiles, () => input.click());
        return;
      }
      const reorder = tool.multi;
      let html = `<ul class="flist">${files.map((f, i) => `<li>${UI.fileIco(ext(f.name))}<span class="nm">${esc(f.name)}</span><span class="sz">${size(f.size)}</span>${reorder ? `<button class="icon-btn" data-up="${i}" title="↑">${svg("up")}</button><button class="icon-btn" data-down="${i}" title="↓">${svg("down")}</button>` : ""}<button class="icon-btn" data-rm="${i}" title="${t("del")}">${svg("close")}</button></li>`).join("")}</ul>`;
      if (tool.multi) html += `<p style="text-align:center;margin:0 0 16px"><button class="btn btn-outline btn-sm" id="more">+ ${t("add_more")}</button></p>`;
      if (id === "delete") {
        html += `<p class="muted" style="text-align:center">${t("o_click_delete")} · ${t("o_selected", { n: st.o.deleted.size })}</p>`;
        html += st.thumbs ? `<div class="thumbs" id="thumbs"></div>` : `<p class="muted" style="text-align:center">${t("processing")}</p>`;
      }
      html += `<div class="opts">${optionsHtml(tool, st.o)}</div>`;
      html += `<div class="tool-actions"><button class="btn btn-primary btn-lg" id="go" ${st.busy ? "disabled" : ""}>${t("run")} ${svg("arrow", 'width="18" class="flip"')}</button></div>`;
      if (st.busy) html += `<div class="progress"><div class="bar"><div style="width:${Math.round(st.progress * 100)}%"></div></div><p class="muted small">${esc(st.status || t("processing"))}</p></div>`;
      if (st.err) html += `<p class="err">${esc(st.err)}</p>`;
      box.innerHTML = html;

      if (id === "delete" && st.thumbs) {
        const wrap = box.querySelector("#thumbs");
        st.thumbs.forEach((c, i) => {
          const d = document.createElement("div");
          d.className = "thumb" + (st.o.deleted.has(i) ? " del" : "");
          d.appendChild(c);
          d.insertAdjacentHTML("beforeend", `<span class="pn">${i + 1}</span>`);
          d.onclick = () => { st.o.deleted.has(i) ? st.o.deleted.delete(i) : st.o.deleted.add(i); draw(); };
          wrap.appendChild(d);
        });
      }
      box.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { files.splice(+b.dataset.rm, 1); if (id === "delete") st.o.deleted.clear(); draw(); }));
      box.querySelectorAll("[data-up]").forEach((b) => (b.onclick = () => { const i = +b.dataset.up; if (i > 0) [files[i - 1], files[i]] = [files[i], files[i - 1]]; draw(); }));
      box.querySelectorAll("[data-down]").forEach((b) => (b.onclick = () => { const i = +b.dataset.down; if (i < files.length - 1) [files[i + 1], files[i]] = [files[i], files[i + 1]]; draw(); }));
      const more = box.querySelector("#more"); if (more) more.onclick = () => input.click();
      box.querySelectorAll("[data-seg] button").forEach((b) => (b.onclick = () => { const k = b.parentElement.dataset.seg; st.o[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; draw(); }));
      box.querySelectorAll("[data-k]").forEach((el) => {
        if (el.tagName === "SELECT") el.value = st.o[el.dataset.k];
        el.oninput = () => { st.o[el.dataset.k] = el.value; const s = box.querySelector(`[data-show="${el.dataset.k}"]`); if (s) s.textContent = el.value; };
      });
      box.querySelector("#go").onclick = run;
      bindDrop(box, addFiles);
    }

    async function run() {
      st.err = "";
      if (tool.min && st.files.length < tool.min) { st.err = t("err_need2"); return draw(); }
      if (id === "delete" && !st.o.deleted.size) { st.err = t("o_click_delete"); return draw(); }
      st.busy = true; st.progress = 0.05; st.status = t("processing"); draw();
      const prog = (p, s) => { st.progress = p; if (s) st.status = s; const bar = box.querySelector(".bar > div"); if (bar) bar.style.width = Math.round(p * 100) + "%"; const lab = box.querySelector(".progress p"); if (lab && s) lab.textContent = s; };
      try {
        const res = await RUN[id](st.files, st.o, prog);
        prog(1);
        if (res.blob) res.saved = await Store.add(res.name, res.blob);
        st.result = res;
      } catch (e) {
        console.error(e);
        const m = String(e && (e.message || e.name));
        st.err = /^short$/.test(m) ? t("err_short") : /notext/.test(m) ? t("err_notext") : /range/.test(m) ? t("err_range") : /^all$/.test(m) ? t("err_all") : /Password/i.test(m) || (e && e.name === "PasswordException") ? t("err_pass") : /Invalid PDF|parse|header/i.test(m) ? t("err_open") : t("err_generic") + m;
      }
      st.busy = false; draw();
    }

    function drawAi(r) {
      const a = r.ai;
      const bars = a.classes.map((c, i) => ({ c, p: a.proba[i] })).sort((x, y) => y.p - x.p)
        .map(({ c, p }) => `<div class="pbar ${c === a.label ? "top" : ""}"><span>${t("cls_" + c)}</span><div><i style="width:${(p * 100).toFixed(1)}%"></i></div><b>${(p * 100).toFixed(1)}%</b></div>`).join("");
      box.innerHTML = `<div class="ai-result" data-label="${a.label}">
        <div class="ai-head">${ico("ai", "purple")}<div><p class="muted small" style="margin:0">${t("ai_type")} · ${esc(r.name)}</p><h2 style="margin:0">${t("cls_" + a.label)}</h2></div>
          <div class="ai-conf"><b>${(a.confidence * 100).toFixed(0)}%</b><span>${t("ai_conf")}</span></div></div>
        ${a.sure ? "" : `<p class="ai-warn">⚠ ${t("ai_unsure")}</p>`}
        <h4>${t("ai_suggest")}</h4><div class="tgrid compact">${AI_SUGGEST[a.label].map((id) => card(byId[id], true)).join("")}</div>
        <div class="ai-cols"><div><h4>${t("ai_all")}</h4>${bars}</div>
        <div><h4>${t("ai_why")}</h4><div class="chips">${a.why.map((w) => `<span class="chip">${esc(w)}</span>`).join("")}</div><p class="muted small">${t("ai_note")}</p></div></div>
      </div><div class="tool-actions" style="margin-top:16px"><button class="btn btn-outline" id="again">${t("again")}</button></div>`;
      box.querySelector("#again").onclick = () => { st.result = null; st.files = []; draw(); };
    }

    function drawResult() {
      const r = st.result;
      if (r.ai) return drawAi(r);
      box.innerHTML = `<div class="result">
        <div class="result-head"><span class="ok">${svg("check", 'width="22"')}</span><div><h3>${t("ready")}</h3><p>${t("ready_d")}</p></div></div>
        <div class="result-file"><div class="card">${UI.fileIco(ext(r.name))}<div><div class="nm">${esc(r.name)}</div><div class="muted small">${size(r.blob.size)}</div></div><span class="tag">${ext(r.name).toUpperCase()}</span></div>
        <button class="btn btn-primary btn-lg" id="dl">${svg("download", 'width="20"')} ${t("download")}</button></div>
        ${r.note ? `<p class="result-note">${esc(r.note)}</p>` : ""}
        ${r.saved ? `<p class="result-note">✓ <a class="link" href="#/files">${t("saved")}</a></p>` : ""}
      </div><div class="tool-actions" style="margin-top:16px"><button class="btn btn-outline" id="again">${t("again")}</button></div>`;
      box.querySelector("#dl").onclick = () => UI.save(r.blob, r.name);
      box.querySelector("#again").onclick = () => { st.result = null; st.files = []; if (st.o.deleted) st.o.deleted.clear(); draw(); };
    }
    draw();
  }

  function bindDrop(el, onFiles, onClick) {
    if (!el) return;
    const zone = el.classList.contains("drop") ? el : null;
    el.ondragover = (e) => { e.preventDefault(); zone && zone.classList.add("over"); };
    el.ondragleave = () => zone && zone.classList.remove("over");
    el.ondrop = (e) => { e.preventDefault(); zone && zone.classList.remove("over"); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); };
    if (onClick) el.querySelector(".drop-in").onclick = (e) => { if (!e.target.closest("button") || e.target.closest("#pick")) onClick(); };
  }

  window.Tools = { TOOLS, POPULAR, byId, card, renderToolPage, bindDrop, openPdfJs, renderPage };
})();
