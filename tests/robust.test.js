// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Odporność: zmiana rodzaju celu z zaznaczania na ilość, zakres i pomiar przy istniejących wpisach nie psuje wykresów ani ekranów (brak NaN).
const {chromium}=require('playwright');const stub=require('./stub');const fs=require('fs');
const fake=fs.readFileSync(require('path').join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{const b=await chromium.launch(),errs=[];const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text().slice(0,120))});
await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(600);
await p.click('[data-act=start][data-k=sample]');await p.waitForTimeout(400);await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;render()});
// Trening (zaznaczanie z rodzajami) zmieniony na ilość i na zakres
const r=await p.evaluate(()=>{const out=[];for(const ty of ['qty','range','measure']){const g=S.goals.find(x=>x.id==='gym');g.type=ty;g.period=ty==='measure'?'week':'day';g.target=ty==='range'?60:30;g.unit='min';g.ok=10;g.warn=20;save();
 for(const m of ['d','w','m']){ui.tab='charts';ui.mode=m;ui.cg='gym';render();if(/NaN|Infinity/.test(document.getElementById('app').innerHTML))out.push(ty+' '+m+' wykres')}
 ui.tab='today';render();if(/NaN|Infinity/.test(document.getElementById('app').innerHTML))out.push(ty+' dziś');ui.tab='week';render();if(/NaN/.test(document.getElementById('app').innerHTML))out.push(ty+' tydzień')}return out});
console.log('NaN po zmianie rodzaju celu:',r.length?r:'brak');console.log('errors',errs);await b.close()})();
