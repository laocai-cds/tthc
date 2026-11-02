/*
 * DuesRanking – "Bảng xếp hạng thu đảng phí trong kỳ": popup 103 đơn vị (nút dưới thẻ Top 03 đơn vị hoàn thành thu đảng phí).
 *
 * Kỳ = tháng đang chọn ở bộ chọn tháng đảng phí (DuesMonth); kỳ trước = tháng liền trước.
 * Tỷ lệ nộp = (8) ÷ ((2)+(3)−(4)−(5)), cùng công thức thẻ Top 03; "So với kỳ trước" = chênh lệch điểm %.
 * Hạng liên tục 1, 2, 3…: xếp theo tỷ lệ, cùng tỷ lệ thì số tiền đã nộp nhiều hơn, rồi số đảng viên đã nộp nhiều hơn; tìm kiếm theo tên đơn vị (không dấu) và lọc theo nhóm tỷ lệ.
 */
(function (root) {
  'use strict';
  const card = document.getElementById('top3Dues');
  if (!card || document.getElementById('duesRankOpen')) return;

  const SHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';
  const TITLE = 'Bảng xếp hạng thu đảng phí trong kỳ';
  const GROUPS = [
    { id: 'all', label: 'Tất cả', test: () => true },
    { id: 'a', label: 'Từ 95%', cls: 'ga', test: r => r >= 95 },
    { id: 'b', label: '80 – dưới 95%', cls: 'gb', test: r => r >= 80 && r < 95 },
    { id: 'c', label: '50 – dưới 80%', cls: 'gc', test: r => r >= 50 && r < 80 },
    { id: 'd', label: '20 – dưới 50%', cls: 'gd', test: r => r >= 20 && r < 50 },
    { id: 'e', label: 'Dưới 20%', cls: 'ge', test: r => r > 0 && r < 20 },
    { id: 'z', label: 'Chưa nộp (0%)', cls: 'gz', test: r => r <= 0 }
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pct = n => (Math.round(n * 100) / 100).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
  const groupOf = r => GROUPS.slice(1).find(g => g.test(r));
  const cellText = c => String(c ? (c.v != null ? c.v : (c.f != null ? c.f : '')) : '').trim();
  const cellNum = c => { if (!c) return 0; if (typeof c.v === 'number') return c.v; const s = String(c.f != null ? c.f : (c.v != null ? c.v : '')).replace(/[^\d-]/g, ''); return s ? parseInt(s, 10) : 0; };

  /* ---------- Dữ liệu ---------- */
  const keyOf = (y, m) => y + '-' + String(m).padStart(2, '0');
  const prevKey = k => { const y = +k.slice(0, 4), m = +k.slice(5); return m === 1 ? keyOf(y - 1, 12) : keyOf(y, m - 1); };
  const monthLabel = k => 'tháng ' + (+k.slice(5)) + '/' + k.slice(0, 4);
  function tabFor(k) {
    const dm = root.DuesMonth, y = +k.slice(0, 4), m = +k.slice(5);
    try { const t = dm && dm.sourceFor(k).spec.tab; if (t) return t; } catch (e) { /* dùng tên tab mặc định */ }
    return 'Thang' + m + (y === 2026 ? '' : '_' + y);
  }
  function fetchTab(tab) {
    return new Promise(resolve => {
      const cb = '__duesRank_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = v => { if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove(); resolve(v); };
      const timer = setTimeout(() => finish(null), 20000);
      root[cb] = p => finish(p && p.table ? p : null);
      sc.onerror = () => finish(null);
      sc.src = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&sheet=' + encodeURIComponent(tab) + '&headers=2&_=' + Date.now();
      sc.async = true; document.head.appendChild(sc);
    });
  }
  function parse(p) {
    const rows = ((p && p.table && p.table.rows) || []).map(r => r.c || [])
      .filter(c => /^\d+$/.test(cellText(c[0]).replace(/\.0$/, '')) && cellText(c[1]))
      .map(c => {
        const d = { name: cellText(c[1]), t: cellNum(c[2]), ct: cellNum(c[3]), tt: cellNum(c[4]), chuyen: cellNum(c[5]), mien: cellNum(c[6]), dn: cellNum(c[9]), nop: cellNum(c[12]) };
        d.need = Math.max(0, d.ct + d.tt - d.chuyen - d.mien);
        d.rate = d.need > 0 ? Math.min(100, d.dn / d.need * 100) : 0;
        return d;
      }).filter(d => d.t > 0);
    return rows.length ? rows : null;
  }
  async function load(k) {
    const pk = prevKey(k);
    const [cur, prev] = await Promise.all([fetchTab(tabFor(k)).then(parse), fetchTab(tabFor(pk)).then(parse)]);
    if (!cur) throw new Error('Chưa đọc được số liệu đảng phí ' + monthLabel(k) + '.');
    const before = new Map((prev || []).map(d => [norm(d.name), d]));
    const rows = cur.map(d => { const b = before.get(norm(d.name)); return Object.assign({}, d, { prev: b ? b.rate : null, diff: b ? d.rate - b.rate : null }); })
      .sort((a, b) => Math.round(b.rate * 100) - Math.round(a.rate * 100) || b.nop - a.nop || b.dn - a.dn || a.name.localeCompare(b.name, 'vi'));
    rows.forEach((r, i) => { r.rank = i + 1; r.key = norm(r.name); });   // hạng liên tục: cùng tỷ lệ thì nhiều tiền hơn, rồi nhiều đảng viên đã nộp hơn
    return { k, pk, rows, hasPrev: !!prev };
  }

  /* ---------- Giao diện ---------- */
  const css = document.createElement('style');
  css.id = 'dues-ranking-css';
  css.textContent = [
    '.dr-open{flex:none;display:flex;width:100%;justify-content:center;align-items:center;gap:6px;margin-top:6px;border:1px solid #efc98a;background:linear-gradient(135deg,#fff7e6,#ffe9c2);color:#b4400e;font-family:inherit;font-weight:700;font-size:10.5px;line-height:1.2;padding:5px 10px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:transform .15s,box-shadow .15s}',
    '.dr-open:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(214,120,20,.25);border-color:#e3a84a}.dr-open:focus-visible{outline:2px solid #e3a84a;outline-offset:2px}',
    '.dr-ov{position:fixed;inset:0;z-index:10060;display:none;place-items:center;padding:16px;background:rgba(10,24,46,.62);backdrop-filter:blur(3px)}.dr-ov.open{display:grid}',
    '.dr-panel{width:min(920px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(10,24,46,.45);overflow:hidden;font-family:inherit;color:#1f2f45}',
    '.dr-head{display:flex;align-items:flex-start;gap:12px;padding:16px 18px 12px;background:linear-gradient(110deg,#8f0b12,#c51620 60%,#e15a36);color:#fff}',
    '.dr-head h2{margin:0;font-size:17px;line-height:1.3}.dr-head .dr-sub{margin-top:3px;font-size:11.5px;opacity:.9}.dr-head .sp{flex:1}',
    '.dr-x{flex:none;width:32px;height:32px;border:0;border-radius:9px;background:rgba(255,255,255,.18);color:#fff;font-size:18px;cursor:pointer}.dr-x:hover{background:rgba(255,255,255,.3)}',
    '.dr-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 18px;border-bottom:1px solid #eef0f4;background:#fbfbfd}',
    '.dr-search{flex:1 1 220px;min-width:0;height:34px;border:1px solid #dfe4eb;border-radius:9px;padding:0 12px;font-family:inherit;font-size:13px;outline:0}.dr-search:focus{border-color:#c51620;box-shadow:0 0 0 3px rgba(197,22,32,.12)}',
    '.dr-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.dr-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid #e1e5ec;border-radius:999px;background:#fff;color:#45566d;font-family:inherit;font-weight:600;font-size:12px;cursor:pointer}',
    '.dr-chip b{min-width:18px;padding:1px 6px;border-radius:999px;background:#eef1f6;font-size:11px;text-align:center}.dr-chip i{width:9px;height:9px;border-radius:50%}',
    '.dr-chip.on{border-color:#c51620;background:#fff1f1;color:#a90e17}.dr-chip.on b{background:#c51620;color:#fff}',
    '.dr-body{overflow:auto;flex:1}',
    '.dr-tb{width:100%;border-collapse:collapse;font-size:13px}',
    '.dr-tb th{position:sticky;top:0;z-index:1;background:#f4f6fa;color:#5d6d83;font-size:11.5px;font-weight:700;text-align:left;padding:9px 12px;border-bottom:1px solid #e6e9ef;white-space:nowrap}',
    '.dr-panel .dr-tb td{padding:8px 12px;border-bottom:1px solid #f0f2f6;vertical-align:middle;font-size:13px;line-height:1.35;color:#1f2f45}.dr-tb tr:hover td{background:#fffaf3}',
    '.dr-tb .c{text-align:center}.dr-tb .r{text-align:right;white-space:nowrap}',
    '.dr-rk{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 6px;border-radius:999px;background:#eef1f6;color:#45566d;font-weight:800;font-size:12px}',
    '.dr-rk.g1{background:linear-gradient(135deg,#ffe07a,#f2b51e);color:#6b4a00}.dr-rk.g2{background:linear-gradient(135deg,#eef2f7,#c4ccd8);color:#3c4a5c}.dr-rk.g3{background:linear-gradient(135deg,#f6c9a4,#d98c55);color:#5a2c08}',
    '.dr-rate{display:flex;align-items:center;gap:8px;min-width:170px}.dr-rate b{min-width:58px;text-align:right;font-variant-numeric:tabular-nums}',
    '.dr-bar{flex:1;height:7px;border-radius:99px;background:#eef1f6;overflow:hidden}.dr-bar i{display:block;height:100%;border-radius:99px}',
    '.dr-d{font-weight:700;font-variant-numeric:tabular-nums}.dr-d.up{color:#0d8a62}.dr-d.dn{color:#c5302a}.dr-d.eq{color:#8290a2}.dr-d small{display:block;font-weight:400;color:#8290a2;font-size:11px}',
    '.dr-panel .ga{--gc:#0d8a62}.dr-panel .gb{--gc:#2f6df0}.dr-panel .gc{--gc:#d99412}.dr-panel .gd{--gc:#e07b2f}.dr-panel .ge{--gc:#e0623f}.dr-panel .gz{--gc:#9aa7b8}',
    '.dr-bar i,.dr-chip i{background:var(--gc)}',
    '.dr-empty{padding:28px;text-align:center;color:#8290a2}',
    '.dr-foot{padding:9px 18px;border-top:1px solid #eef0f4;font-size:11px;color:#728198;background:#fbfbfd}',
    '@media(max-width:760px){.dr-panel{max-height:calc(100vh - 16px)}.dr-ov{padding:8px}.dr-panel .dr-tb th,.dr-panel .dr-tb td{padding:7px 8px;font-size:12px}.dr-rate{min-width:0}.dr-rate b{min-width:0}.dr-bar{display:none}.dr-hide-sm{display:none}.dr-head h2{font-size:15px}}'
  ].join('\n');
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'dr-open'; btn.id = 'duesRankOpen'; btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = '📊 ' + TITLE + ' <span aria-hidden="true">›</span>';
  const status = document.getElementById('top3DuesStatus');
  if (status) status.before(btn); else card.appendChild(btn);   // dòng "Tự động đồng bộ…" nằm dưới nút

  const ov = document.createElement('div');
  ov.className = 'dr-ov'; ov.id = 'duesRankOverlay'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = '<section class="dr-panel" role="dialog" aria-modal="true" aria-labelledby="drTitle">' +
    '<header class="dr-head"><div><h2 id="drTitle">🏆 ' + TITLE + ' <span id="drPeriod"></span></h2><div class="dr-sub" id="drSub">Đang tải dữ liệu…</div></div><span class="sp"></span><button type="button" class="dr-x" id="drClose" aria-label="Đóng">✕</button></header>' +
    '<div class="dr-tools"><select class="dr-search" id="drMonth" aria-label="Chọn tháng" style="flex:0 0 auto;width:auto;min-width:130px"></select><input class="dr-search" id="drSearch" type="search" placeholder="Tìm đơn vị…" aria-label="Tìm đơn vị"><div class="dr-chips" id="drChips" role="group" aria-label="Lọc theo nhóm tỷ lệ nộp"></div></div>' +
    '<div class="dr-body"><table class="dr-tb"><thead><tr><th class="c">Hạng</th><th>Đơn vị</th><th class="r dr-hide-sm">ĐV đã nộp / phải nộp</th><th>Tỷ lệ nộp</th><th class="r" id="drPrevHead">So với kỳ trước</th></tr></thead><tbody id="drRows"><tr><td colspan="5" class="dr-empty">Đang tải…</td></tr></tbody></table></div>' +
    '<footer class="dr-foot">Tỷ lệ nộp = số đảng viên đã duyệt, đã nộp (8) ÷ số đảng viên phải nộp ((2)+(3)−(4)−(5)). "So với kỳ trước" là chênh lệch điểm % so với tháng liền trước; đơn vị bằng tỷ lệ được xếp theo số tiền đã nộp, rồi theo số đảng viên đã nộp.</footer></section>';
  document.body.appendChild(ov);

  const $ = id => document.getElementById(id);
  const ui = { data: null, group: 'all', q: '', seq: 0, month: null };

  function renderChips() {
    const rows = ui.data ? ui.data.rows : [];
    $('drChips').innerHTML = GROUPS.map(g => '<button type="button" class="dr-chip ' + (g.cls || '') + (ui.group === g.id ? ' on' : '') + '" data-g="' + g.id + '" aria-pressed="' + (ui.group === g.id) + '">' + (g.cls ? '<i></i>' : '') + esc(g.label) + ' <b>' + rows.filter(r => g.test(r.rate)).length + '</b></button>').join('');
  }
  function renderRows() {
    const tb = $('drRows');
    if (!ui.data) return;
    const g = GROUPS.find(x => x.id === ui.group) || GROUPS[0], q = norm(ui.q);
    const list = ui.data.rows.filter(r => g.test(r.rate) && (!q || r.key.includes(q)));
    if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="dr-empty">Không có đơn vị phù hợp.</td></tr>'; return; }
    tb.innerHTML = list.map(r => {
      const gr = groupOf(r.rate), d = r.diff;
      const diff = d == null ? '<span class="dr-d eq">—<small>chưa có số liệu</small></span>'
        : '<span class="dr-d ' + (d > 0.005 ? 'up' : d < -0.005 ? 'dn' : 'eq') + '">' + (d > 0.005 ? '▲ +' : d < -0.005 ? '▼ ' : '') + (Math.round(d * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' điểm<small>kỳ trước ' + pct(r.prev) + '</small></span>';
      return '<tr><td class="c"><span class="dr-rk' + (r.rank <= 3 ? ' g' + r.rank : '') + '">' + r.rank + '</span></td><td>' + esc(r.name) + '</td>' +
        '<td class="r dr-hide-sm">' + r.dn.toLocaleString('vi-VN') + ' / ' + r.need.toLocaleString('vi-VN') + '</td>' +
        '<td><div class="dr-rate ' + gr.cls + '"><b>' + pct(r.rate) + '</b><span class="dr-bar"><i style="width:' + Math.min(100, r.rate).toFixed(2) + '%"></i></span></div></td><td class="r">' + diff + '</td></tr>';
    }).join('');
  }
  function fillMonths(k) {
    const dm = root.DuesMonth, y = +k.slice(0, 4), sel = $('drMonth');
    const has = m => { const key = keyOf(y, m); try { return !dm || !dm.hasData || dm.hasData(key) || key === (dm.currentKey && dm.currentKey()); } catch (_) { return true; } };
    let h = '';
    for (let m = 1; m <= 12; m++) { const key = keyOf(y, m); h += '<option value="' + key + '"' + (key === k ? ' selected' : '') + '>Tháng ' + m + '/' + y + (has(m) ? '' : ' (chưa có)') + '</option>'; }
    sel.innerHTML = h;
  }
  async function refresh() {
    const dm = root.DuesMonth, k = ui.month || (dm && dm.state && dm.state.month) || keyOf(new Date().getFullYear(), new Date().getMonth() + 1), my = ++ui.seq;
    fillMonths(k);
    $('drPeriod').textContent = '– ' + monthLabel(k).replace(/^t/, 'T');
    $('drSub').textContent = 'Đang tải số liệu ' + monthLabel(k) + ' và ' + monthLabel(prevKey(k)) + ' từ Google Sheets…';
    try {
      const data = await load(k);
      if (my !== ui.seq) return;
      ui.data = data;
      const avg = data.rows.reduce((s, r) => s + r.dn, 0) / Math.max(1, data.rows.reduce((s, r) => s + r.need, 0)) * 100;
      $('drSub').textContent = data.rows.length + ' đơn vị · tỷ lệ chung ' + pct(avg) + ' · so với ' + monthLabel(data.pk) + (data.hasPrev ? '' : ' (chưa có số liệu kỳ trước)');
      $('drPrevHead').textContent = 'So với ' + monthLabel(data.pk);
    } catch (e) {
      if (my !== ui.seq) return;
      ui.data = { rows: [] };
      $('drSub').textContent = (e && e.message) || 'Không tải được dữ liệu.';
    }
    renderChips(); renderRows();
  }
  function open() { ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false'); refresh(); setTimeout(() => $('drSearch').focus(), 50); document.addEventListener('keydown', onKey); }
  function close() { ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true'); document.removeEventListener('keydown', onKey); btn.focus(); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  btn.addEventListener('click', () => { ui.month = null; open(); });
  $('drMonth').addEventListener('change', e => { ui.month = e.target.value; refresh(); });
  $('drClose').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('drSearch').addEventListener('input', e => { ui.q = e.target.value; renderRows(); });
  $('drChips').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; ui.group = b.dataset.g; renderChips(); renderRows(); });
  root.addEventListener('dues-month-change', () => { ui.month = null; if (ov.classList.contains('open')) refresh(); });
  root.DuesRanking = { open, refresh };
})(window);
