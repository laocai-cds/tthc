/**
 * TRANG WEB CÁC ĐƠN VỊ – API riêng cho menu trái của trang laocai-cds.github.io/tthc
 * Bảng tính riêng "link website": 1oxCFjtQrtCwNWTc0ugP3M_KdOhbt1XYHjTRkJeIuEwk (tab đầu tiên)
 * Cột: STT | TÊN ĐƠN VỊ | LIÊN KẾT | CẬP NHẬT  (dòng 1 là tiêu đề; có thể sửa tay trực tiếp trên Sheets)
 *
 * - Đọc: GET ?action=units&callback=fn (JSONP, công khai)
 * - Ghi: POST payload={"accessCode":"…","units":[{"name":"…","url":"https://…"}]}  (mã truy cập chung, so SHA-256)
 *
 * Cài đặt (dự án Apps Script riêng):
 *  1. Dán toàn bộ file này vào Code.gs của dự án.
 *  2. Chạy hàm initializeSharedAccessCode một lần (cấp quyền Sheets khi được hỏi) – dùng cùng mã truy cập chung với các thủ tục.
 *  3. Triển khai → Triển khai mới → loại "Ứng dụng web": Thực thi với tư cách = Tôi; Ai có quyền truy cập = Bất kỳ ai → Triển khai.
 *  4. Gửi URL /exec cho người quản trang để dán vào hằng UNITS_API_URL trong index.html.
 */
const SHEET_ID = '1oxCFjtQrtCwNWTc0ugP3M_KdOhbt1XYHjTRkJeIuEwk';
const TZ = 'Asia/Ho_Chi_Minh';
const MAX_UNITS = 60;
const HEADER = ['STT', 'TÊN ĐƠN VỊ', 'LIÊN KẾT', 'CẬP NHẬT'];

function initializeSharedAccessCode() {
  PropertiesService.getScriptProperties().setProperty('SHARED_ACCESS_CODE_HASH', '29e642a2f2d2631dbbc95da448972535a2df68e92288e5a20ed88029e075e967');
  Logger.log('Đã bật mã truy cập chung.');
}

function sheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheets()[0]; }

function digest_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function cleanUnits_(list) {
  const seen = {};
  return (Array.isArray(list) ? list : []).map(u => ({
    name: String((u && u.name) || '').replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+/, '').slice(0, 120),
    url: String((u && u.url) || '').trim().slice(0, 300)
  })).filter(u => {
    if (!u.name || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(u.url)) return false;
    const k = u.url.replace(/\/$/, '').toLowerCase();
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function read_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, units: [] };
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  const at = rows.map(r => r[3]).filter(Boolean).pop();
  return {
    ok: true,
    units: cleanUnits_(rows.map(r => ({ name: r[1], url: r[2] }))),
    updatedAtText: at instanceof Date ? Utilities.formatDate(at, TZ, 'dd/MM/yyyy HH:mm:ss') : String(at || '')
  };
}

function write_(list) {
  if (!Array.isArray(list)) throw new Error('Danh sách đơn vị không hợp lệ.');
  if (list.length > MAX_UNITS) throw new Error('Tối đa ' + MAX_UNITS + ' đơn vị.');
  const units = cleanUnits_(list);
  const sh = sheet_();
  sh.getRange(1, 1, 1, 4).setValues([HEADER]).setFontWeight('bold').setBackground('#4c1d95').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).clearContent();
  if (units.length) {
    const now = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss');
    const range = sh.getRange(2, 1, units.length, 4);
    range.setNumberFormat('@');
    range.setValues(units.map((u, i) => [String(i + 1), u.name, u.url, now]));
  }
  console.log(JSON.stringify({ event: 'units_saved', count: units.length }));
  return { ok: true, count: units.length, units: units };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action && p.action !== 'units') throw new Error('Yêu cầu không hợp lệ.');
    out = read_();
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  const json = JSON.stringify(out);
  if (p.callback && /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let out;
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Thiếu payload.');
    const req = JSON.parse(raw);
    const stored = PropertiesService.getScriptProperties().getProperty('SHARED_ACCESS_CODE_HASH');
    if (!stored || !req.accessCode || digest_(String(req.accessCode).trim()) !== stored) throw new Error('Mã truy cập không hợp lệ.');
    lock.waitLock(20000);
    out = write_(req.units);
  } catch (err) {
    console.error(JSON.stringify({ event: 'units_write_failed', error: String(err && err.message || err) }));
    out = { ok: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
