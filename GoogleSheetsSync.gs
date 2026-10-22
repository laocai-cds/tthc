/**
 * API đồng bộ trang laocai-cds.github.io/tthc <-> Google Sheets (phiên bản 3).
 * - Đọc: GET ?action=read&callback=fn (JSONP)
 * - Ghi: POST payload=JSON (mã truy cập chung, kiểm tra bằng SHA-256)
 * - Trang web các đơn vị (menu trái): đọc GET ?action=units&callback=fn; ghi POST {action:'units', accessCode, units:[{name,url}]}
 *   → lưu ở tab "TRANG WEB ĐƠN VỊ" của bảng tính thủ tục (có thể sửa tay trực tiếp trên Sheets).
 * - Ảnh kiểm chứng: lưu vào thư mục Drive "ảnh lưu kiểm chứng",
 *   đường dẫn ghi vào cột M, thời gian ghi vào cột N của tab thủ tục.
 *
 * Sau khi dán code: Triển khai > Quản lý bản triển khai > (bút chì) > Phiên bản mới > Triển khai,
 * rồi cấp quyền Google Drive khi được hỏi.
 */
const CONFIG = {
  version: 3,
  procedureSpreadsheetId: '1zWKZy2rMCsahX-f96bk9tMJuLcDp13OfKNcQq3T5oXA',
  feeSpreadsheetId: '1TtO9dO5muFTBzSclFDpbAALMdmbiiGb1R5FH0DkARK4',
  proofFolderId: '1Zv_bKy_tck-aktO-LIRR0H4szaPWBc-b',
  procedureTabs: {
    'chinh-thuc': 'CHUYỂN SINH HOẠT CHÍNH THỨC',
    'tam-thoi': 'CHUYỂN SINH HOẠT TẠM THỜI',
    'nhan-xet': 'LẤY PHIẾU NHẬN XÉT NƠI CƯ TRÚ'
  },
  feeTab: 'TIẾN ĐỘ 103 ĐƠN VỊ',
  unitSitesTab: 'TRANG WEB ĐƠN VỊ', // trong bảng tính thủ tục: STT | TÊN ĐƠN VỊ | LIÊN KẾT | CẬP NHẬT
  adminDefaults: { accounts: 274, activated: 256 },
  // Cột (1-based)
  caseProofCol: 13,   // M: ẢNH KIỂM CHỨNG
  caseProofTimeCol: 14, // N: NGÀY CẬP NHẬT ẢNH
  feeNoteCol: 13,     // M: LƯU Ý
  maxImageBytes: 8 * 1024 * 1024
};

function initializeSharedAccessCode() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHARED_ACCESS_CODE_HASH', '29e642a2f2d2631dbbc95da448972535a2df68e92288e5a20ed88029e075e967');
  Object.keys(props.getProperties()).filter(key => key.startsWith('UNIT_')).forEach(key => props.deleteProperty(key));
  Logger.log('Đã bật mã chung và xóa mã riêng cũ.');
}

/** Chạy một lần trong trình soạn thảo để cấp quyền Drive và kiểm tra thư mục ảnh. */
function testProofFolder() {
  const folder = DriveApp.getFolderById(CONFIG.proofFolderId);
  Logger.log('Thư mục ảnh: ' + folder.getName() + ' — ' + folder.getUrl());
}

function doGet(e) {
  const params = e && e.parameter || {};
  const callback = String(params.callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback) || (params.action !== 'read' && params.action !== 'units')) {
    return json_({ ok: false, error: 'Yêu cầu đọc dữ liệu không hợp lệ.' });
  }
  if (params.action === 'units') {
    try { return jsonp_(callback, unitsRead_()); }
    catch (err) { return jsonp_(callback, { ok: false, error: String(err && err.message || err) }); }
  }
  try {
    const cached = params.fresh ? null : cacheGet_();
    if (cached) return jsonpText_(callback, cached);
    const procedures = {};
    const procedureBook = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
    Object.entries(CONFIG.procedureTabs).forEach(([id, tabName]) => {
      procedures[id] = readCaseRows_(procedureBook.getSheetByName(tabName));
    });
    const feeSheet = SpreadsheetApp.openById(CONFIG.feeSpreadsheetId).getSheetByName(CONFIG.feeTab);
    const props = PropertiesService.getScriptProperties();
    const body = JSON.stringify({
      ok: true,
      version: CONFIG.version,
      updatedAt: new Date().toISOString(),
      procedures,
      fee: readFeeRows_(feeSheet),
      admin: {
        accounts: Number(props.getProperty('ADMIN_ACCOUNT_COUNT') || CONFIG.adminDefaults.accounts),
        activated: Number(props.getProperty('ADMIN_ACTIVATED_COUNT') || CONFIG.adminDefaults.activated)
      }
    });
    cachePut_(body);
    return jsonpText_(callback, body);
  } catch (err) {
    console.error(JSON.stringify({event:'read_failed', error:String(err && err.message || err)}));
    return jsonp_(callback, {ok:false, error:String(err && err.message || err)});
  }
}

function readCaseRows_(sheet) {
  return readRows_(sheet, CONFIG.caseProofTimeCol).filter(validId_).map(r => ({
    id:Number(r[0]), unit:String(r[1] || ''), owner:String(r[2] || ''), guided:String(r[3] || 'Chưa'),
    received:Number(r[4]) || 0, total:Number(r[5]) || 0, processed:Number(r[6]) || 0,
    need:Number(r[7]) || 0, done:Number(r[8]) || 0,
    done10: r[9] === true || String(r[9]).toUpperCase() === 'TRUE',
    proofImage:String(r[CONFIG.caseProofCol - 1] || ''),
    proofUpdated:dateText_(r[CONFIG.caseProofTimeCol - 1])
  }));
}

function readFeeRows_(sheet) {
  return readRows_(sheet, CONFIG.feeNoteCol).filter(validId_).map(r => ({
    id:Number(r[0]), unit:String(r[1] || ''), owner:String(r[2] || ''), guided:String(r[3] || 'Chưa'),
    dvccreated:Number(r[4]) || 0, dvctotal:Number(r[5]) || 0, bankcreated:Number(r[6]) || 0,
    banktotal:Number(r[7]) || 0, paid:String(r[8] || ''),
    collected:(r[9] === '' || r[9] == null) ? '' : r[9],
    note:String(r[CONFIG.feeNoteCol - 1] || '')
  }));
}

function readRows_(sheet, width) {
  if (!sheet) throw new Error('Không tìm thấy trang tính nguồn.');
  const last = sheet.getLastRow();
  if (last < 4) return [];
  return sheet.getRange(4, 1, last - 3, width).getValues();
}
function validId_(r) { return Number.isInteger(Number(r[0])) && Number(r[0]) > 0 && String(r[0]) !== ''; }

function doPost(e) {
  let unitId = '';
  let procedureId = '';
  const lock = LockService.getScriptLock();
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Thiếu payload.');
    const request = JSON.parse(raw);
    const storedHash = PropertiesService.getScriptProperties().getProperty('SHARED_ACCESS_CODE_HASH');
    if (!storedHash || !request.accessCode || digest_(String(request.accessCode).trim()) !== storedHash) {
      throw new Error('Mã truy cập không hợp lệ.');
    }
    lock.waitLock(20000);
    if (request.action === 'units') return json_(unitsWrite_(request.units));
    const isBatch = Array.isArray(request.updates) || request.admin != null;
    if (isBatch) {
      const updates = Array.isArray(request.updates) ? request.updates : [];
      if (updates.length > 500 || (!updates.length && request.admin == null)) throw new Error('Số dòng cập nhật không hợp lệ.');
      updates.forEach(item => {
        unitId = String(Number(item.unitId));
        procedureId = String(item.procedureId || '');
        applyUpdate_(procedureId, unitId, item.values || {});
      });
      if (request.admin != null) {
        const accounts = Number(request.admin.accounts);
        const activated = Number(request.admin.activated);
        if (!Number.isInteger(accounts) || accounts < 0 || !Number.isInteger(activated) || activated < 0 || activated > accounts) {
          throw new Error('Số liệu tổng hợp tài khoản quản trị không hợp lệ.');
        }
        PropertiesService.getScriptProperties().setProperties({
          ADMIN_ACCOUNT_COUNT: String(accounts),
          ADMIN_ACTIVATED_COUNT: String(activated)
        });
      }
      sortTouchedTabs_();
      console.log(JSON.stringify({event:'batch_write_succeeded', count:updates.length, adminUpdated:request.admin != null}));
      return json_({ ok: true, count: updates.length, adminUpdated: request.admin != null });
    }
    unitId = String(Number(request.unitId));
    procedureId = String(request.procedureId || '');
    const result = applyUpdate_(procedureId, unitId, request.values || {});
    sortTouchedTabs_();
    console.log(JSON.stringify({event:'write_succeeded', unitId, procedureId, proof:!!(result && result.proofImage)}));
    return json_(Object.assign({ ok: true, unitId: Number(unitId), procedureId }, result || {}));
  } catch (err) {
    console.error(JSON.stringify({event:'write_failed', unitId, procedureId, error:String(err && err.message || err)}));
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    cacheClear_();
    try { lock.releaseLock(); } catch (_) {}
  }
}

function applyUpdate_(procedureId, unitId, values) {
  if (!Number.isInteger(Number(unitId)) || Number(unitId) < 1) throw new Error('STT đơn vị không hợp lệ.');
  if (procedureId === 'dang-phi') return updateFee_(unitId, values);
  return updateProcedure_(procedureId, unitId, values);
}

function updateProcedure_(procedureId, unitId, v) {
  const tabName = CONFIG.procedureTabs[procedureId];
  if (!tabName) throw new Error('Mã thủ tục không hợp lệ.');
  const sheet = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId).getSheetByName(tabName);
  const row = findUnitRow_(sheet, unitId);
  const values = [
    text_(v.owner), yesNo_(v.guided), number_(v.received), number_(v.total),
    number_(v.processed), number_(v.need), number_(v.done)
  ];
  // Lưu ảnh trước khi ghi số liệu: nếu ảnh lỗi thì không ghi gì cả.
  let proofUrl = '';
  if (v.proofImage && typeof v.proofImage === 'object' && v.proofImage.data) {
    const unitName = String(sheet.getRange(row, 2).getDisplayValue() || '');
    proofUrl = saveProofImage_(procedureId, unitId, unitName, v.proofImage);
  }
  sheet.getRange(row, 3, 1, 7).setValues([values]);
  if (proofUrl) {
    sheet.getRange(row, CONFIG.caseProofCol, 1, 2).setValues([[proofUrl, new Date()]]);
    sheet.getRange(row, CONFIG.caseProofTimeCol).setNumberFormat('dd/MM/yyyy HH:mm');
  }
  TOUCHED_TABS_[tabName] = true;
  return proofUrl ? { proofImage: proofUrl } : null;
}

/** Sắp xếp lại các tab vừa cập nhật theo cột L (KHÓA XẾP HẠNG) tăng dần. */
const TOUCHED_TABS_ = {};
function sortTouchedTabs_() {
  const names = Object.keys(TOUCHED_TABS_);
  if (!names.length) return;
  SpreadsheetApp.flush();
  const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
  names.forEach(name => { try { sortUnitRows_(book.getSheetByName(name)); } catch (err) {
    console.error(JSON.stringify({event:'sort_failed', tab:name, error:String(err && err.message || err)}));
  } delete TOUCHED_TABS_[name]; });
}
function sortUnitRows_(sheet) {
  if (!sheet) return;
  const last = sheet.getLastRow();
  if (last < 5) return;
  const ids = sheet.getRange(4, 1, last - 3, 1).getValues();
  let first = -1, end = -1;
  ids.forEach((r, i) => { if (validId_(r)) { if (first < 0) first = i; end = i; } });
  if (first < 0 || end <= first) return;
  sheet.getRange(4 + first, 1, end - first + 1, CONFIG.caseProofTimeCol).sort([{column: 12, ascending: true}, {column: 1, ascending: true}]);
}


function saveProofImage_(procedureId, unitId, unitName, img) {
  const mime = String(img.mime || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new Error('Định dạng ảnh kiểm chứng không hợp lệ.');
  const bytes = Utilities.base64Decode(String(img.data).replace(/^data:[^,]*,/, ''));
  if (!bytes.length || bytes.length > CONFIG.maxImageBytes) throw new Error('Ảnh kiểm chứng rỗng hoặc quá lớn.');
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  const stamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  const safeUnit = unitName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const name = [procedureId, 'STT' + unitId, safeUnit, stamp].filter(Boolean).join('_') + '.' + ext;
  const file = DriveApp.getFolderById(CONFIG.proofFolderId).createFile(Utilities.newBlob(bytes, mime, name));
  file.setDescription('Ảnh kiểm chứng ' + (CONFIG.procedureTabs[procedureId] || procedureId) + ' — ' + unitName + ' (STT ' + unitId + ')');
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) { /* tên miền có thể chặn chia sẻ công khai */ }
  return file.getUrl();
}

function updateFee_(unitId, v) {
  const sheet = SpreadsheetApp.openById(CONFIG.feeSpreadsheetId).getSheetByName(CONFIG.feeTab);
  const row = findUnitRow_(sheet, unitId);
  sheet.getRange(row, 3, 1, 7).setValues([[
    text_(v.owner), yesNo_(v.guided), number_(v.dvccreated), number_(v.dvctotal),
    number_(v.bankcreated), number_(v.banktotal), String(v.paid || '') === '☑' ? '☑' : '☐'
  ]]);
  // Cột J (hoàn thành thu) là công thức tự đồng bộ — không ghi đè.
  if (v.note !== undefined) sheet.getRange(row, CONFIG.feeNoteCol).setValue(text_(v.note));
  return null;
}

function findUnitRow_(sheet, unitId) {
  if (!sheet) throw new Error('Không tìm thấy trang tính đích.');
  const last = sheet.getLastRow();
  if (last < 4) throw new Error('Bảng không có dòng dữ liệu đơn vị.');
  const ids = sheet.getRange(4, 1, last - 3, 1).getDisplayValues();
  const index = ids.findIndex(r => String(r[0]).trim() !== '' && String(Number(r[0])) === unitId);
  if (index < 0) throw new Error('Không tìm thấy STT đơn vị ' + unitId + '.');
  return index + 4;
}

function number_(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Số liệu phải là số không âm.');
  return n;
}
function yesNo_(value) { return String(value) === 'Có' ? 'Có' : 'Chưa'; }
function text_(value) { return String(value == null ? '' : value).slice(0, 1000); }
function dateText_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
  return String(value || '');
}
function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function jsonp_(callback, value) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(value) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/* ===== Bộ nhớ đệm dữ liệu đọc (giảm thời gian chờ khi nhiều người mở trang cùng lúc) ===== */
const READ_CACHE_SECONDS = 60;
const READ_CACHE_KEY = 'read_v3';
const READ_CACHE_CHUNK = 90000;
function cachePut_(body) {
  try {
    const cache = CacheService.getScriptCache(), parts = {}, n = Math.ceil(body.length / READ_CACHE_CHUNK);
    if (n > 20) return;
    for (let i = 0; i < n; i++) parts[READ_CACHE_KEY + '_' + i] = body.slice(i * READ_CACHE_CHUNK, (i + 1) * READ_CACHE_CHUNK);
    parts[READ_CACHE_KEY + '_n'] = String(n);
    cache.putAll(parts, READ_CACHE_SECONDS);
  } catch (e) { console.warn('cachePut_ failed: ' + e); }
}
function cacheGet_() {
  try {
    const cache = CacheService.getScriptCache(), n = Number(cache.get(READ_CACHE_KEY + '_n') || 0);
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(READ_CACHE_KEY + '_' + i);
    const got = cache.getAll(keys); let body = '';
    for (const k of keys) { if (got[k] == null) return null; body += got[k]; }
    return body;
  } catch (e) { return null; }
}
function cacheClear_() {
  try {
    const keys = [READ_CACHE_KEY + '_n']; for (let i = 0; i < 20; i++) keys.push(READ_CACHE_KEY + '_' + i);
    CacheService.getScriptCache().removeAll(keys);
  } catch (e) {}
}
function jsonpText_(callback, body) {
  return ContentService.createTextOutput(callback + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/* ---------- Trang web các đơn vị (menu trái của trang) ---------- */
function unitSheet_(create) {
  const book = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
  let sh = book.getSheetByName(CONFIG.unitSitesTab);
  if (!sh && create) {
    sh = book.insertSheet(CONFIG.unitSitesTab);
    sh.getRange(1, 1, 1, 4).setValues([['STT', 'TÊN ĐƠN VỊ', 'LIÊN KẾT', 'CẬP NHẬT']]).setFontWeight('bold').setBackground('#4c1d95').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 1, 50); sh.setColumnWidths(2, 1, 320); sh.setColumnWidths(3, 1, 460); sh.setColumnWidths(4, 1, 150);
  }
  return sh;
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

/** Chưa có tab (hoặc tab trống) → units:null để trang dùng danh sách mặc định. */
function unitsRead_() {
  const sh = unitSheet_(false);
  if (!sh) return { ok: true, units: null };
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, units: [] };
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  const units = cleanUnits_(rows.map(r => ({ name: r[1], url: r[2] })));
  const at = rows.map(r => r[3]).filter(Boolean).pop();
  return { ok: true, units: units, updatedAtText: at ? dateText_(at) : '' };
}

function unitsWrite_(list) {
  if (!Array.isArray(list)) throw new Error('Danh sách đơn vị không hợp lệ.');
  if (list.length > 60) throw new Error('Tối đa 60 đơn vị.');
  const units = cleanUnits_(list);
  const sh = unitSheet_(true);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).clearContent();
  if (units.length) {
    const now = new Date();
    const range = sh.getRange(2, 1, units.length, 4);
    range.setNumberFormat('@');
    range.setValues(units.map((u, i) => [String(i + 1), u.name, u.url, Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss')]));
  }
  console.log(JSON.stringify({ event: 'units_saved', count: units.length }));
  return { ok: true, count: units.length, units: units };
}
