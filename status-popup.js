/* Bấm thẻ "Hoàn thành / Đang triển khai / Chưa triển khai" ở trang Tổng quan: bật popup danh sách
   (đơn vị × thủ tục) theo trạng thái. Dùng lại kiểu giao diện của popup thủ tục (.pu-*). */
(function () {
  var ov, cur = 'complete', proc = 'all', q = '', last = null;
  var TITLES = { 'complete': 'Hoàn thành', 'in-progress': 'Đang triển khai', 'not-started': 'Chưa triển khai' };
  var e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); };

  var style = document.createElement('style');
  style.textContent = '#statusListOverlay .pu-pr{display:block;margin-top:2px;font-style:normal;font-size:11px;font-weight:600;color:#6b7a90}' +
    '#statusListOverlay .pu-chips{flex-wrap:wrap}';
  document.head.appendChild(style);

  function matches(p, u) {
    var v = progressM(p, u), done = isComplete(p, u);
    if (cur === 'complete') return done;
    if (cur === 'in-progress') return v > 0 && !done;
    return v === 0;
  }
  function rows() {
    var out = [];
    data.procedures.forEach(function (p) {
      p.units.forEach(function (u) {
        var name = String(u.unit || '').trim();
        if (!name || !matches(p, u)) return;
        var s = state(p, u);
        out.push({ name: name, pid: p.id, pname: p.short || p.name || '', v: progressM(p, u), st: s[0], cls: s[1] });
      });
    });
    return out.sort(function (a, b) { return b.v - a.v || a.name.localeCompare(b.name, 'vi') || a.pname.localeCompare(b.pname, 'vi'); });
  }
  function build() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'pu-ov'; ov.id = 'statusListOverlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'slTitle');
    ov.innerHTML = '<section class="pu-dlg"><button type="button" class="pu-x" aria-label="Đóng" data-sl-close>×</button>' +
      '<header class="pu-head"><span class="pu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span>' +
      '<div class="pu-ttl"><small>Danh sách chi tiết</small><h2 id="slTitle"></h2></div><div class="pu-avg"><b id="slNum">0</b><span>lượt</span></div></header>' +
      '<div class="pu-bar"><input type="search" class="pu-search" id="slSearch" placeholder="Tìm tên đơn vị…" aria-label="Tìm đơn vị" autocomplete="off"><div class="pu-chips" id="slChips"></div></div>' +
      '<div class="pu-list" id="slList"></div>' +
      '<footer class="pu-foot"><span id="slCount"></span><button type="button" class="pu-go" data-sl-table>Xem bảng tiến độ tổng ›</button></footer></section>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === ov || t.closest('[data-sl-close]')) return close();
      if (t.closest('[data-sl-table]')) { close(); var op = document.querySelector('[data-open-ranking]'); if (op) op.click(); return; }
      var ch = t.closest('[data-sl-p]'); if (ch) { proc = ch.dataset.slP; paint(); return; }
      var r = t.closest('[data-sl-unit]'); if (r && window.openUnitDetail) window.openUnitDetail(r.dataset.slUnit);
    });
    ov.querySelector('#slSearch').addEventListener('input', function (ev) { q = ev.target.value; paintList(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !ov.classList.contains('open')) return;
      var u = document.getElementById('unitDetailOverlay');
      if (u && u.classList.contains('open')) return;
      close();
    }, true); /* pha bắt (capture): chạy trước khi popup chi tiết tự đóng, nên Esc chỉ đóng một lớp */
  }
  function paintList() {
    var all = rows(), nq = norm(q);
    var list = all.filter(function (r) { return (proc === 'all' || String(r.pid) === proc) && (!nq || norm(r.name).indexOf(nq) >= 0); });
    ov.querySelector('#slList').innerHTML = list.length ? list.map(function (r, i) {
      var pc = Math.round(r.v * 100);
      return '<button type="button" class="pu-row ' + e(r.cls) + '" data-sl-unit="' + e(r.name) + '" title="Xem chi tiết ' + e(r.name) + '"><span class="pu-no">' + (i + 1) + '</span>' +
        '<span class="pu-name">' + e(r.name) + '<em class="pu-pr">' + e(r.pname) + '</em></span>' +
        '<span class="pu-trk"><i style="width:' + Math.min(100, pc) + '%"></i></span><span class="pu-pc">' + pc + '%</span><span class="pu-st">' + e(r.st) + '</span></button>';
    }).join('') : '<div class="pu-empty">Không có mục phù hợp.</div>';
    ov.querySelector('#slCount').textContent = 'Hiển thị ' + list.length + ' / ' + all.length + ' lượt · bấm một dòng để xem chi tiết đơn vị';
  }
  function paint() {
    var all = rows(), n = { all: all.length };
    all.forEach(function (r) { n[r.pid] = (n[r.pid] || 0) + 1; });
    ov.querySelector('#slTitle').textContent = 'Thủ tục ' + TITLES[cur].toLowerCase();
    ov.querySelector('#slNum').textContent = all.length;
    var C = [['all', 'Tất cả']].concat(data.procedures.map(function (p) { return [String(p.id), p.short || p.name || '']; }));
    ov.querySelector('#slChips').innerHTML = C.map(function (c) {
      return '<button type="button" class="pu-chip' + (proc === c[0] ? ' on' : '') + '" data-sl-p="' + e(c[0]) + '">' + e(c[1]) + '<b>' + (n[c[0]] || 0) + '</b></button>';
    }).join('');
    paintList();
  }
  function open(status) {
    build(); cur = status; proc = 'all'; q = '';
    ov.querySelector('#slSearch').value = '';
    paint();
    last = document.activeElement;
    ov.classList.add('open'); document.body.style.overflow = 'hidden';
    ov.querySelector('.pu-list').scrollTop = 0;
  }
  function close() {
    if (!ov) return;
    ov.classList.remove('open');
    if (!document.querySelector('#unitDetailOverlay.open')) document.body.style.overflow = '';
    if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (x) {}
  }
  /* chặn thao tác lọc bảng cũ (bảng đã ẩn nên không thấy gì), thay bằng popup */
  document.addEventListener('click', function (ev) {
    var c = ev.target.closest && ev.target.closest('#cards [data-status-card]');
    if (!c) return;
    ev.preventDefault(); ev.stopPropagation();
    open(c.dataset.statusCard);
  }, true);
  window.openStatusList = open;
})();
