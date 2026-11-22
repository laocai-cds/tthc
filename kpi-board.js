/* Bảng chỉ số tổng quan mới: 6 nút (Tiến độ bình quân, Hoàn thành, Đang triển khai, Chưa triển khai,
   Tình hình tổng hợp, Cần đôn đốc), thanh ghép ba màu và dòng "Cập nhật lúc". Thay cho 5 thẻ + 2 nút cũ (được ẩn). */
(function () {
  var cardsEl = document.getElementById('cards');
  if (!cardsEl || document.getElementById('kpiBoard')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'kpi-board.css?v=2';
  document.body.appendChild(link);

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); };
  var nf = function (n, d) { return Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: d == null ? 0 : d }); };
  var pc = function (x) { return nf(x * 100, 1) + '%'; };
  var svg = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var ICON = {
    avg: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
    done: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
    prog: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    none: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/>'),
    sum: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    todo: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')
  };

  var board = document.createElement('section');
  board.id = 'kpiBoard'; board.setAttribute('aria-label', 'Chỉ số tổng quan');
  cardsEl.before(board);

  /* ---------- tính số liệu ---------- */
  function need() {
    var map = new Map();
    data.procedures.forEach(function (p) {
      p.units.forEach(function (u) {
        var name = String(u.unit || '').trim(); if (!name) return;
        var noOwner = !u.owner, noGuide = u.guided !== 'Có';
        if (!noOwner && !noGuide) return;
        var it = map.get(name) || { name: name, owner: [], guide: [] };
        var label = p.short || p.name || '';
        if (noOwner) it.owner.push(label);
        if (noGuide) it.guide.push(label);
        map.set(name, it);
      });
    });
    return Array.from(map.values()).sort(function (a, b) {
      return (b.owner.length + b.guide.length) - (a.owner.length + a.guide.length) || a.name.localeCompare(b.name, 'vi');
    });
  }
  function stats() {
    var P = data.procedures, all = [];
    P.forEach(function (p) { p.units.forEach(function (u) { all.push([p, u]); }); });
    var done = 0, started = 0;
    all.forEach(function (x) {
      var v = progressM(x[0], x[1]), d = isComplete(x[0], x[1]);
      if (d) done++; else if (v > 0) started++;
    });
    var records = all.length, none = Math.max(0, records - done - started);
    var avg = P.reduce(function (t, p) { return t + total(p); }, 0) / Math.max(1, P.length);
    var fee = P.filter(function (p) { return p.kind === 'fee'; }).reduce(function (a, p) { return a.concat(p.units); }, []);
    var dvc = fee.reduce(function (s, u) { return s + Number(u.dvccreated || 0); }, 0);
    var dvct = fee.reduce(function (s, u) { return s + Number(u.dvctotal || 0); }, 0);
    return { P: P, records: records, done: done, started: started, none: none, avg: avg, dvc: dvc, dvct: dvct,
      units: Math.max.apply(null, P.map(function (p) { return p.units.length; })), need: need() };
  }

  /* ---------- vẽ bảng ---------- */
  function syncText() {
    var t = null;
    try { t = typeof sheetsLastSyncedAt !== 'undefined' ? sheetsLastSyncedAt : null; } catch (e) {}
    if (!t || isNaN(+t)) return { on: false, txt: 'Đang tải số liệu…' };
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return { on: true, txt: 'Cập nhật lúc ' + p(d.getHours()) + ':' + p(d.getMinutes()) };
  }
  function tile(cls, key, title, val, sub, small) {
    return '<button type="button" class="kb-tile ' + cls + '" data-kb="' + key + '"><div class="kb-top"><span>' + title + '</span><span class="kb-ico">' + ICON[cls] + '</span></div>' +
      '<div class="kb-val' + (small ? ' sm' : '') + '">' + val + '</div><div class="kb-sub">' + sub + '</div><span class="kb-go">Xem →</span></button>';
  }
  function draw() {
    if (typeof data === 'undefined' || !data || !data.procedures || !data.procedures.length) return;
    var s = stats(), r = Math.max(1, s.records);
    var sh = { g: s.done / r, o: s.started / r, r: s.none / r }, sy = syncText();
    board.innerHTML =
      '<div class="kb-strip"><span><b>' + nf(s.P.length).padStart(2, '0') + '</b> thủ tục · <b>' + nf(s.units) + '</b> đơn vị · <b>' + nf(s.records) + '</b> lượt</span>' +
      '<span class="kb-sync' + (sy.on ? '' : ' off') + '" id="kbSync"><i></i>' + sy.txt + '</span></div>' +
      '<div class="kb-mix"><div class="kb-bar" role="img" aria-label="Tỷ lệ hoàn thành, đang triển khai, chưa triển khai">' +
      '<span class="g" style="width:' + (sh.g * 100).toFixed(2) + '%"></span><span class="o" style="width:' + (sh.o * 100).toFixed(2) + '%"></span><span class="r" style="width:' + (sh.r * 100).toFixed(2) + '%"></span></div>' +
      '<div class="kb-leg"><span class="g"><i></i>Hoàn thành ' + pc(sh.g) + '</span><span class="o"><i></i>Đang triển khai ' + pc(sh.o) + '</span><span class="r"><i></i>Chưa triển khai ' + pc(sh.r) + '</span></div></div>' +
      '<div class="kb-grid">' +
      tile('avg', 'avg', 'Tiến độ bình quân', pc(s.avg), 'Theo từng thủ tục · trên ' + nf(s.units) + ' đơn vị') +
      tile('done', 'complete', 'Thủ tục hoàn thành', nf(s.done), pc(sh.g) + ' số lượt đã đạt 100%') +
      tile('prog', 'in-progress', 'Đang triển khai', nf(s.started), pc(sh.o) + ' số lượt đã phát sinh tiến độ') +
      tile('none', 'not-started', 'Chưa triển khai', nf(s.none), pc(sh.r) + ' số lượt chưa phát sinh') +
      tile('sum', 'sum', 'Tình hình tổng hợp', nf(s.dvc) + '<small>/' + nf(s.dvct) + '</small>', 'Tài khoản DVC đã tạo · hồ sơ · ngân hàng', true) +
      tile('todo', 'need', 'Cần đôn đốc', nf(s.need.length), 'Đơn vị chưa có cán bộ phụ trách hoặc chưa hướng dẫn quy trình') +
      '</div>';
    document.documentElement.classList.add('kb-on');
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { draw(); } catch (e) { console.error('kpi-board', e); } }); }
  new MutationObserver(schedule).observe(cardsEl, { childList: true });
  schedule();
  setInterval(function () {
    var el = document.getElementById('kbSync'); if (!el) return;
    var sy = syncText(); el.className = 'kb-sync' + (sy.on ? '' : ' off'); el.innerHTML = '<i></i>' + sy.txt;
  }, 5000);

  board.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-kb]'); if (!b) return;
    var k = b.dataset.kb;
    if (k === 'avg') { if (window.openPanelPopup) window.openPanelPopup(0); }
    else if (k === 'sum') { if (window.openPanelPopup) window.openPanelPopup(1); }
    else if (k === 'need') openNeed();
    else if (window.openStatusList) window.openStatusList(k);
  });

  /* ---------- popup "Cần đôn đốc" ---------- */
  var ov, filt = 'all', q = '', last = null;
  function build() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'pu-ov'; ov.id = 'needListOverlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ndTitle');
    ov.innerHTML = '<section class="pu-dlg"><button type="button" class="pu-x" aria-label="Đóng" data-nd-close>×</button>' +
      '<header class="pu-head"><span class="pu-ico">' + ICON.todo.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"') + '</span>' +
      '<div class="pu-ttl"><small>Cần xử lý</small><h2 id="ndTitle">Đơn vị cần đôn đốc</h2></div><div class="pu-avg"><b id="ndNum">0</b><span>đơn vị</span></div></header>' +
      '<div class="pu-bar"><input type="search" class="pu-search" id="ndSearch" placeholder="Tìm tên đơn vị…" aria-label="Tìm đơn vị" autocomplete="off"><div class="pu-chips" id="ndChips"></div></div>' +
      '<div class="pu-list" id="ndList"></div><footer class="pu-foot"><span id="ndCount"></span></footer></section>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === ov || t.closest('[data-nd-close]')) return close();
      var c = t.closest('[data-nd-f]'); if (c) { filt = c.dataset.ndF; paint(); return; }
      var r = t.closest('[data-nd-unit]'); if (r && window.openUnitDetail) window.openUnitDetail(r.dataset.ndUnit);
    });
    ov.querySelector('#ndSearch').addEventListener('input', function (ev) { q = ev.target.value; paintList(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !ov.classList.contains('open')) return;
      var u = document.getElementById('unitDetailOverlay'); if (u && u.classList.contains('open')) return;
      close();
    }, true);
  }
  function paintList() {
    var all = need(), nq = norm(q);
    var list = all.filter(function (r) {
      var okF = filt === 'all' || (filt === 'owner' && r.owner.length) || (filt === 'guide' && r.guide.length);
      return okF && (!nq || norm(r.name).indexOf(nq) >= 0);
    });
    ov.querySelector('#ndList').innerHTML = list.length ? list.map(function (r, i) {
      var tags = '';
      if (r.owner.length) tags += '<span class="nd-tag o">Chưa có cán bộ phụ trách: ' + esc(r.owner.join(', ')) + '</span>';
      if (r.guide.length) tags += '<span class="nd-tag g">Chưa hướng dẫn quy trình: ' + esc(r.guide.join(', ')) + '</span>';
      return '<button type="button" class="nd-row" data-nd-unit="' + esc(r.name) + '"><div class="nd-top"><span class="nd-no">' + (i + 1) + '</span><span class="nd-name">' + esc(r.name) + '</span><span class="nd-cnt">' + (r.owner.length + r.guide.length) + ' việc</span></div><div class="nd-tags">' + tags + '</div></button>';
    }).join('') : '<div class="pu-empty">Không có đơn vị cần đôn đốc.</div>';
    ov.querySelector('#ndCount').textContent = 'Hiển thị ' + list.length + ' / ' + all.length + ' đơn vị · bấm một đơn vị để xem chi tiết';
  }
  function paint() {
    var all = need(), nO = all.filter(function (r) { return r.owner.length; }).length, nG = all.filter(function (r) { return r.guide.length; }).length;
    ov.querySelector('#ndNum').textContent = all.length;
    var C = [['all', 'Tất cả', all.length], ['owner', 'Chưa có cán bộ phụ trách', nO], ['guide', 'Chưa hướng dẫn quy trình', nG]];
    ov.querySelector('#ndChips').innerHTML = C.map(function (c) {
      return '<button type="button" class="pu-chip' + (filt === c[0] ? ' on' : '') + '" data-nd-f="' + c[0] + '">' + c[1] + '<b>' + c[2] + '</b></button>';
    }).join('');
    paintList();
  }
  function openNeed() {
    build(); filt = 'all'; q = ''; ov.querySelector('#ndSearch').value = '';
    paint(); last = document.activeElement;
    ov.classList.add('open'); document.body.style.overflow = 'hidden'; ov.querySelector('.pu-list').scrollTop = 0;
  }
  function close() {
    if (!ov) return;
    ov.classList.remove('open');
    if (!document.querySelector('#unitDetailOverlay.open')) document.body.style.overflow = '';
    if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (x) {}
  }
  window.openNeedList = openNeed;
})();
