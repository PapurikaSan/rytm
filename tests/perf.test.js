// Pomiar szybkości: ile trwa narysowanie każdego widoku i zapis przy 110 dniach (dane przykładowe) i przy 2 latach danych.
// Uruchom serwer w katalogu repo: python3 -m http.server 8765
const {chromium}=require('playwright');const stub=require('./stub');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(600);
  await p.click('[data-act=start][data-k=sample]');await p.waitForTimeout(500);
  await p.evaluate(()=>{ui.tour=null;S.tour='done';S.settings.pixaChat=false;S.settings.anim=false;render()});
  const measure=()=>p.evaluate(()=>{
    const T=f=>{const a=performance.now();for(let i=0;i<5;i++)f();return +((performance.now()-a)/5).toFixed(1)};const o={};
    for(const t of ['today','week','month','charts','goals','settings'])o[t]=T(()=>{ui.tab=t;render()});
    for(const t of ['today','week','charts'])o[t+'_po_zmianie']=T(()=>{const g=S.goals[0],d=todayS();setVal(g.id,d,num(val(g.id,d))?0:1);ui.tab=t;render()});
    o.zapis=T(()=>{save()});o.kamienie=T(()=>Ms.compute());o.podpowiedzi=T(()=>Asst.tips());o.seria=T(()=>streak());o.rekord=T(()=>bestStreak());
    ui.tab='today';render();return o});
  console.log('110 dni:',JSON.stringify(await measure()));
  // 2 lata danych na tych samych celach
  await p.evaluate(()=>{const t=todayS(),keys=Object.keys(S.log).sort(),n=keys.length;for(let k=111;k<=730;k++){const d=addDays(t,-k),src=S.log[keys[k%n]];if(src)S.log[d]=JSON.parse(JSON.stringify(src));S.mood[d]=3+(k%3)}});
  console.log('2 lata:',JSON.stringify(await measure()));
  console.log('rozmiar stanu (KB):',await p.evaluate(()=>Math.round(JSON.stringify(S).length/1024)));
  console.log('errors',errs);await b.close();
})();
