pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const $ = (id) => document.getElementById(id);
const MAX = 100 * 1024 * 1024;
let lastUrl = null;

function show(state) {
  $("idle").hidden = state !== "idle";
  $("busy").hidden = state !== "busy";
  $("done").hidden = state !== "done";
}
function fail(msg) { show("idle"); $("err").textContent = msg; $("err").hidden = false; }
function progress(p, text) { $("barFill").style.width = Math.round(p * 100) + "%"; if (text) $("status").textContent = text; }

// ---- PDF -> blocks ----
function median(nums) {
  if (!nums.length) return 11;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Groups text items of one page into lines, then lines into paragraphs.
function pageToBlocks(items, styles, pageWidth, bodySize) {
  const pieces = items
    .filter((it) => it.str !== undefined && (it.str.trim() || it.hasEOL))
    .map((it) => {
      const size = Math.hypot(it.transform[2], it.transform[3]) || Math.abs(it.transform[3]) || 11;
      const font = (styles[it.fontName]?.realName || "") + " " + (styles[it.fontName]?.fontFamily || "");
      return { text: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size,
        bold: /bold|black|heavy|semibold/i.test(font), italic: /italic|oblique/i.test(font) };
    })
    .filter((p) => p.text.length);

  // sort top->bottom, left->right, then merge pieces sharing a baseline
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
      if (prevEnd !== null && p.x - prevEnd > p.size * 0.15 && !/\s$/.test(l.runs.at(-1)?.text || "") && !/^\s/.test(text)) text = " " + text;
      const r = l.runs.at(-1);
      if (r && r.bold === p.bold && r.italic === p.italic && Math.abs(r.size - p.size) < 0.5) r.text += text;
      else l.runs.push({ text, size: p.size, bold: p.bold, italic: p.italic });
      prevEnd = p.x + p.w;
    }
    l.text = l.runs.map((r) => r.text).join("").trim();
  }

  const realLines = lines.filter((l) => l.text);
  const gaps = [];
  for (let i = 1; i < realLines.length; i++) gaps.push(realLines[i - 1].y - realLines[i].y);
  const lineGap = median(gaps.filter((g) => g > 0)) || bodySize * 1.2;

  const blocks = [];
  let cur = null;
  for (let i = 0; i < realLines.length; i++) {
    const l = realLines[i];
    const prev = realLines[i - 1];
    const gap = prev ? prev.y - l.y : 0;
    const center = (l.x + l.right) / 2;
    const centered = Math.abs(center - pageWidth / 2) < pageWidth * 0.06 && (l.right - l.x) < pageWidth * 0.7;
    const isHeading = l.size > bodySize * 1.25;

    const startsNew = !cur || gap > lineGap * 1.45 || Math.abs(l.size - cur.size) > 1 ||
      isHeading !== cur.isHeading || /^([•●▪\-–*]|\d+[.)])\s/.test(l.text) ||
      (prev && l.x - prev.x > bodySize * 1.5);

    if (startsNew) {
      if (cur) blocks.push(cur);
      cur = { type: "p", runs: [], size: l.size, isHeading, align: centered ? "center" : "left" };
      if (isHeading) cur.heading = l.size > bodySize * 1.8 ? 1 : l.size > bodySize * 1.45 ? 2 : 3;
    } else {
      // join wrapped line; mend words hyphenated across lines
      const lastRun = cur.runs.at(-1);
      if (lastRun && /[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]-$/.test(lastRun.text)) lastRun.text = lastRun.text.slice(0, -1);
      else if (lastRun) lastRun.text = lastRun.text.replace(/\s*$/, " ");
      if (!centered) cur.align = "left";
    }
    l.runs.forEach((r, idx) => {
      const run = { ...r, text: idx === 0 ? r.text.replace(/^\s+/, "") : r.text };
      if (cur.heading) { run.size = undefined; } // heading style sets the size
      else if (Math.abs(run.size - bodySize) < 0.6) run.size = undefined; // keep document default
      cur.runs.push(run);
    });
  }
  if (cur) blocks.push(cur);
  return blocks;
}

async function convert(file) {
  $("err").hidden = true;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return fail("Please choose a PDF file.");
  if (file.size > MAX) return fail("This file is larger than 100 MB.");
  show("busy");
  $("fname").textContent = file.name;
  progress(0.02, "Reading file…");

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (e) {
    return fail(e?.name === "PasswordException" ? "This PDF is password-protected." : "Could not open this PDF. It may be damaged.");
  }

  const pages = [];
  let firstSize = null;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    if (!firstSize) firstSize = { width: vp.width, height: vp.height };
    const tc = await page.getTextContent();
    // load fonts so we can read their real names (e.g. "Helvetica-Bold") for bold/italic
    try {
      await page.getOperatorList();
      for (const fn of Object.keys(tc.styles)) {
        if (page.commonObjs.has(fn)) tc.styles[fn].realName = page.commonObjs.get(fn).name || "";
      }
    } catch (_) {}
    pages.push({ items: tc.items, styles: tc.styles, width: vp.width });
    progress(0.05 + 0.8 * (i / pdf.numPages), `Reading page ${i} of ${pdf.numPages}…`);
  }

  // body text size = most common size across the document, weighted by length
  const weight = new Map();
  for (const p of pages) for (const it of p.items) {
    if (!it.str?.trim()) continue;
    const s = Math.round((Math.hypot(it.transform[2], it.transform[3]) || 11) * 2) / 2;
    weight.set(s, (weight.get(s) || 0) + it.str.length);
  }
  let bodySize = 11, best = 0;
  for (const [s, w] of weight) if (w > best) { best = w; bodySize = s; }

  progress(0.9, "Building Word document…");
  const blocks = [];
  let chars = 0;
  pages.forEach((p, idx) => {
    const b = pageToBlocks(p.items, p.styles, p.width, bodySize);
    b.forEach((x) => (chars += x.runs.reduce((n, r) => n + r.text.length, 0)));
    blocks.push(...b);
    if (idx < pages.length - 1) blocks.push({ type: "pagebreak" });
  });

  if (chars === 0) return fail("No text found. This looks like a scanned PDF — OCR is not supported in v0.1 yet.");

  const blob = await buildDocx(blocks, firstSize);
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  const outName = file.name.replace(/\.pdf$/i, "") + ".docx";
  $("dl").href = lastUrl;
  $("dl").download = outName;
  $("outName").textContent = outName;
  $("note").textContent = `${pdf.numPages} page${pdf.numPages > 1 ? "s" : ""} · ${(blob.size / 1024).toFixed(0)} KB · images and tables are not kept in v0.1`;
  progress(1, "Done");
  show("done");
}

// ---- UI wiring ----
const drop = $("drop");
$("pick").addEventListener("click", (e) => { e.stopPropagation(); $("file").click(); });
drop.addEventListener("click", (e) => { if (!$("idle").hidden && e.target === drop) $("file").click(); });
drop.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !$("idle").hidden) { e.preventDefault(); $("file").click(); } });
$("file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) convert(f); e.target.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) convert(f); });
$("again").addEventListener("click", () => { show("idle"); progress(0); });
$("burger").addEventListener("click", () => $("links").classList.toggle("open"));
document.querySelectorAll("#links a").forEach((a) => a.addEventListener("click", () => $("links").classList.remove("open")));
