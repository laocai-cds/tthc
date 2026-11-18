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
      const now = new Date(), per = '01/' + now.getFullYear(), den = p2(now.getMonth() + 1) + '/' + now.getFullYear();
      /* Cách 1 (nhanh): hỏi cả tỉnh một lần, 3 thủ tục song song, có yêu cầu dự phòng sau 15s.
         Cách 2 (khi máy chủ báo 504 vì tháng hiện tại quá nhiều hồ sơ): chia nhỏ — các tháng trước hỏi từng tháng; tháng hiện tại hỏi từng đơn vị (nhiều luồng) rồi cộng lại. */
      const dropped = {};
      const st = { 10001: '⏳', 10002: '⏳', 10003: '⏳' };
      const show = () => say('Đang lấy số liệu 03 thủ tục (chạy song song)\n' + [10002, 10003, 10001].map(id => st[id] + ' ' + NAMES[id]).join('\n'));
      const call = (id, body, ac) => fetch(G3, { signal: ac && ac.signal, method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ dvcId: id, coQuanId: 2122408, page: 0, size: 300 }, body)) })
        .then(rr => { if (!rr.ok) throw new Error('HTTP ' + rr.status); return rr.json(); })
        .then(jj => { const seen = {}; return ((jj.data && jj.data.data) || []).filter(x => { const n = String(x.coQuanTen || '').trim(); if (Number(x.coQuanId) === 2122408 || !/^đảng bộ\s/i.test(n) || seen[n.toLowerCase()]) { dropped[n || '(trống)'] = 1; return false; } seen[n.toLowerCase()] = 1; return true; }).map(x => [x.coQuanTen, num(x.dangXuLy), num(x.daTuChoi), num(x.daXuLyXong), x.coQuanId, x.coCapCon === false ? 0 : 1]); });
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
        const acc = {}; base.forEach(r => { acc[r[4]] = [r[0], 0, 0, 0, r[4], r[5]]; });
        prevRes.forEach(rows => rows.forEach(r => { const a = acc[r[4]]; if (a) { a[1] += r[1]; a[2] += r[2]; a[3] += r[3]; } }));
        const ids = Object.keys(acc); let next = 0, doneN = 0;
        const worker = async () => { while (next < ids.length) { const u = ids[next++]; const rows = await retry(() => call(id, { coQuanId: Number(u), tuThang: mk(cm), denThang: mk(cm) }), 4); const r = rows.find(x => String(x[4]) === u) || rows[0]; if (r) { acc[u][1] += r[1]; acc[u][2] += r[2]; acc[u][3] += r[3]; } doneN++; st[id] = '⏳ (chia nhỏ ' + doneN + '/' + ids.length + ')'; } };
        await Promise.all(Array.from({ length: 12 }, worker));
        return ids.map(u => acc[u]);
      };
      /* Nhận xét nơi cư trú: số của một Đảng bộ phải gồm cả các đơn vị con (chi bộ, đảng bộ cơ sở…), nhiều cấp. API trả dòng của đơn vị cha không gộp con → hỏi từng đơn vị rồi cộng. */
      let kidFail = 0, kidSkip = 0, kidCached = 0;
      const raw = (uid, a, b) => fetch(G3, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ dvcId: 10001, coQuanId: uid, page: 0, size: 300, tuThang: a, denThang: b }) })
        .then(rr => { if (!rr.ok) throw new Error('HTTP ' + rr.status); return rr.json(); }).then(jj => (jj.data && jj.data.data) || []);
      const walk = async (uid, seen, acc, depth, a, b) => {
        const rows = await retry(() => raw(uid, a, b), 5);
        rows.forEach(r => { if (seen[r.coQuanId]) return; seen[r.coQuanId] = 1; acc[0] += num(r.dangXuLy); acc[1] += num(r.daTuChoi); acc[2] += num(r.daXuLyXong); });
        if (depth < 5) for (const r of rows) if (r.coCapCon && Number(r.coQuanId) !== Number(uid) && !seen['x' + r.coQuanId]) { seen['x' + r.coQuanId] = 1; await walk(r.coQuanId, seen, acc, depth + 1, a, b); }
      };
      /* Nhanh hơn: (1) đơn vị không có đơn vị con dùng luôn số lần hỏi đầu; (2) các tháng đã qua (01..tháng trước) nhớ trong trình duyệt, lần sau chỉ hỏi tháng hiện tại; (3) 20 luồng song song. */
      const kids = async rows => {
        const y = now.getFullYear(), cm = now.getMonth() + 1, mk = m => p2(m) + '/' + y;
        const pk = 'tthc03.past.' + y + '.' + (cm - 1); let past = {};
        if (cm > 1) { try { const c = JSON.parse(localStorage.getItem(pk) || 'null'); if (c && c.t && Date.now() - c.t < 864e5) past = c.d || {}; } catch (e) { past = {}; } }
        const pastNew = {}, out = rows.map(r => r.slice()); let next = 0, doneN = 0;
        const worker = async () => { while (next < out.length) { const r = out[next++];
          if (r[5] === 0) kidSkip++;
          else try {
            const tot = [0, 0, 0];
            if (cm > 1) { let p = past[r[4]]; if (p) kidCached++; else { p = [0, 0, 0]; await walk(r[4], {}, p, 0, per, mk(cm - 1)); pastNew[r[4]] = p; } tot[0] += p[0]; tot[1] += p[1]; tot[2] += p[2]; }
            await walk(r[4], {}, tot, 0, mk(cm), mk(cm));
            r[1] = tot[0]; r[2] = tot[1]; r[3] = tot[2];
          } catch (e) { kidFail++; }
          doneN++; st[10001] = '⏳ (cộng đơn vị con ' + doneN + '/' + out.length + ')'; } };
        await Promise.all(Array.from({ length: 20 }, worker));
        if (cm > 1 && Object.keys(pastNew).length) { try { localStorage.setItem(pk, JSON.stringify({ t: Date.now(), d: Object.assign(past, pastNew) })); } catch (e) {} }
        if (kidFail > out.length / 4) throw new Error('lấy đơn vị con lỗi ' + kidFail + '/' + out.length + ' đơn vị');
        return out;
      };
      const errs = {};
      const get = async id => { try { let rows; try { rows = await fast(id); } catch (e1) { rows = await split(id); } if (id === 10001) rows = await kids(rows); st[id] = '✓'; show(); return rows; } catch (e2) { st[id] = '✕'; errs[id] = String(e2 && e2.message || e2).slice(0, 160); show(); return null; } };
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
      try { if (ok.last03.ok !== false) localStorage.setItem(K_03, code); } catch (e) {}
      const L = ok.last03; Object.keys(L.tabs || {}).forEach(id => { const t = L.tabs[id]; if (t && t.ok === undefined) t.ok = !t.error && (t.hit || 0) > 0; if (t && t.total === undefined) t.total = (t.hit || 0) + (t.miss || 0); }); const line = id => { const t = (L.tabs || {})[id]; return t ? (t.ok ? '✅ ' + NAMES[id] + ': ' + t.hit + '/' + t.total + ' đơn vị' + (t.miss ? ' (không khớp ' + t.miss + ')' : '') : '❌ ' + NAMES[id] + ': ' + t.error) : '❔ ' + NAMES[id] + ': chưa rõ'; };
      const nOk = [10002, 10003, 10001].filter(id => (L.tabs || {})[id] && L.tabs[id].ok).length;
      const head = nOk === 3 ? '✅ HOÀN THÀNH 03 thủ tục — đã thay số cũ bằng số mới' : nOk === 0 ? '❌ THẤT BẠI — chưa cập nhật thủ tục nào' : '⚠ XONG MỘT PHẦN (' + nOk + '/3 thủ tục) — bấm lại để thử các thủ tục còn lỗi';
      say(head + '\n' + [10002, 10003, 10001].map(line).join('\n') + (kidFail ? '\n⚠ ' + kidFail + ' đơn vị chưa lấy được số của đơn vị con (nhận xét) – chạy lại' : '') + (Object.keys(dropped).length ? '\nĐã bỏ ' + Object.keys(dropped).length + ' dòng không phải đơn vị (chi bộ, cơ quan tỉnh…)' : '') + '\nLúc ' + L.at + ' · ' + f1(performance.now() - T0) + ' · chi tiết xem tab NHAT KY', nOk === 3 ? 'ok' : 'bad');
      setTimeout(() => box.remove(), nOk === 3 ? 25000 : 40000);
    } catch (e) { say('✕ ' + (e && e.message || e), 'bad'); setTimeout(() => box.remove(), 20000); }
  })();
})();
