(function(){
  const db=JSON.parse(localStorage.getItem('__fakedb')||'{"users":{"jan@example.com":{"id":"u1","pw":"dobrehaslo1"}},"rows":{}}');
  const persist=()=>localStorage.setItem('__fakedb',JSON.stringify(db));
  window.__db=db;
  const sess=()=>JSON.parse(localStorage.getItem('__sess')||'null');
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
      functions:{invoke:async(n,{body})=>{window.__inv=(window.__inv||[]).concat(body.action);return{data:body.action==='public-key'?{publicKey:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'}:{sent:1,devices:1},error:null}}},
      from(t){if(t==='rytm_push')return{upsert:async r=>{window.__pushRows=[r];return{error:null}},delete(){return{eq:async()=>{window.__pushRows=[];return{error:null}}}}};return{
        upsert:async row=>{window.__upserts=(window.__upserts||0)+1;db.rows[row.user_id]={data:row.data,updated_at:row.updated_at};persist();return{error:null}},
        select(){return{eq(_,id){return{maybeSingle:async()=>({data:db.rows[id]||null,error:null})}}}}
      }}
    }
  }
  window.supabase={createClient:client};
})();
