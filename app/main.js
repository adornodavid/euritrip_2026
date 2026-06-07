'use strict';
const DOW=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const CAT={comida:'🍽️',museo:'🏛️',paseo:'🚶','viñedo':'🍷',vinedo:'🍷',actividad:'🎟️',compras:'🛍️',traslado:'🚄',logistica:'🧳',flex:'✨'};
const CITIES=[
  {key:'Paris',name:'París',flag:'🇫🇷',img:'images/paris/eiffel.jpg',dates:['2026-10-16','2026-10-17','2026-10-18','2026-10-19'],range:'16-20 Oct · 4N'},
  {key:'Bordeaux',name:'Bordeaux',flag:'🇫🇷',img:'images/bordeaux/place-bourse.jpg',dates:['2026-10-20','2026-10-21'],range:'20-22 Oct · 2N'},
  {key:'San Sebastián',name:'San Sebastián',flag:'🇪🇸',img:'images/san-sebastian/bahia.jpg',dates:['2026-10-22','2026-10-23'],range:'22-24 Oct · 2N'},
  {key:'Bilbao',name:'Bilbao',flag:'🇪🇸',img:'images/bilbao/panoramica.jpg',dates:['2026-10-24','2026-10-25'],range:'24-26 Oct · 2N'},
  {key:'Madrid',name:'Madrid',flag:'🇪🇸',img:'images/madrid/palacio-real.jpg',dates:['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31'],range:'26-31 Oct · 5N'}
];
const SUGG={
  'Paris':[{t:'Crucero por el Sena',img:'images/paris/sena.jpg',r:'8.1',rev:'13577',p:'$19',cat:'actividad'},{t:'Louvre sin filas',img:'images/paris/louvre.jpg',r:'8.5',rev:'9200',p:'$32',cat:'museo'},{t:'Cima de la Torre Eiffel',img:'images/paris/eiffel.jpg',r:'8.7',rev:'21043',p:'$45',cat:'actividad'},{t:'Versalles día completo',img:'images/paris/versalles.jpg',r:'8.6',rev:'7810',p:'$65',cat:'museo'}],
  'Bordeaux':[{t:'Tour viñedos Saint-Émilion',img:'images/bordeaux/saint-emilion.jpg',r:'9.0',rev:'3412',p:'$115',cat:'viñedo'},{t:'Cité du Vin + cata',img:'images/bordeaux/cite-du-vin.jpg',r:'8.2',rev:'2104',p:'$22',cat:'museo'},{t:'Ostras + vino en el mercado',img:'images/bordeaux/oysters.jpg',r:'8.8',rev:'915',p:'$35',cat:'comida'}],
  'San Sebastián':[{t:'Ruta de pintxos guiada',img:'images/san-sebastian/pintxos.jpg',r:'9.1',rev:'2630',p:'$89',cat:'comida'},{t:'Monte Igueldo + bahía',img:'images/san-sebastian/igueldo.jpg',r:'8.4',rev:'1180',p:'$15',cat:'actividad'},{t:'Donostia + Getaria',img:'images/san-sebastian/zurriola.jpg',r:'8.7',rev:'604',p:'$70',cat:'paseo'}],
  'Bilbao':[{t:'Entrada Museo Guggenheim',img:'images/bilbao/guggenheim.jpg',r:'9.0',rev:'5421',p:'$16',cat:'museo'},{t:'Txikiteo de pintxos',img:'images/bilbao/mercado-ribera.jpg',r:'8.9',rev:'1106',p:'$55',cat:'comida'},{t:'Bilbao esencial a pie',img:'images/bilbao/casco-viejo.jpg',r:'8.5',rev:'842',p:'$25',cat:'paseo'}],
  'Madrid':[{t:'Museo del Prado sin filas',img:'images/madrid/plaza-mayor.jpg',r:'8.6',rev:'12044',p:'$28',cat:'museo'},{t:'Show de flamenco',img:'images/madrid/tapas-madrid.jpg',r:'8.8',rev:'6530',p:'$35',cat:'actividad'},{t:'Toledo día completo',img:'images/madrid/toledo.jpg',r:'8.7',rev:'9012',p:'$55',cat:'museo'},{t:'Palacio Real',img:'images/madrid/palacio-real.jpg',r:'8.5',rev:'4310',p:'$18',cat:'museo'}]
};
let DATA={}, gCity='', gPayer='', chatStarted=false;
const $=id=>document.getElementById(id);
function esc(t){return (t==null?'':String(t)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function dn(iso){const p=iso.split('-');const d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));return DOW[d.getUTCDay()]+' '+(+p[2]);}
function wkey(){let k=localStorage.getItem('eurotrip_write_key');if(!k){k=prompt('Clave de escritura (David/Paty):');if(k)localStorage.setItem('eurotrip_write_key',k);}return k;}
function money(n){return '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
let toastT;
function showToast(msg,err){const t=$('toast');if(!t)return;t.textContent=msg;t.className='toast show'+(err?' err':'');clearTimeout(toastT);toastT=setTimeout(()=>{t.className='toast'+(err?' err':'');},1900);}
function tripInfo(){const start=new Date('2026-10-16T00:00:00'),end=new Date('2026-10-31T23:59:59'),now=new Date();
  if(now<start)return 'Faltan '+Math.ceil((start-now)/86400000)+' días para el viaje 🧳';
  if(now>end)return '¡Viaje terminado! 🏠';
  return 'Día '+(Math.floor((now-start)/86400000)+1)+' del viaje ✈️';}
function todayISO(){const n=new Date(),start=new Date('2026-10-16T00:00:00'),end=new Date('2026-10-31T23:59:59');if(n<start||n>end)return null;const z=new Date(n.getTime()-n.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);}
function defaultOpenKey(){const t=todayISO();if(t){const c=CITIES.find(c=>c.dates.includes(t));if(c)return c.key;}return 'Paris';}
function openKeys(){const st=localStorage.getItem('eurotrip_open');if(st){try{return new Set(JSON.parse(st));}catch(e){}}return new Set([defaultOpenKey()]);}
function toggleCity(ci){const el=$('city-'+ci);el.classList.toggle('open');const set=openKeys();const k=CITIES[ci].key;if(el.classList.contains('open'))set.add(k);else set.delete(k);localStorage.setItem('eurotrip_open',JSON.stringify([...set]));}

function go(tab){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('s-'+tab).classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='explore')renderExplore();
  if(tab==='perfil')renderPerfil();
  if(tab==='claudia')startChat();
  window.scrollTo(0,0);
}
async function load(){
  if(!DATA.activities)$('planner-root').innerHTML='<div class="skel skel-city"></div><div class="skel skel-city"></div><div class="skel skel-city"></div>';
  try{
    const r=await fetch('/api/data',{cache:'no-store'});const j=await r.json();
    DATA=j.data||{};renderPlanner();renderGastos();
    if($('s-perfil').classList.contains('active'))renderPerfil();
  }catch(e){ $('planner-root').innerHTML='<p class="empty">Sin conexión. '+esc(e.message)+'</p>'; }
}

/* ---------- PLANNER ---------- */
function renderPlanner(){
  const acts=DATA.activities||[], hotels=DATA.hotel_choices||[], today=todayISO(), oset=openKeys();
  const totalA=acts.length, doneA=acts.filter(a=>a.status==='hecho').length, pg=totalA?Math.round(doneA/totalA*100):0;
  let html='<div class="pl-summary"><div class="cd">'+tripInfo()+'</div><div class="pg"><span>Avance del plan</span><span>'+doneA+'/'+totalA+' ('+pg+'%)</span></div><div class="bar"><i style="width:'+pg+'%"></i></div></div>';
  CITIES.forEach((c,ci)=>{
    const cityActs=acts.filter(a=>c.dates.includes(a.activity_date));
    const hotel=hotels.find(h=>h.city===c.key), cnt=cityActs.length, dco=cityActs.filter(a=>a.status==='hecho').length;
    const isOpen=oset.has(c.key);
    html+='<div class="city'+(isOpen?' open':'')+'" id="city-'+ci+'">';
    html+='<div class="city-photo" onclick="toggleCity('+ci+')"><img src="'+c.img+'" alt="" onerror="this.style.display=\'none\'"/><div class="ov"></div>';
    html+='<div class="ci"><span style="font-size:1.2rem">'+c.flag+'</span><span class="nm">'+c.name+'</span>';
    html+='<span class="ct">'+c.range+'<br/>'+(cnt?'<span class="cprog">'+dco+'/'+cnt+' ✓</span>':'sin actividades')+'</span><span class="chev">›</span></div></div>';
    html+='<div class="city-body">';
    html+='<div class="hotel-line" style="cursor:pointer" onclick="openHotel(\''+esc(c.key)+'\')">🏨 '+(hotel?esc(hotel.hotel_name)+(hotel.confirmed?' · ✅':' · ⏳ por definir')+(hotel.zone?' · '+esc(hotel.zone):''):'Definir hotel')+' · ✏️</div>';
    c.dates.forEach(d=>{
      const da=cityActs.filter(a=>a.activity_date===d).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||((a.start_time||'')>(b.start_time||'')?1:-1));
      const isToday=(d===today);
      html+='<div class="day'+(isToday?' today':'')+'"><div class="day-h">'+dn(d)+' Oct'+(isToday?'<span class="hoy-badge">HOY</span>':'')+'</div>';
      da.forEach((a,idx)=>{
        const done=a.status==='hecho';
        const up=idx>0?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',-1)">▲</button>':'';
        const dw=idx<da.length-1?'<button class="mvbtn" onclick="moveAct(\''+a.id+'\',1)">▼</button>':'';
        html+='<div class="act'+(done?' done':'')+'"><button class="chk" onclick="togAct(\''+a.id+'\','+done+')">'+(done?'✓':'')+'</button>';
        html+='<div class="a-body"><div class="a-title">'+(a.start_time?'<span class="a-time">'+esc(a.start_time.slice(0,5))+'</span>':'')+esc(a.title)+(a.is_suggestion?'<span class="sug">sugerida</span>':'')+'</div>';
        const m=[];if(a.category)m.push((CAT[a.category]||'•')+' '+esc(a.category));if(a.notes)m.push(esc(a.notes));
        if(m.length)html+='<div class="a-meta">'+m.join(' · ')+'</div>';
        html+='</div><div class="a-act">'+up+dw+'<button onclick="editAct(\''+a.id+'\')">✏️</button><button onclick="delAct(\''+a.id+'\')">🗑️</button></div></div>';
      });
      html+='<button class="addbtn" onclick="openAct({activity_date:\''+d+'\',city:\''+esc(c.key)+'\'})">+ actividad el '+dn(d)+'</button>'+(da.length?'<button class="addbtn" style="margin-top:.3rem;border-style:solid;color:var(--green)" onclick="mapDay(\''+d+'\')">🗺️ Ver el día en Google Maps</button>':'')+'</div>';
    });
    html+=suggRow(c.key,c.name)+'</div></div>';
  });
  $('planner-root').innerHTML=html;
}
function suggRow(key,name){
  const sg=SUGG[key]||[]; if(!sg.length)return '';
  let h='<div class="sugg-wrap"><div class="sugg-h">✨ Sugerencias para '+esc(name)+'</div><div class="sugg-row">';
  sg.forEach((x,xi)=>{h+='<div class="sugg"><img src="'+x.img+'" alt="" onerror="this.style.display=\'none\'" onclick="openSug(\''+esc(key)+'\','+xi+')"/><div class="si"><div class="st">'+esc(x.t)+'</div><div class="sr">⭐ '+x.r+' · '+x.rev+' reseñas</div><div class="sp">desde '+x.p+'</div><button class="sadd" onclick="addSug(\''+esc(key)+'\','+xi+')">+ Agregar</button></div></div>';});
  return h+'</div></div>';
}
function firstDay(key){const c=CITIES.find(c=>c.key===key);return c?c.dates[0]:'2026-10-16';}
function addSug(key,i){const x=(SUGG[key]||[])[i];if(!x)return;go('planner');openAct({activity_date:firstDay(key),title:x.t,category:x.cat,city:key});}
function openSug(key,i){const x=(SUGG[key]||[])[i];if(!x)return;window.open('https://www.getyourguide.com/s/?q='+encodeURIComponent(x.t+' '+key),'_blank');}
function openAct(a){$('ma-title').textContent=a.id?'Editar actividad':'Nueva actividad';$('ma-id').value=a.id||'';$('ma-date').value=a.activity_date||'2026-10-16';$('ma-time').value=a.start_time?a.start_time.slice(0,5):'';$('ma-tit').value=a.title||'';$('ma-cat').value=a.category||'';$('ma-city').value=a.city||'';$('ma-notes').value=a.notes||'';$('m-act').classList.add('open');}
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
  const row={activity_date:$('ma-date').value,start_time:$('ma-time').value||null,title:tit,category:$('ma-cat').value||null,city:$('ma-city').value||null,notes:$('ma-notes').value||null};
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
  const _d=byP('David'),_p=byP('Paty'),_diff=Math.abs(_d-_p)/2;
  const _settle=_diff<1?'Están a mano 🤝':(_d>_p?'Paty le debe a David ':'David le debe a Paty ')+money(_diff);
  html+='<div class="bcard" style="text-align:center"><div class="lbl">⚖️ Balance de la pareja</div><div style="font-weight:800;font-size:1.05rem;margin-top:.35rem">'+_settle+'</div></div>';
  html+='<div class="bcard">';
  budget.forEach(b=>{const sp=exp.filter(e=>e.category===b.category).reduce((s,e)=>s+Number(e.amount_mxn||0),0);const mx=Number(b.projected_max_mxn||0),p=mx?Math.min(100,sp/mx*100):0;
    html+='<div class="catrow" style="cursor:pointer" onclick="openBudget(\''+b.category+'\')"><div class="top"><span>'+(b.emoji||'')+' '+esc(b.label)+'</span><span>'+money(sp)+' <span class="sub">/ '+money(mx)+'</span></span></div><div class="bar"><i style="width:'+p+'%;background:'+(p>=100?'var(--red)':'var(--green)')+'"></i></div></div>';});
  html+='</div>';
  html+='<div class="chips"><div class="chip'+(gCity===''?' on':'')+'" onclick="setFilter(\'city\',\'\')">Todas</div>'+CITIES.map(c=>'<div class="chip'+(gCity===c.key?' on':'')+'" onclick="setFilter(\'city\',\''+esc(c.key)+'\')">'+c.flag+' '+esc(c.name)+'</div>').join('')+'</div>';
  html+='<div class="chips">'+['','David','Paty','Joint'].map(p=>'<div class="chip'+(gPayer===p?' on':'')+'" onclick="setFilter(\'payer\',\''+p+'\')">'+(p===''?'Todos':(p==='Joint'?'🤝 Juntos':'👤 '+p))+'</div>').join('')+'</div>';
  let list=exp.slice();if(gCity)list=list.filter(e=>e.city===gCity);if(gPayer)list=list.filter(e=>e.payer===gPayer);
  html+='<div class="bcard"><div class="lbl" style="margin-bottom:.3rem">Gastos'+(list.length?' ('+list.length+')':'')+'</div>';
  if(!list.length)html+='<div class="empty">Sin gastos'+(gCity||gPayer?' con ese filtro':' aún')+'. Toca + para agregar.</div>';
  list.slice(0,60).forEach(e=>{const orig=(e.currency&&e.currency!=='MXN'&&e.amount_original)?' ('+(e.currency==='EUR'?'€':'$')+e.amount_original+')':'';
    html+='<div class="exp"><div><div class="d">'+esc(e.description)+'</div><div class="m">'+(e.expense_date||'')+(e.city?' · '+esc(e.city):'')+(e.payer?' · '+esc(e.payer):'')+'</div></div><div style="display:flex;align-items:center;gap:.3rem"><span class="amt">'+money(e.amount_mxn)+orig+'</span><button class="x" onclick="editExpById(\''+e.id+'\')">✏️</button><button class="x" onclick="delExp(\''+e.id+'\')">🗑️</button></div></div>';});
  html+='</div>';
  $('gastos-root').innerHTML=html;
  $('me-cat').innerHTML=budget.map(b=>'<option value="'+b.category+'">'+(b.emoji||'')+' '+esc(b.label)+'</option>').join('');
}
function editExpById(id){const e=(DATA.expenses||[]).find(x=>x.id===id);if(e)openExp(e);}
function fxCalc(){const cur=$('me-cur').value,orig=parseFloat($('me-orig').value)||0;
  if(cur==='MXN'){$('me-fxrow').style.display='none';$('me-mxn').value=orig||'';$('me-fxhint').textContent='';return;}
  $('me-fxrow').style.display='flex';let fx=parseFloat($('me-fx').value);if(!fx){fx=cur==='EUR'?22:18;$('me-fx').value=fx;}
  const mxn=Math.round(orig*fx);$('me-mxn').value=mxn||'';$('me-fxhint').textContent=orig?(cur==='EUR'?'€':'$')+orig+' × '+fx+' = '+money(mxn)+' MXN':'';}
function openExp(e){$('me-title').textContent=e.id?'Editar gasto':'Nuevo gasto';$('me-id').value=e.id||'';$('me-desc').value=e.description||'';$('me-cur').value=e.currency||'MXN';$('me-orig').value=(e.currency&&e.currency!=='MXN')?(e.amount_original||''):(e.amount_mxn||'');$('me-fx').value=e.fx_rate||'';$('me-mxn').value=e.amount_mxn||'';$('me-cat').value=e.category||(DATA.budget&&DATA.budget[0]&&DATA.budget[0].category)||'';$('me-payer').value=e.payer||'Joint';$('me-city').value=e.city||'';$('me-notes').value=e.notes||'';fxCalc();$('m-exp').classList.add('open');}
async function delExp(id){if(confirm('¿Borrar este gasto?'))await write({action:'delete',table:'expenses',id:id},'Borrado');}
async function saveExp(){const id=$('me-id').value,desc=$('me-desc').value.trim(),cur=$('me-cur').value,mxn=parseFloat($('me-mxn').value);
  if(!desc){alert('Escribe la descripción');return;}if(isNaN(mxn)){alert('Monto inválido');return;}
  const row={description:desc,amount_mxn:mxn,currency:cur,category:$('me-cat').value,payer:$('me-payer').value,city:$('me-city').value||null,notes:$('me-notes').value||null};
  if(cur!=='MXN'){row.amount_original=parseFloat($('me-orig').value)||null;row.fx_rate=parseFloat($('me-fx').value)||null;}
  if(id)await write({action:'update',table:'expenses',id:id,patch:row},'Guardado ✓');else{row.created_by='manual';await write({action:'insert',table:'expenses',row:row},'Gasto agregado ✓');}
  closeM('m-exp');}

/* ---------- EXPLORE ---------- */
const TIPS=[['🛂','Schengen / ETIAS','Sin visa para mexicanos (<90 días). ETIAS podría arrancar en 2026. Pasaporte con 6+ meses de vigencia.'],['📶','eSIM','Holafly o Airalo, ~€80 datos ilimitados Europa. Actívala al aterrizar en CDG.'],['🧳','Equipaje','3 maletas total entre los dos. Cambias de hotel cada 2-4 noches — viaja ligero.'],['🔌','Enchufe','Europa tipo C/E (clavijas redondas, 230V). Lleva 1-2 adaptadores.'],['💶','Tax-free','Compras grandes: factura tax-free (DIVA) sellada en Barajas antes de volar el 31.'],['🍢','Pintxos','De pie, de barra en barra. Pide 1-2 + txakoli. Bar Néstor: apúntate 30 min antes.'],['🎨','Guggenheim','Entrada online con horario (€16). Mejor foto desde el puente de La Salve.'],['🍷','Saint-Émilion','Octubre = post-vendimia. Tour medio día con cata. Suéter + zapatos cerrados.'],['🌧️','Clima Oct','París 12-18° · Bordeaux 10-19° · País Vasco 12-20° (lluvioso) · Madrid 10-19°.'],['✈️','Vuelos','Ida AM44 MTY 15 Oct→CDG 16 (29A/B). Regreso AM35 MAD 31 Oct 10:30am→MTY (34H/J).']];
function renderExplore(){let h='<div class="sec-h">💡 Tips del viaje</div>'+TIPS.map(t=>'<div class="tip"><h3>'+t[0]+' '+t[1]+'</h3><p>'+t[2]+'</p></div>').join('');
  h+='<div class="sec-h">🎟️ Ideas para hacer</div>';CITIES.forEach(c=>{h+='<div style="font-weight:800;font-size:.86rem;margin:.6rem 0 .2rem">'+c.flag+' '+esc(c.name)+'</div>'+suggRow(c.key,c.name);});
  h+='<a class="pf-btn" href="/guia" style="margin-top:1.2rem">📖 Abrir la guía completa por ciudad →</a>';$('explore-root').innerHTML=h;}

/* ---------- PERFIL ---------- */
function renderPerfil(){const hotels=DATA.hotel_choices||[];
  let h='<div class="bcard"><div class="lbl">El viaje</div><div style="font-size:1.2rem;font-weight:800;margin:.2rem 0">Eurotrip · Francia + País Vasco</div><div style="color:var(--muted);font-size:.88rem">15 noches · 16–31 Oct 2026 · David & Paty</div></div>';
  h+='<div class="bcard"><div class="lbl" style="margin-bottom:.2rem">Hoteles</div>';
  CITIES.forEach(c=>{const ho=hotels.find(x=>x.city===c.key);h+='<div class="pf-row"><span>'+c.flag+' '+esc(c.name)+'</span><span style="color:var(--muted)">'+(ho?(ho.confirmed?'✅ '+esc(ho.hotel_name):'⏳ por definir'):'—')+'</span></div>';});
  h+='</div>';
  h+='<button class="pf-btn" onclick="changeKey()">🔑 Cambiar clave de escritura</button><a class="pf-btn" href="/guia">📖 Guía editorial completa</a><button class="pf-btn" onclick="alert(\'Para instalar: Safari → Compartir → Agregar a inicio. Chrome: ⋮ → Instalar app.\')">📲 Cómo instalar la app</button><button class="pf-btn" onclick="load();showToast(\'Actualizado ✓\')">🔄 Recargar datos</button>';
  h+='<div style="text-align:center;color:var(--muted);font-size:.74rem;margin-top:1rem">Eurotrip PWA v8.4 · Arkamia Lab</div>';$('perfil-root').innerHTML=h;}
function changeKey(){localStorage.removeItem('eurotrip_write_key');const k=prompt('Nueva clave de escritura:');if(k){localStorage.setItem('eurotrip_write_key',k);showToast('Clave guardada ✓');}}

/* ---------- CLAUDIA ---------- */
let chatMsgs=[];
const CHIPS=['¿Cuánto llevamos gastado?','Agrega cena €80 en San Sebastián el 23','Mueve Versalles al 18','¿Qué falta por reservar?'];
function startChat(){if(chatStarted)return;chatStarted=true;$('chat-chips').innerHTML=CHIPS.map(c=>'<div class="chat-chip" onclick="chipSend(this)">'+esc(c)+'</div>').join('');pushBub('assistant','¡Hola David! Soy Claudia. Puedo armar tu plan, registrar gastos y resolver dudas del viaje. Dime qué necesitas o toca una sugerencia 👇');}
function chipSend(el){$('chat-in').value=el.textContent;sendChat();}
function pushBub(role,text){const d=document.createElement('div');d.className='bub '+(role==='user'?'u':'a');d.textContent=text;$('chat-log').appendChild(d);d.scrollIntoView({behavior:'smooth'});return d;}
async function sendChat(){const inp=$('chat-in'),t=inp.value.trim();if(!t)return;inp.value='';pushBub('user',t);chatMsgs.push({role:'user',content:t});const typing=pushBub('assistant','…');
  try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatMsgs})});const j=await r.json();const reply=j.reply||j.error||'(sin respuesta)';typing.textContent=reply;chatMsgs.push({role:'assistant',content:reply});if(j.tool_events&&j.tool_events.length){load();showToast('Plan actualizado ✓');}}catch(e){typing.textContent='Error: '+e.message;}}

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
  try{const r=await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify(body)});const j=await r.json();
    if(!j.ok){showToast(j.error||'Error',true);if(/clave/i.test(j.error||''))localStorage.removeItem('eurotrip_write_key');return;}
    await load();showToast(okMsg||'Listo ✓');}catch(e){showToast('Sin conexión',true);}}
async function writeMany(items,okMsg){const k=wkey();if(!k)return;
  try{for(const it of items){await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify({action:'update',table:'activities',id:it.id,patch:it.patch})});}await load();showToast(okMsg||'Listo ✓');}catch(e){showToast('Sin conexión',true);}}

/* pull-to-refresh */
let ptrY=0,ptrOn=false;
document.addEventListener('touchstart',e=>{if(window.scrollY<=0){ptrY=e.touches[0].clientY;ptrOn=true;}},{passive:true});
document.addEventListener('touchmove',e=>{if(!ptrOn)return;if(e.touches[0].clientY-ptrY>65)$('ptr').classList.add('show');else $('ptr').classList.remove('show');},{passive:true});
document.addEventListener('touchend',()=>{if(ptrOn&&$('ptr').classList.contains('show')){load();showToast('Actualizando…');}$('ptr').classList.remove('show');ptrOn=false;},{passive:true});

load();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
