// App shell: header, footer, router and the main pages.
(function () {
  const { t, svg, ico, esc, size, ext } = UI;
  const REPO = "https://github.com/rusyeat/convieterdocument";
  const App = { pendingFiles: null, editorFile: null };
  window.App = App;
  const $app = document.getElementById("app");

  // ---------- header / footer ----------
  function header() {
    const toolLinks = Tools.TOOLS.map((x) => `<a href="#/tool/${x.id}">${ico(x.icon, x.tint)}${t("t_" + x.id)}</a>`).join("");
    document.getElementById("hdr").innerHTML = `<div class="wrap hdr-in">
      <a class="logo" href="#/">${UI.logo}<span>Qalam PDF</span></a>
      <nav class="menu" id="menu">
        <div class="dd" id="dd"><button type="button">${t("nav_tools")} ${svg("chevron", 'width="14"')}</button><div class="dd-panel">${toolLinks}</div></div>
        <a href="#/editor" data-nav="editor">${t("nav_editor")}</a>
        <a href="#/forms" data-nav="forms">${t("nav_forms")}</a>
        <a href="#/pricing" data-nav="pricing">${t("nav_pricing")}</a>
        <a href="#/files" data-nav="files">${t("nav_files")}</a>
      </nav>
      <div class="hdr-right">
        ${UI.themeButton()}
        <button class="pill-btn" id="langBtn">${svg("globe", 'width="16"')} ${UI.esc(LANG_CODE[UI.lang])} ${svg("chevron", 'width="14"')}</button>
        <button class="pill-btn login-btn" id="loginBtn">${t("nav_login")}</button>
        <button class="burger" id="burger" aria-label="menu">${svg("menu", 'width="24"')}</button>
      </div></div>`;
    const dd = document.getElementById("dd");
    dd.querySelector("button").onclick = (e) => { e.stopPropagation(); dd.classList.toggle("open"); };
    document.addEventListener("click", () => dd.classList.remove("open"));
    document.getElementById("burger").onclick = () => document.getElementById("menu").classList.toggle("open");
    document.getElementById("langBtn").onclick = langModal;
    document.getElementById("loginBtn").onclick = loginModal;
  }

  function footer() {
    const tl = ["pdf_word", "word_pdf", "pdf_excel", "pdf_jpg"].map((id) => `<li><a href="#/tool/${id}">${t("t_" + id)}</a></li>`).join("");
    const fl = Forms.FORMS.slice(0, 4).map((f) => `<li><a href="#/forms">${esc(f.title || t(f.titleKey))}</a></li>`).join("");
    document.getElementById("ftr").innerHTML = `<div class="wrap"><div class="ftr-grid">
      <div><a class="logo" href="#/">${UI.logo}<span>Qalam PDF</span></a><p class="muted small" style="max-width:260px">${t("foot_tagline")}</p></div>
      <div><h4>${t("nav_tools")}</h4><ul>${tl}</ul></div>
      <div><h4>${t("nav_forms")}</h4><ul>${fl}</ul></div>
      <div><h4>${t("foot_help")}</h4><ul><li><a href="#/" data-faq>${t("foot_faq")}</a></li><li><a href="${REPO}#k2-деректер-дереккөздер-және-қауіпсіздік" target="_blank" rel="noopener">${t("foot_privacy")}</a></li><li><a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">${t("foot_terms")}</a></li></ul></div>
      <div><h4>${t("foot_about")}</h4><ul><li><a href="${REPO}" target="_blank" rel="noopener">GitHub</a></li><li>${t("foot_about_text")}</li><li>v0.1</li></ul></div>
    </div><div class="ftr-bottom"><span>© 2026 Qalam PDF. ${t("rights")}</span><span>${t("trust_text")}</span></div></div>`;
    document.querySelector("[data-faq]").onclick = (e) => { e.preventDefault(); if (location.hash !== "#/" && location.hash !== "") { App.scrollFaq = true; location.hash = "#/"; } else document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); };
  }

  // ---------- modals ----------
  function modal(inner) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog">${inner}</div>`;
    bg.onclick = (e) => { if (e.target === bg || e.target.closest("[data-close]")) bg.remove(); };
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { bg.remove(); document.removeEventListener("keydown", esc); } });
    document.body.appendChild(bg);
    return bg;
  }
  function langModal() {
    const m = modal(`<div class="modal-head"><h3 style="margin:0">${t("choose_lang")}</h3><button class="icon-btn" data-close>${svg("close")}</button></div>
      <label class="search">${svg("search")}<input id="lq" placeholder="${t("search_lang")}"></label><div class="lang-grid" id="lg"></div>`);
    const draw = (q) => {
      m.querySelector("#lg").innerHTML = LANG_ORDER.filter((c) => I18N[c]._name.toLowerCase().includes(q)).map((c) => `<button data-l="${c}" class="${c === UI.lang ? "on" : ""}">${I18N[c]._name}</button>`).join("");
      m.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => { m.remove(); setLang(b.dataset.l); }));
    };
    m.querySelector("#lq").oninput = (e) => draw(e.target.value.trim().toLowerCase());
    draw("");
  }
  function loginModal() {
    const m = modal(`<div class="modal-head"><a class="logo" href="#/" data-close>${UI.logo}<span>Qalam PDF</span></a><button class="icon-btn" data-close>${svg("close")}</button></div>
      <h2>${t("welcome")}</h2>
      <form id="lf"><div class="field"><label>${t("email")}</label><div class="inp">${svg("mail")}<input type="email" placeholder="${t("email_ph")}" autocomplete="off"></div></div>
      <div class="field"><label>${t("password")}</label><div class="inp">${svg("lock")}<input type="password" id="pw" placeholder="${t("password_ph")}" autocomplete="off"><button type="button" class="icon-btn" id="eye">${svg("eye")}</button></div></div>
      <p style="text-align:end;margin:0 0 16px"><a class="link small" href="#" id="fg">${t("forgot")}</a></p>
      <button class="btn btn-primary btn-lg" style="width:100%">${t("login_btn")}</button>
      <p style="text-align:center;margin:16px 0 0"><a class="link" href="#" id="rg">${t("register")}</a></p></form>`);
    // Accounts are not part of v0.1: nothing typed here is stored or sent.
    const soon = (e) => { e.preventDefault(); m.remove(); UI.toast(t("soon_toast")); };
    m.querySelector("#lf").onsubmit = soon; m.querySelector("#fg").onclick = soon; m.querySelector("#rg").onclick = soon;
    m.querySelector("#eye").onclick = () => { const p = m.querySelector("#pw"); p.type = p.type === "password" ? "text" : "password"; };
  }
  function setLang(code) { UI.setLang(code); header(); footer(); route(); }

  // ---------- home ----------
  function routeByExt(files) {
    const e = ext(files[0].name);
    const id = e === "pdf" ? "pdf_word" : e === "docx" ? "word_pdf" : ["xlsx", "xls", "csv", "ods"].includes(e) ? "excel_pdf" : ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(e) ? "jpg_pdf" : null;
    if (!id) { UI.toast(t("err_type")); return; }
    App.pendingFiles = [...files];
    location.hash = "#/tool/" + id;
  }
  function toolGrid(cat, q) {
    const list = cat === "popular" && !q ? Tools.POPULAR.map((id) => Tools.byId[id]) : Tools.TOOLS.filter((x) => (cat === "all" || cat === "popular" || x.cats.includes(cat)) && (t("t_" + x.id) + " " + t("d_" + x.id)).toLowerCase().includes(q));
    return list.map((x) => Tools.card(x)).join("");
  }
  function home() {
    $app.innerHTML = `
    <section class="hero"><div class="wrap">
      <h1>${t("hero_title")}</h1><p class="sub">${t("hero_sub")}</p>
      <div class="drop" id="hdz"><div class="drop-in">${UI.art}<div class="drop-sep"></div><div class="drop-cta">
        <button class="btn btn-primary btn-lg" id="pick">${svg("upload", 'width="20"')} ${t("choose_file")}</button>
        <p class="muted">${t("or_drop")}</p><p class="muted small">${t("formats")}</p></div></div></div>
      <div class="quick"><a href="#/tool/pdf_word">${svg("rotate", 'width="18"')} ${t("q_convert")}</a><a href="#/editor">${svg("pencil", 'width="18"')} ${t("q_edit")}</a><a href="#/tool/sign">${svg("sign", 'width="18"')} ${t("q_sign")}</a></div>
      <input type="file" id="hf" accept=".pdf,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp" multiple hidden>
    </div></section>
    <section class="sec"><div class="wrap">
      <div class="sec-head"><h2>${t("all_tools")}</h2><label class="search">${svg("search")}<input id="tq" placeholder="${t("search_tool")}"></label></div>
      <div class="chips" id="tc">${[["popular", "cat_popular"], ["from", "cat_from"], ["to", "cat_to"], ["images", "cat_images"], ["other", "cat_other"]].map(([k, l]) => `<button class="chip ${k === "popular" ? "on" : ""}" data-c="${k}">${t(l)}</button>`).join("")}</div>
      <div class="tgrid" id="tg">${toolGrid("popular", "")}</div>
      <p style="text-align:center;margin-top:16px"><a class="link" href="#/tools">${t("all_tools")} →</a></p>
    </div></section>
    <section class="wrap"><div class="trust">${shieldArt()}<div><h3>${t("trust_title")}</h3><p>${t("trust_text")}</p></div></div>
      <div class="ai-banner">${ico("ai", "purple")}<div><h3>${t("ai_banner_t")} <i class="badge badge-ai" style="position:static">AI</i></h3><p>${t("ai_banner_d")}</p></div><a class="btn btn-primary" href="#/tool/ai_classify">${t("ai_try")} ${svg("arrow", 'width="16" class="flip"')}</a></div></section>
    <section class="sec"><div class="wrap">
      <div class="sec-head"><h2>${t("ready_forms")}</h2><a class="link" href="#/forms">${t("all_forms")} ${svg("arrow", 'width="16" class="flip"')}</a></div>
      <div class="fgrid">${Forms.FORMS.slice(0, 4).map((f) => Forms.card(f)).join("")}</div>
    </div></section>
    <section class="sec" style="padding-top:0"><div class="wrap">
      <h2 style="font-size:1.6rem;margin-bottom:18px">${t("steps_title")}</h2>
      <div class="steps">${[1, 2, 3].map((n) => `<div class="step"><span class="num">0${n}</span><div><b>${t("step" + n + "_t")}</b><p>${t("step" + n + "_d")}</p></div></div>`).join("")}</div>
      <div class="feats">${[["bolt", 1], ["layers", 2], ["device", 3]].map(([i, n]) => `<div class="feat">${svg(i)}<div><b>${t("feat" + n + "_t")}</b><p>${t("feat" + n + "_d")}</p></div></div>`).join("")}</div>
    </div></section>
    <section class="sec" id="faq" style="padding-top:0"><div class="wrap faq"><h2>${t("faq_title")}</h2><div>
      ${[1, 2, 3].map((n) => `<details><summary>${t("faq" + n + "_q")}</summary><p>${t("faq" + n + "_a")}</p></details>`).join("")}
    </div></div></section>`;
    const input = document.getElementById("hf");
    input.onchange = () => { if (input.files.length) routeByExt(input.files); };
    Tools.bindDrop(document.getElementById("hdz"), routeByExt, () => input.click());
    let cat = "popular", q = "";
    const draw = () => (document.getElementById("tg").innerHTML = toolGrid(cat, q));
    document.getElementById("tq").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    document.querySelectorAll("#tc .chip").forEach((b) => (b.onclick = () => { cat = b.dataset.c; document.querySelectorAll("#tc .chip").forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
    document.querySelectorAll("[data-form]").forEach((el) => (el.onclick = () => Forms.open(el.dataset.form)));
    if (App.scrollFaq) { App.scrollFaq = false; setTimeout(() => document.getElementById("faq").scrollIntoView(), 50); }
  }
  const shieldArt = () => `<svg viewBox="0 0 90 90"><rect x="44" y="14" width="36" height="46" rx="5" fill="#fff" stroke="#d9d2ff"/><rect x="50" y="24" width="22" height="3" rx="1.5" fill="#d9d2ff"/><rect x="50" y="32" width="18" height="3" rx="1.5" fill="#d9d2ff"/><path d="M38 12 62 22v20c0 16-11 27-24 32C25 69 14 58 14 42V22z" fill="#7b63ff"/><path d="m27 42 8 8 15-16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 18l-4-5M12 10 10 3" stroke="#5236ec" stroke-width="3" stroke-linecap="round"/></svg>`;

  // ---------- all tools ----------
  function toolsPage(cat) {
    cat = cat || "all";
    const cats = [["all", "grid", "cat_all"], ["from", "arrow", "cat_from_long"], ["to", "back", "cat_to_long"], ["edit", "pencil", "cat_edit"], ["pages", "layers", "cat_pages"], ["images", "image", "cat_images"], ["other", "ocr", "cat_other"]];
    $app.innerHTML = `<section class="page-hero"><div class="wrap"><h1>${t("all_tools_title")}</h1><p>${t("all_tools_sub")}</p></div></section>
      <div class="wrap side-layout"><nav class="side">${cats.map(([k, i, l]) => `<a href="#/tools/${k}" class="${k === cat ? "on" : ""}">${svg(i, k === "from" ? 'class="flip"' : "")}${t(l)}</a>`).join("")}</nav>
      <div><label class="search" style="margin-bottom:16px">${svg("search")}<input id="tq" placeholder="${t("search_tool")}"></label><div class="tgrid compact" id="tg"></div></div></div>`;
    const draw = (q) => {
      const list = Tools.TOOLS.filter((x) => (cat === "all" || x.cats.includes(cat)) && t("t_" + x.id).toLowerCase().includes(q));
      document.getElementById("tg").innerHTML = list.map((x) => Tools.card(x, true)).join("");
    };
    document.getElementById("tq").oninput = (e) => draw(e.target.value.trim().toLowerCase());
    draw("");
  }

  // ---------- my files ----------
  async function filesPage(tab) {
    tab = tab || "all";
    const side = [["all", "folder", "my_files", "#/files"], ["fav", "star", "favorites", "#/files/fav"], ["tariff", "layers", "tariff", "#/pricing"], ["settings", "gear", "settings", "#/files/settings"]];
    $app.innerHTML = `<div class="wrap side-layout"><nav class="side">${side.map(([k, i, l, h]) => `<a href="${h}" class="${k === tab ? "on" : ""}">${svg(i)}${t(l)}</a>`).join("")}</nav><div id="fm"></div></div>`;
    const fm = document.getElementById("fm");
    const langPanel = `<div class="panel"><label>${t("ui_lang")}</label><select id="ls">${LANG_ORDER.map((c) => `<option value="${c}" ${c === UI.lang ? "selected" : ""}>${I18N[c]._name}</option>`).join("")}</select></div>`;
    if (tab === "settings") {
      fm.innerHTML = `<h1 style="font-size:1.8rem">${t("settings")}</h1><div style="max-width:360px">${langPanel}<p class="muted small">${t("files_local")}</p></div>`;
      document.getElementById("ls").onchange = (e) => setLang(e.target.value);
      return;
    }
    let q = "";
    const all = await Store.all();
    const draw = () => {
      const list = all.filter((f) => (tab !== "fav" || f.fav) && f.name.toLowerCase().includes(q));
      const rows = list.map((f) => `<tr><td><span class="nmcell">${UI.fileIco(f.type)}<span>${esc(f.name)}</span></span></td><td class="hide-m">${f.type.toUpperCase()}</td><td class="hide-m">${f.date.slice(0, 10)}</td>
        <td style="white-space:nowrap"><button class="icon-btn" data-dl="${f.id}" title="${t("download")}">${svg("download")}</button><button class="icon-btn" data-fav="${f.id}" title="${t("fav")}" style="${f.fav ? "color:#f0a020" : ""}">${svg("star", f.fav ? 'fill="currentColor"' : "")}</button>${f.type === "pdf" ? `<button class="icon-btn" data-open="${f.id}" title="${t("open")}">${svg("pencil")}</button>` : ""}<button class="icon-btn" data-del="${f.id}" title="${t("del")}">${svg("trash")}</button></td></tr>`).join("");
      fm.innerHTML = `<div class="files-grid"><div>
          <h1 style="font-size:1.8rem">${t(tab === "fav" ? "favorites" : "my_files")}</h1>
          <div class="files-bar"><button class="btn btn-primary" id="add">${svg("upload", 'width="18"')} ${t("add_file")}</button><label class="search" style="flex:1">${svg("search")}<input id="sq" value="${esc(q)}" placeholder="${t("search_doc")}"></label></div>
          ${list.length ? `<table class="tbl"><thead><tr><th>${t("col_name")}</th><th class="hide-m">${t("col_format")}</th><th class="hide-m">${t("col_date")}</th><th>${t("col_action")}</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
        </div><div>${langPanel}<div class="panel" style="text-align:center">${folderArt()}<p class="muted small" style="margin:8px 0 0">${t("files_info")}</p><p class="muted small">${t("files_local")}</p></div></div></div>
        ${list.length ? "" : `<div class="empty">${docArt()}<div><h3>${tab === "fav" ? t("no_favs") : t("no_files")}</h3><p class="muted">${t("no_files_d")}</p><button class="btn btn-primary" id="add2">${svg("upload", 'width="18"')} ${t("choose_file")}</button></div></div>`}
        <input type="file" id="fi" multiple hidden>`;
      const fi = document.getElementById("fi");
      fi.onchange = async () => { for (const f of fi.files) await Store.add(f.name, f); filesPage(tab); };
      document.getElementById("add").onclick = () => fi.click();
      const a2 = document.getElementById("add2"); if (a2) a2.onclick = () => fi.click();
      const sq = document.getElementById("sq");
      sq.oninput = (e) => { q = e.target.value.toLowerCase(); draw(); const n = document.getElementById("sq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      document.getElementById("ls").onchange = (e) => setLang(e.target.value);
      const find = (id) => all.find((f) => f.id === id);
      fm.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => { const f = find(b.dataset.dl); UI.save(f.blob, f.name); }));
      fm.querySelectorAll("[data-fav]").forEach((b) => (b.onclick = async () => { await Store.toggleFav(b.dataset.fav); const f = find(b.dataset.fav); f.fav = !f.fav; draw(); }));
      fm.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { const f = find(b.dataset.open); App.openEditor(new File([f.blob], f.name, { type: "application/pdf" }), "text"); }));
      fm.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { await Store.remove(b.dataset.del); all.splice(all.findIndex((f) => f.id === b.dataset.del), 1); draw(); }));
    };
    draw();
  }
  const folderArt = () => `<svg viewBox="0 0 120 90" width="120"><path d="M14 22a6 6 0 0 1 6-6h26l8 8h46a6 6 0 0 1 6 6v44a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#d9d2ff"/><rect x="30" y="18" width="50" height="40" rx="4" fill="#fff" stroke="#e3e5ef"/><path d="M10 38a6 6 0 0 1 6-6h88a6 6 0 0 1 6 6l-4 36a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="#a99bff"/><path d="M96 10l4-7M104 16l8-3" stroke="#5236ec" stroke-width="3" stroke-linecap="round"/></svg>`;
  const docArt = () => `<svg viewBox="0 0 110 110"><g transform="rotate(-10 55 55)"><rect x="24" y="16" width="60" height="78" rx="6" fill="#efecfe" stroke="#c9c0fb"/>${[34, 44, 54, 64, 74].map((y) => `<rect x="34" y="${y}" width="${y % 20 ? 40 : 32}" height="4" rx="2" fill="#c9c0fb"/>`).join("")}</g><path d="M84 12l3-8M92 18l7-4" stroke="#5236ec" stroke-width="3" stroke-linecap="round"/></svg>`;

  // ---------- pricing ----------
  function pricingPage() {
    let yearly = false;
    const draw = () => {
      const per = yearly ? t("per_year") : t("per_month");
      const plans = [["plan_basic", ["pf_convert", "pf_edit"], false], ["plan_personal", ["pf_convert", "pf_edit", "pf_manage"], true], ["plan_team", ["pf_convert", "pf_manage"], false]];
      $app.innerHTML = `<section class="page-hero" style="padding-bottom:12px"><div class="wrap"><h1>${t("pricing_title")}</h1></div></section>
        <section class="sec" style="padding-top:12px;text-align:center"><div class="wrap">
          <div class="toggle"><button class="${yearly ? "" : "on"}" data-y="0">${t("monthly")}</button><button class="${yearly ? "on" : ""}" data-y="1">${t("yearly")}</button></div>
          <div class="plans">${plans.map(([n, feats, hl]) => `<div class="plan ${hl ? "hl" : ""}"><h3>${t(n)}</h3><div class="price">— ₸ <small>${per}</small></div><ul>${feats.map((f) => `<li>${t(f)}</li>`).join("")}</ul><button class="btn ${hl ? "btn-primary" : "btn-outline"}" data-choose>${t("choose")}</button></div>`).join("")}</div>
          <p class="note-box">${t("free_now")}</p></div></section>`;
      $app.querySelectorAll("[data-y]").forEach((b) => (b.onclick = () => { yearly = b.dataset.y === "1"; draw(); }));
      $app.querySelectorAll("[data-choose]").forEach((b) => (b.onclick = () => UI.toast(t("free_now"))));
    };
    draw();
  }

  // ---------- router ----------
  App.openEditor = (file, mode) => {
    App.editorFile = { file, mode };
    if (location.hash === "#/editor") route(); else location.hash = "#/editor";
  };
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
    const [page, arg] = parts;
    document.getElementById("menu")?.classList.remove("open");
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === page));
    // the editor has its own top bar (as in the design), so the site header/footer hide there
    document.getElementById("ftr").style.display = page === "editor" ? "none" : "";
    document.getElementById("hdr").style.display = page === "editor" ? "none" : "";
    document.onkeydown = null;
    window.scrollTo(0, 0);
    if (page === "tool") Tools.renderToolPage($app, arg);
    else if (page === "tools") toolsPage(arg);
    else if (page === "editor") { const ef = App.editorFile; App.editorFile = null; Editor.render($app, ef && ef.file, ef ? ef.mode : null); }
    else if (page === "forms") Forms.renderPage($app);
    else if (page === "files") filesPage(arg);
    else if (page === "pricing") pricingPage();
    else home();
  }

  UI.setLang(UI.lang);
  header();
  footer();
  window.addEventListener("hashchange", route);
  route();
})();
