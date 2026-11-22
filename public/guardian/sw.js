// 보호자 폰 앱 서비스 워커 (#62, docs/guardian-app.md 6-0)
// 앱 화면 파일만 폰에 저장해 빨리 열리게 한다. 요약(Supabase)은 저장하지 않고 열 때마다 새로 읽는다.
// 방식: 먼저 인터넷에서 받고(새 버전이 바로 보이게), 인터넷이 없을 때만 저장해 둔 파일을 쓴다.
// 범위: 이 파일이 있는 /aihand-care/guardian/ 아래 페이지만. 스테이션 앱에는 영향이 없다.

const CACHE = 'sonit-guardian-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sonit-guardian-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // Supabase 등 다른 곳은 손대지 않는다

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? Response.error())),
  );
});
