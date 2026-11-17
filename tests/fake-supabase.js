// Atrapa Supabase do testów w przeglądarce: tabele w pamięci (localStorage), bez zasad RLS.
(function(){
  const KEYS={rytm_state:['user_id'],rytm_push:['endpoint'],rytm_profile:['user_id'],rytm_share:['user_id','goal_id'],rytm_member:['group_id','user_id'],rytm_group:['id'],rytm_challenge:['id'],rytm_kudos:['from_user','to_user','act','day']};
  const db=JSON.parse(localStorage.getItem('__fakedb')||'null')||{users:{'jan@example.com':{id:'u1',pw:'dobrehaslo1'},'ola@example.com':{id:'u2',pw:'dobrehaslo2'}},t:{}};
  const T=n=>(db.t[n]=db.t[n]||[]);
  const persist=()=>localStorage.setItem('__fakedb',JSON.stringify(db));
  window.__db=db;
  const sess=()=>JSON.parse(localStorage.getItem('__sess')||'null');
  const uid=()=>{const s=sess();return s&&s.user.id};
  class Q{
    constructor(t){this.t=t;this.f=[];this.op='select';this.one=false}
    select(){return this}
    eq(c,v){this.f.push(r=>r[c]===v);return this}
    in(c,a){this.f.push(r=>a.includes(r[c]));return this}
    not(c,op,list){const v=list.replace(/[()"]/g,'').split(',');this.f.push(r=>!v.includes(r[c]));return this}
    order(){return this} limit(){return this}
    maybeSingle(){this.one=true;return this} single(){this.one=true;return this}
    upsert(rows){this.op='upsert';this.rows=[].concat(rows);return this}
    insert(rows){this.op='insert';this.rows=[].concat(rows);return this}
    delete(){this.op='delete';return this}
    then(ok,bad){return Promise.resolve(this.exec()).then(ok,bad)}
    exec(){
      const tb=T(this.t),k=KEYS[this.t]||['id'],same=(a,b)=>k.every(x=>a[x]===b[x]);
      if(this.op==='upsert'||this.op==='insert'){
        window.__ops=(window.__ops||[]).concat(this.op+':'+this.t);
        for(const r0 of this.rows){const r=Object.assign({},r0);if(this.t==='rytm_challenge'&&!r.id)r.id='c'+Math.random().toString(36).slice(2,8);
          const i=tb.findIndex(x=>same(x,r));if(i>=0){if(this.op==='insert')return{error:{message:'duplicate key'}};tb[i]=Object.assign({},tb[i],r)}else tb.push(r)}
        persist();return{data:null,error:null};
      }
      if(this.op==='delete'){db.t[this.t]=tb.filter(r=>!this.f.every(f=>f(r)));persist();return{error:null}}
      const rows=tb.filter(r=>this.f.every(f=>f(r))).map(r=>JSON.parse(JSON.stringify(r)));
      return{data:this.one?(rows[0]||null):rows,error:null};
    }
  }
  function client(){
    return{
      auth:{
        onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},
        async getSession(){return{data:{session:sess()}}},
        async signInWithPassword({email,password}){const u=db.users[email];if(!u||u.pw!==password)return{data:{},error:{message:'Invalid login credentials'}};const s={user:{id:u.id,email}};localStorage.setItem('__sess',JSON.stringify(s));return{data:{user:s.user,session:s},error:null}},
        async signUp({email,password}){if(db.users[email])return{data:{},error:{message:'User already registered'}};db.users[email]={id:'u'+Date.now(),pw:password};persist();return{data:{user:{email},session:null},error:null}},
        async signOut(){localStorage.removeItem('__sess');return{error:null}},
        async updateUser(){return{data:{user:sess().user},error:null}},
        async resetPasswordForEmail(){return{error:null}}
      },
      async rpc(fn,args){
        if(fn==='rytm_create_group'){const id='g'+Math.random().toString(36).slice(2,8),code='K'+Math.random().toString(36).slice(2,7).toUpperCase();T('rytm_group').push({id,name:args.p_name,code,created_by:uid()});T('rytm_member').push({group_id:id,user_id:uid(),role:'owner'});persist();return{data:id,error:null}}
        if(fn==='rytm_join_group'){const g=T('rytm_group').find(x=>x.code===args.p_code);if(!g)return{data:null,error:{message:'Nie ma grupy z takim kodem'}};if(!T('rytm_member').some(m=>m.group_id===g.id&&m.user_id===uid()))T('rytm_member').push({group_id:g.id,user_id:uid(),role:'member'});persist();return{data:g.id,error:null}}
        return{data:null,error:{message:'unknown rpc'}};
      },
      functions:{async invoke(n,{body}){
        window.__inv=(window.__inv||[]).concat(body.action);
        if(body.action==='public-key')return{data:{publicKey:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'},error:null};
        if(body.action==='kudos'){const r={from_user:uid(),to_user:body.to,act:body.act,day:new Date().toISOString().slice(0,10)};if(T('rytm_kudos').some(k=>k.from_user===r.from_user&&k.to_user===r.to_user&&k.act===r.act&&k.day===r.day))return{data:{already:true},error:null};T('rytm_kudos').push(r);persist();return{data:{ok:true,sent:0},error:null}}
        return{data:{sent:1,devices:1},error:null};
      }},
      from(t){return new Q(t)}
    };
  }
  window.supabase={createClient:client};
})();
