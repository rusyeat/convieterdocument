// Minimal .docx builder. Takes a list of blocks and returns a Blob.
// Block: { type: "p", runs: [{ text, size, bold, italic }], align, heading } | { type: "pagebreak" }
(function () {
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      // drop characters that are invalid in XML 1.0
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
  }

  function runXml(r) {
    let pr = "";
    if (r.bold) pr += "<w:b/>";
    if (r.italic) pr += "<w:i/>";
    if (r.size) pr += `<w:sz w:val="${Math.round(r.size * 2)}"/><w:szCs w:val="${Math.round(r.size * 2)}"/>`;
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
  }

  function blockXml(b) {
    if (b.type === "pagebreak") return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    let ppr = "";
    if (b.heading) ppr += `<w:pStyle w:val="Heading${b.heading}"/>`;
    ppr += `<w:spacing w:after="${b.after ?? 120}"/>`;
    if (b.align && b.align !== "left") ppr += `<w:jc w:val="${b.align === "center" ? "center" : b.align === "right" ? "right" : "both"}"/>`;
    return `<w:p><w:pPr>${ppr}</w:pPr>${b.runs.map(runXml).join("")}</w:p>`;
  }

  const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const heading = (n, sz) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${heading(1, 36)}${heading(2, 28)}${heading(3, 24)}
</w:styles>`;

  async function buildDocx(blocks, pageSize) {
    const w = Math.round((pageSize?.width || 595) * 20);
    const h = Math.round((pageSize?.height || 842) * 20);
    const body = blocks.map(blockXml).join("");
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CT);
    zip.file("_rels/.rels", RELS);
    zip.file("word/_rels/document.xml.rels", DOC_RELS);
    zip.file("word/document.xml", doc);
    zip.file("word/styles.xml", STYLES);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  window.buildDocx = buildDocx;
})();
