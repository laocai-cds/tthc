/**
 * HỒ SƠ CHỜ XỬ LÝ (gqtthc.dcs.vn) -> Google Sheet -> popup "Quản trị hệ thống" của laocai-cds.github.io/tthc
 *
 * Dự án Apps Script RIÊNG (tạo từ một Google Sheet mới, ví dụ "Hồ sơ chờ xử lý"), giống cách làm của
 * dự án "link website". KHÔNG dán vào dự án "Input DangPhi" hoặc "03 thủ tục" vì trùng hàm doGet/doPost.
 *
 * Quyền riêng tư: chỉ lưu các cột trong danh sách cho phép (HS_COLS). Họ tên người nộp (chuHoSo),
 * số định danh, tờ khai, file thành phần, tên cán bộ xử lý KHÔNG được lưu dù bên gửi có gửi kèm.
 *
 * Cài đặt:
 *  1. Tạo Google Sheet mới > Tiện ích mở rộng > Apps Script > dán toàn bộ file này > Lưu.
 *  2. Cài đặt dự án > Thuộc tính tập lệnh > thêm:
 *       SYNC_TOKEN     = mật khẩu đồng bộ (tự đặt, dùng khi bấm nút API trên gqtthc)
 *       AUTH_ENDPOINT  = (không bắt buộc) URL /exec của dự án "03 thủ tục" nếu khác mặc định bên dưới
 *  3. Triển khai > Tùy chọn triển khai mới > Loại: Ứng dụng web
 *       Thực thi: Tôi · Truy cập: Bất kỳ ai > Triển khai (cấp quyền khi được hỏi).
 *  4. Sao chép URL kết thúc bằng /exec, dán vào mục "Đồng bộ" trong popup "Hồ sơ chờ xử lý" trên trang.
 *  Mỗi lần sửa code: Triển khai > Quản lý bản triển khai > bút chì > Phiên bản mới > Triển khai.
 */

const HS = {
  SHEET: 'HoSoChoXuLy',
  TZ: 'Asia/Ho_Chi_Minh',
  // Dự án đang xử lý đăng nhập quản trị (action=whoami). Quyền xem lấy từ đây, không tạo danh sách mới.
  AUTH_DEFAULT: 'https://script.google.com/macros/s/AKfycbym3FHqtE20kg8F3SCuc6LizXSwGhSFT-KBY90c58BuOuRigFbOdyruPkTx4uBscZ-ibw/exec',
  PERM_OK: ['all', 'dl'],   // nhóm quyền được xem: Toàn quyền hoặc "Dữ liệu"
  MAX_ROWS: 3000,
  MAX_CELL: 300,
};

// [khóa trong dữ liệu gửi lên, tiêu đề cột trong Sheet]
const HS_COLS = [
  ['ma', 'Mã hồ sơ'],
  ['tthc', 'Tên TTHC'],
  ['linhVuc', 'Lĩnh vực'],
  ['coQuan', 'Đảng bộ xã, phường'],
  ['ngayNop', 'Ngày nộp'],
  ['han', 'Hạn xử lý toàn quy trình'],
  ['hen', 'Ngày hẹn trả'],
  ['tt', 'Trạng thái'],
  ['buoc', 'Bước xử lý'],
  ['ht', 'Hình thức tiếp nhận (mã)'],
  ['bs', 'Cần bổ sung'],
];

/* ---------- Điểm vào ---------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'hoso') out = hsRead_(p.idToken);
    else if (p.action === 'hoso_status') out = hsStatus_();
    else out = { ok: true, service: 'ho-so-cho-xu-ly' };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return hsReply_(out, p.callback);
}

function doPost(e) {
  let out, data = null;
  try {
    const raw = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || '{}';
    data = JSON.parse(raw);
    if (data.type !== 'hoso') throw new Error('Sai loại dữ liệu.');
    out = hsWrite_(data);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
    hsSaveError_(data && data.syncId, out.error);
  }
  return hsReply_(out);
}

/* ---------- Ghi ---------- */

function hsWrite_(data) {
  const props = PropertiesService.getScriptProperties();
  const want = props.getProperty('SYNC_TOKEN');
  if (!want) throw new Error('Máy chủ chưa cấu hình SYNC_TOKEN.');
  if (hsHash_(String(data.token || '')) !== hsHash_(want)) throw new Error('Mật khẩu đồng bộ không đúng.');

  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (rows.length > HS.MAX_ROWS) throw new Error('Quá nhiều dòng (' + rows.length + ').');

  const header = HS_COLS.map(function (c) { return c[1]; });
  const values = rows.map(function (r) {
    return HS_COLS.map(function (c) { return hsCell_(c[0], r && r[c[0]]); });
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hsSheet_();
    if (values.length) {
      // Đặt định dạng văn bản trước và ép ghi ngay. Nếu sheet là "Bảng" (cột đã định kiểu), Sheets báo lỗi tại đây
      // và BỎ CẢ LÔ thao tác đang chờ, nên mọi bước ghi dữ liệu phải làm sau khối này.
      try { sh.getRange(2, 1, values.length, header.length).setNumberFormat('@'); SpreadsheetApp.flush(); } catch (fmtErr) { /* bỏ qua */ }
    }
    sh.clearContents();
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#f3e6e6');
    if (values.length) sh.getRange(2, 1, values.length, header.length).setValues(values);
    SpreadsheetApp.flush(); // ghi xong dữ liệu trước khi làm việc khác
    try { sh.setFrozenRows(1); SpreadsheetApp.flush(); } catch (frzErr) { /* sheet đã là Bảng: hàng tiêu đề đã cố định sẵn, bỏ qua */ }
    const nowText = Utilities.formatDate(new Date(), HS.TZ, 'dd/MM/yyyy HH:mm:ss');
    props.setProperty('LAST', JSON.stringify({ syncId: String(data.syncId || ''), rowCount: values.length, updatedAtText: nowText }));
    props.deleteProperty('LAST_ERROR');
    return { ok: true, rowCount: values.length, updatedAtText: nowText };
  } finally {
    lock.releaseLock();
  }
}

function hsCell_(key, v) {
  if (key === 'bs') return v && Number(v) ? 1 : 0;
  if (v == null) return '';
  return String(v).slice(0, HS.MAX_CELL);
}

/* ---------- Đọc (chỉ quản trị) ---------- */

function hsRead_(idToken) {
  if (!hsIsAdmin_(idToken)) return { ok: false, error: 'forbidden' };
  const sh = hsSheet_();
  const last = sh.getLastRow();
  const meta = JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST') || '{}');
  if (last < 2) return { ok: true, total: 0, rows: [], updatedAtText: meta.updatedAtText || '' };
  const vals = sh.getRange(2, 1, last - 1, HS_COLS.length).getDisplayValues();
  const rows = vals.map(function (r) {
    const o = {};
    HS_COLS.forEach(function (c, i) { o[c[0]] = c[0] === 'bs' ? (Number(r[i]) ? 1 : 0) : r[i]; });
    return o;
  });
  return { ok: true, total: rows.length, rows: rows, updatedAtText: meta.updatedAtText || '' };
}

function hsStatus_() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    last: JSON.parse(props.getProperty('LAST') || 'null'),
    lastError: JSON.parse(props.getProperty('LAST_ERROR') || 'null'),
  };
}

/* ---------- Quyền: dùng lại whoami của dự án đăng nhập quản trị ---------- */

function hsIsAdmin_(idToken) {
  if (!idToken) return false;
  const cache = CacheService.getScriptCache();
  const key = 'adm_' + hsHash_(idToken);
  const hit = cache.get(key);
  if (hit) return hit === '1';

  const base = PropertiesService.getScriptProperties().getProperty('AUTH_ENDPOINT') || HS.AUTH_DEFAULT;
  let ok = false;
  try {
    const res = UrlFetchApp.fetch(base + '?action=whoami&idToken=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true, followRedirects: true });
    const d = JSON.parse(res.getContentText());
    const perms = Array.isArray(d.perms) && d.perms.length ? d.perms : ['all'];
    ok = !!(d && d.ok && d.role === 'admin' && HS.PERM_OK.some(function (k) { return perms.indexOf(k) >= 0; }));
  } catch (err) {
    ok = false;
  }
  cache.put(key, ok ? '1' : '0', ok ? 300 : 30);
  return ok;
}

/* ---------- Tiện ích ---------- */

function hsSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  return ss.getSheetByName(HS.SHEET) || ss.insertSheet(HS.SHEET);
}

function hsHash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}

function hsSaveError_(syncId, error) {
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_ERROR',
      JSON.stringify({ syncId: String(syncId || ''), error: String(error || '') }));
  } catch (_) {}
}

function hsReply_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy một lần từ trình soạn thảo để cấp quyền UrlFetch/Sheet. */
function testAuthorize() {
  hsSheet_();
  UrlFetchApp.fetch(HS.AUTH_DEFAULT + '?action=whoami', { muteHttpExceptions: true });
  Logger.log('Đã cấp quyền.');
}
