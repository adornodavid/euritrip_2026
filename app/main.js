'use strict';
const DOW=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const CAT={comida:'🍽️',museo:'🏛️',paseo:'🚶','viñedo':'🍷',vinedo:'🍷',actividad:'🎟️',compras:'🛍️',traslado:'🚄',logistica:'🧳',flex:'✨'};
const CITIES=[
  {key:'Paris',name:'París',flag:'🇫🇷',dates:['2026-10-16','2026-10-17','2026-10-18','2026-10-19'],range:'16-20 Oct · 4N'},
  {key:'Bordeaux',name:'Bordeaux',flag:'🇫🇷',dates:['2026-10-20','2026-10-21'],range:'20-22 Oct · 2N'},
  {key:'San Sebastián',name:'San Sebastián',flag:'🇪🇸',dates:['2026-10-22','2026-10-23'],range:'22-24 Oct · 2N'},
  {key:'Bilbao',name:'Bilbao',flag:'🇪🇸',dates:['2026-10-24','2026-10-25'],range:'24-26 Oct · 2N'},
  {key:'Madrid',name:'Madrid',flag:'🇪🇸',dates:['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31'],range:'26-31 Oct · 5N'}
];
let DATA={};
const $=id=>document.getElementById(id);
function esc(t){return (t==null?'':String(t)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function dn(iso){const p=iso.split('-');const d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));return DOW[d.getUTCDay()]+' '+(+p[2]);}
function wkey(){let k=localStorage.getItem('eurotrip_write_key');if(!k){k=prompt('Clave de escritura (David/Paty):');if(k)localStorage.setItem('eurotrip_write_key',k);}return k;}
function money(n){return '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});}

function go(tab){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('s-'+tab).classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  window.scrollTo(0,0);
}

async function load(){
  try{
    const r=await fetch('/api/data',{cache:'no-store'});const j=await r.json();
    DATA=j.data||{};
    renderPlanner();renderGastos();
  }catch(e){ $('planner-root').innerHTML='<p class="empty">Sin conexión. '+esc(e.message)+'</p>'; }
}

/* ---------- PLANNER ---------- */
function renderPlanner(){
  const acts=DATA.activities||[], hotels=DATA.hotel_choices||[];
  let html='';
  CITIES.forEach((c,ci)=>{
    const cityActs=acts.filter(a=>c.dates.includes(a.activity_date));
    const hotel=hotels.find(h=>h.city===c.key);
    const cnt=cityActs.length;
    html+='<div class="city'+(ci===0?' open':'')+'" id="city-'+ci+'">';
    html+='<div class="city-head" onclick="document.getElementById(\'city-'+ci+'\').classList.toggle(\'open\')">';
    html+='<span style="font-size:1.3rem">'+c.flag+'</span><span class="nm">'+c.name+'</span>';
    html+='<span class="ct">'+c.range+'<br/>'+(cnt?cnt+' actividades':'sin actividades')+'</span><span class="chev">›</span></div>';
    html+='<div class="city-body">';
    if(hotel){ html+='<div class="hotel-line">🏨 '+esc(hotel.hotel_name)+(hotel.confirmed?' · ✅ confirmado':' · ⏳ por definir')+(hotel.zone?' · '+esc(hotel.zone):'')+'</div>'; }
    c.dates.forEach(d=>{
      const da=cityActs.filter(a=>a.activity_date===d).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||((a.start_time||'')>(b.start_time||'')?1:-1));
      html+='<div class="day"><div class="day-h">'+dn(d)+' Oct</div>';
      da.forEach(a=>{
        const done=a.status==='hecho';
        html+='<div class="act'+(done?' done':'')+'">';
        html+='<button class="chk" onclick="togAct(\''+a.id+'\','+done+')">'+(done?'✓':'')+'</button>';
        html+='<div class="a-body"><div class="a-title">'+(a.start_time?'<span class="a-time">'+esc(a.start_time.slice(0,5))+'</span>':'')+esc(a.title)+(a.is_suggestion?'<span class="sug">sugerida</span>':'')+'</div>';
        const m=[];if(a.category)m.push((CAT[a.category]||'•')+' '+esc(a.category));if(a.notes)m.push(esc(a.notes));
        if(m.length)html+='<div class="a-meta">'+m.join(' · ')+'</div>';
        html+='</div><div class="a-act"><button onclick="editAct(\''+a.id+'\')">✏️</button><button onclick="delAct(\''+a.id+'\')">🗑️</button></div></div>';
      });
      html+='<button class="addbtn" onclick="openAct({activity_date:\''+d+'\',city:\''+c.key+'\'})">+ actividad el '+dn(d)+'</button></div>';
    });
    html+='</div></div>';
  });
  $('planner-root').innerHTML=html;
}
function openAct(a){
  $('ma-title').textContent=a.id?'Editar actividad':'Nueva actividad';
  $('ma-id').value=a.id||'';$('ma-date').value=a.activity_date||'2026-10-16';
  $('ma-time').value=a.start_time?a.start_time.slice(0,5):'';$('ma-tit').value=a.title||'';
  $('ma-cat').value=a.category||'';$('ma-city').value=a.city||'';$('ma-notes').value=a.notes||'';
  $('m-act').classList.add('open');
}
function editAct(id){const a=(DATA.activities||[]).find(x=>x.id===id);if(a)openAct(a);}
async function togAct(id,done){await write({action:'update',table:'activities',id:id,patch:{status:done?'pendiente':'hecho'}});}
async function delAct(id){if(confirm('¿Borrar esta actividad?'))await write({action:'delete',table:'activities',id:id});}
async function saveAct(){
  const id=$('ma-id').value,tit=$('ma-tit').value.trim();
  if(!tit){alert('Escribe la actividad');return;}
  const row={activity_date:$('ma-date').value,start_time:$('ma-time').value||null,title:tit,category:$('ma-cat').value||null,city:$('ma-city').value||null,notes:$('ma-notes').value||null};
  if(id)await write({action:'update',table:'activities',id:id,patch:row});
  else{row.created_by='manual';row.is_suggestion=false;row.status='pendiente';await write({action:'insert',table:'activities',row:row});}
  closeM('m-act');
}

/* ---------- GASTOS ---------- */
function renderGastos(){
  const budget=DATA.budget||[],exp=DATA.expenses||[];
  const totSpent=exp.reduce((s,e)=>s+Number(e.amount_mxn||0),0);
  const totMin=budget.reduce((s,b)=>s+Number(b.projected_min_mxn||0),0);
  const totMax=budget.reduce((s,b)=>s+Number(b.projected_max_mxn||0),0);
  const pct=totMax?Math.min(100,totSpent/totMax*100):0;
  let html='<div class="bcard"><div class="btot"><div><div class="lbl">Gastado</div><div class="big">'+money(totSpent)+'</div></div><div style="text-align:right"><div class="lbl">Presupuesto</div><div class="big" style="font-size:1.1rem;color:var(--muted)">'+money(totMin)+'–'+money(totMax)+'</div></div></div><div class="bar"><i style="width:'+pct+'%"></i></div></div>';
  // categorias
  html+='<div class="bcard">';
  budget.forEach(b=>{
    const sp=exp.filter(e=>e.category===b.category).reduce((s,e)=>s+Number(e.amount_mxn||0),0);
    const mx=Number(b.projected_max_mxn||0);const p=mx?Math.min(100,sp/mx*100):0;
    html+='<div class="catrow"><div class="top"><span>'+(b.emoji||'')+' '+esc(b.label)+'</span><span>'+money(sp)+' <span class="sub">/ '+money(mx)+'</span></span></div><div class="bar"><i style="width:'+p+'%;background:'+(p>100?'var(--red)':'var(--green)')+'"></i></div></div>';
  });
  html+='</div>';
  // lista gastos
  html+='<div class="bcard"><div class="lbl" style="margin-bottom:.3rem">Últimos gastos</div>';
  if(!exp.length)html+='<div class="empty">Aún no hay gastos. Toca + para agregar.</div>';
  exp.slice(0,40).forEach(e=>{
    html+='<div class="exp"><div><div class="d">'+esc(e.description)+'</div><div class="m">'+(e.expense_date||'')+(e.city?' · '+esc(e.city):'')+(e.payer?' · '+esc(e.payer):'')+'</div></div><div style="display:flex;align-items:center;gap:.3rem"><span class="amt">'+money(e.amount_mxn)+'</span><button class="x" onclick="delExp(\''+e.id+'\')">🗑️</button></div></div>';
  });
  html+='</div>';
  $('gastos-root').innerHTML=html;
  // poblar selects de categoría
  const opts=budget.map(b=>'<option value="'+b.category+'">'+(b.emoji||'')+' '+esc(b.label)+'</option>').join('');
  $('me-cat').innerHTML=opts;
}
function openExp(e){
  $('me-title').textContent=e.id?'Editar gasto':'Nuevo gasto';
  $('me-id').value=e.id||'';$('me-desc').value=e.description||'';$('me-mxn').value=e.amount_mxn||'';
  $('me-cat').value=e.category||(DATA.budget&&DATA.budget[0]&&DATA.budget[0].category)||'';
  $('me-payer').value=e.payer||'Joint';$('me-city').value=e.city||'';$('me-notes').value=e.notes||'';
  $('m-exp').classList.add('open');
}
async function delExp(id){if(confirm('¿Borrar este gasto?'))await write({action:'delete',table:'expenses',id:id});}
async function saveExp(){
  const id=$('me-id').value,desc=$('me-desc').value.trim(),mxn=parseFloat($('me-mxn').value);
  if(!desc){alert('Escribe la descripción');return;}
  if(isNaN(mxn)){alert('Monto inválido');return;}
  const row={description:desc,amount_mxn:mxn,category:$('me-cat').value,payer:$('me-payer').value,city:$('me-city').value||null,currency:'MXN',notes:$('me-notes').value||null};
  if(id)await write({action:'update',table:'expenses',id:id,patch:row});
  else{row.created_by='manual';await write({action:'insert',table:'expenses',row:row});}
  closeM('m-exp');
}

/* ---------- TIPS ---------- */
const TIPS=[
  ['🛂','Schengen / ETIAS','Sin visa para mexicanos (estancia <90 días). ETIAS podría arrancar en 2026 — revisar antes de volar. Pasaporte con 6+ meses de vigencia.'],
  ['📶','eSIM','Holafly o Airalo, ~€80 datos ilimitados Europa. Actívala al aterrizar en CDG. Evita roaming carísimo.'],
  ['🧳','Equipaje','3 maletas total entre los dos (no 6). Cambias de hotel cada 2-4 noches — viaja ligero.'],
  ['🔌','Enchufe','Europa usa tipo C/E (dos clavijas redondas, 230V). Lleva 1-2 adaptadores universales.'],
  ['💶','Tax-free','Compras grandes: pide factura tax-free (DIVA) y séllala en Barajas antes de volar el 31. Reembolso del IVA.'],
  ['🍢','Pintxos (País Vasco)','Se comen de pie, en la barra, cambiando de bar. Pide 1-2 + un txakoli/zurito y sigue. En Bar Néstor (Donostia) apúntate 30 min antes para la txuleta.'],
  ['🎨','Guggenheim Bilbao','Compra entrada online con horario (€16). No te pierdas el Puppy de Koons ni "La materia del tiempo" de Serra. Mejor foto desde el puente de La Salve.'],
  ['🍷','Saint-Émilion (21 Oct)','Octubre = post-vendimia, la mejor época. Tour de medio día con cata. Lleva suéter y zapatos cerrados.'],
  ['🌧️','Clima Oct','París 12-18°C · Bordeaux 10-19°C · País Vasco 12-20°C (lluvioso, lleva paraguas) · Madrid 10-19°C seco.'],
  ['✈️','Vuelos','Ida AM44 MTY 15 Oct 3:25pm → CDG 16 Oct 9:40am (29A/29B). Regreso AM35 MAD 31 Oct 10:30am → MTY 3:45pm (34H/34J).']
];
function renderTips(){
  $('tips-root').innerHTML=TIPS.map(t=>'<div class="tip"><h3>'+t[0]+' '+t[1]+'</h3><p>'+t[2]+'</p></div>').join('');
}

/* ---------- CLAUDIA ---------- */
let chatMsgs=[];
function pushBub(role,text){const d=document.createElement('div');d.className='bub '+(role==='user'?'u':'a');d.textContent=text;$('chat-log').appendChild(d);d.scrollIntoView({behavior:'smooth'});return d;}
async function sendChat(){
  const inp=$('chat-in');const t=inp.value.trim();if(!t)return;
  inp.value='';pushBub('user',t);chatMsgs.push({role:'user',content:t});
  const typing=pushBub('assistant','…');
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatMsgs})});
    const j=await r.json();const reply=j.reply||j.error||'(sin respuesta)';
    typing.textContent=reply;chatMsgs.push({role:'assistant',content:reply});
    if(j.tool_events&&j.tool_events.length)load(); // refrescar si Claudia escribió algo
  }catch(e){typing.textContent='Error: '+e.message;}
}

/* ---------- shared ---------- */
function closeM(id){$(id).classList.remove('open');}
async function write(body){
  const k=wkey();if(!k)return;
  try{
    const r=await fetch('/api/write',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Key':k},body:JSON.stringify(body)});
    const j=await r.json();
    if(!j.ok){alert('Error: '+(j.error||'?'));if(/clave/i.test(j.error||''))localStorage.removeItem('eurotrip_write_key');return;}
    await load();
  }catch(e){alert('Error de red: '+e.message);}
}

renderTips();
load();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
