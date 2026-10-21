/*
 * DuesMonth – chọn tháng + lũy kế cho phần Thu nộp đảng phí.
 *
 * Nguồn dữ liệu (Google Sheet 1N8o54EO…):
 *  - Sheet1 (gid 193289320)  = THÁNG HIỆN TẠI, Excel đồng bộ thẳng vào đây (thời gian thực).
 *  - Tab "T{MM}-{YYYY}"      = tháng đã chốt (Apps Script tự sao lưu khi sang tháng), chỉ đọc.
 *  - Tab "DANH MUC THANG"    = danh sách tháng đã chốt (cột THANG | TEN TAB | CAP NHAT).
 *
 * Quy tắc:
 *  - Chỉ tháng hiện tại (giờ Việt Nam) được tự làm mới mỗi phút; tháng đã chốt chỉ tải một lần.
 *  - Lũy kế đến tháng K = cộng dồn hai cột tiền (khai báo, đã nộp) của các tháng từ đầu năm đến K;
 *    các cột còn lại (số đảng viên, hồ sơ, tỷ lệ) lấy theo tháng K.
 */
(function (root) {
  'use strict';

  const SHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';
  const LIVE_GID = '193289320';
  const REGISTRY_TAB = 'DANH MUC THANG';
  const SS_KEY = 'dues.month.v1';
  const MONEY_COLS = [11, 12];           // Tổng tiền khai báo, Tổng tiền đã nộp
  const REGISTRY_REFRESH_MS = 5 * 60 * 1000;

  /* ---------- Thời gian (giờ Việt Nam, UTC+7) ---------- */
  const vnNow = () => new Date(Date.now() + 7 * 3600 * 1000);
  const keyOf = (y, m) => y + '-' + String(m).padStart(2, '0');
  const currentKey = () => { const d = vnNow(); return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1); };
  const validKey = k => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(k || ''));
  const monthNo = k => Number(k.slice(5));
  const labelOf = k => 'Tháng ' + monthNo(k) + '/' + k.slice(0, 4);

  /* ---------- Chuẩn hóa / đọc ô gviz ---------- */
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cellNum = c => {
    if (!c) return 0;
    if (typeof c.v === 'number') return c.v;
    const s = String(c.f != null ? c.f : (c.v != null ? c.v : '')).replace(/[^\d-]/g, '');
    return s ? parseInt(s, 10) : 0;
  };
  const rowKey = r => {
    const c = (r && r.c) || [];
    const name = norm(c[1] && (c[1].v != null ? c[1].v : c[1].f));
    return name || null;
  };
  const isDataRow = r => {
    const c = (r && r.c) || [], first = c[0];
    const raw = first ? (first.f != null ? first.f : first.v) : '';
    return /^\d+$/.test(String(raw == null ? '' : raw).trim()) && !!rowKey(r);
  };

  /**
   * Cộng dồn hai cột tiền của các payload `others` vào bản sao của `base` (ghép theo tên đơn vị).
   * Thuần hàm – có thể kiểm thử bằng Node.
   */
  function mergeCumulative(base, others) {
    const out = JSON.parse(JSON.stringify(base));
    const add = new Map();
    (others || []).forEach(p => {
      ((p && p.table && p.table.rows) || []).forEach(r => {
        if (!isDataRow(r)) return;
        const k = rowKey(r), a = add.get(k) || MONEY_COLS.map(() => 0);
        MONEY_COLS.forEach((ci, j) => { a[j] += cellNum((r.c || [])[ci]); });
        add.set(k, a);
      });
    });
    ((out.table && out.table.rows) || []).forEach(r => {
      if (!isDataRow(r)) return;
      const a = add.get(rowKey(r));
      if (!a) return;
      r.c = r.c || [];
      MONEY_COLS.forEach((ci, j) => {
        const total = cellNum(r.c[ci]) + a[j];
        r.c[ci] = { v: total, f: total.toLocaleString('vi-VN') };
      });
    });
    return out;
  }

  /* ---------- Trạng thái ---------- */
  let archives = [];                      // [{key, tab}] các tháng đã chốt, mới nhất trước
  const state = { month: currentKey(), mode: 'month' };
  try {
    const saved = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null');
    if (saved && validKey(saved.month) && saved.month <= currentKey()) {
      state.month = saved.month; state.mode = saved.mode === 'cum' ? 'cum' : 'month';
    }
  } catch (_) { /* sessionStorage có thể bị chặn */ }

  const isCurrent = (k) => (k || state.month) === currentKey();
  const live = () => isCurrent();         // chỉ tháng hiện tại (hoặc lũy kế gồm tháng hiện tại) được tự làm mới
  const tabOf = k => { const a = archives.find(x => x.key === k); return a ? a.tab : null; };
  const available = () => [currentKey()].concat(archives.map(a => a.key).filter(k => k !== currentKey()))
    .sort((a, b) => (a < b ? 1 : -1));

  function normalizeState() {
    const cur = currentKey();
    if (!validKey(state.month) || state.month > cur || (state.month !== cur && !tabOf(state.month))) state.month = cur;
  }
  function emit() {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch (_) {}
    renderBars();
    refreshLabels();
    try { root.dispatchEvent(new CustomEvent('dues-month-change', { detail: Object.assign({}, state) })); } catch (_) {}
  }
  function set(patch) {
    const before = state.month + '|' + state.mode;
    Object.assign(state, patch);
    normalizeState();
    if (before !== state.month + '|' + state.mode) emit();
  }

  const periodLabel = () => state.mode === 'cum'
    ? 'Lũy kế đến tháng ' + monthNo(state.month) + (isCurrent() ? '' : '/' + state.month.slice(0, 4))
    : 'Tháng ' + monthNo(state.month) + (isCurrent() ? '' : '/' + state.month.slice(0, 4));
  const fullLabel = () => state.mode === 'cum' ? 'Lũy kế đến ' + labelOf(state.month).toLowerCase() : labelOf(state.month);

  function refreshLabels() {
    const t = periodLabel();
    document.querySelectorAll('[data-dues-period]').forEach(el => { if (el.textContent !== t) el.textContent = t; });
    const cur = labelOf(currentKey());
    document.querySelectorAll('[data-dp-cur-month]').forEach(el => { if (el.textContent !== cur) el.textContent = cur; });
  }

  /* ---------- Tải dữ liệu gviz ---------- */
  function gvizUrl(spec, cb) {
    const target = spec.tab ? 'sheet=' + encodeURIComponent(spec.tab) : 'gid=' + LIVE_GID;
    return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json;responseHandler:' + cb +
      '&' + target + '&headers=' + (spec.headers || 2) + '&_=' + Date.now();
  }
  function fetchTab(spec, timeout) {
    return new Promise((resolve, reject) => {
      const cb = '__duesMonth_' + Date.now() + '_' + Math.random().toString(36).slice(2), sc = document.createElement('script');
      let ended = false;
      const finish = (err, payload) => {
        if (ended) return; ended = true; clearTimeout(timer); delete root[cb]; sc.remove();
        err ? reject(err) : resolve(payload);
      };
      root[cb] = p => (p && p.table ? finish(null, p) : finish(new Error('no table')));
      const timer = setTimeout(() => finish(new Error('timeout')), timeout || 20000);
      sc.onerror = () => finish(new Error('network'));
      sc.src = gvizUrl(spec, cb); sc.async = true; document.head.appendChild(sc);
    });
  }
  const specFor = k => (k === currentKey() ? {} : { tab: tabOf(k) });

  async function cumulativePayload(snap) {
    const year = snap.month.slice(0, 4);
    const keys = available().filter(k => k.slice(0, 4) === year && k <= snap.month);
    if (!keys.includes(snap.month)) keys.unshift(snap.month);
    const results = await Promise.all(keys.map(k => fetchTab(specFor(k)).then(p => ({ k, p }))));
    const base = results.find(r => r.k === snap.month).p;
    return mergeCumulative(base, results.filter(r => r.k !== snap.month).map(r => r.p));
  }

  /**
   * Các trình đọc cũ gọi hàm này thay cho `script.src = …gviz…`.
   * Chế độ tháng: trả về đúng URL gviz của tab tương ứng. Chế độ lũy kế: gộp nhiều tab rồi gọi window[cb].
   */
  function noteStamp(payload) {
    // Ô P1 do Apps Script đóng dấu tháng của số liệu đang nằm ở tab nhận dữ liệu.
    const cols = (payload && payload.table && payload.table.cols) || [];
    const hit = cols.map(c => String((c && (c.label || c.id)) || '').trim()).find(l => /^\d{4}-(0[1-9]|1[0-2])$/.test(l));
    const stale = hit && hit < currentKey() ? hit : null;
    if (stale !== state.stale) { state.stale = stale; renderBars(); }
  }

  function attach(script, cb) {
    const snap = { month: state.month, mode: state.mode };
    if (snap.month === currentKey() && typeof root[cb] === 'function') {
      const orig = root[cb];
      root[cb] = function (p) { try { noteStamp(p); } catch (_) {} return orig.apply(this, arguments); };
    }
    if (snap.mode === 'month') { script.src = gvizUrl(specFor(snap.month), cb); return; }
    script.src = 'data:text/javascript;charset=utf-8,0';      // script rỗng để phần còn lại của trình đọc chạy bình thường
    cumulativePayload(snap).then(p => {
      if (typeof root[cb] === 'function') root[cb](p); else if (script.onerror) script.onerror();
    }, () => { if (script.onerror) script.onerror(); });
  }

  /* ---------- Danh mục tháng ---------- */
  async function loadRegistry() {
    try {
      const p = await fetchTab({ tab: REGISTRY_TAB, headers: 1 }, 15000);
      const first = norm((p.table.cols && p.table.cols[0] && (p.table.cols[0].label || p.table.cols[0].id)) || '');
      // Nếu chưa có tab danh mục, gviz trả về tab đầu tiên → nhãn cột khác "thang".
      const rows = first === 'thang'
        ? (p.table.rows || []).map(r => r.c || []).map(c => ({
            key: String(c[0] && (c[0].v != null ? c[0].v : c[0].f) || '').trim(),
            tab: String(c[1] && (c[1].v != null ? c[1].v : c[1].f) || '').trim()
          })).filter(x => validKey(x.key) && x.tab && x.key < currentKey())
        : [];
      rows.sort((a, b) => (a.key < b.key ? 1 : -1));
      const same = JSON.stringify(rows) === JSON.stringify(archives);
      archives = rows;
      const beforeMonth = state.month;
      normalizeState();
      if (!same || beforeMonth !== state.month) { renderBars(); if (beforeMonth !== state.month) emit(); }
    } catch (_) { /* giữ danh mục cũ */ }
  }

  /* ---------- Giao diện ---------- */
  const bars = new Set();
  function injectStyle() {
    if (document.getElementById('dues-month-style')) return;
    const st = document.createElement('style'); st.id = 'dues-month-style';
    st.textContent = '.dues-month-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px;font-size:12.5px;color:#41536b}' +
      '.dues-month-bar label{font-weight:700;color:#263b56}' +
      '.dues-month-bar select{padding:5px 8px;border:1px solid #cdd7e4;border-radius:8px;background:#fff;color:#1f2f45;font:inherit;font-weight:600;max-width:100%}' +
      '.dues-month-bar .dm-seg{display:inline-flex;border:1px solid #cdd7e4;border-radius:8px;overflow:hidden}' +
      '.dues-month-bar .dm-seg button{padding:5px 10px;border:0;background:#fff;color:#41536b;font:inherit;font-weight:600;cursor:pointer}' +
      '.dues-month-bar .dm-seg button+button{border-left:1px solid #cdd7e4}' +
      '.dues-month-bar .dm-seg button.on{background:#c8102e;color:#fff}' +
      '.dues-month-bar .dm-badge{padding:3px 9px;border-radius:999px;font-weight:700;font-size:11.5px}' +
      '.dues-month-bar .dm-badge.live{background:#d1fae5;color:#065f46}' +
      '.dues-month-bar .dm-badge.frozen{background:#eef1f5;color:#5b6678}' +
      '.dues-month-bar .dm-badge.stale{background:#fff4d6;color:#a35a00}' +
      '.dd-head .dues-month-bar{margin:8px 0 0;color:#e8eefc}.dd-head .dues-month-bar label{color:#fff}';
    document.head.appendChild(st);
  }
  function barHtml() {
    const cur = currentKey();
    const opts = available().map(k => '<option value="' + k + '"' + (k === state.month ? ' selected' : '') + '>' +
      labelOf(k) + (k === cur ? ' (hiện tại)' : '') + '</option>').join('');
    const badge = live() && state.stale
      ? '<span class="dm-badge stale" title="Excel của tháng hiện tại chưa được đồng bộ">Chưa có số liệu ' + labelOf(cur) + ' – đang hiển thị ' + labelOf(state.stale) + '</span>'
      : live()
      ? '<span class="dm-badge live" title="Số liệu tự đồng bộ mỗi phút">● Thời gian thực</span>'
      : '<span class="dm-badge frozen" title="Tháng đã chốt, không đồng bộ lại">Đã chốt số liệu</span>';
    return '<label>Kỳ</label><select aria-label="Chọn tháng">' + opts + '</select>' +
      '<span class="dm-seg" role="group" aria-label="Chế độ xem">' +
      '<button type="button" data-mode="month" class="' + (state.mode === 'month' ? 'on' : '') + '">Theo tháng</button>' +
      '<button type="button" data-mode="cum" class="' + (state.mode === 'cum' ? 'on' : '') + '">Lũy kế</button></span>' + badge;
  }
  function renderBar(el) {
    el.innerHTML = barHtml();
    el.querySelector('select').addEventListener('change', e => set({ month: e.target.value }));
    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => set({ mode: b.dataset.mode })));
  }
  function renderBars() { bars.forEach(el => { if (el.isConnected) renderBar(el); else bars.delete(el); }); }
  function mount(container, where) {
    if (!container) return null;
    injectStyle();
    const el = document.createElement('div'); el.className = 'dues-month-bar';
    if (where === 'prepend') container.prepend(el); else container.appendChild(el);
    bars.add(el); renderBar(el);
    return el;
  }

  function init() {
    injectStyle();
    const card = document.getElementById('top3Dues');
    if (card && !card.querySelector('.dues-month-bar')) {
      const head = card.querySelector('.top3-dues-head');
      const el = document.createElement('div'); el.className = 'dues-month-bar';
      if (head) head.after(el); else card.prepend(el);
      bars.add(el); renderBar(el);
    }
    refreshLabels();
    loadRegistry();
    setInterval(() => { if (!document.hidden) loadRegistry(); }, REGISTRY_REFRESH_MS);
    setInterval(refreshLabels, 30 * 1000);
    // Sang tháng mới khi trang vẫn mở: quay về tháng hiện tại mới.
    let lastCur = currentKey();
    setInterval(() => {
      const c = currentKey();
      if (c !== lastCur) { const follow = state.month === lastCur; lastCur = c; if (follow) state.month = c; loadRegistry(); emit(); }
    }, 60 * 1000);
  }

  root.DuesMonth = {
    state, live, isCurrent, currentKey, labelOf, periodLabel, fullLabel, attach, mount, set,
    mergeCumulative, available, _setArchives: a => { archives = a; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
