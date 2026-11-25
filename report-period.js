/*
 * ReportPeriod – lập báo cáo tiến độ 04 TTHC theo KỲ: lũy kế / tháng / quý (bộ chọn trên thanh cửa sổ báo cáo).
 *
 * Bảng thủ tục trên Google Sheets chỉ chứa số LŨY KẾ hiện tại, nên số liệu theo kỳ lấy từ ảnh chụp hằng ngày
 * do Apps Script (LichSu.gs) lưu vào tab "LICH SU TIEN DO" (đọc qua ?action=history&from=&to=):
 *  - Số cuối kỳ  = ảnh chụp ngày cuối kỳ (kỳ đang diễn ra: số liệu trực tiếp lúc lập báo cáo);
 *  - Phát sinh   = số cuối kỳ − ảnh chụp ngày cuối kỳ trước (chưa có thì lấy ngày lưu đầu tiên trong kỳ, có ghi chú).
 * Kỳ "theo tháng": số liệu hồ sơ của 3 thủ tục lấy trực tiếp từ tab "03 THANG mm-yyyy" của bảng 03 thủ tục
 * (số của chính tháng đó; so tiến độ với tab tháng trước nếu có). Chưa có tab thì quay về cách ảnh chụp ở trên.
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
    if (type === 'year') return { type, y, n: 1, from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 12, 0)), months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: 'năm ' + y, tag: y + '-N' };
    const t = new Date(); return { type: 'all', y: t.getFullYear(), n: 1, from: ymd(new Date(t.getFullYear(), 0, 1)), to: ymd(t), months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: 'lũy kế', tag: '' };
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
  function gvizTab(tab, hdr, sid) {
    return new Promise(resolve => {
      const cb = '__rptDues_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = v => { if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove(); resolve(v); };
      const timer = setTimeout(() => finish(null), 20000);
      root[cb] = p => finish(p && p.table ? p : null);
      sc.onerror = () => finish(null);
      sc.src = 'https://docs.google.com/spreadsheets/d/' + (sid || DUES_SHEET_ID) + '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&sheet=' + encodeURIComponent(tab) + '&headers=' + (hdr || 2) + '&_=' + Date.now();
      sc.async = true; document.head.appendChild(sc);
    });
  }
  /* ---------- Số liệu hồ sơ theo tháng: tab "03 THANG mm-yyyy" (cột: tên đơn vị; [đang chờ, đang xử lý, hoàn thành] × Chuyển chính thức, Chuyển tạm thời, Nhận xét) ---------- */
  const SH03 = '1zWKZy2rMCsahX-f96bk9tMJuLcDp13OfKNcQq3T5oXA', M03COL = [['chinh-thuc', 1], ['tam-thoi', 4], ['nhan-xet', 7]];
  const nf03 = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  async function loadMonth03(y, m) {
    const p = await gvizTab('03 THANG ' + String(m).padStart(2, '0') + '-' + y, 1, SH03);
    const c0 = p && (p.table.cols || [])[0];
    if (!c0 || String(c0.label || c0.id).trim() !== 'TEN DON VI') return null;   // tab chưa có: gviz trả về trang đầu tiên
    const o = {};
    (p.table.rows || []).forEach(rw => {
      const c = rw.c || []; if (!c[0] || !c[0].v) return;
      const nm = nf03(c[0].v), g = i => Number(c[i] && c[i].v) || 0;
      M03COL.forEach(([pid, i]) => { if (!c[i] && !c[i + 1] && !c[i + 2]) return; (o[pid] || (o[pid] = new Map())).set(nm, [g(i), g(i + 1), g(i + 2)]); });
    });
    return Object.keys(o).length ? o : null;
  }
  /* Thay số hồ sơ của các thủ tục dạng hồ sơ bằng số của tháng (cùng công thức với bảng xếp hạng theo tháng trên trang) */
  function applyMonth03(procs, mp) {
    return procs.map(p => p.kind === 'fee' ? p : Object.assign({}, p, {
      units: p.units.map(u => { const a = ((mp[p.id]) || new Map()).get(nf03(u.unit)) || [0, 0, 0], rc = a[0] + a[1] + a[2]; return Object.assign({}, u, { received: rc, total: rc, processed: a[2], need: rc - a[1], done: a[2] }); })
    }));
  }

  /* Đơn vị hoàn thành 100% đảng phí (tab HOAN THANH SOM do Apps Script ghi nhận); null = chưa có tab/không đọc được */
  async function loadFirstDone() {
    const p = await gvizTab('HOAN THANH SOM', 1);
    root.__firstDone = p ? ((p.table.rows || []).map(r => r.c || []).map(c => ({ month: cellText(c[0]), unit: cellText(c[1]), when: cellText(c[2]) })).filter(x => x.month && x.unit)) : null;
  }
  const xqAdj = d => { /* Xuân Quang: không tính Chi bộ thôn Cóc Mằn (1 đảng viên) vào thu trong kỳ */ if (/^dang bo xa xuan quang$/.test(String(d.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim()) && d.ct > 0 && d.t > 0 && d.ct + d.tt - d.chuyen - d.mien > d.dn) { d.t -= 1; d.ct -= 1; } return d; };
  function parseDues(p) {
    const rows = ((p && p.table && p.table.rows) || []).map(r => r.c || [])
      .filter(c => /^\d+$/.test(cellText(c[0]).replace(/\.0$/, '')) && cellText(c[1]))
      .map(c => xqAdj({ name: cellText(c[1]), t: cellNum(c[2]), ct: cellNum(c[3]), tt: cellNum(c[4]), chuyen: cellNum(c[5]), mien: cellNum(c[6]), cd: cellNum(c[7]), dcn: cellNum(c[8]), dn: cellNum(c[9]), chua: cellNum(c[10]), kb: cellNum(c[11]), nop: cellNum(c[12]) }))
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
  /* Cộng số hồ sơ của nhiều tab tháng (quý, năm, lũy kế): cùng đơn vị cộng theo từng cột */
  function sumMaps(list) {
    const o = {};
    list.forEach(mp => Object.keys(mp).forEach(pid => mp[pid].forEach((a, nm) => { const m = o[pid] || (o[pid] = new Map()), c = m.get(nm) || [0, 0, 0]; m.set(nm, [c[0] + a[0], c[1] + a[1], c[2] + a[2]]); })));
    return Object.keys(o).length ? o : null;
  }
  async function loadSum03(y, months) {
    const now = new Date(), ms = months.filter(m => y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1));
    const r = await Promise.all(ms.map(m => loadMonth03(y, m).catch(() => null)));
    return { sum: sumMaps(r.filter(Boolean)), tabs: ms.filter((m, i) => r[i]).map(m => String(m).padStart(2, '0') + '-' + y), list: ms.map((m, i) => ({ m, y, mp: r[i] })).filter(x => x.mp) };
  }
  const WD = { month: 'tháng', quarter: 'quý', year: 'năm', all: 'kỳ' };
  async function context(per) {
    const today = ymd(new Date());
    if (per.from > today) throw new Error('Kỳ ' + per.label + ' chưa bắt đầu.');
    const live = per.to >= today, isM = per.type === 'month', pY = per.n === 1 ? per.y - 1 : per.y, pM = per.n === 1 ? 12 : per.n - 1;
    let curS = null, prevS = null, prevLabelS = '';
    if (!isM) {   // quý, năm, lũy kế: cộng các tab tháng "03 THANG"
      curS = await loadSum03(per.y, per.months);
      if (per.type === 'quarter') { const q = per.n === 1 ? 4 : per.n - 1, y0 = per.n === 1 ? per.y - 1 : per.y; prevS = await loadSum03(y0, [q * 3 - 2, q * 3 - 1, q * 3]); prevLabelS = 'quý ' + ROMAN[q - 1] + ' năm ' + y0; }
      else if (per.type === 'year') { prevS = await loadSum03(per.y - 1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); prevLabelS = 'năm ' + (per.y - 1); }
      if (!curS.sum && per.type === 'all') return null;   // chưa có tab tháng nào: dùng số trên trang như cũ
    }
    const [h0, dues, cur, prev, prevDues] = await Promise.all([per.type === 'all' ? Promise.resolve({}) : readHistory(per.from, per.to).catch(e => ({ err: e })), duesForPeriod(per.type === 'all' ? Object.assign({}, per, { months: [new Date().getMonth() + 1] }) : per), isM ? loadMonth03(per.y, per.n) : (curS && curS.sum), isM ? loadMonth03(pY, pM) : (prevS && prevS.sum), isM ? duesRows(pY, pM) : null]);
    if (h0.err && !cur) throw h0.err;
    const h = h0.err ? {} : h0;
    if (!live && !h.end && !cur) throw new Error('Chưa có số liệu lưu trữ cho ' + per.label + '. ' + (h.first ? 'Hệ thống bắt đầu lưu số liệu hằng ngày từ ngày ' + dmy(h.first) + '.' : 'Hệ thống chưa lưu ảnh chụp số liệu nào (chạy installDailySnapshotOnce() trong Apps Script).'));
    let base = h.base || null;
    if (base && !live && (!h.end || base.date >= h.end.date)) base = null;   // đầu kỳ trùng cuối kỳ: không tính được phát sinh
    const endDate = live ? today : (h.end ? h.end.date : per.to);
    const [endDues, baseDues] = await Promise.all([duesAt(endDate), base ? duesAt(base.date) : null]);
    let endProcs = live || !h.end ? liveProcs(endDues) : procsFrom(h.end, endDues), baseProcs = base ? procsFrom(base, baseDues) : null;
    let monthly = null;
    if (!isM && curS && curS.list.length > 1 && per.type !== 'all') { const keep = window.__m03cur; try { monthly = curS.list.map(x => { window.__m03cur = x.mp; return { m: x.m, y: x.y, procs: applyMonth03(endProcs.filter(p => p.kind !== 'fee'), x.mp).map(p => ({ id: p.id, short: p.short, t: procedureTotals(p) })) }; }); } finally { window.__m03cur = keep; } }
    if (cur) {   // tháng có tab "03 THANG": hồ sơ lấy theo tab; đảng phí vẫn theo ảnh chụp đầu kỳ (nếu có)
      const caseBase = prev ? applyMonth03(endProcs.filter(p => p.kind !== 'fee'), prev) : [], feeBase = base && prevDues ? procsFrom(base, prevDues).filter(p => p.kind === 'fee') : [];   // đảng phí: tỷ lệ thu so với tab tháng trước
      endProcs = applyMonth03(endProcs, cur); baseProcs = caseBase.concat(feeBase); if (!baseProcs.length) baseProcs = null;
    }
    return { per, live, endDate, endProcs, base, baseProcs, first: h.first || null, dues, monthTab: cur ? { y: per.y, n: per.n } : null, prevTab: cur && prev ? { y: pY, n: pM } : null, monthly, prevLabel: isM ? '' : prevLabelS, tabs: isM ? [String(per.n).padStart(2, '0') + '-' + per.y] : (curS ? curS.tabs : []), prevTabs: isM ? (prev ? [String(pM).padStart(2, '0') + '-' + pY] : []) : (prevS ? prevS.tabs : []) };
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
    const bp = new Map((ctx.baseProcs || []).map(p => [p.id, p])), MT = !!ctx.monthTab;
    m.procs.forEach(x => {
      const fee = x.p.kind === 'fee', mt = MT && !fee, b = baseT ? baseT.get(x.p.id) : null, bP = bp.get(x.p.id);
      if (!mt && (!b || !bP)) return;
      const bu = new Map((bP ? bP.units : []).map(u => [Number(u.id), u]));
      x.rows.forEach(r => {
        const o = bu.get(Number(r.u.id)) || {};
        r.v0 = bP ? (bu.has(Number(r.u.id)) ? progress(bP, o) : 0) : null;
        r.d = fee ? { dvc: N(r.u.dvccreated) - N(o.dvccreated), bank: N(r.u.bankcreated) - N(o.bankcreated) }
          : mt ? { received: N(r.u.received), processed: N(r.u.processed), done: N(r.u.done) }   // tháng: số của chính tháng đó
          : { received: N(r.u.received) - N(o.received), processed: N(r.u.processed) - N(o.processed), done: N(r.u.done) - N(o.done) };
      });
      x.base = b || null; x.mt = mt; x.al = per.type === 'all'; x.wd = WD[per.type] || 'tháng';
      x.delta = fee ? { dvc: x.t.dvc - b.dvc, bank: x.t.bank - b.bank, paid: x.t.paid - b.paid, doneUnits: x.t.doneUnits - b.doneUnits, avg: x.t.average - b.average }
        : mt ? { received: x.t.received, processed: x.t.processed, done: x.t.done, doneUnits: b ? x.t.doneUnits - b.doneUnits : null, avg: b ? x.t.average - b.average : null }
        : { received: x.t.received - b.received, processed: x.t.processed - b.processed, done: x.t.done - b.done, doneUnits: x.t.doneUnits - b.doneUnits, avg: x.t.average - b.average };
    });
    const hasBase = m.procs.some(x => x.delta), cmp = m.procs.filter(x => x.delta && x.base && (!MT || x.p.kind === 'case')), mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    m.period = Object.assign({}, per, {
      range: 'từ ngày ' + dmy(per.from) + ' đến ngày ' + dmy(per.to), live: ctx.live, endDate: ctx.endDate, first: ctx.first,
      baseDate: ctx.base ? ctx.base.date : null, partial: !MT && !!(ctx.base && ctx.base.date >= per.from), hasBase: per.type === 'all' ? false : hasBase, wd: WD[per.type] || 'kỳ', monthly: ctx.monthly || null, tabs: ctx.tabs || [], prevTabs: ctx.prevTabs || [],
      monthTab: MT, prevTab: ctx.prevTab, prevLabel: ctx.prevLabel ? ctx.prevLabel : ctx.prevTab ? 'tháng ' + ctx.prevTab.n + ' năm ' + ctx.prevTab.y : (MT ? 'tháng ' + (per.n === 1 ? 12 : per.n - 1) + ' năm ' + (per.n === 1 ? per.y - 1 : per.y) : ''),
      baseAvg: cmp.length ? mean(cmp.map(x => x.base.average)) : null, endAvg: cmp.length ? mean(cmp.map(x => x.t.average)) : null
    });
    m.asOf = ctx.live ? m.stamp : (ctx.endDate === per.to ? 'hết ngày ' : 'ngày ') + dmy(ctx.endDate);
    if (!ctx.live && !MT) m.source = 'Google Sheets, số liệu lưu trữ ngày ' + dmy(ctx.endDate);
    if (MT) { const tl = a => a.map(t => '"03 THANG ' + t + '"').join(', '); m.source = 'Google Sheets, bảng theo dõi 03 thủ tục, ' + (m.period.tabs.length > 1 ? 'cộng các tab ' : 'tab ') + tl(m.period.tabs) + (m.period.prevTabs.length ? ' (so với ' + (m.period.prevTabs.length > 1 ? 'các tab ' : 'tab ') + tl(m.period.prevTabs) + ')' : '') + (ctx.live ? '; đảng phí và tình hình triển khai lập lúc ' + m.stamp : ''); }
    if (m.period.baseDate && !MT) m.source += '; số liệu đầu kỳ lưu ngày ' + dmy(m.period.baseDate);
    if (m.dues) m.dues.month = ctx.dues && ctx.dues.months.length > 1 ? per.label : ctx.dues ? 'tháng ' + ctx.dues.months[0] + ' năm ' + per.y : m.dues.month;
    m.fileStamp = per.tag + '_' + m.fileStamp;
    return m;
  }

  /* ---------- Nội dung phát sinh trong kỳ ---------- */
  const signed = n => { n = Number(n || 0); return (n > 0 ? '+' : '') + fmt(n); };
  const pts = v => { const n = Math.round(Number(v || 0) * 1000) / 10; return (n > 0 ? '+' : '') + n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' điểm %'; };
  const sg = v => v == null ? '—' : signed(v);
  function periodText(m) {
    const P = m.period; if (!P) return [];
    if (P.type === 'all') {   // lũy kế: cộng các tab tháng
      const cs = m.procs.filter(x => x.p.kind === 'case'), nm = cs.map(x => '“' + x.p.short + '”'), nmT = nm.length > 1 ? nm.slice(0, -1).join(', ') + ' và ' + nm[nm.length - 1] : nm.join(''), rc = cs.reduce((a, x) => a + x.t.received, 0), dn = cs.reduce((a, x) => a + x.t.done, 0);
      return ['Lũy kế đến nay (cộng số liệu ' + fmt(P.tabs.length) + ' tháng có số liệu: ' + P.tabs.map(t => 'tháng ' + Number(t.slice(0, 2))).join(', ') + '), ba thủ tục về hồ sơ (' + nmT + ') ghi nhận ' + fmt(rc) + ' hồ sơ tiếp nhận; đã xử lý xong ' + fmt(dn) + ' hồ sơ' + (rc > 0 ? ', đạt ' + rptPct(dn / rc) + ' số hồ sơ tiếp nhận' : '') + '.'];
    }
    if (!P.hasBase) return ['Chưa tính được kết quả phát sinh trong ' + P.label + ' do chưa có số liệu lưu trữ đầu kỳ' + (P.first ? ' (hệ thống bắt đầu lưu số liệu hằng ngày từ ngày ' + dmy(P.first) + ')' : '') + '; số liệu trong báo cáo là số lũy kế đến ' + m.asOf + '.'];
    const c = m.procs.filter(x => x.delta && x.p.kind === 'case'), S = k => c.reduce((s, x) => s + x.delta[k], 0), du = m.procs.reduce((s, x) => s + (x.delta && x.delta.doneUnits != null && (!P.monthTab || x.p.kind === 'case') ? x.delta.doneUnits : 0), 0);
    if (P.monthTab) {
      const cmp = P.baseAvg != null && P.endAvg != null;
      const nm = c.map(x => '“' + x.p.short + '”'), nmTxt = nm.length > 1 ? nm.slice(0, -1).join(', ') + ' và ' + nm[nm.length - 1] : nm.join(''), rc = S('received'), dn = S('done'), same = cmp && Math.abs(P.endAvg - P.baseAvg) < 0.0005;
      const cmpTxt = !cmp ? ' Chưa có số liệu ' + P.prevLabel + ' trên bảng theo dõi nên chưa so sánh được với ' + P.wd + ' trước.'
        : same ? ''
        : ' So với ' + P.prevLabel + ', tiến độ bình quân chung của ba thủ tục hồ sơ nêu trên ' + (P.endAvg < P.baseAvg ? 'giảm từ ' : 'tăng từ ') + rptPct(P.baseAvg) + (P.endAvg < P.baseAvg ? ' xuống ' : ' lên ') + rptPct(P.endAvg) + ' (' + pts(P.endAvg - P.baseAvg) + ').';
      return ['Trong ' + P.label + ' (' + P.range + '), ba thủ tục về hồ sơ (' + nmTxt + ') ghi nhận ' + fmt(rc) + ' hồ sơ tiếp nhận; đã xử lý xong ' + fmt(dn) + ' hồ sơ' + (rc > 0 ? ', đạt ' + rptPct(dn / rc) + ' số hồ sơ tiếp nhận' : '') + (P.type === 'month' ? ' (theo số liệu của chính tháng, lấy từ bảng theo dõi 03 thủ tục).' : ' (cộng số liệu các tháng có số liệu trong ' + P.label + ': ' + P.tabs.map(t => 'tháng ' + Number(t.slice(0, 2))).join(', ') + ').') + cmpTxt];
    }
    const nmP = c.map(x => '“' + x.p.short + '”'), nmQ = nmP.length > 1 ? nmP.slice(0, -1).join(', ') + ' và ' + nmP[nmP.length - 1] : nmP.join('');
    return ['Trong ' + P.label + ' (' + P.range + (P.partial ? '; số liệu đầu kỳ tính từ ngày lưu đầu tiên ' + dmy(P.baseDate) : '') + '), ba thủ tục về hồ sơ (' + nmQ + ') tiếp nhận mới ' + signed(S('received')) + ' hồ sơ, xử lý xong ' + signed(S('done')) + ' hồ sơ. Tiến độ bình quân chung của ba thủ tục hồ sơ nêu trên ' + (Math.abs(P.endAvg - P.baseAvg) < 0.0005 ? 'giữ nguyên ở mức ' + rptPct(P.endAvg) : (P.endAvg < P.baseAvg ? 'giảm từ ' : 'tăng từ ') + rptPct(P.baseAvg) + (P.endAvg < P.baseAvg ? ' xuống ' : ' lên ') + rptPct(P.endAvg) + ' (' + pts(P.endAvg - P.baseAvg) + ')') + ' trong kỳ.'];
  }
  const HEAD = ['Thứ tự', 'Thủ tục', 'Tiến độ đầu kỳ', 'Tiến độ cuối kỳ', 'Tăng/giảm (điểm %)', 'Tiếp nhận mới', 'Hoàn thành mới', 'ĐV hoàn thành thay đổi'];
  const monthlyTable = m => {
    const L = m.period.monthly; if (!L || !L.length) return null;
    const head = ['Tháng', 'Hồ sơ tiếp nhận', 'Hồ sơ xử lý xong', 'Tỷ lệ xử lý xong', ...L[0].procs.map(p => 'Tiến độ ' + p.short)];
    const rows = L.map(x => { const rc = x.procs.reduce((a, p) => a + p.t.received, 0), dn = x.procs.reduce((a, p) => a + p.t.done, 0); return ['Tháng ' + x.m, fmt(rc), fmt(dn), rc > 0 ? rptPct(dn / rc) : '—', ...x.procs.map(p => rptPct(p.t.average))]; });
    return { cap: 'Bảng 1b. Số liệu hồ sơ theo từng tháng trong ' + m.period.label, head, rows, w: [900, 1300, 1300, 1100, 1500, 1500, 1500].slice(0, head.length) };
  };
  const HEAD_M_F = w => ['Thứ tự', 'Thủ tục', 'Tiến độ ' + w + ' trước', 'Tiến độ trong ' + w, 'Tăng/giảm (điểm %)', 'Hồ sơ tiếp nhận', 'Hồ sơ hoàn thành', 'ĐV hoàn thành thay đổi'];
  const HEAD_M = HEAD_M_F('tháng');
  const headOf = m => m.period && m.period.monthTab ? HEAD_M_F(m.period.wd) : HEAD;
  const capOf = m => 'Bảng 1a. ' + (m.period.monthTab ? 'Kết quả hồ sơ trong ' + m.period.label + (m.period.prevTab ? ' (so với ' + m.period.prevLabel + ')' : ' (chưa có số liệu ' + m.period.wd + ' trước để so sánh)') : 'Kết quả phát sinh trong ' + m.period.label);
  const WID = [450, 2671, 1000, 1000, 900, 1000, 1000, 1050];
  const periodRows = m => { const MT = m.period.monthTab, cnt = v => MT ? fmt(v) : signed(v); return m.procs.filter(x => x.delta).map((x, i) => [i + 1, x.p.short, x.base ? rptPct(x.base.average) : '—', rptPct(x.t.average), x.delta.avg == null ? '—' : pts(x.delta.avg).replace(' điểm %', ''),
    x.p.kind === 'fee' ? '—' : cnt(x.delta.received), x.p.kind === 'fee' ? '—' : cnt(x.delta.done), sg(x.delta.doneUnits)]); };

  root.rptNarrative = function (m) {
    const out = orig.narrative(m);
    if (m && !m.period) {   // lũy kế: bổ sung tình hình hồ sơ như báo cáo tháng
      const cs = (m.procs || []).filter(x => x.p.kind === 'case'); if (!cs.length) return out;
      const nm = cs.map(x => '“' + x.p.short + '”'), nmT = nm.length > 1 ? nm.slice(0, -1).join(', ') + ' và ' + nm[nm.length - 1] : nm.join(''), rc = cs.reduce((a, x) => a + x.t.received, 0), dn = cs.reduce((a, x) => a + x.t.done, 0);
      return out.concat(['Lũy kế đến nay, ba thủ tục về hồ sơ (' + nmT + ') ghi nhận ' + fmt(rc) + ' hồ sơ tiếp nhận; đã xử lý xong ' + fmt(dn) + ' hồ sơ' + (rc > 0 ? ', đạt ' + rptPct(dn / rc) + ' số hồ sơ tiếp nhận' : '') + '.']);
    }
    if (!m || !m.period) return out;
    return out.concat(periodText(m));
  };
  root.rptProcText = function (x) {
    const s = orig.procText(x), d = x && x.delta; if (!d) return s;
    if (x.p.kind === 'fee') return s + ' Trong kỳ: tạo mới ' + signed(d.dvc) + ' tài khoản DVC, ' + signed(d.bank) + ' tài khoản ngân hàng; số đơn vị đã nộp thay đổi ' + signed(d.paid) + '; tiến độ ' + pts(d.avg) + '.';
    if (x.al) return s;
    if (x.mt && d.doneUnits == null) return s + ' Trong ' + (x.wd || 'tháng') + ': tiếp nhận ' + fmt(d.received) + ', xử lý ' + fmt(d.processed) + ', hoàn thành ' + fmt(d.done) + ' hồ sơ (chưa có số liệu ' + (x.wd || 'tháng') + ' trước để so sánh).';
    return s + (x.mt ? ' Trong ' + (x.wd || 'tháng') + ': tiếp nhận ' + fmt(d.received) + ', xử lý ' + fmt(d.processed) + ', hoàn thành ' + fmt(d.done) + ' hồ sơ; so với ' + (x.wd || 'tháng') + ' trước, số đơn vị hoàn thành thay đổi ' + signed(d.doneUnits) + '; tiến độ ' + pts(d.avg) + '.'
      : ' Trong kỳ: tiếp nhận mới ' + signed(d.received) + ', xử lý ' + signed(d.processed) + ', hoàn thành ' + signed(d.done) + ' hồ sơ; số đơn vị hoàn thành thay đổi ' + signed(d.doneUnits) + '; tiến độ ' + pts(d.avg) + '.');
  };

  /* ---------- Xem trước HTML ---------- */
  const PICKER = '<span class="per"><label for="rptType">Kỳ báo cáo</label><select id="rptType"><option value="all">Lũy kế đến nay</option><option value="month">Theo tháng</option><option value="quarter">Theo quý</option><option value="year">Theo năm</option></select><select id="rptNum"></select><select id="rptYear"></select><input id="rptUnitQ" type="search" placeholder="🔍 Tìm đơn vị…" autocomplete="off" title="Gõ tên đơn vị (không cần dấu), Enter để lập báo cáo"><select id="rptUnit" title="Lập báo cáo riêng cho một đơn vị"></select><button id="rptApply" type="button">Lập báo cáo</button></span>';
  const PICKER_CSS = '.per{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:10px;background:rgba(255,255,255,.14)}.per label{font-weight:700;font-size:12px}.per input{height:30px;width:150px;border:0;border-radius:7px;padding:0 8px;font:600 12.5px "Segoe UI",Arial,sans-serif;color:#1f2f45;background:#fff}.per select{height:30px;border:0;border-radius:7px;padding:0 8px;font:600 12.5px "Segoe UI",Arial,sans-serif;color:#1f2f45;background:#fff;cursor:pointer}.bar .per button,.per button{height:30px;padding:0 15px;border:0;border-radius:9px;font:700 12.5px "Segoe UI",Arial,sans-serif;background:#ffd76a;color:#5a3a00;cursor:pointer}@media print{.per{display:none}}';
  function htmlTable(head, rows, widths) {
    const tw = widths.reduce((a, c) => a + c, 0);
    return '<table class="tb"><colgroup>' + widths.map(w => '<col style="width:' + (w / tw * 100).toFixed(2) + '%">').join('') + '</colgroup><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map((t, i) => '<td' + (i === 1 ? '' : ' class="c"') + '>' + esc(t) + '</td>').join('') + '</tr>').join('') + '</tbody></table><p class="sp"></p>';
  }
  root.rptHTML = function (m) {
    let h = orig.html(m);
    h = h.replace('</style>', PICKER_CSS + '</style>').replace('<span class="sp"></span>', PICKER + '<span class="sp"></span>');
    const P = m.period;
    if (!P || P.type === 'all') h = h.replace('môi trường điện tử</p><p class="t2">-----</p>', 'môi trường điện tử (Lũy kế đến thời điểm hiện tại)</p><p class="t2">-----</p>');
    if (!P) return h;
    h = h.replace('môi trường điện tử</p><p class="t2">-----</p>', 'môi trường điện tử ' + esc(P.label) + '</p><p class="meta" style="margin:0 0 1pt;font-size:12pt;color:#000">(' + esc(P.range) + ')</p><p class="t2">-----</p>');
    h = h.replace('Bảng 1. Tổng hợp tiến độ theo thủ tục', 'Bảng 1. Tổng hợp tiến độ theo thủ tục (' + (P.monthTab ? 'số liệu hồ sơ ' + esc(P.label) : 'lũy kế đến ' + esc(m.asOf)) + ')');
    { const mt = monthlyTable(m); if (mt) h = h.replace('<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>', '<p class="cap">' + esc(mt.cap) + '</p>' + htmlTable(mt.head, mt.rows, mt.w) + '<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>'); }
    if (P.hasBase) h = h.replace('<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>', '<p class="cap">' + esc(capOf(m)) + '</p>' + htmlTable(headOf(m), periodRows(m), WID) + '<h2>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC</h2>');
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
    doc = doc.replace(title, P.type === 'all' ? '>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử (Lũy kế đến thời điểm hiện tại)</w:t></w:r></w:p>' : '>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử ' + X(P.label) + '</w:t></w:r></w:p>' + wPara('(' + P.range + ')', { i: true, sz: 24, jc: 'center', after: 20 }));
    doc = doc.replace('>Bảng 1. Tổng hợp tiến độ theo thủ tục<', '>Bảng 1. Tổng hợp tiến độ theo thủ tục (' + (P.monthTab ? 'số liệu hồ sơ ' + X(P.label) : 'lũy kế đến ' + X(m.asOf)) + ')<');
    { const mt = monthlyTable(m); if (mt) { const at = doc.indexOf('>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC<'), p0 = at < 0 ? -1 : doc.lastIndexOf('<w:p>', at); if (p0 >= 0) doc = doc.slice(0, p0) + wPara(mt.cap, { b: true, sz: 24, keep: true, before: 80 }) + wTable(mt.head, mt.rows, mt.w) + doc.slice(p0); } }
    if (P.hasBase) {
      const at = doc.indexOf('>II. KẾT QUẢ TRIỂN KHAI TỪNG THỦ TỤC<'), p0 = at < 0 ? -1 : doc.lastIndexOf('<w:p>', at);
      if (p0 >= 0) doc = doc.slice(0, p0) + wPara(capOf(m), { b: true, sz: 24, keep: true, before: 80 }) + wTable(headOf(m), periodRows(m), WID) + doc.slice(p0);
    }
    return doc;
  }
  root.exportReportDocx = function (m, w) {
    if (!m) return orig.docx(m, w);
    const zip = root.rptZip;
    root.rptZip = function (files) { if (files && files['word/document.xml']) files['word/document.xml'] = m.period ? patchDocXml(files['word/document.xml'], m) : files['word/document.xml'].replace('>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử</w:t>', '>tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử (Lũy kế đến thời điểm hiện tại)</w:t>'); return zip.apply(this, arguments); };
    try { return orig.docx(m, w); } finally { root.rptZip = zip; }
  };

  /* ---------- Excel: tiêu đề có kỳ + thêm trang "Phát sinh trong kỳ" ---------- */
  function periodSheet(m) {
    const P = m.period, T = v => ({ v, s: 4 }), N = v => ({ v: Number(v) || 0, s: 5 }), PC = v => ({ v: Number(v) || 0, s: 6 }), B = v => ({ v, s: 7 }), H = v => ({ v, s: 3 });
    const MT = P.monthTab, head = MT ? ['Thứ tự', 'Thủ tục', 'Đơn vị', 'Tiến độ tháng trước', 'Tiến độ trong tháng', 'Tăng/giảm tiến độ', 'HS tiếp nhận / TK DVC tạo mới', 'HS xử lý / TK ngân hàng tạo mới', 'HS hoàn thành'] : ['Thứ tự', 'Thủ tục', 'Đơn vị', 'Tiến độ đầu kỳ', 'Tiến độ cuối kỳ', 'Tăng/giảm tiến độ', 'HS tiếp nhận mới / TK DVC tạo mới', 'HS xử lý mới / TK ngân hàng tạo mới', 'HS hoàn thành mới'], NA = T('—');
    const rows = [];
    m.procs.filter(x => x.delta).forEach(x => {
      const fee = x.p.kind === 'fee';
      rows.push([B(''), B(x.p.short), B('Cộng thủ tục'), x.base ? { v: x.base.average, s: 9 } : NA, { v: x.t.average, s: 9 }, x.delta.avg == null ? NA : { v: x.delta.avg, s: 9 }, ...(fee ? [N(x.delta.dvc), N(x.delta.bank), T('—')] : [N(x.delta.received), N(x.delta.processed), N(x.delta.done)])]);
      x.rows.forEach((r, k) => rows.push([N(k + 1), T(x.p.short), T(r.u.unit), r.v0 == null ? NA : PC(r.v0), PC(r.v), r.v0 == null ? NA : PC(r.v - r.v0), ...(fee ? [N(r.d.dvc), N(r.d.bank), T('—')] : [N(r.d.received), N(r.d.processed), N(r.d.done)])]));
    });
    return {
      name: MT ? 'Hồ sơ trong tháng' : 'Phát sinh trong kỳ', cols: [6, 28, 40, 13, 13, 13, 18, 18, 14], freeze: 5, filter: 'A5:I' + (5 + rows.length), merges: ['A1:I1', 'A2:I2', 'A3:I3'], heights: { 0: 30, 4: 36 },
      rows: [[{ v: (MT ? 'KẾT QUẢ HỒ SƠ TRONG ' : 'KẾT QUẢ PHÁT SINH TRONG ') + P.label.toUpperCase(), s: 1 }], [{ v: P.range + (MT ? ' — số hồ sơ của chính tháng; tiến độ so với ' + (P.prevTab ? P.prevLabel : 'tháng trước (chưa có số liệu)') : ' — số cuối kỳ trừ số đầu kỳ'), s: 2 }], [{ v: 'Nguồn số liệu: ' + m.source, s: 8 }], [], head.map(H), ...rows]
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

  /* ---------- Báo cáo riêng từng đơn vị (gọn một trang) ---------- */
  const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function unitNames() {
    const set = new Set(); let dd = null; try { dd = typeof data !== 'undefined' ? data : null; } catch (e) { dd = null; }
    ((dd && dd.procedures) || []).forEach(p => (p.units || []).forEach(u => { if (u.unit) set.add(u.unit); }));
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }
  function unitFacts(m, name) {
    const ri = m.ranking.findIndex(r => r.unit === name); if (ri < 0) return null;
    const rk = m.ranking[ri];
    const procs = m.procs.map((x, i) => ({ x, r: (x.rows || []).find(q => q.u.unit === name), v: rk.values[i] }));
    const D = m.dues, dr = D && D.rows.find(q => q.name === name);
    return { ri, rk, procs, D, dr };
  }
  function unitContent(m, name) {
    const f = unitFacts(m, name); if (!f) return null;
    const N = m.ranking.length, avg = f.rk.average, diff = avg - m.avg, P = m.period;
    const when = P ? P.label : 'lũy kế đến thời điểm hiện tại', pc = v => rptPct(v);
    const cs = f.procs.filter(q => q.x.p.kind === 'case'), fee = f.procs.find(q => q.x.p.kind === 'fee');
    const sorted = [...f.procs].sort((a, b) => (b.v || 0) - (a.v || 0));
    const bd = t => '«' + t + '»', num = v => Number(v || 0), own = q => String(q.r && q.r.u.owner || '').trim(), gdd = q => !!(q.r && /^(có|co|x|1|true|☑)/i.test(String(q.r.u.guided || '').trim()));
    const half = f.ri + 1 <= Math.ceil(N / 2), gap = 0.5 - avg;
    const v0s = f.procs.map(q => (P && P.hasBase && q.r && q.r.v0 != null) ? Number(q.r.v0) : null), cmpOK = v0s.length > 0 && v0s.every(v => v != null), avg0 = cmpOK ? v0s.reduce((a, v) => a + v, 0) / v0s.length : null, pl = P ? (P.prevLabel || 'kỳ trước') : '';
    const sd = d => (d > 0.0005 ? '+' : d < -0.0005 ? '−' : '') + pc(Math.abs(d)).replace('%', ''), dd = f.procs.map((q, i) => cmpOK ? num(q.v) - v0s[i] : null);
    const paras = [];
    paras.push((P ? 'Trong ' + when : 'Tính đến thời điểm lập báo cáo') + ', ' + name + ' triển khai thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử, gồm: ' + f.procs.map(q => q.x.p.short).join('; ') + '. Qua số liệu tổng hợp từ hệ thống, đơn vị đạt tiến độ bình quân ' + bd(pc(avg)) + ', xếp hạng ' + bd(fmt(f.ri + 1) + '/' + fmt(N)) + ' đơn vị trực thuộc Tỉnh ủy (thuộc nhóm ' + (half ? 'nửa trên' : 'nửa dưới') + ' của bảng xếp hạng); ' + (diff >= 0 ? 'cao hơn' : 'thấp hơn') + ' mức bình quân chung (' + pc(m.avg) + ') là ' + bd(pc(Math.abs(diff)).replace('%', '') + ' điểm phần trăm') + (gap > 0.0005 ? ', và còn cách ngưỡng 50% là ' + pc(gap).replace('%', '') + ' điểm phần trăm.' : ', đã vượt ngưỡng 50%.'));
    if (cmpOK) { const dA = avg - avg0, up = f.procs.map((q, i) => ({ q, d: dd[i] })).filter(x => x.d > 0.0005).sort((a, b) => b.d - a.d), dn0 = f.procs.map((q, i) => ({ q, d: dd[i] })).filter(x => x.d < -0.0005).sort((a, b) => a.d - b.d), nm = a => a.map(x => '“' + x.q.x.p.short + '” (' + sd(x.d) + ' điểm %)').join('; ');
      paras.push('So với ' + pl + ', tiến độ bình quân của đơn vị ' + (Math.abs(dA) < 0.0005 ? 'không thay đổi, giữ ở mức ' + bd(pc(avg)) : (dA > 0 ? 'tăng từ ' : 'giảm từ ') + pc(avg0) + (dA > 0 ? ' lên ' : ' xuống ') + bd(pc(avg)) + ', tức ' + (dA > 0 ? 'tăng ' : 'giảm ') + bd(pc(Math.abs(dA)).replace('%', '') + ' điểm phần trăm')) + '. ' + (up.length ? 'Thủ tục có chuyển biến tích cực: ' + nm(up) + '. ' : 'Chưa có thủ tục nào cải thiện tiến độ. ') + (dn0.length ? 'Thủ tục giảm so với ' + pl + ': ' + nm(dn0) + '.' : 'Không có thủ tục nào giảm tiến độ.')); }
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    paras.push('Kết quả giữa các thủ tục ' + (num(hi.v) - num(lo.v) >= 0.2 ? 'chênh lệch rõ rệt' : 'tương đối đồng đều') + ': cao nhất là “' + hi.x.p.short + '” đạt ' + bd(pc(hi.v)) + '; thấp nhất là “' + lo.x.p.short + '” đạt ' + bd(pc(lo.v)) + '. Chi tiết từng thủ tục: ' + sorted.map(q => '“' + q.x.p.short + '” ' + pc(q.v)).join('; ') + '.');
    const rc = cs.reduce((a, q) => a + num(q.r ? q.r.u.received : 0), 0), dn = cs.reduce((a, q) => a + num(q.r ? q.r.u.done : 0), 0), nd = cs.reduce((a, q) => a + num(q.r ? q.r.u.need : 0), 0), pend = cs.reduce((a, q) => a + Math.max(0, num(q.r ? q.r.u.need : 0) - num(q.r ? q.r.u.done : 0)), 0);
    if (cs.length) paras.push('Về hồ sơ, ba thủ tục ghi nhận ' + bd(fmt(rc) + ' hồ sơ') + ' tiếp nhận, trong đó có ' + bd(fmt(nd) + ' hồ sơ') + ' phải xử lý; đã xử lý xong ' + bd(fmt(dn) + ' hồ sơ') + (nd > 0 ? ', đạt ' + bd(pc(dn / nd)) + ' số hồ sơ phải xử lý' : '') + '; còn ' + bd(fmt(pend) + ' hồ sơ') + ' chưa hoàn thành.');
    if (f.dr) paras.push('Về thu nộp đảng phí ' + f.D.month + ', có ' + bd(fmt(f.dr.need)) + ' đảng viên thuộc diện phải nộp; đã nộp ' + bd(fmt(f.dr.dn)) + ' đảng viên (' + bd(rptPctD(f.dr.r)) + '); số tiền đã nộp ' + bd(fmt(f.dr.nop) + ' đồng') + '/' + fmt(f.dr.kb) + ' đồng theo hồ sơ đã khai báo; còn ' + fmt(f.dr.chua) + ' đảng viên chưa có hồ sơ.' + (fee && fee.r && fee.r.u.dvctotal != null ? ' Tài khoản dịch vụ công ' + fmt(fee.r.u.dvccreated || 0) + '/' + fmt(fee.r.u.dvctotal || 0) + ', tài khoản ngân hàng ' + fmt(fee.r.u.bankcreated || 0) + '/' + fmt(fee.r.u.banktotal || 0) + '.' : ''));
    /* II. Kết quả từng thủ tục */
    const secs = f.procs.map((q, qi) => {
      const u = q.r ? q.r.u : {}, ps = [], sn = q.x.p.short;
      if (q.x.p.kind === 'fee') {
        if (f.dr) {
          const chua = Math.max(0, num(f.dr.need) - num(f.dr.dn)), tien = num(f.dr.kb) - num(f.dr.nop);
          ps.push('Có ' + bd(fmt(f.dr.need)) + ' đảng viên thuộc diện phải nộp; đã nộp ' + bd(fmt(f.dr.dn)) + ' đảng viên, đạt ' + bd(rptPctD(f.dr.r)) + '. Về số tiền, đã nộp ' + bd(fmt(f.dr.nop) + ' đồng') + '/' + bd(fmt(f.dr.kb) + ' đồng') + ' theo hồ sơ đã khai báo' + (tien > 0 ? '; còn ' + bd(fmt(tien) + ' đồng') + ' chưa nộp' : '') + '. ' + (chua > 0 ? 'Hiện còn ' + bd(fmt(chua)) + ' đảng viên chưa nộp' : 'Toàn bộ đảng viên thuộc diện phải nộp đã hoàn thành nghĩa vụ') + (num(f.dr.chua) === 0 ? '; không còn đảng viên nào chưa có hồ sơ.' : '; trong đó ' + fmt(f.dr.chua) + ' đảng viên chưa có hồ sơ.'));
        }
        if (u.dvctotal != null) { const dv = num(u.dvctotal) - num(u.dvccreated), bk = num(u.banktotal) - num(u.bankcreated); ps.push('Điều kiện thực hiện: tài khoản dịch vụ công ' + fmt(u.dvccreated || 0) + '/' + fmt(u.dvctotal || 0) + (dv > 0 ? ' (còn thiếu ' + fmt(dv) + ')' : ' (đầy đủ)') + '; tài khoản ngân hàng ' + fmt(u.bankcreated || 0) + '/' + fmt(u.banktotal || 0) + (bk > 0 ? ' (còn thiếu ' + fmt(bk) + ')' : ' (đầy đủ)') + '. ' + (dv > 0 || bk > 0 ? 'Việc chưa hoàn tất tài khoản là một trong những yếu tố cần ưu tiên tháo gỡ để đảng viên có thể nộp đảng phí trực tuyến.' : 'Điều kiện nền tảng đã đầy đủ; phần còn lại là đôn đốc đảng viên hoàn tất nghĩa vụ nộp.')); }
      } else {
        const rcv = num(u.received), nd1 = num(u.need), dn1 = num(u.done), pd = Math.max(0, nd1 - dn1);
        if (!rcv && !nd1) ps.push('Trong kỳ báo cáo chưa phát sinh hồ sơ ở thủ tục này; tiến độ phản ánh việc chuẩn bị điều kiện thực hiện (phân công cán bộ, hướng dẫn quy trình).');
        else ps.push('Tiếp nhận ' + bd(fmt(rcv) + ' hồ sơ') + ', phải xử lý ' + bd(fmt(nd1) + ' hồ sơ') + ', đã xử lý xong ' + bd(fmt(dn1) + ' hồ sơ') + (nd1 > 0 ? ' (' + bd(pc(dn1 / nd1)) + ')' : '') + (pd > 0 ? '; còn ' + bd(fmt(pd) + ' hồ sơ') + ' chưa hoàn thành, cần xử lý dứt điểm, không để quá thời hạn quy định.' : '; không còn hồ sơ tồn đọng.'));
      }
      if (cmpOK) ps.push('So với ' + pl + ': tiến độ thủ tục ' + (Math.abs(dd[qi]) < 0.0005 ? 'không thay đổi (' + bd(pc(q.v)) + ')' : (dd[qi] > 0 ? 'tăng từ ' : 'giảm từ ') + pc(v0s[qi]) + (dd[qi] > 0 ? ' lên ' : ' xuống ') + bd(pc(q.v)) + ' (' + sd(dd[qi]) + ' điểm phần trăm)') + '.');
      ps.push('Cán bộ phụ trách: ' + (own(q) || 'chưa phân công') + '; ' + (gdd(q) ? 'đã hướng dẫn quy trình thực hiện.' : 'chưa hướng dẫn quy trình thực hiện.'));
      return { title: sn + ' – tiến độ ' + pc(q.v), paras: ps };
    });
    /* III. Đánh giá chung */
    const good = [], weak = [];
    if (diff >= 0) good.push('Tiến độ bình quân (' + pc(avg) + ') cao hơn bình quân chung ' + pc(Math.abs(diff)).replace('%', '') + ' điểm phần trăm; xếp hạng ' + fmt(f.ri + 1) + '/' + fmt(N) + '.'); else if (half) good.push('Xếp hạng ' + fmt(f.ri + 1) + '/' + fmt(N) + ', thuộc nhóm nửa trên của bảng xếp hạng.');
    f.procs.filter(q => num(q.v) >= 0.9).forEach(q => good.push('Thủ tục “' + q.x.p.short + '” đạt ' + pc(q.v) + '.'));
    if (f.procs.every(q => own(q) && gdd(q))) good.push('Cả 04 thủ tục đều đã có cán bộ phụ trách và đã hướng dẫn quy trình thực hiện.');
    if (f.dr && f.dr.r >= 0.8) good.push('Thu nộp đảng phí đạt ' + rptPctD(f.dr.r) + ' số đảng viên thuộc diện phải nộp.');
    cs.filter(q => q.r && num(q.r.u.need) > 0 && num(q.r.u.done) >= num(q.r.u.need)).forEach(q => good.push('Đã xử lý xong toàn bộ ' + fmt(q.r.u.need) + ' hồ sơ thủ tục “' + q.x.p.short + '”.'));
    if (cmpOK && avg - avg0 > 0.0005) good.push('Tiến độ bình quân tăng ' + pc(avg - avg0).replace('%', '') + ' điểm phần trăm so với ' + pl + '.');
    if (!good.length) good.push('Đơn vị đã bước đầu triển khai các thủ tục trên hệ thống theo dõi.');
    if (cmpOK && avg - avg0 < -0.0005) weak.push('Tiến độ bình quân giảm ' + pc(avg0 - avg).replace('%', '') + ' điểm phần trăm so với ' + pl + '.');
    f.procs.forEach((q, i) => { if (cmpOK && dd[i] < -0.0005) weak.push('Thủ tục “' + q.x.p.short + '” giảm ' + pc(-dd[i]).replace('%', '') + ' điểm phần trăm so với ' + pl + '.'); });
    if (gap > 0.0005) weak.push('Tiến độ bình quân ' + pc(avg) + ' chưa đạt ngưỡng 50%.');
    f.procs.filter(q => num(q.v) < 0.5 && !(q.x.p.kind === 'case' && q.r && num(q.r.u.need) > num(q.r.u.done))).forEach(q => weak.push('Thủ tục “' + q.x.p.short + '” mới đạt ' + pc(q.v) + '.'));
    cs.filter(q => q.r && num(q.r.u.need) > num(q.r.u.done)).forEach(q => weak.push('Thủ tục “' + q.x.p.short + '” còn ' + fmt(num(q.r.u.need) - num(q.r.u.done)) + '/' + fmt(q.r.u.need) + ' hồ sơ phải xử lý chưa hoàn thành.'));
    if (f.dr && f.dr.r < 0.95) weak.push('Còn ' + fmt(num(f.dr.need) - num(f.dr.dn)) + ' đảng viên chưa nộp đảng phí (tỷ lệ đã nộp ' + rptPctD(f.dr.r) + ').');
    const noOw = f.procs.filter(q => !own(q)).map(q => '“' + q.x.p.short + '”'), noGu = f.procs.filter(q => !gdd(q)).map(q => '“' + q.x.p.short + '”');
    if (noOw.length) weak.push('Chưa phân công cán bộ phụ trách thủ tục: ' + noOw.join(', ') + '.');
    if (noGu.length) weak.push('Chưa hướng dẫn quy trình thực hiện thủ tục: ' + noGu.join(', ') + '.');
    const owners = [...new Set(cs.map(own).filter(Boolean))];
    if (cs.length > 1 && owners.length === 1 && pend > 0) weak.push('Cả ba thủ tục về hồ sơ do một cán bộ phụ trách (' + owners[0] + ') trong khi còn ' + fmt(pend) + ' hồ sơ tồn; cần xem xét tải công việc và cơ chế phối hợp.');
    if (!weak.length) weak.push('Chưa ghi nhận tồn tại, hạn chế đáng kể trên hệ thống trong kỳ báo cáo.');
    const head = ['Thủ tục', 'Tiến độ bình quân', ...(cmpOK ? ['Tiến độ ' + pl, 'Tăng/giảm (điểm phần trăm)'] : []), 'Hồ sơ tiếp nhận', 'Hồ sơ phải xử lý', 'Hồ sơ xử lý xong', 'Cán bộ phụ trách', 'Đã hướng dẫn', 'Trạng thái'];
    const rows = f.procs.map((q, qi) => { const u = q.r ? q.r.u : {}, isC = q.x.p.kind === 'case'; return [q.x.p.short, pc(q.v), ...(cmpOK ? [pc(v0s[qi]), sd(dd[qi])] : []), isC ? fmt(u.received || 0) : '—', isC ? fmt(u.need || 0) : '—', isC ? fmt(u.done || 0) : '—', String(u.owner || '').trim() || 'Chưa phân công', u.guided || 'Chưa', q.r ? q.r.st : '—']; });
    const rec = [];
    if (noOw.length) rec.push('«Phân công cán bộ phụ trách» đối với thủ tục: ' + noOw.join(', ') + '.');
    if (noGu.length) rec.push('«Hướng dẫn quy trình» thực hiện tới chi bộ, đảng viên đối với thủ tục: ' + noGu.join(', ') + '.');
    cs.filter(q => q.r && num(q.r.u.need) > num(q.r.u.done)).forEach(q => rec.push('Thủ tục «“' + q.x.p.short + '”»: xử lý dứt điểm ' + fmt(num(q.r.u.need) - num(q.r.u.done)) + '/' + fmt(q.r.u.need) + ' hồ sơ phải xử lý còn tồn; lập danh sách, phân loại theo thời hạn, ưu tiên hồ sơ sắp và đã quá hạn, không để quá thời hạn quy định.'));
    if (f.dr && f.dr.r < 0.95) rec.push('Thu nộp đảng phí: đôn đốc ' + fmt(num(f.dr.need) - num(f.dr.dn)) + ' đảng viên chưa nộp (tỷ lệ đã nộp ' + rptPctD(f.dr.r) + '); giao các chi bộ rà soát, hướng dẫn kê khai, duyệt hồ sơ và nộp đảng phí trên môi trường điện tử ngay trong ' + f.D.month + '.');
    if (fee && fee.r && num(fee.r.u.dvccreated) < num(fee.r.u.dvctotal)) rec.push('Hoàn tất tạo tài khoản dịch vụ công cho ' + fmt(num(fee.r.u.dvctotal) - num(fee.r.u.dvccreated)) + ' đảng viên còn thiếu.');
    if (fee && fee.r && num(fee.r.u.bankcreated) < num(fee.r.u.banktotal)) rec.push('Hoàn tất tạo tài khoản ngân hàng cho ' + fmt(num(fee.r.u.banktotal) - num(fee.r.u.bankcreated)) + ' đảng viên còn thiếu.');
    if (rec.length) rec.push('Cán bộ phụ trách thường xuyên theo dõi, cập nhật số liệu trên hệ thống; báo cáo kịp thời những vướng mắc để được chỉ đạo, tháo gỡ.');
    else rec.push('Tiếp tục duy trì kết quả đã đạt, theo dõi và cập nhật đầy đủ số liệu trên hệ thống theo dõi.');
    return { name, when, paras, secs, good, weak, head, rows, rec, f };
  }
  const bdh = t => esc(t).replace(/«/g, '<b>').replace(/»/g, '</b>'), nb = t => String(t).replace(/[«»]/g, '');
  const htmlCache = new WeakMap();
  const baseHtml = m => { let h = htmlCache.get(m); if (h == null) { h = orig.html(m); htmlCache.set(m, h); } return h; };
  function unitSection(m, c, forDoc) {
    const P = m.period, base = baseHtml(m);
    const hd = base.slice(base.indexOf('<div class="hd">'), base.indexOf('<div class="gap">'));
    const widths = c.head.length > 8 ? [1700, 750, 800, 850, 850, 850, 850, 1400, 700, 1000] : [1900, 800, 1000, 1000, 1000, 1700, 800, 1100];
    const num = n => String(n);
    return '<section class="page">\n' + hd + '<div class="gap"></div>\n<p class="t1">BÁO CÁO</p><p class="t2">tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử</p><p class="t2"><b>' + esc(c.name) + '</b></p><p class="t2">' + esc(c.when) + '</p>' + (P && P.range ? '<p class="meta" style="margin:0 0 1pt;font-size:12pt;color:#000">(' + esc(P.range) + ')</p>' : '') + '<p class="t2">-----</p>' + '<p class="meta" style="text-align:center">Xuất báo cáo lúc <span id="rptStamp">' + nowStamp() + '</span></p>' +
      '<h2>I. TÌNH HÌNH CHUNG</h2>' + c.paras.map(t => '<p class="i">' + bdh(t) + '</p>').join('') +
      '<p class="cap">Bảng 1. Kết quả thực hiện 04 thủ tục hành chính của ' + esc(c.name) + '</p>' + htmlTable(c.head, c.rows, widths) +
      '<h2>II. KẾT QUẢ THỰC HIỆN TỪNG THỦ TỤC</h2>' + c.secs.map((x, i) => '<h3>' + (i + 1) + '. ' + esc(x.title) + '</h3>' + x.paras.map(t => '<p class="i">' + bdh(t) + '</p>').join('')).join('') +
      '<h2>III. ĐÁNH GIÁ CHUNG</h2><h3>1. Ưu điểm</h3>' + c.good.map(t => '<p class="i">- ' + bdh(t) + '</p>').join('') + '<h3>2. Tồn tại, hạn chế</h3>' + c.weak.map(t => '<p class="i">- ' + bdh(t) + '</p>').join('') +
      '<h2>IV. ĐỀ XUẤT, KIẾN NGHỊ</h2>' + c.rec.map(t => '<p class="i">- ' + bdh(t) + '</p>').join('') +
      '<div class="sign"><div class="l"><u>Nơi nhận:</u><br><span>- Thường trực Tỉnh ủy (b/c);<br>- Văn phòng Tỉnh ủy;<br>- ' + esc(c.name) + ';<br>- Lưu.</span></div><div class="r"><div class="stamp">' + rptStampSvg() + '</div></div></div></section>';
  }
  const nowStamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return z(d.getHours()) + ':' + z(d.getMinutes()) + ' ' + z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear(); };
  function unitSlug(name) { return fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function unitPage(m, name) {
    const c = unitContent(m, name); if (!c) return null;
    const base = root.rptHTML(m), pre = base.slice(0, base.indexOf('<section class="page">'));
    return { c, page: pre + unitSection(m, c) + '\n</body></html>' };
  }
  function wordHtml(m, c) {
    const base = baseHtml(m), style = (base.match(/<style>[\s\S]*?<\/style>/) || [''])[0].replace('</style>', '.page{width:auto!important;margin:0!important;padding:0!important;box-shadow:none!important}.bar{display:none}@page{size:A4;margin:2cm 2cm 2cm 3cm}</style>');
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Báo cáo ' + esc(c.name) + '</title>' + style + '</head><body>' + unitSection(m, c, true) + '</body></html>';
    return '\uFEFF' + html.replace(/<svg[\s\S]*?<\/svg>/g, () => "<div style=\"font:bold 14pt Arial;color:#1e8e3e;text-align:center\">✔ Signature Valid</div><div style=\"font-size:10pt;text-align:center\">Ký bởi: <b style=\"color:#c00000\">HỆ THỐNG TỰ ĐỘNG</b></div><div style=\"font-size:10pt;text-align:center\">Ngày ký: " + rptStampTime() + "</div>");
  }
  function unitWord(m, c, win) {
    root.rptDownload(new Blob([wordHtml(m, c)], { type: 'application/msword' }), 'bao-cao-' + unitSlug(c.name) + '_' + m.fileStamp + '.doc', win);
  }
  /* Tải toàn bộ báo cáo đơn vị trong tỉnh: mỗi đơn vị một file Word (.doc), gộp trong một file .zip */
  async function allUnitsZip(m, win, btn) {
    const names = m.ranking.map(r => r.unit).filter(Boolean), files = {}, used = new Set(), label = btn.textContent;
    btn.disabled = true;
    try {
      for (let i = 0; i < names.length; i++) {
        if (win.closed) return;
        const c = unitContent(m, names[i]); if (!c) continue;
        let fn = 'bao-cao-' + (unitSlug(c.name) || 'don-vi-' + (i + 1)); while (used.has(fn)) fn += '-' + (i + 1); used.add(fn);
        files[fn + '.doc'] = wordHtml(m, c);
        btn.textContent = 'Đang tạo ' + (i + 1) + '/' + names.length + '…';
        if (i % 3 === 2) await new Promise(r => setTimeout(r, 0));
      }
      if (!Object.keys(files).length) throw new Error('Không có báo cáo đơn vị nào để tải.');
      root.rptDownload(root.rptZip(files, 'application/zip'), 'bao-cao-cac-don-vi_' + m.fileStamp + '.zip', win);
    } catch (e) { console.error(e); win.alert('Không tải được: ' + ((e && e.message) || e)); }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  /* PDF toàn bộ đơn vị: gộp báo cáo của mọi đơn vị trong một tài liệu (mỗi đơn vị một trang mới), mở hộp thoại in để lưu thành một file PDF */
  function allUnitsPdf(m, win, btn) {
    const names = m.ranking.map(r => r.unit).filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')), label = btn.textContent;
    const w2 = win.open('', '_blank'); if (!w2) { win.alert('Trình duyệt đang chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên rồi thử lại.'); return; }
    try {
      btn.disabled = true; btn.textContent = 'Đang gộp ' + names.length + ' đơn vị…';
      const base = root.rptHTML(m), pre = base.slice(0, base.indexOf('<section class="page">')), at = pre.indexOf('<div class="bar">');
      const name = 'bao-cao-cac-don-vi_' + m.fileStamp;
      const head = (at < 0 ? pre : pre.slice(0, at)).replace(/<title>[\s\S]*?<\/title>/, '<title>' + name + '</title>');
      const bar = '<div class="bar"><b>📄 Báo cáo ' + names.length + ' đơn vị – ' + esc(m.period && m.period.label || '') + '</b><span class="sp"></span><button class="b-pdf" type="button" onclick="window.print()">🖨 In / Lưu PDF</button><div class="tip">Chọn “Lưu dưới dạng PDF”, khổ A4, tắt mục “Đầu trang và chân trang”. Mỗi đơn vị bắt đầu một trang mới.</div></div>';
      let body = '', n = 0; const toc = [];
      for (const nm of names) { const c = unitContent(m, nm); if (!c) continue; n++; toc.push('<li><a href="#u-' + n + '">' + esc(c.name) + '</a></li>'); body += unitSection(m, c).replace('<section class="page">', '<section class="page" id="u-' + n + '">'); }
      if (!n) throw new Error('Không có báo cáo đơn vị nào.');
      const tocHtml = '<section class="page" id="muc-luc"><p class="t1">MỤC LỤC</p><p class="t2" style="white-space:nowrap"><b>Báo cáo ' + n + ' đơn vị – ' + esc(m.period && m.period.label || '') + '</b></p><p class="meta" style="text-align:center;white-space:nowrap;font-size:10pt;margin:0 0 4pt">(xếp theo tên; bấm vào tên đơn vị để tới báo cáo)</p><ol style="columns:2;column-gap:24px;font-size:11pt;line-height:1.5;margin-top:12px">' + toc.join('') + '</ol></section>';
      w2.document.open(); w2.document.write(head + bar + tocHtml + body + '\n</body></html>'); w2.document.close();
      setTimeout(() => { try { w2.focus(); w2.print(); } catch (e) { /* người dùng bấm In thủ công */ } }, 800);
    } catch (e) { console.error(e); try { w2.close(); } catch (_) { /* đã đóng */ } win.alert('Không gộp được PDF: ' + ((e && e.message) || e)); }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  /* PDF từng đơn vị (pdfmake tự lưu trong vendor/pdfmake), gộp trong một file .zip */
  const ASSET = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : location.href;
  const loadJs = u => new Promise((ok, no) => { const e = document.createElement('script'); e.src = new URL(u, ASSET).href; e.onload = ok; e.onerror = () => no(new Error('Không tải được ' + u)); document.head.appendChild(e); });
  let pdfLib = null;
  const needPdfLib = () => pdfLib || (pdfLib = (async () => { if (!root.pdfMake) { await loadJs('vendor/pdfmake/pdfmake.min.js'); await loadJs('vendor/pdfmake/vfs_fonts.js'); } if (!root.rptUnitPdfDoc) await loadJs('report-pdf.js'); })().catch(e => { pdfLib = null; throw e; }));
  const pdfBytes = def => new Promise((ok, no) => { try { root.pdfMake.createPdf(def).getBuffer(b => ok(b instanceof Uint8Array ? b : new Uint8Array(b))); } catch (e) { no(e); } });
  async function allUnitsPdfZip(m, win, btn) {
    const names = m.ranking.map(r => r.unit).filter(Boolean), entries = [], used = new Set(), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Đang tải bộ tạo PDF…';
    try {
      await needPdfLib();
      const base = baseHtml(m), dl = (base.match(/<p><i>([^<]*)<\/i><\/p>/) || [])[1] || '', P = m.period;
      const o = { dateLine: dl.replace(/&amp;/g, '&'), range: P && P.range || '', stamp: nowStamp(), signTime: rptStampTime() };
      for (let i = 0; i < names.length; i++) {
        if (win.closed) return;
        const c = unitContent(m, names[i]); if (!c) continue;
        let fn = 'bao-cao-' + (unitSlug(c.name) || 'don-vi-' + (i + 1)); while (used.has(fn)) fn += '-' + (i + 1); used.add(fn);
        entries.push({ name: fn + '_' + m.fileStamp + '.pdf', data: await pdfBytes(root.rptUnitPdfDoc(c, o)) });
        btn.textContent = 'Đang tạo PDF ' + (i + 1) + '/' + names.length + '…';
      }
      if (!entries.length) throw new Error('Không có báo cáo đơn vị nào để tải.');
      root.rptDownload(root.rptZipBytes(entries), 'bao-cao-pdf-cac-don-vi_' + m.fileStamp + '.zip', win);
    } catch (e) { console.error(e); win.alert('Không tạo được PDF: ' + ((e && e.message) || e)); }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  function addZipBtn(win, m) {
    const d = win.document, bar = d.querySelector('.bar'); if (!bar || d.getElementById('rptZipAll')) return;
    const b = d.createElement('button'); b.type = 'button'; b.id = 'rptZipAll'; b.textContent = '⬇ Tải tất cả đơn vị (.zip)';
    b.title = 'Tải báo cáo Word của toàn bộ ' + m.ranking.length + ' đơn vị trong tỉnh, gộp trong một file nén'; b.style.cssText = 'background:#7b3fb0;color:#fff';
    bar.insertBefore(b, bar.querySelector('.tip')); b.onclick = () => allUnitsZip(m, win, b);
    const p = d.createElement('button'); p.type = 'button'; p.id = 'rptPdfAll'; p.textContent = '🖨 PDF tất cả đơn vị';
    p.title = 'Gộp báo cáo của toàn bộ ' + m.ranking.length + ' đơn vị thành một file PDF (mỗi đơn vị một trang mới)'; p.style.cssText = 'background:#b3261e;color:#fff';
    bar.insertBefore(p, bar.querySelector('.tip')); p.onclick = () => allUnitsPdf(m, win, p);
    const q = d.createElement('button'); q.type = 'button'; q.id = 'rptPdfZip'; q.textContent = '⬇ PDF từng đơn vị (.zip)';
    q.title = 'Mỗi đơn vị một file PDF riêng, gộp trong một file nén; tên file theo tên đơn vị'; q.style.cssText = 'background:#c2410c;color:#fff';
    bar.insertBefore(q, bar.querySelector('.tip')); q.onclick = () => allUnitsPdfZip(m, win, q);
  }
  function unitXlsx(m, c, win) {
    const T = v => ({ v, s: 4 }), H = v => ({ v, s: 3 }), L = String.fromCharCode(64 + c.head.length);
    const rows = [[{ v: 'BÁO CÁO TÌNH HÌNH THỰC HIỆN 04 THỦ TỤC HÀNH CHÍNH — ' + c.name.toUpperCase(), s: 1 }], [{ v: c.when + (m.period && m.period.range ? ' (' + m.period.range + ')' : ''), s: 2 }], [{ v: 'Nguồn số liệu: ' + m.source + ' · Xuất báo cáo lúc ' + nowStamp(), s: 8 }], [], c.head.map(H), ...c.rows.map(r => r.map(T)), [], ...c.paras.map(t => [{ v: nb(t), s: 8 }]), [], [{ v: 'Kết quả từng thủ tục', s: 7 }], ...[].concat(...c.secs.map(x => [[{ v: x.title, s: 7 }], ...x.paras.map(t => [{ v: nb(t), s: 8 }])])), [], [{ v: 'Ưu điểm', s: 7 }], ...c.good.map(t => [{ v: '- ' + nb(t), s: 8 }]), [{ v: 'Tồn tại, hạn chế', s: 7 }], ...c.weak.map(t => [{ v: '- ' + nb(t), s: 8 }]), [], [{ v: 'Đề xuất, kiến nghị', s: 7 }], ...c.rec.map(t => [{ v: '- ' + nb(t), s: 8 }])];
    const sheet = { name: 'Báo cáo đơn vị', rows, cols: c.head.length > 8 ? [30, 12, 14, 14, 16, 16, 16, 26, 14, 18] : [30, 12, 16, 16, 16, 26, 14, 18], freeze: 5, filter: 'A5:' + L + (5 + c.rows.length), merges: ['A1:' + L + '1', 'A2:' + L + '2', 'A3:' + L + '3'], heights: { 0: 30, 4: 36 } };
    root.rptDownload(root.rptXlsxBlob([sheet]), 'bao-cao-' + unitSlug(c.name) + '_' + m.fileStamp + '.xlsx', win);
  }

  /* ---------- Cửa sổ báo cáo + bộ chọn kỳ ---------- */
  function msgPage(title, msg) {
    return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{margin:0;background:#e9edf3;font:14px "Segoe UI",Arial,sans-serif;color:#1f2f45}.bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 18px;background:linear-gradient(110deg,#7d0c13,#b3111b 55%,#d0412b);color:#fff}' + PICKER_CSS +
      '.box{max-width:640px;margin:60px auto;padding:28px 32px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(20,30,50,.15);line-height:1.6}</style></head><body><div class="bar"><b>📄 Báo cáo tiến độ 04 thủ tục hành chính</b>' + PICKER + '</div><div class="box"><b>' + esc(title) + '</b><p>' + esc(msg) + '</p></div></body></html>';
  }
  function bindPicker(win, per, unit) {
    const d = win.document, t = d.getElementById('rptType'), n = d.getElementById('rptNum'), y = d.getElementById('rptYear'), go = d.getElementById('rptApply'), un = d.getElementById('rptUnit');
    if (!t) return;
    const now = new Date(), Y = now.getFullYear(), cur = ty => ty === 'quarter' ? Math.floor(now.getMonth() / 3) + 1 : now.getMonth() + 1;
    y.innerHTML = [Y, Y - 1].map(v => '<option value="' + v + '">Năm ' + v + '</option>').join('');
    const fill = () => {
      const ty = t.value; y.style.display = ty === 'all' ? 'none' : ''; n.style.display = ty === 'all' || ty === 'year' ? 'none' : '';
      n.innerHTML = ty === 'quarter' ? [1, 2, 3, 4].map(q => '<option value="' + q + '">Quý ' + ROMAN[q - 1] + '</option>').join('') : Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '">Tháng ' + (i + 1) + '</option>').join('');
    };
    t.value = per.type; fill(); y.value = String(per.y || Y); n.value = String(per.n || cur(t.value));
    if (un) {
      const names = unitNames(), uq = d.getElementById('rptUnitQ');
      const fill = (q, keep) => { const k = fold(q).trim(), list = k ? names.filter(v => fold(v).includes(k)) : names; un.innerHTML = '<option value="">Toàn tỉnh (tất cả đơn vị)</option>' + list.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join(''); if (keep != null) un.value = keep; return list; };
      fill('', unit || ''); un.onchange = () => apply();
      if (uq) {
        uq.oninput = () => { const list = fill(uq.value, ''); if (uq.value && list.length) un.selectedIndex = 1; };
        uq.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const list = fill(uq.value, ''); if (list.length) { un.value = list[0]; apply(); } } };
      }
    }
    const apply = () => render(win, period(t.value, y.value, n.value), un ? un.value : '');   // đổi lựa chọn là lập lại ngay
    t.onchange = () => { fill(); n.value = String(cur(t.value)); apply(); };
    n.onchange = y.onchange = go.onclick = apply;
  }
  async function render(win, per, unit) {
    let ctx = null;
    const write = html => { win.document.open(); win.document.write(html); win.document.close(); };
    {
      write(msgPage('Đang lập báo cáo ' + per.label + '…', 'Đang đọc số liệu lưu trữ đầu kỳ, cuối kỳ và số liệu đảng phí từ Google Sheets.')); bindPicker(win, per, unit);
      try { await loadFirstDone().catch(() => { root.__firstDone = null; }); ctx = await context(per); } catch (e) { console.error(e); if (win.closed) return; write(msgPage('Không lập được báo cáo ' + per.label, (e && e.message) || String(e))); bindPicker(win, per, unit); return; }
      if (win.closed) return;
    }
    const m = root.buildReportModel(ctx);
    if (unit) {
      const up = unitPage(m, unit);
      if (up) {
        write(up.page); const dd = win.document;
        dd.getElementById('rptPrint').onclick = () => { const e = dd.getElementById('rptStamp'); if (e) e.textContent = nowStamp(); win.print(); };
        dd.getElementById('rptXlsx').onclick = () => { try { unitXlsx(m, up.c, win); } catch (e) { console.error(e); win.alert('Không xuất được Excel: ' + ((e && e.message) || e)); } };
        dd.getElementById('rptDocx').onclick = () => { try { unitWord(m, up.c, win); } catch (e) { console.error(e); win.alert('Không xuất được Word: ' + ((e && e.message) || e)); } };
        addZipBtn(win, m); bindPicker(win, per, unit); return;
      }
    }
    write(root.rptHTML(m));
    const d = win.document;
    d.getElementById('rptPrint').onclick = () => win.print();
    d.getElementById('rptXlsx').onclick = () => { try { root.exportReportXlsx(m, win); } catch (e) { console.error(e); win.alert('Không xuất được Excel: ' + ((e && e.message) || e)); } };
    d.getElementById('rptDocx').onclick = () => { try { root.exportReportDocx(m, win); } catch (e) { console.error(e); win.alert('Không xuất được Word: ' + ((e && e.message) || e)); } };
    addZipBtn(win, m); bindPicker(win, per, unit);
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
