// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Druga fala wniosków: niepełne dni, dowód i ocena trafności, co wpływa na nastrój, prognoza dnia, osobiste optimum,
// własny eksperyment (naprzemienne dni), zdarzenia i zmiana okresu, święta, pogoda (atrapa Open-Meteo), list od Pixy.
const {chromium}=require('playwright');const stub=require('./stub');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
  // atrapa Open-Meteo: wyszukiwarka miast i pogoda (deszcz co trzeci dzień)
  let wxCalls=0,geoQ='';
  await ctx.route(/geocoding-api\.open-meteo\.com/,r=>{geoQ=new URL(r.request().url()).searchParams.get('name');r.fulfill({contentType:'application/json',body:JSON.stringify({results:[{name:'Kraków',admin1:'Małopolskie',latitude:50.0614,longitude:19.9366}]})})});
  await ctx.route(/api\.open-meteo\.com\/v1\/forecast/,r=>{wxCalls++;const u=new URL(r.request().url());const t0=new Date(2026,10,18);const time=[],pr=[],tm=[],sun=[];for(let i=-92;i<=1;i++){const d=new Date(t0);d.setDate(d.getDate()+i);time.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));pr.push(i%3===0?6:0);tm.push(8);sun.push(i%3===0?0:18000)}
    r.fulfill({contentType:'application/json',body:JSON.stringify({latitude:+u.searchParams.get('latitude'),daily:{time,precipitation_sum:pr,temperature_2m_max:tm,sunshine_duration:sun}})})});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource|fonts\.g/.test(m.text()))errs.push('konsola: '+m.text())});
  await p.clock.install({time:new Date(2026,10,18,9,0)});
  const w=ms=>p.clock.runFor(ms);
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await w(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await w(600);
  await p.click('[data-act=start][data-k=sample]');await w(400);
  await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;S.settings.anim=false;save();render()});
  // 1) niepełne dni są pomijane
  const nf=await p.evaluate(()=>{const before=Learn.get().nFull;const t=todayS();for(let k=2;k<=6;k++){const d=addDays(t,-k);S.log[d]={water:2};delete S.mood[d]}save();Learn.reset();const L=Learn.get();return{before,after:L.nFull,all:L.nAll,full:fullDay(addDays(t,-3))}});
  console.log('pełne dni: przed',nf.before,'| po wyczyszczeniu 5 dni do jednego wpisu',nf.after,'z',nf.all,'| taki dzień pełny?',nf.full);
  // 2) karta wniosków: dowód i ocena
  await p.evaluate(()=>{ui.tab='charts';render()});
  console.log('wnioski z przyciskami „Dowód”:',await p.evaluate(()=>document.querySelectorAll('.ins [data-act=evid]').length),'| ocena:',await p.evaluate(()=>document.querySelectorAll('.ins [data-act=fb]').length/3));
  const fid=await p.evaluate(()=>insights()[0].id);
  await p.click('.ins [data-act=evid][data-id="'+fid+'"]');await w(100);
  console.log('dowód:',await p.evaluate(()=>({dni:document.querySelectorAll('.evc.on').length,pomini:document.querySelectorAll('.evg .evc.na').length,tekst:document.querySelector('.sheet .sub').textContent.slice(0,80)})));
  await p.click('.sheet [data-act=close]');
  await p.click('.ins [data-act=fb][data-id="'+fid+'"][data-v=no]');await w(100);
  console.log('„Nietrafne”: zniknął',await p.evaluate(id=>!insights().some(x=>x.id===id),fid),'| licznik schowanych:',await p.evaluate(()=>hiddenN()),'|',(await p.textContent('#toast')).trim());
  const f2=await p.evaluate(()=>insights()[0].id);await p.click('.ins [data-act=fb][data-id="'+f2+'"][data-v=known]');
  console.log('„Wiem”: zostaje w karcie',await p.evaluate(id=>insights().some(x=>x.id===id),f2),'| Pixa o tym nie mówi:',await p.evaluate(id=>!Learn.fresh(insights().find(x=>x.id===id)),f2));
  await p.click('[data-act=fbreset]');console.log('„Przywróć”:',await p.evaluate(id=>insights().some(x=>x.id===id),fid));
  // wyciszenie rodzaju po 2× „Nietrafne”
  console.log('wyciszony rodzaj po 2× nietrafne:',await p.evaluate(()=>{S.fb={a:{v:'no',k:'word'},b:{v:'no',k:'word'}};const x=insights().find(y=>y.k==='word');return x?!Learn.fresh(x):'brak słów'}));
  await p.evaluate(()=>{S.fb={};save()});
  // 3) co wpływa na nastrój, optimum, prognoza
  const L=await p.evaluate(()=>{const L=Learn.get();const d=L.T.find(x=>x.id==='drivers');const o=L.F.find(x=>x.k==='dose');return{dr:d&&d.t,dose:o&&o.t,sug:o&&o.sug}});
  console.log('co wpływa na nastrój:',L.dr);console.log('optimum:',L.dose,'| propozycja celu:',L.sug);
  await p.evaluate(()=>{ui.tab='today';render()});
  console.log('prognoza na Dziś:',(await p.textContent('.fcl')).replace(/\s+/g,' ').trim(),'| zapisana:',await p.evaluate(()=>JSON.stringify(S.fc[todayS()])));
  await p.click('.fcl');await w(100);console.log('Pixa tłumaczy prognozę:',(await p.textContent('#asst .pxtxt')).trim());
  await p.evaluate(()=>{ui.asstOpen=false;ui.chatTip=null;render()});
  console.log('Pixa rano:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='forecast');return x&&x.text}));
  // trafność prognoz po tygodniu zapisów
  console.log('trafność:',await p.evaluate(()=>{const t=todayS();for(let k=1;k<=10;k++){const d=addDays(t,-k);S.fc[d]={p:goodDay(d)?70:30}}S.fc[addDays(t,-1)].p=goodDay(addDays(t,-1))?20:80;return JSON.stringify(Learn.fcAcc())}));
  // 4) własny eksperyment: naprzemienne dni
  await p.evaluate(()=>{ui.asstOpen=true;ui.xp='custom';ui.xc={g:'',o:'mood'};render()});
  await p.fill('#xct','Kawa po 14:00');await p.click('#asst [data-asst=xcgo]');await w(100);
  console.log('własny eksperyment:',await p.evaluate(()=>{const x=Exp.active();return x&&x.title+' | '+Exp.abToday(x)}),'| jutro:',await p.evaluate(()=>Exp.abToday(Exp.active(),addDays(todayS(),1))));
  // 14 dni: w dni „z kawą” nastrój 2, bez 4; jeden dzień bez potwierdzenia „Nie”
  await p.evaluate(()=>{const x=Exp.active();for(let i=0;i<14;i++){const d=addDays(x.from,i);S.mood[d]=Exp.abOn(x,d)?2:4;S.log[d]=Object.assign({},S.log[d],{water:2,steps:9000})}x.cmp[addDays(x.from,3)]=0;save()});
  await p.clock.fastForward(11*3600*1000);await w(50);
  console.log('wieczorem pyta o potwierdzenie:',await p.evaluate(()=>{const x=Asst.tips().find(t=>/^xabc-/.test(t.id));return x&&x.text}));
  await p.clock.fastForward(14*864e5);await w(100);await p.evaluate(()=>render());
  console.log('wynik:',await p.evaluate(()=>{const x=S.exp.find(e=>e.type==='ab');return x.status+' | '+Exp.resText(x)}));
  // 5) zdarzenia: urlop pomijany, zmiana opisuje przełom
  await p.evaluate(()=>{ui.asstOpen=false;ui.xp=null;ui.tab='today';ui.date=todayS();render()});
  await p.click('[data-act=dmenu]');await p.click('[data-act=evnew]');await p.click('[data-act=evk][data-k=zmiana]');
  await p.evaluate(()=>{const el=document.getElementById('ev-from');el.value=addDays(todayS(),-20);el.dispatchEvent(new Event('change',{bubbles:true}))});
  await p.fill('#ev-t','Nowa praca');await p.click('[data-act=evsave]');
  console.log('zdarzenie zapisane:',await p.evaluate(()=>JSON.stringify(S.events.map(e=>[e.k,e.t,e.from]))));
  // przełom: od zmiany nastrój wyraźnie niższy
  const sh=await p.evaluate(()=>{const t=todayS(),c=addDays(t,-20);range(addDays(t,-80),addDays(t,-1)).forEach(d=>{S.mood[d]=d>=c?2:4;S.log[d]=Object.assign({},S.log[d],{water:2,steps:9000})});save();Learn.reset();const x=Learn.get().T.find(y=>y.id==='shift');return x&&x.title+' :: '+x.t});
  console.log('zmiana okresu:',sh);
  await p.evaluate(()=>{S.events.push({id:'e2',k:'urlop',from:addDays(todayS(),-8),to:addDays(todayS(),-5),t:''});save();Learn.reset()});
  console.log('urlop pominięty:',await p.evaluate(()=>inEvent(addDays(todayS(),-6))&&Learn.get().nFull<Learn.get().nAll));
  // 6) święta: typ dnia
  console.log('11 listopada 2026 (śr) to dzień wolny:',await p.evaluate(()=>dtypeAuto('2026-11-11')),'| Wielkanoc 2027:',await p.evaluate(()=>[...plHol(2027)].filter(d=>d.slice(5,7)==='03'||d.slice(5,7)==='04').join(', ')));
  // 7) pogoda: włączenie, wyszukanie miasta, pobranie
  await p.evaluate(()=>{ui.asstOpen=false;ui.xp=null;ui.chatTip=null;ui.tab='settings';ui.setSec='pixa';render()});
  await p.click('[data-act=wxon]');await p.fill('#wxq','Kraków');await p.click('[data-act=wxfind]');await w(200);
  await p.click('[data-act=wxpick][data-i="0"]');await w(400);
  console.log('pogoda: zapytanie',geoQ,'| zapisane miasto',await p.evaluate(()=>JSON.stringify(S.settings.wx)),'| dni pogody',await p.evaluate(()=>Object.keys(S.wx).length),'| pobrań',wxCalls);
  {const now=await p.evaluate(()=>Date.now()),d=new Date(now);d.setDate(d.getDate()+1);d.setHours(9,0,0,0);await p.clock.fastForward(d.getTime()-now);await w(50)}
  console.log('deszcz dziś, Pixa rano:',await p.evaluate(()=>{S.wx[todayS()]={r:5,t:7,s:0};const x=Asst.tips().find(t=>t.id.startsWith('wx-'));return x&&x.text}));
  // 8) list od Pixy na początku miesiąca
  await p.evaluate(()=>{const t=todayS(),pm=mstart(addDays(mstart(t),-1)).slice(0,7);S.prof={};S.prof[pm]={ids:['bounce','week'],ti:{bounce:'Szybko się odbijasz',week:'Rytm tygodnia'},at:t};S.letters={};save()});
  const now=await p.evaluate(()=>Date.now());const dec1=new Date(2026,11,2,10,0).getTime();if(dec1>now){await p.clock.fastForward(dec1-now);await w(50)}
  await p.evaluate(()=>{ui.lday=null;render()});
  const lt=await p.evaluate(()=>{const k=Object.keys(S.letters)[0];return k?k+' | '+S.letters[k].t.replace(/\n+/g,' ¶ ').slice(0,300):null});
  console.log('list od Pixy:',lt);
  console.log('Pixa: list do przeczytania:',await p.evaluate(()=>{const x=Asst.tips().find(t=>t.kind==='letter');return x&&x.text}));
  await p.evaluate(()=>{ui.asstOpen=false;ui.tab='charts';render()});await p.click('[data-act=letters]');await w(100);await p.click('.sheet [data-act=letter]');
  console.log('okno listu:',(await p.textContent('.letter')).slice(0,80),'| przeczytany:',await p.evaluate(()=>Object.values(S.letters)[0].read));
  console.log('NaN w Wykresach:',await p.evaluate(()=>{ui.sheet=null;ui.tab='charts';render();return/NaN|undefined/.test(document.getElementById('app').innerHTML)}));
  console.log('errors',errs);await b.close();
})();
