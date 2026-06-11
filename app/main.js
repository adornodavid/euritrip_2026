'use strict';
/* migración suave de claves localStorage eurotrip_* → bayu_* (v11 Fase 1) */
(function(){try{['open','queue'].forEach(function(k){var o=localStorage.getItem('eurotrip_'+k);if(o!=null&&localStorage.getItem('bayu_'+k)==null)localStorage.setItem('bayu_'+k,o);localStorage.removeItem('eurotrip_'+k);});['eurotrip_write_key','bayu_write_key'].forEach(function(k){localStorage.removeItem(k);});}catch(e){}})();
const DOW=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const CAT={comida:'🍽️',museo:'🏛️',paseo:'🚶','viñedo':'🍷',vinedo:'🍷',actividad:'🎟️',compras:'🛍️',traslado:'🚄',logistica:'🧳',flex:'✨'};
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
let CITIES=[];  // se construye desde DATA.trip_cities (multi-viaje)
let DATA={}, TRIPS=[], TRIP=null, gCity='', gPayer='', chatStarted=false, pendingReceipt=null;
/* ---- Fase 0: auth real (Supabase) ---- */
const sbc=window.supabase.createClient('https://qflyzgbsufvwrfkrrpfo.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbHl6Z2JzdWZ2d3Jma3JycGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDU2ODksImV4cCI6MjA4MDg4MTY4OX0.tSM56ApNtYqJbZe9q66Y36LwWRsolrpYCBCoZhvSA6U');
let SESSION=null;
function authHeaders(){return SESSION?{'Authorization':'Bearer '+SESSION.access_token}:{};}
function showAuth(){var a=document.getElementById('auth');if(a)a.classList.add('show');}
function hideAuth(){var a=document.getElementById('auth');if(a)a.classList.remove('show');}
async function ensureProfile(){try{const u=SESSION.user;await sbc.from('bayu_profiles').upsert({id:u.id,email:(u.email||'').toLowerCase(),display_name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||(u.email||'').split('@')[0]},{onConflict:'id'});}catch(e){}}
async function initAuth(){
  try{const r=await sbc.auth.getSession();SESSION=r.data.session;}catch(e){SESSION=null;}
  sbc.auth.onAuthStateChange(async function(ev,sn){
    SESSION=sn;
    if(ev==='PASSWORD_RECOVERY'){const np=await promptSheet('Nueva contraseña','Mínimo 8 caracteres','Guardar');if(np){await sbc.auth.updateUser({password:np});showToast('Contraseña actualizada ✓');}}
    if(ev==='SIGNED_IN'){hideAuth();ensureProfile();chatStarted=false;chatMsgs=[];var cl2=$('chat-log');if(cl2)cl2.innerHTML='';load();}
    if(ev==='SIGNED_OUT'){DATA={};TRIPS=[];TRIP=null;chatStarted=false;chatMsgs=[];localStorage.removeItem('bayu_trip_id');var cl=$('chat-log');if(cl)cl.innerHTML='';var pr=$('planner-root');if(pr)pr.innerHTML='';var em=$('au-email');if(em)em.value='';var pw=$('au-pass');if(pw)pw.value='';showAuth();}
  });
  if(SESSION){hideAuth();ensureProfile();load();flushQueue();}else showAuth();
}
async function authIn(){const em=$('au-email').value.trim(),pw=$('au-pass').value;if(!em||!pw){showToast('Email y contraseña',true);return;}
  const r=await sbc.auth.signInWithPassword({email:em,password:pw});
  if(r.error)showToast(r.error.message==='Invalid login credentials'?'Credenciales incorrectas':r.error.message,true);}
async function authUp(){const em=$('au-email').value.trim(),pw=$('au-pass').value;if(!em||pw.length<8){showToast('Email válido y contraseña de 8+ caracteres',true);return;}
  const r=await sbc.auth.signUp({email:em,password:pw,options:{emailRedirectTo:location.origin}});
  if(r.error){showToast(r.error.message,true);return;}
  if(!r.data.session)infoSheet('Confirma tu correo','Te mandamos un link para activar la cuenta. Ábrelo y regresa aquí.');}
async function authGoogle(){await sbc.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin,queryParams:{prompt:'select_account'}}});}
async function authForgot(){let em=$('au-email').value.trim();if(!em)em=await promptSheet('Tu email','correo@ejemplo.com','Enviar');if(!em)return;
  await sbc.auth.resetPasswordForEmail(em,{redirectTo:location.origin});infoSheet('Revisa tu correo','Si la cuenta existe, te llegará un link para restablecer la contraseña.');}
async function logout(){if(!await confirmSheet('¿Cerrar sesión?','Vuelves a entrar con tu mismo correo o Google cuando quieras.','Cerrar sesión'))return;
  try{await sbc.auth.signOut({scope:'local'});}catch(e){}
  /* limpieza forzada: aunque el signOut remoto falle, esta sesión local MUERE */
  try{Object.keys(localStorage).filter(function(k){return k.indexOf('sb-')===0;}).forEach(function(k){localStorage.removeItem(k);});}catch(e){}
  SESSION=null;DATA={};TRIPS=[];TRIP=null;chatStarted=false;chatMsgs=[];localStorage.removeItem('bayu_trip_id');
  var cl=$('chat-log');if(cl)cl.innerHTML='';var pr=$('planner-root');if(pr)pr.innerHTML='';
  showAuth();showToast('Sesión cerrada ✓');go('planner');}
async function exportData(){try{const r=await fetch('/api/account?action=export',{headers:authHeaders()});const j=await r.json();const b=new Blob([JSON.stringify(j,null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='bayu-export.json';a.click();showToast('Export descargado ✓');}catch(e){showToast('Error al exportar',true);}}
async function deleteAccount(){const c=await promptSheet('⚠️ Borra tu cuenta y TODOS tus viajes. Escribe BORRAR para confirmar','BORRAR','Borrar todo');if(c!=='BORRAR')return;
  try{const r=await fetch('/api/account',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({action:'delete',confirm:'BORRAR'})});const j=await r.json();
    if(j.ok){showToast('Cuenta borrada');await sbc.auth.signOut();}else showToast(j.error||'Error',true);}catch(e){showToast('Error de red',true);}}
async function inviteMember(){const em=await promptSheet('Email de la persona (ya debe tener cuenta Bayu)','correo@ejemplo.com','Invitar');if(!em)return;
  const p=await sbc.from('bayu_profiles').select('id,display_name').eq('email',em.toLowerCase().trim()).maybeSingle();
  if(!p.data){infoSheet('No encontrado','Esa persona primero debe crear su cuenta en Bayu (con ese email); luego invítala de nuevo.');return;}
  const r=await sbc.from('bayu_trip_members').insert({trip_id:activeTripId(),user_id:p.data.id,role:'editor'});
  if(r.error)showToast(r.error.message.includes('duplicate')?'Ya es miembro de este viaje':r.error.message,true);else{showToast('Invitado ✓ — ya puede ver y editar este viaje');load();}}
async function removeMember(uid,name){if(!await confirmSheet('¿Quitar a '+name+' del viaje?',null,'Quitar'))return;
  const r=await sbc.from('bayu_trip_members').delete().eq('trip_id',activeTripId()).eq('user_id',uid);
  if(r.error)showToast(r.error.message,true);else{showToast('Quitado');load();}}
function activeTripId(){return localStorage.getItem('bayu_trip_id')||(TRIP&&TRIP.id)||'';}
function tripStart(){return (TRIP&&TRIP.start_date)||null;}
function tripEnd(){return (TRIP&&TRIP.end_date)||tripStart();}
const $=id=>document.getElementById(id);
function esc(t){return (t==null?'':String(t)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
/* ícono SVG del sprite (#i-*) — la interfaz no usa emojis */
function I(n,s){s=s||18;return '<svg class="ic" width="'+s+'" height="'+s+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';}
/* ---- sheets de confirmación/captura: reemplazan confirm()/prompt()/alert() nativos ---- */
function askSheet(o){return new Promise(function(res){
  var m=document.createElement('div');m.className='modal open';
  m.innerHTML='<div class="sheet asheet"><h3>'+esc(o.title||'')+'</h3>'
    +(o.body?'<p class="ask-body">'+esc(o.body)+'</p>':'')
    +(o.input?'<input type="text" class="ask-in" placeholder="'+esc(o.placeholder||'')+'"/>':'')
    +'<div class="ask-row">'+(o.cancel===false?'':'<button class="btn-ghost" data-a="no">Cancelar</button>')
    +'<button class="btn-main'+(o.danger?' danger':'')+'" data-a="ok">'+esc(o.okLabel||'Confirmar')+'</button></div></div>';
  function done(v){m.remove();res(v);}
  m.addEventListener('click',function(e){
    if(e.target===m)return done(o.input?null:false);
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.a==='ok'){if(o.input){var i=m.querySelector('.ask-in');return done(i.value.trim()||null);}return done(true);}
    if(b.dataset.a==='no')return done(o.input?null:false);
  });
  document.body.appendChild(m);
  var inp=m.querySelector('.ask-in');
  if(inp){setTimeout(function(){inp.focus();},90);inp.addEventListener('keydown',function(e){if(e.key==='Enter')done(inp.value.trim()||null);});}
});}
function confirmSheet(title,body,okLabel){return askSheet({title:title,body:body,okLabel:okLabel||'Confirmar',danger:true});}
function promptSheet(title,placeholder,okLabel){return askSheet({title:title,input:true,placeholder:placeholder,okLabel:okLabel||'Guardar'});}
function infoSheet(title,body){return askSheet({title:title,body:body,okLabel:'Entendido',cancel:false});}
function dn(iso){const p=iso.split('-');const d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));return DOW[d.getUTCDay()]+' '+(+p[2])+' '+MES[+p[1]-1];}
const CUR_SYM={MXN:'$',USD:'$',EUR:'€',GBP:'£',JPY:'¥',CAD:'$',COP:'$',ARS:'$',BRL:'R$',CHF:'CHF '};
function curCode(){return (TRIP&&TRIP.home_currency)||'MXN';}
function curSym(c){c=c||curCode();return CUR_SYM[c]!=null?CUR_SYM[c]:c+' ';}
function money(n){return curSym()+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
function emptyState(icon,title,sub,btn){return '<div class="empty-rich"><div class="ei">'+icon+'</div><div class="et">'+esc(title)+'</div>'+(sub?'<div class="es">'+esc(sub)+'</div>':'')+(btn||'')+'</div>';}
let CITYKEYS=CITIES.map(c=>c.key);
function cityByDate(date){const c=CITIES.find(c=>c.dates.includes(date));return c?c.key:null;}
function resolveCity(a){if(a.city&&CITYKEYS.includes(a.city))return a.city;return cityByDate(a.activity_date)||CITIES[0].key;}
function snapDateToCity(){const c=CITIES.find(c=>c.key===$('ma-city').value);if(!c)return;if($('ma-date').value&&!c.dates.includes($('ma-date').value))$('ma-date').value=c.dates[0];}
function pad(n){return n<10?'0'+n:''+n;}
function dateRange(s,e){const out=[];if(!s)return out;const a=new Date(s+'T00:00:00'),b=new Date((e||s)+'T00:00:00');for(let d=new Date(a);d<=b;d.setDate(d.getDate()+1))out.push(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));return out;}
function fmtRange(s,e){if(!s)return '';const sd=+s.slice(8,10),sm=+s.slice(5,7)-1;if(!e||e===s)return sd+' '+MES[sm]+' · parada';const ed=+e.slice(8,10),em=+e.slice(5,7)-1;const nights=Math.max(1,Math.round((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000));return sd+(sm!==em?' '+MES[sm]:'')+'–'+ed+' '+MES[em]+' · '+nights+'N';}
function rebuildCities(){
  CITIES=(DATA.trip_cities||[]).map(tc=>({key:tc.name,name:tc.name,flag:tc.country_flag||'📍',img:tc.photo_url||'',custom:true,id:tc.id,lat:tc.lat,lng:tc.lng,cc:tc.country_code,start_date:tc.start_date,end_date:tc.end_date,notes:tc.notes,dates:dateRange(tc.start_date,tc.end_date),range:fmtRange(tc.start_date,tc.end_date)}))
    .sort((a,b)=>((a.dates[0]||'9')<(b.dates[0]||'9'))?-1:((a.dates[0]||'9')>(b.dates[0]||'9')?1:0));
  CITYKEYS=CITIES.map(c=>c.key);
  const opts='<option value="">—</option>'+CITIES.map(c=>'<option value="'+esc(c.key)+'">'+esc(c.flag)+' '+esc(c.name)+'</option>').join('');
  ['me-city','mr-city','ml-city'].forEach(function(id){const s=$(id);if(s){const v=s.value;s.innerHTML=opts;s.value=v;}});
  const sel=$('ma-city');if(sel){const v=sel.value;sel.innerHTML=opts;sel.value=v;}
}
function openCity(c){$('mc-id').value=c.id||'';$('mc-name').value=c.name||'';$('mc-flag').value=c.country_flag||c.flag||'📍';$('mc-start').value=c.start_date||'';$('mc-end').value=c.end_date||'';$('mc-photo').value=c.photo_url||c.img||'';$('mc-notes').value=c.notes||'';$('m-city').classList.add('open');}
function openCity2(id){const c=(DATA.trip_cities||[]).find(x=>x.id===id);if(c)openCity(c);}
async function saveCity(){const id=$('mc-id').value,n=$('mc-name').value.trim(),st=$('mc-start').value;if(!n||!st){showToast('Nombre y fecha de inicio requeridos',true);return;}const row={name:n,country_flag:$('mc-flag').value||'📍',start_date:st,end_date:$('mc-end').value||st,photo_url:$('mc-photo').value||null,notes:$('mc-notes').value||null};const geo=await geocode(n);if(geo){row.lat=geo.lat;row.lng=geo.lng;row.country_code=geo.country_code;}if(id)await write({action:'update',table:'trip_cities',id:id,patch:row},'Ciudad guardada ✓');else{row.created_by='manual';await write({action:'insert',table:'trip_cities',row:row},'Ciudad agregada ✓');}closeM('m-city');}
async function delCity(id){if(await confirmSheet('¿Quitar esta parada?','Las actividades de esos días quedan guardadas.','Quitar'))await write({action:'delete',table:'trip_cities',id:id},'Quitada');}
let toastT;
function showToast(msg,err){const t=$('toast');if(!t)return;t.textContent=msg;t.className='toast show'+(err?' err':'');clearTimeout(toastT);toastT=setTimeout(()=>{t.className='toast'+(err?' err':'');},1900);}
function tripInfo(){if(!TRIP||!TRIP.start_date)return (TRIP&&TRIP.name)?('✦ '+TRIP.name):'Tu viaje';
  const start=new Date(tripStart()+'T00:00:00'),end=new Date(tripEnd()+'T23:59:59'),now=new Date();
  if(now<start)return 'Faltan '+Math.ceil((start-now)/86400000)+' días para el viaje 🧳';
  if(now>end)return '¡Viaje terminado! 🏠';
  return 'Día '+(Math.floor((now-start)/86400000)+1)+' del viaje ✈️';}
function todayISO(){if(!TRIP||!TRIP.start_date)return null;const n=new Date(),start=new Date(tripStart()+'T00:00:00'),end=new Date(tripEnd()+'T23:59:59');if(n<start||n>end)return null;const z=new Date(n.getTime()-n.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);}
function defaultOpenKey(){const t=todayISO();if(t){const c=CITIES.find(c=>c.dates.includes(t));if(c)return c.key;}return CITIES[0]?CITIES[0].key:'';}
function openKeys(){const st=localStorage.getItem('bayu_open');if(st){try{return new Set(JSON.parse(st));}catch(e){}}return new Set([defaultOpenKey()]);}
function toggleCity(ci){const el=$('city-'+ci);el.classList.toggle('open');const set=openKeys();const k=CITIES[ci].key;if(el.classList.contains('open'))set.add(k);else set.delete(k);localStorage.setItem('bayu_open',JSON.stringify([...set]));}

function go(tab){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('s-'+tab).classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='viajes')renderViajes();
  if(tab==='explore')renderExplore();
  if(tab==='perfil')renderPerfil();
  if(tab==='claudia')startChat();
  window.scrollTo(0,0);
}
function openTrips(){go('viajes');}
async function load(){
  if(!DATA.activities)$('planner-root').innerHTML='<div class="skel skel-city"></div><div class="skel skel-city"></div><div class="skel skel-city"></div>';
  if(!SESSION){showAuth();return;}
  try{
    const tr=await sbc.from('bayu_trips').select('*').order('is_default',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if(tr.error)throw new Error(tr.error.message);
    TRIPS=tr.data||[];
    const tid=activeTripId();
    TRIP=TRIPS.find(t=>t.id===tid)||TRIPS.find(t=>t.is_default)||TRIPS[0]||null;
    DATA={};
    if(TRIP){
      const TBLS=['notes','bookmarks','reservations','hotel_choices','day_overrides','expenses','budget','activities','trip_cities','media','trip_travelers','packing_items'];
      const ORD={budget:['sort_order',true],expenses:['expense_date',false],trip_travelers:['sort_order',true],packing_items:['sort_order',true]};
      const results=await Promise.all(TBLS.map(function(t){
        let q=sbc.from('bayu_'+t).select('*').eq('trip_id',TRIP.id);
        if(t==='trip_cities')q=q.order('start_date',{ascending:true,nullsFirst:false}).order('sort_order',{ascending:true});
        else if(t==='activities')q=q.order('activity_date',{ascending:true,nullsFirst:false}).order('sort_order',{ascending:true,nullsFirst:false}).order('start_time',{ascending:true,nullsFirst:true});
        else{const o=ORD[t]||['created_at',false];q=q.order(o[0],{ascending:o[1],nullsFirst:false});}
        return q;
      }));
      TBLS.forEach(function(t,i){DATA[t]=results[i].data||[];});
      try{const mm=await sbc.from('bayu_trip_members').select('user_id,role').eq('trip_id',TRIP.id);
        const ids=(mm.data||[]).map(m=>m.user_id);let profs=[];
        if(ids.length){const pr=await sbc.from('bayu_profiles').select('id,display_name,email').in('id',ids);profs=pr.data||[];}
        DATA.members=(mm.data||[]).map(m=>Object.assign({},m,{profile:profs.find(p=>p.id===m.user_id)||{}}));
      }catch(e){DATA.members=[];}
    }
    if(TRIP)localStorage.setItem('bayu_trip_id',TRIP.id);
    applyTripChrome();rebuildCities();renderPlanner();renderGastos();healCoords();migratePack();
    if($('s-viajes').classList.contains('active'))renderViajes();
    if($('s-perfil').classList.contains('active'))renderPerfil();
    if($('s-explore').classList.contains('active'))renderExplore();
  }catch(e){ $('planner-root').innerHTML='<p class="empty">Sin conexión. '+esc(e.message)+'</p>'; }
}
/* ---------- chrome del viaje activo (hero + header + límites de fecha) ---------- */
function heroDates(){if(!TRIP||!TRIP.start_date)return '';const s=TRIP.start_date,e=TRIP.end_date||s;const sd=+s.slice(8,10),sm=+s.slice(5,7)-1,ed=+e.slice(8,10),em=+e.slice(5,7)-1,yr=s.slice(0,4);return sd+' '+MES[sm]+' → '+ed+' '+MES[em]+' '+yr;}
function heroKicker(){if(!TRIP)return '✦ Tu viaje';const t=todayISO();if(t)return '✦ Viaje en curso';if(TRIP.start_date&&new Date(tripEnd()+'T23:59:59')<new Date())return '✦ Viaje terminado';return '✦ Tu próximo viaje';}
function setDateBounds(){const lo=TRIP&&TRIP.start_date?TRIP.start_date:'',hi=TRIP&&TRIP.end_date?TRIP.end_date:'';['ma-date','mr-date','mc-start','mc-end'].forEach(function(id){const el=$(id);if(!el)return;if(lo)el.min=lo;else el.removeAttribute('min');if(hi)el.max=hi;else el.removeAttribute('max');});}
function applyTripChrome(){if(!TRIP)return;
  const img=$('hero-img');if(img){if(TRIP.cover_image){img.src=TRIP.cover_image;img.style.display='';}}
  const ttl=$('hero-title');if(ttl)ttl.textContent=TRIP.name+(TRIP.subtitle?' · '+TRIP.subtitle:'');
  const pill=$('hero-pill');if(pill)pill.textContent=TRIP.start_date?('📅 '+heroDates()):'📅 Sin fechas aún';
  const kick=$('hero-kicker');if(kick)kick.textContent=heroKicker();
  const bsub=$('brand-sub');if(bsub)bsub.textContent=TRIP.subtitle||(TRIP.start_date?heroDates():'Tu viaje');
  setDateBounds();
}

/* ---------- PLANNER ---------- */
function renderPlanner(){
  const acts=DATA.activities||[], hotels=DATA.hotel_choices||[], today=todayISO(), oset=openKeys();
  const wish=acts.filter(a=>!a.activity_date), dated=acts.filter(a=>a.activity_date);
  const totalA=dated.length, doneA=dated.filter(a=>a.status==='hecho').length, pg=totalA?Math.round(doneA/totalA*100):0;
  const started=!!(TRIP&&TRIP.start_date)&&new Date()>=new Date(tripStart()+'T00:00:00');
  let html='<div class="pl-summary"><div class="cd">'+tripInfo()+'</div>';
  if(started)html+='<div class="pg"><span>✓ Actividades hechas</span><span>'+doneA+' / '+totalA+' ('+pg+'%)</span></div><div class="bar"><i style="width:'+pg+'%"></i></div>';
  else html+='<div class="pg"><span>📋 '+totalA+' actividades · '+(DATA.reservations||[]).length+' reservas</span><span>'+CITIES.length+' ciudades</span></div>';
  html+='</div>'+wishHtml(wish);
  if(!CITIES.length)html+=emptyState('🗺️','Este viaje aún no tiene ciudades','Agrega tu primera ciudad o parada para empezar a planear día por día.','<button class="eb" onclick="openCity({})">+ Agregar ciudad</button>');
  CITIES.forEach((c,ci)=>{
    const cityActs=acts.filter(a=>a.activity_date&&resolveCity(a)===c.key);
    const hotel=hotels.find(h=>h.city===c.key), cnt=cityActs.length, dco=cityActs.filter(a=>a.status==='hecho').length;
    const isOpen=oset.has(c.key);
    html+='<div class="city'+(isOpen?' open':'')+'" id="city-'+ci+'">';
    html+='<div class="city-photo"'+(c.img?'':' style="background:linear-gradient(135deg,#475569 0%,#1e293b 100%)"')+' onclick="toggleCity('+ci+')">'+(c.img?'<img src="'+c.img+'" alt="" onerror="this.style.display=\'none\'"/>':'')+'<div class="ov"></div>';
    html+='<div class="ci"><span style="font-size:1.2rem">'+c.flag+'</span><span class="nm">'+c.name+'</span>';
    html+='<span class="ct">'+c.range+'<br/>'+(cnt?'<span class="cprog">'+dco+'/'+cnt+' ✓</span>':'sin actividades')+'</span><span class="chev">›</span></div></div>';
    html+='<div class="city-body">';
    if(c.custom)html+='<div style="display:flex;gap:.4rem;margin-bottom:.6rem"><button class="chip" onclick="openCity2(\''+c.id+'\')">'+I('pencil',13)+' Editar parada</button><button class="chip" onclick="delCity(\''+c.id+'\')">'+I('trash',13)+' Quitar</button></div>';
    html+='<div class="hotel-line" style="cursor:pointer" onclick="openHotel(\''+esc(c.key)+'\')">🏨 '+(hotel?esc(hotel.hotel_name)+(hotel.confirmed?' · ✅':' · ⏳ por definir')+(hotel.zone?' · '+esc(hotel.zone):''):'Definir hotel')+' · ✏️</div>';
    const _extra=[...new Set(cityActs.map(a=>a.activity_date))].filter(d=>!c.dates.includes(d));
    [...c.dates,..._extra].sort().forEach(d=>{
      const da=cityActs.filter(a=>a.activity_date===d).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||((a.start_time||'')>(b.start_time||'')?1:-1));
      const isToday=(d===today);
      html+='<div class="day'+(isToday?' today':'')+'"><div class="day-h"><span class="day-h-date">'+dn(d)+'</span>'+(isToday?'<span class="hoy-badge">HOY</span>':'')+'<span class="wx" data-wx="'+d+'|'+esc(c.key)+'"></span></div>'+resHtml(d);
      da.forEach((a,idx)=>{
        const done=a.status==='hecho';
        const up=idx>0?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',-1)" aria-label="Subir">'+I('up',15)+'</button>':'';
        const dw=idx<da.length-1?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',1)" aria-label="Bajar">'+I('down',15)+'</button>':'';
        html+='<div class="act'+(done?' done':'')+'"><button class="chk" onclick="togAct(\''+a.id+'\','+done+')">'+(done?'✓':'')+'</button>';
        html+='<div class="a-body" onclick="toggleDetail(\''+a.id+'\')"><div class="a-title">'+(a.start_time?'<span class="a-time">'+esc(a.start_time.slice(0,5))+'</span>':'')+esc(a.title)+(a.is_suggestion?'<span class="sug">sugerida</span>':'')+' <span style="opacity:.4;font-size:.7rem">▾</span></div>';
        const m=[];if(a.category)m.push((CAT[a.category]||'•')+' '+esc(a.category));
        if(m.length)html+='<div class="a-meta">'+m.join(' · ')+'</div>';
        html+='</div><div class="a-act">'+up+dw+'<button onclick="editAct(\''+a.id+'\')" aria-label="Editar">'+I('pencil',16)+'</button><button onclick="delAct(\''+a.id+'\')" aria-label="Borrar">'+I('trash',16)+'</button></div></div>'+detailHtml(a);
      });
      html+='<button class="addbtn" onclick="openAct({activity_date:\''+d+'\',city:\''+esc(c.key)+'\'})">+ actividad el '+dn(d)+'</button>'+(da.length?'<button class="addbtn" style="margin-top:.3rem;border-style:solid;color:var(--green)" onclick="mapDay(\''+d+'\')">🗺️ Ver el día en Google Maps</button>':'')+(da.length>=2?'<button class="addbtn" style="margin-top:.3rem;border-style:solid;color:var(--red)" onclick="optimizeDay(\''+d+'\')">✨ Optimizar día con IA</button>':'')+'</div>';
    });
    html+=suggRow(c.key,c.name)+'</div></div>';
  });
  html+='<button class="addbtn" style="margin-top:.7rem" onclick="openCity({})">+ Agregar ciudad o parada</button>';
  $('planner-root').innerHTML=html;hydrateWeather();
}
function detailHtml(a){
  const p=[];
  if(a.notes)p.push('<div class="dt-row">📝 '+esc(a.notes)+'</div>');
  if(a.link)p.push('<div class="dt-row">🔗 <a href="'+esc(a.link)+'" target="_blank">Más info</a></div>');
  if(a.map_url)p.push('<div class="dt-row">🧭 <a href="'+esc(a.map_url)+'" target="_blank">Cómo llegar</a></div>');
  if(a.tickets)p.push('<div class="dt-row">🎫 '+esc(a.tickets)+'</div>');
  const rt=a.rating||0;
  const stars='<div class="dt-row">⭐ Rating: '+[1,2,3,4,5].map(function(n){return '<span class="star'+(n<=rt?' on':'')+'" onclick="rateAct(\''+a.id+'\','+n+')">★</span>';}).join('')+(rt?' <a onclick="rateAct(\''+a.id+'\',0)" style="font-size:.72rem;color:var(--muted)">quitar</a>':'')+'</div>';
  const quick='<div class="dt-quick">'
    +'<button onclick="actQuick(\''+a.id+'\',\'map\')">🗺️ Mapa</button>'
    +'<button onclick="actQuick(\''+a.id+'\',\'img\')">🖼️ Fotos</button>'
    +'<button onclick="actQuick(\''+a.id+'\',\'vid\')">▶️ Videos</button>'
    +'<button onclick="actQuick(\''+a.id+'\',\'tour\')">🎟️ Tours</button>'
    +'<button class="tips" onclick="actQuick(\''+a.id+'\',\'tips\')">💡 Consejos</button>'
    +'</div>';
  return '<div class="act-detail" id="det-'+a.id+'" style="display:none">'+quick+stars+p.join('')+'<button class="addbtn" style="margin-top:.45rem" onclick="editAct(\''+a.id+'\')">✏️ Editar detalles, links, boletos</button></div>';
}
function toggleDetail(id){const d=$('det-'+id);if(d)d.style.display=(d.style.display==='none'?'block':'none');}
function actQuick(id,kind){
  const a=(DATA.activities||[]).find(x=>x.id===id);if(!a)return;
  const term=a.title+(a.city?', '+a.city:''),q=encodeURIComponent(term);
  if(kind==='map')window.open('https://www.google.com/maps/search/?api=1&query='+q,'_blank');
  else if(kind==='img')window.open('https://www.google.com/search?tbm=isch&q='+q,'_blank');
  else if(kind==='vid')window.open('https://www.youtube.com/results?search_query='+q,'_blank');
  else if(kind==='tour')window.open('https://www.getyourguide.com/s/?q='+q,'_blank');
  else if(kind==='tips')askClaudia('Dame consejos prácticos, mejor horario para visitar y precio aproximado de: '+term+'. Sé breve.');
}
function askClaudia(text){go('claudia');const inp=$('chat-in');if(inp){inp.value=text;sendChat();}}
function optimizeDay(date){
  const acts=(DATA.activities||[]).filter(a=>a.activity_date===date&&a.category!=='logistica'&&a.category!=='traslado');
  if(acts.length<2){showToast('Necesitas 2+ actividades ese día');return;}
  const city=(acts.find(a=>a.city)||{}).city||'';
  const list=acts.map(a=>'- '+a.title+(a.start_time?' (ahora '+a.start_time.slice(0,5)+')':'')+' [id:'+a.id+']').join('\n');
  askClaudia('Optimiza el orden de mi día '+dn(date)+' ('+date+')'+(city?' en '+city:'')+'. Actividades con su id:\n'+list+'\n\nReordénalas en la secuencia más lógica por cercanía geográfica y horarios sensatos (comidas, apertura de museos) y propón una hora para cada una. Muéstrame el plan y pregúntame si confirmo; cuando confirme, aplícalo con la herramienta reorder_day usando date="'+date+'" y los ids en el nuevo orden.');
}
/* ---------- CLIMA POR DÍA (Open-Meteo · sin API key) ---------- */
function wxIcon(c){c=+c;if(c===0)return'☀️';if(c<=2)return'🌤️';if(c===3)return'☁️';if(c<=48)return'🌫️';if(c<=57)return'🌦️';if(c<=67)return'🌧️';if(c<=77)return'🌨️';if(c<=82)return'🌧️';if(c<=86)return'🌨️';return'⛈️';}
function wxCache(k){try{const v=JSON.parse(localStorage.getItem('bayu_wx_'+k));if(v&&Date.now()-v.ts<6*3600e3)return v.d;}catch(e){}return null;}
function wxStore(k,d){try{localStorage.setItem('bayu_wx_'+k,JSON.stringify({ts:Date.now(),d:d}));}catch(e){}}
async function geocode(name){try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(name)+'&count=1&language=es');const j=await r.json();const g=j.results&&j.results[0];return g?{lat:g.latitude,lng:g.longitude,country_code:(g.country_code||'').toUpperCase()||null}:null;}catch(e){return null;}}
const _healed={};
async function healCoords(){if(!SESSION)return;const tid=activeTripId();if(!tid)return;
  for(const c of CITIES){if(!c.custom||c.lat!=null||_healed[c.id])continue;_healed[c.id]=1;
    const g=await geocode(c.name);if(!g)continue;c.lat=g.lat;c.lng=g.lng;c.cc=g.country_code;
    try{await execWrite({action:'update',table:'trip_cities',id:c.id,patch:{lat:g.lat,lng:g.lng,country_code:g.country_code},trip_id:tid});}catch(e){}}
}
async function fetchWx(city,date){
  const key=city+'|'+date,cached=wxCache(key);if(cached)return cached;
  const _c=CITIES.find(x=>x.key===city),co=(_c&&_c.lat!=null)?[_c.lat,_c.lng]:null,days=Math.round((new Date(date+'T12:00:00')-new Date())/86400000);
  if(co&&days>=0&&days<=15){
    try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+co[0]+'&longitude='+co[1]+'&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date='+date+'&end_date='+date);
      const j=await r.json(),dd=j.daily;
      if(dd&&dd.time&&dd.time.length){const d={hi:Math.round(dd.temperature_2m_max[0]),lo:Math.round(dd.temperature_2m_min[0]),code:dd.weather_code[0],live:true};wxStore(key,d);return d;}
    }catch(e){}
  }
  return null;
}
function hydrateWeather(){
  document.querySelectorAll('[data-wx]').forEach(async function(el){
    if(el.dataset.done)return;el.dataset.done='1';
    const parts=el.dataset.wx.split('|'),w=await fetchWx(parts[1],parts[0]);
    if(!w){el.style.display='none';return;}
    el.innerHTML='<span class="wx-ic">'+wxIcon(w.code)+'</span>'+w.hi+'°<span class="wx-lo">/'+w.lo+'°</span>'+(w.live?'':'<span class="wx-avg">oct</span>');
    el.classList.add('show');
  });
}
async function rateAct(id,n){await write({action:'update',table:'activities',id:id,patch:{rating:n||null}},n?('⭐ '+n+' estrellas'):'Rating quitado');}
function wishHtml(wish){
  let h='<div class="bcard"><div class="lbl" style="margin-bottom:.3rem">💡 Cosas por hacer (sin fecha)</div>';
  if(!wish.length)h+=emptyState('💡','Sin pendientes sueltos','Ideas que te recomienden y aún no sabes cuándo. Agrégalas aquí y luego les pones día.');
  wish.forEach(a=>{const m=[];if(a.city)m.push('📍 '+esc(a.city));if(a.category)m.push((CAT[a.category]||'•')+' '+esc(a.category));
    h+='<div class="act"><span style="flex:0 0 auto;font-size:1.05rem;margin-top:.1rem">💡</span><div class="a-body"><div class="a-title">'+esc(a.title)+'</div>'+(m.length?'<div class="a-meta">'+m.join(' · ')+'</div>':'')+'</div><div class="a-act"><button onclick="editAct(\''+a.id+'\')" aria-label="Ponerle día">'+I('cal',16)+'</button><button onclick="delAct(\''+a.id+'\')" aria-label="Borrar">'+I('trash',16)+'</button></div></div>';});
  h+='<button class="addbtn" style="margin-top:.5rem" onclick="openAct({})">+ Cosa por hacer (sin fecha)</button></div>';
  return h;
}
function suggRow(key,name){
  const q=encodeURIComponent(name);
  return '<div class="sugg-wrap"><div class="sugg-h">✨ Descubre '+esc(name)+'</div><div class="dt-quick" style="margin:.2rem 0 .6rem">'
    +'<button onclick="window.open(\'https://www.getyourguide.com/s/?q='+q+'\',\'_blank\')">🎟️ Tours</button>'
    +'<button onclick="window.open(\'https://www.google.com/search?q='+q+'+que+ver\',\'_blank\')">🗺️ Qué ver</button>'
    +'<button onclick="window.open(\'https://www.youtube.com/results?search_query='+q+'\',\'_blank\')">▶️ Videos</button>'
    +'<button class="tips" onclick="askClaudia(\'Dame 5 ideas imperdibles para nuestro paso por '+esc(name).replace(/'/g,'')+'\')">💡 Ideas IA</button>'
    +'</div></div>';
}
function openAct(a){$('ma-title').textContent=a.id?'Editar actividad':'Nueva actividad';$('ma-id').value=a.id||'';$('ma-date').value=a.activity_date||'';$('ma-time').value=a.start_time?a.start_time.slice(0,5):'';$('ma-tit').value=a.title||'';$('ma-cat').value=a.category||'';$('ma-city').value=a.city||'';$('ma-notes').value=a.notes||'';$('ma-link').value=a.link||'';$('ma-map').value=a.map_url||'';$('ma-tickets').value=a.tickets||'';$('m-act').classList.add('open');}
function editAct(id){const a=(DATA.activities||[]).find(x=>x.id===id);if(a)openAct(a);}
async function togAct(id,done){await write({action:'update',table:'activities',id:id,patch:{status:done?'pendiente':'hecho'}},done?'Pendiente':'¡Hecho! ✓');}
async function delAct(id){if(await confirmSheet('¿Borrar esta actividad?',null,'Borrar'))await write({action:'delete',table:'activities',id:id},'Borrado');}
async function moveAct(id,dir){
  const a=(DATA.activities||[]).find(x=>x.id===id);if(!a)return;
  const sib=(DATA.activities||[]).filter(x=>x.activity_date===a.activity_date).sort((x,y)=>(x.sort_order||0)-(y.sort_order||0)||((x.start_time||'')>(y.start_time||'')?1:-1));
  const i=sib.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=sib.length)return;
  const b=sib[j],so1=a.sort_order||0,so2=b.sort_order||0;
  let na=so2,nb=so1; if(so1===so2){na=dir<0?so2-1:so2+1;nb=so2;}
  await writeMany([{id:a.id,patch:{sort_order:na}},{id:b.id,patch:{sort_order:nb}}],'Reordenado');
}
async function saveAct(){const id=$('ma-id').value,tit=$('ma-tit').value.trim();if(!tit){showToast('Escribe la actividad',true);return;}
  const row={activity_date:$('ma-date').value||null,start_time:$('ma-time').value||null,title:tit,category:$('ma-cat').value||null,city:$('ma-city').value||null,notes:$('ma-notes').value||null,link:$('ma-link').value||null,map_url:$('ma-map').value||null,tickets:$('ma-tickets').value||null};
  if(id)await write({action:'update',table:'activities',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';row.is_suggestion=false;row.status='pendiente';await write({action:'insert',table:'activities',row:row},'Agregado ✓');}
  closeM('m-act');}

/* ---------- GASTOS ---------- */
function setFilter(kind,val){if(kind==='city')gCity=val;else gPayer=val;renderGastos();}
function renderGastos(){
  const budget=DATA.budget||[],exp=DATA.expenses||[];
  const totSpent=exp.reduce((s,e)=>s+Number(e.amount_mxn||0),0);
  const totMin=budget.reduce((s,b)=>s+Number(b.projected_min_mxn||0),0),totMax=budget.reduce((s,b)=>s+Number(b.projected_max_mxn||0),0);
  const pct=totMax?Math.min(100,totSpent/totMax*100):0,byP=p=>exp.filter(e=>e.payer===p).reduce((s,e)=>s+Number(e.amount_mxn||0),0);
  let html='<div class="bcard"><div class="btot"><div><div class="lbl">Gastado</div><div class="big">'+money(totSpent)+'</div></div><div style="text-align:right"><div class="lbl">Presupuesto</div><div class="big" style="font-size:1.05rem;color:var(--muted)">'+money(totMin)+'–'+money(totMax)+'</div></div></div><div class="bar"><i style="width:'+pct+'%"></i></div>';
  const TRV=DATA.trip_travelers||[];
  let split='<div class="split">';
  TRV.forEach(t=>{split+='<div><div class="who">👤 '+esc(t.name)+'</div><div class="amt2">'+money(byP(t.name))+'</div></div>';});
  if(TRV.length>=2)split+='<div><div class="who">🤝 Juntos</div><div class="amt2">'+money(byP('Joint'))+'</div></div>';
  html+=split+'</div></div>';
  html+='<div class="bcard">';
  budget.forEach(b=>{const sp=exp.filter(e=>e.category===b.category).reduce((s,e)=>s+Number(e.amount_mxn||0),0);const mx=Number(b.projected_max_mxn||0),p=mx?Math.min(100,sp/mx*100):0;
    html+='<div class="catrow" style="cursor:pointer" onclick="openBudget(\''+b.category+'\')"><div class="top"><span>'+(b.emoji||'')+' '+esc(b.label)+'</span><span>'+money(sp)+' <span class="sub">/ '+money(mx)+'</span></span></div><div class="bar"><i style="width:'+p+'%;background:'+(p>=100?'var(--red)':'var(--green)')+'"></i></div></div>';});
  html+='</div>';
  html+='<div class="chips"><div class="chip'+(gCity===''?' on':'')+'" onclick="setFilter(\'city\',\'\')">Todas</div>'+CITIES.map(c=>'<div class="chip'+(gCity===c.key?' on':'')+'" onclick="setFilter(\'city\',\''+esc(c.key)+'\')">'+c.flag+' '+esc(c.name)+'</div>').join('')+'</div>';
  const payerOpts=['',...TRV.map(t=>t.name),...(TRV.length>=2?['Joint']:[])];
  html+='<div class="chips">'+payerOpts.map(p=>'<div class="chip'+(gPayer===p?' on':'')+'" onclick="setFilter(\'payer\',\''+esc(p)+'\')">'+(p===''?'Todos':(p==='Joint'?'🤝 Juntos':'👤 '+esc(p)))+'</div>').join('')+'</div>';
  let list=exp.slice();if(gCity)list=list.filter(e=>e.city===gCity);if(gPayer)list=list.filter(e=>e.payer===gPayer);
  html+='<div class="bcard"><div class="lbl" style="margin-bottom:.3rem">Gastos'+(list.length?' ('+list.length+')':'')+'</div>';
  if(!list.length)html+=(gCity||gPayer)?emptyState('🔍','Sin gastos con ese filtro','Prueba quitar el filtro de ciudad o pagador.'):emptyState('💸','Aún no hay gastos','Registra tu primer gasto y mira cómo va tu presupuesto en vivo.','<button class="eb" onclick="openExp({})">+ Agregar gasto</button>');
  list.slice(0,60).forEach(e=>{const orig=(e.currency&&e.currency!=='MXN'&&e.amount_original)?' ('+(e.currency==='EUR'?'€':'$')+e.amount_original+')':'';
    html+='<div class="exp"><div><div class="d">'+esc(e.description)+'</div><div class="m">'+(e.expense_date||'')+(e.city?' · '+esc(e.city):'')+(e.payer?' · '+esc(e.payer):'')+'</div></div><div style="display:flex;align-items:center;gap:.3rem">'+(e.receipt_url?'<a href="'+esc(e.receipt_url)+'" target="_blank" class="x" aria-label="Ver recibo">'+I('clip',15)+'</a>':'')+'<span class="amt">'+money(e.amount_mxn)+orig+'</span><button class="x" onclick="editExpById(\''+e.id+'\')" aria-label="Editar">'+I('pencil',15)+'</button><button class="x" onclick="delExp(\''+e.id+'\')" aria-label="Borrar">'+I('trash',15)+'</button></div></div>';});
  html+='</div>';
  $('gastos-root').innerHTML=html;
  $('me-cat').innerHTML=budget.map(b=>'<option value="'+b.category+'">'+(b.emoji||'')+' '+esc(b.label)+'</option>').join('');
  const pSel=$('me-payer');if(pSel){const pv=pSel.value;const opts=[...(TRV.length>=2?['Joint']:[]),...TRV.map(t=>t.name)];pSel.innerHTML=opts.map(p=>'<option value="'+esc(p)+'">'+(p==='Joint'?'🤝 Juntos':'👤 '+esc(p))+'</option>').join('');if(opts.includes(pv))pSel.value=pv;}
  const cSel=$('me-cur');if(cSel){const cv=cSel.value;const curs=[...new Set([curCode(),'USD','EUR','MXN'])];cSel.innerHTML=curs.map(c=>'<option value="'+c+'">'+c+' '+curSym(c).trim()+'</option>').join('');cSel.value=curs.includes(cv)?cv:curCode();}
}
function editExpById(id){const e=(DATA.expenses||[]).find(x=>x.id===id);if(e)openExp(e);}
async function fxRate(from,to){const k='bayu_fx_'+from+'_'+to;try{const c=JSON.parse(localStorage.getItem(k)||'null');if(c&&Date.now()-c.ts<24*3600e3)return c.v;}catch(e){}
  try{const r=await fetch('https://api.frankfurter.dev/v1/latest?base='+from+'&symbols='+to);const j=await r.json();const v=j.rates&&j.rates[to];if(v){localStorage.setItem(k,JSON.stringify({ts:Date.now(),v:v}));return v;}}catch(e){}return null;}
function fxCalc(){const cur=$('me-cur').value,base=curCode(),orig=parseFloat($('me-orig').value)||0;
  if(cur===base){$('me-fxrow').style.display='none';$('me-mxn').value=orig||'';$('me-fxhint').textContent='';return;}
  $('me-fxrow').style.display='flex';let fx=parseFloat($('me-fx').value);
  if(!fx){$('me-fxhint').textContent='Buscando tasa '+cur+'→'+base+'…';fxRate(cur,base).then(v=>{if(v&&!parseFloat($('me-fx').value)){$('me-fx').value=v.toFixed(2);fxCalc();}else if(!v)$('me-fxhint').textContent='Sin tasa automática — escríbela manual';});return;}
  const mxn=Math.round(orig*fx);$('me-mxn').value=mxn||'';$('me-fxhint').textContent=orig?curSym(cur)+orig+' × '+fx+' = '+money(mxn):'';}
function openExp(e){$('me-title').textContent=e.id?'Editar gasto':'Nuevo gasto';$('me-id').value=e.id||'';$('me-desc').value=e.description||'';$('me-cur').value=e.currency||curCode();$('me-orig').value=(e.currency&&e.currency!=='MXN')?(e.amount_original||''):(e.amount_mxn||'');$('me-fx').value=e.fx_rate||'';$('me-mxn').value=e.amount_mxn||'';$('me-cat').value=e.category||(DATA.budget&&DATA.budget[0]&&DATA.budget[0].category)||'';$('me-payer').value=e.payer||'Joint';$('me-city').value=e.city||'';$('me-notes').value=e.notes||'';pendingReceipt=null;$('me-photo').value='';$('me-preview').innerHTML=e.receipt_url?'<a href="'+e.receipt_url+'" target="_blank"><img src="'+e.receipt_url+'" style="max-height:90px;border-radius:8px"/></a>':'';fxCalc();$('m-exp').classList.add('open');}
async function delExp(id){if(await confirmSheet('¿Borrar este gasto?',null,'Borrar'))await write({action:'delete',table:'expenses',id:id},'Borrado');}
async function saveExp(){const id=$('me-id').value,desc=$('me-desc').value.trim(),cur=$('me-cur').value,mxn=parseFloat($('me-mxn').value);const base=curCode();
  if(!desc){showToast('Escribe la descripción',true);return;}if(isNaN(mxn)){showToast('Monto inválido',true);return;}
  const row={description:desc,amount_mxn:mxn,currency:cur,category:$('me-cat').value,payer:$('me-payer').value,city:$('me-city').value||null,notes:$('me-notes').value||null};
  if(cur!==base){row.amount_original=parseFloat($('me-orig').value)||null;row.fx_rate=parseFloat($('me-fx').value)||null;}
  if(pendingReceipt){showToast('Subiendo foto…');const u=await uploadReceipt(pendingReceipt);if(u)row.receipt_url=u;}
  if(id)await write({action:'update',table:'expenses',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'expenses',row:row},'Gasto agregado ✓');}
  closeM('m-exp');}

/* ---------- EXPLORE ---------- */
const TIPS=[['🛂','Documentos','Revisa visa/permisos de tu destino y que el pasaporte tenga 6+ meses de vigencia.'],['📶','Conectividad','Una eSIM (Holafly/Airalo) te deja con datos apenas aterrizas.'],['🔌','Enchufes','Checa el tipo de clavija y voltaje del país y lleva adaptador.'],['🧳','Equipaje','Viaja ligero si cambias de hotel seguido. Revisa límites de tu aerolínea.'],['💳','Dinero','Avisa a tu banco, lleva algo de efectivo local y una tarjeta sin comisión.'],['🤖','Pregúntale a Claudia','Pídele tips, clima, números de emergencia o ideas específicas de tu destino.']];
function renderExplore(){
  let h='<button class="pf-btn" onclick="openTrans()">🌐 Traductor</button>'+docsHtml()+albumHtml()+exploreTop();
  h+='<div class="sec-h">💡 Tips de viaje</div>'+TIPS.map(t=>'<div class="tip"><h3>'+t[0]+' '+t[1]+'</h3><p>'+t[2]+'</p></div>').join('');
  if(CITIES.length){h+='<div class="sec-h">🎟️ Ideas para hacer</div>';CITIES.forEach(c=>{h+='<div style="font-weight:800;font-size:.86rem;margin:.6rem 0 .2rem">'+c.flag+' '+esc(c.name)+'</div>'+suggRow(c.key,c.name);});}
  h+=packingHtml()+emergencyHtml();
  if(TRIP&&TRIP.guide_url)h+='<a class="pf-btn" href="'+esc(TRIP.guide_url)+'" style="margin-top:1.2rem">📖 Abrir la guía completa por ciudad →</a>';
  $('explore-root').innerHTML=h;}
function openTrans(){$('tr-in').value='';$('tr-out').textContent='';$('m-trans').classList.add('open');}
async function doTranslate(){const t=$('tr-in').value.trim();if(!t)return;$('tr-out').textContent='Traduciendo…';try{const r=await fetch('/api/translate',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({text:t,target:$('tr-lang').value})});const j=await r.json();$('tr-out').textContent=j.translation||j.error||'(sin resultado)';}catch(e){$('tr-out').textContent='Error: '+e.message;}}
const PACK_BASIC=['Pasaporte / documentos','Visa o permisos (si aplica)','Adaptador de corriente','Cargadores + power bank','eSIM o plan de datos','Tarjetas + efectivo local','Medicinas personales','Ropa según el clima','Paraguas / impermeable','Zapatos cómodos','Copia de reservas','Cámara'];
function packingHtml(){const p=DATA.packing_items||[],done=p.filter(x=>x.checked).length;
  let h='<div class="sec-h">🧳 Empaque'+(p.length?' ('+done+'/'+p.length+')':'')+'</div><div class="bcard">';
  if(!p.length)h+=emptyState('🧳','Empaque vacío','Arranca con una lista básica o pídele a Claudia una a la medida de tu destino y clima.','<button class="eb" onclick="packStarter()">+ Lista básica</button> <button class="eb" onclick="askClaudia(\'Génerame una lista de empaque para este viaje según destino, clima y duración, y guárdala\')">✨ Con Claudia</button>');
  p.forEach(x=>{h+='<div class="act"><button class="chk" onclick="packTog(\''+x.id+'\','+(x.checked?'true':'false')+')" style="'+(x.checked?'background:var(--green);border-color:var(--green);color:#fff':'')+'">'+(x.checked?'✓':'')+'</button><div class="a-body"><div class="a-title" style="'+(x.checked?'text-decoration:line-through;opacity:.5':'')+'">'+esc(x.title)+'</div></div><button class="x" onclick="packDel(\''+x.id+'\')" aria-label="Quitar">'+I('trash',15)+'</button></div>';});
  if(p.length)h+='<button class="addbtn" onclick="packAdd()">+ Agregar al empaque</button>';
  return h+'</div>';}
async function packTog(id,checked){await write({action:'update',table:'packing_items',id:id,patch:{checked:!checked}},checked?'Pendiente':'✓');}
async function packDel(id){await write({action:'delete',table:'packing_items',id:id},'Quitado');}
async function packAdd(){const t=await promptSheet('¿Qué agregas al empaque?','Ej: Bloqueador solar','Agregar');if(t)await write({action:'insert',table:'packing_items',row:{title:t,sort_order:(DATA.packing_items||[]).length+1,created_by:'manual'}},'Agregado al empaque ✓');}
async function packStarter(){if(!SESSION){showAuth();return;}const tid=activeTripId();showToast('Creando lista…');
  for(let i=0;i<PACK_BASIC.length;i++){try{await execWrite({action:'insert',table:'packing_items',row:{title:PACK_BASIC[i],sort_order:i+1,created_by:'manual'},trip_id:tid});}catch(e){}}
  await load();showToast('Lista básica creada ✓');}
/* migración 1 vez: empaque viejo de localStorage → DB del viaje activo */
async function migratePack(){try{const v=localStorage.getItem('eurotrip_pack');if(!v)return;const old=JSON.parse(v);
  if((DATA.packing_items||[]).length||!old.length){localStorage.removeItem('eurotrip_pack');return;}
  if(!SESSION)return;const tid=activeTripId();if(!tid)return;
  for(let i=0;i<old.length;i++){await execWrite({action:'insert',table:'packing_items',row:{title:old[i].t,checked:!!old[i].c,sort_order:i+1,created_by:'migracion'},trip_id:tid});}
  localStorage.removeItem('eurotrip_pack');await load();}catch(e){}}
let currentAlbumCity='';
function docPick(){$('doc-file').click();}
function docUpload(input){const f=input.files[0];if(f)uploadAndSave(f,'document','');input.value='';}
function albumPick(city){currentAlbumCity=city;$('album-file').click();}
function albumUpload(input){const f=input.files[0];if(f)uploadAndSave(f,(f.type||'').startsWith('video')?'video':'photo',currentAlbumCity);input.value='';}
function fileToB64Raw(file,cb){const rd=new FileReader();rd.onload=e=>cb(e.target.result.split(',')[1]);rd.readAsDataURL(file);}
async function uploadAndSave(file,kind,city){const isImg=(file.type||'').startsWith('image/');if(!isImg&&file.size>4*1024*1024){showToast('Máx ~4MB por ahora (videos largos: próximamente)',true);return;}const ext=(file.name.split('.').pop()||'bin').toLowerCase();showToast('Subiendo…');if(!SESSION){showAuth();return;}const proceed=async(b64,ct,ex)=>{try{const up=await fetch('/api/upload',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({content_b64:b64,contentType:ct,ext:ex,trip_id:activeTripId()})});const uj=await up.json();if(!uj.ok){showToast(uj.error||'Error al subir',true);return;}await write({action:'insert',table:'media',row:{kind:kind,title:file.name,url:uj.url,city:city||null,mime:file.type,created_by:'manual'}},kind==='document'?'Documento guardado ✓':'Subido ✓');}catch(e){showToast('Error de red',true);}};if(isImg)fileToB64Resized(file,1600,b64=>proceed(b64,'image/jpeg','jpg'));else fileToB64Raw(file,b64=>proceed(b64,file.type||'application/octet-stream',ext));}
function docsHtml(){const docs=(DATA.media||[]).filter(m=>m.kind==='document');let h='<div class="sec-h">📄 Documentos <button class="chip" style="float:right" onclick="docPick()">+ Subir</button></div><div class="bcard">';if(!docs.length)h+=emptyState('📄','Sin documentos','Pasaporte, pases de abordar, vouchers, seguro… súbelos para tenerlos offline.','<button class="eb" onclick="docPick()">+ Subir documento</button>');docs.forEach(m=>{h+='<div class="doc-row"><a href="'+esc(m.url)+'" target="_blank">📎 '+esc(m.title||'documento')+'</a><button class="x" onclick="delMedia(\''+m.id+'\')" aria-label="Borrar">'+I('trash',15)+'</button></div>';});return h+'</div>';}
function albumHtml(){const photos=(DATA.media||[]).filter(m=>m.kind==='photo'||m.kind==='video');let h='<div class="sec-h">📸 Álbum por ciudad</div>';CITIES.forEach(c=>{const ph=photos.filter(m=>m.city===c.key);h+='<div class="bcard"><div style="display:flex;justify-content:space-between;align-items:center"><strong>'+c.flag+' '+esc(c.name)+(ph.length?' · '+ph.length:'')+'</strong><button class="chip" onclick="albumPick(\''+esc(c.key)+'\')">+ Foto/Video</button></div>';if(ph.length)h+='<div class="media-grid">'+ph.map(m=>'<div class="media-item">'+(m.kind==='video'?'<video src="'+esc(m.url)+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px" onclick="window.open(\''+esc(m.url)+'\')"></video>':'<img src="'+esc(m.url)+'" onclick="window.open(\''+esc(m.url)+'\')"/>')+'<button class="del" onclick="delMedia(\''+m.id+'\')" aria-label="Borrar">'+I('x',13)+'</button></div>').join('')+'</div>';h+='</div>';});return h;}
async function delMedia(id){if(await confirmSheet('¿Borrar este archivo?',null,'Borrar'))await write({action:'delete',table:'media',id:id},'Borrado');}


const EMERGENCY={FR:[['SAMU médico','15'],['Policía','17']],ES:[['Policía Nacional','091'],['Urgencias médicas','061']],PT:[['Emergencias','112']],IT:[['Emergencias','112']],DE:[['Policía','110']],GB:[['Emergencias','999']],US:[['Emergencias','911']],MX:[['Emergencias','911']],CA:[['Emergencias','911']],JP:[['Policía','110'],['Ambulancia','119']],KR:[['Policía','112'],['Ambulancia','119']],CN:[['Policía','110'],['Ambulancia','120']],BR:[['Policía','190'],['Ambulancia','192']],AR:[['Emergencias','911']],CO:[['Emergencias','123']],AU:[['Emergencias','000']],NZ:[['Emergencias','111']]};
const EU_CC=['FR','ES','PT','IT','DE','NL','BE','AT','GR','IE','FI','SE','DK','PL','CZ','HU','HR','CH','NO'];
function emergencyHtml(){
  const ccs=[...new Set(CITIES.map(c=>c.cc).filter(Boolean))];
  let h='<div class="sec-h">🆘 Emergencia</div><div class="bcard">';
  if(!ccs.length||ccs.some(cc=>EU_CC.includes(cc)))h+='<div class="pf-row"><span>🚨 Emergencia general (UE y varios países)</span><a href="tel:112" style="color:var(--red);font-weight:800">112</a></div>';
  ccs.forEach(cc=>{(EMERGENCY[cc]||[]).forEach(e=>{h+='<div class="pf-row"><span>'+esc(cc)+' · '+esc(e[0])+'</span><a href="tel:'+e[1]+'" style="color:var(--red);font-weight:800">'+e[1]+'</a></div>';});});
  h+='<div class="pf-row" style="color:var(--muted);font-size:.82rem">📌 Pídele a Claudia los números locales, embajada y qué hacer si pierdes tarjetas en tu destino.</div></div>';
  return h;}

/* ---------- PERFIL ---------- */
function renderPerfil(){const hotels=DATA.hotel_choices||[];
  const nm=(TRIP&&TRIP.name)||'Tu viaje',sub=(TRIP&&TRIP.subtitle)?' · '+TRIP.subtitle:'',dd=(TRIP&&TRIP.start_date)?heroDates():'Sin fechas aún';
  let h='<div class="bcard"><div class="lbl">El viaje</div><div style="font-size:1.2rem;font-weight:800;margin:.2rem 0">'+esc(nm+sub)+'</div><div style="color:var(--muted);font-size:.88rem">'+esc(dd)+'</div><button class="chip" style="margin-top:.6rem" onclick="go(\'viajes\')">✈️ Cambiar de viaje</button></div>';
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.2rem">Hoteles</div>';
  CITIES.forEach(c=>{const ho=hotels.find(x=>x.city===c.key);h+='<div class="pf-row"><span>'+c.flag+' '+esc(c.name)+'</span><span style="color:var(--muted)">'+(ho?(ho.confirmed?'✅ '+esc(ho.hotel_name):'⏳ por definir'):'—')+'</span></div>';});
  h+='</div>';
  const ME=(SESSION&&SESSION.user)||{};
  h+='<div class="bcard"><div class="lbl">Tu cuenta</div><div class="pf-row"><span>📧 '+esc(ME.email||'—')+'</span><button class="chip" onclick="logout()">Salir</button></div>';
  h+='<div class="pf-row"><button class="chip" onclick="exportData()">⬇️ Exportar mis datos</button><button class="chip" style="color:var(--red)" onclick="deleteAccount()">🗑️ Borrar cuenta</button></div></div>';
  const MEM=DATA.members||[];
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.2rem">Compañeros con acceso a este viaje</div>';
  MEM.forEach(function(m){const nm=(m.profile&&(m.profile.display_name||m.profile.email))||'usuario';
    h+='<div class="pf-row"><span>👥 '+esc(nm)+' <span style="color:var(--muted);font-size:.74rem">'+esc(m.role)+'</span></span>'+(m.user_id!==ME.id?'<button class="x" onclick="removeMember(\''+m.user_id+'\',\''+esc(nm)+'\')" aria-label="Quitar">'+I('trash',14)+'</button>':'<span style="color:var(--muted);font-size:.74rem">tú</span>')+'</div>';});
  h+='<button class="chip" onclick="inviteMember()">+ Invitar por email</button></div>';
  const TRV=DATA.trip_travelers||[];
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.2rem">Viajeros · moneda '+esc(curCode())+'</div>';
  TRV.forEach(t=>{h+='<div class="pf-row"><span>👤 '+esc(t.name)+'</span><button class="x" onclick="delTraveler(\''+t.id+'\',\''+esc(t.name)+'\')" aria-label="Quitar">'+I('trash',14)+'</button></div>';});
  h+='<button class="chip" onclick="addTraveler()">+ Agregar viajero</button></div>';
  const _pq=queueGet().length;if(_pq)h+='<div class="bcard" style="background:#FFF3B0;color:#7a6a00;font-weight:700">⏳ '+_pq+' cambios pendientes <button class="chip" onclick="flushQueue()">Sincronizar</button></div>';
  const _tm=localStorage.getItem('bayu_theme')||'auto';
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.4rem">🎨 Tema</div><div class="seg">'+['light','auto','dark'].map(function(x){return '<button class="seg-btn'+(_tm===x?' on':'')+'" onclick="setTheme(\''+x+'\')">'+({light:'☀️ Claro',auto:'🔄 Auto',dark:'🌙 Oscuro'}[x])+'</button>';}).join('')+'</div></div>';
  h+=''+(TRIP&&TRIP.guide_url?'<a class="pf-btn" href="'+esc(TRIP.guide_url)+'">📖 Guía editorial completa</a>':'')+'<button class="pf-btn" onclick="infoSheet(\'Instalar Bayu\',\'iPhone: Safari → Compartir → Agregar a pantalla de inicio. Android: Chrome → menú ⋮ → Instalar app.\')">📲 Cómo instalar la app</button><button class="pf-btn" onclick="load();showToast(\'Actualizado ✓\')">🔄 Recargar datos</button><button class="pf-btn" onclick="logout()" style="color:var(--red);font-weight:700">🚪 Cerrar sesión</button>';
  h+='<div style="text-align:center;color:var(--muted);font-size:.74rem;margin-top:1rem">Bayu v12 · Arkamia Lab</div>';$('perfil-root').innerHTML=h;}
function applyTheme(){var m=localStorage.getItem('bayu_theme')||'auto';var d=m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}
function setTheme(m){localStorage.setItem('bayu_theme',m);applyTheme();renderPerfil();showToast('Tema: '+({light:'Claro',auto:'Auto',dark:'Oscuro'}[m]||m));}
async function addTraveler(){const n=await promptSheet('Nombre del viajero','Ej: Ana','Agregar');if(!n)return;
  await write({action:'insert',table:'trip_travelers',row:{name:n,sort_order:(DATA.trip_travelers||[]).length+1,created_by:'manual'}},'Viajero agregado ✓');}
async function delTraveler(id,name){if(await confirmSheet('¿Quitar a '+name+'?','Sus gastos registrados se conservan con su nombre.','Quitar'))await write({action:'delete',table:'trip_travelers',id:id},'Quitado');}

/* ---------- MIS VIAJES (multi-viaje) ---------- */
function statusBadge(s){return s==='active'?'<span class="tstat ta">● En curso</span>':s==='completed'?'<span class="tstat tc">✓ Terminado</span>':'<span class="tstat tp">◷ Planeando</span>';}
function fmtTripDates(t){if(!t.start_date)return 'Sin fechas';const s=t.start_date,e=t.end_date||s;const sd=+s.slice(8,10),sm=+s.slice(5,7)-1,ed=+e.slice(8,10),em=+e.slice(5,7)-1,yr=s.slice(0,4);return sd+' '+MES[sm]+'–'+ed+' '+MES[em]+' '+yr;}
function renderViajes(){
  let h='';
  if(!TRIPS.length){h=emptyState('🌍','Aún no hay viajes','Crea tu primer viaje para empezar a planear.','<button class="eb" onclick="openTrip({})">+ Nuevo viaje</button>');$('viajes-root').innerHTML=h;return;}
  h+='<div class="sec-h" style="margin-top:.3rem">Toca un viaje para abrirlo</div>';
  TRIPS.forEach(t=>{const on=TRIP&&t.id===TRIP.id;
    h+='<div class="tcard'+(on?' on':'')+'" onclick="switchTrip(\''+t.id+'\')">';
    h+='<div class="tcover"'+(t.cover_image?'':' style="background:linear-gradient(135deg,#FF5A5F,#FB923C)"')+'>'+(t.cover_image?'<img src="'+esc(t.cover_image)+'" onerror="this.style.display=\'none\'"/>':'')+'<span class="tflag">'+(t.flag||'🌍')+'</span></div>';
    h+='<div class="tinfo"><div class="tname">'+esc(t.name)+(on?' <span class="tnow">activo</span>':'')+'</div>'+(t.subtitle?'<div class="tsub">'+esc(t.subtitle)+'</div>':'')+'<div class="tmeta">'+statusBadge(t.status)+' · '+fmtTripDates(t)+'</div></div>';
    h+='<button class="tedit" onclick="event.stopPropagation();openTrip2(\''+t.id+'\')" aria-label="Editar viaje">'+I('pencil',16)+'</button></div>';
  });
  h+='<button class="addbtn" style="margin-top:.8rem" onclick="openTrip({})">+ Nuevo viaje</button>';
  $('viajes-root').innerHTML=h;
}
async function switchTrip(id){if(TRIP&&id===TRIP.id){go('planner');return;}localStorage.setItem('bayu_trip_id',id);DATA={};chatStarted=false;chatMsgs=[];var cl=$('chat-log');if(cl)cl.innerHTML='';showToast('Cambiando de viaje…');await load();go('planner');}
function openTrip(t){$('mt-id').value=t.id||'';$('mt-name').value=t.name||'';$('mt-sub').value=t.subtitle||'';$('mt-flag').value=t.flag||'🌍';$('mt-start').value=t.start_date||'';$('mt-end').value=t.end_date||'';$('mt-cover').value=t.cover_image||'';$('mt-status').value=t.status||'planning';$('mt-cur').value=t.home_currency||'MXN';$('mt-del').style.display=t.id?'block':'none';$('mt-title').textContent=t.id?'Editar viaje':'Nuevo viaje';$('m-trip').classList.add('open');}
function openTrip2(id){const t=TRIPS.find(x=>x.id===id);if(t)openTrip(t);}
async function saveTrip(){const id=$('mt-id').value,name=$('mt-name').value.trim();if(!name){showToast('Ponle nombre al viaje',true);return;}
  const row={name:name,subtitle:$('mt-sub').value||null,flag:$('mt-flag').value||'🌍',start_date:$('mt-start').value||null,end_date:$('mt-end').value||null,cover_image:$('mt-cover').value||null,status:$('mt-status').value||'planning',home_currency:$('mt-cur').value||'MXN'};
  if(id){await write({action:'update',table:'trips',id:id,patch:row},'Viaje guardado ✓');closeM('m-trip');return;}
  if(!SESSION){showAuth();return;}
  row.created_by='manual';row.owner_id=SESSION.user.id;
  try{const r=await execWrite({action:'insert',table:'trips',row:row});
    if(!r.ok){showToast(r.error||'Error',true);return;}
    if(r.data&&r.data.id){localStorage.setItem('bayu_trip_id',r.data.id);
      const me=await promptSheet('¿Quién viaja? (tu nombre)','Ej: Ana','Continuar');
      if(me)await execWrite({action:'insert',table:'trip_travelers',row:{name:me,sort_order:1,created_by:'manual'},trip_id:r.data.id});
    }
    closeM('m-trip');showToast('Viaje creado ✓ — agrégale ciudades');await load();go('planner');
  }catch(e){showToast('Sin red',true);}
}
async function delTrip(){const id=$('mt-id').value;if(!id)return;
  if(TRIPS.length<=1){showToast('No puedes borrar tu único viaje',true);return;}
  if(!await confirmSheet('¿Borrar este viaje?','Se borra TODO su contenido: actividades, gastos, fotos y reservas. No se puede deshacer.','Borrar todo'))return;
  if(TRIP&&TRIP.id===id)localStorage.removeItem('bayu_trip_id');
  closeM('m-trip');await write({action:'delete',table:'trips',id:id},'Viaje borrado');go('viajes');
}

/* ---------- CLAUDIA ---------- */
let chatMsgs=[];
const CHIPS=['¿Cuánto llevamos gastado?','¿Qué falta por reservar?','Busca hoteles para una ciudad','Dame ideas para este viaje'];
async function startChat(){if(chatStarted)return;chatStarted=true;
  $('chat-chips').innerHTML=CHIPS.map(c=>'<div class="chat-chip" onclick="chipSend(this)">'+esc(c)+'</div>').join('');
  try{const r=await fetch('/api/chat?trip='+encodeURIComponent(activeTripId()),{headers:authHeaders()});const j=await r.json();
    if(j.ok&&j.messages&&j.messages.length){j.messages.forEach(m=>{pushBub(m.role==='user'?'user':'assistant',m.content);chatMsgs.push({role:m.role,content:m.content});});return;}
  }catch(e){}
  pushBub('assistant','¡Hola! Soy Claudia'+(TRIP&&TRIP.name?' — tu asistente para '+TRIP.name:'')+'. Puedo armar tu plan, registrar gastos, buscar vuelos y hoteles con precios reales, y resolver dudas del viaje. Dime qué necesitas o toca una sugerencia 👇');}
function chipSend(el){$('chat-in').value=el.textContent;sendChat();}
function mdInline(s){return s
  .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g,'<img class="md-img" src="$2" alt="$1" loading="lazy" onclick="window.open(this.src,\'_blank\')" onerror="this.remove()"/>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g,'$1<em>$2</em>')
  .replace(/`([^`]+)`/g,'<code>$1</code>')
  .replace(/(^|[\s(])(https?:\/\/[^\s<"')]+)/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');}
function mdToHtml(raw){
  const text=esc(raw||'');const lines=text.split('\n');let html='',list=null;
  const closeList=function(){if(list){html+='</'+list+'>';list=null;}};
  for(let i=0;i<lines.length;i++){
    let l=lines[i].trim();
    if(!l){closeList();continue;}
    if(/^---+$/.test(l)||/^___+$/.test(l)){closeList();html+='<hr/>';continue;}
    let m;
    if(m=l.match(/^#{1,6}\s+(.*)$/)){closeList();html+='<div class="md-h">'+mdInline(m[1])+'</div>';continue;}
    if(m=l.match(/^[-*•]\s+(.*)$/)){if(list!=='ul'){closeList();html+='<ul>';list='ul';}html+='<li>'+mdInline(m[1])+'</li>';continue;}
    if(m=l.match(/^\d+[.)]\s+(.*)$/)){if(list!=='ol'){closeList();html+='<ol>';list='ol';}html+='<li>'+mdInline(m[1])+'</li>';continue;}
    closeList();html+='<p>'+mdInline(l)+'</p>';
  }
  closeList();return html||'<p></p>';}
function pushBub(role,text){const d=document.createElement('div');d.className='bub '+(role==='user'?'u':'a md');if(role==='user')d.textContent=text;else d.innerHTML=mdToHtml(text);$('chat-log').appendChild(d);d.scrollIntoView({behavior:'smooth'});return d;}
async function sendChat(){const inp=$('chat-in'),t=inp.value.trim();if(!t)return;inp.value='';pushBub('user',t);chatMsgs.push({role:'user',content:t});const typing=pushBub('assistant','…');
  try{const r=await fetch('/api/chat',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({messages:chatMsgs,trip_id:activeTripId()})});const j=await r.json();const reply=j.reply||j.error||'(sin respuesta)';typing.innerHTML=mdToHtml(reply);chatMsgs.push({role:'assistant',content:reply});if(j.tool_events&&j.tool_events.length){load();showToast('Plan actualizado ✓');}}catch(e){typing.textContent='Error: '+e.message;}}

/* ---------- reservas / links (Push C) ---------- */
const RES_ICON={flight:'✈️',hotel:'🏨',restaurant:'🍽️',train:'🚄',tour:'🎟️',transfer:'🚐',activity:'🎫',other:'📋'};
function resHtml(date){const rs=(DATA.reservations||[]).filter(r=>r.date===date);if(!rs.length)return '';
  return rs.map(r=>{const ic=RES_ICON[r.type]||'📋';const meta=[r.time,(r.confirmation_code?'cód '+r.confirmation_code:''),r.cost].filter(Boolean).map(esc).join(' · ');
    return '<div class="resv"><span class="ri">'+ic+'</span><div class="rb"><div class="rt">'+esc(r.title)+'</div><div class="rm">'+meta+(r.link?' · <a href="'+esc(r.link)+'" target="_blank">abrir</a>':'')+'</div></div><button class="rx" onclick="delRes(\''+r.id+'\')" aria-label="Borrar">'+I('trash',14)+'</button></div>';}).join('');}
function exploreTop(){
  let h='<div class="sec-h">📋 Reservas <button class="chip" style="float:right" onclick="openRes({})">+ Reserva</button></div><div class="bcard">';
  const rs=(DATA.reservations||[]).slice().sort((a,b)=>((a.date||'')+(a.time||''))<((b.date||'')+(b.time||''))?-1:1);
  if(!rs.length)h+=emptyState('🎟️','Sin reservas todavía','Vuelos, hoteles, tours, cenas… guárdalos aquí y aparecen en tu itinerario por día.','<button class="eb" onclick="openRes({})">+ Agregar reserva</button>');
  rs.forEach(r=>{const ic=RES_ICON[r.type]||'📋';const meta=[r.date,r.time,(r.confirmation_code?'cód '+r.confirmation_code:''),r.cost].filter(Boolean).map(esc).join(' · ');
    h+='<div class="resv"><span class="ri">'+ic+'</span><div class="rb"><div class="rt">'+esc(r.title)+'</div><div class="rm">'+meta+(r.link?' · <a href="'+esc(r.link)+'" target="_blank">abrir</a>':'')+'</div></div><button class="rx" onclick="openRes2(\''+r.id+'\')" aria-label="Editar">'+I('pencil',14)+'</button><button class="rx" onclick="delRes(\''+r.id+'\')" aria-label="Borrar">'+I('trash',14)+'</button></div>';});
  h+='</div>';
  const bm=(DATA.bookmarks||[]);
  h+='<div class="sec-h">🔖 Links <button class="chip" style="float:right" onclick="openLink({})">+ Link</button></div><div class="bcard">';
  if(!bm.length)h+=emptyState('🔖','Sin links guardados','Recetas, reseñas, mapas, artículos… guárdalos para tenerlos a mano.','<button class="eb" onclick="openLink({})">+ Agregar link</button>');
  bm.forEach(b=>{h+='<div class="linkrow"><a href="'+esc(b.url)+'" target="_blank">'+esc(b.title)+'</a><button class="rx" onclick="delBookmark(\''+b.id+'\')" aria-label="Borrar">'+I('trash',14)+'</button></div>';});
  h+='</div>';
  return h;
}
function openRes(r){$('mr-id').value=r.id||'';$('mr-type').value=r.type||'hotel';$('mr-title').value=r.title||'';$('mr-date').value=r.date||'';$('mr-time').value=r.time||'';$('mr-code').value=r.confirmation_code||'';$('mr-link').value=r.link||'';$('mr-city').value=r.city||'';$('mr-cost').value=r.cost||'';$('mr-notes').value=r.notes||'';$('m-res').classList.add('open');}
function openRes2(id){const r=(DATA.reservations||[]).find(x=>x.id===id);if(r)openRes(r);}
async function saveRes(){const id=$('mr-id').value,t=$('mr-title').value.trim();if(!t){showToast('Título requerido',true);return;}
  const row={type:$('mr-type').value,title:t,date:$('mr-date').value||null,time:$('mr-time').value||null,confirmation_code:$('mr-code').value||null,link:$('mr-link').value||null,city:$('mr-city').value||null,cost:$('mr-cost').value||null,notes:$('mr-notes').value||null};
  if(id)await write({action:'update',table:'reservations',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'reservations',row:row},'Reserva agregada ✓');}closeM('m-res');}
async function delRes(id){if(await confirmSheet('¿Borrar esta reserva?',null,'Borrar'))await write({action:'delete',table:'reservations',id:id},'Borrado');}
function openLink(b){$('ml-id').value=b.id||'';$('ml-title').value=b.title||'';$('ml-url').value=b.url||'';$('ml-city').value=b.city||'';$('m-link').classList.add('open');}
async function saveLink(){const id=$('ml-id').value,t=$('ml-title').value.trim(),u=$('ml-url').value.trim();if(!t||!u){showToast('Título y URL requeridos',true);return;}
  const row={title:t,url:u,city:$('ml-city').value||null};
  if(id)await write({action:'update',table:'bookmarks',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'bookmarks',row:row},'Link guardado ✓');}closeM('m-link');}
async function delBookmark(id){if(await confirmSheet('¿Borrar este link?',null,'Borrar'))await write({action:'delete',table:'bookmarks',id:id},'Borrado');}

/* ---------- hoteles / budget / mapa (Push B) ---------- */
function openHotel(city){const h=(DATA.hotel_choices||[]).find(x=>x.city===city)||{};$('mh-title').textContent='Hotel · '+city;$('mh-city').value=city;$('mh-name').value=(h.hotel_name&&h.hotel_name!=='Por definir')?h.hotel_name:'';$('mh-zone').value=h.zone||'';$('mh-price').value=h.price_per_night||'';$('mh-conf').value=h.confirmed?'true':'false';$('mh-url').value=h.booking_url||'';$('mh-notes').value=h.notes||'';$('m-hotel').classList.add('open');}
async function saveHotel(){const city=$('mh-city').value,name=$('mh-name').value.trim();if(!name){showToast('Escribe el hotel',true);return;}
  const row={city:city,hotel_name:name,zone:$('mh-zone').value||null,price_per_night:$('mh-price').value||null,confirmed:$('mh-conf').value==='true',booking_url:$('mh-url').value||null,notes:$('mh-notes').value||null};
  await write({action:'upsert',table:'hotel_choices',row:row},'Hotel guardado ✓');closeM('m-hotel');}
function openBudget(cat){const b=(DATA.budget||[]).find(x=>x.category===cat);if(!b)return;$('mb-cat').value=cat;$('mb-label').value=(b.emoji||'')+' '+b.label;$('mb-min').value=b.projected_min_mxn||0;$('mb-max').value=b.projected_max_mxn||0;$('m-budget').classList.add('open');}
async function saveBudget(){const cat=$('mb-cat').value,mn=parseFloat($('mb-min').value),mx=parseFloat($('mb-max').value);if(isNaN(mn)||isNaN(mx)||mx<mn){showToast('Montos inválidos (máx ≥ mín)',true);return;}await write({action:'update',table:'budget',id:cat,patch:{projected_min_mxn:mn,projected_max_mxn:mx}},'Presupuesto actualizado ✓');closeM('m-budget');}
function mapDay(date){const acts=(DATA.activities||[]).filter(a=>a.activity_date===date&&a.category!=='logistica');if(!acts.length){showToast('Sin lugares ese día');return;}
  const pts=acts.map(a=>encodeURIComponent(a.title+(a.city?', '+a.city:'')));let url;
  if(pts.length===1)url='https://www.google.com/maps/search/?api=1&query='+pts[0];
  else url='https://www.google.com/maps/dir/?api=1&destination='+pts[pts.length-1]+'&waypoints='+pts.slice(0,-1).join('%7C');
  window.open(url,'_blank');}

/* ---------- shared ---------- */
function closeM(id){$(id).classList.remove('open');}
async function execWrite(body){
  if(!SESSION)return {ok:false,error:'Sin sesión'};
  const tid=body.trip_id||activeTripId(),isTrips=body.table==='trips',tn='bayu_'+body.table,pk=body.table==='budget'?'category':'id';
  let q;
  if(body.action==='insert'){const row=Object.assign({},body.row);if(!isTrips)row.trip_id=row.trip_id||tid;q=sbc.from(tn).insert(row).select().single();}
  else if(body.action==='update'){q=sbc.from(tn).update(body.patch).eq(pk,body.id);if(!isTrips)q=q.eq('trip_id',tid);}
  else if(body.action==='upsert'){const row=Object.assign({},body.row);if(!isTrips)row.trip_id=row.trip_id||tid;const onc=body.table==='hotel_choices'?'trip_id,city':body.table==='day_overrides'?'trip_id,date':body.table==='budget'?'trip_id,category':'id';q=sbc.from(tn).upsert(row,{onConflict:onc});}
  else if(body.action==='delete'){q=sbc.from(tn).delete().eq(pk,body.id);if(!isTrips)q=q.eq('trip_id',tid);}
  else return {ok:false,error:'acción inválida'};
  const r=await q;
  if(r.error){if(/fetch|network/i.test(r.error.message))throw new Error(r.error.message);return {ok:false,error:r.error.message};}
  return {ok:true,data:r.data};
}
async function write(body,okMsg){
  if(!SESSION){showAuth();return;}
  try{const r=await execWrite(body);
    if(!r.ok){showToast(r.error||'Error',true);return;}
    await load();showToast(okMsg||'Listo ✓');
  }catch(e){queuePush(Object.assign({},body,{trip_id:body.trip_id||activeTripId()}));showToast('Sin red: guardado, sincroniza al reconectar ⏳');}}
async function writeMany(items,okMsg){if(!SESSION){showAuth();return;}const tid=activeTripId();
  try{for(const it of items){await execWrite({action:'update',table:'activities',id:it.id,patch:it.patch,trip_id:tid});}await load();showToast(okMsg||'Listo ✓');}catch(e){items.forEach(it=>queuePush({action:'update',table:'activities',id:it.id,patch:it.patch,trip_id:tid}));showToast('Sin red ⏳');}}

/* offline queue + recibos (Push D) */
function queueGet(){try{return JSON.parse(localStorage.getItem('bayu_queue')||'[]');}catch(e){return [];}}
function queuePush(b){const q=queueGet();q.push(b);localStorage.setItem('bayu_queue',JSON.stringify(q));}
async function flushQueue(){let q=queueGet();if(!q.length||!SESSION)return;const left=[];for(const b of q){try{const r=await execWrite(b);if(!r.ok)left.push(b);}catch(e){left.push(b);}}localStorage.setItem('bayu_queue',JSON.stringify(left));if(left.length<q.length){await load();showToast('Sincronizado ✓');}}
window.addEventListener('online',flushQueue);
function fileToB64Resized(file,max,cb){const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;if(w>h&&w>max){h=Math.round(h*max/w);w=max;}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',0.82).split(',')[1]);};img.src=e.target.result;};rd.readAsDataURL(file);}
function pickReceipt(input){const f=input.files&&input.files[0];if(!f)return;fileToB64Resized(f,1200,b64=>{pendingReceipt=b64;document.getElementById('me-preview').innerHTML='<img src="data:image/jpeg;base64,'+b64+'" style="max-height:90px;border-radius:8px"/>';showToast('Foto lista, guarda el gasto');});}
async function uploadReceipt(b64){if(!SESSION)return null;try{const r=await fetch('/api/upload',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({content_b64:b64,contentType:'image/jpeg',ext:'jpg',trip_id:activeTripId()})});const j=await r.json();return j.ok?j.url:null;}catch(e){showToast('No se pudo subir la foto',true);return null;}}

/* pull-to-refresh */
let ptrY=0,ptrOn=false;
document.addEventListener('touchstart',e=>{if(window.scrollY<=0){ptrY=e.touches[0].clientY;ptrOn=true;}},{passive:true});
document.addEventListener('touchmove',e=>{if(!ptrOn)return;if(e.touches[0].clientY-ptrY>65)$('ptr').classList.add('show');else $('ptr').classList.remove('show');},{passive:true});
document.addEventListener('touchend',()=>{if(ptrOn&&$('ptr').classList.contains('show')){load();showToast('Actualizando…');}$('ptr').classList.remove('show');ptrOn=false;},{passive:true});

initAuth();
if(!localStorage.getItem('bayu_onboarded')){var _o=document.getElementById('onb');if(_o)_o.classList.add('show');}
function closeOnb(){var o=document.getElementById('onb');if(o)o.classList.remove('show');localStorage.setItem('bayu_onboarded','1');}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
