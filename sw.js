/* Service worker của DVC Lào Cai: ưu tiên mạng (luôn lấy bản mới nhất), chỉ dùng bản lưu khi mất mạng.
   Không bao giờ lưu yêu cầu tới Google Sheets / Apps Script / Firebase / gqtthc (khác nguồn gốc). */
const CACHE = 'tthc-shell-v3';
const SHELL = ['./app-mode.css', './app-mode.js', './status-popup.js', './', './manifest.webmanifest', './logo.png', './app-icons/icon-192.png', './app-icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // API bên ngoài: để trình duyệt tự xử lý
  if (req.headers.has('range')) return;                // âm thanh/video: không can thiệp
  if (/\/(audio)\//.test(url.pathname)) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error()))
      )
  );
});
