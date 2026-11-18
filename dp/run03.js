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
      /* Luôn hỏi mã ngay khi bấm (không lưu), nhập xong chạy một mạch đến khi hoàn thành. */
      const code = (prompt('Đồng bộ 03 thủ tục – nhập mã truy cập chung:') || '').trim();
      if (!code) { say('Đã hủy: chưa nhập mã truy cập.', 'bad'); setTimeout(() => box.remove(), 6000); return; }
      const tk = localStorage.getItem('token');
      if (!tk) { alert('Chưa đăng nhập gqtthc.dcs.vn.'); return; }
      const now = new Date(), per = '01/' + now.getFullYear(), den = p2(now.getMonth() + 1) + '/' + now.getFullYear();
      /* Cách 1 (nhanh): hỏi cả tỉnh một lần, 3 thủ tục song song, có yêu cầu dự phòng sau 15s.
         Cách 2 (khi máy chủ báo 504 vì tháng hiện tại quá nhiều hồ sơ): chia nhỏ — các tháng trước hỏi từng tháng; tháng hiện tại hỏi từng đơn vị (nhiều luồng) rồi cộng lại. */
      const dropped = {};
      const st = { 10001: '⏳', 10002: '⏳', 10003: '⏳' };
      const show = () => say('Đang lấy số liệu 03 thủ tục (chạy song song)\n' + [10002, 10003, 10001].map(id => st[id] + ' ' + NAMES[id]).join('\n'));
      const call = (id, body, ac) => fetch(G3, { signal: ac && ac.signal, method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ dvcId: id, coQuanId: 2122408, page: 0, size: 300 }, body)) })
        .then(rr => { if (!rr.ok) throw new Error('HTTP ' + rr.status); return rr.json(); })
        .then(jj => { const seen = {}; return ((jj.data && jj.data.data) || []).filter(x => { const n = String(x.coQuanTen || '').trim(); if (Number(x.coQuanId) === 2122408 || !/^đảng bộ\s/i.test(n) || seen[n.toLowerCase()]) { dropped[n || '(trống)'] = 1; return false; } seen[n.toLowerCase()] = 1; return true; }).map(x => [x.coQuanTen, num(x.dangXuLy), num(x.daTuChoi), num(x.daXuLyXong), x.coQuanId]); });
      const retry = async (fn, n) => { let le; for (let a = 0; a < n; a++) { try { return await fn(); } catch (e) { le = e; await new Promise(r => setTimeout(r, 600)); } } throw le; };
      const fast = id => new Promise((resolve, reject) => {
        const acs = []; let launched = 0, failed = 0, done = false, timer = null, lastErr = null;
        const MAX = 3, HEDGE = 15000, HARD = 50000, t0 = Date.now();
        const finish = (fn, v) => { if (done) return; done = true; clearInterval(timer); acs.forEach(a => { try { a.abort(); } catch (e) {} }); fn(v); };
        const launch = () => {
          if (done || launched >= MAX) return; launched++;
          const ac = new AbortController(); acs.push(ac);
          call(id, { tuThang: per, denThang: den }, ac).then(rows => { if (rows.length < 50) throw new Error('trả thiếu đơn vị (' + rows.length + ')'); finish(resolve, rows); }, e => {
            if (done) return; lastErr = e; failed++;
            if (launched < MAX) launch(); else if (failed >= launched) finish(reject, lastErr);
          }).catch(e => finish(reject, e));
        };
        timer = setInterval(() => { const el = Date.now() - t0; if (el > HARD) finish(reject, new Error('quá chậm')); else if (el > HEDGE * launched) launch(); }, 1000);
        launch();
      });
      const split = async id => {
        const y = now.getFullYear(), cm = now.getMonth() + 1, mk = m => p2(m) + '/' + y;
        st[id] = '⏳ (chia nhỏ)'; show();
        const prev = [];
        for (let m = 1; m < cm; m++) prev.push(retry(() => call(id, { tuThang: mk(m), denThang: mk(m) }), 4));
        const prevRes = await Promise.all(prev);
        const base = prevRes[0] || await retry(() => call(id, { tuThang: mk(1), denThang: mk(1) }), 4);
        if (base.length < 50) throw new Error('trả thiếu đơn vị (' + base.length + ')');
        const acc = {}; base.forEach(r => { acc[r[4]] = [r[0], 0, 0, 0, r[4]]; });
        prevRes.forEach(rows => rows.forEach(r => { const a = acc[r[4]]; if (a) { a[1] += r[1]; a[2] += r[2]; a[3] += r[3]; } }));
        const ids = Object.keys(acc); let next = 0, doneN = 0;
        const worker = async () => { while (next < ids.length) { const u = ids[next++]; const rows = await retry(() => call(id, { coQuanId: Number(u), tuThang: mk(cm), denThang: mk(cm) }), 4); const r = rows.find(x => String(x[4]) === u) || rows[0]; if (r) { acc[u][1] += r[1]; acc[u][2] += r[2]; acc[u][3] += r[3]; } doneN++; st[id] = '⏳ (chia nhỏ ' + doneN + '/' + ids.length + ')'; } };
        await Promise.all(Array.from({ length: 12 }, worker));
        return ids.map(u => acc[u]);
      };
      const errs = {};
      const get = async id => { try { let rows; try { rows = await fast(id); } catch (e1) { rows = await split(id); } st[id] = '✓'; show(); return rows; } catch (e2) { st[id] = '✕'; errs[id] = String(e2 && e2.message || e2).slice(0, 160); show(); return null; } };
      const ti = setInterval(show, 1500);
      show();
      const ids = [10002, 10003, 10001];
      let got; try { got = await Promise.all(ids.map(id => get(id))); } finally { clearInterval(ti); }
      const t03 = {}; ids.forEach((id, k) => { if (got[k]) t03[id] = got[k].map(r => [r[0], r[1], r[2], r[3]]); });
      say('Đang ghi lên Google Sheet…');
      const sync = 's3' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await fetch(API03, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify({ action: 'tthc03', accessCode: code, syncId: sync, period: per + ' - ' + den, tthc03: t03, errors: errs }) }) });
      let ok = null;
      for (let k = 0; k < 45 && !ok; k++) {
        ok = await new Promise(res => {
          const cb = '__dp03' + Date.now() + k, s = document.createElement('script');
          const t = setTimeout(() => { delete window[cb]; s.remove(); res(null); }, 9000);
          window[cb] = v => { clearTimeout(t); delete window[cb]; s.remove(); res(v); };
          s.onerror = () => { clearTimeout(t); res(null); };
          s.src = API03 + '?action=tthc03_status&callback=' + cb + '&_=' + Date.now();
          document.head.appendChild(s);
        });
        if (ok && ok.last03 && ok.last03.syncId === sync && ok.last03.ok === false && /Mã truy cập/.test(ok.last03.error || '')) { try { localStorage.removeItem(K_03); } catch (e) {} throw new Error(ok.last03.error); }
        if (!(ok && ok.last03 && ok.last03.syncId === sync)) { ok = null; await new Promise(r => setTimeout(r, 800)); }
      }
      if (!ok) { say('✓ Đã gửi, chưa xác nhận được. Kiểm tra Sheet "Theo dõi 03 thủ tục" (cần triển khai Apps Script bản mới).', 'bad'); setTimeout(() => box.remove(), 20000); return; }
      const L = ok.last03, line = id => { const t = (L.tabs || {})[id]; return t ? (t.ok ? '✅ ' + NAMES[id] + ': ' + t.hit + '/' + t.total + ' đơn vị' + (t.miss ? ' (không khớp ' + t.miss + ')' : '') : '❌ ' + NAMES[id] + ': ' + t.error) : '❔ ' + NAMES[id] + ': chưa rõ'; };
      const nOk = [10002, 10003, 10001].filter(id => (L.tabs || {})[id] && L.tabs[id].ok).length;
      const head = nOk === 3 ? '✅ HOÀN THÀNH 03 thủ tục — đã thay số cũ bằng số mới' : nOk === 0 ? '❌ THẤT BẠI — chưa cập nhật thủ tục nào' : '⚠ XONG MỘT PHẦN (' + nOk + '/3 thủ tục) — bấm lại để thử các thủ tục còn lỗi';
      say(head + '\n' + [10002, 10003, 10001].map(line).join('\n') + (Object.keys(dropped).length ? '\nĐã bỏ khỏi danh sách (không phải đơn vị): ' + Object.keys(dropped).join('; ') : '') + '\nLúc ' + L.at + ' · ' + f1(performance.now() - T0) + ' · chi tiết xem tab NHAT KY', nOk === 3 ? 'ok' : 'bad');
      setTimeout(() => box.remove(), nOk === 3 ? 25000 : 40000);
    } catch (e) { say('✕ ' + (e && e.message || e), 'bad'); setTimeout(() => box.remove(), 20000); }
  })();
})();
