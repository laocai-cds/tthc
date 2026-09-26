/**
 * Writes one unit's edited values to the two converted Google Sheets.
 * Shared credential mode: anyone who knows the code may update any unit STT.
 */
const CONFIG = {
  procedureSpreadsheetId: '1zWKZy2rMCsahX-f96bk9tMJuLcDp13OfKNcQq3T5oXA',
  feeSpreadsheetId: '1TtO9dO5muFTBzSclFDpbAALMdmbiiGb1R5FH0DkARK4',
  procedureTabs: {
    'chinh-thuc': 'CHUYỂN SINH HOẠT CHÍNH THỨC',
    'tam-thoi': 'CHUYỂN SINH HOẠT TẠM THỜI',
    'nhan-xet': 'LẤY PHIẾU NHẬN XÉT NƠI CƯ TRÚ'
  },
  feeTab: 'TIẾN ĐỘ 103 ĐƠN VỊ'
};

function initializeSharedAccessCode() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHARED_ACCESS_CODE_HASH', '29e642a2f2d2631dbbc95da448972535a2df68e92288e5a20ed88029e075e967');
  Object.keys(props.getProperties()).filter(key => key.startsWith('UNIT_')).forEach(key => props.deleteProperty(key));
  Logger.log('Đã bật mã chung và xóa mã riêng cũ.');
}

function doGet(e) {
  const params = e && e.parameter || {};
  const callback = String(params.callback || '');
  if (params.action !== 'read' || !/^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback)) {
    return json_({ ok: false, error: 'Yêu cầu đọc dữ liệu không hợp lệ.' });
  }
  try {
    const procedures = {};
    const procedureBook = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId);
    Object.entries(CONFIG.procedureTabs).forEach(([id, tabName]) => {
      const sheet = procedureBook.getSheetByName(tabName);
      procedures[id] = readCaseRows_(sheet);
    });
    const feeBook = SpreadsheetApp.openById(CONFIG.feeSpreadsheetId);
    const feeSheet = feeBook.getSheetByName(CONFIG.feeTab);
    const result = { ok: true, updatedAt: new Date().toISOString(), procedures, fee: readFeeRows_(feeSheet) };
    return jsonp_(callback, result);
  } catch (err) {
    console.error(JSON.stringify({event:'read_failed', error:String(err && err.message || err)}));
    return jsonp_(callback, {ok:false, error:String(err && err.message || err)});
  }
}

function readCaseRows_(sheet) {
  return readRows_(sheet, 9).filter(r => Number.isInteger(Number(r[0])) && Number(r[0]) > 0).map(r => ({
    id:Number(r[0]), unit:String(r[1] || ''), owner:String(r[2] || ''), guided:String(r[3] || 'Chưa'),
    received:Number(r[4]) || 0, total:Number(r[5]) || 0, processed:Number(r[6]) || 0,
    need:Number(r[7]) || 0, done:Number(r[8]) || 0
  }));
}

function readFeeRows_(sheet) {
  return readRows_(sheet, 12).filter(r => Number.isInteger(Number(r[0])) && Number(r[0]) > 0).map(r => ({
    id:Number(r[0]), unit:String(r[1] || ''), owner:String(r[2] || ''), guided:String(r[3] || 'Chưa'),
    dvccreated:Number(r[4]) || 0, dvctotal:Number(r[5]) || 0, bankcreated:Number(r[6]) || 0,
    banktotal:Number(r[7]) || 0, paid:String(r[8] || ''), note:String(r[11] || '')
  }));
}

function readRows_(sheet, width) {
  if (!sheet) throw new Error('Không tìm thấy trang tính nguồn.');
  const last = sheet.getLastRow();
  if (last < 4) return [];
  return sheet.getRange(4, 1, last - 3, width).getValues();
}

function jsonp_(callback, value) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(value) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e) {
  let unitId = '';
  let procedureId = '';
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Thiếu payload.');
    const request = JSON.parse(raw);
    unitId = String(Number(request.unitId));
    procedureId = String(request.procedureId || '');
    const storedHash = PropertiesService.getScriptProperties().getProperty('SHARED_ACCESS_CODE_HASH');
    if (!storedHash || !request.accessCode || digest_(String(request.accessCode).trim()) !== storedHash) {
      throw new Error('Mã truy cập không hợp lệ.');
    }
    const row = request.values || {};
    if (procedureId === 'dang-phi') updateFee_(unitId, row);
    else updateProcedure_(procedureId, unitId, row);
    console.log(JSON.stringify({event:'write_succeeded', unitId, procedureId}));
    return json_({ ok: true, unitId: Number(unitId), procedureId });
  } catch (err) {
    console.error(JSON.stringify({event:'write_failed', unitId, procedureId, error:String(err && err.message || err)}));
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function updateProcedure_(procedureId, unitId, v) {
  const tabName = CONFIG.procedureTabs[procedureId];
  if (!tabName) throw new Error('Mã thủ tục không hợp lệ.');
  const sheet = SpreadsheetApp.openById(CONFIG.procedureSpreadsheetId).getSheetByName(tabName);
  const row = findUnitRow_(sheet, unitId);
  sheet.getRange(row, 3, 1, 7).setValues([[
    text_(v.owner), yesNo_(v.guided), number_(v.received), number_(v.total),
    number_(v.processed), number_(v.need), number_(v.done)
  ]]);
}

function updateFee_(unitId, v) {
  const sheet = SpreadsheetApp.openById(CONFIG.feeSpreadsheetId).getSheetByName(CONFIG.feeTab);
  const row = findUnitRow_(sheet, unitId);
  sheet.getRange(row, 3, 1, 7).setValues([[
    text_(v.owner), yesNo_(v.guided), number_(v.dvccreated), number_(v.dvctotal),
    number_(v.bankcreated), number_(v.banktotal), String(v.paid || '') === '☑' ? '☑' : '☐'
  ]]);
  sheet.getRange(row, 12).setValue(text_(v.note));
}

function findUnitRow_(sheet, unitId) {
  if (!sheet) throw new Error('Không tìm thấy trang tính đích.');
  const last = sheet.getLastRow();
  if (last < 4) throw new Error('Bảng không có dòng dữ liệu đơn vị.');
  const ids = sheet.getRange(4, 1, last - 3, 1).getDisplayValues();
  const index = ids.findIndex(r => String(Number(r[0])) === unitId);
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
function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}