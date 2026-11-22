/* Chế độ app (khi mở từ icon đã cài): thanh tiêu đề, thanh điều hướng dưới và bảng chọn.
   Các nút chỉ "bấm hộ" các nút sẵn có của trang nên số liệu và chức năng giữ nguyên. */
(function () {
  if (!document.documentElement.classList.contains('app-mode') || document.getElementById('appTabs')) return;
  var $ = function (s) { return document.querySelector(s); };
  var press = function (el) { if (el) el.click(); };
  var isShown = function (el) { return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; };
  var I = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    list: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
    rank: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    news: '<svg viewBox="0 0 24 24"><path d="M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 9h6M8 13h6M8 16h4"/></svg>',
    ai: '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>',
    qa: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 15.5h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5"/></svg>',
    gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v1.5M12 16.5V18"/></svg>',
    report: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6"/></svg>'
  };

  /* Thanh tiêu đề */
  var bar = document.createElement('header');
  bar.id = 'appBar';
  bar.innerHTML = '<img src="logo.png" alt=""><div class="ab-t"><b>DVC LÀO CAI</b><small>Theo dõi thủ tục hành chính</small></div>' +
    '<span id="abClock"></span><button type="button" id="abUser" aria-label="Tài khoản quản trị">' + I.user + '</button>';
  document.body.appendChild(bar);
  var clock = function () {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    $('#abClock').textContent = p(d.getHours()) + ':' + p(d.getMinutes());
  };
  clock(); setInterval(clock, 20000);

  /* Thanh điều hướng dưới */
  var tabs = document.createElement('nav');
  tabs.id = 'appTabs';
  var defs = [
    ['home', 'Tổng quan', I.home], ['proc', 'Thủ tục', I.list], ['fee', 'Đảng phí', I.wallet],
    ['rank', 'Xếp hạng', I.rank], ['more', 'Thêm', I.more]
  ];
  tabs.innerHTML = defs.map(function (d) {
    return '<button type="button" data-t="' + d[0] + '">' + d[2] + '<span>' + d[1] + '</span></button>';
  }).join('');
  document.body.appendChild(tabs);
  var setOn = function (t) {
    [].forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  };
  setOn('home');

  /* Bảng chọn */
  var sheet = document.createElement('div');
  sheet.id = 'appSheet';
  sheet.innerHTML = '<div class="as-back"></div><div class="as-panel"><div class="as-grab"></div><h3></h3><div class="as-body"></div></div>';
  document.body.appendChild(sheet);
  var close = function () { sheet.classList.remove('open'); };
  sheet.querySelector('.as-back').addEventListener('click', close);
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var openSheet = function (title, items) {
    sheet.querySelector('h3').textContent = title;
    var body = sheet.querySelector('.as-body');
    body.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'as-row' + (it.cls ? ' ' + it.cls : '');
      b.innerHTML = '<span class="as-ico">' + (it.icon || '') + '</span><span class="as-tx"><b>' + esc(it.label) + '</b>' +
        (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
        (it.pct ? '<span class="as-pct">' + esc(it.pct) + '</span>' : '') + (it.keep ? '' : '');
      b.addEventListener('click', function () { if (!it.keep) close(); it.run && it.run(); });
      body.appendChild(b);
    });
    sheet.classList.add('open');
  };

  var procButtons = function () { return [].slice.call(document.querySelectorAll('#proceduresNav > button')); };
  var splitPct = function (txt) {
    txt = (txt || '').replace(/\s+/g, ' ').trim();
    var m = txt.match(/\s*(\d+(?:[.,]\d+)?%)\s*$/);
    return { label: m ? txt.slice(0, m.index).trim() : txt, pct: m ? m[1] : '' };
  };

  var moreSheet = function () {
    var items = [];
    var add = function (label, sub, icon, run, keep) { items.push({ label: label, sub: sub, icon: icon, run: run, keep: keep }); };
    add('Tin địa phương', '99 xã, phường', I.news, function () { press($('#localNewsBtn')); });
    add('Trợ lý AI TTHC', 'Hỏi đáp, tra cứu số liệu', I.ai, function () { press($('#chatLaunch')); });
    add('Hỏi – đáp', 'Vướng mắc thường gặp', I.qa, function () { location.href = 'hoi-dap.html'; });
    add('Bản tin thị trường', 'Tỷ giá USD, giá vàng', I.gold, function () { press($('#goldBtn')); });
    add('Tạo báo cáo', 'Báo cáo tổng hợp, in hoặc lưu PDF', I.report, function () { press($('#buildReport')); });
    if (document.querySelectorAll('#unitsList a').length) {
      add('Web các đơn vị', 'Xã, phường trực thuộc', I.globe, function () { unitsSheet(); }, true);
    }
    var docs = [].slice.call(document.querySelectorAll('a.docs-link[target]'))[0];
    if (docs) add('Tài liệu', 'Văn bản, video hướng dẫn', I.folder, function () { window.open(docs.href, '_blank', 'noopener'); });
    var adm = $('#adminBtn');
    if (isShown(adm)) add('Quản trị hệ thống', 'Dành cho quản trị viên', I.gear, function () { press(adm); });
    else add('Đăng nhập quản trị', 'Bằng tài khoản Gmail được cấp quyền', I.user, function () { press($('#loginBtn')); });
    openSheet('Thêm', items);
  };
  var unitsSheet = function () {
    var items = [{ label: 'Quay lại', icon: I.back, cls: 'back', keep: true, run: moreSheet }];
    [].forEach.call(document.querySelectorAll('#unitsList a'), function (a) {
      items.push({ label: a.textContent.trim() || a.href, icon: I.globe, run: function () { window.open(a.href, '_blank', 'noopener'); } });
    });
    openSheet('Web các đơn vị', items);
  };
  var procSheet = function () {
    var btns = procButtons(), items = [];
    for (var i = 0; i < Math.min(3, btns.length); i++) (function (b) {
      var p = splitPct(b.textContent);
      items.push({ label: p.label, sub: 'Xem danh sách đơn vị', pct: p.pct, icon: I.list, run: function () { press(b); } });
    })(btns[i]);
    openSheet('Thủ tục hành chính', items);
  };

  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]');
    if (!b) return;
    var t = b.getAttribute('data-t'), btns = procButtons();
    if (t === 'more') { setOn(t); moreSheet(); return; }
    if (t === 'proc') { setOn(t); procSheet(); return; }
    close();
    if (t === 'home') { setOn(t); press($('#nav > button')); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (t === 'fee') { setOn(t); press(btns[3]); return; }
    if (t === 'rank') { setOn(t); press(btns[btns.length - 1]); return; }
  });
  /* Đóng bảng chọn thì tô sáng lại tab Tổng quan */
  sheet.addEventListener('click', function (e) { if (e.target.closest('.as-back')) setOn('home'); });

  $('#abUser').addEventListener('click', function () {
    var adm = $('#adminBtn');
    press(isShown(adm) ? adm : $('#loginBtn'));
  });
})();
