// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Dwie osoby: Jan tworzy grupę i udostępnia siłownię, Ola dołącza linkiem, porównują się, piątka i wyzwanie.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');const URL='http://localhost:8765/';
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push('jan: '+e));
  const login=async(pg,em,pw)=>{await pg.fill('#a-email',em);await pg.fill('#a-pass',pw);await pg.click('#authform button[type=submit]');await pg.waitForTimeout(400);if(await pg.isVisible('[data-act=start]')){await pg.click('[data-act=start][data-k=sample]');await pg.waitForTimeout(300)}};
  await p.goto(URL);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(300);
  await login(p,'jan@example.com','dobrehaslo1');
  // katalog: dopasowania
  console.log('1 dopasowania:',JSON.stringify(await p.evaluate(()=>['silka 3x','Trening','scianka','siłowina','Czytanie książki','gra na gitarze','Bieganie rano'].map(n=>[n,matchAct(n).map(x=>x.c.n+':'+x.s).join('|')]))));
  console.log('2 cele z aktywnością:',await p.evaluate(()=>S.goals.filter(catOk).length+'/'+S.goals.length));
  // znajomi: profil, grupa
  await p.click('.nav [data-t=friends]');await p.waitForTimeout(300);
  await p.fill('#soc-name','Jan');await p.click('[data-soc=saveprofile]');await p.waitForTimeout(200);
  await p.fill('#soc-gname','Ekipa ze ścianki');await p.click('[data-soc=create]');await p.waitForTimeout(400);
  const code=await p.textContent('.invite b');console.log('3 grupa i kod:',await p.textContent('.card h3'),code);
  // udostępnij siłownię tej grupie przez edytor
  await p.click('.nav [data-t=goals]');await p.click('[data-act=editgoal][data-g=gym]');
  console.log('4 edytor:',(await p.textContent('#actbox')).trim().slice(0,50));
  await p.click('[data-act=gshare]');await p.click('#gsave');await p.waitForTimeout(2200);
  console.log('5 udostępnienie w bazie:',await p.evaluate(()=>JSON.stringify((window.__db.t.rytm_share||[]).map(s=>[s.user_id,s.act,s.groups.length,s.data.days.length,s.data.target]))));
  // Ola dołącza linkiem
  const db=await p.evaluate(()=>localStorage.getItem('__fakedb'));
  const ctx2=await b.newContext({viewport:{width:390,height:844}});await ctx2.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
  const q=await ctx2.newPage();q.on('pageerror',e=>errs.push('ola: '+e));
  await q.goto(URL);await q.evaluate(d=>{localStorage.clear();localStorage.setItem('__fakedb',d)},db);await q.goto('about:blank');await q.goto(URL+'#join-'+code.trim());await q.waitForTimeout(300);
  await login(q,'ola@example.com','dobrehaslo2');
  console.log('6 Ola po zalogowaniu:',await q.evaluate(()=>ui.tab));
  await q.fill('#soc-name','Ola');await q.click('[data-soc=saveprofile]');await q.waitForTimeout(200);
  await q.click('[data-soc=joinpending]');await q.waitForTimeout(400);
  console.log('7 Ola w grupie:',(await q.textContent('.card .sub')).trim());
  await q.click('.nav [data-t=goals]');await q.click('[data-act=editgoal][data-g=gym]');await q.click('[data-act=gshare]');await q.click('#gsave');await q.waitForTimeout(2200);
  await q.click('.nav [data-t=friends]');await q.waitForTimeout(300);
  console.log('8 ranking Oli:',(await q.$$eval('.rk',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()))).join(' | '));
  await q.click('[data-soc=metric][data-m=month]');console.log('9 miesiąc:',(await q.$$eval('.rk .rkv',e=>e.map(x=>x.textContent))).join(', '));
  await q.click('[data-soc=kudos]');await q.waitForTimeout(200);console.log('10 piątka:',await q.textContent('#toast'),'| przycisk:',await q.textContent('.rk [data-soc=kudos]'));
  // wyzwanie
  await q.click('[data-soc=newch]');await q.fill('#ch-name','Listopad: razem 30 treningów');await q.fill('#ch-target','30');
  await q.fill('#ch-start',await q.evaluate(()=>mstart(todayS())));await q.click('#chsave');await q.waitForTimeout(400);
  console.log('11 wyzwanie:',(await q.textContent('.card:has(h3:text("Wspólne wyzwania")) .lt')).replace(/\s+/g,' ').trim().slice(0,160));
  await q.screenshot({path:path.join(require('os').tmpdir(),'rytm-friends.png'),fullPage:true});
  // Jan widzi piątkę i ranking
  const db2=await q.evaluate(()=>localStorage.getItem('__fakedb'));await p.evaluate(d=>localStorage.setItem('__fakedb',d),db2);await p.reload();await p.waitForTimeout(600);
  await p.click('.nav [data-t=friends]');await p.waitForTimeout(300);
  console.log('12 Jan widzi piątki:',(await p.textContent('.card:has(h3:text("Piątki dla Ciebie"))')).replace(/\s+/g,' ').trim());
  // prywatność: prywatna aktywność nie do udostępnienia
  await p.click('.nav [data-t=goals]');await p.click('[data-act=editgoal][data-g=alc]');console.log('13 alkohol:',(await p.textContent('.sheet')).includes('prywatna i nie da się jej udostępnić'));
  console.log('ov',await q.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth));
  console.log('errors',JSON.stringify(errs));await b.close();
})();
