// Core document operations. No DOM access here, so the same code runs in the
// browser and in the Node test suite (tests/run.js). Uses globals: PDFLib, pdfjsLib, JSZip, XLSX.
(function (root) {
  const Core = {};

  // "1-3, 5" -> [[0,1,2],[4]] (0-based). Throws on bad input.
  Core.parseRanges = function (str, pageCount) {
    const groups = [];
    for (const part of String(str).split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
      if (!m) throw new Error("range");
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < a || b > pageCount) throw new Error("range");
      const g = [];
      for (let i = a; i <= b; i++) g.push(i - 1);
      groups.push(g);
    }
    if (!groups.length) throw new Error("range");
    return groups;
  };

  Core.loadPdf = (bytes) => PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });

  Core.merge = async function (list) {
    const out = await PDFLib.PDFDocument.create();
    for (const bytes of list) {
      const src = await Core.loadPdf(bytes);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    return out.save();
  };

  async function pick(src, indices) {
    const out = await PDFLib.PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    return out.save();
  }

  // mode "each" -> one file per page; mode "ranges" -> one file per range group
  Core.split = async function (bytes, mode, ranges) {
    const src = await Core.loadPdf(bytes);
    const n = src.getPageCount();
    const groups = mode === "each" ? src.getPageIndices().map((i) => [i]) : Core.parseRanges(ranges, n);
    const files = [];
    for (const g of groups) {
      const label = g.length === 1 ? `${g[0] + 1}` : `${g[0] + 1}-${g[g.length - 1] + 1}`;
      files.push({ label, bytes: await pick(src, g) });
    }
    return files;
  };

  Core.rotate = async function (bytes, angle, ranges) {
    const doc = await Core.loadPdf(bytes);
    const n = doc.getPageCount();
    const idx = ranges && ranges.trim() ? Core.parseRanges(ranges, n).flat() : doc.getPageIndices();
    for (const i of idx) {
      const p = doc.getPage(i);
      p.setRotation(PDFLib.degrees((p.getRotation().angle + angle) % 360));
    }
    return doc.save();
  };

  Core.deletePages = async function (bytes, indices) {
    const doc = await Core.loadPdf(bytes);
    const del = new Set(indices);
    if (del.size >= doc.getPageCount()) throw new Error("all");
    return pick(doc, doc.getPageIndices().filter((i) => !del.has(i)));
  };

  Core.hexToRgb = function (hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  // Embeds Noto Sans (Latin + Cyrillic + Kazakh letters) so non-English text works.
  Core.embedFont = async function (doc, fontBytes) {
    if (fontBytes && root.fontkit) {
      doc.registerFontkit(root.fontkit);
      return doc.embedFont(fontBytes, { subset: true });
    }
    return doc.embedFont(PDFLib.StandardFonts.Helvetica);
  };

  Core.watermark = async function (bytes, opt, fontBytes) {
    const doc = await Core.loadPdf(bytes);
    const font = await Core.embedFont(doc, fontBytes);
    const size = opt.size || 48;
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const w = font.widthOfTextAtSize(opt.text, size);
      const ang = Math.atan2(height, width);
      // centre the rotated text on the page
      const x = width / 2 - (Math.cos(ang) * w) / 2 + (Math.sin(ang) * size) / 3;
      const y = height / 2 - (Math.sin(ang) * w) / 2 - (Math.cos(ang) * size) / 3;
      page.drawText(opt.text, { x, y, size, font, color: Core.hexToRgb(opt.color || "#5236ec"),
        opacity: opt.opacity ?? 0.25, rotate: PDFLib.degrees((ang * 180) / Math.PI) });
    }
    return doc.save();
  };

  // images: [{ bytes, type: "jpg"|"png", width, height }]; pageMode: "fit" | "a4"
  Core.imagesToPdf = async function (images, pageMode) {
    const doc = await PDFLib.PDFDocument.create();
    for (const im of images) {
      const img = im.type === "png" ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
      if (pageMode === "a4") {
        const W = 595.28, H = 841.89, M = 28;
        const landscape = img.width > img.height;
        const pw = landscape ? H : W, ph = landscape ? W : H;
        const s = Math.min((pw - 2 * M) / img.width, (ph - 2 * M) / img.height, 1);
        const page = doc.addPage([pw, ph]);
        page.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s });
      } else {
        const page = doc.addPage([img.width * 0.75, img.height * 0.75]);
        page.drawImage(img, { x: 0, y: 0, width: img.width * 0.75, height: img.height * 0.75 });
      }
    }
    return doc.save();
  };

  // ---------- text extraction (pdf.js) ----------
  Core.readTextPages = async function (bytes, onPage) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      // load fonts to read real names (e.g. "Helvetica-Bold") for bold/italic
      try {
        await page.getOperatorList();
        for (const fn of Object.keys(tc.styles)) if (page.commonObjs.has(fn)) tc.styles[fn].realName = page.commonObjs.get(fn).name || "";
      } catch (_) {}
      pages.push({ items: tc.items, styles: tc.styles, width: vp.width, height: vp.height });
      onPage && onPage(i, pdf.numPages);
    }
    return pages;
  };

  const sizeOf = (it) => Math.hypot(it.transform[2], it.transform[3]) || Math.abs(it.transform[3]) || 11;

  Core.bodySize = function (pages) {
    const weight = new Map();
    for (const p of pages) for (const it of p.items) {
      if (!it.str || !it.str.trim()) continue;
      const s = Math.round(sizeOf(it) * 2) / 2;
      weight.set(s, (weight.get(s) || 0) + it.str.length);
    }
    let body = 11, best = 0;
    for (const [s, w] of weight) if (w > best) { best = w; body = s; }
    return body;
  };

  // Groups text pieces sharing a baseline into lines.
  Core.toLines = function (items, styles) {
    // whitespace-only items are dropped: pdf.js uses them to bridge column gaps,
    // which would glue table cells together. Spaces are re-added from x gaps.
    const pieces = items.filter((it) => it.str && it.str.trim()).map((it) => {
      const st = styles[it.fontName] || {};
      const font = (st.realName || "") + " " + (st.fontFamily || "");
      return { text: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: sizeOf(it),
        bold: /bold|black|heavy|semibold/i.test(font), italic: /italic|oblique/i.test(font) };
    });
    pieces.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const p of pieces) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line.y - p.y) < Math.max(2, p.size * 0.4)) line.parts.push(p);
      else lines.push({ y: p.y, parts: [p] });
    }
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x);
      l.x = l.parts[0].x;
      const last = l.parts[l.parts.length - 1];
      l.right = last.x + last.w;
      l.size = Math.max(...l.parts.map((p) => p.size));
      l.runs = [];
      let prevEnd = null;
      for (const p of l.parts) {
        let text = p.text;
        const prevRun = l.runs[l.runs.length - 1];
        if (prevEnd !== null && p.x - prevEnd > p.size * 0.15 && !/\s$/.test(prevRun ? prevRun.text : "") && !/^\s/.test(text)) text = " " + text;
        if (prevRun && prevRun.bold === p.bold && prevRun.italic === p.italic && Math.abs(prevRun.size - p.size) < 0.5) prevRun.text += text;
        else l.runs.push({ text, size: p.size, bold: p.bold, italic: p.italic });
        prevEnd = p.x + p.w;
      }
      l.text = l.runs.map((r) => r.text).join("").trim();
    }
    return lines.filter((l) => l.text);
  };

  // Typical line spacing. The lower quartile is used instead of the median because
  // in documents with short paragraphs the paragraph gaps can be half of all gaps.
  function lineSpacing(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor((s.length - 1) * 0.25)];
  }

  // Lines -> Word paragraphs (headings detected by font size, wrapped lines joined).
  Core.pageToBlocks = function (page, bodySize) {
    const lines = Core.toLines(page.items, page.styles);
    const gaps = [];
    for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
    const lineGap = lineSpacing(gaps.filter((g) => g > 0)) || bodySize * 1.2;
    const W = page.width;
    const blocks = [];
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], prev = lines[i - 1];
      const gap = prev ? prev.y - l.y : 0;
      const centered = Math.abs((l.x + l.right) / 2 - W / 2) < W * 0.06 && l.right - l.x < W * 0.7;
      const isHeading = l.size > bodySize * 1.25;
      const startsNew = !cur || gap > lineGap * 1.45 || Math.abs(l.size - cur.size) > 1 || isHeading !== cur.isHeading ||
        /^([•●▪\-–*]|\d+[.)])\s/.test(l.text) || (prev && l.x - prev.x > bodySize * 1.5);
      if (startsNew) {
        if (cur) blocks.push(cur);
        cur = { type: "p", runs: [], size: l.size, isHeading, align: centered ? "center" : "left" };
        if (isHeading) cur.heading = l.size > bodySize * 1.8 ? 1 : l.size > bodySize * 1.45 ? 2 : 3;
      } else {
        const lastRun = cur.runs[cur.runs.length - 1];
        if (lastRun && /\p{L}-$/u.test(lastRun.text)) lastRun.text = lastRun.text.slice(0, -1);
        else if (lastRun) lastRun.text = lastRun.text.replace(/\s*$/, " ");
        if (!centered) cur.align = "left";
      }
      l.runs.forEach((r, idx) => {
        const run = Object.assign({}, r, { text: idx === 0 ? r.text.replace(/^\s+/, "") : r.text });
        if (cur.heading || Math.abs(run.size - bodySize) < 0.6) run.size = undefined;
        cur.runs.push(run);
      });
    }
    if (cur) blocks.push(cur);
    return blocks;
  };

  Core.pdfToDocx = async function (bytes, onPage) {
    const pages = await Core.readTextPages(bytes, onPage);
    const body = Core.bodySize(pages);
    const blocks = [];
    let chars = 0;
    pages.forEach((p, i) => {
      const b = Core.pageToBlocks(p, body);
      b.forEach((x) => (chars += x.runs.reduce((n, r) => n + r.text.length, 0)));
      blocks.push(...b);
      if (i < pages.length - 1) blocks.push({ type: "pagebreak" });
    });
    if (!chars) throw new Error("notext");
    const blob = await root.buildDocx(blocks, { width: pages[0].width, height: pages[0].height });
    return { blob, pages: pages.length, blocks };
  };

  // Each page -> sheet. Cells are split where the horizontal gap between
  // text pieces is wide; column positions are aligned across rows of a page.
  Core.pageToRows = function (page) {
    const lines = Core.toLines(page.items, page.styles);
    const rows = lines.map((l) => {
      const cells = [];
      let cur = null;
      for (const p of l.parts) {
        if (cur && p.x - cur.end < Math.max(p.size * 1.2, 8)) {
          cur.text += (p.x - cur.end > p.size * 0.15 && !/\s$/.test(cur.text) ? " " : "") + p.text;
          cur.end = p.x + p.w;
        } else {
          cur = { x: p.x, end: p.x + p.w, text: p.text };
          cells.push(cur);
        }
      }
      return cells.map((c) => ({ x: c.x, text: c.text.trim() })).filter((c) => c.text);
    });
    // column anchors: cluster cell x-positions
    const xs = rows.flat().map((c) => c.x).sort((a, b) => a - b);
    const cols = [];
    for (const x of xs) if (!cols.length || x - cols[cols.length - 1] > 12) cols.push(x);
    return rows.map((cells) => {
      const out = [];
      for (const c of cells) {
        let ci = 0;
        for (let k = 0; k < cols.length; k++) if (Math.abs(cols[k] - c.x) < Math.abs(cols[ci] - c.x)) ci = k;
        while (out.length < ci) out.push("");
        const num = /^-?\d[\d\s]*([.,]\d+)?$/.test(c.text) ? Number(c.text.replace(/\s/g, "").replace(",", ".")) : NaN;
        out[ci] = out[ci] ? out[ci] + " " + c.text : (isNaN(num) ? c.text : num);
      }
      return out;
    });
  };

  Core.pdfToXlsx = async function (bytes, onPage) {
    const pages = await Core.readTextPages(bytes, onPage);
    const wb = XLSX.utils.book_new();
    let any = false;
    pages.forEach((p, i) => {
      const rows = Core.pageToRows(p);
      if (rows.length) any = true;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]), `Page ${i + 1}`);
    });
    if (!any) throw new Error("notext");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return { bytes: new Uint8Array(out), pages: pages.length };
  };

  // Plain text (e.g. OCR output) -> docx, one paragraph per blank-line block.
  Core.textToDocx = function (pageTexts) {
    const blocks = [];
    pageTexts.forEach((t, i) => {
      t.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean)
        .forEach((p) => blocks.push({ type: "p", runs: [{ text: p }] }));
      if (i < pageTexts.length - 1) blocks.push({ type: "pagebreak" });
    });
    return root.buildDocx(blocks);
  };

  root.Core = Core;
  if (typeof module !== "undefined") module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
