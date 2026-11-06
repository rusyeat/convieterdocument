// End-to-end tests: open the real site in headless Chrome/Edge and use the tools
// like a person would. Needs internet (libraries load from CDN). Run: npm run test:e2e
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const H = require("./helpers");
const { start } = require("./serve");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const BROWSERS = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const exe = BROWSERS.find((p) => p && fs.existsSync(p));

let server, browser, base;
const errors = [];
test.before(async () => {
  server = await start(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
  fs.writeFileSync(path.join(OUT, "a.pdf"), await H.numberedPdf(2));
  fs.writeFileSync(path.join(OUT, "b.pdf"), await H.numberedPdf(3));
  fs.writeFileSync(path.join(OUT, "article.pdf"), await H.articlePdf());
  fs.writeFileSync(path.join(OUT, "contract.pdf"), await H.textPdf(H.CONTRACT_TEXT));
  const docx = await buildDocx([{ type: "p", heading: 1, runs: [{ text: "Word құжаты" }] }, { type: "p", runs: [{ text: "Сынақ мәтіні." }] }]);
  fs.writeFileSync(path.join(OUT, "doc.docx"), Buffer.from(await docx.arrayBuffer()));
});
test.after(async () => { await browser?.close(); server?.close(); });

async function open(hash = "", lang = "kk") {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((l) => localStorage.setItem("qalam.lang", l), lang);
  await page.goto(base + "#/" + hash, { waitUntil: "networkidle0" });
  return page;
}
// newest file in "My files" (IndexedDB)
async function lastSaved(page) {
  const r = await page.evaluate(async () => {
    const [rec] = await Store.all();
    const buf = new Uint8Array(await rec.blob.arrayBuffer());
    let s = ""; for (const x of buf) s += String.fromCharCode(x);
    return { name: rec.name, data: btoa(s) };
  });
  return { name: r.name, bytes: Buffer.from(r.data, "base64") };
}
async function runTool(page, files) {
  const input = await page.waitForSelector("#tf");
  await input.uploadFile(...files.map((f) => path.join(OUT, f)));
  await page.waitForSelector("#go");
  await page.click("#go");
  await page.waitForSelector(".result, .err", { timeout: 60000 });
  return page.$eval(".result .nm, .err", (e) => e.textContent);
}

test("home page renders the design sections with no JS errors", async () => {
  const page = await open();
  assert.match(await page.$eval("h1", (e) => e.textContent), /PDF-пен жұмыс/);
  assert.equal((await page.$$("#tg .tcard")).length, 8);
  assert.equal((await page.$$(".fgrid .fcard")).length, 4);
  assert.equal((await page.$$("#faq details")).length, 3);
  await page.screenshot({ path: path.join(OUT, "home.png"), fullPage: true });
  await page.close();
  assert.deepEqual(errors, []);
});

test("Arabic switches the whole layout to right-to-left", async () => {
  const page = await open("", "ar");
  assert.equal(await page.$eval("html", (e) => e.dir), "rtl");
  await page.close();
});

test("language picker changes the interface language", async () => {
  const page = await open();
  await page.click("#langBtn");
  await page.click('[data-l="ru"]');
  assert.match(await page.$eval("#menu", (e) => e.textContent), /Инструменты/);
  await page.close();
});

test("merge tool joins two PDFs in order", async () => {
  const page = await open("tool/merge");
  assert.equal(await runTool(page, ["a.pdf", "b.pdf"]), "merged.pdf");
  assert.deepEqual(await H.pageTexts((await lastSaved(page)).bytes), ["Page 1", "Page 2", "Page 1", "Page 2", "Page 3"]);
  await page.close();
});

test("PDF → Word through the UI", async () => {
  const page = await open("tool/pdf_word");
  assert.equal(await runTool(page, ["article.pdf"]), "article.docx");
  const paras = await H.docxText(new Blob([(await lastSaved(page)).bytes]));
  assert.equal(paras[0], H.ARTICLE.title);
  await page.close();
});

test("Word → PDF through the UI", async () => {
  const page = await open("tool/word_pdf");
  assert.equal(await runTool(page, ["doc.docx"]), "doc.pdf");
  assert.ok((await PDFLib.PDFDocument.load((await lastSaved(page)).bytes)).getPageCount() >= 1);
  await page.close();
});

test("PDF → JPG gives a zip with one image per page", async () => {
  const page = await open("tool/pdf_jpg");
  assert.equal(await runTool(page, ["b.pdf"]), "b-jpg.zip");
  const zip = await JSZip.loadAsync((await lastSaved(page)).bytes);
  assert.equal(Object.keys(zip.files).length, 3);
  await page.close();
});

test("compress keeps page count", async () => {
  const page = await open("tool/compress");
  assert.equal(await runTool(page, ["b.pdf"]), "b-compressed.pdf");
  assert.equal((await PDFLib.PDFDocument.load((await lastSaved(page)).bytes)).getPageCount(), 3);
  await page.close();
});

test("delete pages: click a thumbnail, page disappears", async () => {
  const page = await open("tool/delete");
  await (await page.waitForSelector("#tf")).uploadFile(path.join(OUT, "b.pdf"));
  await page.waitForSelector(".thumb");
  await page.click(".thumb:nth-child(2)");
  await page.click("#go");
  await page.waitForSelector(".result");
  assert.deepEqual(await H.pageTexts((await lastSaved(page)).bytes), ["Page 1", "Page 3"]);
  await page.close();
});

test("AI document classifier recognises a contract and suggests tools", async () => {
  const page = await open("tool/ai_classify");
  await (await page.waitForSelector("#tf")).uploadFile(path.join(OUT, "contract.pdf"));
  await page.click("#go");
  await page.waitForSelector(".ai-result", { timeout: 30000 });
  assert.equal(await page.$eval(".ai-result", (e) => e.dataset.label), "contract");
  assert.ok((await page.$$(".ai-result .tcard")).length >= 2, "suggested tools shown");
  await page.screenshot({ path: path.join(OUT, "ai.png") });
  await page.close();
});

test("editor: add Kazakh text and save it into the PDF", async () => {
  const page = await open("editor");
  await (await page.waitForSelector("#pdfIn")).uploadFile(path.join(OUT, "a.pdf"));
  await page.waitForSelector(".ed-layer");
  await page.click('[data-tool="text"]');
  const box = await (await page.$(".ed-layer")).boundingBox();
  await page.mouse.click(box.x + 100, box.y + 200);
  await page.keyboard.type("Сәлем, әлем!");
  await page.click(".ed-props h4"); // blur -> commit text
  await page.click("#save");
  await page.waitForFunction(async () => (await Store.all()).some((r) => r.name === "a-edited.pdf"), { timeout: 30000 });
  const texts = await H.pageTexts((await lastSaved(page)).bytes);
  assert.match(texts[0], /Сәлем, әлем!/);
  await page.screenshot({ path: path.join(OUT, "editor.png") });
  await page.close();
});

test("forms: the Kazakh contract template opens in the editor", async () => {
  const page = await open("forms");
  await page.click('[data-form="contract"]');
  await page.waitForSelector(".ed-page", { timeout: 30000 });
  assert.match(await page.$eval("#fn", (e) => e.textContent), /Kelisimshart\.pdf/);
  await page.close();
});

test("mobile width has no horizontal scroll", async () => {
  const page = await open();
  await page.setViewport({ width: 375, height: 800 });
  await new Promise((r) => setTimeout(r, 300));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: path.join(OUT, "mobile.png"), fullPage: true });
  assert.ok(overflow <= 0, "overflow " + overflow);
  await page.close();
});

test("no uncaught JS errors on any page", () => assert.deepEqual(errors, []));
