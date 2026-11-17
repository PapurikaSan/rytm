// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Dymki Pixy w zakładkach, charakter (łagodna/twarda), uzupełnianie z powiadomienia (#pixa-fill),
// podsumowanie miesiąca, kamienie milowe w grupie znajomych, nowe pozy.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),os=require('os');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  const w=ms=>p.clock.runFor(ms);
  const say=async()=>(await p.isVisible('.pxsay'))?(await p.textContent('.pxsay .pxsayt')).replace(/^Pixa\s*/,'').trim():'(brak dymka)';
  const tab=async t=>{await p.click('.nav [data-t='+t+'], .top [data-t='+t+']');await w(600)};
  // wtorek 1 grudnia 2026, 8:30
  await p.clock.install({time:new Date(2026,11,1,8,30,0)});
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await w(500);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await w(600);
  await p.click('[data-act=start][data-k=template]');await w(300);
  await p.evaluate(()=>{ui.tour=null;S.tour='done';render()});
  // listopad z danymi
  await p.evaluate(()=>{const t=todayS();for(let k=1;k<=35;k++){const d=addDays(t,-k);S.log[d]={'g-sleep':k%4?7.5:5.5,'g-eat':1,'g-read':k%3?25:10};if(k%2)S.log[d]['g-gym']=1;S.mood[d]=k%5?4:3}save();render()});await w(800);

  // 1) podsumowanie miesiąca
  console.log('1 dla serwera:',JSON.stringify(await p.evaluate(()=>S.msum['2026-11-01'])));
  console.log('  Pixa:',await p.evaluate(()=>Asst.tips().filter(x=>x.kind==='monthly').map(x=>x.text+' ['+x.actions.map(a=>a.l)+']').join('')));
  console.log('  przypomnienia:',await p.evaluate(()=>S.settings.reminders.map(r=>r.kind).join(', ')));

  // 2) dymki w zakładkach
  await w(1200);console.log('2 Dziś (start):',await say());
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-say-today.png')});
  const before=await p.evaluate(()=>JSON.stringify((S.asst.plan||{})[todayS()]||{}));
  if(await p.isVisible('.pxsay [data-asst=sayact]')){await p.click('.pxsay [data-asst=sayact][data-j="0"]');await w(200)}
  console.log('  po „Tak”: plan',before,'→',await p.evaluate(()=>JSON.stringify((S.asst.plan||{})[todayS()]||{})),'| toast:',(await p.textContent('#toast')).trim());
  for(const t of ['charts','cal','goals','friends']){await tab(t);if(t==='friends'){await w(1500)}console.log('  '+t+':',await say())}
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-say-friends.png')});
  await tab('settings');console.log('  settings:',await say());
  // pętla: kolejne wejścia dają kolejne zdania
  const seq=[];for(let i=0;i<4;i++){await p.clock.fastForward(21000);await tab('today');seq.push(await say())}
  console.log('  kolejne wejścia w Dziś:',seq.join(' || '));
  console.log('  różne zdania:',new Set(seq).size,'z',seq.length);
  // dotknięcie dymka otwiera panel z tym zdaniem
  await p.clock.fastForward(21000);await tab('charts');const st=await say();await p.click('.pxsay .pxsayt');await w(200);
  console.log('  dotknięcie dymka → panel:',await p.isVisible('.pxpanel'),'| ten sam tekst:',(await p.textContent('.pxpanel .pxtxt')).trim()===st);
  await p.click('.pxclose');await w(100);

  // 3) charakter: twarda
  await p.evaluate(()=>{S.settings.pixaTone='hard';save()});
  console.log('3 twarda, podpowiedzi:',await p.evaluate(()=>Asst.tips().slice(0,3).map(x=>x.text).join(' | ')));
  await p.clock.fastForward(21000);await tab('today');console.log('  dymek:',await say());
  await p.click('[data-act=tab][data-t=settings]');await p.evaluate(()=>{ui.setSec='pixa';render()});await w(100);
  console.log('  Ustawienia: charakter',await p.textContent('.seg [data-act=pxtone].on'),'| dymki',await p.getAttribute('[data-act=pxchat]','aria-checked'));
  await p.click('[data-act=pxtone][data-k=soft]');await w(100);
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-pixa-settings.png')});

  // 4) uzupełnianie z powiadomienia
  await p.click('.nav [data-t=today]');await w(200);
  await p.evaluate(()=>{location.hash='#pixa-fill'});await w(400);
  console.log('4 #pixa-fill: panel',await p.isVisible('.pxpanel'),'|',(await p.textContent('.pxpanel .pxstep')).trim(),'|',(await p.textContent('.pxpanel .pxtxt')).trim());
  await p.click('[data-asst=ckmood][data-v="4"]');await w(150);
  console.log('  nastrój zapisany:',await p.evaluate(()=>S.mood[todayS()]),'| następne:',(await p.textContent('.pxpanel .pxtxt')).trim());
  await p.click('[data-asst=ckend]');await w(100);await p.click('.pxclose');await w(100);

  // 5) wieczorem: sprawdzenie planu z rana
  await p.clock.fastForward(10*3600*1000);await w(100);
  const items=await p.evaluate(()=>{const x=[];return x});
  await p.evaluate(()=>{localStorage.removeItem('rytm-chat-seen')});
  await p.click('.nav [data-t=goals]');await w(300);await p.click('.nav [data-t=today]');await w(600);
  console.log('5 wieczorem:',await say());
  if(await p.isVisible('.pxsay [data-asst=sayact]')&&(await say()).includes('Rano')){const id=await p.evaluate(()=>ui.say&&ui.say.id);await p.click('.pxsay [data-asst=sayact][data-j="0"]');await w(200);console.log('  po „Tak”:',id,await p.evaluate(id=>{const g=id.slice(3,id.length-10);return g+'='+val(g,todayS())},id))}

  // 6) kamienie milowe w grupie
  await p.click('.nav [data-t=friends]');await w(1200);
  if(await p.isVisible('#soc-name')){await p.fill('#soc-name','Jan');await p.click('[data-soc=saveprofile]');await w(400)}
  await p.fill('#soc-gname','Ekipa');await p.click('[data-soc=create]');await w(800);
  await p.click('[data-soc=msshare]');await w(2500);
  const row=await p.evaluate(()=>{const db=JSON.parse(localStorage.getItem('__fakedb'));return JSON.stringify(((db.t.rytm_share)||[]).filter(r=>r.goal_id==='_ms').map(r=>({groups:r.groups.length,list:r.data.list.map(x=>x.t)})))});
  console.log('6 udostępnione kamienie:',row);
  console.log('  karta w grupie:',(await p.isVisible('.card:has(h3:text("Kamienie milowe w grupie"))'))?(await p.textContent('.card:has(h3:text("Kamienie milowe w grupie"))')).replace(/\s+/g,' ').slice(0,160):'(brak)');
  console.log('  prywatne nie wychodzą (sen, jedzenie):',!/Sen|jedzenie/.test(row));
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-friends-ms.png'),fullPage:true});

  // 7) wszystkie pozy rysują się bez błędów
  console.log('7 pozy:',await p.evaluate(()=>{const c=document.createElement('canvas');c.width=88;c.height=126;let n=0;Object.keys(PixaArt.POSES).forEach(k=>{for(let f=0;f<40;f++)PixaArt.draw(c,f,k,null,'holo');n++});return n}));
  console.log('errors',errs);await b.close();
})();
