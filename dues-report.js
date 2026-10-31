/*
 * DuesReport – báo cáo thu nộp đảng phí theo THÁNG hoặc CẢ NĂM (nút "📄 Báo cáo" trong cửa sổ Bảng tổng hợp thu đảng phí).
 *
 * Nguồn: Google Sheet đảng phí (cùng bảng tính với dues-month.js), mỗi tháng một tab "Thang{M}" / "Thang{M}_{YYYY}".
 * Danh sách tháng lấy từ DuesMonth (tab "DANH MUC THANG"); chỉ tháng có số liệu mới được đưa vào báo cáo.
 * Mỗi tab tháng là số liệu của riêng kỳ nộp tháng đó, nên:
 *  - Thu trong tháng = tổng "Tiền đã nộp" của tab tháng;
 *  - Lũy kế = cộng các tháng từ tháng 1 đến tháng chọn (cùng năm).
 */
(function (root) {
  'use strict';

  const SHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';
  const HONOR = 0.95;

  /* ---------- Tiện ích ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fm = n => Math.round(Number(n) || 0).toLocaleString('vi-VN');
  const pc = v => (Math.round((Number(v) || 0) * 10000) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
  const keyOf = (y, m) => y + '-' + String(m).padStart(2, '0');
  const DM = () => root.DuesMonth;
  const cellNum = c => {
    if (!c) return 0;
    if (typeof c.v === 'number') return c.v;
    const s = String(c.f != null ? c.f : (c.v != null ? c.v : '')).replace(/[^\d-]/g, '');
    return s ? parseInt(s, 10) : 0;
  };
  const cellText = c => String(c ? (c.v != null ? c.v : (c.f != null ? c.f : '')) : '').trim();
  const shortName = n => String(n).replace(/^Đảng bộ (xã |phường )/, '');

  /* ---------- Đọc tab tháng (gviz) ---------- */
  function fetchTab(tab) {
    return new Promise((resolve, reject) => {
      const cb = '__duesReport_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = (err, p) => { if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove(); err ? reject(err) : resolve(p); };
      root[cb] = p => (p && p.table ? finish(null, p) : finish(new Error('no table')));
      const timer = setTimeout(() => finish(new Error('timeout')), 20000);
      sc.onerror = () => finish(new Error('network'));
      sc.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json;responseHandler:' + cb +
        '&sheet=' + encodeURIComponent(tab) + '&headers=2&_=' + Date.now();
      sc.async = true; document.head.appendChild(sc);
    });
  }
  function parseRows(p) {
    return ((p && p.table && p.table.rows) || []).map(r => r.c || [])
      .filter(c => /^\d+$/.test(cellText(c[0]).replace(/\.0$/, '')) && cellText(c[1]))
      .map(c => {
        const d = { name: cellText(c[1]), t: cellNum(c[2]), ct: cellNum(c[3]), tt: cellNum(c[4]), chuyen: cellNum(c[5]), mien: cellNum(c[6]), dn: cellNum(c[9]), chua: cellNum(c[10]), kb: cellNum(c[11]), nop: cellNum(c[12]) };
        d.need = Math.max(0, d.ct + d.tt - d.chuyen - d.mien);
        d.r = d.need > 0 ? Math.min(1, d.dn / d.need) : 0;
        return d;
      }).filter(d => d.t > 0);
  }
  const cache = new Map();                     // tab → Promise<rows>; tháng hiện tại luôn tải lại
  function monthRows(k) {
    const dm = DM();
    if (!dm || !dm.hasData(k)) return Promise.resolve(null);
    const tab = dm.sourceFor(k).spec.tab;
    if (!tab) return Promise.resolve(null);
    if (k !== dm.currentKey() && cache.has(tab)) return cache.get(tab);
    const pr = fetchTab(tab).then(parseRows).catch(() => null);
    if (k !== dm.currentKey()) cache.set(tab, pr);
    return pr;
  }
  function totals(rows) {
    const S = f => rows.reduce((a, x) => a + x[f], 0), need = S('need'), dn = S('dn');
    return { units: rows.length, t: S('t'), need, dn, chua: S('chua'), kb: S('kb'), nop: S('nop'), rate: need > 0 ? dn / need : 0 };
  }

  /* ---------- Khung báo cáo (giống báo cáo TTHC) ---------- */
  function shell(title, meta, body) {
    const d = new Date(), dateLine = 'Lào Cai, ngày ' + d.getDate() + ' tháng ' + (d.getMonth() + 1) + ' năm ' + d.getFullYear();
    return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      '@page{size:A4;margin:20mm 20mm 20mm 30mm}body{margin:0 auto;max-width:800px;padding:24px 30px;color:#000;background:#fff;font:13pt/1.35 "Times New Roman",Times,serif}' +
      '.hd{display:grid;grid-template-columns:38fr 53fr;text-align:center}.hd p{margin:0}.b14{font-weight:700;font-size:14pt}.b15{font-weight:700;font-size:15pt}.ln{width:200pt;margin:3pt auto 0;border-top:1px solid #000;height:9pt}' +
      '.t1{margin:22pt 0 1pt;text-align:center;font-weight:700;font-size:15pt}.t2{margin:0 0 1pt;text-align:center;font-weight:700}.meta{margin:0 0 8pt;text-align:center;font-style:italic;font-size:11pt;color:#4a5566}' +
      'h2{margin:10pt 0 4pt;font-size:13.5pt;color:#8f0b12;break-after:avoid;page-break-after:avoid}p.i{margin:0 0 4pt;text-indent:1cm;text-align:justify}' +
      '.cap{margin:6pt 0 3pt;font-weight:700;font-size:12pt;break-after:avoid;page-break-after:avoid}b.g{color:#8a5a00}b.w{color:#8a3b12}' +
      'table{border-collapse:collapse;width:100%;font-size:10pt;line-height:1.25;margin-bottom:8pt}th{background:#8f0b12;color:#fff;padding:2pt 3pt;border:.5pt solid #b8c0cc;font-size:9.5pt}' +
      'td{padding:1.5pt 3pt;border:.5pt solid #b8c0cc}tbody tr:nth-child(even) td{background:#f4f6fa}td.c{text-align:center}td.n{text-align:right}tr.tot td{font-weight:700;background:#fff4d6}tr{page-break-inside:avoid}thead{display:table-header-group}' +
      '.sign{display:grid;grid-template-columns:1fr 1fr;margin-top:10pt;page-break-inside:avoid}.sign u{font-size:14pt}.sign span{font-size:11pt}.sign .r{text-align:center}' +
      '</style></head><body>' +
      '<div class="hd"><div><p class="b14">TỈNH ỦY LÀO CAI</p><p>HỆ THỐNG THEO DÕI TTHC</p><p>*</p></div><div><p class="b15">ĐẢNG CỘNG SẢN VIỆT NAM</p><div class="ln"></div><p><i>' + esc(dateLine) + '</i></p></div></div>' +
      '<p class="t1">BÁO CÁO</p><p class="t2">' + esc(title) + '</p><p class="t2">-----</p><p class="meta">' + esc(meta) + '</p>' + body +
      '<div class="sign"><div><u>Nơi nhận:</u><br><span>- Thường trực Tỉnh ủy (b/c);<br>- Văn phòng Tỉnh ủy;<br>- Các đảng bộ, chi bộ trực thuộc;<br>- Lưu.</span></div><div class="r"><b>NGƯỜI LẬP BÁO CÁO</b></div></div></body></html>';
  }
  const tbl = (head, rows, cls) => '<table><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr' + (r.tot ? ' class="tot"' : '') + '>' + r.map((v, i) => '<td' + (cls[i] ? ' class="' + cls[i] + '"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';

  /* ---------- Báo cáo tháng ---------- */
  async function monthReport(k) {
    const y = +k.slice(0, 4), m = +k.slice(5);
    const rows = await monthRows(k);
    if (!rows || !rows.length) throw new Error('Chưa có số liệu đảng phí tháng ' + m + '/' + y + '.');
    const prev = [];
    for (let i = 1; i < m; i++) prev.push(monthRows(keyOf(y, i)));
    const prevRows = await Promise.all(prev);
    const T = totals(rows), cum = prevRows.reduce((a, r) => a + (r ? totals(r).nop : 0), 0) + T.nop;
    const sorted = rows.slice().sort((a, b) => b.r - a.r || b.nop - a.nop || a.name.localeCompare(b.name, 'vi'));
    const band = (lo, hi) => sorted.filter(x => x.r >= lo && x.r < hi);
    const honor = sorted.filter(x => x.r >= HONOR), zero = sorted.filter(x => x.r <= 0), weak = band(1e-9, .2);
    let body = '<h2>I. TÌNH HÌNH CHUNG</h2>' +
      '<p class="i">Theo số liệu đồng bộ từ hệ thống quản lý đảng phí (kỳ nộp tháng ' + m + '/' + y + '), ' + fm(T.units) + ' đảng bộ, chi bộ trực thuộc có tổng số ' + fm(T.t) +
      ' đảng viên; số đảng viên thuộc diện phải nộp đảng phí [(2)+(3)−(4)−(5)] là ' + fm(T.need) + ' đồng chí. Có ' + fm(T.dn) + ' đảng viên đã được duyệt hồ sơ và đã nộp đảng phí, đạt ' + pc(T.rate) +
      '; số tiền đã nộp trong kỳ ' + fm(T.nop) + ' đồng/' + fm(T.kb) + ' đồng theo hồ sơ đã khai báo; còn ' + fm(T.chua) + ' đảng viên chưa có hồ sơ.</p>' +
      '<p class="i">Lũy kế từ tháng 1 đến hết tháng ' + m + '/' + y + ', tổng số tiền đảng phí đã nộp là <b>' + fm(cum) + ' đồng</b>.</p>' +
      '<p class="i">Phân theo tỷ lệ đảng viên đã nộp: ' + fm(honor.length) + ' đơn vị đạt từ 95% trở lên; ' + fm(band(.8, HONOR).length) + ' đơn vị từ 80% đến dưới 95%; ' + fm(band(.5, .8).length) +
      ' đơn vị từ 50% đến dưới 80%; ' + fm(band(.2, .5).length) + ' đơn vị từ 20% đến dưới 50%; ' + fm(weak.length) + ' đơn vị dưới 20% và ' + fm(zero.length) + ' đơn vị chưa có đảng viên nộp.</p>';
    body += '<h2>II. BIỂU DƯƠNG VÀ ĐÔN ĐỐC</h2>' +
      '<p class="i"><b class="g">Biểu dương: </b>' + esc(honor.length ? fm(honor.length) + ' đơn vị đạt từ 95% trở lên: ' + honor.map(x => shortName(x.name) + ' (' + pc(x.r) + ')').join('; ') + '.' : 'chưa có đơn vị đạt từ 95% trở lên.') + '</p>' +
      ((weak.length + zero.length) ? '<p class="i"><b class="w">Cần đôn đốc: </b>' + esc(fm(weak.length + zero.length) + ' đơn vị có tỷ lệ dưới 20%' + (zero.length ? ', trong đó ' + fm(zero.length) + ' đơn vị chưa có đảng viên nộp: ' + zero.map(x => shortName(x.name)).join(', ') : '') + '.') + '</p>' : '');
    body += '<p class="cap">Phụ lục. Kết quả thu nộp đảng phí kỳ tháng ' + m + '/' + y + ' theo đơn vị</p>' +
      tbl(['TT', 'Đơn vị', 'Tổng ĐV', 'ĐV phải nộp', 'ĐV đã nộp', 'Chưa có HS', 'Tiền khai báo (đ)', 'Tiền đã nộp (đ)', 'Tỷ lệ'],
        sorted.map((x, i) => [i + 1, x.name, fm(x.t), fm(x.need), fm(x.dn), fm(x.chua), fm(x.kb), fm(x.nop), pc(x.r)])
          .concat([Object.assign(['', 'Tổng cộng (' + fm(T.units) + ' đơn vị)', fm(T.t), fm(T.need), fm(T.dn), fm(T.chua), fm(T.kb), fm(T.nop), pc(T.rate)], { tot: 1 })]),
        ['c', '', 'n', 'n', 'n', 'n', 'n', 'n', 'c']);
    return { html: shell('tình hình thu nộp đảng phí trên môi trường điện tử tháng ' + m + '/' + y, 'Nguồn số liệu: Google Sheet đảng phí, tab ' + DM().sourceFor(k).spec.tab + ' (kỳ nộp 01/' + String(m).padStart(2, '0') + '/' + y + ' – cuối tháng)', body), name: 'bao-cao-dang-phi-tinh-' + k };
  }

  /* ---------- Báo cáo cả năm ---------- */
  async function yearReport(y) {
    const cur = DM().currentKey(), last = cur.slice(0, 4) == y ? +cur.slice(5) : 12;
    const keys = []; for (let m = 1; m <= last; m++) keys.push(keyOf(y, m));
    const all = await Promise.all(keys.map(monthRows));
    const M = keys.map((k, i) => ({ m: i + 1, rows: all[i], T: all[i] && all[i].length ? totals(all[i]) : null }));
    const H = M.filter(x => x.T);
    if (!H.length) throw new Error('Năm ' + y + ' chưa có số liệu đảng phí.');
    let cum = 0;
    const r1 = M.map(x => { if (!x.T) return ['Tháng ' + x.m, '—', '—', '—', '—', '—', '—']; cum += x.T.nop; return ['Tháng ' + x.m, fm(x.T.need), fm(x.T.dn), pc(x.T.rate), fm(x.T.kb), fm(x.T.nop), fm(cum)]; });
    const total = cum, best = H.slice().sort((a, b) => b.T.nop - a.T.nop)[0], lastM = H[H.length - 1].m;
    const U = new Map();
    H.forEach(x => x.rows.forEach(d => { const k = d.name.toLowerCase(); const o = U.get(k) || { name: d.name, nop: 0, months: 0, done: 0, rs: 0 }; o.nop += d.nop; o.months++; o.rs += d.r; if (d.need > 0 && d.r >= 1) o.done++; U.set(k, o); }));
    const UL = [...U.values()].sort((a, b) => b.nop - a.nop || a.name.localeCompare(b.name, 'vi'));
    let body = '<h2>I. TÌNH HÌNH CHUNG</h2><p class="i">Năm ' + y + ', hệ thống đã ghi nhận số liệu thu nộp đảng phí của ' + fm(H.length) + ' tháng (' + H.map(x => 'T' + x.m).join(', ') +
      '). Tổng số tiền đảng phí đã nộp từ đầu năm đến hết tháng ' + lastM + ' là <b>' + fm(total) + ' đồng</b>' + (H.length > 1 ? '; tháng ' + best.m + ' thu cao nhất với ' + fm(best.T.nop) + ' đồng' : '') + '.</p>';
    body += '<p class="cap">Bảng 1. Thu nộp đảng phí theo tháng năm ' + y + '</p>' +
      tbl(['Tháng', 'ĐV phải nộp', 'ĐV đã nộp', 'Tỷ lệ', 'Tiền khai báo (đ)', 'Đã nộp trong kỳ (đ)', 'Lũy kế (đ)'], r1.concat([Object.assign(['Cả năm', '', '', '', '', fm(total), ''], { tot: 1 })]), ['c', 'n', 'n', 'c', 'n', 'n', 'n']);
    body += '<h2>II. KẾT QUẢ THEO ĐƠN VỊ</h2><p class="i">Tổng hợp ' + fm(UL.length) + ' đơn vị theo tổng số tiền đảng phí đã nộp trong năm; “Tháng đạt 100%” là số tháng đơn vị có toàn bộ đảng viên phải nộp đã nộp trên số tháng có số liệu.</p>' +
      '<p class="cap">Bảng 2. Kết quả thu nộp đảng phí theo đơn vị năm ' + y + '</p>' +
      tbl(['TT', 'Đơn vị', 'Tháng đạt 100%', 'Tỷ lệ bình quân', 'Tiền đã nộp (đ)'], UL.map((o, i) => [i + 1, o.name, o.done + '/' + o.months, pc(o.rs / o.months), fm(o.nop)]), ['c', '', 'c', 'c', 'n']);
    return { html: shell('tình hình thu nộp đảng phí trên môi trường điện tử năm ' + y, 'Nguồn số liệu: Google Sheet đảng phí, các tab tháng năm ' + y + ' (từ tháng 1 đến hết tháng ' + lastM + ')', body), name: 'bao-cao-dang-phi-tinh-nam-' + y };
  }

  /* ---------- Giao diện ---------- */
  function injectStyle() {
    if (document.getElementById('dues-report-style')) return;
    const st = document.createElement('style'); st.id = 'dues-report-style';
    st.textContent = '.drp-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);font:14px/1.45 system-ui,"Segoe UI",sans-serif}' +
      '.drp-box{width:min(420px,calc(100vw - 32px));background:#fff;color:#1f2f45;border-radius:14px;padding:20px 22px;box-shadow:0 18px 50px rgba(0,0,0,.3)}' +
      '.drp-box h3{margin:0 0 12px;font-size:17px;color:#8f0b12}.drp-box label{display:block;margin:10px 0 4px;font-weight:700;font-size:13px}' +
      '.drp-box select{width:100%;padding:8px;border:1px solid #cdd7e4;border-radius:8px;font:inherit}' +
      '.drp-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.drp-act button{flex:1;padding:9px 10px;border:0;border-radius:9px;font:700 13px inherit;cursor:pointer}' +
      '.drp-pdf{background:#b3111b;color:#fff}.drp-doc{background:#185abd;color:#fff}.drp-x{background:#eef1f5;color:#41536b}.drp-act button:disabled{opacity:.55;cursor:wait}' +
      '.drp-msg{margin-top:10px;font-size:12.5px;color:#a35a00;min-height:1em}' +
      '.drp-pv{position:fixed;inset:0;z-index:100001;display:flex;flex-direction:column;background:#e9edf3}.drp-pv .bar{display:flex;gap:8px;align-items:center;padding:8px 14px;background:#8f0b12;color:#fff;font:600 13px system-ui,sans-serif}' +
      '.drp-pv .bar span{flex:1}.drp-pv .bar button{padding:6px 12px;border:0;border-radius:8px;font:700 12.5px system-ui,sans-serif;cursor:pointer}.drp-pv iframe{flex:1;border:0;background:#fff}' +
      '.dd-ib.dd-rp{background:#fff3d6;color:#8a5a00}';
    document.head.appendChild(st);
  }
  function download(name, html) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
    a.download = name + '.doc'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function preview(rep) {
    const pv = document.createElement('div'); pv.className = 'drp-pv';
    pv.innerHTML = '<div class="bar"><span>📄 Xem trước báo cáo đảng phí</span><button type="button" data-a="print">🖨 In / Lưu PDF</button><button type="button" data-a="doc">⬇ Tải Word</button><button type="button" data-a="x">✕ Đóng</button></div><iframe title="Báo cáo đảng phí"></iframe>';
    document.body.appendChild(pv);
    const fr = pv.querySelector('iframe'); fr.srcdoc = rep.html;
    pv.querySelector('[data-a="print"]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (_) {} };
    pv.querySelector('[data-a="doc"]').onclick = () => download(rep.name, rep.html);
    pv.querySelector('[data-a="x"]').onclick = () => pv.remove();
  }
  function open() {
    const dm = DM(); if (!dm) return;
    injectStyle();
    const cur = dm.currentKey(), cy = +cur.slice(0, 4);
    const ks = dm.available().filter(k => k <= cur);
    const years = [...new Set([cy].concat(ks.map(k => +k.slice(0, 4))))].sort((a, b) => b - a);
    const sel0 = dm.state && dm.state.month && dm.state.month <= cur ? dm.state.month : cur;
    const ov = document.createElement('div'); ov.className = 'drp-ov';
    ov.innerHTML = '<div class="drp-box" role="dialog" aria-label="Báo cáo đảng phí"><h3>📄 Báo cáo thu nộp đảng phí</h3>' +
      '<label for="drpY">Năm</label><select id="drpY">' + years.map(y => '<option value="' + y + '"' + (y === +sel0.slice(0, 4) ? ' selected' : '') + '>Năm ' + y + '</option>').join('') + '</select>' +
      '<label for="drpK">Kỳ báo cáo</label><select id="drpK"></select>' +
      '<div class="drp-act"><button type="button" class="drp-pdf" data-f="pdf">Xem / In PDF</button><button type="button" class="drp-doc" data-f="doc">Tải Word</button><button type="button" class="drp-x" data-f="x">Đóng</button></div><div class="drp-msg"></div></div>';
    document.body.appendChild(ov);
    const $y = ov.querySelector('#drpY'), $k = ov.querySelector('#drpK'), msg = ov.querySelector('.drp-msg');
    const fill = y => {
      let h = '';
      for (let m = 12; m >= 1; m--) {
        const k = keyOf(y, m); if (k > cur) continue;
        h += '<option value="' + k + '"' + (k === sel0 ? ' selected' : '') + '>Tháng ' + m + '/' + y + (k === cur ? ' (hiện tại)' : '') + (dm.hasData(k) ? '' : ' · chưa có số liệu') + '</option>';
      }
      $k.innerHTML = h + '<option value="' + y + '">Cả năm ' + y + ' (tổng hợp các tháng)</option>';
    };
    fill(+$y.value); $y.onchange = () => fill(+$y.value);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => {
      if (b.dataset.f === 'x') return ov.remove();
      const k = $k.value, btns = ov.querySelectorAll('[data-f]');
      btns.forEach(x => x.disabled = true); msg.textContent = 'Đang tải số liệu từ Google Sheet…';
      try {
        const rep = /^\d{4}$/.test(k) ? await yearReport(+k) : await monthReport(k);
        ov.remove();
        if (b.dataset.f === 'doc') download(rep.name, rep.html); else preview(rep);
      } catch (e) {
        msg.textContent = (e && e.message) || 'Không tạo được báo cáo.';
        btns.forEach(x => x.disabled = false);
      }
    });
  }

  /* Gắn nút vào cửa sổ "Bảng tổng hợp thu đảng phí" (cạnh nút Xuất Excel). */
  function mountButton() {
    const ref = document.getElementById('ddXlsx');
    if (!ref || document.getElementById('ddReport')) return !!ref;
    injectStyle();
    const b = document.createElement('button'); b.type = 'button'; b.id = 'ddReport'; b.className = 'dd-ib dd-rp'; b.textContent = '📄 Báo cáo';
    b.title = 'Báo cáo thu nộp đảng phí theo tháng hoặc cả năm';
    b.onclick = open; ref.parentNode.insertBefore(b, ref);
    return true;
  }
  function init() { let n = 0; (function t() { if (!mountButton() && n++ < 60) setTimeout(t, 500); })(); }

  root.DuesReport = { open, monthReport, yearReport };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
