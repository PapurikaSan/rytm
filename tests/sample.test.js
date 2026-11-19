// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Dane przykładowe do wyboru na ekranie powitalnym (30, 100, 365 dni): co widać we wnioskach, profilu, prognozie, listach, zdarzeniach, eksperymentach i pogodzie; brak NaN.
const {chromium}=require('playwright');const stub=require('./stub');
(async()=>{const b=await chromium.launch(),errs=[];
for(const n of ['30','100','365']){const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);const p=await ctx.newPage();p.on('pageerror',e=>errs.push(n+': '+String(e)));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load|favicon/.test(m.text()))errs.push(n+' konsola: '+m.text())});
await p.clock.install({time:new Date(2026,10,19,9,0)});
await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.clock.runFor(500);
await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.clock.runFor(600);
const t0=Date.now();await p.click('[data-act=start][data-n="'+n+'"]');await p.clock.runFor(400);const ms=Date.now()-t0;
const r=await p.evaluate(()=>{ui.tour=null;S.tour='done';const L=Learn.get();return{days:L.days,full:L.nFull+'/'+L.nAll,F:L.F.length,T:L.T.map(x=>x.title+' ['+STR_N[x.s]+']'),fc:!!L.fc,f:Learn.forecast()&&Math.round(Learn.forecast().p*100),acc:JSON.stringify(Learn.fcAcc()),letters:Object.keys(S.letters),ev:S.events.length,exp:S.exp.length,wxF:L.F.filter(x=>x.k==='wx').map(x=>x.t),dose:L.F.filter(x=>x.k==='dose').map(x=>x.t),season:L.F.filter(x=>x.k==='season').length,ch:L.changes,tips:Asst.tips().map(x=>x.kind).join(','),year:(()=>{ui.tab='charts';render();return!!document.getElementById('yr')})()}});
console.log('=== '+n+' dni (start '+ms+' ms)');console.log(JSON.stringify(r,null,1));
console.log('NaN:',await p.evaluate(()=>{const o=[];['today','week','month','charts','goals'].forEach(t=>{ui.tab=t;render();if(/NaN|undefined/.test(document.getElementById('app').innerHTML))o.push(t)});return o}));
await ctx.close()}
console.log('errors',errs);await b.close()})();
