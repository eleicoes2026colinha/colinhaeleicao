const CACHE='colinha-eleitoral-2026-tse-v13';
const STATIC=[
  './',
  './index.html',
  './styles.css?v=12',
  './app.js?v=12',
  './manifest.webmanifest?v=12',
  './logo-urna.png',
  './logo-urna-64.png?v=12',
  './logo-urna-192.png?v=12',
  './logo-urna-512.png',
  './icon.svg',
  './data/status.js?v=12'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(STATIC))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    ])
  );
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response && response.ok) cache.put(request,response.clone());
    return response;
  }catch(err){
    const cached=await cache.match(request,{ignoreSearch:false}) || await caches.match(request,{ignoreSearch:true});
    if(cached) return cached;
    throw err;
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached) return cached;
  const response=await fetch(request);
  if(response && response.ok){
    const cache=await caches.open(CACHE);
    cache.put(request,response.clone());
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==location.origin) return;

  // Dados eleitorais e fotos: sempre tenta a versão publicada mais recente.
  if(url.pathname.includes('/data/') || url.pathname.includes('/photos/')){
    event.respondWith(networkFirst(request));
    return;
  }

  // Arquivos de aplicação e navegação: network-first para não prender versões antigas.
  const isAppShell=request.mode==='navigate' || /\.(?:html|js|css|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith('/');
  if(isAppShell){
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
