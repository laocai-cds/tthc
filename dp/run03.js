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
      let saved = ''; try { saved = localStorage.getItem(K_03) || ''; } catch (e) {}
      const code = (prompt('Đồng bộ 03 thủ tục – mã truy cập chung' + (saved ? ' (đã nhớ, bấm OK để dùng):' : ':'), saved) || '').trim();
      if (!code) { say('Đã hủy: chưa nhập mã truy cập.', 'bad'); setTimeout(() => box.remove(), 6000); return; }
      const tk = localStorage.getItem('token');
      if (!tk) { alert('Chưa đăng nhập gqtthc.dcs.vn.'); return; }
      /* Lấy số liệu THEO TỪNG THÁNG (từ tháng bắt đầu có hồ sơ). Tháng đã qua nhớ trong trình duyệt 24 giờ; tổng lũy kế = cộng các tháng.
         Nhận xét nơi cư trú: mỗi đơn vị cộng cả đơn vị con (nhiều cấp); đơn vị không có con dùng luôn số lần hỏi đầu. */
      const now = new Date(), y = now.getFullYear(), cm = now.getMonth() + 1, first = y === 2026 ? 10 : 1;
      const months = []; for (let m = first; m <= cm; m++) months.push(p2(m) + '/' + y);
      const per = months[0], den = months[months.length - 1], curMo = p2(cm) + '/' + y;
      const dropped = {};
      const st = { 10001: '⏳', 10002: '⏳', 10003: '⏳' };
      const show = () => say('Đang lấy số liệu 03 thủ tục theo tháng (' + per + ' → ' + den + ')\n' + [10002, 10003, 10001].map(id => st[id] + ' ' + NAMES[id]).join('\n'));
      const retry = async (fn, n) => { let le; for (let a = 0; a < n; a++) { try { return await fn(); } catch (e) { le = e; await new Promise(r => setTimeout(r, 600)); } } throw le; };
      const cget = k => { try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c && c.t && Date.now() - c.t < 864e5) return c.d; } catch (e) {} return null; };
      const cset = (k, d) => { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} };
      const post = (id, uid, mo) => fetch(G3, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ dvcId: id, coQuanId: uid, page: 0, size: 300, tuThang: mo, denThang: mo }) })
        .then(rr => { if (!rr.ok) throw new Error('HTTP ' + rr.status); return rr.json(); }).then(jj => (jj.data && jj.data.data) || []);
      const topRows = (id, mo) => post(id, 2122408, mo).then(list => { const seen = {}; const rows = list.filter(x => { const n = String(x.coQuanTen || '').trim(); if (Number(x.coQuanId) === 2122408 || !/^đảng bộ\s/i.test(n) || seen[n.toLowerCase()]) { dropped[n || '(trống)'] = 1; return false; } seen[n.toLowerCase()] = 1; return true; }).map(x => [x.coQuanTen, num(x.dangXuLy), num(x.daTuChoi), num(x.daXuLyXong), x.coQuanId, x.coCapCon === false ? 0 : 1]); if (rows.length < 50) throw new Error('trả thiếu đơn vị (' + rows.length + ') tháng ' + mo); return rows; });
      const monthTop = async (id, mo) => { const k = 'tthc03.m.' + id + '.' + mo; if (mo !== curMo) { const c = cget(k); if (c) return c; } const rows = await retry(() => topRows(id, mo), 4); if (mo !== curMo) cset(k, rows); return rows; };
      let kidFail = 0;
      const walk = async (uid, seen, acc, depth, mo) => {
        const rows = await retry(() => post(10001, uid, mo), 5);
        rows.forEach(r => { if (seen[r.coQuanId]) return; seen[r.coQuanId] = 1; acc[0] += num(r.dangXuLy); acc[1] += num(r.daTuChoi); acc[2] += num(r.daXuLyXong); });
        if (depth < 5) for (const r of rows) if (r.coCapCon && Number(r.coQuanId) !== Number(uid) && !seen['x' + r.coQuanId]) { seen['x' + r.coQuanId] = 1; await walk(r.coQuanId, seen, acc, depth + 1, mo); }
      };
      const kidsMonth = async (rows, mo, prog) => {
        const k = 'tthc03.k.' + mo, memo = mo !== curMo ? (cget(k) || {}) : {}, added = {}, out = rows.map(r => r.slice()); let next = 0;
        const worker = async () => { while (next < out.length) { const r = out[next++];
          if (r[5] !== 0) {
            if (memo[r[4]]) { r[1] = memo[r[4]][0]; r[2] = memo[r[4]][1]; r[3] = memo[r[4]][2]; }
            else try { const acc = [0, 0, 0]; await walk(r[4], {}, acc, 0, mo); r[1] = acc[0]; r[2] = acc[1]; r[3] = acc[2]; added[r[4]] = acc; } catch (e) { kidFail++; }
          } prog(); } };
        await Promise.all(Array.from({ length: 20 }, worker));
        if (mo !== curMo && Object.keys(added).length) cset(k, Object.assign(memo, added));
        return out;
      };
      const errs = {}, byMonth = { 10001: {}, 10002: {}, 10003: {} };
      const get = async id => { try {
        let done = 0;
        await Promise.all(months.map(async mo => {
          let rows = await monthTop(id, mo);
          if (id === 10001) rows = await kidsMonth(rows, mo, () => { st[id] = '⏳ (cộng đơn vị con)'; });
          byMonth[id][mo] = rows; done++; st[id] = '⏳ (' + done + '/' + months.length + ' tháng)'; show();
        }));
        if (id === 10001 && kidFail > 25) throw new Error('lấy đơn vị con lỗi ' + kidFail + ' lượt');
        st[id] = '✓'; show(); return true;
      } catch (e2) { st[id] = '✕'; errs[id] = String(e2 && e2.message || e2).slice(0, 160); show(); return null; } };
      const ti = setInterval(show, 1500);
      show();
      const ids = [10002, 10003, 10001];
      let got; try { got = await Promise.all(ids.map(id => get(id))); } finally { clearInterval(ti); }
      const t03 = {}, m03 = {};
      ids.forEach((id, k) => { if (!got[k]) return;
        const acc = {}; months.forEach(mo => (byMonth[id][mo] || []).forEach(r => { const a = acc[r[4]] || (acc[r[4]] = [r[0], 0, 0, 0]); a[0] = r[0]; a[1] += r[1]; a[2] += r[2]; a[3] += r[3]; }));
        t03[id] = Object.keys(acc).map(u => acc[u]);
        m03[id] = {}; months.forEach(mo => { m03[id][mo] = (byMonth[id][mo] || []).map(r => [r[0], r[1], r[2], r[3]]); });
      });
      say('Đang ghi lên Google Sheet…');
      const sync = 's3' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await fetch(API03, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ payload: JSON.stringify({ action: 'tthc03', accessCode: code, syncId: sync, period: per + ' - ' + den, tthc03: t03, months03: m03, errors: errs }) }) });
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
      try { if (ok.last03.ok !== false) localStorage.setItem(K_03, code); } catch (e) {}
      const L = ok.last03; Object.keys(L.tabs || {}).forEach(id => { const t = L.tabs[id]; if (t && t.ok === undefined) t.ok = !t.error && (t.hit || 0) > 0; if (t && t.total === undefined) t.total = (t.hit || 0) + (t.miss || 0); }); const line = id => { const t = (L.tabs || {})[id]; return t ? (t.ok ? '✅ ' + NAMES[id] + ': ' + t.hit + '/' + t.total + ' đơn vị' + (t.miss ? ' (không khớp ' + t.miss + ')' : '') : '❌ ' + NAMES[id] + ': ' + t.error) : '❔ ' + NAMES[id] + ': chưa rõ'; };
      const nOk = [10002, 10003, 10001].filter(id => (L.tabs || {})[id] && L.tabs[id].ok).length;
      const head = nOk === 3 ? '✅ HOÀN THÀNH 03 thủ tục — đã thay số cũ bằng số mới' : nOk === 0 ? '❌ THẤT BẠI — chưa cập nhật thủ tục nào' : '⚠ XONG MỘT PHẦN (' + nOk + '/3 thủ tục) — bấm lại để thử các thủ tục còn lỗi';
      say(head + '\n' + [10002, 10003, 10001].map(line).join('\n') + (Object.keys(dropped).length ? '\nĐã bỏ ' + Object.keys(dropped).length + ' dòng không phải đơn vị (chi bộ, cơ quan tỉnh…)' : '') + '\nLúc ' + L.at + ' · ' + f1(performance.now() - T0) + ' · chi tiết xem tab NHAT KY', nOk === 3 ? 'ok' : 'bad');
      setTimeout(() => box.remove(), nOk === 3 ? 25000 : 40000);
    } catch (e) { say('✕ ' + (e && e.message || e), 'bad'); setTimeout(() => box.remove(), 20000); }
  })();
})();
