// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Wnioski z siłą sygnału, profil „Jak działasz”, eksperymenty (start, połowa, wynik, „Zostawiamy”, brak powtórki nieudanego
// dopóki nie zmieni się plan albo cel), typ dnia, zapis godzin odhaczeń i nastroju z ciągu dnia.
const {chromium}=require('playwright');const stub=require('./stub');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource|fonts\.g/.test(m.text()))errs.push('konsola: '+m.text())});
  await p.clock.install({time:new Date(2026,10,18,10,0)});
  const w=ms=>p.clock.runFor(ms);
  const jump=async days=>{await p.clock.fastForward(days*864e5);await w(100);await p.evaluate(()=>{render()})};
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await w(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await w(600);
  await p.click('[data-act=start][data-k=sample]');await w(400);
  await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;S.settings.anim=false;save();render()});
  // 1) wnioski i profil
  const L=await p.evaluate(()=>{const L=Learn.get();return{F:L.F.map(x=>STR_N[x.s]+': '+x.t),T:L.T.map(x=>STR_N[x.s]+': '+x.title)}});
  console.log('wnioski ('+L.F.length+'):');L.F.slice(0,5).forEach(x=>console.log('  · '+x));
  console.log('profil ('+L.T.length+'):');L.T.forEach(x=>console.log('  · '+x));
  await p.evaluate(()=>{ui.tab='charts';render()});
  console.log('karta „Jak działasz”:',await p.isVisible('.prof'),'| cechy:',await p.evaluate(()=>document.querySelectorAll('.prof .trait').length),'| siła sygnału przy wnioskach:',await p.evaluate(()=>document.querySelectorAll('.ins .sig').length),'| NaN:',await p.evaluate(()=>/NaN|undefined/.test(document.getElementById('app').innerHTML)));
  // 2) Pixa: eksperyment z panelu
  await p.click('.prof [data-act=expask]');await w(200);
  const props=await p.evaluate(()=>[...document.querySelectorAll('#asst .xi b')].map(x=>x.textContent));
  console.log('Pixa proponuje eksperymenty:',props.join(' | '));
  await p.click('#asst [data-asst=xstart][data-j="0"]');await w(200);
  console.log('trwa:',await p.evaluate(()=>Exp.active()&&Exp.active().title),'| panel:',(await p.textContent('#asst .pxstep')).trim());
  console.log('drugi naraz niemożliwy:',await p.evaluate(()=>{const a=Exp.active();return Exp.start({k:'zzz',m:'good',title:'x'})===a}));
  await p.evaluate(()=>{const x=Exp.active();Exp.finish(x,true);ui.xp=null;ui.sheet=null;render()});
  // 3) eksperyment z porą: czytanie rano, na Dziś cel przechodzi do „Rano”
  const c={k:'slot|read|r',type:'slot',gid:'read',slot:'r',m:'goal',s:2,title:'„Czytanie” rano',how:'Przez 14 dni czytaj rano.',why:'test'};
  await p.evaluate(c=>{Exp.start(c);ui.tab='today';render()},c);
  console.log('czytanie w sekcji na Dziś:',await p.evaluate(()=>daySlot(S.goals.find(g=>g.id==='read'),todayS())),'| zwykła pora:',await p.evaluate(()=>goalTime(S.goals.find(g=>g.id==='read'))));
  console.log('rano Pixa przypomina:',await p.evaluate(()=>{const x=Asst.chatItems('today').find(x=>/^xr-/.test(x.id));return x&&x.text}));
  // czytanie codziennie w trakcie eksperymentu (sukces)
  await p.evaluate(()=>{const t=todayS();for(let i=0;i<14;i++)setVal('read',addDays(t,i),25);});
  await jump(8);console.log('połowa:',await p.evaluate(()=>{const x=Asst.tips().find(t=>/^xm-/.test(t.id));return x&&x.text}));
  await jump(7);
  const res=await p.evaluate(()=>{const x=S.exp.find(e=>e.k==='slot|read|r');const tp=Asst.tips().find(t=>/^xe-/.test(t.id));return{st:x.status,ok:x.res&&x.res.ok,txt:tp&&tp.text,acts:tp&&tp.actions.map(a=>a.l)}});
  console.log('po 14 dniach:',res.st,'| udany:',res.ok,'|',res.txt,'|',res.acts&&res.acts.join(' / '));
  await p.evaluate(()=>{const tp=Asst.tips().find(t=>/^xe-/.test(t.id));tp.actions[0].f();save()});
  console.log('„Zostawiamy”: pora czytania teraz',await p.evaluate(()=>S.goals.find(g=>g.id==='read').time),'| nie proponuje go znowu:',await p.evaluate(()=>!Exp.candidates().some(c=>c.k==='slot|read|r')));
  // 4) nieudany nie wraca, chyba że zmieni się plan tygodnia albo cel
  const c2={k:'slot|eat|r',type:'slot',gid:'eat',slot:'r',m:'goal',s:1,title:'„Owoce i warzywa” rano',how:'test',why:'test'};
  await p.evaluate(c=>{Exp.start(c);const x=Exp.active();Exp.finish(x,true);x.res.ok=false;save()},c2);
  console.log('nieudany zaraz potem dozwolony:',await p.evaluate(c=>Exp.allowed(c),c2));
  await jump(22);console.log('po 3 tygodniach, bez zmian w planie:',await p.evaluate(c=>Exp.allowed(c),c2));
  await p.evaluate(()=>{const ws=wstart(todayS());S.wplan[ws]=Object.assign({},S.wplan[ws],{eat:{d:[0,1,2,3,4],s:'w'}});save()});
  console.log('po zmianie planu tygodnia dla tego celu:',await p.evaluate(c=>Exp.allowed(c),c2));
  await p.evaluate(()=>{const ws=wstart(todayS());delete S.wplan[ws].eat;S.goals.find(g=>g.id==='eat').time='p';save()});
  console.log('po zmianie samego celu (pora):',await p.evaluate(c=>Exp.allowed(c),c2));
  console.log('udany nigdy nie wraca:',await p.evaluate(()=>Exp.allowed({k:'slot|read|r',gid:'read'})));
  // 5) historia w Pixie
  await p.evaluate(()=>{ui.asstOpen=true;ui.xp='hist';render()});console.log('historia eksperymentów w Pixie:',await p.evaluate(()=>document.querySelectorAll('#asst .xi').length),'pozycje');
  await p.evaluate(()=>{ui.xp=null;ui.asstOpen=false;render()});
  // 6) typ dnia, godziny odhaczeń, nastrój w ciągu dnia
  await p.evaluate(()=>{ui.tab='today';ui.date=todayS();render()});
  await p.click('[data-act=dmenu]');await p.click('[data-act=dtype][data-k=t]');
  console.log('typ dnia:',await p.evaluate(()=>S.dtype[todayS()]),'| menu dalej otwarte:',await p.isVisible('.dmenu'));
  await p.click('[data-act=dtype][data-k=w]');console.log('powrót do automatu:',await p.evaluate(()=>S.dtype[todayS()]===undefined||S.dtype[todayS()]),'(dzień tygodnia:',await p.evaluate(()=>dtypeAuto(todayS())),')');
  await p.evaluate(()=>{ui.dmenu=false;render()});
  await p.evaluate(()=>{S.goals.filter(g=>g.type==='do'&&g.period==='day').forEach(g=>{if(num(val(g.id,todayS())))setVal(g.id,todayS(),0)});render()});
  const gid=await p.evaluate(()=>{const g=S.goals.find(g=>g.type==='do'&&g.period==='day');ui.secT={};ui.secT[todayS()+'|'+daySlot(g,todayS())]=true;render();return g.id});
  await p.click('#row-'+gid+' .chk');
  console.log('godzina odhaczenia zapisana:',await p.evaluate(g=>JSON.stringify(S.eh[todayS()]),gid));
  await p.click('[data-act=mood][data-v="3"]');console.log('nastrój w ciągu dnia zapamiętany:',await p.evaluate(()=>S.moodAm[todayS()]));
  // 7) łączenie z drugim urządzeniem
  console.log('łączenie eksperymentów i godzin:',await p.evaluate(()=>{const b={exp:[],eh:{}},l={exp:[{id:'a',t:1}],eh:{'2026-01-01':{x:8}}},r={exp:[{id:'b',t:2}],eh:{'2026-01-01':{y:9}}};const m=mergeState(b,l,r);return m.exp.map(x=>x.id).join(',')+' | '+JSON.stringify(m.eh)}));
  // 8) nowe konto bez danych
  await p.evaluate(()=>{S.log={};S.mood={};S.notes={};S.eh={};S.exp=[];save();Learn.reset();ui.tab='charts';render()});
  console.log('puste konto: pasek nauki',await p.isVisible('.learnb'),'| tekst:',(await p.textContent('.learnb span')).trim(),'| Pixa i tak ma ogólne pomysły:',await p.evaluate(()=>Exp.candidates().map(c=>c.title).join(' | ')));
  console.log('errors',errs);await b.close();
})();
