// Loads the browser modules (js/docx.js, js/core.js) into Node with the same
// libraries the site uses, and builds test PDFs with known content.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

global.PDFLib = require("pdf-lib");
global.JSZip = require("jszip");
global.XLSX = require("xlsx");
global.fontkit = require("@pdf-lib/fontkit");
global.pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
// silence pdf.js "fake worker" warnings
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
require(path.join(ROOT, "js/docx.js"));
const Core = require(path.join(ROOT, "js/core.js"));

const FONT = fs.readFileSync(path.join(ROOT, "assets/fonts/NotoSans-Regular.ttf"));
const FONT_B = fs.readFileSync(path.join(ROOT, "assets/fonts/NotoSans-Bold.ttf"));

async function newDoc() {
  const doc = await PDFLib.PDFDocument.create();
  doc.registerFontkit(fontkit);
  return { doc, reg: await doc.embedFont(FONT), bold: await doc.embedFont(FONT_B) };
}

// n pages, each with a "Page k" marker so we can check order after operations.
async function numberedPdf(n, size = [595, 842]) {
  const { doc, reg } = await newDoc();
  for (let i = 1; i <= n; i++) doc.addPage(size).drawText(`Page ${i}`, { x: 60, y: 760, size: 20, font: reg });
  return doc.save();
}

// A document with a known heading and paragraphs (Kazakh + English) for accuracy checks.
const ARTICLE = {
  title: "Қалам PDF сынақ құжаты",
  paragraphs: [
    "Бұл абзац қазақ тіліндегі мәтінді дұрыс тануды тексереді: ә, ғ, қ, ң, ө, ұ, ү, һ, і әріптері сақталуы керек.",
    "The second paragraph is written in English and checks that ordinary Latin text and punctuation survive the conversion.",
    "Үшінші абзац бірнеше жолға созылады, себебі ол өте ұзын. Конвертер жолдарды бір абзацқа біріктіріп, сөздерді бөлмей сақтауы тиіс.",
  ],
};
async function articlePdf() {
  const { doc, reg, bold } = await newDoc();
  const page = doc.addPage([595, 842]);
  let y = 770;
  const tw = bold.widthOfTextAtSize(ARTICLE.title, 22);
  page.drawText(ARTICLE.title, { x: (595 - tw) / 2, y, size: 22, font: bold });
  y -= 50;
  for (const p of ARTICLE.paragraphs) {
    // wrap at ~470pt like a normal document
    const words = p.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (reg.widthOfTextAtSize(test, 11) > 470) { page.drawText(line, { x: 62, y, size: 11, font: reg }); y -= 15; line = w; }
      else line = test;
    }
    page.drawText(line, { x: 62, y, size: 11, font: reg });
    y -= 30;
  }
  return doc.save();
}

// A simple 4x3 table drawn with text only (as most PDF tables are).
const TABLE = [["Аты", "Саны", "Бағасы"], ["Қалам", 12, 150], ["Дәптер", 5, 400], ["Сызғыш", 3, 250]];
async function tablePdf() {
  const { doc, reg } = await newDoc();
  const page = doc.addPage([595, 842]);
  TABLE.forEach((row, r) => row.forEach((cell, c) => page.drawText(String(cell), { x: 60 + c * 150, y: 760 - r * 24, size: 12, font: reg })));
  return doc.save();
}

async function pageTexts(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    out.push(tc.items.map((x) => x.str).join(" ").replace(/\s+/g, " ").trim());
  }
  return out;
}

async function docxText(blob) {
  const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  const xml = await zip.file("word/document.xml").async("string");
  return xml.split("</w:p>").map((p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))
    .map((s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")).filter((s) => s.trim());
}

// word-level accuracy: share of reference words found in order (LCS / reference length)
function wordAccuracy(reference, actual) {
  const a = reference.split(/\s+/).filter(Boolean), b = actual.split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length] / a.length;
}

// one-page PDF with the given lines of text
async function textPdf(text) {
  const { doc, reg } = await newDoc();
  const page = doc.addPage([595, 842]);
  let y = 780;
  for (const line of text.split("\n")) { page.drawText(line, { x: 60, y, size: 11, font: reg }); y -= 16; }
  return doc.save();
}
const CONTRACT_TEXT = "КЕЛІСІМШАРТ № 7\nАлматы қаласы\nЖалға беруші мен Жалға алушы төмендегі шарттар бойынша келісті.\nЖалға беруші кеңсе бөлмесін уақытша пайдалануға береді.\nАйлық төлем 200 000 теңге. Шарт бір жылға жасалады.\nТараптардың қолдары: ____________";

module.exports = { textPdf, CONTRACT_TEXT, Core, FONT, ROOT, numberedPdf, articlePdf, ARTICLE, tablePdf, TABLE, pageTexts, docxText, wordAccuracy, newDoc };
