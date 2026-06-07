const CACHE='eurotrip-v8-8';
const CORE=['/','/manifest.json','/app/main.js','/app/icon-192.png','/app/icon-512.png'];
const IMGS=['/images/paris/eiffel.jpg','/images/bordeaux/place-bourse.jpg','/images/san-sebastian/bahia.jpg','/images/bilbao/panoramica.jpg','/images/madrid/palacio-real.jpg'];
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
  if(u.pathname.startsWith('/api/')){ e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const cp=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return resp;
  }).catch(()=>caches.match('/'))));
});
