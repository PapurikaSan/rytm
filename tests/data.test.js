// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Łączenie zmian z dwóch urządzeń, cofanie, kopie automatyczne, uzupełnianie dnia z Pixą (także wczoraj).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(300);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(400);
  await p.click('[data-act=start][data-k=template]');await p.waitForTimeout(1300);
  // 1) łączenie: „inne urządzenie” zmienia bazę (nastrój wczoraj, nowy cel), a tu zmieniamy co innego
  const res=await p.evaluate(async()=>{
    const row=window.__db.t.rytm_state.find(r=>r.user_id==='u1'),y=addDays(todayS(),-1);
    const other=JSON.parse(JSON.stringify(row.data));other.mood[y]=2;other.goals.push({id:'g-other',name:'Bieganie',cat:'Ruch',type:'do',period:'week',target:2,variants:[],prio:'imp',groups:[]});
    other.goals.find(g=>g.id==='g-read').target=15;
    row.data=other;row.updated_at=new Date(Date.now()+5000).toISOString();localStorage.setItem('__fakedb',JSON.stringify(window.__db));
    S.mood[todayS()]=5;S.goals.find(g=>g.id==='g-gym').target=4;save();
    await new Promise(r=>setTimeout(r,1500));
    const fin=window.__db.t.rytm_state.find(r=>r.user_id==='u1').data;
    return{moodY:fin.mood[y],moodT:fin.mood[todayS()],goals:fin.goals.map(g=>g.id).join(','),gym:fin.goals.find(g=>g.id==='g-gym').target,read:fin.goals.find(g=>g.id==='g-read').target,local:S.goals.length};
  });
  console.log('1 łączenie:',JSON.stringify(res),'| komunikat:',await p.textContent('#toast'));
  // test reguł łączenia na czysto
  console.log('  konflikt (zmiana tu i tam): wygrywa to urządzenie:',await p.evaluate(()=>mergeState({mood:{a:1}},{mood:{a:3}},{mood:{a:4}}).mood.a===3),
    '| usunięcie tu przy braku zmiany tam:',await p.evaluate(()=>mergeState({log:{d:{x:1}}},{log:{}},{log:{d:{x:1}}}).log.d===undefined),
    '| nowa osoba z tam:',await p.evaluate(()=>mergeState({people:['A']},{people:['A']},{people:['A','B']}).people.join()));
  // 2) cofanie usunięcia celu
  await p.click('.nav [data-t=goals]');await p.click('[data-act=editgoal][data-g=g-eat]');await p.click('[data-act=askdel]');await p.click('[data-act=delgoal]');
  console.log('2 po usunięciu:',await p.evaluate(()=>S.goals.some(g=>g.id==='g-eat')),'| toast:',(await p.textContent('#toast')).trim());
  await p.click('[data-undo]');await p.waitForTimeout(100);console.log('  po Cofnij:',await p.evaluate(()=>S.goals.some(g=>g.id==='g-eat')));
  // 3) kopie automatyczne
  await p.evaluate(()=>{const d=JSON.parse(JSON.stringify(S));d.goals=d.goals.slice(0,1);window.__db.t.rytm_backup=[{user_id:'u1',day:addDays(todayS(),-3),data:d},{user_id:'u1',day:addDays(todayS(),-10),data:d}];localStorage.setItem('__fakedb',JSON.stringify(window.__db));Bk.list=null});
  await p.click('.top [data-t=settings]');await p.waitForTimeout(300);
  console.log('3 kopie na liście:',await p.$$eval('#bkbox .bkrow',e=>e.length));
  await p.click('#bkbox .bkrow .btn');await p.click('[data-act=bkrestore]');await p.waitForTimeout(200);
  console.log('  po przywróceniu celów:',await p.evaluate(()=>S.goals.length),'| toast:',(await p.textContent('#toast')).trim());
  await p.click('[data-undo]');await p.waitForTimeout(100);console.log('  po Cofnij celów:',await p.evaluate(()=>S.goals.length));
  // 4) Pixa: wczoraj bez wpisów (sen, czytanie, zdrowe jedzenie)
  await p.evaluate(()=>{const y=addDays(todayS(),-1);S.log[addDays(y,-2)]={'g-sleep':7};delete S.log[y];S.asst.ck={};save();render()});
  await p.click('.nav [data-t=today]');await p.click('.hal');await p.waitForTimeout(300);
  for(let i=0;i<4&&!(await p.textContent('.pxtxt')).includes('Wczoraj');i++)await p.click('[data-asst=next]');
  console.log('4 pytanie:',(await p.textContent('.pxtxt')).trim());
  await p.click('.pxact .btn:text("Uzupełnij")');await p.waitForTimeout(200);
  const steps=[];
  for(let i=0;i<6;i++){const t=(await p.textContent('.pxbub')).replace(/\s+/g,' ').trim();steps.push(t.slice(0,70));
    if(t.includes('Gotowe'))break;
    if(await p.isVisible('[data-asst=ckyes]'))await p.click('[data-asst=ckyes]');
    else if(t.includes('Sen'))await p.click('[data-asst=ckv] >> nth=1');
    else{await p.fill('#ckin','15');await p.press('#ckin','Enter')}
    await p.waitForTimeout(150)}
  steps.forEach(x=>console.log('   ',x));
  console.log('  zapisane wczoraj:',await p.evaluate(()=>JSON.stringify(S.log[addDays(todayS(),-1)])));
  await p.click('[data-asst=ckend]');await p.waitForTimeout(100);
  console.log('  pytanie o wczoraj zniknęło:',!(await p.evaluate(()=>Asst.tips().some(t=>t.kind==='yesterday'))));
  console.log('ov',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth));
  console.log('errors',JSON.stringify(errs));await b.close();
})();
