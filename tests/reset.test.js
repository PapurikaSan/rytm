// Test przeglądarkowy z atrapą Supabase. Uruchom serwer w katalogu repo: python3 -m http.server 8765
// Pixa zostaje otwarta przy przejściach i oknach, pełny reset konta (ekran powitalny, dane w bazie usunięte).
const {chromium}=require('playwright');const stub=require('./stub');const fs=require('fs'),path=require('path'),os=require('os');
const fake=fs.readFileSync(path.join(__dirname,'fake-supabase.js'),'utf8');
(async()=>{
  const b=await chromium.launch(),errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:844}});await stub(ctx);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8765/');await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(400);
  await p.fill('#a-email','jan@example.com');await p.fill('#a-pass','dobrehaslo1');await p.click('#authform button[type=submit]');await p.waitForTimeout(600);
  await p.click('[data-act=start][data-k=sample]');await p.waitForTimeout(400);await p.evaluate(()=>{ui.tour=null;S.tour='done';ui.say=null;render()});
  // 1) Pixa zostaje
  await p.click('.hal');await p.waitForTimeout(200);
  const panel=()=>p.isVisible('#asst .pxpanel');
  await p.click('.nav [data-t=goals]');await p.waitForTimeout(600);
  console.log('1 po przejściu do Celów panel:',await panel(),'| mówi o Celach:',await p.evaluate(()=>!!ui.chatTip),(await p.textContent('.pxpanel .pxtxt')).trim().slice(0,70));
  await p.evaluate(()=>openGoal(null));await p.waitForTimeout(200);
  console.log('  przy otwartym oknie celu panel jest pod spodem:',await p.evaluate(()=>!!document.querySelector('#asst .pxpanel')));
  await p.click('.sheet .btn[data-act=close]').catch(async()=>{await p.click('.scrim')});await p.waitForTimeout(200);
  console.log('  po zamknięciu okna panel:',await panel());
  await p.click('.top [data-t=settings]');await p.waitForTimeout(300);console.log('  w Ustawieniach panel:',await panel());
  await p.click('.pxclose');await p.waitForTimeout(100);console.log('  po × panel:',await panel(),'| soczewka w Ustawieniach:',await p.isVisible('.hal'));
  // podpowiedź z przejściem nie zamyka panelu
  await p.click('.nav [data-t=today]');await p.waitForTimeout(300);await p.click('.hal');await p.waitForTimeout(200);
  const r=await p.evaluate(()=>{const tp=Asst.tips().find(x=>x.actions.some(a=>/Pokaż|Zobacz|Podsumuj/.test(a.l)));return tp?tp.kind:null});
  console.log('  podpowiedź z przejściem:',r);
  // 2) znajomi: grupa i udostępnienie, żeby sprawdzić czyszczenie
  await p.click('.nav [data-t=friends]');await p.waitForTimeout(800);await p.fill('#soc-name','Jan');await p.click('[data-soc=saveprofile]');await p.waitForTimeout(300);
  await p.fill('#soc-gname','Ekipa');await p.click('[data-soc=create]');await p.waitForTimeout(600);await p.click('[data-soc=msshare]');await p.waitForTimeout(1500);
  const cnt=()=>p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('__fakedb')).t,u='u1';return['rytm_state','rytm_share','rytm_member'].map(t=>t+':'+((d[t]||[]).filter(r=>r.user_id===u).length)).join(' ')+' rytm_group:'+((d.rytm_group||[]).filter(r=>r.created_by===u).length)});
  // druga grupa, w której jest też Ola (u2): po resecie ma przejść na nią
  await p.evaluate(async()=>{const r=await Sync.client().rpc('rytm_create_group',{p_name:'Duo'});const d=JSON.parse(localStorage.getItem('__fakedb'));d.t.rytm_member.push({group_id:r.data,user_id:'u2',role:'member',joined_at:'2026-01-01'});localStorage.setItem('__fakedb',JSON.stringify(d))});
  await p.reload();await p.waitForTimeout(800);
  console.log('2 przed resetem w bazie:',await cnt());
  // 3) reset
  await p.evaluate(()=>{ui.asstOpen=false;render()});await p.click('.top [data-t=settings]');await p.evaluate(()=>{ui.setSec='data';render()});await p.waitForTimeout(200);
  await p.click('[data-act=resetask]');await p.waitForTimeout(200);
  await p.screenshot({path:path.join(os.tmpdir(),'rytm-reset.png')});
  console.log('3 arkusz:',await p.isVisible('.sheet h2:text("Pełny reset konta")'),'| przycisk zablokowany:',await p.isDisabled('#rs-go'));
  await p.fill('#rs-txt','reset');console.log('  po wpisaniu „reset”:',!(await p.isDisabled('#rs-go')));
  await p.click('[data-act=resetleave]');await p.waitForTimeout(100);
  await Promise.all([p.waitForNavigation(),p.click('#rs-go')]);await p.waitForTimeout(900);
  console.log('  po resecie:',(await p.textContent('#app')).replace(/\s+/g,' ').slice(0,140));
  console.log('  grupa „Duo”:',await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('__fakedb')).t;const g=(d.rytm_group||[]).find(x=>x.name==='Duo');return g?'zostaje, założyciel '+g.created_by+', członkowie '+d.rytm_member.filter(m=>m.group_id===g.id).map(m=>m.user_id+':'+m.role).join(','):'usunięta'}));
  console.log('  w bazie:',await cnt(),'| pamięć urządzenia:',await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('rytm')).join(',')||'pusto'));
  await p.click('[data-act=start][data-k=template]');await p.waitForTimeout(500);
  console.log('  nowy start: cele',await p.evaluate(()=>S.goals.length),'| przewodnik',await p.isVisible('#tour .pxpanel'),'| kamienie',await p.evaluate(()=>Object.keys(S.ms).length));
  console.log('errors',errs);await b.close();
})();
