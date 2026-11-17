// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Ochrona serii, minutnik skupienia i minuta oddechu z Pixą (zegar przyspieszany w teście).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  const open=async()=>{if(!await p.isVisible('.pxpanel')){await p.click('.hal');await p.clock.runFor(150)}};
  const now=new Date();now.setHours(19,0,0,0);await p.clock.install({time:now});
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.clock.runFor(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.clock.runFor(600);
  await p.click('[data-act=start][data-k=template]');await p.clock.runFor(300);await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;ui.say=null;render()}); // przewodnik ma osobny test
  // 1) ochrona serii: 5 dobrych dni, dziś brakuje tylko czytania
  await p.evaluate(()=>{const t=todayS();for(let k=1;k<=5;k++){const d=addDays(t,-k);S.log[d]={'g-sleep':7.5,'g-eat':1,'g-read':12,'g-gym':1}}S.log[t]={'g-eat':1,'g-read':12};S.mood[t]=4;S.asst.ck={};save();render()});
  const tp=await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='streak').map(x=>x.text));
  console.log('1 ochrona serii:',tp.join(' | ')||'BRAK');
  await open();console.log('  pierwsza w panelu:',(await p.textContent('.pxtxt')).trim().slice(0,60));
  await p.click('.pxact .btn:text("Uzupełnij z Pixą")');await p.clock.runFor(150);
  await p.click('[data-asst=ckv] >> nth=1');await p.clock.runFor(150);
  console.log('  po uzupełnieniu dobry dzień:',await p.evaluate(()=>goodDay(todayS())),'| seria:',await p.evaluate(()=>streak()));
  await p.click('[data-asst=ckend]');
  // 2) minutnik: Nauka nie istnieje w zestawie, dodajemy cel w minutach
  await p.evaluate(()=>{S.goals.push({id:'g-learn',name:'Nauka',cat:'Umysł',type:'qty',period:'day',target:30,unit:'min',prio:'imp',act:'learn',groups:[]});save();render()});
  await open();await p.click('.pxtools [data-asst=ftool]');await p.clock.runFor(150);
  console.log('2 minutnik, wybrany cel:',await p.textContent('.pxchips .pill.on'),'|',await p.textContent('.pxchips >> nth=1 >> .pill.on'));
  await p.click('[data-asst=fmin][data-m="15"]');await p.click('[data-asst=fstart]');await p.clock.fastForward(1200);
  console.log('  odliczanie:',await p.textContent('#fclock'));
  await p.clock.fastForward(5*60*1000);console.log('  po 5 min:',await p.textContent('#fclock'));
  await p.click('[data-asst=fpause]');await p.clock.fastForward(3*60*1000);console.log('  pauza 3 min, dalej:',await p.textContent('#fclock'));
  await p.click('[data-asst=fpause]');await p.clock.fastForward(10*60*1000+2000);
  console.log('  koniec:',(await p.textContent('.pxtxt')).trim(),'| Nauka dziś:',await p.evaluate(()=>val('g-learn',todayS())));
  await p.click('[data-asst=fclose]');
  // minutnik dla czytania (strony): pyta o liczbę
  await p.click('.pxtools [data-asst=ftool]');await p.click('[data-asst=fgoal][data-g=g-read]');await p.click('[data-asst=fmin][data-m="15"]');await p.click('[data-asst=fstart]');await p.clock.fastForward(15*60*1000+1500);
  console.log('  czytanie, pytanie:',(await p.textContent('.pxtxt')).trim());await p.fill('#fin','8');await p.press('#fin','Enter');await p.clock.runFor(150);
  console.log('  czytanie dziś:',await p.evaluate(()=>val('g-read',todayS())),'|',(await p.textContent('.pxtxt')).trim());await p.click('[data-asst=fclose]');
  // 3) oddech
  await p.click('.pxtools [data-asst=btool]');await p.clock.fastForward(1000);console.log('3 oddech start:',await p.textContent('#btxt'),await p.textContent('#bsec'));
  await p.screenshot({path:path.join(require('os').tmpdir(),'rytm-breath.png')});
  await p.clock.fastForward(4500);console.log('  po 5,5 s:',await p.textContent('#btxt'));
  await p.clock.fastForward(56000);console.log('  koniec:',(await p.textContent('.pxtxt')).trim());
  await p.click('[data-asst=bmood][data-v="4"]');console.log('  nastrój po oddechu:',await p.evaluate(()=>S.mood[todayS()]));
  // nastrój 2 -> propozycja oddechu
  await p.evaluate(()=>{delete S.mood[todayS()];save();render()});await p.clock.runFor(100);
  await open();
  for(let i=0;i<5&&!(await p.textContent('.pxtxt')).includes('czujesz');i++)await p.click('[data-asst=next]');
  await p.click('.pxact .mb.md2');await p.clock.runFor(150);console.log('  po nastroju 2:',(await p.textContent('.pxtxt')).trim().slice(0,60));
  console.log('ov',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth));
  console.log('errors',JSON.stringify(errs));await b.close();
})();
