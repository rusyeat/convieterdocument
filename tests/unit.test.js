// Unit tests for js/core.js and js/docx.js. Run: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers");
const { Core } = H;
global.window = globalThis;
require("../js/i18n.js");
const Classifier = require("../js/classifier.js");
const MODEL = JSON.parse(fs.readFileSync(path.join(H.ROOT, "assets/model/doc-classifier.json"), "utf8"));

test("all 11 interface languages have every key", () => {
  const keys = Object.keys(I18N.kk);
  assert.equal(LANG_ORDER.length, 11);
  for (const code of LANG_ORDER) assert.deepEqual(keys.filter((k) => !(k in I18N[code])), [], code + " missing keys");
});

test("AI: char_wb n-grams match scikit-learn's definition", () => {
  // sklearn: TfidfVectorizer(analyzer="char_wb", ngram_range=(2,3)).build_analyzer()("Ab cd")
  assert.deepEqual(Classifier.charWbNgrams("Ab cd", 2, 3), [" a", "ab", "b ", " ab", "ab ", " c", "cd", "d ", " cd", "cd "]);
  assert.deepEqual(Classifier.charWbNgrams("a", 3, 4), [" a "]); // short word counted once
});

test("AI: JS inference reproduces scikit-learn probabilities (parity)", () => {
  const model = Classifier.create(MODEL);
  const ref = JSON.parse(fs.readFileSync(path.join(H.ROOT, "ml/results/parity.json"), "utf8"));
  let maxDiff = 0;
  for (const r of ref) {
    const p = model.predict(r.text).proba;
    p.forEach((v, i) => (maxDiff = Math.max(maxDiff, Math.abs(v - r.proba[i]))));
  }
  console.log(`    max |p_js - p_sklearn| = ${maxDiff.toExponential(2)} over ${ref.length} texts`);
  assert.ok(maxDiff < 1e-3, "max diff " + maxDiff);
});

test("AI: handwritten test set accuracy in the browser model matches the report", () => {
  const model = Classifier.create(MODEL);
  const metrics = JSON.parse(fs.readFileSync(path.join(H.ROOT, "ml/results/metrics.json"), "utf8"));
  const rows = fs.readFileSync(path.join(H.ROOT, "ml/data/test_handwritten.csv"), "utf8").trim().split(/\r?\n/).slice(1)
    .map((l) => { const m = l.match(/^"(.*)",(\w+),(\w+)$/); return { text: m[1].replace(/""/g, '"'), label: m[2] }; });
  const acc = rows.filter((r) => model.predict(r.text).label === r.label).length / rows.length;
  console.log(`    handwritten accuracy (JS) = ${(acc * 100).toFixed(1)}%`);
  assert.equal(+acc.toFixed(4), metrics.handwritten_test.logreg_char.accuracy);
});

test("AI: a contract PDF is classified end to end (PDF -> text -> model)", async () => {
  const pages = await Core.readTextPages(await H.textPdf(H.CONTRACT_TEXT));
  const text = pages.map((p) => p.items.map((i) => i.str).join(" ")).join("\n");
  const r = Classifier.create(MODEL).predict(text);
  assert.equal(r.label, "contract");
  assert.ok(r.sure, "confident: " + r.confidence);
});

test("parseRanges: valid and invalid input", () => {
  assert.deepEqual(Core.parseRanges("1-3, 5", 6), [[0, 1, 2], [4]]);
  assert.deepEqual(Core.parseRanges("2", 2), [[1]]);
  for (const bad of ["", "0", "3-1", "7", "a-b", "1-99"]) assert.throws(() => Core.parseRanges(bad, 6), /range/, bad);
});

test("merge keeps every page in the given order", async () => {
  const merged = await Core.merge([await H.numberedPdf(2), await H.numberedPdf(3)]);
  assert.deepEqual(await H.pageTexts(merged), ["Page 1", "Page 2", "Page 1", "Page 2", "Page 3"]);
});

test("split: each page and by range", async () => {
  const src = await H.numberedPdf(5);
  const each = await Core.split(src, "each");
  assert.equal(each.length, 5);
  assert.deepEqual(await H.pageTexts(each[3].bytes), ["Page 4"]);
  const parts = await Core.split(src, "ranges", "1-2, 4-5");
  assert.deepEqual(parts.map((p) => p.label), ["1-2", "4-5"]);
  assert.deepEqual(await H.pageTexts(parts[1].bytes), ["Page 4", "Page 5"]);
});

test("rotate: all pages or selected pages", async () => {
  const src = await H.numberedPdf(3);
  const all = await PDFLib.PDFDocument.load(await Core.rotate(src, 90, ""));
  assert.deepEqual(all.getPages().map((p) => p.getRotation().angle), [90, 90, 90]);
  const some = await PDFLib.PDFDocument.load(await Core.rotate(src, 180, "2"));
  assert.deepEqual(some.getPages().map((p) => p.getRotation().angle), [0, 180, 0]);
});

test("deletePages removes chosen pages and refuses to delete all", async () => {
  const src = await H.numberedPdf(4);
  assert.deepEqual(await H.pageTexts(await Core.deletePages(src, [0, 2])), ["Page 2", "Page 4"]);
  await assert.rejects(() => Core.deletePages(src, [0, 1, 2, 3]), /all/);
});

test("watermark with Kazakh text is embedded on every page", async () => {
  const out = await Core.watermark(await H.numberedPdf(2), { text: "ҚҰПИЯ ӘҢ", size: 50, opacity: 0.3, color: "#5236ec" }, H.FONT);
  const texts = await H.pageTexts(out);
  assert.equal(texts.length, 2);
  texts.forEach((t) => assert.match(t, /ҚҰПИЯ ӘҢ/));
});

test("imagesToPdf: fit and A4 page sizes", async () => {
  // 2x1 red PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DAwMDAAAAN+gH/qr+eWgAAAABJRU5ErkJggg==", "base64");
  const fit = await PDFLib.PDFDocument.load(await Core.imagesToPdf([{ bytes: png, type: "png" }], "fit"));
  assert.deepEqual(Object.values(fit.getPage(0).getSize()).map(Math.round), [2, 1]);
  const a4 = await PDFLib.PDFDocument.load(await Core.imagesToPdf([{ bytes: png, type: "png" }, { bytes: png, type: "png" }], "a4"));
  assert.equal(a4.getPageCount(), 2);
  assert.deepEqual(Object.values(a4.getPage(0).getSize()).map(Math.round), [842, 595]); // wide image -> landscape
});

test("PDF -> Word: heading, paragraphs and Kazakh letters (accuracy ≥ 98%)", async () => {
  const { blob, blocks } = await Core.pdfToDocx(await H.articlePdf());
  const paras = await H.docxText(blob);
  assert.equal(blocks[0].heading, 1, "title becomes Heading 1");
  assert.equal(blocks[0].align, "center");
  assert.equal(paras[0], H.ARTICLE.title);
  assert.equal(paras.length, 1 + H.ARTICLE.paragraphs.length, "wrapped lines are joined into one paragraph each");
  const acc = H.wordAccuracy([H.ARTICLE.title, ...H.ARTICLE.paragraphs].join(" "), paras.join(" "));
  console.log(`    word accuracy: ${(acc * 100).toFixed(1)}%`);
  assert.ok(acc >= 0.98, "accuracy " + acc);
});

test("PDF -> Word: bold is detected from the font name", async () => {
  const { blocks } = await Core.pdfToDocx(await H.articlePdf());
  assert.ok(blocks[0].runs.every((r) => r.bold), "title runs are bold");
  assert.ok(blocks[1].runs.every((r) => !r.bold), "body runs are regular");
});

test("PDF -> Word: a PDF without text reports 'notext'", async () => {
  const { doc } = await H.newDoc();
  doc.addPage([595, 842]);
  const empty = await doc.save();
  await assert.rejects(() => Core.pdfToDocx(empty), /notext/);
});

test("PDF -> Excel: table cells land in the right rows/columns (accuracy 100%)", async () => {
  const { bytes } = await Core.pdfToXlsx(await H.tablePdf());
  const wb = XLSX.read(bytes, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  let ok = 0, total = 0;
  H.TABLE.forEach((r, i) => r.forEach((v, j) => { total++; if (rows[i] && rows[i][j] === v) ok++; }));
  console.log(`    cell accuracy: ${ok}/${total}`);
  assert.equal(ok, total);
  assert.equal(typeof rows[1][1], "number", "numbers are stored as numbers");
});

test("textToDocx (OCR output) keeps paragraphs and page breaks", async () => {
  const blob = await Core.textToDocx(["Бірінші абзац\nжалғасы\n\nЕкінші абзац", "Келесі бет"]);
  const paras = await H.docxText(blob);
  assert.deepEqual(paras, ["Бірінші абзац жалғасы", "Екінші абзац", "Келесі бет"]);
});

test("docx output is a valid package with XML-escaped text", async () => {
  const blob = await buildDocx([{ type: "p", runs: [{ text: "a < b & c > d \u0001" }] }]);
  const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  for (const f of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]) assert.ok(zip.file(f), f);
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /a &lt; b &amp; c &gt; d </);
  assert.doesNotMatch(xml, /\u0001/);
});
