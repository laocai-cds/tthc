/*
 * ReportPeriod – lập báo cáo tiến độ 04 TTHC theo KỲ: lũy kế / tháng / quý (bộ chọn trên thanh cửa sổ báo cáo).
 *
 * Bảng thủ tục trên Google Sheets chỉ chứa số LŨY KẾ hiện tại, nên số liệu theo kỳ lấy từ ảnh chụp hằng ngày
 * do Apps Script (LichSu.gs) lưu vào tab "LICH SU TIEN DO" (đọc qua ?action=history&from=&to=):
 *  - Số cuối kỳ  = ảnh chụp ngày cuối kỳ (kỳ đang diễn ra: số liệu trực tiếp lúc lập báo cáo);
 *  - Phát sinh   = số cuối kỳ − ảnh chụp ngày cuối kỳ trước (chưa có thì lấy ngày lưu đầu tiên trong kỳ, có ghi chú).
 * Thu nộp đảng phí lấy theo tab tháng của bảng đảng phí (Thang{M}); quý = tháng cuối có số liệu, tiền cộng 3 tháng.
 *
 * Bọc các hàm sẵn có của trang (buildReportModel, rptHTML, rptNarrative, rptProcText, exportReportXlsx/Docx),
 * không sửa mã gốc; chọn "Lũy kế đến nay" cho kết quả y như trước.
 */
(function (root) {
  'use strict';
  if (typeof root.buildReportModel !== 'function' || typeof root.rptHTML !== 'function') return;

  const DUES_SHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';
  const ROMAN = ['I', 'II', 'III', 'IV'];
  const orig = {
    model: root.buildReportModel, html: root.rptHTML, narrative: root.rptNarrative, procText: root.rptProcText,
    xlsx: root.exportReportXlsx, docx: root.exportReportDocx
  };

  /* ---------- Kỳ báo cáo ---------- */
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dmy = s => { const [y, m, d] = String(s).split('-'); return d + '/' + m + '/' + y; };
  function period(type, y, n) {
    y = Number(y); n = Number(n);
    if (type === 'month') return { type, y, n, from: ymd(new Date(y, n - 1, 1)), to: ymd(new Date(y, n, 0)), months: [n], label: 'tháng ' + n + ' năm ' + y, tag: y + '-T' + String(n).padStart(2, '0') };
    if (type === 'quarter') return { type, y, n, from: ymd(new Date(y, (n - 1) * 3, 1)), to: ymd(new Date(y, n * 3, 0)), months: [n * 3 - 2, n * 3 - 1, n * 3], label: 'quý ' + ROMAN[n - 1] + ' năm ' + y, tag: y + '-Q' + n };
    return { type: 'all', label: 'lũy kế', tag: '' };
  }

  /* ---------- Đọc số liệu ---------- */
  function jsonp(url, cbParam, timeoutMs, timeoutMsg) {
    return new Promise((resolve, reject) => {
      const cb = '__rptPeriod_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = (err, v) => { if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove(); err ? reject(err) : resolve(v); };
      const timer = setTimeout(() => finish(new Error(timeoutMsg)), timeoutMs);
      root[cb] = v => finish(null, v);
      sc.onerror = () => finish(new Error('Không kết nối được máy chủ dữ liệu.'));
      sc.src = url + (cbParam ? '&' + cbParam + '=' : '') + cb + '&_=' + Date.now();
      sc.async = true; document.head.appendChild(sc);
    });
  }
  async function readHistory(from, to) {
    const p = await jsonp(GS_ENDPOINT_URL + '?action=history&from=' + from + '&to=' + to, 'callback', 25000,
      'Apps Script chưa trả về lịch sử số liệu. Cần thêm tệp LichSu.gs vào Apps Script và triển khai lại (xem hướng dẫn trong LichSu.gs).');
    if (!p || !p.ok) throw new Error((p && p.error) || 'Không đọc được lịch sử số liệu.');
    return p;
  }
  const cellText = c => String(c ? (c.v != null ? c.v : (c.f != null ? c.f : '')) : '').trim();
  const cellNum = c => { if (!c) return 0; if (typeof c.v === 'number') return c.v; const s = String(c.f != null ? c.f : (c.v != null ? c.v : '')).replace(/[^\d-]/g, ''); return s ? parseInt(s, 10) : 0; };
  /* gviz cần responseHandler nằm trong tqx → dựng URL riêng */
  function gvizTab(tab) {
    return new Promise(resolve => {
      const cb = '__rptDues_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = v => { if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove(); resolve(v); };
      const timer = setTimeout(() => finish(null), 20000);
      root[cb] = p => finish(p && p.table ? p : null);
      sc.onerror = () => finish(null);
      sc.src = 'https://docs.google.com/spreadsheets/d/' + DUES_SHEET_ID + '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&sheet=' + encodeURIComponent(tab) + '&headers=2&_=' + Date.now();
      sc.async = true; document.head.appendChild(sc);
    });
  }
  function parseDues(p) {
    const rows = ((p && p.table && p.table.rows) || []).map(r => r.c || [])
      .filter(c => /^\d+$/.test(cellText(c[0]).replace(/\.0$/, '')) && cellText(c[1]))
      .map(c => ({ name: cellText(c[1]), t: cellNum(c[2]), ct: cellNum(c[3]), tt: cellNum(c[4]), chuyen: cellNum(c[5]), mien: cellNum(c[6]), cd: cellNum(c[7]), dcn: cellNum(c[8]), dn: cellNum(c[9]), chua: cellNum(c[10]), kb: cellNum(c[11]), nop: cellNum(c[12]) }))
      .filter(d => d.t > 0);
    return rows.length ? rows : null;
  }
  async function duesRows(y, m) {
    const k = y + '-' + String(m).padStart(2, '0'), dm = root.DuesMonth;
    let tab = 'Thang' + m + (y === 2026 ? '' : '_' + y);
    try { if (dm && dm.hasData(k)) tab = dm.sourceFor(k).spec.tab || tab; } catch (e) { /* dùng tên tab mặc định */ }
    return parseDues(await gvizTab(tab));
  }
  /* Đảng phí theo kỳ: tháng → tab tháng; quý → số đảng viên/hồ sơ theo tháng cuối có số liệu, tiền cộng các tháng */
  async function duesForPeriod(per) {
    const now = new Date(), months = per.months.filter(m => per.y < now.getFullYear() || m <= now.getMonth() + 1);
    const lists = (await Promise.all(months.map(m => duesRows(per.y, m)))).map((r, i) => ({ m: months[i], r })).filter(x => x.r);
    if (!lists.length) return null;
    const last = lists[lists.length - 1];
    if (lists.length === 1) return { rows: last.r, months: [last.m] };
    const sum = new Map();
    lists.forEach(x => x.r.forEach(d => { const s = sum.get(d.name) || { kb: 0, nop: 0 }; s.kb += d.kb; s.nop += d.nop; sum.set(d.name, s); }));
    return { rows: last.r.map(d => Object.assign({}, d, sum.get(d.name))), months: lists.map(x => x.m) };
  }

  /* "Hoàn thành thu trong kỳ" của đảng phí: trang tính lại = tỷ lệ đảng viên đã nộp (8)÷((2)+(3)−(4)−(5)) của tháng
     (applyFeeRates); ảnh chụp chỉ có giá trị thô trên Sheet nên áp lại theo bảng đảng phí của tháng chứa ngày ảnh chụp. */
  const normName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim().replace(/ tinh lao cai$/, ' tinh');
  function feeRate(d) { const den = d.ct + d.tt - d.chuyen - d.mien; return (Math.round((den > 0 ? Math.min(100, d.dn / den * 100) : 0) * 100) / 100) + '%'; }
  function procsFrom(snap, duesList) {
    const dues = duesList ? new Map(duesList.map(d => [normName(d.name), d])) : null;
    return data.procedures.map(p => {
      const rows = p.kind === 'fee' ? snap.fee : (snap.procedures || {})[p.id], by = new Map((rows || []).map(r => [Number(r.id), r]));
      const blank = p.kind === 'fee' ? { owner: '', guided: 'Chưa', dvccreated: 0, dvctotal: 0, bankcreated: 0, banktotal: 0, paid: '☐', collected: '' }
        : { owner: '', guided: 'Chưa', received: 0, total: 0, processed: 0, need: 0, done: 0, done10: false };
      return Object.assign({}, p, {
        units: p.units.map(u => {
          const x = Object.assign({}, u, by.get(Number(u.id)) || blank, { raw: null });
          if (p.kind === 'fee') { const d = dues && dues.get(normName(u.unit)); x.collected = d ? feeRate(d) : u.collected; }
          return x;
        })
      });
    });
  }
  const duesAt = date => duesRows(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  /* Số trực tiếp: giữ nguyên, chỉ áp lại tỷ lệ đảng phí của tháng hiện tại (phòng khi bảng đảng phí trên trang chưa tải) */
  function liveProcs(duesList) {
    if (!duesList) return data.procedures;
    const dues = new Map(duesList.map(d => [normName(d.name), d]));
    return data.procedures.map(p => p.kind !== 'fee' ? p : Object.assign({}, p, {
      units: p.units.map(u => { const d = dues.get(normName(u.unit)); return d ? Object.assign({}, u, { collected: feeRate(d) }) : u; })
    }));
  }
  async function context(per) {
    if (per.type === 'all') return null;
    const today = ymd(new Date());
    if (per.from > today) throw new Error('Kỳ ' + per.label + ' chưa bắt đầu.');
    const live = per.to >= today;
    const [h, dues] = await Promise.all([readHistory(per.from, per.to), duesForPeriod(per)]);
    if (!live && !h.end) throw new Error('Chưa có số liệu lưu trữ cho ' + per.label + '. ' + (h.first ? 'Hệ thống bắt đầu lưu số liệu hằng ngày từ ngày ' + dmy(h.first) + '.' : 'Hệ thống chưa lưu ảnh chụp số liệu nào (chạy installDailySnapshotOnce() trong Apps Script).'));
    let base = h.base || null;
    if (base && !live && base.date >= h.end.date) base = null;   // đầu kỳ trùng cuối kỳ: không tính được phát sinh
    const [endDues, baseDues] = await Promise.all([duesAt(live ? today : h.end.date), base ? duesAt(base.date) : null]);
    return { per, live, endDate: live ? today : h.end.date, endProcs: live ? liveProcs(endDues) : procsFrom(h.end, endDues), base, baseProcs: base ? procsFrom(base, baseDues) : null, first: h.first || null, dues };
  }

  /* ---------- Mô hình báo cáo theo kỳ ---------- */
  function buildModel(ctx) {
    if (!ctx) return orig.model();
    const keepProcs = data.procedures, keepDues = root.__duesDetailData;
    let m, baseT = null;
    try {
      if (ctx.baseProcs) { data.procedures = ctx.baseProcs; baseT = new Map(data.procedures.map(p => [p.id, procedureTotals(p)])); }
      data.procedures = ctx.endProcs;
      root.__duesDetailData = ctx.dues ? ctx.dues.rows : (ctx.live ? keepDues : []);
      m = orig.model();
    } finally { data.procedures = keepProcs; root.__duesDetailData = keepDues; }
    const per = ctx.per, N = v => Number(v || 0);
    if (baseT) {
      const bp = new Map(ctx.baseProcs.map(p => [p.id, p]));
      m.procs.forEach(x => {
        const b = baseT.get(x.p.id), bP = bp.get(x.p.id); if (!b || !bP) return;
        const bu = new Map(bP.units.map(u => [Number(u.id), u]));
        x.rows.forEach(r => {
          const o = bu.get(Number(r.u.id)) || {};
          r.v0 = bu.has(Number(r.u.id)) ? progress(bP, o) : 0;
          r.d = x.p.kind === 'fee' ? { dvc: N(r.u.dvccreated) - N(o.dvccreated), bank: N(r.u.bankcreated) - N(o.bankcreated) }
            : { received: N(r.u.received) - N(o.received), processed: N(r.u.processed) - N(o.processed), done: N(r.u.done) - N(o.done) };
        });
        x.base = b;
        x.delta = x.p.kind === 'fee' ? { dvc: x.t.dvc - b.dvc, bank: x.t.bank - b.bank, paid: x.t.paid - b.paid, doneUnits: x.t.doneUnits - b.doneUnits, avg: x.t.average - b.average }
          : { received: x.t.received - b.received, processed: x.t.processed - b.processed, done: x.t.done - b.done, doneUnits: x.t.doneUnits - b.doneUnits, avg: x.t.average - b.average };
      });
    }
    const hasBase = m.procs.some(x => x.delta);
    m.period = Object.assign({}, per, {
      range: 'từ ngày ' + dmy(per.from) + ' đến ngày ' + dmy(per.to), live: ctx.live, endDate: ctx.endDate, first: ctx.first,
      baseDate: ctx.base ? ctx.base.date : null, partial: !!(ctx.base && ctx.base.date >= per.from), hasBase,
      baseAvg: hasBase ? m.procs.reduce((s, x) => s + (x.base ? x.base.average : 0), 0) / Math.max(1, m.procs.length) : null
    });
    m.asOf = ctx.live ? m.stamp : (ctx.endDate === per.to ? 'hết ngày ' : 'ngày ') + dmy(ctx.endDate);
    if (!ctx.live) m.source = 'Google Sheets, số liệu lưu trữ ngày ' + dmy(ctx.endDate);
    if (m.period.baseDate) m.source += '; số liệu đầu kỳ lưu ngày ' + dmy(m.period.baseDate);
    if (m.dues) m.dues.month = ctx.dues && ctx.dues.months.length > 1 ? per.label : ctx.dues ? 'tháng ' + ctx.dues.months[0] + ' năm ' + per.y : m.dues.month;
    m.fileStamp = per.tag + '_' + m.fileStamp;
    return m;
  }

  /* ---------- Nội dung phát sinh trong kỳ ---------- */
  const signed = n => { n = Number(n || 0); return (n > 0 ? '+' : '') + fmt(n); };
  const pts = v => { const n = Math.round(Number(v || 0) * 1000) / 10; return (n > 0 ? '+' : '') + n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' điểm %'; };
  function periodText(m) {
    const P = m.period; if (!P) return [];
    if (!P.hasBase) return ['Chưa tính được kết quả phát sinh trong ' + P.label + ' do chưa có số liệu lưu trữ đầu kỳ' + (P.first ? ' (hệ thống bắt đầu lưu số liệu hằng ngày từ ngày ' + dmy(P.first) + ')' : '') + '; số liệu trong báo cáo là số lũy kế đến ' + m.asOf + '.'];
    const c = m.procs.filter(x => x.delta && x.p.kind === 'case'), S = k => c.reduce((s, x) => s + x.delta[k], 0), du = m.procs.reduce((s, x) => s + (x.delta ? x.delta.doneUnits : 0), 0);
    return ['Trong ' + P.label + ' (' + P.range + (P.partial ? '; số liệu đầu kỳ tính từ ngày lưu đầu tiên ' + dmy(P.baseDate) : '') + '), ' + fmt(c.length) + ' thủ tục về hồ sơ tiếp nhận mới ' + signed(S('received')) + ' hồ sơ, xử lý ' + signed(S('processed')) + ' hồ sơ, hoàn thành ' + signed(S('done')) + ' hồ sơ; số lượt đơn vị – thủ tục hoàn thành thay đổi ' + signed(du) + '. Tiến độ bình quân chung từ ' + rptPct(P.baseAvg) + ' đầu kỳ ' + (m.avg < P.baseAvg ? 'xuống ' : 'lên ') + rptPct(m.avg) + ' cuối kỳ (' + pts(m.avg - P.baseAvg) + ').'];
  }
  const HEAD = ['TT', 'Thủ tục', 'Tiến độ đầu kỳ', 'Tiến độ cuối kỳ', 'Tăng/giảm (điểm %)', 'Tiếp nhận mới', 'Hoàn thành mới', 'ĐV hoàn thành thay đổi'];
  const WID = [450, 2671, 1000, 1000, 900, 1000, 1000, 1050];
  const periodRows = m => m.procs.filter(x => x.delta).map((x, i) => [i + 1, x.p.short, rptPct(x.base.average), rptPct(x.t.average), pts(x.delta.avg).replace(' điểm %', ''),
    x.p.kind === 'fee' ? '—' : signed(x.delta.received), x.p.kind === 'fee' ? '—' : signed(x.delta.done), signed(x.delta.doneUnits)]);

  root.rptNarrative = function (m) {
    const out = orig.narrative(m);
    if (!m || !m.period) return out;
    if (out.length) out[0] = out[0].replace('Tính đến ' + m.stamp, 'Tính đến ' + m.asOf);
    return out.concat(periodText(m));
  };
  root.rptProcText = function (x) {
    const s = orig.procText(x), d = x && x.delta; if (!d) return s;
    return s + (x.p.kind === 'fee'
      ? ' Trong kỳ: tạo mới ' + signed(d.dvc) + ' tài khoản DVC, ' + signed(d.bank) + ' tài khoản ngân hàng; số đơn vị đã nộp thay đổi ' + signed(d.paid) + '; tiến độ ' + pts(d.avg) + '.'
      : ' Trong kỳ: tiếp nhận mới ' + signed(d.received) + ', xử lý ' + signed(d.processed) + ', hoàn thành ' + signed(d.done) + ' hồ sơ; số đơn vị hoàn thành thay đổi ' + signed(d.doneUnits) + '; tiến độ ' + pts(d.avg) + '.');
  };

  /* ---------- Xem trước HTML ---------- */
  const PICKER = '<span class="per"><label for="rptType">Kỳ báo cáo</label><select id="rptType"><option value="all">Lũy kế đến nay</option><option value="month">Theo tháng</option><option value="quarter">Theo quý</option></select><select id="rptNum"></select><select id="rptYear"></select><button id="rptApply" type="button">Lập báo cáo</button></span>';
  const PICKER_CSS = '.per{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:10px;background:rgba(255,255,255,.14)}.per label{font-weight:700;font-size:12px}.per select{height:30px;border:0;border-radius:7px;padding:0 8px;font:600 12.5px "Segoe UI",Arial,sans-serif;color:#1f2f45;background:#fff;cursor:pointer}.bar .per button,.per button{height:30px;padding:0 15px;border:0;border-radius:9px;font:700 12.5px "Segoe UI",Arial,sans-serif;background:#ffd76a;color:#5a3a00;cursor:pointer}@media print{.per{display:none}}';
  function htmlTable(head, rows, widths) {
    const tw = widths.reduce((a, c) => a + c, 0);
    return '<table class="tb"><colgroup>' + widths.map(w => '<col style="width:' + (w / tw * 100).toFixed(2) + '%">').join('') + '</colgroup><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map((t, i) => '<td' + (i === 1 ? '' : ' class="c"') + '>' + esc(t) + '</td>').join('') + '</tr>').join('') + '</tbody></table><p class="sp"></p>';
  }
  root.rptHTML = function (m) {
    let h = orig.html(m);
    h = h.replace('</style>', PICKER_CSS + '</style>').replace('<span class="sp"></span>', PICKER + '<span class="sp"></span>');
    const P = m.period; if (!P) return h;
    h = h.replace('môi trường điện tử</p><p class="t2">-----</p>', 'môi trường điện tử ' + esc(P.label) + '</p><p class="meta" style="margin:0 0 1pt;font-size:12pt;color:#000">(' + esc(P.range) + ')</p><p class="t2">-----</p>');
    h = h.replace('Bảng 1. Tổng hợp tiến độ theo thủ tục', 'Bảng 1. Tổng hợp tiến độ theo thủ tục (lũy kế đến ' + esc(m.asOf) + ')');
    if (P.hasBase) h = h.replace('<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>', '<p class="cap">' + esc('Bảng 1a. Kết quả phát sinh trong ' + P.label) + '</p>' + htmlTable(HEAD, periodRows(m), WID) + '<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>');
    return h;
  };

  /* ---------- Word: chèn vào document.xml do hàm gốc dựng ---------- */
  const X = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wRun = (t, o = {}) => '<w:r><w:rPr>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + '<w:sz w:val="' + (o.sz || 26) + '"/></w:rPr><w:t xml:space="preserve">' + X(t) + '</w:t></w:r>';
  const wPara = (t, o = {}) => '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') + '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"/><w:jc w:val="' + (o.jc || 'left') + '"/></w:pPr>' + wRun(t, o) + '</w:p>';
  function wTable(head, rows, widths) {
    const cell = (t, w, o = {}) => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/><w:jc w:val="' + (o.jc || 'center') + '"/></w:pPr>' + wRun(t, { b: o.b, color: o.color, sz: o.sz || 20 }) + '</w:p></w:tc>';
    const bd = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => '<w:' + k + ' w:val="single" w:sz="4" w:color="B8C0CC"/>').join('') + '</w:tblBorders>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce((a, c) => a + c, 0) + '" w:type="dxa"/>' + bd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + head.map((t, i) => cell(t, widths[i], { b: true, fill: '8F0B12', color: 'FFFFFF', sz: 19 })).join('') + '</w:tr>' +
      rows.map((r, ri) => '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + r.map((t, i) => cell(t, widths[i], { jc: i === 1 ? 'left' : 'center', fill: ri % 2 ? 'F4F6FA' : '' })).join('') + '</w:tr>').join('') + '</w:tbl>' + wPara('', {});
  }
  function patchDocXml(doc, m) {
    const P = m.period;
    const title = '>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử</w:t></w:r></w:p>';
    doc = doc.replace(title, '>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử ' + X(P.label) + '</w:t></w:r></w:p>' + wPara('(' + P.range + ')', { i: true, sz: 24, jc: 'center', after: 20 }));
    doc = doc.replace('>Bảng 1. Tổng hợp tiến độ theo thủ tục<', '>Bảng 1. Tổng hợp tiến độ theo thủ tục (lũy kế đến ' + X(m.asOf) + ')<');
    if (P.hasBase) {
      const at = doc.indexOf('>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC<'), p0 = at < 0 ? -1 : doc.lastIndexOf('<w:p>', at);
      if (p0 >= 0) doc = doc.slice(0, p0) + wPara('Bảng 1a. Kết quả phát sinh trong ' + P.label, { b: true, sz: 24, keep: true, before: 80 }) + wTable(HEAD, periodRows(m), WID) + doc.slice(p0);
    }
    return doc;
  }
  root.exportReportDocx = function (m, w) {
    if (!m || !m.period) return orig.docx(m, w);
    const zip = root.rptZip;
    root.rptZip = function (files) { if (files && files['word/document.xml']) files['word/document.xml'] = patchDocXml(files['word/document.xml'], m); return zip.apply(this, arguments); };
    try { return orig.docx(m, w); } finally { root.rptZip = zip; }
  };

  /* ---------- Excel: tiêu đề có kỳ + thêm trang "Phát sinh trong kỳ" ---------- */
  function periodSheet(m) {
    const P = m.period, T = v => ({ v, s: 4 }), N = v => ({ v: Number(v) || 0, s: 5 }), PC = v => ({ v: Number(v) || 0, s: 6 }), B = v => ({ v, s: 7 }), H = v => ({ v, s: 3 });
    const head = ['TT', 'Thủ tục', 'Đơn vị', 'Tiến độ đầu kỳ', 'Tiến độ cuối kỳ', 'Tăng/giảm tiến độ', 'HS tiếp nhận mới / TK DVC tạo mới', 'HS xử lý mới / TK ngân hàng tạo mới', 'HS hoàn thành mới'];
    const rows = [];
    m.procs.filter(x => x.delta).forEach(x => {
      const fee = x.p.kind === 'fee';
      rows.push([B(''), B(x.p.short), B('Cộng thủ tục'), { v: x.base.average, s: 9 }, { v: x.t.average, s: 9 }, { v: x.delta.avg, s: 9 }, ...(fee ? [N(x.delta.dvc), N(x.delta.bank), T('—')] : [N(x.delta.received), N(x.delta.processed), N(x.delta.done)])]);
      x.rows.forEach((r, k) => rows.push([N(k + 1), T(x.p.short), T(r.u.unit), PC(r.v0), PC(r.v), PC(r.v - r.v0), ...(fee ? [N(r.d.dvc), N(r.d.bank), T('—')] : [N(r.d.received), N(r.d.processed), N(r.d.done)])]));
    });
    return {
      name: 'Phát sinh trong kỳ', cols: [6, 28, 40, 13, 13, 13, 18, 18, 14], freeze: 5, filter: 'A5:I' + (5 + rows.length), merges: ['A1:I1', 'A2:I2', 'A3:I3'], heights: { 0: 30, 4: 36 },
      rows: [[{ v: 'KẾT QUẢ PHÁT SINH TRONG ' + P.label.toUpperCase(), s: 1 }], [{ v: P.range + ' — số cuối kỳ trừ số đầu kỳ', s: 2 }], [{ v: 'Lập lúc: ' + m.stamp + ' · Nguồn số liệu: ' + m.source, s: 8 }], [], head.map(H), ...rows]
    };
  }
  root.exportReportXlsx = function (m, w) {
    if (!m || !m.period) return orig.xlsx(m, w);
    const blob = root.rptXlsxBlob, P = m.period;
    root.rptXlsxBlob = function (sheets) {
      (sheets || []).forEach(s => {
        const r = s.rows || [];
        if (r[0] && r[0][0] && typeof r[0][0].v === 'string' && /^BÁO CÁO/.test(r[0][0].v)) r[0][0].v += ' ' + P.label.toUpperCase();
        if (r[2] && r[2][0] && typeof r[2][0].v === 'string' && /^Lập lúc/.test(r[2][0].v)) r[2][0].v = r[2][0].v.replace(' · Nguồn số liệu', ' · Kỳ báo cáo: ' + P.label + ' (' + P.range + ') · Nguồn số liệu');
      });
      if (P.hasBase && sheets && sheets.length) sheets.splice(1, 0, periodSheet(m));
      return blob.apply(this, arguments);
    };
    try { return orig.xlsx(m, w); } finally { root.rptXlsxBlob = blob; }
  };
  root.buildReportModel = function (ctx) { return buildModel(ctx || null); };

  /* ---------- Cửa sổ báo cáo + bộ chọn kỳ ---------- */
  function msgPage(title, msg) {
    return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{margin:0;background:#e9edf3;font:14px "Segoe UI",Arial,sans-serif;color:#1f2f45}.bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;background:linear-gradient(110deg,#7d0c13,#b3111b 55%,#d0412b);color:#fff}' + PICKER_CSS +
      '.box{max-width:640px;margin:60px auto;padding:28px 32px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(20,30,50,.15);line-height:1.6}</style></head><body><div class="bar"><b>📄 Báo cáo tiến độ 04 thủ tục hành chính</b>' + PICKER + '</div><div class="box"><b>' + esc(title) + '</b><p>' + esc(msg) + '</p></div></body></html>';
  }
  function bindPicker(win, per) {
    const d = win.document, t = d.getElementById('rptType'), n = d.getElementById('rptNum'), y = d.getElementById('rptYear'), go = d.getElementById('rptApply');
    if (!t) return;
    const now = new Date(), Y = now.getFullYear(), cur = ty => ty === 'quarter' ? Math.floor(now.getMonth() / 3) + 1 : now.getMonth() + 1;
    y.innerHTML = [Y, Y - 1].map(v => '<option value="' + v + '">Năm ' + v + '</option>').join('');
    const fill = () => {
      const ty = t.value; n.style.display = y.style.display = ty === 'all' ? 'none' : '';
      n.innerHTML = ty === 'quarter' ? [1, 2, 3, 4].map(q => '<option value="' + q + '">Quý ' + ROMAN[q - 1] + '</option>').join('') : Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '">Tháng ' + (i + 1) + '</option>').join('');
    };
    t.value = per.type; fill(); y.value = String(per.y || Y); n.value = String(per.n || cur(t.value));
    const apply = () => render(win, period(t.value, y.value, n.value));   // đổi lựa chọn là lập lại ngay
    t.onchange = () => { fill(); n.value = String(cur(t.value)); apply(); };
    n.onchange = y.onchange = go.onclick = apply;
  }
  async function render(win, per) {
    let ctx = null;
    const write = html => { win.document.open(); win.document.write(html); win.document.close(); };
    if (per.type !== 'all') {
      write(msgPage('Đang lập báo cáo ' + per.label + '…', 'Đang đọc số liệu lưu trữ đầu kỳ, cuối kỳ và số liệu đảng phí từ Google Sheets.')); bindPicker(win, per);
      try { ctx = await context(per); } catch (e) { console.error(e); if (win.closed) return; write(msgPage('Không lập được báo cáo ' + per.label, (e && e.message) || String(e))); bindPicker(win, per); return; }
      if (win.closed) return;
    }
    const m = root.buildReportModel(ctx);
    write(root.rptHTML(m));
    const d = win.document;
    d.getElementById('rptPrint').onclick = () => win.print();
    d.getElementById('rptXlsx').onclick = () => { try { root.exportReportXlsx(m, win); } catch (e) { console.error(e); win.alert('Không xuất được Excel: ' + ((e && e.message) || e)); } };
    d.getElementById('rptDocx').onclick = () => { try { root.exportReportDocx(m, win); } catch (e) { console.error(e); win.alert('Không xuất được Word: ' + ((e && e.message) || e)); } };
    bindPicker(win, per);
  }
  async function buildReport() {
    const win = window.open('', '_blank'); if (!win) { alert('Trình duyệt đang chặn cửa sổ báo cáo. Hãy cho phép cửa sổ bật lên rồi thử lại.'); return; }
    if (!sheetsLastSyncedAt) {
      try { win.document.write('<p style="font:15px Segoe UI,Arial,sans-serif;padding:40px;text-align:center">Đang đồng bộ số liệu từ Google Sheets…</p>'); } catch (e) { /* cửa sổ đã đóng */ }
      const t0 = Date.now(); while (sheetsSyncBusy && Date.now() - t0 < 25000) await new Promise(r => setTimeout(r, 300));
      if (!sheetsLastSyncedAt) { try { await syncSheetsFromCloud(false); } catch (e) { console.error(e); } }
    }
    if (win.closed) return;
    const now = new Date();
    await render(win, period('month', now.getFullYear(), now.getMonth() + 1));   // mặc định: báo cáo tháng hiện tại
    win.focus();
  }
  const btn = document.getElementById('buildReport');
  if (btn) btn.onclick = buildReport;
  root.ReportPeriod = { period, context, render, buildReport };
})(window);
