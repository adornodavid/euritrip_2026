const CACHE='bayu-v13-5';
const CORE=['/','/manifest.json','/app/main.js','/app/ui.css','/app/icon-192.png','/app/icon-512.png','/app/apple-touch.png','/app/favicon.png'];
const IMGS=[]; // covers de viajes son URLs dinámicas — sin precache de imágenes fijas
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await c.addAll(CORE);                 // core: si falla, falla install (correcto)
  await Promise.allSettled(IMGS.map(u=>c.add(u))); // imágenes: best-effort
  self.skipWaiting();
})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const ks=await caches.keys();
  await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  self.clients.claim();
})());});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  // API: red primero, cae a caché
  if(u.pathname.startsWith('/api/')){ e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); return; }
  // App shell (navegación + JS/CSS/JSON propios): RED PRIMERO → así el código nuevo siempre llega; offline cae a caché
  const isShell = e.request.mode==='navigate' || (u.origin===self.location.origin && /\.(js|css|json)$/.test(u.pathname));
  if(isShell){
    e.respondWith(
      fetch(e.request).then(resp=>{ const cp=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return resp; })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('/')))
    );
    return;
  }
  // Resto (imágenes, fuentes): caché primero (rápido)
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const cp=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return resp;
  }).catch(()=>caches.match('/'))));
});
