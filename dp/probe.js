/* Thăm dò gqtthc: có đường nào trả số đã cộng đơn vị con trong một lần gọi không? Dán vào Console (F12) trên trang gqtthc đã đăng nhập. */
(async () => {
  const B = 'https://gateway-gqtthc.dcs.vn/report/api/v1/thong-ke-ho-so/', tk = localStorage.getItem('token'), mo = '11/2026', VC = 2124784; /* Đảng bộ xã Văn Chấn */
  const post = (p, body) => fetch(B + p, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ http: r.status, j: await r.json().catch(() => null) }));
  const out = {};
  const sum = rows => rows.map(r => [r.dvcTen || r.coQuanTen, r.dangXuLy, r.daTuChoi, r.daXuLyXong].join(' | '));
  let r = await post('theo-tthc', { tuThang: mo, denThang: mo, coQuanId: VC, page: 0, size: 50 }); out.theoTthc_VanChan = { http: r.http, rows: sum((r.j && r.j.data && r.j.data.data) || []) };
  r = await post('theo-co-quan', { tuThang: mo, denThang: mo, dvcId: 10001, coQuanId: VC, page: 0, size: 300 }); out.theoCoQuan_nhanXet_VanChan = { http: r.http, rows: sum((r.j && r.j.data && r.j.data.data) || []).slice(0, 12), keys: Object.keys(((r.j && r.j.data && r.j.data.data) || [{}])[0] || {}) };
  for (const cap of [true, false]) { r = await post('chi-tiet', { tuThang: mo, denThang: mo, dvcId: 10001, coQuanId: VC, baoGomCapCon: cap, page: 0, size: 1 }); out['chiTiet_baoGomCapCon_' + cap] = { http: r.http, total: r.j && r.j.data && r.j.data.totalElements }; }
  const box = document.createElement('textarea'); box.value = JSON.stringify(out, null, 1); box.style.cssText = 'position:fixed;z-index:999999;top:60px;right:10px;width:560px;height:420px;font:12px monospace'; document.body.appendChild(box); box.select(); console.log(out);
})();
