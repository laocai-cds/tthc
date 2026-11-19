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
    if (b.monthsOnly) return tthc03MonthsOnly_(b, syncId, props); // chỉ ghi tab tháng, không đụng 3 tab cộng dồn
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
  let p = (String(owner || '').trim() !== '' ? 0.05 : 0) + (String(guided) === 'Có' ? 0.05 : 0);
  if (H > 0) p += 0.65 * Math.min(1, I / H);
  if (E > 0) p += 0.15 * Math.min(1, I / E);
  p += 0.10 * Math.min(1, I / 50);
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

/* ===== SỐ LIỆU THEO THÁNG – mỗi tháng một tab "03 THANG MM-YYYY" =====
 * b.months03 = { '10001': { '10/2026': [[tenDonVi, dangXuLy, daTuChoi, daXuLyXong], ...], '11/2026': [...] }, '10002': {...}, '10003': {...} }
 * Mỗi tab một tháng, mỗi dòng một đơn vị: TEN DON VI | CT (chính thức) DANG XU LY, TU CHOI, XONG | TT (tạm thời) ... | NX (nhận xét) ... | CAP NHAT
 * Mỗi lần đồng bộ chỉ ghi đè tab của các tháng được gửi; thủ tục nào không gửi thì giữ nguyên cột cũ. Web đọc các tab này để xem tiến độ theo tháng. */
const TTHC03_COLS = { '10002': 1, '10003': 4, '10001': 7 };
function tthc03MonthTab_(key) { return '03 THANG ' + key.slice(5) + '-' + key.slice(0, 4); }
function tthc03Months_(b) {
  const m = b && b.months03;
  if (!m || typeof m !== 'object') return 0;
  const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
  const at = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
  const head = ['TEN DON VI', 'CT DANG XU LY', 'CT TU CHOI', 'CT XONG', 'TT DANG XU LY', 'TT TU CHOI', 'TT XONG', 'NX DANG XU LY', 'NX TU CHOI', 'NX XONG', 'CAP NHAT'];
  const byMonth = {};
  Object.keys(m).forEach(id => {
    if (TTHC03_COLS[id] === undefined) return;
    Object.keys(m[id] || {}).forEach(mo => {
      const mm = /^(\d{2})\/(\d{4})$/.exec(mo);
      const list = m[id][mo];
      if (!mm || !Array.isArray(list) || list.length < 50) return;
      (byMonth[mm[2] + '-' + mm[1]] = byMonth[mm[2] + '-' + mm[1]] || {})[id] = list;
    });
  });
  let n = 0;
  Object.keys(byMonth).forEach(key => {
    const name = tthc03MonthTab_(key);
    let sh = book.getSheetByName(name);
    const rows = {}, order = [];
    if (!sh) {
      sh = book.insertSheet(name);
      sh.getRange(1, 1, 1, head.length).setValues([head]);
      sh.setFrozenRows(1);
    } else {
      const last = sh.getLastRow();
      if (last > 1) sh.getRange(2, 1, last - 1, head.length).getValues().forEach(r => { const k = String(r[0]); if (k) { rows[k] = r.slice(); order.push(k); } });
    }
    Object.keys(byMonth[key]).forEach(id => {
      const c = TTHC03_COLS[id];
      byMonth[key][id].forEach(r => {
        const k = String(r[0]);
        if (!rows[k]) { rows[k] = [k, '', '', '', '', '', '', '', '', '', '']; order.push(k); }
        rows[k][c] = Math.max(0, Number(r[1]) || 0);
        rows[k][c + 1] = Math.max(0, Number(r[2]) || 0);
        rows[k][c + 2] = Math.max(0, Number(r[3]) || 0);
        rows[k][10] = at;
        n++;
      });
    });
    const all = order.map(k => rows[k]);
    const last2 = sh.getLastRow();
    if (last2 > 1) sh.getRange(2, 1, last2 - 1, head.length).clearContent();
    if (all.length) sh.getRange(2, 1, all.length, head.length).setValues(all);
  });
  return n;
}

/**
 * Chế độ chỉ-tháng (b.monthsOnly = true, không cần b.tthc03): chỉ ghi các tab "03 THANG mm-yyyy" từ b.months03.
 * Giữ nguyên 3 tab cộng dồn và dòng trạng thái lần đồng bộ đầy đủ gần nhất (at, tabs); chỉ thêm syncId/months để app xác nhận.
 */
function tthc03MonthsOnly_(b, syncId, props) {
  const at = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
  const prev = tthc03Last_() || {};
  let n = 0, err = '';
  try { n = tthc03Months_(b); } catch (e) { err = String(e && e.message || e); }
  const res = Object.assign({}, prev, { syncId: syncId, ok: !err && n > 0, monthsOnly: true, months: n, monthsAt: at, error: err || (n > 0 ? '' : 'Không có tháng nào đủ dữ liệu để ghi.') });
  if (res.ok) delete res.error;
  props.setProperty('LAST_TTHC03', JSON.stringify(res));
  try { nkAdd_('gqtthc-api', 'Đồng bộ 03 thủ tục: chỉ tháng ' + String(b.period || ''), String(b.period || ''), 'api'); } catch (_) {}
  return json_({ ok: res.ok });
}
