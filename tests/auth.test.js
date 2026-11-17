// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const errs=[];
 await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8')}));
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/fonts|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8765/');await p.waitForTimeout(500);
 
 console.log('1 login screen:',await p.isVisible('#authform h3:text("Zaloguj się")'));
 await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','zle');await p.click('#authform button[type=submit]');await p.waitForTimeout(200);
 console.log('2 wrong password:',(await p.textContent('.authmsg')).trim());
 await p.click('[data-auth=mode][data-m=signup]');await p.fill('#a-email','nowy@example.com');await p.fill('#a-pass','krotkie');await p.click('#authform button[type=submit]');
 console.log('3 short pass:',(await p.textContent('.authmsg')).trim());
 console.log('3b email kept:',await p.inputValue('#a-email'));await p.fill('#a-pass','dlugiehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(200);
 console.log('4 signup:',(await p.textContent('.authmsg')).trim().slice(0,80));
 console.log('4b login prefilled:',await p.inputValue('#a-email'));await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(400);
 console.log('5 welcome:',await p.isVisible('text=Witaj w Rytmie'));
 await p.click('[data-act=start][data-k=template]');await p.waitForTimeout(200);
 console.log('6 today goals:',(await p.$$eval('#app .goal .gn',e=>e.map(x=>x.textContent))).length,'sample banner:',await p.isVisible('text=Dane przykładowe'));
 await p.click('[data-act=mood][data-v="5"]');await p.click('#row-eat [data-act=toggle]');await p.waitForTimeout(1200);
 console.log('7 saved:',await p.textContent('#sync'),'upserts:',await p.evaluate(()=>window.__upserts),'db mood:',await p.evaluate(()=>JSON.stringify(window.__db.t.rytm_state.find(r=>r.user_id==='u1').data.mood)));
 
 // odświeżenie: dane z bazy, a nie z pamięci podręcznej
 await p.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('rytm-cache'))localStorage.removeItem(k)});
 await p.reload();await p.waitForTimeout(600);
 console.log('8 after reload mood on:',await p.isVisible('.mb.on'),'eat checked:',await p.isVisible('#row-eat .chk.on'));
 // inne urządzenie: nowa przeglądarka bez pamięci podręcznej, ta sama baza
 const db=await p.evaluate(()=>localStorage.getItem('__fakedb'));
 const ctx2=await b.newContext({viewport:{width:1280,height:900}});await ctx2.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8')}));
 const p2=await ctx2.newPage();await p2.goto('http://localhost:8765/');await p2.evaluate(d=>localStorage.setItem('__fakedb',d),db);await p2.reload();await p2.waitForTimeout(300);
 await p2.fill('#a-email','jan@example.com');await p2.fill('#a-pass','dobrehaslo1');await p2.click('#authform button[type=submit]');await p2.waitForTimeout(500);
 console.log('9 laptop sees mood:',await p2.isVisible('.mb.on'));
 // ustawienia: konto + wylogowanie
 await p.click('.top [data-t=settings]');console.log('10 account:',(await p.textContent('.card:has(h3:text("Konto")) .sub')).trim());
 await p.click('[data-auth=logout]');await p.waitForTimeout(300);console.log('11 logged out:',(await p.textContent('.authmsg')).trim());
 console.log('manifest ok:',(await (await p.request.get('http://localhost:8765/manifest.webmanifest')).json()).name);
 console.log('ov',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth));
 console.log('errors',JSON.stringify(errs));await b.close();
})();
