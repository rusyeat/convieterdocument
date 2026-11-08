(function () {
  const copy = {
    kk: {title:'Qalam көмекші',open:'Көмекшімен сөйлесу',close:'Жабу',clear:'Тазалау',placeholder:'Сұрағыңызды жазыңыз…',send:'Жіберу',hello:'Сәлем! PDF түрлендіру, біріктіру және өңдеу бойынша көмектесемін.',notice:'Дайын PDF нұсқаулықтары. Чат браузерде жұмыс істейді; хабарламалар серверге жіберілмейді.',wait:'Жауап дайындап жатырмын…',error:'Қазір жауап алу мүмкін болмады. Қайта жіберіп көріңіз.',limit:'Сұрау лимиті бітті. Кейінірек қайталаңыз.',setup:'Көмекші сервері әлі қосылмаған.',suggest:['PDF-ті Word-қа қалай айналдырамын?','PDF файлдарын қалай біріктіремін?','Құжатқа қалай қол қоямын?']},
    ru: {title:'Помощник Qalam',open:'Открыть помощника',close:'Закрыть',clear:'Очистить',placeholder:'Напишите вопрос…',send:'Отправить',hello:'Привет! Помогу с конвертацией, объединением и редактированием PDF.',notice:'Готовые инструкции по PDF. Чат работает в браузере; сообщения не отправляются на сервер.',wait:'Готовлю ответ…',error:'Не удалось получить ответ. Попробуйте отправить снова.',limit:'Достигнут лимит запросов. Попробуйте позже.',setup:'Сервер помощника ещё не подключён.',suggest:['Как перевести PDF в Word?','Как объединить PDF?','Как подписать документ?']},
    en: {title:'Qalam assistant',open:'Open assistant',close:'Close',clear:'Clear',placeholder:'Ask a question…',send:'Send',hello:'Hi! I can help with PDF conversion, merging and editing.',notice:'Prepared PDF guides. Chat runs in your browser; messages are not sent to a server.',wait:'Preparing a reply…',error:'Could not get a reply. Please send again.',limit:'Request limit reached. Please try later.',setup:'The assistant server is not connected yet.',suggest:['How do I convert PDF to Word?','How do I merge PDFs?','How do I sign a document?']}
  };
  let history = [];
  const getCopy = () => copy[window.UI?.lang] || copy.en;
  const host = document.createElement('div'); host.className='qa-host';
  const launch = document.createElement('button');launch.type='button';launch.className='qa-launch';launch.textContent='✦';launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-controls','qa-panel');
  const panel = document.createElement('section');panel.id='qa-panel';panel.className='qa-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','qa-title');
  panel.innerHTML='<header class="qa-head"><strong id="qa-title"></strong><button type="button" class="qa-clear"></button><button type="button" class="qa-close">×</button></header><p class="qa-notice"></p><div class="qa-log" role="log" aria-live="polite" aria-relevant="additions text"></div><div class="qa-suggest"></div><p class="qa-status" role="status"></p><form class="qa-form"><label class="qa-input-label" for="qa-input"></label><textarea id="qa-input" rows="2" maxlength="3000" required></textarea><button class="qa-send" type="submit"></button></form>';
  host.append(panel,launch);document.body.appendChild(host);
  const q = s=>panel.querySelector(s), input=q('textarea'), log=q('.qa-log'), status=q('.qa-status');
  function message(role,text) {const el=document.createElement('div');el.className='qa-message qa-'+role;el.textContent=text;log.appendChild(el);log.scrollTop=log.scrollHeight;}
  function labels() {
    const t=getCopy();launch.setAttribute('aria-label',t.open);q('#qa-title').textContent=t.title;q('.qa-clear').textContent=t.clear;q('.qa-close').setAttribute('aria-label',t.close);q('.qa-notice').textContent=t.notice;input.placeholder=t.placeholder;q('.qa-input-label').textContent=t.placeholder;q('.qa-send').textContent=t.send;
    const suggestions=q('.qa-suggest');suggestions.replaceChildren();
    if(!history.length) for(const text of t.suggest){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{input.value=text;input.focus()};suggestions.appendChild(b)}
  }
  function open(value){panel.hidden=!value;launch.setAttribute('aria-expanded',String(value));if(value){labels();if(!log.children.length)message('assistant',getCopy().hello);input.focus()}else launch.focus()}
  launch.onclick=()=>open(panel.hidden);q('.qa-close').onclick=()=>open(false);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')open(false)});
  q('.qa-clear').onclick=()=>{history=[];log.replaceChildren();message('assistant',getCopy().hello);status.textContent='';labels();input.focus()};
  function answer(question, lang) {
    const language = ['kk','ru','en'].includes(lang) ? lang : 'en';
    const text = question.toLowerCase().normalize('NFKC');
    const say = (kk,ru,en) => ({kk,ru,en})[language];
    const go = (route,kk,ru,en) => ({text:say(kk,ru,en),route});
    if (/қол|кол ко|подпис|signature|\bsign\b/.test(text)) return go('#/tool/sign','Құжатқа қол қою: құралды ашып, PDF таңдаңыз. Қолтаңбаңызды салып, құжатқа орналастырыңыз да, нәтижені сақтаңыз.','Откройте подписание PDF, выберите файл, нарисуйте подпись, разместите её на странице и сохраните результат.','Open Sign PDF, choose a PDF, draw and place your signature, then save the result.');
    if (/бірікт|бирик|қосып|объедин|скле|merge|combine/.test(text)) return go('#/tool/merge','PDF біріктіру құралын ашып, бірнеше файл таңдаңыз. Қажетті ретті орнатып, біріктіруді бастаңыз және нәтижені жүктеңіз.','Выберите несколько файлов в инструменте объединения PDF, задайте порядок, объедините и скачайте результат.','Choose multiple files in Merge PDF, arrange them, merge and download the result.');
    if (/қы[сc]|кыс|көлем|колем|сжа|уменьш|compress|smaller/.test(text)) return go('#/tool/compress','PDF қысу құралында файлды таңдаңыз, қысуды бастаңыз және дайын PDF-ті жүктеңіз.','Откройте сжатие PDF, выберите файл, запустите сжатие и скачайте результат.','Open Compress PDF, select a file, run compression and download the result.');
    const word=/word|ворд|docx/.test(text), pdf=/pdf|пдф/.test(text);
    if(word && pdf) {
      const toPdf=/(word|ворд|docx).{0,30}(pdf|пдф)/.test(text);
      return toPdf ? go('#/tool/word_pdf','Word → PDF құралын ашып, DOCX файлын таңдаңыз. Түрлендіріп, дайын PDF-ті жүктеңіз.','Откройте Word → PDF, выберите DOCX, запустите преобразование и скачайте PDF.','Open Word → PDF, select a DOCX file, convert and download the PDF.') : go('#/tool/pdf_word','PDF → Word құралын ашып, PDF таңдаңыз. Түрлендіріп, DOCX нәтижесін жүктеңіз. Сканерленген файл үшін мәтінді тану қажет болуы мүмкін.','Откройте PDF → Word, выберите PDF, запустите преобразование и скачайте DOCX. Для скана может понадобиться распознавание текста.','Open PDF → Word, select a PDF, convert and download the DOCX. A scan may require text recognition.');
    }
    if (/редакт|өңде|онде|өзгерт|измен|edit/.test(text)) return go('#/editor','Редакторды ашып, PDF жүктеңіз. Қажетті құралды таңдап, өзгерістер енгізіңіз, кейін сақтау батырмасын басыңыз.','Откройте редактор и выберите PDF. Внесите изменения нужным инструментом, затем сохраните документ.','Open the editor, choose a PDF, make your changes and save the document.');
    if (/шаблон|үлгі|улги|template|форма/.test(text)) return go('#/forms','Дайын үлгілер бөлімінен құжатты таңдап, редакторда толтырыңыз.','Выберите документ в разделе шаблонов и заполните его в редакторе.','Choose a document in Templates and fill it in using the editor.');
    if (/сақта|сакта|жүкте|жукте|скача|сохран|download|saved/.test(text)) return go('#/files','Өңдеу аяқталғанда жүктеу батырмасын басыңыз. Сақталған нәтижелер «Менің файлдарым» бөлімінде болуы мүмкін; олар осы браузерде сақталады.','После обработки нажмите кнопку скачивания. Сохранённые результаты доступны в «Моих файлах» этого браузера.','After processing, use Download. Saved results are available in My files in this browser.');
    if (/қауіп|кауип|приват|безопас|privacy|secure/.test(text)) return {text:say('Бұл көмекші дайын нұсқаулықтармен браузерде жұмыс істейді. Хабарламалар мен файлдарды сыртқы AI серверіне жібермейді.','Этот помощник работает с готовыми инструкциями прямо в браузере. Он не отправляет сообщения и файлы на внешний AI-сервер.','This assistant uses prepared guides in your browser. It does not send messages or files to an external AI server.')};
    if (/сәлем|салем|привет|здрав|hello|\bhi\b/.test(text)) return {text:say('Сәлем! PDF-ті Word-қа айналдыру, біріктіру, қысу немесе қол қою туралы сұраңыз.','Привет! Спросите о переводе PDF в Word, объединении, сжатии или подписании.','Hi! Ask about PDF to Word, merging, compression or signing.')};
    if (/рахмет|рақмет|спасибо|thank/.test(text)) return {text:say('Оқасы жоқ! Тағы қандай PDF құралы керек?','Пожалуйста! С каким PDF-инструментом ещё помочь?','You are welcome! What other PDF tool can I help with?')};
    return go('#/tools','Мен PDF бойынша дайын нұсқаулық беремін. Мысалы: «PDF-ті Word-қа қалай айналдырамын?», «PDF қалай біріктіремін?» немесе «Қалай қол қоямын?» деп сұраңыз. Басқа құралдарды төмендегі сілтемеден ашуға болады.','Я помогаю готовыми инструкциями по PDF. Спросите: «Как перевести PDF в Word?», «Как объединить PDF?» или «Как подписать документ?». Все инструменты доступны по ссылке ниже.','I provide prepared PDF guides. Ask about PDF to Word, merging, compression or signing. Open all tools using the link below.');
  }

  q('form').onsubmit=e=>{
    e.preventDefault(); const text=input.value.trim(); if(!text)return;
    input.value='';message('user',text);history.push(text);q('.qa-suggest').replaceChildren();
    const result=answer(text,window.UI?.lang);message('assistant',result.text);
    if(result.route){const link=document.createElement('a');link.href=result.route;
      link.textContent=({kk:'Құралды ашу →',ru:'Открыть инструмент →',en:'Open tool →'})[window.UI?.lang] || 'Open tool →';
      link.className='qa-message qa-assistant';link.style.textDecoration='underline';log.appendChild(link);}
    status.textContent='';log.scrollTop=log.scrollHeight;input.focus();
  };
  labels();
})();
