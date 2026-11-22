/* Thay hai khối "Tiến độ theo thủ tục" và "Tình hình tổng hợp" bằng hai nút màu; bấm nút bật popup.
   Khối gốc vẫn nằm trong trang (ẩn) và được chuyển vào popup khi mở, nên số liệu luôn là số mới nhất. */
(function () {
  var cards = document.getElementById('cards'), middle = document.querySelector('section.middle');
  if (!cards || !middle || document.getElementById('panelTiles')) return;

  var link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'panel-tiles.css?v=1';
  document.body.appendChild(link);

  var svg = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var DEFS = [
    { title: 'Tiến độ theo thủ tục', sub: 'Tiến độ bình quân trên các đơn vị', head: 'Tiến độ bình quân của từng thủ tục',
      icon: svg('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>') },
    { title: 'Tình hình tổng hợp', sub: 'Khối lượng ghi nhận trong các bảng theo dõi', head: 'Khối lượng ghi nhận trong các bảng theo dõi',
      icon: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>') }
  ];

  var box = document.createElement('section');
  box.id = 'panelTiles';
  box.setAttribute('aria-label', 'Xem chi tiết');
  box.innerHTML = DEFS.map(function (d, i) {
    return '<button type="button" class="card" data-pt="' + i + '"><div class="card-top"><span>' + d.title + '</span><span class="card-symbol">' + d.icon + '</span></div>' +
      '<div class="card-foot">' + d.sub + '<span class="kpi-go">Xem →</span></div></button>';
  }).join('');
  cards.after(box);

  var ov, body, titleEl, subEl, cur = null, home = null, last = null;
  function build() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'pu-ov'; ov.id = 'panelPopup';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ptTitle');
    ov.innerHTML = '<section class="pu-dlg"><button type="button" class="pu-x" aria-label="Đóng" data-pt-close>×</button>' +
      '<header class="pu-head"><span class="pu-ico"></span><div class="pu-ttl"><small>Chi tiết</small><h2 id="ptTitle"></h2></div></header>' +
      '<div class="pt-body"></div></section>';
    document.body.appendChild(ov);
    body = ov.querySelector('.pt-body'); titleEl = ov.querySelector('#ptTitle');
    ov.addEventListener('click', function (ev) { if (ev.target === ov || ev.target.closest('[data-pt-close]')) close(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !ov.classList.contains('open')) return;
      var u = document.getElementById('unitDetailOverlay');
      if (u && u.classList.contains('open')) return;
      close();
    }, true);
  }
  function open(i) {
    build();
    var panel = middle.children[i];
    if (!panel) return;
    if (cur != null) close();
    /* nếu khối đang thu gọn thì mở ra trước khi đưa vào popup */
    var tg = panel.querySelector('.panel-toggle');
    if (tg && tg.getAttribute('aria-expanded') === 'false') tg.click();
    home = { panel: panel, index: i };
    body.appendChild(panel);
    cur = i;
    titleEl.textContent = DEFS[i].head;
    ov.querySelector('.pu-ico').innerHTML = DEFS[i].icon.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"');
    last = document.activeElement;
    ov.classList.add('open'); document.body.style.overflow = 'hidden';
    body.scrollTop = 0;
  }
  function close() {
    if (!ov || cur == null) return;
    /* trả khối về đúng vị trí cũ trong trang */
    var ref = middle.children[home.index] || null;
    middle.insertBefore(home.panel, ref);
    cur = null; home = null;
    ov.classList.remove('open');
    if (!document.querySelector('#unitDetailOverlay.open')) document.body.style.overflow = '';
    if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (x) {}
  }
  box.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pt]');
    if (b) open(Number(b.dataset.pt));
  });
})();
