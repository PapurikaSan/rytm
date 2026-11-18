// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
const {chromium,devices}=require('playwright');const stub=require('./stub');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
const stubPush=`(()=>{let perm='default';Object.defineProperty(Notification,'permission',{get:()=>perm});Notification.requestPermission=async()=>{perm='granted';return 'granted'};let sub=null;const mk=()=>({endpoint:'https://push.example/abc',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'x',auth:'y'}}},unsubscribe:async()=>{sub=null;return true}});
 PushManager.prototype.getSubscription=async function(){return sub};PushManager.prototype.subscribe=async function(o){window.__appKeyLen=o.applicationServerKey.length;sub=mk();return sub};})();`;
(async()=>{
 const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.grantPermissions(['notifications'],{origin:'http://localhost:8765'});
 await stub(ctx);await ctx.addInitScript(stubPush);
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/fonts|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(300);
 await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(400);
 await p.click('[data-act=start][data-k=template]');await p.waitForTimeout(200);
 await p.click('.top [data-t=settings]');await p.click('[data-act=setsec][data-k=pixa]');await p.waitForTimeout(500);
 console.log('1 box:',(await p.textContent('#pushbox')).trim());
 await p.click('[data-push=on]');await p.waitForTimeout(500);
 console.log('2 after on:',(await p.textContent('#pushbox')).trim(),'| key bytes:',await p.evaluate(()=>window.__appKeyLen),'| row:',await p.evaluate(()=>!!(window.__db.t.rytm_push&&window.__db.t.rytm_push[0]&&window.__db.t.rytm_push[0].endpoint)));
 await p.click('[data-push=test]');await p.waitForTimeout(300);console.log('3 test:',(await p.textContent('#pushbox .authmsg')).trim(),'| invokes:',await p.evaluate(()=>window.__inv.join(',')));
 await p.fill('#rt-r1','21:30');await p.click('.brand');await p.click('[data-act=rday][data-i="0"][data-j="6"]');
 await p.click('[data-act=radd]');await p.fill('input[id^="rx-"]','Wpisz wagę');await p.click('.brand');await p.waitForTimeout(1200);
 console.log('4 saved reminders:',await p.evaluate(()=>JSON.stringify(window.__db.t.rytm_state.find(r=>r.user_id==='u1').data.settings.reminders.map(r=>[r.kind,r.time,r.days.length,r.on,r.text||'']))),'tz:',await p.evaluate(()=>window.__db.t.rytm_state.find(r=>r.user_id==='u1').data.settings.tz));
 
 await p.click('[data-push=off]');await p.waitForTimeout(300);console.log('5 off:',(await p.textContent('#pushbox')).trim().slice(0,60),'| rows:',await p.evaluate(()=>(window.__db.t.rytm_push||[]).length));
 // iPhone w Safari (nie z ekranu początkowego)
 const ip=await b.newContext({...devices['iPhone 13']});await stub(ip);
 const q=await ip.newPage();await q.goto('http://localhost:8765/');await q.fill('#a-email','jan@example.com');await q.fill('#a-pass','dobrehaslo1');await q.click('#authform button[type=submit]');await q.waitForTimeout(400);
 if(await q.isVisible('[data-act=start]'))await q.click('[data-act=start][data-k=template]');
 await q.click('.top [data-t=settings]');await q.click('[data-act=setsec][data-k=pixa]');await q.waitForTimeout(400);console.log('6 iPhone Safari:',(await q.textContent('#pushbox')).trim().slice(0,90));
 console.log('ov',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth));
 console.log('errors',JSON.stringify(errs));await b.close();
})();
