// ==UserScript==
// @name         Hồ sơ chờ xử lý → Google Sheet (gqtthc)
// @namespace    laocai-cds
// @version      1.0
// @description  Nút nổi lấy danh sách hồ sơ chờ xử lý trên gqtthc.dcs.vn (chỉ các trường cho phép, không lấy họ tên) và gửi lên Apps Script của trang laocai-cds.github.io/tthc
// @match        https://gqtthc.dcs.vn/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (window.top !== window.self) return;
async function hscxRun(API) {
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:340px;background:#12315f;color:#fff;padding:12px 14px;border-radius:12px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);white-space:pre-wrap';
  document.body.appendChild(box);
  var say = function (t, bad) { box.style.background = bad ? '#a3231b' : '#12315f'; box.textContent = t; };
  try {
    if (location.hostname.indexOf('gqtthc.dcs.vn') < 0) throw new Error('Hãy mở trang gqtthc.dcs.vn (đã đăng nhập) rồi bấm lại.');
    if (!API) throw new Error('Chưa cấu hình địa chỉ Apps Script.');
    var tk = localStorage.getItem('token');
    if (!tk) throw new Error('Chưa đăng nhập gqtthc.dcs.vn.');
    var pw = localStorage.getItem('hscx.token') || '';
    if (!pw) {
      pw = (prompt('Mật khẩu đồng bộ hồ sơ chờ xử lý:') || '').trim();
      if (!pw) { box.remove(); return; }
    }
    say('Đang lấy danh sách hồ sơ chờ xử lý…');
    var rows = [], ids = [], page = 1, total = Infinity, SIZE = 200;
    while (rows.length < total && page <= 50) {
      var r = await fetch('https://gateway-gqtthc.dcs.vn/xulytthc/v1/ho-so/ho-so-xu-ly', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ page: page, size: SIZE, textSearch: '', dvcId: null, linhVucId: null, thuTucId: null, tinhId: null, xaId: null, tiepNhanTuNgay: null, tiepNhanDenNgay: null, thoiHan: null, trangThai: '4', hinhThucTiepNhan: null })
      });
      if (r.status === 401 || r.status === 403) throw new Error('Phiên gqtthc đã hết hạn, hãy đăng nhập lại rồi bấm lại.');
      if (!r.ok) throw new Error('API gqtthc trả về HTTP ' + r.status);
      var j = await r.json(), d = j.data || [];
      total = j.total != null ? j.total : (j.totalElements != null ? j.totalElements : d.length);
      d.forEach(function (x) {
        ids.push(x.mongoId);
        rows.push({
          ma: x.maHoSo, tthc: x.thuTuc, linhVuc: x.linhVuc, coQuan: '',
          ngayNop: x.ngayNop || x.ngayTiepNhan, han: x.hanXuLyToanQuyTrinh, hen: x.ngayHenTra,
          tt: x.trangThai, buoc: x.trangThaiBuocXuLy, ht: x.hinhThucTiepNhan, bs: x.boSungHoSo ? 1 : 0
        });
      });
      if (!d.length) break;
      page++;
    }
    var pick = function (j) {
      var d0 = (j && j.data) || {}, f = {};
      try { f = typeof d0.detail === 'string' ? JSON.parse(d0.detail) : (d0.detail || {}); } catch (e0) { f = {}; }
      return f.tokhaiDangBoCapTrenCoSoName || f.donViCapTrenName || f.tokhaiDangBoChiBoCoSoName || (d0.coquanTiepnhanData && d0.coquanTiepnhanData.name) || '';
    };
    var idx = 0, done = 0, miss = 0;
    var worker = async function () {
      while (idx < rows.length) {
        var i = idx++;
        try {
          var rr = await fetch('https://gateway-gqtthc.dcs.vn/xulytthc/v1/ho-so/' + ids[i], { headers: { Authorization: 'Bearer ' + tk, Accept: 'application/json' } });
          if (rr.status === 401 || rr.status === 403) throw new Error('Phiên gqtthc đã hết hạn, hãy đăng nhập lại rồi bấm lại.');
          if (!rr.ok) throw new Error('HTTP ' + rr.status);
          rows[i].coQuan = String(pick(await rr.json())).slice(0, 200);
        } catch (e2) {
          if (/hết hạn/.test(String(e2 && e2.message))) throw e2;
          miss++;
        }
        done++;
        if (done % 3 === 0 || done === rows.length) say('Đang lấy đơn vị đảng bộ xã, phường: ' + done + '/' + rows.length + '…');
      }
    };
    say('Đang lấy đơn vị đảng bộ xã, phường của ' + rows.length + ' hồ sơ…');
    await Promise.all([worker(), worker(), worker(), worker()]);
    var syncId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    say('Đang gửi ' + rows.length + ' hồ sơ lên Google Sheet…');
    await fetch(API, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify({ type: 'hoso', token: pw, syncId: syncId, rows: rows }) }) });
    var ok = null;
    for (var k = 0; k < 12 && !ok; k++) {
      ok = await new Promise(function (res) {
        var cb = '__hscx' + Date.now() + k, s = document.createElement('script');
        var t = setTimeout(function () { delete window[cb]; s.remove(); res(null); }, 9000);
        window[cb] = function (v) { clearTimeout(t); delete window[cb]; s.remove(); res(v); };
        s.onerror = function () { clearTimeout(t); res(null); };
        s.src = API + '?action=hoso_status&callback=' + cb + '&_=' + Date.now();
        document.head.appendChild(s);
      });
      if (ok && ok.lastError && ok.lastError.syncId === syncId) throw new Error(ok.lastError.error);
      if (!(ok && ok.last && ok.last.syncId === syncId)) { ok = null; await new Promise(function (r2) { setTimeout(r2, 1000); }); }
    }
    try { localStorage.setItem('hscx.token', pw); } catch (e) {}
    say(ok ? '✅ Đã đồng bộ ' + ok.last.rowCount + ' hồ sơ chờ xử lý lúc ' + ok.last.updatedAtText + '.' + (miss ? '\n⚠ ' + miss + ' hồ sơ chưa lấy được đơn vị xã, phường.' : '')
           : '✓ Đã gửi ' + rows.length + ' hồ sơ. Chưa xác nhận được kết quả, hãy mở lại cửa sổ Hồ sơ chờ xử lý trên trang quản trị để kiểm tra.');
    setTimeout(function () { box.remove(); }, 20000);
  } catch (e) {
    if (/mật khẩu|token|không hợp lệ/i.test(String(e && e.message))) { try { localStorage.removeItem('hscx.token'); } catch (x) {} }
    say('✕ ' + (e && e.message || e), true);
    setTimeout(function () { box.remove(); }, 15000);
  }
}

  function getApi() {
    var v = '';
    try { v = (localStorage.getItem('hscx.api') || '').trim(); } catch (e) {}
    return v;
  }
  function askApi() {
    var v = (prompt('Dán URL Apps Script của dự án Hồ sơ chờ xử lý (kết thúc bằng /exec):', getApi()) || '').trim();
    var m = v.match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/);
    if (!m) { if (v) alert('Địa chỉ chưa đúng: cần URL Ứng dụng web kết thúc bằng /exec.'); return ''; }
    try { localStorage.setItem('hscx.api', m[0]); } catch (e) {}
    return m[0];
  }
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '📥 Hồ sơ chờ xử lý';
  btn.title = 'Bấm: lấy hồ sơ chờ xử lý lên Google Sheet · Nhấn giữ 1 giây: đổi địa chỉ Apps Script';
  btn.style.cssText = 'position:fixed;left:14px;bottom:70px;z-index:2147483646;padding:10px 14px;border:0;border-radius:999px;background:#c51620;color:#fff;font:700 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer';
  var timer = null, long = false;
  btn.addEventListener('pointerdown', function () { long = false; timer = setTimeout(function () { long = true; askApi(); }, 1000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, function () { clearTimeout(timer); }); });
  btn.addEventListener('click', function () {
    if (long) { long = false; return; }
    var api = getApi() || askApi();
    if (api) hscxRun(api);
  });
  document.body.appendChild(btn);
})();
