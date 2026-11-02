// ==UserScript==
// @name         ĐP Tỉnh Lào Cai – đồng bộ đảng phí từ gqtthc
// @namespace    laocai-cds
// @version      1.1
// @description  Thêm nút nổi "ĐP Tỉnh Lào Cai" trên gqtthc.dcs.vn: lấy số liệu đảng phí (kèm sổ S02: phải nộp, đã nộp, còn nợ cấp trên) qua API và gửi lên Google Sheet của site TTHC.
// @match        https://gqtthc.dcs.vn/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__dpLaoCaiLoaded) return;
  window.__dpLaoCaiLoaded = true;

  const K_API = 'dangphi.api';      // URL Apps Script …/exec (lưu trên gqtthc.dcs.vn)
  const K_PW = 'dangphi.token';     // mật khẩu đồng bộ (dùng chung với dấu trang)

  function normApi(v) {
    v = (v || '').trim();
    if (/^AKfy[\w-]{20,}$/.test(v)) return 'https://script.google.com/macros/s/' + v + '/exec';
    const m = v.match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/);
    return m ? m[0] : '';
  }
  function askApi() {
    const v = normApi(prompt('Dán URL Apps Script của site TTHC (dạng https://script.google.com/macros/s/AKfy…/exec) hoặc cả mã dấu trang:') || '');
    if (!v) { alert('Link chưa đúng.'); return ''; }
    try { localStorage.setItem(K_API, v); } catch (e) {}
    return v;
  }

  async function run(API) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;top:14px;right:14px;left:14px;max-width:360px;margin-left:auto;padding:12px 16px;border-radius:12px;background:#12315f;color:#fff;font:600 14px/1.45 system-ui,sans-serif;white-space:pre-line;box-shadow:0 8px 28px rgba(0,0,0,.35)';
    const T0 = performance.now();
    let curMsg = '', curBad = false, curOk = false, tick = null;
    const f1 = ms => (ms / 1000).toFixed(1).replace('.', ',') + 's';
    const paint = () => { box.textContent = curMsg + (tick ? '   ⏱ ' + f1(performance.now() - T0) : ''); box.style.background = curBad ? '#a50d26' : curOk ? '#0f8a3c' : '#12315f'; if (!box.parentNode) document.body.appendChild(box); };
    const say = (m, bad, runT, good) => { curMsg = m; curBad = !!bad; curOk = !!good; if (runT) { if (!tick) tick = setInterval(paint, 100); } else if (tick) { clearInterval(tick); tick = null; } paint(); };
    try {
      const tk = localStorage.getItem('token');
      if (!tk) { alert('Chưa đăng nhập gqtthc.dcs.vn.'); return; }
      let pw = localStorage.getItem(K_PW) || '';
      if (!pw) { pw = (prompt('Mật khẩu đồng bộ đảng phí:') || '').trim(); if (!pw) return; }

      const now0 = new Date();
      const PK = await new Promise(res => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,sans-serif';
        let o = '';
        for (let i = 0; i < 12; i++) { const dd = new Date(now0.getFullYear(), now0.getMonth() - i, 1), y = dd.getFullYear(), m = dd.getMonth() + 1; o += '<option value="' + y + '-' + m + '"' + (i ? '' : ' selected') + '>Tháng ' + m + '/' + y + (i ? '' : ' (hiện tại)') + '</option>'; }
        ov.innerHTML = '<div style="background:#fff;color:#12315f;padding:20px 24px;border-radius:12px;width:min(320px,86vw);box-shadow:0 8px 28px rgba(0,0,0,.35)"><div style="font-weight:700;font-size:16px">Lấy số liệu đảng phí</div><div style="font-size:13px;color:#555;margin-top:2px">Đảng bộ tỉnh Lào Cai</div><select style="width:100%;margin:14px 0;padding:10px;font-size:16px;border:1px solid #bbb;border-radius:8px">' + o + '</select><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-x style="padding:10px 16px;border:1px solid #bbb;background:#fff;border-radius:8px;font-size:15px">Hủy</button><button type="button" data-ok style="padding:10px 18px;border:0;background:#b3261e;color:#fff;font-weight:700;border-radius:8px;font-size:15px">Lấy dữ liệu</button></div></div>';
        const sel = ov.querySelector('select'), done = v => { ov.remove(); res(v); };
        ov.querySelector('[data-x]').onclick = () => done(0);
        ov.querySelector('[data-ok]').onclick = () => done(sel.value);
        ov.onclick = e => { if (e.target === ov) done(0); };
        document.body.appendChild(ov);
      });
      if (!PK) return;
      const cy = +PK.split('-')[0], SM = +PK.split('-')[1];
      if (navigator.onLine === false) throw new Error('Máy đang mất kết nối mạng. Kiểm tra mạng rồi bấm lại.');
      say('Đang lấy số liệu tháng ' + SM + '/' + cy + ' từ API…', false, true);
      try { fetch(API + '?action=status&warm=' + Date.now(), { mode: 'no-cors' }).catch(() => {}); } catch (e) {}
      const tA = performance.now();
      const d = new Date(), p2 = n => String(n).padStart(2, '0'), mm = p2(SM), yy = cy;
      const body = { kyNopStart: '01/' + mm + '/' + yy, kyNopEnd: new Date(yy, SM, 0).getDate() + '/' + mm + '/' + yy, parentId: 2122408, hasChildren: true, page: 1, size: 500 };
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 30000);
      const r = await fetch('https://gateway-gqtthc.dcs.vn/report/dashboard/danh-sach-theo-doi-dang-phi', { signal: ac.signal, method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      clearTimeout(to);
      const tB = performance.now();
      if (!r.ok) throw new Error('API trả lỗi ' + r.status + (r.status === 401 ? ' — hãy đăng nhập lại.' : ''));
      const raw = await r.text();
      const tC = performance.now();
      const j = JSON.parse(raw);
      const list = j.data || [];
      if (!list.length) throw new Error('API không trả đơn vị nào.');
      const num = x => Number(x) || 0;
      const rows = list.map((x, i) => [i + 1, x.tenDonVi, num(x.tongSoLuongDangVien), num(x.soLuongDangVienChinhThuc), num(x.soLuongDangVienTamThoi), num(x.soLuongChuyenTamThoi), num(x.soLuongDangVienMienGiam), num(x.tongSoHoSoChuaDuyet), num(x.tongSoHoSoDaDuyetChuaNop), num(x.tongSoHoSoDaDuyetDaNop), num(x.soLuongHoSoChuaKhaiBao), num(x.tongSoTienDaKhaiBao), num(x.tongSoTienDaNop), num(x.mucDoThucHien)]);
      /* Sổ S02: phải nộp cấp trên, đã nộp cấp trên, còn nợ cấp trên cuối kỳ → 3 cột O:Q. Lỗi S02 không làm hỏng đồng bộ chính. */
      let s02Msg = '';
      try {
        say('Đang lấy sổ S02 (nộp cấp trên)…', false, true);
        const r2 = await fetch('https://gateway-gqtthc.dcs.vn/report/s02/danh-sach', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ page: 1, size: 500, donViId: null, fromDate: body.kyNopStart, toDate: body.kyNopEnd }) });
        if (!r2.ok) throw new Error('HTTP ' + r2.status);
        const j2 = await r2.json(), l2 = j2.data || [];
        const nm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const kr = o => num(o && o.kyBaoCao), mp = new Map(l2.map(x => [nm(x.tenToChucDang), x]));
        let hit = 0;
        rows.forEach(r => { const x = mp.get(nm(r[1])); if (x) { hit++; r.push(kr(x.dangPhiPhaiNopCapTren), kr(x.dangPhiDaNopCapTren), num(x.dangPhiChuaNopCapTrenCuoiKyBaoCao)); } else r.push(0, 0, 0); });
        s02Msg = '\nSổ S02: khớp ' + hit + '/' + rows.length + ' đơn vị';
      } catch (e2) { rows.forEach(r => { r.length = 14; }); s02Msg = '\n⚠ Chưa lấy được sổ S02 (' + (e2 && e2.message || e2) + ') — các cột nộp cấp trên giữ nguyên.'; }
      const sum = k => rows.reduce((a, r) => a + r[k], 0);
      const declared = sum(11), paid = sum(12);
      const syncId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const payload = { token: pw, syncId, fileName: 'API gqtthc kỳ T' + SM + '/' + cy + ' · ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()), month: yy + '-' + mm, source: 'api-month',
        totals: { units: rows.length, members: sum(2), paidProfiles: sum(9), declared, paid, rate: declared > 0 ? Math.round(paid / declared * 10000) / 100 : 0 }, rows };
      say('Đang gửi ' + rows.length + ' đơn vị lên Google Sheet…', false, true);
      const tD = performance.now();
      await fetch(API, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify(payload) }) });
      const tE = performance.now();
      say('Đang xác nhận kết quả trên Google Sheet…', false, true);
      let ok = null;
      for (let k = 0; k < 12 && !ok; k++) {
        ok = await new Promise(res => {
          const cb = '__dpbm' + Date.now() + k, s = document.createElement('script');
          const t = setTimeout(() => { delete window[cb]; s.remove(); res(null); }, 9000);
          window[cb] = v => { clearTimeout(t); delete window[cb]; s.remove(); res(v); };
          s.onerror = () => { clearTimeout(t); res(null); };
          s.src = API + '?action=status&callback=' + cb + '&_=' + Date.now();
          document.head.appendChild(s);
        });
        if (ok && ok.lastError && ok.lastError.syncId === syncId) throw new Error(ok.lastError.error);
        if (!(ok && ok.last && ok.last.syncId === syncId)) { ok = null; await new Promise(r2 => setTimeout(r2, 1000)); }
      }
      const tF = performance.now();
      try { localStorage.setItem(K_PW, pw); } catch (e) {}
      const apiT = tC - tA, nc = navigator.connection || {};
      const speed = apiT < 2500 ? '🟢 Nhanh' : apiT < 6000 ? '🟡 Bình thường' : '🔴 Chậm';
      const detail = s02Msg + '\n⏱ Tổng ' + f1(tF - T0) + ' · Kết nối ' + speed + '\nAPI ' + f1(apiT) + ' (chờ ' + f1(tB - tA) + ', tải ' + Math.max(1, Math.round(raw.length / 1024)) + ' KB) · Gửi Sheet ' + f1(tE - tD) + ' · Xác nhận ' + f1(tF - tE) + (nc.effectiveType ? '\nMạng ' + nc.effectiveType + (nc.rtt ? ' · RTT ' + nc.rtt + 'ms' : '') : '');
      say((ok ? '✅ HOÀN THÀNH — đã đồng bộ ' + ok.last.rowCount + ' đơn vị kỳ tháng ' + SM + '/' + cy + (ok.last.tab ? ' (tab ' + ok.last.tab + ')' : '') + ' lúc ' + ok.last.updatedAtText + '.' : '✓ Đã gửi ' + rows.length + ' đơn vị. Chưa xác nhận được kết quả — hãy mở lại trang Đảng phí để xem “Lần đồng bộ gần nhất”.') + detail, false, false, !!ok);
      setTimeout(() => box.remove(), 25000);
    } catch (e) {
      if (/mật khẩu|token|không hợp lệ/i.test(String(e.message))) { try { localStorage.removeItem(K_PW); } catch (x) {} }
      say('✕ ' + (e && e.name === 'AbortError' ? 'API phản hồi quá chậm (quá 30 giây). Kiểm tra mạng rồi bấm lại.' : e.message) + '   (sau ' + f1(performance.now() - T0) + ')', true);
      setTimeout(() => box.remove(), 15000);
    }
  }

  // Nút nổi: bấm để đồng bộ; nút ⚙ để đổi URL Apps Script
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;z-index:2147483646;right:12px;bottom:84px;display:flex;gap:6px;align-items:center;font-family:system-ui,sans-serif';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'ĐP Tỉnh Lào Cai';
  btn.style.cssText = 'padding:12px 16px;border:0;border-radius:24px;background:#c8102e;color:#fff;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(0,0,0,.35)';
  const cfg = document.createElement('button');
  cfg.type = 'button';
  cfg.textContent = '⚙';
  cfg.title = 'Đổi URL Apps Script';
  cfg.style.cssText = 'width:40px;height:40px;border:0;border-radius:50%;background:#12315f;color:#fff;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,.35)';
  btn.onclick = () => {
    let api = '';
    try { api = localStorage.getItem(K_API) || ''; } catch (e) {}
    if (!api) api = askApi();
    if (api) run(api);
  };
  cfg.onclick = () => { askApi(); };
  wrap.append(btn, cfg);
  document.body.appendChild(wrap);
})();
