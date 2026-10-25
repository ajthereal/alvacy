/**
 * Alvacy | Cek Sinyal Badan - lead logger + coach email alert.
 * Lives in the leads Google Sheet: Extensions -> Apps Script.
 * After editing: Deploy -> Manage deployments -> (edit) -> Version: New version -> Deploy.
 * One row per quiz session (Session ID); later events update the same row.
 */
const HEADERS = ['Timestamp','Session ID','Status','Coach','Bahasa','Nama','WhatsApp','Email','Kota','Mau ketemu',
  'Skor total','Kategori','Pola makan','Energi','Tidur & stres','Gerak & otot','Tren badan',
  'Usia','Gender','Goal','Mulai','Pernah coba','Persetujuan','Update terakhir'];
const KEYS = [null,'sid','status','coach','lang','name','wa','email','city','mode',
  'total','band','food','energy','sleep','move','trend','age','gender','goal','start','tried','consent',null];

/* Who gets an email when a new lead arrives, by coach name shown on the site. */
const COACH_EMAILS = { 'Coach AJ': 'aj.thereal@gmail.com' };
const DEFAULT_EMAIL = 'aj.thereal@gmail.com';

function clean_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  v = String(v).slice(0, 300);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const first = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (first.join('|') !== HEADERS.join('|')) sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (!d.sid) return ContentService.createTextOutput('missing sid');
    const sh = sheet_();
    const n = HEADERS.length, now = new Date();
    const row = KEYS.map(k => k ? clean_(d[k]) : '');
    row[0] = now; row[n - 1] = now;
    const last = sh.getLastRow();
    let r = -1;
    if (last > 1) {
      const ids = sh.getRange(2, 2, last - 1, 1).getValues().map(x => x[0]);
      const i = ids.indexOf(d.sid);
      if (i >= 0) r = i + 2;
    }
    if (r > 0) {
      const cur = sh.getRange(r, 1, 1, n).getValues()[0];
      row[0] = cur[0];
      for (let c = 1; c < n - 1; c++) if (row[c] === '') row[c] = cur[c];
      sh.getRange(r, 1, 1, n).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    if (d.status === 'Lead masuk') notify_(d);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function notify_(d) {
  const to = COACH_EMAILS[d.coach] || DEFAULT_EMAIL;
  const wa = String(d.wa || '').replace(/\D/g, '');
  const body = [
    'Lead baru dari Body Age Assessment',
    '',
    'Nama: ' + d.name,
    'WhatsApp: +' + wa + '  ->  https://wa.me/' + wa,
    'Email: ' + d.email,
    'Kota: ' + d.city + ' | Mau: ' + d.mode,
    '',
    'Skor total: ' + d.total + '/100 (' + d.band + ')',
    'Pola makan ' + d.food + ' | Energi ' + d.energy + ' | Tidur & stres ' + d.sleep + ' | Gerak & otot ' + d.move + ' | Tren badan ' + d.trend,
    '',
    'Usia: ' + d.age + ' | Gender: ' + d.gender,
    'Goal: ' + d.goal + ' | Mulai: ' + d.start,
    'Pernah coba: ' + d.tried,
    '',
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].join('\n');
  try { MailApp.sendEmail(to, 'Lead baru: ' + d.name + ' (' + d.total + '/100)', body); } catch (err) {}
}

function doGet() {
  return ContentService.createTextOutput('Alvacy lead logger is running.');
}
