// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// „Klikanie wszystkiego”: każda zakładka, sekcja Ustawień, okno i przycisk, potem setki losowych kliknięć
// w obu motywach, na danych przykładowych. Każdy błąd strony albo konsoli kończy się wpisem w errors.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
const N=+(process.argv[2]||400);
// akcje, które wylogowują, przeładowują stronę albo kasują wszystko: sprawdzane osobno w innych testach
const SKIP=new Set(['resetgo','logout','wipe','delgroup','leave','xfergo']);
(async()=>{
  const b=await chromium.launch(),errs=[];
  for(const dark of [true,false]){
    const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:dark?'dark':'light'});
    await ctx.route(/supabase-js/,r=>r.fulfill({contentType:'application/javascript',body:fake}));
    const p=await ctx.newPage(),tag=dark?'ciemny':'jasny';
    p.on('pageerror',e=>errs.push(tag+': '+String(e).slice(0,200)));
    p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource|fonts\.g/.test(m.text()))errs.push(tag+' konsola: '+m.text().slice(0,200))});
    p.on('dialog',d=>d.dismiss());
    await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
    await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(600);
    await p.click('[data-act=start][data-k=sample]');await p.waitForTimeout(500);
    // 1) przewodnik od początku do końca
    for(let i=0;i<12&&await p.isVisible('#tour [data-tour=next]');i++){await p.click('#tour [data-tour=next]');await p.waitForTimeout(80)}
    // 2) systematycznie: zakładki, widoki, sekcje, okna
    const tabs=['today','week','month','charts','friends','goals','settings'];
    const t0=Date.now();
    for(const t of tabs){await p.evaluate(t=>{ui.tab=t;ui.sheet=null;render()},t);await p.waitForTimeout(150)}
    for(const k of ['acc','goals','pixa','look','data'])await p.evaluate(k=>{ui.tab='settings';ui.setSec=k;render()},k);
    for(const m of ['d','w','m'])await p.evaluate(m=>{ui.tab='charts';ui.mode=m;render()},m);
    await p.evaluate(()=>{ui.tab='charts';S.goals.forEach(g=>{ui.cg=g.id;render()})});
    for(let i=0;i<14;i++)await p.evaluate(()=>{ui.tab='week';ui.wk=-Math.floor(Math.random()*20);render();ui.tab='month';ui.mo=-Math.floor(Math.random()*6);render();ui.tab='today';ui.date=addDays(todayS(),-Math.floor(Math.random()*120));render()});
    await p.evaluate(()=>{S.goals.forEach(g=>{openGoal(g.id);renderSheet()});ui.sheet=null;render();openGoal(null);ui.sheet=null;render()});
    // 3) Pixa: każda podpowiedź, narzędzia
    await p.evaluate(()=>{ui.tab='today';ui.date=todayS();ui.sheet=null;ui.asstOpen=true;render()});await p.waitForTimeout(200);
    for(let i=0;i<12&&await p.isVisible('[data-asst=next]');i++){await p.click('[data-asst=next]');await p.waitForTimeout(60)}
    if(await p.isVisible('[data-asst=btool]')){await p.click('[data-asst=btool]');await p.waitForTimeout(300);await p.click('[data-asst=bclose]').catch(()=>{})}
    if(await p.isVisible('[data-asst=ftool]')){await p.click('[data-asst=ftool]');await p.waitForTimeout(100);await p.click('[data-asst=fstart]').catch(()=>{});await p.waitForTimeout(200);await p.click('[data-asst=fcancel]').catch(()=>{})}
    await p.click('[data-asst=close]').catch(()=>{});
    // 4) losowe klikanie
    let clicks=0;const seen={};
    for(let i=0;i<N;i++){
      const pick=await p.evaluate(skip=>{
        const els=[...document.querySelectorAll('[data-act],[data-asst],[data-soc],[data-tour],.nav button')].filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height||e.disabled)return false;const a=e.dataset.act||e.dataset.soc||e.dataset.asst||e.dataset.tour;return !skip.includes(a)});
        if(!els.length)return null;const e=els[Math.floor(Math.random()*els.length)];e.setAttribute('data-mk','1');return e.dataset.act||e.dataset.soc||e.dataset.asst||e.dataset.tour||'nav';
      },[...SKIP]);
      if(!pick)break;seen[pick]=(seen[pick]||0)+1;
      await p.click('[data-mk="1"]',{timeout:2000,force:true}).catch(()=>{});
      await p.evaluate(()=>document.querySelectorAll('[data-mk]').forEach(e=>e.removeAttribute('data-mk')));
      // czasem coś wpisz w widoczne pole liczbowe
      if(Math.random()<.15)await p.evaluate(()=>{const n=[...document.querySelectorAll('input.num,input.inp')].filter(e=>e.offsetParent&&e.type!=='time'&&e.type!=='date');if(n.length){const e=n[Math.floor(Math.random()*n.length)];e.value=String(Math.round(Math.random()*30));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}});
      clicks++;await p.waitForTimeout(25);
    }
    await p.waitForTimeout(1500);
    // wykresy wszystkich celów we wszystkich zakresach nie mogą mieć „NaN”
    const nan=await p.evaluate(()=>{const out=[];S.goals.forEach(g=>['d','w','m'].forEach(m=>{ui.tab='charts';ui.mode=m;ui.cg=g.id;ui.sheet=null;render();if(/NaN|Infinity/.test(document.getElementById('app').innerHTML))out.push(m+' '+JSON.stringify(g).slice(0,300))}));return out});
    if(nan.length)errs.push(tag+' NaN w wykresach: '+nan.slice(0,3).join(' || '));
    const st=await p.evaluate(()=>({goals:S.goals.length,badNames:S.goals.filter(g=>typeof g.name!=='string'||typeof g.cat!=='string').length,ov:document.documentElement.scrollWidth>window.innerWidth}));
    console.log(tag+': '+clicks+' kliknięć, '+Object.keys(seen).length+' różnych akcji, '+((Date.now()-t0)/1000).toFixed(0)+' s; cele '+st.goals+', zepsute nazwy '+st.badNames+', poziome przewijanie '+st.ov);
    await ctx.close();
  }
  console.log('errors',JSON.stringify(errs.slice(0,30)));await b.close();
})();
