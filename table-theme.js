/* table-theme.js — bổ sung phần hiển thị cho bảng "Theo dõi theo đơn vị".
   Chỉ thay đổi cách hiển thị (avatar, chip, nhãn); không đổi dữ liệu hay logic của trang. */
(function () {
  var tbody = document.getElementById('tbody');
  var thead = document.getElementById('thead');
  if (!tbody || !thead) return;

  var PALETTE = [
    ['#e8eefc', '#2f5bd1'], ['#fdeceb', '#c5303a'], ['#e6f6ef', '#12875f'],
    ['#fff2dc', '#b8730b'], ['#f0eafc', '#6d45c2'], ['#e7f4f8', '#17758f']
  ];

  function initials(name) {
    var w = name.trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '';
    if (w.length === 1) return w[0].charAt(0).toUpperCase();
    return (w[0].charAt(0) + w[w.length - 1].charAt(0)).toUpperCase();
  }
  function colorFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function chip(cls, num, label) {
    var c = el('span', 'chip ' + cls);
    c.appendChild(el('b', null, num));
    c.appendChild(document.createTextNode(' ' + label));
    return c;
  }
  function colIndex(label) {
    var ths = thead.querySelectorAll('th');
    for (var i = 0; i < ths.length; i++) {
      if (ths[i].textContent.trim().toUpperCase().indexOf(label) === 0) return i;
    }
    return -1;
  }

  function enhance() {
    var iProc = colIndex('THỦ TỤC');
    var iOwner = colIndex('CÁN BỘ');
    var iLoad = colIndex('HỒ SƠ / TÀI KHOẢN');
    var iDvc = colIndex('TK DVC');
    var iBank = colIndex('TK NGÂN HÀNG');
    var iRecv = colIndex('ĐÃ TIẾP NHẬN');

    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (tr.dataset.enh) return;
      var tds = tr.children;
      if (tds.length < 3) return;
      tr.dataset.enh = '1';

      // Trạng thái dòng -> màu thanh bên trái, tiến độ
      var pill = tr.querySelector('.pill');
      if (pill) {
        ['good', 'warn', 'gray'].forEach(function (s) {
          if (pill.classList.contains(s)) tr.classList.add('st-' + s);
        });
      }

      // Chip thủ tục
      if (iProc >= 0 && tds[iProc]) {
        var t = tds[iProc].textContent.trim();
        if (t) { tds[iProc].textContent = ''; tds[iProc].appendChild(el('span', 'proc-chip', t)); }
      }

      // Cán bộ phụ trách: avatar + tên
      if (iOwner >= 0 && tds[iOwner]) {
        var raw = tds[iOwner].textContent.trim();
        var cell = tds[iOwner];
        cell.textContent = '';
        if (!raw || raw === '—') {
          cell.appendChild(el('span', 'officer-empty', 'Chưa phân công'));
        } else {
          var lines = raw.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
          var first = lines[0];
          var col = colorFor(first);
          var wrap = el('div', 'officer');
          var av = el('span', 'officer-avatar', initials(first));
          av.style.background = col[0];
          av.style.color = col[1];
          wrap.appendChild(av);
          wrap.appendChild(el('span', 'officer-name', first));
          if (lines.length > 1) wrap.title = lines.join('\n');
          cell.appendChild(wrap);
        }
      }

      // Hồ sơ / tài khoản -> chip (chế độ tổng quan)
      if (iLoad >= 0 && tds[iLoad]) {
        var txt = tds[iLoad].textContent.trim();
        var m = txt.match(/^(\S+)\s+hồ sơ tiếp nhận\s*·\s*(\S+)\s+hoàn thành$/);
        var f = txt.match(/^(\S+)\s+tài khoản DVC\s*·\s*(\S+)\s+ngân hàng$/);
        var box = null;
        if (m) {
          box = el('div', 'chips');
          box.appendChild(chip('chip-gray', m[1], 'tiếp nhận'));
          box.appendChild(chip('chip-green', m[2], 'hoàn thành'));
        } else if (f) {
          box = el('div', 'chips');
          box.appendChild(chip('chip-blue', f[1], 'DVC'));
          box.appendChild(chip('chip-amber', f[2], 'ngân hàng'));
        }
        if (box) { tds[iLoad].textContent = ''; tds[iLoad].appendChild(box); }
      }
    });
  }

  enhance();
  // renderTable() thay toàn bộ nội dung tbody -> quan sát để áp dụng lại
  // (thead được đặt lại ngay trước tbody trong mỗi lần render nên không cần quan sát riêng)
  new MutationObserver(enhance).observe(tbody, { childList: true });
})();
