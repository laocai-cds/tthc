/**
 * 03 THỦ TỤC – số liệu từ API gqtthc (report/api/v1/thong-ke-ho-so/theo-co-quan) -> 3 tab thủ tục.
 * Dán vào CUỐI file chính của dự án Apps Script "03 thủ tục" (cùng file có doPost/doGet), hoặc thêm thành file riêng, rồi:
 *  - trong doPost thêm trước dòng "// Nhập hàng loạt":   if (b && b.action === 'tthc03') return tthc03Write_(b);
 *  - trong doGet thêm sau dòng "const p = ...":          if (p.action === 'tthc03_status') return out_({ ok: true, last03: tthc03Last_() }, p.callback);
 * Dùng mã truy cập chung (SHARED_ACCESS_CODE_HASH) như cập nhật từng đơn vị. Chỉ ghi cột E:I, khớp đơn vị theo tên.
 *
 * b.tthc03 = { '10001': [[tenDonVi, dangXuLy, daTuChoi, daXuLyXong], ...], '10002': [...], '10003': [...] }
 * Ánh xạ: Tiếp nhận (E) = Tổng hồ sơ (F) = đang + từ chối + xong; Đã xử lý (G) = từ chối + xong;
 *         Phải xử lý (H) = tiếp nhận − từ chối; Hoàn thành (I) = xong.
 */
const TTHC03_TABS = { '10001': 'nhan-xet', '10002': 'chinh-thuc', '10003': 'tam-thoi' };

function tthc03Norm_(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function tthc03Last_() {
  try { const r = PropertiesService.getScriptProperties().getProperty('LAST_TTHC03'); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

function tthc03Write_(b) {
  const props = PropertiesService.getScriptProperties();
  const syncId = String(b.syncId || '');
  const fail = msg => { props.setProperty('LAST_TTHC03', JSON.stringify({ syncId: syncId, ok: false, error: msg, at: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss') })); return json_({ ok: false, error: msg }); };
  const stored = props.getProperty('SHARED_ACCESS_CODE_HASH');
  if (!stored || !b.accessCode || digest_(String(b.accessCode).trim()) !== stored) return fail('Mã truy cập không hợp lệ.');
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
    const res = { syncId: syncId, ok: true, period: String(b.period || ''), at: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss'), tabs: {} };
    const plan = [];
    Object.keys(TTHC03_TABS).forEach(id => {
      const list = b.tthc03 && b.tthc03[id];
      if (!Array.isArray(list) || list.length < 50) throw new Error('Thiếu dữ liệu thủ tục ' + id + ' (' + (list ? list.length : 0) + ' đơn vị).');
      const sh = book.getSheetByName(CONFIG.procedureTabs[TTHC03_TABS[id]]);
      if (!sh) throw new Error('Không thấy tab ' + TTHC03_TABS[id]);
      const last = sh.getLastRow();
      if (last < 4) throw new Error('Tab ' + sh.getName() + ' chưa có dòng đơn vị.');
      const ids = sh.getRange(4, 1, last - 3, 2).getValues();
      const vals = sh.getRange(4, 5, last - 3, 5).getValues();
      const map = {};
      list.forEach(r => { map[tthc03Norm_(r[0])] = r; });
      let hit = 0; const miss = [];
      ids.forEach((n, i) => {
        if (!validId_([n[0]])) return;
        const r = map[tthc03Norm_(n[1])];
        if (!r) { miss.push(String(n[1])); return; }
        const dang = Math.max(0, Number(r[1]) || 0), tc = Math.max(0, Number(r[2]) || 0), xong = Math.max(0, Number(r[3]) || 0);
        const nhan = dang + tc + xong;
        vals[i] = [nhan, nhan, tc + xong, nhan - tc, xong];
        hit++;
      });
      if (hit < 50) throw new Error('Chỉ khớp ' + hit + ' đơn vị ở tab ' + sh.getName() + ' — không ghi để tránh sai dữ liệu.');
      plan.push({ sh: sh, last: last, vals: vals });
      res.tabs[id] = { hit: hit, miss: miss.length, missNames: miss.slice(0, 5) };
    });
    // Ghi sau khi cả 3 tab đã kiểm tra xong: lỗi ở tab nào cũng không để dữ liệu ghi dở.
    plan.forEach(p => { p.sh.getRange(4, 5, p.last - 3, 5).setValues(p.vals); });
    SpreadsheetApp.flush();
    plan.forEach(p => { try { sortUnitRows_(p.sh); } catch (err) { console.error('sort03 ' + err); } });
    props.setProperty('LAST_TTHC03', JSON.stringify(res));
    try { nkAdd_('gqtthc-api', 'Đồng bộ 03 thủ tục từ API', res.period, 'api'); } catch (_) {}
    return json_({ ok: true });
  } catch (err) {
    return fail(String(err && err.message || err));
  } finally {
    try { lock.releaseLock(); } catch (_) {}
    try { cacheClear_(); } catch (_) {}
  }
}
