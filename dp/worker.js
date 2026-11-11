/* Cloudflare Worker trung gian (CHỈ cần nếu PWA báo bị chặn CORS).
   Chuyển tiếp yêu cầu tới gateway-gqtthc.dcs.vn/report/* và thêm header CORS.
   Không lưu token, không ghi log; chỉ cho phép các site của anh gọi. */
const ALLOW = [
  'https://laocai-tthc.pages.dev',
  'https://laocai-tthc.web.app',
  'https://laocai-cds.github.io'
];
const UPSTREAM = 'https://gateway-gqtthc.dcs.vn';

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = ALLOW.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : ALLOW[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (!okOrigin || req.method !== 'POST' || !url.pathname.startsWith('/report/')) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }
    const up = await fetch(UPSTREAM + url.pathname, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: await req.text()
    });
    const h = new Headers(cors);
    h.set('Content-Type', up.headers.get('Content-Type') || 'application/json');
    return new Response(up.body, { status: up.status, headers: h });
  }
};
