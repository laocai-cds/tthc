/**
 * LỊCH SỬ SỐ LIỆU – phục vụ báo cáo tiến độ theo THÁNG / QUÝ (report-period.js trên trang web).
 *
 * Bảng thủ tục chỉ chứa số lũy kế hiện tại, nên mỗi ngày lưu một ảnh chụp vào tab "LICH SU TIEN DO"
 * (trong bảng tính thủ tục):  NGAY (yyyy-MM-dd) | NGUON | CAP NHAT LUC | DU LIEU (JSON).
 * Báo cáo kỳ = ảnh chụp ngày cuối kỳ; phát sinh trong kỳ = cuối kỳ − ảnh chụp ngày cuối kỳ trước.
 *
 * CÀI ĐẶT (một lần):
 *  1. Apps Script của trang (dự án đang triển khai Web app) → Tệp + → Tập lệnh → đặt tên LichSu → dán toàn bộ tệp này.
 *  2. Trong hàm doGet(e) (tệp Code.gs), thêm dòng sau làm DÒNG ĐẦU TIÊN của hàm:
 *       if (e && e.parameter && e.parameter.action === 'history') return lichSuDoGet_(e);
 *  3. Chọn hàm installDailySnapshotOnce → Chạy (cấp quyền nếu được hỏi). Hàm tạo lịch chạy ~23h30 hằng ngày và lưu ngay ảnh chụp hôm nay.
 *  4. Triển khai → Quản lý các bản triển khai → sửa (bút chì) bản Web app → Phiên bản: Phiên bản mới → Triển khai.
 *     (Giữ nguyên URL /exec cũ, trang web không cần đổi.)
 * Ảnh chụp chỉ có từ ngày cài đặt trở đi; các tháng trước đó không có số liệu lịch sử để tổng hợp.
 */
const LICH_SU = {
  spreadsheetId: '1zWKZy2rMCsahX-f96bk9tMJuLcDp13OfKNcQq3T5oXA',   // bảng tính 03 thủ tục (cùng bảng CONFIG.procedureSpreadsheetId)
  tab: 'LICH SU TIEN DO',
  timeZone: 'Asia/Ho_Chi_Minh',
  chunk: 40                                                       // số đơn vị mỗi ô JSON (ô Sheets tối đa 50.000 ký tự)
};

function installDailySnapshotOnce() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailySnapshot').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailySnapshot').timeBased().everyDays(1).atHour(23).nearMinute(30).inTimezone(LICH_SU.timeZone).create();
  const day = dailySnapshot();
  Logger.log('Đã cài lưu số liệu hằng ngày (~23h30) và lưu ảnh chụp ngày ' + day + '.');
}

/* Lấy đúng số liệu trang web đang đọc (doGet ?action=read) để ảnh chụp luôn khớp với trang. */
function lichSuCurrent_() {
  const out = doGet({ parameter: { action: 'read', callback: 'lichSuCb' } }).getContent();
  const body = out.slice(out.indexOf('(') + 1, out.lastIndexOf(')'));
  const p = JSON.parse(body);
  if (!p || !p.ok) throw new Error('Không đọc được số liệu hiện tại: ' + (p && p.error || 'không rõ lỗi'));
  return p;
}

function dailySnapshot() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Máy chủ đang bận, chưa lưu được ảnh chụp.');
  try {
    const now = new Date(), day = Utilities.formatDate(now, LICH_SU.timeZone, 'yyyy-MM-dd'), at = Utilities.formatDate(now, LICH_SU.timeZone, 'yyyy-MM-dd HH:mm:ss');
    const p = lichSuCurrent_(), parts = [];
    Object.keys(p.procedures || {}).forEach(id => parts.push([id, p.procedures[id] || []]));
    parts.push(['dang-phi', p.fee || []]);
    const rows = [];
    parts.forEach(([source, list]) => {
      list = list.map(r => Object.assign({}, r, { owner: String(r.owner || '').slice(0, 120) }));
      for (let i = 0; i < list.length; i += LICH_SU.chunk) rows.push([day, source, at, JSON.stringify(list.slice(i, i + LICH_SU.chunk))]);
    });
    const sheet = lichSuSheet_();
    const last = sheet.getLastRow();
    if (last >= 2) {                                   // chạy lại trong ngày → ghi đè ảnh chụp cùng ngày
      const days = sheet.getRange(2, 1, last - 1, 1).getDisplayValues().map(r => r[0]);
      const first = days.indexOf(day);
      if (first >= 0) sheet.deleteRows(first + 2, days.lastIndexOf(day) - first + 1);
    }
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setNumberFormat('@').setValues(rows);
    console.log(JSON.stringify({ event: 'snapshot_saved', day, rows: rows.length }));
    return day;
  } finally { lock.releaseLock(); }
}

function lichSuSheet_() {
  const book = SpreadsheetApp.openById(LICH_SU.spreadsheetId);
  let sheet = book.getSheetByName(LICH_SU.tab);
  if (!sheet) {
    sheet = book.insertSheet(LICH_SU.tab);
    sheet.getRange(1, 1, 1, 4).setValues([['NGAY', 'NGUON', 'CAP NHAT LUC', 'DU LIEU']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* GET ?action=history&from=yyyy-MM-dd&to=yyyy-MM-dd&callback=fn
   → { ok, first, last, end: ảnh chụp ngày lưu gần nhất ≤ to, base: ngày lưu gần nhất < from
       (chưa có thì ngày lưu đầu tiên trong kỳ — trang web ghi chú "số liệu đầu kỳ chưa trọn kỳ") } */
function lichSuDoGet_(e) {
  const params = e && e.parameter || {}, callback = String(params.callback || '');
  const reply = v => /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(callback)
    ? ContentService.createTextOutput(callback + '(' + JSON.stringify(v) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
  try { return reply(lichSuRead_(String(params.from || ''), String(params.to || ''))); }
  catch (err) { return reply({ ok: false, error: String(err && err.message || err) }); }
}

function lichSuRead_(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Kỳ báo cáo không hợp lệ.');
  const sheet = SpreadsheetApp.openById(LICH_SU.spreadsheetId).getSheetByName(LICH_SU.tab);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, first: null, last: null, end: null, base: null };
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().map(r => [String(r[0]).slice(0, 10), String(r[1]), '', String(r[3])]);
  const days = Array.from(new Set(values.map(r => r[0]).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  if (!days.length) return { ok: true, first: null, last: null, end: null, base: null };
  const endDay = days.filter(d => d <= to).pop() || null;
  const baseDay = days.filter(d => d < from).pop() || days.filter(d => d >= from && d <= to)[0] || null;
  const build = day => {
    if (!day) return null;
    const out = { date: day, procedures: {}, fee: [] };
    values.filter(r => r[0] === day).forEach(r => {
      const list = JSON.parse(r[3] || '[]');
      if (r[1] === 'dang-phi') out.fee = out.fee.concat(list);
      else out.procedures[r[1]] = (out.procedures[r[1]] || []).concat(list);
    });
    return out;
  };
  return { ok: true, first: days[0], last: days[days.length - 1], end: build(endDay), base: build(baseDay) };
}
