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

const SPREADSHEET_ID = '1VzWQk2y2NeFxLQ66HNFMTT-o8qDONQlnwqVN-znJADY';
const SHEET_GID = 1183037062;          // tab nhận dữ liệu (gid trong URL)
const FALLBACK_SHEET_NAME = 'Sheet1';
const LOG_SHEET_NAME = 'Nhật ký đồng bộ';
const TZ = 'Asia/Ho_Chi_Minh';
const NCOL = 14;
const MAX_ROWS = 3000;
const LAYOUT_VERSION = '2';

const HEADER_1 = ['STT', 'Tên đơn vị', 'Đảng viên', '', '', '', '', 'Hồ sơ đảng phí', '', '', '', 'Số tiền', '', 'Tỉ lệ (8/(2+3-4-5))'];
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
  ''];

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
    const sh = getTargetSheet_(ss);
    const props = PropertiesService.getScriptProperties();

    // 1) Tiêu đề + dữ liệu ghi bằng MỘT lệnh
    const block = [HEADER_1, HEADER_2].concat(clean);
    const oldLast = sh.getLastRow();
    sh.getRange(1, 1, block.length, NCOL).setValues(block);
    // 2) Xóa phần dư nếu file mới ít dòng hơn
    if (oldLast > block.length) sh.getRange(block.length + 1, 1, oldLast - block.length, NCOL).clearContent();
    // 3) Định dạng, gộp ô: chỉ làm lần đầu (hoặc khi đổi phiên bản bố cục)
    if (props.getProperty('LAYOUT_V') !== LAYOUT_VERSION) {
      applyLayout_(sh);
      props.setProperty('LAYOUT_V', LAYOUT_VERSION);
    }

    const at = new Date();
    const meta = {
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

/** Bố cục cố định: gộp ô tiêu đề, định dạng số cho cả cột. Chạy 1 lần. */
function applyLayout_(sh) {
  const maxRows = sh.getMaxRows();
  sh.getRange(1, 1, 2, NCOL).breakApart();
  ['A1:A2', 'B1:B2', 'C1:G1', 'H1:K1', 'L1:M1', 'N1:N2'].forEach(a => sh.getRange(a).merge());
  sh.getRange(1, 1, 2, NCOL).setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#eef3fb');
  const rest = maxRows - 2;
  sh.getRange(3, 1, rest, NCOL).setNumberFormats(
    Array.from({ length: rest }, () => ['0', '@', '0', '0', '0', '0', '0', '0', '0', '0', '0', '#,##0', '#,##0', '0.00']));
  sh.setFrozenRows(2);
}

function getTargetSheet_(ss) {
  const byGid = ss.getSheets().filter(s => s.getSheetId() === SHEET_GID)[0];
  const sh = byGid || ss.getSheetByName(FALLBACK_SHEET_NAME);
  if (!sh) throw new Error('Không tìm thấy trang tính đích (gid ' + SHEET_GID + ').');
  return sh;
}

function writeLog_(ss, meta) {
  let log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(['Thời gian', 'Tên file', 'Số đơn vị', 'Tổng ĐV', 'ĐV đã nộp (8)', 'Tổng tiền khai báo', 'Tổng tiền đã nộp', 'Tỉ lệ chung (%)', 'Mã đồng bộ']);
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
           tokenConfigured: !!props.getProperty('SYNC_TOKEN'), version: 4 };
}

/** Chạy thử trong trình soạn thảo để cấp quyền lần đầu. */
function testAuthorize() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Trang tính đích: ' + getTargetSheet_(ss).getName());
}
