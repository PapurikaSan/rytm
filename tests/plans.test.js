// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Wnioski z planów (pora, przeszkody), postęp „teraz i wcześniej”, podsumowanie roku, plan tygodnia,
// „Domknij dzień” na jednym ekranie (także z powiadomienia #pixa-fill), cele długoterminowe z nawykami.
const {chromium}=require('playwright');const stub=require('./stub');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const open=async when=>{
    const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
    p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource|fonts\.g/.test(m.text()))errs.push('konsola: '+m.text())});
    await p.clock.install({time:when});
    await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.clock.runFor(500);
    await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.clock.runFor(600);
    await p.click('[data-act=start][data-k=sample]');await p.clock.runFor(400);
    await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;S.settings.anim=false;save();render()});await p.clock.runFor(100);
    return{ctx,p};
  };
  // środa 18 listopada 2026, 8:30
  const {ctx,p}=await open(new Date(2026,10,18,8,30));
  const at=async(h,m)=>{const now=await p.evaluate(()=>Date.now()),target=new Date(2026,10,18,h,m||0).getTime();await p.clock.fastForward(target-now);await p.clock.runFor(50)};

  // 1) wnioski z planów
  const pi=await p.evaluate(()=>planInsights().map(x=>x.t));
  console.log('wnioski z planów:');pi.forEach(x=>console.log('  · '+x));
  console.log('najlepsza pora treningu:',await p.evaluate(()=>{const b=bestSlot('gym');return b&&b.k+' '+Math.round(b.r*100)+'%'}));
  await p.evaluate(()=>{ui.tab='charts';render()});
  console.log('karta „Plany i przeszkody”:',await p.evaluate(()=>[...document.querySelectorAll('.card h3')].some(h=>h.textContent==='Plany i przeszkody')),'| tabela:',await p.evaluate(()=>[...document.querySelectorAll('.card')].find(c=>/Plany i przeszkody/.test(c.textContent)).querySelectorAll('tr').length-1),'wiersze');
  // 2) postęp
  const pg=await p.evaluate(()=>{const x=progress();return{L:x.L,rows:x.rows.map(r=>r.name+' '+r.ct+' (było '+r.pt+')'),up:x.up.length,dn:x.dn.length}});
  console.log('postęp: okno',pg.L,'dni, do przodu',pg.up,', do poprawy',pg.dn);pg.rows.slice(0,6).forEach(x=>console.log('  · '+x));
  console.log('karta „Postęp” na ekranie:',await p.evaluate(()=>document.querySelectorAll('.pgr').length),'wierszy | NaN:',await p.evaluate(()=>/NaN|Infinity|undefined/.test(document.getElementById('app').innerHTML)));
  await p.click('[data-act=progall]');console.log('  „Pokaż wszystkie”:',await p.evaluate(()=>document.querySelectorAll('.pgr').length),'wierszy');
  console.log('karta roku w listopadzie (nie powinna być):',await p.isVisible('#yr'));
  // 3) rano: podpowiedź pory przy pytaniu „kiedy”
  const morning=await p.evaluate(()=>Asst.chatItems('today').filter(x=>/^plan-gym/.test(x.id)).map(x=>x.text)[0]);
  console.log('8:30 pytanie o trening:',morning);
  // 4) plan tygodnia
  await p.evaluate(()=>{ui.tab='week';ui.wk=0;render()});
  console.log('Kalendarz → Tydzień, notka planu:',(await p.textContent('.wpn p')).trim());
  await p.click('.wpn [data-act=wplan]');await p.clock.runFor(100);
  const def=await p.evaluate(()=>JSON.stringify(ui.sheet.p));console.log('domyślny plan:',def);
  console.log('dni przed dziś zablokowane:',await p.evaluate(()=>[...document.querySelectorAll('.wpday')].filter(b=>b.disabled).length),'(pn, wt × liczba celów)');
  // zmiana: owoce bez soboty, pora treningu wieczorem
  await p.click('[data-act=wpday][data-g=eat][data-i="5"]');await p.click('[data-act=wpslot][data-g=gym][data-s=w]');
  await p.click('[data-act=wpsave]');await p.clock.runFor(100);
  console.log('zapisany plan:',await p.evaluate(()=>JSON.stringify(S.wplan[wstart(todayS())])));
  console.log('notka po zapisie:',(await p.textContent('.wpn p')).trim());
  console.log('planOf dziś (śr): trening',await p.evaluate(()=>planOf(todayS(),'gym')),'| czwartek',await p.evaluate(()=>planOf(addDays(todayS(),1),'gym')),'| owoce w sobotę',await p.evaluate(()=>planOf(addDays(todayS(),3),'eat')));
  const it=await p.evaluate(()=>Asst.chatItems('today').map(x=>x.id.replace(/-?2026-\d\d-\d\d/,'')+': '+x.text).filter(x=>/^(plan|tp)/.test(x)));
  console.log('8:30 po planie tygodnia (bez pytań „kiedy” o zaplanowane):');it.forEach(x=>console.log('  · '+x));
  await p.evaluate(()=>{ui.tab='today';render()});
  console.log('trening na Dziś w sekcji:',await p.evaluate(()=>daySlot(S.goals.find(g=>g.id==='gym'),todayS())),'| sekcja „Wieczorem” zwinięta o 8:30:',!(await p.isVisible('#row-gym')));
  await p.click('[data-act=sect][data-k=w]');console.log('  po rozwinięciu:',(await p.textContent('#row-gym .gs')).trim());
  // 5) cele długoterminowe z nawykami
  await p.evaluate(()=>{ui.tab='goals';render()});
  console.log('cele długoterminowe:');for(const t of await p.$$eval('.lt',l=>l.map(x=>x.innerText.replace(/\s+/g,' ').trim())))console.log('  · '+t);
  await p.click('[data-act=ltdone][data-id=lt4]');await p.clock.runFor(100);
  console.log('„Osiągnięte?” kliknięte:',await p.evaluate(()=>S.lt.find(x=>x.id==='lt4').doneAt),'|',(await p.textContent('#toast')).trim());
  await p.click('[data-act=newlt]');await p.click('[data-act=ltkind][data-k=done]');await p.fill('#lt-name','Maraton w maju');
  await p.click('[data-act=ltto][data-m="6"]');await p.click('[data-act=lthelp][data-g=gym]');await p.click('[data-act=lthelp][data-g=sleep]');
  console.log('nowy cel „jednorazowy”: zapis aktywny',await p.evaluate(()=>!document.getElementById('ltsave').disabled),'| do',await p.evaluate(()=>ui.sheet.x.to),'| nawyki',await p.evaluate(()=>ui.sheet.x.helps.join(',')));
  await p.click('#ltsave');await p.clock.runFor(100);
  console.log('  zapisany:',await p.evaluate(()=>JSON.stringify(S.lt.find(x=>x.name==='Maraton w maju'))));
  await p.evaluate(()=>{ui.tab='today';render()});
  console.log('wiersz snu na Dziś (link do celu):',(await p.textContent('#row-sleep .gs')).trim());
  console.log('dymki Pixy w Celach:',await p.evaluate(()=>Asst.chatItems('goals').filter(x=>/^lt-/.test(x.id)).map(x=>x.text).join(' || ')));
  console.log('+1 przy zaznaczeniu treningu:',await p.evaluate(()=>{act('toggle',{g:'gym'});return document.getElementById('toast').textContent}));
  await p.evaluate(()=>act('toggle',{g:'gym'}));
  // 6) domknij dzień wieczorem
  await at(20,30);await p.evaluate(()=>{ui.tab='today';ui.date=todayS();render()});
  console.log('20:30 przycisk „Domknij dzień”:',await p.isVisible('.dcbtn'));
  console.log('20:30 panel Pixy, braki:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='missing');return x&&x.actions.map(a=>a.l).join(' / ')}));
  await p.click('.dcbtn');await p.clock.runFor(100);
  console.log('ekran: cele bez wpisu',await p.evaluate(()=>ui.sheet.ids.join(',')),'| status:',(await p.textContent('.dcst')).trim());
  await p.click('[data-act=dcmood][data-v="4"]');
  await p.click('[data-act=dcg][data-g=gym][data-v=y]');
  await p.click('[data-act=dcg][data-g=eat][data-v=j]');
  await p.click('[data-act=dcwhy][data-k=zm]');
  await p.click('[data-act=dcv][data-g=sleep]');
  for(const id of ['steps','water','read','lang','meditate','screen'])await p.evaluate(id=>{const el=document.querySelector('[data-chg=dcnum][data-g='+id+']');if(el){el.value=id==='screen'?'2':id==='steps'?'9000':id==='water'?'2':'20';el.dispatchEvent(new Event('change',{bubbles:true}))}},id);
  await p.fill('#dcnote','Dobry dzień, trening rano.');await p.dispatchEvent('#dcnote','change');
  console.log('status po odpowiedziach:',(await p.textContent('.dcst')).trim());
  await p.click('[data-act=dcdone]');await p.clock.runFor(200);
  console.log('po „Gotowe”: okno zamknięte',!(await p.isVisible('.sheet')),'| Pixa mówi:',(await p.textContent('#asst .pxtxt')).trim());
  console.log('  nastrój ostateczny',await p.evaluate(()=>moodFinal(todayS())),'| owoce przełożone na jutro:',await p.evaluate(()=>planOf(addDays(todayS(),1),'eat')),'| powód:',await p.evaluate(()=>S.asst.why[todayS()].eat),'| notatka:',await p.evaluate(()=>S.notes[todayS()]),'| dzień domknięty:',await p.evaluate(()=>dcDone(todayS())),'| przycisk znika:',!(await p.isVisible('.dcbtn')));
  // 7) powiadomienie wieczorne otwiera „Domknij dzień”
  await p.evaluate(()=>{delete S.mood[todayS()];save();ui.asstOpen=false;location.hash='#pixa-fill'});await p.clock.runFor(300);
  console.log('#pixa-fill otwiera ekran „Domknij dzień”:',await p.evaluate(()=>!!ui.sheet&&ui.sheet.kind==='dayend'),await p.isVisible('.dch'));
  await p.click('.sheet [data-act=close]');
  // 8) łączenie planu tygodnia z dwóch urządzeń
  console.log('łączenie planów tygodnia:',await p.evaluate(()=>{const b={wplan:{'2026-11-16':{gym:{d:[0],s:'r'}}}},l={wplan:{'2026-11-16':{gym:{d:[0,2],s:'r'}}}},r={wplan:{'2026-11-16':{gym:{d:[0],s:'r'},eat:{d:[1],s:''}}}};return JSON.stringify(mergeState(b,l,r).wplan)}));
  await ctx.close();

  // 9) niedziela 18:00: propozycja planu na następny tydzień; poniedziałek rano: na bieżący
  {const {ctx,p}=await open(new Date(2026,10,22,18,0));
    console.log('niedziela 18:00, Pixa:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='wplan');return x&&x.id+' → '+x.text}));
    await p.evaluate(()=>{Asst.tips().find(t=>t.kind==='wplan').actions[0].f()});await p.clock.runFor(100);
    console.log('  otwiera plan na tydzień od:',await p.evaluate(()=>ui.sheet.ws),'| zablokowane dni:',await p.evaluate(()=>[...document.querySelectorAll('.wpday')].filter(b=>b.disabled).length));
    await ctx.close()}
  {const {ctx,p}=await open(new Date(2026,10,23,9,0));
    console.log('poniedziałek 9:00, Pixa:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='wplan');return x&&x.id}));
    await ctx.close()}
  // 10) podsumowanie roku
  {const {ctx,p}=await open(new Date(2026,11,30,12,0));
    await p.evaluate(()=>{ui.tab='charts';render()});
    console.log('30 grudnia, karta roku:',(await p.innerText('#yr')).replace(/\s+/g,' ').slice(0,400));
    console.log('  Pixa:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='yearly');return x&&x.text}));
    console.log('  NaN na Wykresach:',await p.evaluate(()=>/NaN|Infinity|undefined/.test(document.getElementById('app').innerHTML)));
    await ctx.close()}
  {const {ctx,p}=await open(new Date(2027,0,10,12,0));
    await p.evaluate(()=>{ui.tab='charts';render()});console.log('10 stycznia, karta roku:',(await p.textContent('#yr h3')).trim());
    await ctx.close()}
  // 11) nowe konto: bez danych nic się nie wysypuje
  {const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
    const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
    await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(600);
    await p.click('[data-act=start][data-k=template]');await p.waitForTimeout(300);
    const r=await p.evaluate(()=>{ui.tour=null;S.tour='done';ui.tab='charts';render();const a=document.getElementById('app').innerText;wpOpen(wstart(todayS()));const w=!!document.querySelector('.sheet');ui.sheet=null;dcOpen();const d=!!document.querySelector('.dch');ui.sheet=null;render();return{post:/Postęp/.test(a)&&/2 tygodniach/.test(a),plans:/Odpowiadaj Pixie/.test(a),w,d}});
    console.log('nowe konto: postęp czeka na dane',r.post,'| plany: zachęta',r.plans,'| plan tygodnia',r.w,'| domknij dzień',r.d);
    await ctx.close()}
  console.log('errors',errs);await b.close();
})();
