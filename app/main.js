'use strict';
const DOW=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const CAT={comida:'🍽️',museo:'🏛️',paseo:'🚶','viñedo':'🍷',vinedo:'🍷',actividad:'🎟️',compras:'🛍️',traslado:'🚄',logistica:'🧳',flex:'✨'};
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
let CITIES=[];  // se construye desde DATA.trip_cities (multi-viaje)
const SUGG={
  'Paris':[{t:'Crucero por el Sena',img:'images/paris/sena.jpg',r:'8.1',rev:'13577',p:'$19',cat:'actividad'},{t:'Louvre sin filas',img:'images/paris/louvre.jpg',r:'8.5',rev:'9200',p:'$32',cat:'museo'},{t:'Cima de la Torre Eiffel',img:'images/paris/eiffel.jpg',r:'8.7',rev:'21043',p:'$45',cat:'actividad'},{t:'Versalles día completo',img:'images/paris/versalles.jpg',r:'8.6',rev:'7810',p:'$65',cat:'museo'}],
  'Bordeaux':[{t:'Tour viñedos Saint-Émilion',img:'images/bordeaux/saint-emilion.jpg',r:'9.0',rev:'3412',p:'$115',cat:'viñedo'},{t:'Cité du Vin + cata',img:'images/bordeaux/cite-du-vin.jpg',r:'8.2',rev:'2104',p:'$22',cat:'museo'},{t:'Ostras + vino en el mercado',img:'images/bordeaux/oysters.jpg',r:'8.8',rev:'915',p:'$35',cat:'comida'}],
  'San Sebastián':[{t:'Ruta de pintxos guiada',img:'images/san-sebastian/pintxos.jpg',r:'9.1',rev:'2630',p:'$89',cat:'comida'},{t:'Monte Igueldo + bahía',img:'images/san-sebastian/igueldo.jpg',r:'8.4',rev:'1180',p:'$15',cat:'actividad'},{t:'Donostia + Getaria',img:'images/san-sebastian/zurriola.jpg',r:'8.7',rev:'604',p:'$70',cat:'paseo'}],
  'Bilbao':[{t:'Entrada Museo Guggenheim',img:'images/bilbao/guggenheim.jpg',r:'9.0',rev:'5421',p:'$16',cat:'museo'},{t:'Txikiteo de pintxos',img:'images/bilbao/mercado-ribera.jpg',r:'8.9',rev:'1106',p:'$55',cat:'comida'},{t:'Bilbao esencial a pie',img:'images/bilbao/casco-viejo.jpg',r:'8.5',rev:'842',p:'$25',cat:'paseo'}],
  'Madrid':[{t:'Museo del Prado sin filas',img:'images/madrid/plaza-mayor.jpg',r:'8.6',rev:'12044',p:'$28',cat:'museo'},{t:'Show de flamenco',img:'images/madrid/tapas-madrid.jpg',r:'8.8',rev:'6530',p:'$35',cat:'actividad'},{t:'Toledo día completo',img:'images/madrid/toledo.jpg',r:'8.7',rev:'9012',p:'$55',cat:'museo'},{t:'Palacio Real',img:'images/madrid/palacio-real.jpg',r:'8.5',rev:'4310',p:'$18',cat:'museo'}]
};
let DATA={}, TRIPS=[], TRIP=null, gCity='', gPayer='', chatStarted=false, pendingReceipt=null;
function activeTripId(){return localStorage.getItem('bayu_trip_id')||(TRIP&&TRIP.id)||'';}
function tripStart(){return (TRIP&&TRIP.start_date)||'2026-10-16';}
function tripEnd(){return (TRIP&&TRIP.end_date)||'2026-10-31';}
const SEED_TRIP='e0000000-0000-4000-8000-000000000001';
function isEurotrip(){return TRIP&&TRIP.id===SEED_TRIP;}
const $=id=>document.getElementById(id);
function esc(t){return (t==null?'':String(t)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function dn(iso){const p=iso.split('-');const d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));return DOW[d.getUTCDay()]+' '+(+p[2])+' '+MES[+p[1]-1];}
function wkey(){let k=localStorage.getItem('eurotrip_write_key');if(!k){k=prompt('Clave de escritura (David/Paty):');if(k)localStorage.setItem('eurotrip_write_key',k);}return k;}
function money(n){return '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
function emptyState(icon,title,sub,btn){return '<div class="empty-rich"><div class="ei">'+icon+'</div><div class="et">'+esc(title)+'</div>'+(sub?'<div class="es">'+esc(sub)+'</div>':'')+(btn||'')+'</div>';}
let CITYKEYS=CITIES.map(c=>c.key);
function cityByDate(date){const c=CITIES.find(c=>c.dates.includes(date));return c?c.key:null;}
function resolveCity(a){if(a.city&&CITYKEYS.includes(a.city))return a.city;return cityByDate(a.activity_date)||CITIES[0].key;}
function snapDateToCity(){const c=CITIES.find(c=>c.key===$('ma-city').value);if(!c)return;if($('ma-date').value&&!c.dates.includes($('ma-date').value))$('ma-date').value=c.dates[0];}
function pad(n){return n<10?'0'+n:''+n;}
function dateRange(s,e){const out=[];if(!s)return out;const a=new Date(s+'T00:00:00'),b=new Date((e||s)+'T00:00:00');for(let d=new Date(a);d<=b;d.setDate(d.getDate()+1))out.push(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));return out;}
function fmtRange(s,e){if(!s)return '';const sd=+s.slice(8,10),sm=+s.slice(5,7)-1;if(!e||e===s)return sd+' '+MES[sm]+' · parada';const ed=+e.slice(8,10),em=+e.slice(5,7)-1;const nights=Math.max(1,Math.round((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000));return sd+(sm!==em?' '+MES[sm]:'')+'–'+ed+' '+MES[em]+' · '+nights+'N';}
const DAYTRIPS=['Versalles','Saint-Émilion','Toledo'];
function rebuildCities(){
  CITIES=(DATA.trip_cities||[]).map(tc=>({key:tc.name,name:tc.name,flag:tc.country_flag||'📍',img:tc.photo_url||'',custom:true,id:tc.id,start_date:tc.start_date,end_date:tc.end_date,notes:tc.notes,dates:dateRange(tc.start_date,tc.end_date),range:fmtRange(tc.start_date,tc.end_date)}))
    .sort((a,b)=>((a.dates[0]||'9')<(b.dates[0]||'9'))?-1:((a.dates[0]||'9')>(b.dates[0]||'9')?1:0));
  CITYKEYS=CITIES.map(c=>c.key);
  const opts='<option value="">—</option>'+CITIES.map(c=>'<option value="'+esc(c.key)+'">'+esc(c.flag)+' '+esc(c.name)+'</option>').join('');
  ['me-city','mr-city','ml-city'].forEach(function(id){const s=$(id);if(s){const v=s.value;s.innerHTML=opts;s.value=v;}});
  const sel=$('ma-city');if(sel){const v=sel.value;sel.innerHTML=opts+DAYTRIPS.map(d=>'<option value="'+d+'">🚏 '+d+'</option>').join('');sel.value=v;}
}
function openCity(c){$('mc-id').value=c.id||'';$('mc-name').value=c.name||'';$('mc-flag').value=c.country_flag||c.flag||'📍';$('mc-start').value=c.start_date||'';$('mc-end').value=c.end_date||'';$('mc-photo').value=c.photo_url||c.img||'';$('mc-notes').value=c.notes||'';$('m-city').classList.add('open');}
function openCity2(id){const c=(DATA.trip_cities||[]).find(x=>x.id===id);if(c)openCity(c);}
async function saveCity(){const id=$('mc-id').value,n=$('mc-name').value.trim(),st=$('mc-start').value;if(!n||!st){alert('Nombre y fecha de inicio requeridos');return;}const row={name:n,country_flag:$('mc-flag').value||'📍',start_date:st,end_date:$('mc-end').value||st,photo_url:$('mc-photo').value||null,notes:$('mc-notes').value||null};if(id)await write({action:'update',table:'trip_cities',id:id,patch:row},'Ciudad guardada ✓');else{row.created_by='manual';await write({action:'insert',table:'trip_cities',row:row},'Ciudad agregada ✓');}closeM('m-city');}
async function delCity(id){if(confirm('¿Quitar esta parada? Las actividades quedan guardadas.'))await write({action:'delete',table:'trip_cities',id:id},'Quitada');}
let toastT;
function showToast(msg,err){const t=$('toast');if(!t)return;t.textContent=msg;t.className='toast show'+(err?' err':'');clearTimeout(toastT);toastT=setTimeout(()=>{t.className='toast'+(err?' err':'');},1900);}
function tripInfo(){if(!TRIP||!TRIP.start_date)return (TRIP&&TRIP.name)?('✦ '+TRIP.name):'Tu viaje';
  const start=new Date(tripStart()+'T00:00:00'),end=new Date(tripEnd()+'T23:59:59'),now=new Date();
  if(now<start)return 'Faltan '+Math.ceil((start-now)/86400000)+' días para el viaje 🧳';
  if(now>end)return '¡Viaje terminado! 🏠';
  return 'Día '+(Math.floor((now-start)/86400000)+1)+' del viaje ✈️';}
function todayISO(){if(!TRIP||!TRIP.start_date)return null;const n=new Date(),start=new Date(tripStart()+'T00:00:00'),end=new Date(tripEnd()+'T23:59:59');if(n<start||n>end)return null;const z=new Date(n.getTime()-n.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);}
function defaultOpenKey(){const t=todayISO();if(t){const c=CITIES.find(c=>c.dates.includes(t));if(c)return c.key;}return CITIES[0]?CITIES[0].key:'';}
function openKeys(){const st=localStorage.getItem('eurotrip_open');if(st){try{return new Set(JSON.parse(st));}catch(e){}}return new Set([defaultOpenKey()]);}
function toggleCity(ci){const el=$('city-'+ci);el.classList.toggle('open');const set=openKeys();const k=CITIES[ci].key;if(el.classList.contains('open'))set.add(k);else set.delete(k);localStorage.setItem('eurotrip_open',JSON.stringify([...set]));}

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
  try{
    const tid=activeTripId();
    const r=await fetch('/api/data'+(tid?'?trip='+encodeURIComponent(tid):''),{cache:'no-store'});const j=await r.json();
    DATA=j.data||{};TRIPS=j.trips||[];TRIP=j.trip||null;
    if(TRIP)localStorage.setItem('bayu_trip_id',TRIP.id);
    applyTripChrome();rebuildCities();renderPlanner();renderGastos();
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
  const started=new Date()>=new Date('2026-10-16T00:00:00');
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
    if(c.custom)html+='<div style="display:flex;gap:.4rem;margin-bottom:.6rem"><button class="chip" onclick="openCity2(\''+c.id+'\')">✏️ Editar parada</button><button class="chip" onclick="delCity(\''+c.id+'\')">🗑️ Quitar</button></div>';
    html+='<div class="hotel-line" style="cursor:pointer" onclick="openHotel(\''+esc(c.key)+'\')">🏨 '+(hotel?esc(hotel.hotel_name)+(hotel.confirmed?' · ✅':' · ⏳ por definir')+(hotel.zone?' · '+esc(hotel.zone):''):'Definir hotel')+' · ✏️</div>';
    const _extra=[...new Set(cityActs.map(a=>a.activity_date))].filter(d=>!c.dates.includes(d));
    [...c.dates,..._extra].sort().forEach(d=>{
      const da=cityActs.filter(a=>a.activity_date===d).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||((a.start_time||'')>(b.start_time||'')?1:-1));
      const isToday=(d===today);
      html+='<div class="day'+(isToday?' today':'')+'"><div class="day-h"><span class="day-h-date">'+dn(d)+'</span>'+(isToday?'<span class="hoy-badge">HOY</span>':'')+'<span class="wx" data-wx="'+d+'|'+esc(c.key)+'"></span></div>'+resHtml(d);
      da.forEach((a,idx)=>{
        const done=a.status==='hecho';
        const up=idx>0?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',-1)">▲</button>':'';
        const dw=idx<da.length-1?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',1)">▼</button>':'';
        html+='<div class="act'+(done?' done':'')+'"><button class="chk" onclick="togAct(\''+a.id+'\','+done+')">'+(done?'✓':'')+'</button>';
        html+='<div class="a-body" onclick="toggleDetail(\''+a.id+'\')"><div class="a-title">'+(a.start_time?'<span class="a-time">'+esc(a.start_time.slice(0,5))+'</span>':'')+esc(a.title)+(a.is_suggestion?'<span class="sug">sugerida</span>':'')+' <span style="opacity:.4;font-size:.7rem">▾</span></div>';
        const m=[];if(a.category)m.push((CAT[a.category]||'•')+' '+esc(a.category));
        if(m.length)html+='<div class="a-meta">'+m.join(' · ')+'</div>';
        html+='</div><div class="a-act">'+up+dw+'<button onclick="editAct(\''+a.id+'\')">✏️</button><button onclick="delAct(\''+a.id+'\')">🗑️</button></div></div>'+detailHtml(a);
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
const WX_COORDS={'Paris':[48.857,2.352],'París':[48.857,2.352],'Bordeaux':[44.838,-0.579],'Burdeos':[44.838,-0.579],'San Sebastián':[43.318,-1.981],'Bilbao':[43.263,-2.935],'Madrid':[40.417,-3.703],'Versalles':[48.801,2.130],'Saint-Émilion':[44.893,-0.156],'Toledo':[39.862,-4.027],'Valencia':[39.470,-0.376],'Barcelona':[41.385,2.173],'Lisboa':[38.722,-9.139],'Lisbon':[38.722,-9.139]};
const WX_OCT={'Paris':[16,9,2],'París':[16,9,2],'Bordeaux':[19,10,2],'Burdeos':[19,10,2],'San Sebastián':[20,13,61],'Bilbao':[20,12,61],'Madrid':[20,10,1],'Versalles':[16,8,2],'Saint-Émilion':[19,10,2],'Toledo':[20,9,1],'Valencia':[24,15,1],'Barcelona':[22,15,1],'Lisboa':[22,15,1],'Lisbon':[22,15,1]};
function wxIcon(c){c=+c;if(c===0)return'☀️';if(c<=2)return'🌤️';if(c===3)return'☁️';if(c<=48)return'🌫️';if(c<=57)return'🌦️';if(c<=67)return'🌧️';if(c<=77)return'🌨️';if(c<=82)return'🌧️';if(c<=86)return'🌨️';return'⛈️';}
function wxCache(k){try{const v=JSON.parse(localStorage.getItem('bayu_wx_'+k));if(v&&Date.now()-v.ts<6*3600e3)return v.d;}catch(e){}return null;}
function wxStore(k,d){try{localStorage.setItem('bayu_wx_'+k,JSON.stringify({ts:Date.now(),d:d}));}catch(e){}}
function wxFallback(city,date){const n=WX_OCT[city];if(!n||(+date.slice(5,7))!==10)return null;return {hi:n[0],lo:n[1],code:n[2],live:false};}
async function fetchWx(city,date){
  const key=city+'|'+date,cached=wxCache(key);if(cached)return cached;
  const co=WX_COORDS[city],days=Math.round((new Date(date+'T12:00:00')-new Date())/86400000);
  if(co&&days>=0&&days<=15){
    try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+co[0]+'&longitude='+co[1]+'&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date='+date+'&end_date='+date);
      const j=await r.json(),dd=j.daily;
      if(dd&&dd.time&&dd.time.length){const d={hi:Math.round(dd.temperature_2m_max[0]),lo:Math.round(dd.temperature_2m_min[0]),code:dd.weather_code[0],live:true};wxStore(key,d);return d;}
    }catch(e){}
  }
  return wxFallback(city,date);
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
    h+='<div class="act"><span style="flex:0 0 auto;font-size:1.05rem;margin-top:.1rem">💡</span><div class="a-body"><div class="a-title">'+esc(a.title)+'</div>'+(m.length?'<div class="a-meta">'+m.join(' · ')+'</div>':'')+'</div><div class="a-act"><button onclick="editAct(\''+a.id+'\')" title="Ponerle día">📅</button><button onclick="delAct(\''+a.id+'\')">🗑️</button></div></div>';});
  h+='<button class="addbtn" style="margin-top:.5rem" onclick="openAct({})">+ Cosa por hacer (sin fecha)</button></div>';
  return h;
}
function suggRow(key,name){
  const sg=SUGG[key]||[]; if(!sg.length)return '';
  let h='<div class="sugg-wrap"><div class="sugg-h">✨ Sugerencias para '+esc(name)+'</div><div class="sugg-row">';
  sg.forEach((x,xi)=>{h+='<div class="sugg"><img src="'+x.img+'" alt="" onerror="this.style.display=\'none\'" onclick="openSug(\''+esc(key)+'\','+xi+')"/><div class="si"><div class="st">'+esc(x.t)+'</div><div class="sr">⭐ '+x.r+' · '+x.rev+' reseñas</div><div class="sp">desde '+x.p+'</div><button class="sadd" onclick="addSug(\''+esc(key)+'\','+xi+')">+ Agregar</button></div></div>';});
  return h+'</div></div>';
}
function firstDay(key){const c=CITIES.find(c=>c.key===key);return c?c.dates[0]:tripStart();}
function addSug(key,i){const x=(SUGG[key]||[])[i];if(!x)return;go('planner');openAct({title:x.t,category:x.cat,city:key});}
function openSug(key,i){const x=(SUGG[key]||[])[i];if(!x)return;window.open('https://www.getyourguide.com/s/?q='+encodeURIComponent(x.t+' '+key),'_blank');}
function openAct(a){$('ma-title').textContent=a.id?'Editar actividad':'Nueva actividad';$('ma-id').value=a.id||'';$('ma-date').value=a.activity_date||'';$('ma-time').value=a.start_time?a.start_time.slice(0,5):'';$('ma-tit').value=a.title||'';$('ma-cat').value=a.category||'';$('ma-city').value=a.city||'';$('ma-notes').value=a.notes||'';$('ma-link').value=a.link||'';$('ma-map').value=a.map_url||'';$('ma-tickets').value=a.tickets||'';$('m-act').classList.add('open');}
function editAct(id){const a=(DATA.activities||[]).find(x=>x.id===id);if(a)openAct(a);}
async function togAct(id,done){await write({action:'update',table:'activities',id:id,patch:{status:done?'pendiente':'hecho'}},done?'Pendiente':'¡Hecho! ✓');}
async function delAct(id){if(confirm('¿Borrar esta actividad?'))await write({action:'delete',table:'activities',id:id},'Borrado');}
async function moveAct(id,dir){
  const a=(DATA.activities||[]).find(x=>x.id===id);if(!a)return;
  const sib=(DATA.activities||[]).filter(x=>x.activity_date===a.activity_date).sort((x,y)=>(x.sort_order||0)-(y.sort_order||0)||((x.start_time||'')>(y.start_time||'')?1:-1));
  const i=sib.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=sib.length)return;
  const b=sib[j],so1=a.sort_order||0,so2=b.sort_order||0;
  let na=so2,nb=so1; if(so1===so2){na=dir<0?so2-1:so2+1;nb=so2;}
  await writeMany([{id:a.id,patch:{sort_order:na}},{id:b.id,patch:{sort_order:nb}}],'Reordenado');
}
async function saveAct(){const id=$('ma-id').value,tit=$('ma-tit').value.trim();if(!tit){alert('Escribe la actividad');return;}
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
  html+='<div class="split"><div><div class="who">👤 David</div><div class="amt2">'+money(byP('David'))+'</div></div><div><div class="who">👤 Paty</div><div class="amt2">'+money(byP('Paty'))+'</div></div><div><div class="who">🤝 Juntos</div><div class="amt2">'+money(byP('Joint'))+'</div></div></div></div>';
  html+='<div class="bcard">';
  budget.forEach(b=>{const sp=exp.filter(e=>e.category===b.category).reduce((s,e)=>s+Number(e.amount_mxn||0),0);const mx=Number(b.projected_max_mxn||0),p=mx?Math.min(100,sp/mx*100):0;
    html+='<div class="catrow" style="cursor:pointer" onclick="openBudget(\''+b.category+'\')"><div class="top"><span>'+(b.emoji||'')+' '+esc(b.label)+'</span><span>'+money(sp)+' <span class="sub">/ '+money(mx)+'</span></span></div><div class="bar"><i style="width:'+p+'%;background:'+(p>=100?'var(--red)':'var(--green)')+'"></i></div></div>';});
  html+='</div>';
  html+='<div class="chips"><div class="chip'+(gCity===''?' on':'')+'" onclick="setFilter(\'city\',\'\')">Todas</div>'+CITIES.map(c=>'<div class="chip'+(gCity===c.key?' on':'')+'" onclick="setFilter(\'city\',\''+esc(c.key)+'\')">'+c.flag+' '+esc(c.name)+'</div>').join('')+'</div>';
  html+='<div class="chips">'+['','David','Paty','Joint'].map(p=>'<div class="chip'+(gPayer===p?' on':'')+'" onclick="setFilter(\'payer\',\''+p+'\')">'+(p===''?'Todos':(p==='Joint'?'🤝 Juntos':'👤 '+p))+'</div>').join('')+'</div>';
  let list=exp.slice();if(gCity)list=list.filter(e=>e.city===gCity);if(gPayer)list=list.filter(e=>e.payer===gPayer);
  html+='<div class="bcard"><div class="lbl" style="margin-bottom:.3rem">Gastos'+(list.length?' ('+list.length+')':'')+'</div>';
  if(!list.length)html+=(gCity||gPayer)?emptyState('🔍','Sin gastos con ese filtro','Prueba quitar el filtro de ciudad o pagador.'):emptyState('💸','Aún no hay gastos','Registra tu primer gasto y mira cómo va tu presupuesto en vivo.','<button class="eb" onclick="openExp({})">+ Agregar gasto</button>');
  list.slice(0,60).forEach(e=>{const orig=(e.currency&&e.currency!=='MXN'&&e.amount_original)?' ('+(e.currency==='EUR'?'€':'$')+e.amount_original+')':'';
    html+='<div class="exp"><div><div class="d">'+esc(e.description)+'</div><div class="m">'+(e.expense_date||'')+(e.city?' · '+esc(e.city):'')+(e.payer?' · '+esc(e.payer):'')+'</div></div><div style="display:flex;align-items:center;gap:.3rem">'+(e.receipt_url?'<a href="'+esc(e.receipt_url)+'" target="_blank" class="x">📎</a>':'')+'<span class="amt">'+money(e.amount_mxn)+orig+'</span><button class="x" onclick="editExpById(\''+e.id+'\')">✏️</button><button class="x" onclick="delExp(\''+e.id+'\')">🗑️</button></div></div>';});
  html+='</div>';
  $('gastos-root').innerHTML=html;
  $('me-cat').innerHTML=budget.map(b=>'<option value="'+b.category+'">'+(b.emoji||'')+' '+esc(b.label)+'</option>').join('');
}
function editExpById(id){const e=(DATA.expenses||[]).find(x=>x.id===id);if(e)openExp(e);}
function fxCalc(){const cur=$('me-cur').value,orig=parseFloat($('me-orig').value)||0;
  if(cur==='MXN'){$('me-fxrow').style.display='none';$('me-mxn').value=orig||'';$('me-fxhint').textContent='';return;}
  $('me-fxrow').style.display='flex';let fx=parseFloat($('me-fx').value);if(!fx){fx=cur==='EUR'?22:18;$('me-fx').value=fx;}
  const mxn=Math.round(orig*fx);$('me-mxn').value=mxn||'';$('me-fxhint').textContent=orig?(cur==='EUR'?'€':'$')+orig+' × '+fx+' = '+money(mxn)+' MXN':'';}
function openExp(e){$('me-title').textContent=e.id?'Editar gasto':'Nuevo gasto';$('me-id').value=e.id||'';$('me-desc').value=e.description||'';$('me-cur').value=e.currency||'MXN';$('me-orig').value=(e.currency&&e.currency!=='MXN')?(e.amount_original||''):(e.amount_mxn||'');$('me-fx').value=e.fx_rate||'';$('me-mxn').value=e.amount_mxn||'';$('me-cat').value=e.category||(DATA.budget&&DATA.budget[0]&&DATA.budget[0].category)||'';$('me-payer').value=e.payer||'Joint';$('me-city').value=e.city||'';$('me-notes').value=e.notes||'';pendingReceipt=null;$('me-photo').value='';$('me-preview').innerHTML=e.receipt_url?'<a href="'+e.receipt_url+'" target="_blank"><img src="'+e.receipt_url+'" style="max-height:90px;border-radius:8px"/></a>':'';fxCalc();$('m-exp').classList.add('open');}
async function delExp(id){if(confirm('¿Borrar este gasto?'))await write({action:'delete',table:'expenses',id:id},'Borrado');}
async function saveExp(){const id=$('me-id').value,desc=$('me-desc').value.trim(),cur=$('me-cur').value,mxn=parseFloat($('me-mxn').value);
  if(!desc){alert('Escribe la descripción');return;}if(isNaN(mxn)){alert('Monto inválido');return;}
  const row={description:desc,amount_mxn:mxn,currency:cur,category:$('me-cat').value,payer:$('me-payer').value,city:$('me-city').value||null,notes:$('me-notes').value||null};
  if(cur!=='MXN'){row.amount_original=parseFloat($('me-orig').value)||null;row.fx_rate=parseFloat($('me-fx').value)||null;}
  if(pendingReceipt){showToast('Subiendo foto…');const u=await uploadReceipt(pendingReceipt);if(u)row.receipt_url=u;}
  if(id)await write({action:'update',table:'expenses',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'expenses',row:row},'Gasto agregado ✓');}
  closeM('m-exp');}

/* ---------- EXPLORE ---------- */
const TIPS=[['🛂','Schengen / ETIAS','Sin visa para mexicanos (<90 días). ETIAS podría arrancar en 2026. Pasaporte con 6+ meses de vigencia.'],['📶','eSIM','Holafly o Airalo, ~€80 datos ilimitados Europa. Actívala al aterrizar en CDG.'],['🧳','Equipaje','3 maletas total entre los dos. Cambias de hotel cada 2-4 noches — viaja ligero.'],['🔌','Enchufe','Europa tipo C/E (clavijas redondas, 230V). Lleva 1-2 adaptadores.'],['💶','Tax-free','Compras grandes: factura tax-free (DIVA) sellada en Barajas antes de volar el 31.'],['🍢','Pintxos','De pie, de barra en barra. Pide 1-2 + txakoli. Bar Néstor: apúntate 30 min antes.'],['🎨','Guggenheim','Entrada online con horario (€16). Mejor foto desde el puente de La Salve.'],['🍷','Saint-Émilion','Octubre = post-vendimia. Tour medio día con cata. Suéter + zapatos cerrados.'],['🌧️','Clima Oct','París 12-18° · Bordeaux 10-19° · País Vasco 12-20° (lluvioso) · Madrid 10-19°.'],['✈️','Vuelos','Ida AM44 MTY 15 Oct→CDG 16 (29A/B). Regreso AM35 MAD 31 Oct 10:30am→MTY (34H/J).']];
const TIPS_GENERIC=[['🛂','Documentos','Revisa visa/permisos de tu destino y que el pasaporte tenga 6+ meses de vigencia.'],['📶','Conectividad','Una eSIM (Holafly/Airalo) te deja con datos apenas aterrizas.'],['🔌','Enchufes','Checa el tipo de clavija y voltaje del país y lleva adaptador.'],['🧳','Equipaje','Viaja ligero si cambias de hotel seguido. Revisa límites de tu aerolínea.'],['💳','Dinero','Avisa a tu banco, lleva algo de efectivo local y una tarjeta sin comisión.'],['🤖','Pregúntale a Claudia','Pídele tips, clima, números de emergencia o ideas específicas de tu destino.']];
function renderExplore(){const euro=isEurotrip();
  let h='<button class="pf-btn" onclick="openTrans()">🌐 Traductor</button>'+docsHtml()+albumHtml()+exploreTop();
  const tips=euro?TIPS:TIPS_GENERIC;
  h+='<div class="sec-h">💡 Tips '+(euro?'del viaje':'de viaje')+'</div>'+tips.map(t=>'<div class="tip"><h3>'+t[0]+' '+t[1]+'</h3><p>'+t[2]+'</p></div>').join('');
  const citiesWithSugg=CITIES.filter(c=>(SUGG[c.key]||[]).length);
  if(citiesWithSugg.length){h+='<div class="sec-h">🎟️ Ideas para hacer</div>';citiesWithSugg.forEach(c=>{h+='<div style="font-weight:800;font-size:.86rem;margin:.6rem 0 .2rem">'+c.flag+' '+esc(c.name)+'</div>'+suggRow(c.key,c.name);});}
  h+=packingHtml()+emergencyHtml();
  if(euro)h+='<a class="pf-btn" href="/guia" style="margin-top:1.2rem">📖 Abrir la guía completa por ciudad →</a>';
  $('explore-root').innerHTML=h;}
function openTrans(){$('tr-in').value='';$('tr-out').textContent='';$('m-trans').classList.add('open');}
async function doTranslate(){const t=$('tr-in').value.trim();if(!t)return;$('tr-out').textContent='Traduciendo…';try{const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t,target:$('tr-lang').value})});const j=await r.json();$('tr-out').textContent=j.translation||j.error||'(sin resultado)';}catch(e){$('tr-out').textContent='Error: '+e.message;}}
const PACK_DEFAULT=['Pasaporte','Visa/ETIAS (si aplica)','Adaptador EU tipo C/E','Cargadores + power bank','eSIM activada','Tarjetas + efectivo €','Medicinas personales','Ropa de otoño (capas)','Paraguas/impermeable','Zapatos cómodos','Copia de reservas','Cámara'];
function packGet(){try{const v=localStorage.getItem('eurotrip_pack');if(v)return JSON.parse(v);}catch(e){}const init=PACK_DEFAULT.map(t=>({t:t,c:false}));localStorage.setItem('eurotrip_pack',JSON.stringify(init));return init;}
function packSet(p){localStorage.setItem('eurotrip_pack',JSON.stringify(p));}
function packingHtml(){const p=packGet(),done=p.filter(x=>x.c).length;let h='<div class="sec-h">🧳 Empaque ('+done+'/'+p.length+')</div><div class="bcard">';
  p.forEach((x,i)=>{h+='<div class="act"><button class="chk" onclick="packTog('+i+')" style="'+(x.c?'background:var(--green);border-color:var(--green);color:#fff':'')+'">'+(x.c?'✓':'')+'</button><div class="a-body"><div class="a-title" style="'+(x.c?'text-decoration:line-through;opacity:.5':'')+'">'+esc(x.t)+'</div></div><button class="x" onclick="packDel('+i+')">🗑️</button></div>';});
  return h+'<button class="addbtn" onclick="packAdd()">+ Agregar al empaque</button></div>';}
function packTog(i){const p=packGet();p[i].c=!p[i].c;packSet(p);renderExplore();}
function packDel(i){const p=packGet();p.splice(i,1);packSet(p);renderExplore();}
function packAdd(){const t=prompt('¿Qué agregas al empaque?');if(t){const p=packGet();p.push({t:t,c:false});packSet(p);renderExplore();showToast('Agregado al empaque');}}
let currentAlbumCity='';
function docPick(){$('doc-file').click();}
function docUpload(input){const f=input.files[0];if(f)uploadAndSave(f,'document','');input.value='';}
function albumPick(city){currentAlbumCity=city;$('album-file').click();}
function albumUpload(input){const f=input.files[0];if(f)uploadAndSave(f,(f.type||'').startsWith('video')?'video':'photo',currentAlbumCity);input.value='';}
function fileToB64Raw(file,cb){const rd=new FileReader();rd.onload=e=>cb(e.target.result.split(',')[1]);rd.readAsDataURL(file);}
async function uploadAndSave(file,kind,city){const isImg=(file.type||'').startsWith('image/');if(!isImg&&file.size>4*1024*1024){showToast('Máx ~4MB por ahora (videos largos: próximamente)',true);return;}const ext=(file.name.split('.').pop()||'bin').toLowerCase();showToast('Subiendo…');const k=wkey();if(!k)return;const proceed=async(b64,ct,ex)=>{try{const up=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify({content_b64:b64,contentType:ct,ext:ex})});const uj=await up.json();if(!uj.ok){showToast(uj.error||'Error al subir',true);return;}await write({action:'insert',table:'media',row:{kind:kind,title:file.name,url:uj.url,city:city||null,mime:file.type,created_by:'manual'}},kind==='document'?'Documento guardado ✓':'Subido ✓');}catch(e){showToast('Error de red',true);}};if(isImg)fileToB64Resized(file,1600,b64=>proceed(b64,'image/jpeg','jpg'));else fileToB64Raw(file,b64=>proceed(b64,file.type||'application/octet-stream',ext));}
function docsHtml(){const docs=(DATA.media||[]).filter(m=>m.kind==='document');let h='<div class="sec-h">📄 Documentos <button class="chip" style="float:right" onclick="docPick()">+ Subir</button></div><div class="bcard">';if(!docs.length)h+=emptyState('📄','Sin documentos','Pasaporte, pases de abordar, vouchers, seguro… súbelos para tenerlos offline.','<button class="eb" onclick="docPick()">+ Subir documento</button>');docs.forEach(m=>{h+='<div class="doc-row"><a href="'+esc(m.url)+'" target="_blank">📎 '+esc(m.title||'documento')+'</a><button class="x" onclick="delMedia(\''+m.id+'\')">🗑️</button></div>';});return h+'</div>';}
function albumHtml(){const photos=(DATA.media||[]).filter(m=>m.kind==='photo'||m.kind==='video');let h='<div class="sec-h">📸 Álbum por ciudad</div>';CITIES.forEach(c=>{const ph=photos.filter(m=>m.city===c.key);h+='<div class="bcard"><div style="display:flex;justify-content:space-between;align-items:center"><strong>'+c.flag+' '+esc(c.name)+(ph.length?' · '+ph.length:'')+'</strong><button class="chip" onclick="albumPick(\''+esc(c.key)+'\')">+ Foto/Video</button></div>';if(ph.length)h+='<div class="media-grid">'+ph.map(m=>'<div class="media-item">'+(m.kind==='video'?'<video src="'+esc(m.url)+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px" onclick="window.open(\''+esc(m.url)+'\')"></video>':'<img src="'+esc(m.url)+'" onclick="window.open(\''+esc(m.url)+'\')"/>')+'<button class="del" onclick="delMedia(\''+m.id+'\')">×</button></div>').join('')+'</div>';h+='</div>';});return h;}
async function delMedia(id){if(confirm('¿Borrar este archivo?'))await write({action:'delete',table:'media',id:id},'Borrado');}
function emergencyHtml(){
  if(!isEurotrip())return '<div class="sec-h">🆘 Emergencia</div><div class="bcard">'
    +'<div class="pf-row"><span>🚨 Emergencia general (UE y varios países)</span><a href="tel:112" style="color:var(--red);font-weight:800">112</a></div>'
    +'<div class="pf-row" style="color:var(--muted);font-size:.82rem">📌 Pídele a Claudia los números locales de emergencia, embajada de México y qué hacer si pierdes tarjetas en tu destino.</div>'
    +'</div>';
  return '<div class="sec-h">🆘 Emergencia</div><div class="bcard">'
  +'<div class="pf-row"><span>🚨 Emergencias (toda la UE)</span><a href="tel:112" style="color:var(--red);font-weight:800">112</a></div>'
  +'<div class="pf-row"><span>🇫🇷 Francia · SAMU médico</span><a href="tel:15" style="color:var(--red);font-weight:800">15</a></div>'
  +'<div class="pf-row"><span>🇫🇷 Francia · Policía</span><a href="tel:17" style="color:var(--red);font-weight:800">17</a></div>'
  +'<div class="pf-row"><span>🇪🇸 España · Policía Nacional</span><a href="tel:091" style="color:var(--red);font-weight:800">091</a></div>'
  +'<div class="pf-row" style="color:var(--muted);font-size:.82rem">📌 Para tel. de embajada de México y cancelar tarjetas, pídeselo a Claudia (busca el actual) o guárdalos en una nota.</div>'
  +'</div>';}

/* ---------- PERFIL ---------- */
function renderPerfil(){const hotels=DATA.hotel_choices||[];
  const nm=(TRIP&&TRIP.name)||'Tu viaje',sub=(TRIP&&TRIP.subtitle)?' · '+TRIP.subtitle:'',dd=(TRIP&&TRIP.start_date)?heroDates():'Sin fechas aún';
  let h='<div class="bcard"><div class="lbl">El viaje</div><div style="font-size:1.2rem;font-weight:800;margin:.2rem 0">'+esc(nm+sub)+'</div><div style="color:var(--muted);font-size:.88rem">'+esc(dd)+'</div><button class="chip" style="margin-top:.6rem" onclick="go(\'viajes\')">✈️ Cambiar de viaje</button></div>';
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.2rem">Hoteles</div>';
  CITIES.forEach(c=>{const ho=hotels.find(x=>x.city===c.key);h+='<div class="pf-row"><span>'+c.flag+' '+esc(c.name)+'</span><span style="color:var(--muted)">'+(ho?(ho.confirmed?'✅ '+esc(ho.hotel_name):'⏳ por definir'):'—')+'</span></div>';});
  h+='</div>';
  const _pq=queueGet().length;if(_pq)h+='<div class="bcard" style="background:#FFF3B0;color:#7a6a00;font-weight:700">⏳ '+_pq+' cambios pendientes <button class="chip" onclick="flushQueue()">Sincronizar</button></div>';
  const _tm=localStorage.getItem('bayu_theme')||'auto';
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.4rem">🎨 Tema</div><div class="seg">'+['light','auto','dark'].map(function(x){return '<button class="seg-btn'+(_tm===x?' on':'')+'" onclick="setTheme(\''+x+'\')">'+({light:'☀️ Claro',auto:'🔄 Auto',dark:'🌙 Oscuro'}[x])+'</button>';}).join('')+'</div></div>';
  h+='<button class="pf-btn" onclick="changeKey()">🔑 Cambiar clave de escritura</button><a class="pf-btn" href="/guia">📖 Guía editorial completa</a><button class="pf-btn" onclick="alert(\'Para instalar: Safari → Compartir → Agregar a inicio. Chrome: ⋮ → Instalar app.\')">📲 Cómo instalar la app</button><button class="pf-btn" onclick="load();showToast(\'Actualizado ✓\')">🔄 Recargar datos</button>';
  h+='<div style="text-align:center;color:var(--muted);font-size:.74rem;margin-top:1rem">Bayu PWA v10 ✨ Sunset Editorial · Arkamia Lab</div>';$('perfil-root').innerHTML=h;}
function applyTheme(){var m=localStorage.getItem('bayu_theme')||'auto';var d=m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}
function setTheme(m){localStorage.setItem('bayu_theme',m);applyTheme();renderPerfil();showToast('Tema: '+({light:'Claro',auto:'Auto',dark:'Oscuro'}[m]||m));}
function changeKey(){localStorage.removeItem('eurotrip_write_key');const k=prompt('Nueva clave de escritura:');if(k){localStorage.setItem('eurotrip_write_key',k);showToast('Clave guardada ✓');}}

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
    h+='<button class="tedit" onclick="event.stopPropagation();openTrip2(\''+t.id+'\')">✏️</button></div>';
  });
  h+='<button class="addbtn" style="margin-top:.8rem" onclick="openTrip({})">+ Nuevo viaje</button>';
  $('viajes-root').innerHTML=h;
}
async function switchTrip(id){if(TRIP&&id===TRIP.id){go('planner');return;}localStorage.setItem('bayu_trip_id',id);DATA={};chatStarted=false;chatMsgs=[];var cl=$('chat-log');if(cl)cl.innerHTML='';showToast('Cambiando de viaje…');await load();go('planner');}
function openTrip(t){$('mt-id').value=t.id||'';$('mt-name').value=t.name||'';$('mt-sub').value=t.subtitle||'';$('mt-flag').value=t.flag||'🌍';$('mt-start').value=t.start_date||'';$('mt-end').value=t.end_date||'';$('mt-cover').value=t.cover_image||'';$('mt-status').value=t.status||'planning';$('mt-del').style.display=t.id?'block':'none';$('mt-title').textContent=t.id?'Editar viaje':'Nuevo viaje';$('m-trip').classList.add('open');}
function openTrip2(id){const t=TRIPS.find(x=>x.id===id);if(t)openTrip(t);}
async function saveTrip(){const id=$('mt-id').value,name=$('mt-name').value.trim();if(!name){alert('Ponle nombre al viaje');return;}
  const row={name:name,subtitle:$('mt-sub').value||null,flag:$('mt-flag').value||'🌍',start_date:$('mt-start').value||null,end_date:$('mt-end').value||null,cover_image:$('mt-cover').value||null,status:$('mt-status').value||'planning'};
  if(id){await write({action:'update',table:'trips',id:id,patch:row},'Viaje guardado ✓');closeM('m-trip');return;}
  const k=wkey();if(!k)return;row.created_by='manual';
  try{const r=await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify({action:'insert',table:'trips',row:row})});const j=await r.json();
    if(!j.ok){showToast(j.error||'Error',true);return;}
    if(j.inserted&&j.inserted.id)localStorage.setItem('bayu_trip_id',j.inserted.id);
    closeM('m-trip');showToast('Viaje creado ✓ — agrégale ciudades');await load();go('planner');
  }catch(e){showToast('Sin red',true);}
}
async function delTrip(){const id=$('mt-id').value;if(!id)return;
  if(TRIPS.length<=1){alert('No puedes borrar tu único viaje.');return;}
  if(!confirm('¿Borrar este viaje y TODO su contenido (actividades, gastos, fotos, reservas…)? No se puede deshacer.'))return;
  if(TRIP&&TRIP.id===id)localStorage.removeItem('bayu_trip_id');
  closeM('m-trip');await write({action:'delete',table:'trips',id:id},'Viaje borrado');go('viajes');
}

/* ---------- CLAUDIA ---------- */
let chatMsgs=[];
const CHIPS_EURO=['¿Cuánto llevamos gastado?','Agrega cena €80 en San Sebastián el 23','Mueve Versalles al 18','¿Qué falta por reservar?'];
const CHIPS_GENERIC=['¿Cuánto llevamos gastado?','¿Qué falta por reservar?','Dame ideas para este viaje','Agrega una actividad a un día'];
function startChat(){if(chatStarted)return;chatStarted=true;const chips=isEurotrip()?CHIPS_EURO:CHIPS_GENERIC;$('chat-chips').innerHTML=chips.map(c=>'<div class="chat-chip" onclick="chipSend(this)">'+esc(c)+'</div>').join('');pushBub('assistant','¡Hola! Soy Claudia'+(TRIP&&TRIP.name?' — tu asistente para '+TRIP.name:'')+'. Puedo armar tu plan, registrar gastos y resolver dudas del viaje. Dime qué necesitas o toca una sugerencia 👇');}
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
  try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatMsgs,trip_id:activeTripId()})});const j=await r.json();const reply=j.reply||j.error||'(sin respuesta)';typing.innerHTML=mdToHtml(reply);chatMsgs.push({role:'assistant',content:reply});if(j.tool_events&&j.tool_events.length){load();showToast('Plan actualizado ✓');}}catch(e){typing.textContent='Error: '+e.message;}}

/* ---------- reservas / links (Push C) ---------- */
const RES_ICON={flight:'✈️',hotel:'🏨',restaurant:'🍽️',train:'🚄',tour:'🎟️',transfer:'🚐',activity:'🎫',other:'📋'};
function resHtml(date){const rs=(DATA.reservations||[]).filter(r=>r.date===date);if(!rs.length)return '';
  return rs.map(r=>{const ic=RES_ICON[r.type]||'📋';const meta=[r.time,(r.confirmation_code?'cód '+r.confirmation_code:''),r.cost].filter(Boolean).map(esc).join(' · ');
    return '<div class="resv"><span class="ri">'+ic+'</span><div class="rb"><div class="rt">'+esc(r.title)+'</div><div class="rm">'+meta+(r.link?' · <a href="'+esc(r.link)+'" target="_blank">abrir</a>':'')+'</div></div><button class="rx" onclick="delRes(\''+r.id+'\')">🗑️</button></div>';}).join('');}
function exploreTop(){
  let h='<div class="sec-h">📋 Reservas <button class="chip" style="float:right" onclick="openRes({})">+ Reserva</button></div><div class="bcard">';
  const rs=(DATA.reservations||[]).slice().sort((a,b)=>((a.date||'')+(a.time||''))<((b.date||'')+(b.time||''))?-1:1);
  if(!rs.length)h+=emptyState('🎟️','Sin reservas todavía','Vuelos, hoteles, tours, cenas… guárdalos aquí y aparecen en tu itinerario por día.','<button class="eb" onclick="openRes({})">+ Agregar reserva</button>');
  rs.forEach(r=>{const ic=RES_ICON[r.type]||'📋';const meta=[r.date,r.time,(r.confirmation_code?'cód '+r.confirmation_code:''),r.cost].filter(Boolean).map(esc).join(' · ');
    h+='<div class="resv"><span class="ri">'+ic+'</span><div class="rb"><div class="rt">'+esc(r.title)+'</div><div class="rm">'+meta+(r.link?' · <a href="'+esc(r.link)+'" target="_blank">abrir</a>':'')+'</div></div><button class="rx" onclick="openRes2(\''+r.id+'\')">✏️</button><button class="rx" onclick="delRes(\''+r.id+'\')">🗑️</button></div>';});
  h+='</div>';
  const bm=(DATA.bookmarks||[]);
  h+='<div class="sec-h">🔖 Links <button class="chip" style="float:right" onclick="openLink({})">+ Link</button></div><div class="bcard">';
  if(!bm.length)h+=emptyState('🔖','Sin links guardados','Recetas, reseñas, mapas, artículos… guárdalos para tenerlos a mano.','<button class="eb" onclick="openLink({})">+ Agregar link</button>');
  bm.forEach(b=>{h+='<div class="linkrow"><a href="'+esc(b.url)+'" target="_blank">'+esc(b.title)+'</a><button class="rx" onclick="delBookmark(\''+b.id+'\')">🗑️</button></div>';});
  h+='</div>';
  return h;
}
function openRes(r){$('mr-id').value=r.id||'';$('mr-type').value=r.type||'hotel';$('mr-title').value=r.title||'';$('mr-date').value=r.date||'';$('mr-time').value=r.time||'';$('mr-code').value=r.confirmation_code||'';$('mr-link').value=r.link||'';$('mr-city').value=r.city||'';$('mr-cost').value=r.cost||'';$('mr-notes').value=r.notes||'';$('m-res').classList.add('open');}
function openRes2(id){const r=(DATA.reservations||[]).find(x=>x.id===id);if(r)openRes(r);}
async function saveRes(){const id=$('mr-id').value,t=$('mr-title').value.trim();if(!t){alert('Título requerido');return;}
  const row={type:$('mr-type').value,title:t,date:$('mr-date').value||null,time:$('mr-time').value||null,confirmation_code:$('mr-code').value||null,link:$('mr-link').value||null,city:$('mr-city').value||null,cost:$('mr-cost').value||null,notes:$('mr-notes').value||null};
  if(id)await write({action:'update',table:'reservations',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'reservations',row:row},'Reserva agregada ✓');}closeM('m-res');}
async function delRes(id){if(confirm('¿Borrar esta reserva?'))await write({action:'delete',table:'reservations',id:id},'Borrado');}
function openLink(b){$('ml-id').value=b.id||'';$('ml-title').value=b.title||'';$('ml-url').value=b.url||'';$('ml-city').value=b.city||'';$('m-link').classList.add('open');}
async function saveLink(){const id=$('ml-id').value,t=$('ml-title').value.trim(),u=$('ml-url').value.trim();if(!t||!u){alert('Título y URL requeridos');return;}
  const row={title:t,url:u,city:$('ml-city').value||null};
  if(id)await write({action:'update',table:'bookmarks',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'bookmarks',row:row},'Link guardado ✓');}closeM('m-link');}
async function delBookmark(id){if(confirm('¿Borrar este link?'))await write({action:'delete',table:'bookmarks',id:id},'Borrado');}

/* ---------- hoteles / budget / mapa (Push B) ---------- */
function openHotel(city){const h=(DATA.hotel_choices||[]).find(x=>x.city===city)||{};$('mh-title').textContent='Hotel · '+city;$('mh-city').value=city;$('mh-name').value=(h.hotel_name&&h.hotel_name!=='Por definir')?h.hotel_name:'';$('mh-zone').value=h.zone||'';$('mh-price').value=h.price_per_night||'';$('mh-conf').value=h.confirmed?'true':'false';$('mh-url').value=h.booking_url||'';$('mh-notes').value=h.notes||'';$('m-hotel').classList.add('open');}
async function saveHotel(){const city=$('mh-city').value,name=$('mh-name').value.trim();if(!name){alert('Escribe el hotel');return;}
  const row={city:city,hotel_name:name,zone:$('mh-zone').value||null,price_per_night:$('mh-price').value||null,confirmed:$('mh-conf').value==='true',booking_url:$('mh-url').value||null,notes:$('mh-notes').value||null};
  await write({action:'upsert',table:'hotel_choices',row:row},'Hotel guardado ✓');closeM('m-hotel');}
function openBudget(cat){const b=(DATA.budget||[]).find(x=>x.category===cat);if(!b)return;$('mb-cat').value=cat;$('mb-label').value=(b.emoji||'')+' '+b.label;$('mb-min').value=b.projected_min_mxn||0;$('mb-max').value=b.projected_max_mxn||0;$('m-budget').classList.add('open');}
async function saveBudget(){const cat=$('mb-cat').value,mn=parseFloat($('mb-min').value),mx=parseFloat($('mb-max').value);if(isNaN(mn)||isNaN(mx)||mx<mn){alert('Montos inválidos (máx ≥ mín)');return;}await write({action:'update',table:'budget',id:cat,patch:{projected_min_mxn:mn,projected_max_mxn:mx}},'Presupuesto actualizado ✓');closeM('m-budget');}
function mapDay(date){const acts=(DATA.activities||[]).filter(a=>a.activity_date===date&&a.category!=='logistica');if(!acts.length){showToast('Sin lugares ese día');return;}
  const pts=acts.map(a=>encodeURIComponent(a.title+(a.city?', '+a.city:'')));let url;
  if(pts.length===1)url='https://www.google.com/maps/search/?api=1&query='+pts[0];
  else url='https://www.google.com/maps/dir/?api=1&destination='+pts[pts.length-1]+'&waypoints='+pts.slice(0,-1).join('%7C');
  window.open(url,'_blank');}

/* ---------- shared ---------- */
function closeM(id){$(id).classList.remove('open');}
async function write(body,okMsg){const k=wkey();if(!k)return;
  if(body.table!=='trips'&&!body.trip_id)body.trip_id=activeTripId();
  try{const r=await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify(body)});const j=await r.json();
    if(!j.ok){showToast(j.error||'Error',true);if(/clave/i.test(j.error||''))localStorage.removeItem('eurotrip_write_key');return;}
    await load();showToast(okMsg||'Listo ✓');}catch(e){queuePush(body);showToast('Sin red: guardado, sincroniza al reconectar ⏳');}}
async function writeMany(items,okMsg){const k=wkey();if(!k)return;const tid=activeTripId();
  try{for(const it of items){await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify({action:'update',table:'activities',id:it.id,patch:it.patch,trip_id:tid})});}await load();showToast(okMsg||'Listo ✓');}catch(e){items.forEach(it=>queuePush({action:'update',table:'activities',id:it.id,patch:it.patch,trip_id:tid}));showToast('Sin red ⏳');}}

/* offline queue + recibos (Push D) */
function queueGet(){try{return JSON.parse(localStorage.getItem('eurotrip_queue')||'[]');}catch(e){return [];}}
function queuePush(b){const q=queueGet();q.push(b);localStorage.setItem('eurotrip_queue',JSON.stringify(q));}
async function flushQueue(){let q=queueGet();if(!q.length)return;const k=localStorage.getItem('eurotrip_write_key');if(!k)return;const left=[];for(const b of q){try{const r=await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify(b)});const j=await r.json();if(!j.ok)left.push(b);}catch(e){left.push(b);}}localStorage.setItem('eurotrip_queue',JSON.stringify(left));if(left.length<q.length){await load();showToast('Sincronizado ✓');}}
window.addEventListener('online',flushQueue);
function fileToB64Resized(file,max,cb){const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;if(w>h&&w>max){h=Math.round(h*max/w);w=max;}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',0.82).split(',')[1]);};img.src=e.target.result;};rd.readAsDataURL(file);}
function pickReceipt(input){const f=input.files&&input.files[0];if(!f)return;fileToB64Resized(f,1200,b64=>{pendingReceipt=b64;document.getElementById('me-preview').innerHTML='<img src="data:image/jpeg;base64,'+b64+'" style="max-height:90px;border-radius:8px"/>';showToast('Foto lista, guarda el gasto');});}
async function uploadReceipt(b64){const k=wkey();if(!k)return null;try{const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify({content_b64:b64,contentType:'image/jpeg',ext:'jpg'})});const j=await r.json();return j.ok?j.url:null;}catch(e){showToast('No se pudo subir la foto',true);return null;}}

/* pull-to-refresh */
let ptrY=0,ptrOn=false;
document.addEventListener('touchstart',e=>{if(window.scrollY<=0){ptrY=e.touches[0].clientY;ptrOn=true;}},{passive:true});
document.addEventListener('touchmove',e=>{if(!ptrOn)return;if(e.touches[0].clientY-ptrY>65)$('ptr').classList.add('show');else $('ptr').classList.remove('show');},{passive:true});
document.addEventListener('touchend',()=>{if(ptrOn&&$('ptr').classList.contains('show')){load();showToast('Actualizando…');}$('ptr').classList.remove('show');ptrOn=false;},{passive:true});

load();
flushQueue();
if(!localStorage.getItem('bayu_onboarded')){var _o=document.getElementById('onb');if(_o)_o.classList.add('show');}
function closeOnb(){var o=document.getElementById('onb');if(o)o.classList.remove('show');localStorage.setItem('bayu_onboarded','1');}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
