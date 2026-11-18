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
    try { res.months = tthc03Months_(b); } catch (err) { console.error('months03 ' + err); res.monthsError = String(err && err.message || err); }
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


/* ===== % TIẾN ĐỘ 03 THỦ TỤC – Apps Script tính, ghi giá trị vào cột J, K, L =====
 * Phải trùng công thức progress() trong index.html.
 * Hook: gọi tthc03Recalc_(sheet) trước sortUnitRows_ trong sortTouchedTabs_ và tthc03Write_. */
function tthc03Pct_(owner, guided, received, processed, need, done) {
  const E = Math.max(0, Number(received) || 0), G = Math.max(0, Number(processed) || 0), H = Math.max(0, Number(need) || 0), I = Math.max(0, Number(done) || 0);
  let p = (String(owner || '').trim() !== '' ? 0.05 : 0) + (String(guided) === 'Có' ? 0.05 : 0) + 0.20 * Math.min(1, E / 10) + 0.50 * Math.min(1, I / 10);
  if (E > 0) p += 0.10 * Math.min(1, I / E) + (H > 0 ? 0.10 * Math.min(1, I / H) : 0);
  return Math.round(Math.min(1, Math.max(0, p)) * 1e6) / 1e6;
}
function tthc03Recalc_(sheet) {
  if (!sheet) return;
  const last = sheet.getLastRow();
  if (last < 4) return;
  const n = last - 3;
  const v = sheet.getRange(4, 1, n, 9).getValues();
  const rows = [];
  v.forEach((r, i) => { if (validId_([r[0]])) rows.push({ i: i, id: Number(r[0]), pct: tthc03Pct_(r[2], r[3], r[4], r[6], r[7], r[8]) }); });
  if (!rows.length) return;
  const order = rows.slice().sort((a, b) => b.pct - a.pct || a.id - b.id), rank = {};
  order.forEach((o, k) => { rank[o.i] = k + 1; });
  const out = [];
  for (let i = 0; i < n; i++) out.push(['', '', '']);
  rows.forEach(o => { out[o.i] = [Number(v[o.i][8]) >= 10, o.pct, rank[o.i]]; });
  sheet.getRange(4, 10, n, 3).setValues(out);
  try { sheet.getRange(4, 11, n, 1).setNumberFormat('0.0%'); } catch (_) {}
}
function tthc03RecalcAll() {
  const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
  Object.keys(CONFIG.procedureTabs).forEach(id => {
    const sh = book.getSheetByName(CONFIG.procedureTabs[id]);
    tthc03Recalc_(sh);
    sortUnitRows_(sh);
  });
  CacheService.getScriptCache().removeAll(['read_v3_n']);
}


/* Ghi chú 18/11: tthc03Write_ trong dự án Apps Script đã đổi sang xử lý ĐỘC LẬP từng thủ tục, ghi NHAT KY 'Đồng bộ 03 · <thủ tục> · THÀNH CÔNG/THẤT BẠI' và nhận b.errors từ dp/run03.js. Bản đầy đủ nằm trong dự án "03 thủ tục". */

/* ===== SỐ LIỆU THEO THÁNG – tab "03 THEO THANG" =====
 * b.months03 = { '10001': { '10/2026': [[tenDonVi, dangXuLy, daTuChoi, daXuLyXong], ...], '11/2026': [...] }, '10002': {...}, '10003': {...} }
 * Mỗi lần đồng bộ ghi đè các (tháng, thủ tục) được gửi, giữ nguyên các tháng khác. Cột: THANG (yyyy-MM) | THU TUC (id) | TEN DON VI | DANG XU LY | TU CHOI | XONG | CAP NHAT
 * Web đọc tab này để xem tiến độ 03 thủ tục theo tháng. */
const TTHC03_MONTH_TAB = '03 THEO THANG';
function tthc03Months_(b) {
  const m = b && b.months03;
  if (!m || typeof m !== 'object') return 0;
  const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
  let sh = book.getSheetByName(TTHC03_MONTH_TAB);
  if (!sh) {
    sh = book.insertSheet(TTHC03_MONTH_TAB);
    sh.getRange(1, 1, 1, 7).setValues([['THANG', 'THU TUC', 'TEN DON VI', 'DANG XU LY', 'TU CHOI', 'XONG', 'CAP NHAT']]);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@');
  }
  const at = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
  const sent = {}, add = [];
  Object.keys(m).forEach(id => {
    if (!TTHC03_TABS[id]) return;
    Object.keys(m[id] || {}).forEach(mo => {
      const mm = /^(\d{2})\/(\d{4})$/.exec(mo);
      const list = m[id][mo];
      if (!mm || !Array.isArray(list) || list.length < 50) return;
      const key = mm[2] + '-' + mm[1];
      sent[key + '|' + id] = 1;
      list.forEach(r => add.push([key, String(id), String(r[0]), Math.max(0, Number(r[1]) || 0), Math.max(0, Number(r[2]) || 0), Math.max(0, Number(r[3]) || 0), at]));
    });
  });
  if (!add.length) return 0;
  const last = sh.getLastRow();
  const old = last > 1 ? sh.getRange(2, 1, last - 1, 7).getValues() : [];
  const keep = old.filter(r => !sent[String(r[0]) + '|' + String(r[1])]);
  const all = keep.concat(add);
  if (last > 1) sh.getRange(2, 1, last - 1, 7).clearContent();
  sh.getRange('A:B').setNumberFormat('@');
  sh.getRange(2, 1, all.length, 7).setValues(all);
  return add.length;
}
