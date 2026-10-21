/**
 * ĐẢNG PHÍ – API đồng bộ Excel → Google Sheet
 * ------------------------------------------------------------
 * Cài đặt (1 lần):
 *  1. Mở Google Sheet  → Tiện ích mở rộng → Apps Script → dán toàn bộ file này.
 *  2. Cài đặt dự án (bánh răng) → Thuộc tính tập lệnh → Thêm:
 *        SYNC_TOKEN = <mật khẩu đồng bộ bạn tự đặt>
 *  3. Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web
 *        Thực thi với tư cách: Tôi        Người có quyền truy cập: Bất kỳ ai
 *  4. Sao chép URL .../exec dán vào ô "Địa chỉ API" trên trang Đảng phí.
 *  (Mỗi lần sửa code: Triển khai → Quản lý các bản triển khai → ✎ Sửa → Phiên bản: Phiên bản mới → Triển khai.
 *   URL /exec giữ nguyên.)
 */

const SPREADSHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';   // bảng mà trang web đọc (đối chiếu với script đang chạy!)
const SHEET_GID = 193289320;           // tab tháng đầu tiên (Thang10) – chỉ dùng làm mẫu bố cục khi tạo tab tháng mới
const FALLBACK_SHEET_NAME = 'Thang10';
const LOG_SHEET_NAME = 'Nhật ký đồng bộ';
const TZ = 'Asia/Ho_Chi_Minh';
const NCOL = 14;
const MAX_ROWS = 3000;
const REGISTRY_SHEET_NAME = 'DANH MUC THANG';   // danh mục tab tháng (THANG yyyy-MM | TEN TAB | CAP NHAT)
const BASE_YEAR = 2026;                          // năm của tab "Thang{M}"; năm khác → "Thang{M}_{YYYY}"
const SCRIPT_VERSION = 6;

/* ---------------- Mỗi tháng một tab ----------------
 * Excel luôn đồng bộ vào tab của THÁNG HIỆN TẠI (giờ Việt Nam): Thang10, Thang11, ...
 * Lần đồng bộ đầu tiên của tháng mới tự tạo tab (sao chép bố cục/định dạng của tab tháng gần nhất),
 * rồi cập nhật danh mục tháng. Tab các tháng trước không bị đụng tới nữa (chỉ xem). */
function monthKey_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM'); }
function monthTab_(key) {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5));
  return 'Thang' + m + (y === BASE_YEAR ? '' : '_' + y);
}
function parseMonthTab_(name) {
  const m = /^Thang(\d{1,2})(?:_(\d{4}))?$/.exec(String(name));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
  return (m[2] ? m[2] : String(BASE_YEAR)) + '-' + ('0' + m[1]).slice(-2);
}

const HEADER_1 = ['STT', 'Tên đơn vị', 'Đảng viên', '', '', '', '', 'Hồ sơ đảng phí', '', '', '', 'Số tiền', '', ''];
const HEADER_2 = ['', '',
  'Tổng sl đảng viên (1)',
  'Số lượng ĐV sinh hoạt chính thức (2)',
  'Số lượng ĐV sinh hoạt tạm thời (3)',
  'Số lượng ĐV đã chuyển sinh hoạt đảng tạm thời (4)',
  'Số lượng được miễn giảm ĐP (5)',
  'Chưa duyệt (6)',
  'Đã duyệt, chưa nộp (7)',
  'Đã duyệt, đã nộp (8)',
  'Số đảng viên chưa có hồ sơ (9)',
  'Tổng tiền theo hồ sơ đã khai báo',
  'Tổng tiền đã nộp',
  'Tỷ lệ hoàn thành\n đảng phí thực tế'];

/* ---------------- HTTP ---------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'chunk') out = putChunk_(p);
    else if (p.action === 'commit') out = commit_(p);
    else out = Object.assign({ ok: true }, getStatus_());
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return respond_(out, p.callback);
}

/* Nhận dữ liệu theo từng phần nhỏ qua GET (ổn định với mọi trình duyệt, kể cả trang mở từ file trên máy) */
function putChunk_(p) {
  if (!/^[\w-]{4,40}$/.test(p.id || '')) throw new Error('Mã đồng bộ không hợp lệ.');
  CacheService.getScriptCache().put('dp_' + p.id + '_' + Number(p.i), String(p.d || ''), 600);
  return { ok: true, i: Number(p.i) };
}

function commit_(p) {
  const n = Number(p.n);
  if (!/^[\w-]{4,40}$/.test(p.id || '') || !(n > 0 && n < 200)) throw new Error('Yêu cầu không hợp lệ.');
  const keys = Array.from({ length: n }, (_, i) => 'dp_' + p.id + '_' + i);
  const got = CacheService.getScriptCache().getAll(keys);
  const missing = keys.filter(k => got[k] == null);
  if (missing.length) return { ok: false, retry: true, error: 'Thiếu ' + missing.length + ' phần dữ liệu, vui lòng thử lại.' };
  let data = null;
  try {
    data = JSON.parse(keys.map(k => got[k]).join(''));
    const res = sync_(data);
    CacheService.getScriptCache().removeAll(keys);
    return res;
  } catch (err) {
    const msg = String(err.message || err);
    PropertiesService.getScriptProperties().setProperty('LAST_ERROR', JSON.stringify({
      syncId: String((data && data.syncId) || p.id), error: msg,
      at: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss')
    }));
    return { ok: false, error: msg };
  }
}

function doPost(e) {
  let out, data = null;
  try {
    const raw = (e && e.parameter && e.parameter.payload) || (e && e.postData && e.postData.contents) || '';
    if (!raw) throw new Error('Không nhận được dữ liệu.');
    data = JSON.parse(raw);
    out = sync_(data);
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
    PropertiesService.getScriptProperties().setProperty('LAST_ERROR', JSON.stringify({
      syncId: String((data && data.syncId) || ''), error: out.error,
      at: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss')
    }));
  }
  return respond_(out);
}

function respond_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Đồng bộ ---------------- */

function sync_(data) {
  const expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!expected) throw new Error('Chưa cấu hình SYNC_TOKEN trong Thuộc tính tập lệnh (Cài đặt dự án → Thuộc tính tập lệnh).');
  if (String(data.token || '').trim() !== String(expected).trim()) throw new Error('Mật khẩu đồng bộ không đúng (không khớp SYNC_TOKEN).');

  const nowKey = monthKey_();
  if (data.month && String(data.month) !== nowKey) {
    throw new Error('Chỉ được đồng bộ vào tháng hiện tại (' + nowKey + '), trang đang mở là tháng ' + String(data.month) + '. Hãy tải lại trang rồi đồng bộ lại.');
  }
  const rows = data.rows;
  if (!Array.isArray(rows) || !rows.length) throw new Error('File không có dòng dữ liệu.');
  if (rows.length > MAX_ROWS) throw new Error('Quá nhiều dòng (' + rows.length + ').');

  const clean = rows.map((r, i) => {
    if (!Array.isArray(r) || r.length < NCOL) throw new Error('Dòng ' + (i + 1) + ' không đủ ' + NCOL + ' cột.');
    return r.slice(0, NCOL).map((v, c) => {
      if (c === 1) return String(v == null ? '' : v).trim();
      const n = Number(v);
      return isFinite(n) ? n : 0;
    });
  });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận, vui lòng thử lại.');
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const props = PropertiesService.getScriptProperties();
    // 0) Tab của tháng hiện tại (tự tạo nếu là tháng mới) – các tháng trước không bị ghi đè
    const sh = monthSheet_(ss, nowKey);

    // 1) Tiêu đề + dữ liệu ghi bằng MỘT lệnh
    const block = [HEADER_1, HEADER_2].concat(clean);
    const oldLast = sh.getLastRow();
    sh.getRange(1, 1, block.length, NCOL).setValues(block);
    // 2) Xóa phần dư nếu file mới ít dòng hơn
    if (oldLast > block.length) sh.getRange(block.length + 1, 1, oldLast - block.length, NCOL).clearContent();
    // 3) Chỉ khi phải tạo tab trống (không có tab mẫu) mới dựng bố cục từ đầu
    if (NEW_BLANK_TABS_[sh.getName()]) { applyLayout_(sh); delete NEW_BLANK_TABS_[sh.getName()]; }
    updateRegistry_(ss, nowKey);

    const at = new Date();
    const meta = {
      month: nowKey,
      tab: sh.getName(),
      syncId: String(data.syncId || ''),
      updatedAt: at.toISOString(),
      updatedAtText: Utilities.formatDate(at, TZ, 'dd/MM/yyyy HH:mm:ss'),
      fileName: String(data.fileName || '').slice(0, 200),
      rowCount: clean.length,
      totals: data.totals || null
    };
    props.setProperty('LAST_SYNC', JSON.stringify(meta));
    writeLog_(ss, meta);
    return Object.assign({ ok: true, sheet: sh.getName() }, meta);
  } finally {
    lock.releaseLock();
  }
}

const NEW_BLANK_TABS_ = {};

/** Tab của tháng `key`; chưa có thì tạo từ tab tháng gần nhất để giữ nguyên bố cục + định dạng. */
function monthSheet_(ss, key) {
  const name = monthTab_(key);
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  const src = templateSheet_(ss, key);
  if (src) {
    sh = src.copyTo(ss);
    sh.setName(name);
    const last = sh.getLastRow();
    if (last > 2) sh.getRange(3, 1, last - 2, NCOL).clearContent();    // giữ 2 dòng tiêu đề
  } else {
    sh = ss.insertSheet(name);
    NEW_BLANK_TABS_[name] = true;
  }
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (_) {}      // tab tháng mới nhất đứng đầu
  return sh;
}

function templateSheet_(ss, key) {
  const prior = ss.getSheets()
    .map(s => ({ s, k: parseMonthTab_(s.getName()) }))
    .filter(x => x.k && x.k < key)
    .sort((a, b) => (a.k < b.k ? 1 : -1));
  if (prior.length) return prior[0].s;
  const byGid = ss.getSheets().filter(s => s.getSheetId() === SHEET_GID)[0];
  return byGid || ss.getSheetByName(FALLBACK_SHEET_NAME) || null;
}

/** Dựng lại danh mục tháng từ tên các tab "Thang{M}"; giữ nguyên giờ cập nhật cũ, đặt giờ mới cho tháng đang đồng bộ. */
function updateRegistry_(ss, nowKey) {
  let reg = ss.getSheetByName(REGISTRY_SHEET_NAME);
  const old = {};
  if (reg && reg.getLastRow() > 1) {
    reg.getRange(2, 1, reg.getLastRow() - 1, 3).getDisplayValues().forEach(r => { old[String(r[0]).trim()] = String(r[2]); });
  }
  if (!reg) {
    reg = ss.insertSheet(REGISTRY_SHEET_NAME);
    reg.getRange(1, 1, 1, 3).setValues([['THANG', 'TEN TAB', 'CAP NHAT']]).setFontWeight('bold').setBackground('#eef3fb');
    reg.setFrozenRows(1);
  }
  const stamp = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  const rows = ss.getSheets().map(s => ({ k: parseMonthTab_(s.getName()), n: s.getName() })).filter(x => x.k)
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map(x => [x.k, x.n, x.k === nowKey ? stamp : (old[x.k] || '')]);
  const prevLast = reg.getLastRow();
  reg.getRange(2, 1, Math.max(rows.length, 1), 1).setNumberFormat('@');
  if (rows.length) reg.getRange(2, 1, rows.length, 3).setValues(rows);
  if (prevLast > rows.length + 1) reg.getRange(rows.length + 2, 1, prevLast - rows.length - 1, 3).clearContent();
}

/** Chạy tay một lần để dựng danh mục từ các tab tháng đang có (Thang10, Thang9, …). */
function rebuildMonthRegistry() {
  updateRegistry_(SpreadsheetApp.openById(SPREADSHEET_ID), monthKey_());
}

/** Bố cục cố định: gộp ô tiêu đề, định dạng số cho cả cột. Chạy 1 lần. */
function applyLayout_(sh) {
  const maxRows = sh.getMaxRows();
  sh.getRange(1, 1, 2, NCOL).breakApart();
  ['A1:A2', 'B1:B2', 'C1:G1', 'H1:K1', 'L1:M1'].forEach(a => sh.getRange(a).merge());
  sh.getRange(1, 1, 2, NCOL).setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#eef3fb');
  const rest = maxRows - 2;
  sh.getRange(3, 1, rest, NCOL).setNumberFormats(
    Array.from({ length: rest }, () => ['0', '@', '0', '0', '0', '0', '0', '0', '0', '0', '0', '#,##0', '#,##0', '0.00']));
  sh.setFrozenRows(2);
}

function writeLog_(ss, meta) {
  let log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(['Thời gian', 'Tên file', 'Số đơn vị', 'Tổng ĐV', 'ĐV đã nộp (8)', 'Tổng tiền khai báo', 'Tổng tiền đã nộp', 'Tỷ lệ thực tế chung (%)', 'Mã đồng bộ']);
    log.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#eef3fb');
    log.setFrozenRows(1);
  }
  const t = meta.totals || {};
  log.appendRow([meta.updatedAtText, meta.fileName, meta.rowCount, t.members || '', t.paidProfiles || '',
    t.declared || '', t.paid || '', t.rate || '', meta.syncId]);
}

function getStatus_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('LAST_SYNC'), err = props.getProperty('LAST_ERROR');
  return { last: raw ? JSON.parse(raw) : null, lastError: err ? JSON.parse(err) : null,
           tokenConfigured: !!props.getProperty('SYNC_TOKEN'), version: SCRIPT_VERSION,
           currentMonth: monthKey_(), currentTab: monthTab_(monthKey_()) };
}

/** Chạy thử trong trình soạn thảo để cấp quyền lần đầu. */
function testAuthorize() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Tab tháng hiện tại sẽ ghi vào: ' + monthTab_(monthKey_()) + (ss.getSheetByName(monthTab_(monthKey_())) ? ' (đã có)' : ' (sẽ tự tạo)'));
}
