(function () {
  const copy = {
    kk: {title:'Qalam көмекші',open:'Көмекшімен сөйлесу',close:'Жабу',clear:'Тазалау',placeholder:'Сұрағыңызды жазыңыз…',send:'Жіберу',hello:'Сәлем! PDF түрлендіру, біріктіру және өңдеу бойынша көмектесемін.',notice:'Хабарламаларыңыз жауап алу үшін OpenAI-ға жіберіледі. Файлдар автоматты жіберілмейді.',wait:'Жауап дайындап жатырмын…',error:'Қазір жауап алу мүмкін болмады. Қайта жіберіп көріңіз.',limit:'Сұрау лимиті бітті. Кейінірек қайталаңыз.',setup:'Көмекші сервері әлі қосылмаған.',suggest:['PDF-ті Word-қа қалай айналдырамын?','PDF файлдарын қалай біріктіремін?','Құжатқа қалай қол қоямын?']},
    ru: {title:'Помощник Qalam',open:'Открыть помощника',close:'Закрыть',clear:'Очистить',placeholder:'Напишите вопрос…',send:'Отправить',hello:'Привет! Помогу с конвертацией, объединением и редактированием PDF.',notice:'Для ответа ваши сообщения отправляются в OpenAI. Файлы автоматически не передаются.',wait:'Готовлю ответ…',error:'Не удалось получить ответ. Попробуйте отправить снова.',limit:'Достигнут лимит запросов. Попробуйте позже.',setup:'Сервер помощника ещё не подключён.',suggest:['Как перевести PDF в Word?','Как объединить PDF?','Как подписать документ?']},
    en: {title:'Qalam assistant',open:'Open assistant',close:'Close',clear:'Clear',placeholder:'Ask a question…',send:'Send',hello:'Hi! I can help with PDF conversion, merging and editing.',notice:'Your messages are sent to OpenAI to generate replies. Files are not sent automatically.',wait:'Preparing a reply…',error:'Could not get a reply. Please send again.',limit:'Request limit reached. Please try later.',setup:'The assistant server is not connected yet.',suggest:['How do I convert PDF to Word?','How do I merge PDFs?','How do I sign a document?']}
  };
  let history = [], pending = false, controller;
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
  q('.qa-clear').onclick=()=>{controller?.abort();history=[];log.replaceChildren();message('assistant',getCopy().hello);status.textContent='';labels();input.focus()};
  q('form').onsubmit=async e=>{
    e.preventDefault();const text=input.value.trim();if(!text || pending)return;
    const endpoint=window.QALAM_ASSISTANT_URL;
    if(!endpoint){status.textContent=getCopy().setup;return;}
    try {if(new URL(endpoint).protocol!=='https:' && !['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw Error();}catch{status.textContent=getCopy().setup;return;}
    pending=true;controller=new AbortController();const current=controller;
    const timeout=setTimeout(()=>current.abort(),35000);
    input.value='';message('user',text);status.textContent=getCopy().wait;q('.qa-send').disabled=true;q('.qa-clear').disabled=true;q('.qa-suggest').replaceChildren();
    const messages=[...history.slice(-8),{role:'user',content:text}];
    // Keep a complete recent turn window within the server context budget.
    while(messages.length>1 && messages.reduce((n,m)=>n+m.content.length,0)>14000)messages.shift();
    try {
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:current.signal});
      if(!res.ok){const err=new Error('request');err.status=res.status;throw err;}
      const data=await res.json();if(typeof data.text!=='string' || !data.text.trim())throw Error('empty');
      history=[...messages,{role:'assistant',content:data.text.slice(0,3000)}];message('assistant',data.text);status.textContent='';
    }catch(err){status.textContent=err.status===429?getCopy().limit:getCopy().error;input.value=text;}
    finally{clearTimeout(timeout);pending=false;q('.qa-send').disabled=false;q('.qa-clear').disabled=false;if(!panel.hidden)input.focus();}
  };
  labels();
})();
