// Document templates. Official US forms are the blank public-domain PDFs from irs.gov;
// the Kazakh contract and application are generated here with pdf-lib.
(function () {
  const { t, svg, esc } = UI;
  const FORMS = [
    { id: "w9", title: "W-9", desc: "f_w9", cat: "tax", file: "assets/forms/fw9.pdf" },
    { id: "ds11", title: "DS-11", desc: "f_ds11", cat: "apps", url: "https://travel.state.gov/content/travel/en/passports/how-apply/forms.html" },
    { id: "1099", title: "1099-MISC", desc: "f_1099", cat: "tax", file: "assets/forms/f1099msc.pdf" },
    { id: "1040", title: "1040", desc: "f_1040", cat: "tax", file: "assets/forms/f1040.pdf" },
    { id: "contract", titleKey: "f_contract", desc: "f_contract_d", cat: "contracts", gen: "contract" },
    { id: "application", titleKey: "f_app", desc: "f_app_d", cat: "apps", gen: "application" },
  ];
  const title = (f) => (f.titleKey ? t(f.titleKey) : f.title);

  function card(f, big) {
    return `<div class="fcard" data-form="${f.id}"><div class="fthumb"></div><div><b>${esc(title(f))}</b>${big ? `<span class="link">${f.url ? t("external") + " ↗" : t("open_template") + " →"}</span>` : `<span>${t(f.desc)}</span>`}</div>${big ? "" : `<span class="go" style="margin-inline-start:auto;color:#999">${svg("arrow", 'width="18" class="flip"')}</span>`}</div>`;
  }

  // ---------- generated Kazakh templates ----------
  const CONTRACT = [
    ["h1", "ҚЫЗМЕТ КӨРСЕТУ КЕЛІСІМШАРТЫ № ______"],
    ["row", "Қала: ____________________", "«____» ______________ 20___ ж."],
    ["p", "Бұдан әрі «Тапсырыс беруші» деп аталатын ______________________________________ бір тараптан, және бұдан әрі «Орындаушы» деп аталатын ______________________________________ екінші тараптан, төмендегілер туралы осы келісімшартты жасасты:"],
    ["h2", "1. Келісімшарттың мәні"],
    ["p", "1.1. Орындаушы Тапсырыс берушіге келесі қызметтерді көрсетуге міндеттенеді: ____________________________________________________________________________________"],
    ["p", "1.2. Тапсырыс беруші көрсетілген қызметтерді қабылдап, олар үшін төлем жасауға міндеттенеді."],
    ["h2", "2. Тараптардың міндеттері"],
    ["p", "2.1. Орындаушы қызметтерді уақытында және тиісті сапада көрсетеді."],
    ["p", "2.2. Тапсырыс беруші қызметтер үшін төлемді осы келісімшартта белгіленген тәртіппен жасайды."],
    ["h2", "3. Қызмет құны және төлем тәртібі"],
    ["p", "3.1. Қызметтердің жалпы құны: ______________________ теңге."],
    ["p", "3.2. Төлем қызмет көрсетілгеннен кейін ______ банктік күн ішінде жасалады."],
    ["h2", "4. Келісімшарттың қолданылу мерзімі"],
    ["p", "4.1. Осы келісімшарт тараптар қол қойған күннен бастап күшіне енеді және «____» ______________ 20___ ж. дейін қолданылады."],
    ["p", "4.2. Келісімшарт екі данада жасалды, әр тарапқа бір данадан беріледі."],
    ["h2", "5. Тараптардың деректемелері"],
    ["sign", "Тапсырыс беруші", "Орындаушы"],
  ];
  const APPLICATION = [
    ["right", "______________________________ басшысы"],
    ["right", "______________________________ мырзаға/ханымға"],
    ["right", "______________________________ тұратын"],
    ["right", "______________________________ -дан/-ден"],
    ["gap", 40],
    ["h1", "ӨТІНІШ"],
    ["p", "Сізден ___________________________________________________________________________________________________________________________________________________________________________ сұраймын."],
    ["lines", 6],
    ["gap", 30],
    ["row", "«____» ______________ 20___ ж.", "Қолы: ________________"],
  ];

  async function generate(kind) {
    await UI.need("pdflib", "fontkit");
    const doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    const reg = await doc.embedFont(await (await fetch("assets/fonts/NotoSans-Regular.ttf")).arrayBuffer(), { subset: true });
    const bold = await doc.embedFont(await (await fetch("assets/fonts/NotoSans-Bold.ttf")).arrayBuffer(), { subset: true });
    const W = 595.28, H = 841.89, M = 64, CW = W - 2 * M;
    let page = doc.addPage([W, H]), y = H - 72;
    const ink = PDFLib.rgb(0.1, 0.1, 0.1);
    const ensure = (h) => { if (y - h < 60) { page = doc.addPage([W, H]); y = H - 72; } };
    const wrap = (text, font, size) => {
      const words = text.split(" "), lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > CW && cur) { lines.push(cur); cur = w; } else cur = test;
        // break a single over-long word (e.g. a long blank line)
        while (font.widthOfTextAtSize(cur, size) > CW) {
          let k = cur.length; while (k > 1 && font.widthOfTextAtSize(cur.slice(0, k), size) > CW) k--;
          lines.push(cur.slice(0, k)); cur = cur.slice(k);
        }
      }
      if (cur) lines.push(cur);
      return lines;
    };
    const spec = kind === "contract" ? CONTRACT : APPLICATION;
    for (const [type, a, b] of spec) {
      if (type === "h1") { ensure(40); const w = bold.widthOfTextAtSize(a, 15); page.drawText(a, { x: (W - w) / 2, y, size: 15, font: bold, color: ink }); y -= 34; }
      else if (type === "h2") { ensure(30); y -= 6; page.drawText(a, { x: M, y, size: 12, font: bold, color: ink }); y -= 20; }
      else if (type === "p") { for (const line of wrap(a, reg, 11)) { ensure(16); page.drawText(line, { x: M, y, size: 11, font: reg, color: ink }); y -= 16; } y -= 6; }
      else if (type === "row") { ensure(24); page.drawText(a, { x: M, y, size: 11, font: reg, color: ink }); page.drawText(b, { x: W - M - reg.widthOfTextAtSize(b, 11), y, size: 11, font: reg, color: ink }); y -= 28; }
      else if (type === "right") { ensure(18); page.drawText(a, { x: W - M - reg.widthOfTextAtSize(a, 11), y, size: 11, font: reg, color: ink }); y -= 20; }
      else if (type === "gap") y -= a;
      else if (type === "lines") { for (let i = 0; i < a; i++) { ensure(24); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: PDFLib.rgb(0.5, 0.5, 0.5) }); y -= 16; } }
      else if (type === "sign") {
        ensure(170);
        const colW = CW / 2 - 12;
        [a, b].forEach((label, i) => {
          const x = M + i * (colW + 24);
          let yy = y;
          page.drawText(label + ":", { x, y: yy, size: 11, font: bold, color: ink }); yy -= 22;
          for (const f of ["Атауы / Аты-жөні:", "БСН/ЖСН:", "Мекенжайы:", "Телефоны:"]) { page.drawText(f + " ______________", { x, y: yy, size: 10, font: reg, color: ink }); yy -= 20; }
          yy -= 16;
          page.drawLine({ start: { x, y: yy }, end: { x: x + colW - 20, y: yy }, thickness: 0.6, color: ink });
          page.drawText("(қолы)", { x, y: yy - 13, size: 9, font: reg, color: PDFLib.rgb(0.4, 0.4, 0.4) });
        });
        y -= 170;
      }
    }
    return new File([await doc.save()], (kind === "contract" ? "Kelisimshart" : "Otinish") + ".pdf", { type: "application/pdf" });
  }

  async function open(id) {
    const f = FORMS.find((x) => x.id === id);
    if (!f) return;
    if (f.url) { window.open(f.url, "_blank", "noopener"); return; }
    try {
      const file = f.gen ? await generate(f.gen) : new File([await (await fetch(f.file)).arrayBuffer()], f.file.split("/").pop(), { type: "application/pdf" });
      App.openEditor(file, "text");
    } catch (e) { console.error(e); UI.toast(t("err_open")); }
  }

  function renderPage(root) {
    let cat = "all", q = "";
    root.innerHTML = `<section class="page-hero"><div class="wrap"><h1>${t("forms_title")}</h1><p>${t("forms_sub")}</p></div></section>
      <section class="sec" style="padding-top:20px"><div class="wrap">
        <label class="search" style="margin-bottom:16px">${svg("search")}<input id="fq" placeholder="${t("search_form")}"></label>
        <div class="chips" id="fc">${[["all", "fc_all"], ["contracts", "fc_contracts"], ["apps", "fc_apps"], ["tax", "fc_tax"]].map(([k, l]) => `<button class="chip ${k === "all" ? "on" : ""}" data-c="${k}">${t(l)}</button>`).join("")}</div>
        <div class="fgrid big" id="fg"></div></div></section>`;
    const draw = () => {
      const list = FORMS.filter((f) => (cat === "all" || f.cat === cat) && (title(f) + " " + t(f.desc)).toLowerCase().includes(q));
      root.querySelector("#fg").innerHTML = list.map((f) => card(f, true)).join("");
      root.querySelectorAll("[data-form]").forEach((el) => (el.onclick = () => open(el.dataset.form)));
    };
    root.querySelector("#fq").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    root.querySelectorAll("#fc .chip").forEach((b) => (b.onclick = () => { cat = b.dataset.c; root.querySelectorAll("#fc .chip").forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
    draw();
  }

  window.Forms = { FORMS, card, open, renderPage };
})();
