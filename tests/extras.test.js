// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Przewodnik dla nowych osób, podsumowanie tygodnia od Pixy (poniedziałek) i kamienie milowe.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),os=require('os');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  const w=ms=>p.clock.runFor(ms);
  // poniedziałek 16 listopada 2026, 10:00
  await p.clock.install({time:new Date(2026,10,16,10,0,0)});
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await w(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await w(600);
  await p.click('[data-act=start][data-k=template]');await w(300);

  // 1) przewodnik
  console.log('1 przewodnik po starcie:',await p.isVisible('#tour .pxpanel'),'|',(await p.textContent('#tour .tstep')),'| soczewka ukryta:',!(await p.isVisible('.hal')));
  const steps=[];
  for(let i=0;i<9;i++){
    const st=await p.evaluate(()=>({tab:ui.tab,hl:(document.querySelector('.tourhl')||{}).className||'',h:document.querySelector('#tour .pxtxt b').textContent,hal:!!document.querySelector('#asst .hal')}));
    steps.push(st.h+' ['+st.tab+(st.hl?', podświetlone':'')+(st.hal?', soczewka':'')+']');
    if(i===8){await p.screenshot({path:path.join(os.tmpdir(),'rytm-tour-last.png')})}
    if(i===2){await p.screenshot({path:path.join(os.tmpdir(),'rytm-tour-2.png')})}
    if(i===7){await p.screenshot({path:path.join(os.tmpdir(),'rytm-tour-lens.png')})}
    await p.click('#tour [data-tour=next]');await w(150);
  }
  console.log('  kroki:',steps.join(' → '));
  console.log('  po końcu: widoczny',await p.isVisible('#tour .pxpanel'),'| S.tour',await p.evaluate(()=>S.tour),'| zakładka',await p.evaluate(()=>ui.tab),'| soczewka',await p.isVisible('.hal'));
  await w(1500);await p.reload();await w(800);
  console.log('  po odświeżeniu przewodnik:',await p.isVisible('#tour .pxpanel'));
  await p.click('[data-act=tab][data-t=settings]');await p.click('[data-act=setsec][data-k=pixa]');await p.click('[data-act=tour]');await w(150);
  console.log('  z Ustawień:',await p.isVisible('#tour .pxpanel'),(await p.textContent('#tour .tstep')));
  await p.click('#tour [data-tour=next]');await w(100);await p.click('#tour [data-tour=back]');await w(100);console.log('  wstecz:',await p.textContent('#tour .tstep'));
  await p.click('#tour [data-tour=skip]');await w(100);console.log('  pominięty:',!(await p.isVisible('#tour .pxpanel')));

  // przypomnienie poniedziałkowe w Ustawieniach
  await p.click('[data-act=tab][data-t=settings]');await p.evaluate(()=>{ui.setSec='pixa';render()});await w(100);
  console.log('  przypomnienia:',await p.evaluate(()=>S.settings.reminders.map(r=>r.kind+' '+r.time+' '+JSON.stringify(r.days)).join(' | ')));
  console.log('  wiersz poniedziałkowy bez dni tygodnia:',await p.evaluate(()=>{const r=[...document.querySelectorAll('.rrow')].find(x=>x.textContent.includes('Podsumowanie tygodnia'));return !!r&&!r.querySelector('.rdays')}));

  // 2) kamienie milowe: 9 treningów, potem dziesiąty
  await p.evaluate(()=>{S.settings.pixaChat=false;ui.say=null;render()}); // dymki mają osobny test
  await p.click('[data-act=tab][data-t=today]');await w(100);
  await p.evaluate(()=>{const t=todayS();for(let k=1;k<=20;k++){const d=addDays(t,-k);S.log[d]=S.log[d]||{};if(k<=9)S.log[d]['g-gym']=1;S.log[d]['g-read']=25;S.log[d]['g-sleep']=7.5;S.log[d]['g-eat']=1;S.mood[d]=4}save();render()});
  await w(600);
  console.log('2 kamienie po 9 treningach:',await p.evaluate(()=>Object.keys(S.ms).filter(k=>!S.ms[k].q).map(k=>S.ms[k].t).join(' | ')));
  await p.evaluate(()=>{S.log[todayS()]=S.log[todayS()]||{};S.log[todayS()]['g-gym']=1;save();render()});await w(600);
  console.log('  toast:',(await p.textContent('#toast')).trim(),'| soczewka świeci:',await p.evaluate(()=>!!document.querySelector('.hal.on')));
  const mtip=await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='milestone').map(x=>x.text));console.log('  Pixa:',mtip.join(' | '));
  await p.click('.hal');await w(150);console.log('  w panelu:',(await p.textContent('.pxtxt')).trim());
  await p.click('.pxact .btn:text("Dzięki!")');await w(150);
  console.log('  po „Dzięki!” zostało podpowiedzi o kamieniach:',await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='milestone').length));
  await p.click('.pxclose');
  await p.click('[data-act=tab][data-t=charts]');await w(150);
  console.log('  Wykresy:',(await p.textContent('.card:has(.msh)')).replace(/\s+/g,' ').slice(0,260));
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-ms.png'),fullPage:false,clip:{x:0,y:0,width:390,height:844}});
  // istniejące konto z historią: kamienie zapisane po cichu, bez zasypywania
  await p.evaluate(()=>{S.ms={};S.msInit=false;const t=todayS();for(let k=21;k<=200;k++){const d=addDays(t,-k);S.log[d]={'g-gym':k%2,'g-read':25,'g-sleep':7.5,'g-eat':1}}save()});await w(600);
  console.log('  stara historia: zapisane',await p.evaluate(()=>Object.keys(S.ms).length),'| ciche',await p.evaluate(()=>Object.values(S.ms).filter(m=>m.q).length),'| podpowiedzi',await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='milestone').length));

  // 3) podsumowanie zeszłego tygodnia
  await p.evaluate(()=>{const ws=addDays(wstart(todayS()),-7);S.log[addDays(ws,2)]['g-sleep']=5;S.log[addDays(ws,3)]['g-sleep']=5;save()});await w(300);
  const sum=await p.evaluate(()=>S.wsum[addDays(wstart(todayS()),-7)]);
  console.log('3 dla serwera:',JSON.stringify(sum));
  const wt=await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='weekly').map(x=>x.text+' ['+x.actions.map(a=>a.l).join(', ')+']'));console.log('  Pixa:',wt.join(''));
  await w(1500);
  await p.goto('http://localhost:8765/#pixa-week');await w(800);
  console.log('  z powiadomienia: panel',await p.isVisible('.pxpanel'),'|',(await p.textContent('.pxtxt')).trim().slice(0,70));
  await p.click('.pxact .btn:text("Zobacz tydzień")');await w(150);
  console.log('  przycisk prowadzi do:',await p.evaluate(()=>ui.tab+' '+ui.wk));
  // wtorek: nadal widać, środa: już nie
  await p.clock.fastForward(2*24*3600*1000);
  console.log('  w środę:',await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='weekly').length));
  console.log('errors',errs);await b.close();
})();
