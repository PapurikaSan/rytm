// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Rytm dnia z Pixą: rano plan („kiedy?”), najważniejsza rzecz i sen; w dzień postęp; wieczorem domknięcie
// (nastrój na cały dzień, „miało być”, przełożenie na jutro); tryb „dobry dzień = cele główne”, świetny dzień.
const {chromium}=require('playwright');const stub=require('./stub');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  // środa 18 listopada 2026, 7:00 (przed pobudką)
  await p.clock.install({time:new Date(2026,10,18,7,0,0)});
  const w=ms=>p.clock.runFor(ms);
  const items=()=>p.evaluate(()=>Asst.chatItems('today').map(x=>x.id.replace(/-?2026-\d\d-\d\d/,'')).filter(x=>!/^q-/.test(x)));
  const tips=()=>p.evaluate(()=>Asst.tips().map(x=>x.kind+':'+x.id.replace(/-?2026-\d\d-\d\d/,'')));
  const at=async(h,m)=>{const now=await p.evaluate(()=>Date.now()),target=new Date(2026,10,18,h,m||0).getTime();await p.clock.fastForward(target-now);await w(50)};
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await w(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await w(600);
  await p.click('[data-act=start][data-k=template]');await w(300);
  await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;S.goals.find(g=>g.id==='g-gym').prio='main';save();render()});
  console.log('ustawienia domyślne: pobudka',await p.evaluate(()=>S.settings.wake),'wieczór',await p.evaluate(()=>S.settings.evening),'dymki',await p.evaluate(()=>S.settings.chatEvery),'dobry dzień',await p.evaluate(()=>S.settings.goodMode));
  console.log('7:00 dymki:',(await items()).join(', '));
  await at(8,30);
  console.log('8:30 dymki:',(await items()).join(', '));
  console.log('8:30 panel:',(await tips()).join(', '));
  // plan: siłownia wieczorem
  await p.evaluate(()=>{const it=Asst.chatItems('today').find(x=>x.id.startsWith('plan-g-gym'));it.acts.find(a=>a.l==='Wieczorem').f();save()});
  console.log('  plan siłowni:',await p.evaluate(()=>planOf(todayS(),'g-gym')));
  // nastrój rano: wstępny
  await p.click('[data-act=mood][data-v="4"]');await w(100);
  console.log('  nastrój rano wstępny:',await p.evaluate(()=>!moodFinal(todayS())),'| napis:',(await p.textContent('#row-mood .gn')).trim());
  // najważniejsza rzecz przez Pixę
  await p.click('[data-act=mitedit]');await w(150);await p.fill('#mitin','Skończyć raport');await p.press('#mitin','Enter');await w(150);
  console.log('  najważniejsze:',await p.evaluate(()=>JSON.stringify(S.mit[todayS()])),'| na ekranie Dziś:',(await p.textContent('.mitl')).trim());
  await p.click('.pxclose').catch(()=>{});
  await at(13,0);
  console.log('13:00 dymki:',(await items()).join(', '));
  console.log('13:00 panel bez pytania o nastrój:',!(await tips()).some(x=>x.startsWith('mood')));
  await at(20,0);
  console.log('20:00 dymki:',(await items()).join(', '));
  console.log('20:00 panel:',(await tips()).join(', '));
  // potwierdzenie nastroju
  await p.evaluate(()=>{const it=Asst.chatItems('today').find(x=>x.id.startsWith('mdok-'));it.acts[0].f();save()});
  console.log('  nastrój potwierdzony:',await p.evaluate(()=>moodFinal(todayS())));
  await at(21,5);
  console.log('21:05 dymki:',(await items()).join(', '));
  // siłownia: nie, przełóż na jutro
  await p.evaluate(()=>{Math.random=()=>0.1;const it=Asst.chatItems('today').find(x=>x.id.startsWith('pc-g-gym'));const a=it.acts.find(x=>/przełóż/.test(x.l));a.f();const nx=a.next&&a.next();window.__why=nx&&nx.text;save()});
  console.log('  po odpowiedzi „Miało być” już nie wraca:',await p.evaluate(()=>!Asst.chatItems('today').some(x=>x.id.startsWith('pc-g-gym'))));
  console.log('  przełożone na jutro:',await p.evaluate(()=>planOf(addDays(todayS(),1),'g-gym')),'| pytanie, co przeszkodziło:',await p.evaluate(()=>window.__why));
  // najważniejsza rzecz: udało się
  await p.evaluate(()=>{const it=Asst.chatItems('today').find(x=>x.id.startsWith('mitw-'));it.acts[0].f();save()});
  console.log('  najważniejsze zrobione:',await p.evaluate(()=>S.mit[todayS()].ok));
  // dobry dzień w trybie „cele główne”, potem świetny dzień
  await p.evaluate(()=>{S.settings.goodMode='main';const t=todayS();S.goals.forEach(g=>{if(g.prio==='main'){if(g.type==='range')setVal(g.id,t,g.target);else if(g.type==='qty')setVal(g.id,t,g.target);else setVal(g.id,t,1)}});ui.tab='today';render()});await w(100);
  console.log('tryb „główne”: dobry dzień',await p.evaluate(()=>goodDay(todayS())),'| świetny',await p.evaluate(()=>perfectDay(todayS())),'| napis w pierścieniu:',(await p.textContent('.ring .v span')).trim());
  await p.evaluate(()=>{const t=todayS();S.goals.forEach(g=>{if(g.type==='range')setVal(g.id,t,g.target);else if(g.type==='qty')setVal(g.id,t,g.target);else if(g.type==='do')setVal(g.id,t,1)});render()});await w(100);
  console.log('wszystko zrobione: świetny',await p.evaluate(()=>perfectDay(todayS())),'| pierścień:',(await p.textContent('.ring .v span')).trim(),'| złoty:',await p.evaluate(()=>!!document.querySelector('.hero.perfect')),'| komunikat:',(await p.textContent('#toast')).trim());
  console.log('podsumowanie tygodnia:',await p.evaluate(()=>weekRecap(wstart(todayS())).b));
  // ustawienia: godziny dnia
  await p.evaluate(()=>{ui.tab='settings';ui.setSec='pixa';render()});await p.selectOption('#s-eve','18');await p.selectOption('#s-wake','7');await w(100);
  console.log('ustawienia po zmianie: pobudka',await p.evaluate(()=>S.settings.wake),'wieczór',await p.evaluate(()=>S.settings.evening),'| tryb dobrego dnia w Ustawieniach:',await p.evaluate(()=>{ui.setSec='goals';render();return document.querySelector('[data-act=sstreak][data-v=main]').classList.contains('on')}));
  // limit dymków: najwyżej raz na 30 minut w tej samej zakładce
  const lim=await p.evaluate(()=>{S.settings.pixaChat=true;ui.tab='today';ui.asstOpen=false;ui.sheet=null;render();const a=Asst.chat('today',true);ui.say=null;ui.tab='goals';render();Asst.chat('goals');ui.tab='today';render();const b=Asst.chat('today');return[a,b]});
  console.log('limit 30 min: pierwszy dymek',lim[0],'| ponowny po chwili',lim[1]);
  console.log('errors',errs);await b.close();
})();
