/*
 * Báo cáo đơn vị dạng PDF thật (pdfmake): mỗi đơn vị một file, gộp trong .zip.
 * rptUnitPdfDoc(c, o)  – dựng định nghĩa tài liệu pdfmake từ nội dung báo cáo đơn vị (unitContent trong report-period.js).
 * rptZipBytes(entries) – gói [{name, data:Uint8Array}] thành .zip (không nén) để chứa file nhị phân.
 */
(function (root) {
  'use strict';
  const GREEN = '#1e8e3e', RED = '#8a1c1c', HEAD = '#e6edf7', CW = 453;   // bề rộng vùng chữ A4 (lề trái 3 cm, phải 2 cm)
  const runs = t => { const out = []; String(t == null ? '' : t).split(/(«[^»]*»)/).forEach(s => { if (!s) return; out.push(s[0] === '«' && s.length > 1 ? { text: s.slice(1, -1), bold: true } : { text: s.replace(/[«»]/g, '') }); }); return out.length ? out : [{ text: '' }]; };
  const para = (t, o) => Object.assign({ text: runs(t), alignment: 'justify', margin: [0, 0, 0, 4] }, o || {});
  const h2 = t => ({ text: t, bold: true, color: RED, fontSize: 12, margin: [0, 10, 0, 4], keepWithNext: true });
  const h3 = t => ({ text: t, bold: true, margin: [0, 4, 0, 3], keepWithNext: true });

  function table(head, rows) {
    const n = head.length, wide = n > 8, w = wide ? [1700, 750, 800, 850, 850, 850, 850, 1400, 700, 1000] : [1900, 800, 1000, 1000, 1000, 1700, 800, 1100], sum = w.reduce((a, b) => a + b, 0);
    const fs = wide ? 7 : 8, cell = (v, hd, i) => ({ text: String(v == null ? '' : v).replace(/[«»]/g, ''), bold: !!hd, fontSize: fs, alignment: i === 0 ? 'left' : (hd ? 'center' : 'right'), fillColor: hd ? HEAD : undefined });
    const body = [head.map((h, i) => cell(h, true, i))].concat(rows.map(r => r.map((v, i) => cell(v, false, i))));
    // cột chữ (cán bộ phụ trách, trạng thái) căn trái
    body.slice(1).forEach(r => r.forEach((c, i) => { if (/[A-Za-zÀ-ỹ]/.test(c.text) && !/^[\d.,%+−\-—\s]+$/.test(c.text) && i > 0) c.alignment = 'left'; }));
    return { table: { headerRows: 1, widths: w.slice(0, n).map(x => Math.round(x / sum * CW * 10) / 10), body }, layout: { hLineColor: () => '#888', vLineColor: () => '#888', hLineWidth: () => .5, vLineWidth: () => .5, paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2 }, margin: [0, 2, 0, 6] };
  }

  root.rptUnitPdfDoc = function (c, o) {
    o = o || {};
    const check = { canvas: [{ type: 'polyline', lineWidth: 2.2, lineColor: GREEN, closePath: false, points: [{ x: 0, y: 8 }, { x: 5, y: 13 }, { x: 14, y: 1 }] }], width: 16, margin: [0, 2, 0, 0] };
    const stamp = { table: { widths: [150], body: [[{ stack: [{ columns: [{ width: '*', text: '' }, check, { width: 'auto', text: ' Signature Valid', bold: true, color: GREEN, fontSize: 11, margin: [4, 0, 0, 0] }, { width: '*', text: '' }] }, { text: ['Ký bởi: ', { text: 'HỆ THỐNG TỰ ĐỘNG', bold: true, color: '#c00000' }], alignment: 'center', fontSize: 9, margin: [0, 3, 0, 0] }, { text: 'Ngày ký: ' + (o.signTime || ''), alignment: 'center', fontSize: 9 }], margin: [0, 3, 0, 3] }]] }, layout: { hLineColor: () => GREEN, vLineColor: () => GREEN, hLineWidth: () => 1, vLineWidth: () => 1 } };
    const content = [
      { columns: [{ width: '*', stack: [{ text: 'TỈNH ỦY LÀO CAI', bold: true, alignment: 'center' }, { text: 'HỆ THỐNG THEO DÕI TTHC', alignment: 'center', fontSize: 10 }, { text: '*', alignment: 'center' }] }, { width: '*', stack: [{ text: 'ĐẢNG CỘNG SẢN VIỆT NAM', bold: true, alignment: 'center' }, { canvas: [{ type: 'line', x1: 40, y1: 2, x2: 190, y2: 2, lineWidth: .8 }] }, { text: o.dateLine || '', italics: true, alignment: 'center', margin: [0, 3, 0, 0] }] }], margin: [0, 0, 0, 14] },
      { text: 'BÁO CÁO', bold: true, fontSize: 15, alignment: 'center' },
      { text: 'tình hình thực hiện 04 thủ tục hành chính của Đảng trên môi trường điện tử', bold: true, alignment: 'center' },
      { text: c.name, bold: true, alignment: 'center' },
      { text: c.when, bold: true, alignment: 'center' }
    ];
    if (o.range) content.push({ text: '(' + o.range + ')', italics: true, alignment: 'center', fontSize: 10 });
    content.push({ text: '-----', alignment: 'center' }, { text: 'Xuất báo cáo lúc ' + (o.stamp || ''), italics: true, alignment: 'center', fontSize: 9, color: '#555', margin: [0, 0, 0, 4] });
    content.push(h2('I. TÌNH HÌNH CHUNG'), ...c.paras.map(t => para(t)));
    content.push({ text: 'Bảng 1. Kết quả thực hiện 04 thủ tục hành chính của ' + c.name, bold: true, margin: [0, 4, 0, 2], keepWithNext: true }, table(c.head, c.rows));
    content.push(h2('II. KẾT QUẢ THỰC HIỆN TỪNG THỦ TỤC'));
    c.secs.forEach((x, i) => { content.push(h3((i + 1) + '. ' + x.title), ...x.paras.map(t => para(t))); });
    content.push(h2('III. ĐÁNH GIÁ CHUNG'), h3('1. Ưu điểm'), ...c.good.map(t => para('- ' + t)), h3('2. Tồn tại, hạn chế'), ...c.weak.map(t => para('- ' + t)));
    content.push(h2('IV. ĐỀ XUẤT, KIẾN NGHỊ'), ...c.rec.map(t => para('- ' + t)));
    content.push({ columns: [{ width: '*', stack: [{ text: 'Nơi nhận:', bold: true, decoration: 'underline', fontSize: 10 }, { text: '- Thường trực Tỉnh ủy (b/c);\n- Văn phòng Tỉnh ủy;\n- ' + c.name + ';\n- Lưu.', fontSize: 9.5 }] }, { width: 170, stack: [stamp] }], margin: [0, 14, 0, 0], unbreakable: true });
    return {
      pageSize: 'A4', pageMargins: [85, 57, 57, 57], defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.15 }, info: { title: 'Báo cáo ' + c.name, author: 'Hệ thống theo dõi TTHC – Tỉnh ủy Lào Cai' },
      footer: (cur, total) => ({ text: cur + '/' + total, alignment: 'center', fontSize: 8.5, color: '#666', margin: [0, 20, 0, 0] }),
      content
    };
  };

  root.rptZipBytes = function (entries) {
    const enc = new TextEncoder(), T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
    const nd = new Date(), dosT = (nd.getHours() << 11) | (nd.getMinutes() << 5) | (nd.getSeconds() >> 1), dosD = ((nd.getFullYear() - 1980) << 9) | ((nd.getMonth() + 1) << 5) | nd.getDate();
    const parts = [], cent = []; let off = 0;
    entries.forEach(({ name, data }) => {
      const nb = enc.encode(name), d = data, c = crc(d), l = new Uint8Array(30 + nb.length + d.length), v = new DataView(l.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(10, dosT, true); v.setUint16(12, dosD, true); v.setUint32(14, c, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, nb.length, true); l.set(nb, 30); l.set(d, 30 + nb.length); parts.push(l);
      const h = new Uint8Array(46 + nb.length), w = new DataView(h.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(12, dosT, true); w.setUint16(14, dosD, true); w.setUint32(16, c, true); w.setUint32(20, d.length, true); w.setUint32(24, d.length, true); w.setUint16(28, nb.length, true); w.setUint32(42, off, true); h.set(nb, 46); cent.push(h); off += l.length;
    });
    const cs = cent.reduce((s, x) => s + x.length, 0), e = new Uint8Array(22), ev = new DataView(e.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, cent.length, true); ev.setUint16(10, cent.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
    return new Blob([...parts, ...cent, e], { type: 'application/zip' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
