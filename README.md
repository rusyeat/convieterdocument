# PaperShift v0.1

Free PDF to Word (.docx) converter that runs entirely in the browser. Files are never uploaded.

## Features (v0.1)
- Drag-and-drop or click to upload a PDF (up to 100 MB)
- Keeps paragraphs, headings (by font size), bold/italic, centered lines and page breaks
- Downloads an editable `.docx`

Not yet supported: scanned PDFs (OCR), images, tables. Other tools on the page are marked "soon".

## Run locally
It is a static site. Open `index.html`, or serve the folder:

```
npx serve .
```

## Built with
- [pdf.js](https://mozilla.github.io/pdf.js/) for reading PDFs
- [JSZip](https://stuk.github.io/jszip/) for packaging the .docx
