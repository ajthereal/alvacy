/**
 * Alvacy · Cek Sinyal Badan — lead logger.
 * Paste into the leads Google Sheet: Extensions → Apps Script.
 * Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * One row per quiz session (Session ID); later events update the same row.
 */
const COLS = 21; // A..U

function clean_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  v = String(v).slice(0, 300);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // block formula injection
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (!d.sid) return ContentService.createTextOutput('missing sid');
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const now = new Date();
    const row = [now, d.sid, d.status, d.coach, d.lang, d.name, d.city, d.mode, d.total, d.band,
      d.food, d.energy, d.sleep, d.move, d.trend, d.age, d.gender, d.goal, d.start, d.tried, now].map(clean_);
    row[0] = now; row[20] = now;
    const last = sh.getLastRow();
    let r = -1;
    if (last > 1) {
      const ids = sh.getRange(2, 2, last - 1, 1).getValues().map(x => x[0]);
      const i = ids.indexOf(d.sid);
      if (i >= 0) r = i + 2;
    }
    if (r > 0) {
      const cur = sh.getRange(r, 1, 1, COLS).getValues()[0];
      row[0] = cur[0];
      for (let c = 1; c < COLS - 1; c++) if (row[c] === '' ) row[c] = cur[c];
      sh.getRange(r, 1, 1, COLS).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Alvacy lead logger is running.');
}
