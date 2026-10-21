/**
 * ĐẢNG PHÍ – API đồng bộ Excel → Google Sheet cho trang laocai-cds.github.io/tthc
 * Bảng tính 1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g – MỖI THÁNG MỘT TAB (Thang10, Thang11, …).
 *
 * Phiên bản 4 = bản đang chạy (v3) + chia tab theo tháng:
 *  - Excel luôn đồng bộ vào tab của THÁNG HIỆN TẠI (giờ Việt Nam). Trang web gửi kèm `month`;
 *    nếu lệch tháng hiện tại của máy chủ thì từ chối (tránh ghi nhầm vào tháng khác).
 *  - Lần đồng bộ đầu tiên của tháng mới tự tạo tab "Thang{M}" bằng cách sao chép tab tháng gần nhất
 *    (giữ 2 dòng tiêu đề, ô gộp, độ rộng cột), xóa dữ liệu cũ, rồi ghi dữ liệu mới.
 *  - Tab "DANH MUC THANG" (THANG | TEN TAB | CAP NHAT | SO DON VI) được dựng lại sau mỗi lần đồng bộ; trang web đọc danh sách tháng từ đây
 *    và chỉ hiện các tháng có dữ liệu. 12 tab Thang1…Thang12 có thể tạo sẵn; tab thiếu sẽ tự tạo khi cần.
 *  - Tab các tháng trước không bị đụng tới nữa.
 *
 * Cài đặt:
 *  1. Dán toàn bộ file này vào Code.gs (thay thế code cũ).
 *  2. Thuộc tính tập lệnh SYNC_TOKEN (hoặc MAT_KHAU) giữ nguyên.
 *  3. Chạy hàm testAuthorize một lần để cấp quyền (nếu được hỏi).
 *  4. Triển khai → Quản lý các bản triển khai → Sửa (✎) → Phiên bản: "Phiên bản mới" → Triển khai.
 *     (Giữ nguyên URL /exec cũ nên không phải cấu hình lại trên trang.)
 */
const SPREADSHEET_ID = '1N8o54EORq0rgQ2yV62tJUeOh_89n-toiD-M1AGkWO4g';
const DATA_SHEET_GID = 193289320;            // tab tháng đầu tiên (Thang10) – dùng làm mẫu khi chưa có tab tháng trước
const LOG_SHEET_NAME = 'Nhật ký đồng bộ';
const REGISTRY_SHEET_NAME = 'DANH MUC THANG'; // THANG yyyy-MM | TEN TAB | CAP NHAT
const BASE_YEAR = 2026;                      // "Thang10" = tháng 10/2026; năm khác → "Thang10_2027"
const HEADER_ROWS = 2;                       // 2 dòng tiêu đề giữ nguyên
const COLS = 14;                             // STT, Tên đơn vị, (1)…(9), tiền khai báo, tiền đã nộp, tỷ lệ
const VERSION = 4;
const TZ = 'Asia/Ho_Chi_Minh';

/* ---------- Tháng ---------- */
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

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'chunk') out = saveChunk_(p);
    else if (p.action === 'commit') out = commit_(p);
    else out = status_();
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return reply_(out, p.callback);
}

function doPost(e) { // nhận cả gói trong 1 lần POST (payload=JSON) — cách nhanh nhất
  let out, data = null;
  try {
    const raw = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || '{}';
    data = JSON.parse(raw);
    out = write_(data);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
    saveError_(data && data.syncId, out.error);
  }
  return reply_(out);
}

function saveError_(syncId, error) {
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_ERROR', JSON.stringify({
      syncId: String(syncId || ''), error: String(error || ''), at: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss')
    }));
  } catch (_) {}
}

function reply_(obj, callback) {
  obj.version = VERSION;
  const json = JSON.stringify(obj);
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Gửi theo từng phần ---------- */
function saveChunk_(p) {
  if (!/^[\w-]{4,40}$/.test(p.id || '')) throw new Error('Mã đồng bộ không hợp lệ.');
  const i = Number(p.i);
  if (!(i >= 0 && i < 500)) throw new Error('Số thứ tự phần không hợp lệ.');
  CacheService.getScriptCache().put('dp_' + p.id + '_' + i, String(p.d || ''), 21600);
  return { ok: true, i: i };
}

function commit_(p) {
  const n = Number(p.n);
  if (!/^[\w-]{4,40}$/.test(p.id || '') || !(n > 0 && n < 500)) throw new Error('Thiếu thông tin đồng bộ.');
  const cache = CacheService.getScriptCache();
  const keys = [];
  for (let i = 0; i < n; i++) keys.push('dp_' + p.id + '_' + i);
  const got = cache.getAll(keys);
  const missing = keys.filter(k => got[k] == null);
  if (missing.length) return { ok: false, retry: true, error: 'Thiếu ' + missing.length + ' phần dữ liệu, hãy đồng bộ lại.' };
  const payload = JSON.parse(keys.map(k => got[k]).join(''));
  if (payload.syncId !== p.id) throw new Error('Mã đồng bộ không khớp.');
  let res;
  try { res = write_(payload); } catch (err) { saveError_(p.id, err && err.message || err); throw err; }
  cache.removeAll(keys);
  return res;
}

/* ---------- Ghi vào tab của tháng hiện tại ---------- */
function write_(payload) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('SYNC_TOKEN') || props.getProperty('MAT_KHAU');
  if (!token) throw new Error('Chưa đặt SYNC_TOKEN (hoặc MAT_KHAU) trong Thuộc tính tập lệnh.');
  if (String(payload.token || '') !== token) throw new Error('Mật khẩu đồng bộ không đúng.');

  const nowKey = monthKey_();
  if (payload.month && String(payload.month) !== nowKey) {
    throw new Error('Chỉ được đồng bộ vào tháng hiện tại (' + nowKey + '), trang đang mở là tháng ' + String(payload.month) + '. Hãy tải lại trang rồi đồng bộ lại.');
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) throw new Error('Không có dòng dữ liệu.');

  const data = rows.map(r => {
    if (!Array.isArray(r) || r.length < COLS) throw new Error('Dòng dữ liệu thiếu cột.');
    const row = [Number(r[0]) || '', String(r[1]).trim()];
    for (let c = 2; c < 13; c++) row.push(Number(r[c]) || 0);
    row.push((Number(r[13]) || 0) / 100);          // tỷ lệ % → phân số, định dạng 0,00%
    return row;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = monthSheet_(ss, nowKey);            // tab Thang{M} của tháng hiện tại (tự tạo nếu là tháng mới)

    const last = sh.getLastRow();
    if (last > HEADER_ROWS) sh.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, COLS).clearContent();
    const rg = sh.getRange(HEADER_ROWS + 1, 1, data.length, COLS);
    rg.setValues(data);
    sh.getRange(HEADER_ROWS + 1, 3, data.length, 11).setNumberFormat('#,##0');
    sh.getRange(HEADER_ROWS + 1, 14, data.length, 1).setNumberFormat('0.00%');

    const now = new Date();
    const when = Utilities.formatDate(now, TZ, 'dd/MM/yyyy HH:mm:ss');
    const t = payload.totals || {};
    let log = ss.getSheetByName(LOG_SHEET_NAME);
    if (!log) {
      log = ss.insertSheet(LOG_SHEET_NAME);
      log.appendRow(['Thời gian', 'Tên file', 'Số đơn vị', 'Tổng ĐV', 'ĐV đã nộp (8)', 'Tổng tiền khai báo', 'Tổng tiền đã nộp', 'Tỷ lệ thực tế chung (%)', 'Mã đồng bộ']);
      log.setFrozenRows(1);
    }
    log.insertRowAfter(1);
    log.getRange(2, 1, 1, 9).setValues([[when, payload.fileName || '', data.length, t.members || 0, t.paidProfiles || 0, t.declared || 0, t.paid || 0, t.rate || 0, payload.syncId || '']]);

    updateRegistry_(ss, nowKey, when);
    SpreadsheetApp.flush();

    const info = { syncId: String(payload.syncId || ''), updatedAtText: when, rowCount: data.length, fileName: payload.fileName || '', spreadsheetId: SPREADSHEET_ID, month: nowKey, tab: sh.getName() };
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC', JSON.stringify(info));
    return { ok: true, syncId: payload.syncId, rowCount: data.length, updatedAtText: when, spreadsheetId: SPREADSHEET_ID, month: nowKey, tab: sh.getName() };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Tab theo tháng ---------- */

/** Tab của tháng `key`; chưa có thì tạo từ tab tháng gần nhất để giữ nguyên tiêu đề, ô gộp, độ rộng cột. */
function monthSheet_(ss, key) {
  const name = monthTab_(key);
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  const src = templateSheet_(ss, key);
  if (!src) throw new Error('Không tìm thấy tab mẫu (Thang10 / gid ' + DATA_SHEET_GID + ') để tạo tab ' + name + '.');
  sh = src.copyTo(ss);
  sh.setName(name);
  const last = sh.getLastRow();
  if (last > HEADER_ROWS) sh.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, COLS).clearContent();   // giữ 2 dòng tiêu đề
  try { ss.setActiveSheet(sh); ss.moveActiveSheet(1); } catch (_) {}                                   // tab tháng mới nhất đứng đầu
  return sh;
}

function templateSheet_(ss, key) {
  const prior = ss.getSheets()
    .map(s => ({ s: s, k: parseMonthTab_(s.getName()) }))
    .filter(x => x.k && x.k < key)
    .sort((a, b) => (a.k < b.k ? 1 : -1));
  if (prior.length) return prior[0].s;
  return ss.getSheets().find(s => s.getSheetId() === DATA_SHEET_GID) || null;
}

/** Dựng lại danh mục tháng từ tên các tab "Thang{M}"; giữ giờ cập nhật cũ, đặt giờ mới cho tháng vừa đồng bộ.
 *  Cột D "SO DON VI" là công thức COUNT trên cột STT của từng tab – trang web chỉ hiện các tháng có dữ liệu. */
function updateRegistry_(ss, nowKey, when) {
  let reg = ss.getSheetByName(REGISTRY_SHEET_NAME);
  const old = {};
  if (reg && reg.getLastRow() > 1) {
    reg.getRange(2, 1, reg.getLastRow() - 1, 3).getDisplayValues().forEach(r => { old[String(r[0]).trim()] = String(r[2]); });
  }
  if (!reg) {
    reg = ss.insertSheet(REGISTRY_SHEET_NAME);
    reg.setFrozenRows(1);
  }
  reg.getRange(1, 1, 1, 4).setValues([['THANG', 'TEN TAB', 'CAP NHAT', 'SO DON VI']]).setFontWeight('bold').setBackground('#eef3fb');
  const stamp = when || Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
  const rows = ss.getSheets().map(s => ({ k: parseMonthTab_(s.getName()), n: s.getName() })).filter(x => x.k)
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map(x => [x.k, x.n, x.k === nowKey ? stamp : (old[x.k] || ''), "=COUNT('" + x.n + "'!A" + (HEADER_ROWS + 1) + ":A400)"]);
  const prevLast = reg.getLastRow();
  reg.getRange(2, 1, Math.max(rows.length, 1), 1).setNumberFormat('@');     // THANG phải là văn bản, không bị đổi thành ngày
  reg.getRange(2, 4, Math.max(rows.length, 1), 1).setNumberFormat('0');
  if (rows.length) reg.getRange(2, 1, rows.length, 4).setValues(rows);
  if (prevLast > rows.length + 1) reg.getRange(rows.length + 2, 1, prevLast - rows.length - 1, 4).clearContent();
}

/** Chạy tay khi cần dựng lại danh mục từ các tab tháng đang có (Thang9, Thang10, …). */
function rebuildMonthRegistry() {
  updateRegistry_(SpreadsheetApp.openById(SPREADSHEET_ID), monthKey_());
}

/* ---------- Trạng thái: đọc từ chính Nhật ký của Sheet đích ---------- */
function status_() {
  // Nhanh: đọc trạng thái đã lưu (có mã đồng bộ) — không phải mở bảng tính
  const props = PropertiesService.getScriptProperties();
  const rawLast = props.getProperty('LAST_SYNC'), rawErr = props.getProperty('LAST_ERROR');
  const cur = monthKey_(), curTab = monthTab_(cur);
  if (rawLast) {
    let last = null, lastError = null;
    try { last = JSON.parse(rawLast); } catch (_) {}
    try { lastError = rawErr ? JSON.parse(rawErr) : null; } catch (_) {}
    if (last) return { ok: true, last: last, lastError: lastError, spreadsheetId: SPREADSHEET_ID, currentMonth: cur, currentTab: curTab };
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const log = ss.getSheetByName(LOG_SHEET_NAME);
  let last = null;
  if (log && log.getLastRow() >= 2) {
    const v = log.getRange(2, 1, 1, 3).getDisplayValues()[0];
    last = { updatedAtText: v[0], fileName: v[1], rowCount: Number(String(v[2]).replace(/\D/g, '')) || 0 };
  }
  return { ok: true, last: last, spreadsheetId: SPREADSHEET_ID, spreadsheetName: ss.getName(), currentMonth: cur, currentTab: curTab };
}

function testAuthorize() {
  Logger.log(JSON.stringify(status_()));
  Logger.log('Tab tháng hiện tại: ' + monthTab_(monthKey_()));
}
