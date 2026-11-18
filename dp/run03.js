(function(){'use strict';
  /* Nút "03" – đồng bộ số liệu 03 thủ tục (chuyển SH chính thức, tạm thời, nhận xét nơi cư trú) của 103 đơn vị từ gqtthc.dcs.vn
     vào Google Sheet "Theo dõi 03 thủ tục" qua Apps Script dự án "03 thủ tục". Số mới ghi đè số cũ. Chạy trên trang gqtthc.dcs.vn. */
  const K_03 = 'tthc03.code';
  const API03 = 'https://script.google.com/macros/s/AKfycbym3FHqtE20kg8F3SCuc6LizXSwGhSFT-KBY90c58BuOuRigFbOdyruPkTx4uBscZ-ibw/exec';
  const G3 = 'https://gateway-gqtthc.dcs.vn/report/api/v1/thong-ke-ho-so/theo-co-quan';
  const NAMES = { 10001: 'Nhận xét nơi cư trú', 10002: 'Chuyển SH chính thức', 10003: 'Chuyển SH tạm thời' };
  const num = x => Number(x) || 0, p2 = n => String(n).padStart(2, '0');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:14px;right:14px;left:14px;max-width:380px;margin-left:auto;padding:12px 16px;border-radius:12px;background:#12315f;color:#fff;font:600 14px/1.45 system-ui,sans-serif;white-space:pre-line;box-shadow:0 8px 28px rgba(0,0,0,.35)';
  const T0 = performance.now(); let tick = null, msg = '', bg = '#12315f';
  const f1 = ms => (ms / 1000).toFixed(0) + 's';
  const paint = () => { box.textContent = msg + (tick ? '   ⏱ ' + f1(performance.now() - T0) : ''); box.style.background = bg; if (!box.parentNode) document.body.appendChild(box); };
  const say = (m, kind) => { msg = m; bg = kind === 'bad' ? '#a50d26' : kind === 'ok' ? '#0f8a3c' : '#12315f'; if (kind) { if (tick) { clearInterval(tick); tick = null; } } else if (!tick) tick = setInterval(paint, 500); paint(); };
  (async function () {
    try {
      const tk = localStorage.getItem('token');
      if (!tk) { alert('Chưa đăng nhập gqtthc.dcs.vn.'); return; }
      const now = new Date(), per = '01/' + now.getFullYear(), den = p2(now.getMonth() + 1) + '/' + now.getFullYear();
      const get = async id => {
        let last;
        for (let at = 1; at <= 3; at++) {
          const ac = new AbortController(), to = setTimeout(() => ac.abort(), 120000);
          try {
            say('Đang lấy số liệu: ' + NAMES[id] + (at > 1 ? ' (thử lần ' + at + ')' : '') + '…');
            const rr = await fetch(G3, { signal: ac.signal, method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ tuThang: per, denThang: den, dvcId: id, coQuanId: 2122408, page: 0, size: 300 }) });
            clearTimeout(to);
            if (!rr.ok) throw new Error('HTTP ' + rr.status);
            const jj = await rr.json(), rows = ((jj.data && jj.data.data) || []).map(x => [x.coQuanTen, num(x.dangXuLy), num(x.daTuChoi), num(x.daXuLyXong)]);
            if (rows.length < 50) throw new Error('trả thiếu đơn vị (' + rows.length + ')');
            return rows;
          } catch (e) { clearTimeout(to); last = e; await new Promise(r => setTimeout(r, 2000)); }
        }
        throw new Error(NAMES[id] + ': ' + (last && last.name === 'AbortError' ? 'máy chủ gqtthc phản hồi quá chậm' : (last && last.message || last)) + '. Bấm lại sau ít phút.');
      };
      const t03 = {};
      for (const id of [10002, 10003, 10001]) t03[id] = await get(id);   /* lần lượt từng thủ tục để máy chủ đỡ quá tải */
      let code = ''; try { code = localStorage.getItem(K_03) || ''; } catch (e) {}
      if (!code) { code = (prompt('Mã truy cập chung để ghi số liệu 03 thủ tục lên Google Sheet:') || '').trim(); if (!code) { say('Đã hủy: chưa nhập mã truy cập.', 'bad'); setTimeout(() => box.remove(), 8000); return; } }
      say('Đang ghi lên Google Sheet…');
      const sync = 's3' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await fetch(API03, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify({ action: 'tthc03', accessCode: code, syncId: sync, period: per + ' - ' + den, tthc03: t03 }) }) });
      let ok = null;
      for (let k = 0; k < 30 && !ok; k++) {
        ok = await new Promise(res => {
          const cb = '__dp03' + Date.now() + k, s = document.createElement('script');
          const t = setTimeout(() => { delete window[cb]; s.remove(); res(null); }, 9000);
          window[cb] = v => { clearTimeout(t); delete window[cb]; s.remove(); res(v); };
          s.onerror = () => { clearTimeout(t); res(null); };
          s.src = API03 + '?action=tthc03_status&callback=' + cb + '&_=' + Date.now();
          document.head.appendChild(s);
        });
        if (ok && ok.last03 && ok.last03.syncId === sync && ok.last03.ok === false) { try { localStorage.removeItem(K_03); } catch (e) {} throw new Error(ok.last03.error); }
        if (!(ok && ok.last03 && ok.last03.syncId === sync)) { ok = null; await new Promise(r => setTimeout(r, 1500)); }
      }
      if (!ok) { say('✓ Đã gửi, chưa xác nhận được. Kiểm tra Sheet "Theo dõi 03 thủ tục" (cần triển khai Apps Script bản mới).', 'bad'); setTimeout(() => box.remove(), 20000); return; }
      const h = id => (ok.last03.tabs[id] || {}).hit || 0;
      say('✅ HOÀN THÀNH 03 thủ tục — đã thay số liệu cũ bằng số mới\nChính thức ' + h(10002) + ' · Tạm thời ' + h(10003) + ' · Nhận xét ' + h(10001) + ' đơn vị\nLúc ' + ok.last03.at + ' · ' + f1(performance.now() - T0), 'ok');
      setTimeout(() => box.remove(), 25000);
    } catch (e) { say('✕ ' + (e && e.message || e), 'bad'); setTimeout(() => box.remove(), 20000); }
  })();
})();
