/**
 * #transformwithST | Cek Sinyal Badan - lead logger + coach email alert.
 * Lives in the leads Google Sheet: Extensions -> Apps Script.
 * After editing: Deploy -> Manage deployments -> (edit) -> Version: New version -> Deploy.
 * One row per quiz session (Session ID); later events update the same row.
 *
 * Lead emails go through a queue (sheet "Antrean Email"), one digest email per coach at most every MAIL_GAP_MIN minutes,
 * so a busy coach never uses up Gmail's daily sending limit. Every lead's email status is visible in that sheet.
 * One-time setup after pasting this file: run setupEmailQueue() once from the editor, then Deploy -> New version.
 *
 * SENDING: Apps Script's own MailApp stops at about 100 recipients a day on a personal Gmail. For more room, lead emails
 * can go through Brevo's API (free plan: 300 emails a day). Project Settings -> Script properties:
 *   BREVO_API_KEY  = the API key from Brevo (SMTP & API -> API keys)
 *   BREVO_SENDER   = the sender address you verified in Brevo (default: aj.thereal@gmail.com)
 *   BREVO_DAILY_CAP = optional, default 300 (raise it if you move to a paid Brevo plan)
 * Without BREVO_API_KEY it keeps using MailApp. If Brevo fails, it falls back to MailApp while MailApp has quota left.
 */
const HEADERS = ['Timestamp','Session ID','Status','Coach','Bahasa','Nama','WhatsApp','Email','Kota','Mau ketemu',
  'Skor total','Kategori','Pola makan','Energi','Tidur & stres','Gerak & otot','Tren badan',
  'Usia','Gender','Goal','Mulai','Pernah coba','Persetujuan','Update terakhir'];
const KEYS = [null,'sid','status','coach','lang','name','wa','email','city','mode',
  'total','band','food','energy','sleep','move','trend','age','gender','goal','start','tried','consent',null];

/* Lead source lives in columns Z-AC, after column Y ("Masuk CRM", used by the CRM sync). */
const SRC_COL = 26;
const SRC_HEADERS = ['Sumber','Campaign','Konten iklan','Halaman masuk'];
const SRC_KEYS = ['src','campaign','content','landing'];

/* Height and weight from the quiz live in columns AD-AE, and the optional Instagram handle in AF, right after the source columns. */
const BODY_COL = SRC_COL + SRC_HEADERS.length;
const BODY_HEADERS = ['Tinggi (cm)','Berat (kg)','Instagram'];
const BODY_KEYS = ['height','weight','ig'];

/* Who gets an email when a new lead arrives, by coach name shown on the site (COACHES[...].name in assets/site.js).
   Coaches' own addresses are NOT kept here, because this file is in a public repo. Put them in the Sheet's Apps Script:
   Project Settings -> Script properties -> add COACH_EMAILS with a value like
   {"dr. Nova":"a@example.com","dr. Melita":"b@example.com","dr. Lala":"c@example.com","dr. Jevon":"d@example.com"}
   AJ gets a copy of every coach's alert (cc). Coaches without an entry go to DEFAULT_EMAIL only.
   Coaches who joined through alvacy.com/join are read from the "Coaches" sheet automatically (status approved), so they need no entry here. */
const COACH_EMAILS = { 'Coach AJ': 'aj.thereal@gmail.com' };
const DEFAULT_EMAIL = 'aj.thereal@gmail.com';

function coachEmails_() {
  let extra = {};
  try { extra = JSON.parse(PropertiesService.getScriptProperties().getProperty('COACH_EMAILS') || '{}'); } catch (err) {}
  return Object.assign({}, COACH_EMAILS, sheetEmails_(), extra);
}

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
  const src = sh.getRange(1, SRC_COL, 1, SRC_HEADERS.length).getValues()[0];
  if (src.join('|') !== SRC_HEADERS.join('|')) sh.getRange(1, SRC_COL, 1, SRC_HEADERS.length).setValues([SRC_HEADERS]);
  const body = sh.getRange(1, BODY_COL, 1, BODY_HEADERS.length).getValues()[0];
  if (body.join('|') !== BODY_HEADERS.join('|')) sh.getRange(1, BODY_COL, 1, BODY_HEADERS.length).setValues([BODY_HEADERS]);
  return sh;
}

function doPost(e) {
  /* Coach sign-up and edit requests from alvacy.com/join carry kind:'coach'. Everything else is the quiz lead logger below, unchanged. */
  let first = null;
  try { first = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  if (first && first.kind === 'coach') return json_(coachPost_(first));
  if (first && first.kind === 'leads') return json_(portalPost_(first));
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let queued = false;
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
      r = sh.getLastRow();
    }
    const srcRow = SRC_KEYS.map(k => clean_(d[k]));
    if (srcRow.some(v => v !== '')) {
      const curSrc = sh.getRange(r, SRC_COL, 1, SRC_KEYS.length).getValues()[0];
      sh.getRange(r, SRC_COL, 1, SRC_KEYS.length).setValues([srcRow.map((v, i) => v === '' ? curSrc[i] : v)]);
    }
    const bodyRow = BODY_KEYS.map(k => clean_(d[k]));
    if (bodyRow.some(v => v !== '')) {
      const curBody = sh.getRange(r, BODY_COL, 1, BODY_KEYS.length).getValues()[0];
      sh.getRange(r, BODY_COL, 1, BODY_KEYS.length).setValues([bodyRow.map((v, i) => v === '' ? curBody[i] : v)]);
    }
    if (d.status === 'Lead masuk') { notify_(d); queued = true; }
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
    if (queued) { try { flushQueue_(); } catch (err) { logMailError_('flush', err); } }
  }
}

function notify_(d) {
  const to = coachEmails_()[d.coach] || DEFAULT_EMAIL;
  const wa = String(d.wa || '').replace(/\D/g, '');
  if (d.tool === 'plateau') {
    /* Lead from alvacy.com/plateau (Plateau Check). Answers arrive in the quiz columns: band = pattern, tried = methods, start = how long stuck, goal = what they feel. */
    const pb = [
      'Lead baru dari Plateau Check (coach: ' + (d.coach || '-') + ')',
      '',
      'Nama: ' + d.name,
      'WhatsApp: +' + wa + '  ->  https://wa.me/' + wa,
      'Email: ' + d.email,
      'Sumber: ' + (d.src || '-') + (d.campaign ? ' | Campaign: ' + d.campaign : ''),
      '',
      'Pola utama: ' + d.band,
      'Umur: ' + d.age + ' | Stuck sejak: ' + d.start,
      'Yang sudah dicoba: ' + d.tried,
      'Yang dirasakan: ' + d.goal
    ].concat(to === DEFAULT_EMAIL ? ['', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()] : [])
     .concat(portalLine_(d)).join('\n');
    enqueue_(d, to, 'Lead baru (Plateau Check): ' + d.name, pb);
    return;
  }
  const body = [
    'Lead baru dari Body Age Assessment (coach: ' + (d.coach || '-') + ')',
    '',
    'Nama: ' + d.name,
    'WhatsApp: +' + wa + '  ->  https://wa.me/' + wa,
    'Email: ' + d.email,
    'Instagram: ' + (d.ig || '-'),
    'Kota: ' + d.city + ' | Mau: ' + d.mode,
    'Sumber: ' + (d.src || '-') + (d.campaign ? ' | Campaign: ' + d.campaign : '') + (d.content ? ' | Iklan: ' + d.content : ''),
    '',
    'Skor total: ' + d.total + '/100 (' + d.band + ')',
    'Pola makan ' + d.food + ' | Energi ' + d.energy + ' | Tidur & stres ' + d.sleep + ' | Gerak & otot ' + d.move + ' | Tren badan ' + d.trend,
    '',
    'Usia: ' + d.age + ' | Gender: ' + d.gender + ' | Tinggi: ' + (d.height || '-') + ' cm | Berat: ' + (d.weight || '-') + ' kg',
    'Goal: ' + d.goal + ' | Mulai: ' + d.start,
    'Pernah coba: ' + d.tried
  ].concat(to === DEFAULT_EMAIL ? ['', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()] : [])
   .concat(portalLine_(d)).join('\n');
  enqueue_(d, to, 'Lead baru: ' + d.name + ' (' + d.total + '/100)', body);
}

/* =====================================================================================================================
   EMAIL QUEUE
   A personal Gmail account may send to about 100 recipients a day from Apps Script. Mailing every lead (coach + a copy
   to AJ) used that up in one busy day, and the old code swallowed the error, so nothing was sent and nobody knew.
   Now every lead is first written to the sheet "Antrean Email" (Status "Menunggu"). flushQueue_ sends at most one email
   per recipient every MAIL_GAP_MIN minutes, with all that coach's waiting leads in it (a lone lead goes out at once).
   AJ is no longer copied on every lead: he gets a daily summary and a warning when mail is stuck.
   Columns: A Masuk | B Coach | C Penerima | D Session ID | E Subjek | F Isi | G Status | H Dikirim | I Catatan
   ===================================================================================================================== */
/* One place that sends an email. Brevo first (when BREVO_API_KEY is set), MailApp as the fallback. Throws if neither can. */
function sendMail_(to, subject, body) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('BREVO_API_KEY');
  let brevoErr = '';
  if (key && brevoLeft_() > 0) {
    try {
      const res = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'api-key': key, accept: 'application/json' },
        payload: JSON.stringify({ sender: { name: '#transformwithST', email: props.getProperty('BREVO_SENDER') || DEFAULT_EMAIL }, to: [{ email: to }], subject: subject, textContent: body })
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) { brevoCount_(1); return 'brevo'; }
      brevoErr = 'Brevo ' + code + ': ' + String(res.getContentText()).slice(0, 150);
    } catch (err) { brevoErr = 'Brevo: ' + String(err && err.message || err).slice(0, 150); }
  }
  if (MailApp.getRemainingDailyQuota() > 0) { MailApp.sendEmail({ to: to, subject: subject, body: body }); return 'mailapp'; }
  throw new Error(brevoErr || (key ? 'Brevo daily cap reached and MailApp quota used up' : 'MailApp daily quota used up'));
}
function brevoDay_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function brevoUsed_() {
  const v = String(PropertiesService.getScriptProperties().getProperty('BREVO_COUNT') || '').split('|');
  return v[0] === brevoDay_() ? Number(v[1]) || 0 : 0;
}
function brevoCount_(n) { PropertiesService.getScriptProperties().setProperty('BREVO_COUNT', brevoDay_() + '|' + (brevoUsed_() + n)); }
function brevoLeft_() { return Math.max(0, (Number(PropertiesService.getScriptProperties().getProperty('BREVO_DAILY_CAP')) || 300) - brevoUsed_()); }
/* Emails that can still go out today across both senders. */
function mailLeft_() {
  return (PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY') ? brevoLeft_() : 0) + MailApp.getRemainingDailyQuota();
}

const QUEUE_SHEET = 'Antrean Email';
const MAIL_GAP_MIN = 30;     /* at most one email per recipient per this many minutes */
const MAIL_BATCH = 25;       /* leads per email; the rest follow in the next one */
const STUCK_MIN = 60;        /* tell AJ when a lead has waited longer than this */
const QUEUE_HEADS = ['Masuk', 'Coach', 'Penerima', 'Session ID', 'Subjek', 'Isi', 'Status', 'Dikirim', 'Catatan'];

function queueSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(QUEUE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(QUEUE_SHEET);
    sh.getRange(1, 1, 1, QUEUE_HEADS.length).setValues([QUEUE_HEADS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(5, 220); sh.setColumnWidth(6, 120); sh.setColumnWidth(7, 330); sh.setColumnWidth(9, 330);
  }
  return sh;
}
function logMailError_(where, err) {
  try { queueSheet_().appendRow([new Date(), '-', '-', '-', 'Kesalahan: ' + where, '', 'Gagal: ' + String(err && err.message || err).slice(0, 200), '', '']); } catch (e) {}
}
/* Puts one lead's email in the queue. Each Session ID is queued once. */
function enqueue_(d, to, subject, body) {
  const sh = queueSheet_();
  const last = sh.getLastRow();
  if (d.sid && last > 1 && sh.getRange(2, 4, last - 1, 1).getValues().some(r => r[0] === d.sid)) return;
  sh.appendRow([new Date(), d.coach || '-', to, d.sid || '', subject, body, 'Menunggu', '', '']);
}
function setQ_(sh, row, status, sent, note) {
  sh.getRange(row, 7, 1, 3).setValues([[status, sent || '', note || '']]);
}
function hhmm_(t) { return Utilities.formatDate(new Date(t), Session.getScriptTimeZone(), 'HH:mm'); }

function flushQueue_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return;
  try {
    const sh = queueSheet_();
    const last = sh.getLastRow();
    if (last < 2) return;
    const vals = sh.getRange(2, 1, last - 1, QUEUE_HEADS.length).getValues();
    const props = PropertiesService.getScriptProperties();
    const now = new Date();
    const waiting = {};
    vals.forEach((v, i) => {
      if (String(v[6]).indexOf('Menunggu') !== 0) return;
      if (now - new Date(v[0]) > 24 * 3600 * 1000) { setQ_(sh, i + 2, 'Gagal: tidak terkirim dalam 24 jam', '', String(v[8] || '')); return; }
      (waiting[v[2]] = waiting[v[2]] || []).push(i);
    });
    let quota = mailLeft_();
    Object.keys(waiting).forEach(to => {
      const idx = waiting[to].slice(0, MAIL_BATCH);
      const nextAt = Number(props.getProperty('LAST_MAIL_' + to) || 0) + MAIL_GAP_MIN * 60000;
      if (now.getTime() < nextAt) {
        waiting[to].forEach(i => setQ_(sh, i + 2, 'Menunggu: email rangkuman berikutnya sekitar ' + hhmm_(nextAt), '', ''));
        return;
      }
      if (quota < 1) {
        waiting[to].forEach(i => setQ_(sh, i + 2, 'Menunggu: batas kirim email harian sudah habis, dicoba lagi otomatis', '', 'Kuota reset sendiri dalam 24 jam'));
        return;
      }
      const one = idx.length === 1;
      const subject = one ? vals[idx[0]][4] : idx.length + ' lead baru (' + vals[idx[0]][1] + (vals[idx[0]][1] !== vals[idx[idx.length - 1]][1] ? ' dan lainnya' : '') + ')';
      const body = idx.map((i, n) => (one ? '' : (n + 1) + '/' + idx.length + '\n') + vals[i][5]).join('\n\n----------------------------------------\n\n')
        + (waiting[to].length > idx.length ? '\n\n(' + (waiting[to].length - idx.length) + ' lead lain menyusul di email berikutnya)' : '');
      try {
        sendMail_(to, subject, body);
        quota--;
        props.setProperty('LAST_MAIL_' + to, String(now.getTime()));
        idx.forEach(i => setQ_(sh, i + 2, 'Terkirim', now, idx.length > 1 ? 'Dalam 1 email rangkuman (' + idx.length + ' lead)' : ''));
      } catch (err) {
        const msg = String(err && err.message || err).slice(0, 200);
        idx.forEach(i => setQ_(sh, i + 2, 'Menunggu: gagal kirim, dicoba lagi otomatis', '', msg));
      }
    });
    warnIfStuck_(sh);
  } finally {
    lock.releaseLock();
  }
}

/* Emails AJ once every 6 hours while any lead has been waiting longer than STUCK_MIN. */
function warnIfStuck_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const vals = sh.getRange(2, 1, last - 1, QUEUE_HEADS.length).getValues();
  const now = new Date();
  const stuck = vals.filter(v => String(v[6]).indexOf('Menunggu') === 0 && now - new Date(v[0]) > STUCK_MIN * 60000);
  if (!stuck.length) return;
  const props = PropertiesService.getScriptProperties();
  if (now.getTime() - Number(props.getProperty('LAST_STUCK_ALERT') || 0) < 6 * 3600 * 1000) return;
  if (mailLeft_() < 1) return;   /* nothing can be sent; the sheet "Antrean Email" shows it */
  const byCoach = {};
  stuck.forEach(v => { byCoach[v[1]] = (byCoach[v[1]] || 0) + 1; });
  try {
    sendMail_(DEFAULT_EMAIL, 'Email lead tertahan: ' + stuck.length + ' lead belum terkirim',
      'Ada ' + stuck.length + ' lead yang emailnya belum terkirim lebih dari ' + STUCK_MIN + ' menit.\n\n' +
      Object.keys(byCoach).map(c => '- ' + c + ': ' + byCoach[c]).join('\n') + '\n\nAlasan terakhir: ' + (stuck[stuck.length - 1][6] + ' ' + stuck[stuck.length - 1][8]).trim() +
      '\nSisa kuota kirim email hari ini: ' + mailLeft_() + '\nDetail per lead: sheet "' + QUEUE_SHEET + '" -> ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    props.setProperty('LAST_STUCK_ALERT', String(now.getTime()));
  } catch (err) { logMailError_('peringatan tertahan', err); }
}

/* Daily summary to AJ (trigger at 21:00). */
function dailySummary_() {
  const sh = queueSheet_();
  const last = sh.getLastRow();
  const tz = Session.getScriptTimeZone(), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const vals = last > 1 ? sh.getRange(2, 1, last - 1, QUEUE_HEADS.length).getValues() : [];
  const todays = vals.filter(v => v[0] && Utilities.formatDate(new Date(v[0]), tz, 'yyyy-MM-dd') === today && v[3]);
  const by = {};
  todays.forEach(v => {
    const o = by[v[1]] = by[v[1]] || { total: 0, sent: 0, wait: 0, fail: 0 };
    o.total++;
    const st = String(v[6]);
    if (st === 'Terkirim') o.sent++; else if (st.indexOf('Menunggu') === 0) o.wait++; else o.fail++;
  });
  const lines = Object.keys(by).map(c => '- ' + c + ': ' + by[c].total + ' lead, ' + by[c].sent + ' terkirim, ' + by[c].wait + ' menunggu, ' + by[c].fail + ' gagal');
  sendMail_(DEFAULT_EMAIL, 'Ringkasan lead hari ini: ' + todays.length + ' lead',
    (lines.length ? lines.join('\n') : 'Tidak ada lead hari ini.') + portalSpeedText_() + '\n\nSisa kuota kirim email hari ini: ' + mailLeft_() + '\nDetail: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

/* Run once from the editor after pasting this file. Creates the queue sheet and the two triggers. */
function setupEmailQueue() {
  queueSheet_();
  ScriptApp.getProjectTriggers().forEach(t => { if (['flushQueue_', 'dailySummary_'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('flushQueue_').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('dailySummary_').timeBased().atHour(21).everyDays(1).create();
  const msg = 'Siap: sheet "' + QUEUE_SHEET + '" dibuat, email rangkuman jalan tiap 5 menit, ringkasan harian jam 21:00. Pengirim: ' + (PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY') ? 'Brevo (sisa ' + brevoLeft_() + ' hari ini), cadangan MailApp' : 'MailApp saja (belum ada BREVO_API_KEY)') + '. Sisa kuota email hari ini: ' + mailLeft_() + '. Jangan lupa Deploy -> Manage deployments -> New version.';
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Antrean email', 20); } catch (e) {}
  return msg;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a) return coachGetRoute_(p);
  return ContentService.createTextOutput('#transformwithST lead logger is running.');
}

/* =====================================================================================================================
   COACHES: alvacy.com/join
   A coach opens alvacy.com/join/?i=<JOIN_CODE>, fills in the form and uploads cropped photos. The data lands in the
   "Coaches" sheet (status "pending"), the photos in Drive, and AJ gets an email with a review link. Approving it
   writes data/coaches.js and the images into the GitHub repo (one commit), which puts the coach on the site.
   The coach gets an edit link (alvacy.com/join/?edit=<token>) to change number, email, photos, numbers or story later.

   One-time setup (see COACHES.md):
     1. Project Settings -> Script properties:  JOIN_CODE (the invite code you hand out),  GITHUB_TOKEN (fine-grained token,
        repo ajthereal/alvacy, permission Contents: Read and write).
     2. Run setupCoaches() once from the editor and accept the permissions. It checks everything and tells you what is missing.
     3. Deploy -> Manage deployments -> edit -> New version -> Deploy.
   Optional script properties: GITHUB_REPO (default ajthereal/alvacy), GITHUB_BRANCH (default main), WEBAPP_URL.
   ===================================================================================================================== */
const COACH_SHEET = 'Coaches';
const SITE_URL = 'https://alvacy.com';
const WEBAPP_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbzHYCy85pcm4xrpc_WEtsaBsibqSqL1nnCM9J73-kLUhlQXbolvuyQogj7fnDmW17WiRg/exec';
/* Every column is plain text. files = JSON {before:{id,name},after,photo,face}: Drive file id and the file name used on the site. */
const COACH_FIELDS = [
  ['code', 'Kode'], ['status', 'Status'], ['created', 'Dibuat'], ['updated', 'Diubah'],
  ['name', 'Nama tampil'], ['fullName', 'Nama lengkap'], ['wa', 'WhatsApp'], ['email', 'Email'], ['booking', 'Link booking'], ['palette', 'Palet'],
  ['kgFrom', 'Berat awal'], ['kgTo', 'Berat sekarang'], ['fatFrom', 'Lemak awal'], ['fatTo', 'Lemak sekarang'], ['vfaFrom', 'VFA awal'], ['vfaTo', 'VFA sekarang'],
  ['storyId', 'Cerita (ID)'], ['hlId', 'Highlight (ID)'], ['storyEn', 'Cerita (EN)'], ['hlEn', 'Highlight (EN)'],
  ['token', 'Token edit'], ['approveKey', 'Kunci approve'], ['folder', 'Folder Drive'], ['files', 'File gambar'],
  ['imgNew', 'Gambar baru'], ['published', 'Tayang terakhir'], ['reqId', 'Request ID'], ['note', 'Catatan'], ['leadsKey', 'Kunci leads']
];
/* Codes that must never be taken: the coaches written in assets/site.js and every folder or page on the site. */
const COACH_RESERVED = ['aj', 'nova', 'lala', 'jevon', 'melita', 'lucky', 'test', 'kalori', 'lunch', 'tools', 'privacy', 'transform', 'en', 'images',
  'assets', 'scripts', 'data', 'join', 'leads', 'zoom', 'body-age', 'index', 'api', 'admin', 'coach', 'coaches', 'www', 'alvacy', 'github', 'apps-script', 'tim'];
const COACH_FIXED_NAMES = ['coach aj', 'dr. nova', 'dr. lala', 'dr. jevon', 'dr. melita', 'dr. lucky'];
const IMG_KEYS = ['before', 'after', 'photo', 'face'];
const IMG_MAX_BYTES = 1200000;

/* Coach work uses the document lock, so a slow photo upload or publish never makes the quiz lead logger (script lock) wait. */
function coachLock_(ms) { const l = LockService.getDocumentLock() || LockService.getScriptLock(); l.waitLock(ms); return l; }
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function webAppUrl_() { let u = ''; try { u = ScriptApp.getService().getUrl(); } catch (e) {} return u || prop_('WEBAPP_URL') || WEBAPP_URL_FALLBACK; }
function htmlEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function sameStr_(a, b) { a = String(a || ''); b = String(b || ''); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function randHex_(n) { let s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }

function sheetEmails_() {
  const out = {};
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COACH_SHEET);
    if (!sh) return out;
    readCoaches_(sh).forEach(r => { if (r.status === 'approved' && r.name && r.email) out[r.name] = r.email; });
  } catch (err) {}
  return out;
}

/* ---------- sheet ---------- */
function coachSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(COACH_SHEET);
  if (!sh) sh = ss.insertSheet(COACH_SHEET);
  const heads = COACH_FIELDS.map(f => f[1]);
  pEnsureCols_(sh, heads.length);
  const cur = sh.getRange(1, 1, 1, heads.length).getValues()[0];
  if (cur.join('|') !== heads.join('|')) {
    sh.getRange(1, 1, 1, heads.length).setValues([heads]);
    sh.setFrozenRows(1);
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 500), heads.length).setNumberFormat('@');
  }
  return sh;
}
function readCoaches_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, COACH_FIELDS.length).getValues();
  return vals.map((v, i) => {
    const o = { _row: i + 2 };
    COACH_FIELDS.forEach((f, j) => { o[f[0]] = String(v[j] == null ? '' : v[j]); });
    return o;
  }).filter(o => o.code);
}
function writeCoach_(sh, o) {
  sh.getRange(o._row, 1, 1, COACH_FIELDS.length).setValues([COACH_FIELDS.map(f => String(o[f[0]] == null ? '' : o[f[0]]))]);
}
function findBy_(rows, key, val) {
  val = String(val || '');
  if (val.length < 6) return null;
  for (let i = 0; i < rows.length; i++) if (sameStr_(rows[i][key], val)) return rows[i];
  return null;
}

/* ---------- validation ---------- */
function coachClean_(d, creating, self) {
  const bad = (field, message) => ({ ok: false, field: field, error: field || 'invalid', message: message });
  const txt = (v, n) => String(v == null ? '' : v).replace(/[<>\u0000-\u001f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const num = v => { if (v === null || v === undefined || v === '') return null; const x = Number(v); return isFinite(x) ? Math.round(x * 10) / 10 : NaN; };
  const c = {};
  if (d.hp) return bad('', 'Ditolak.');
  if (d.consent !== true) return bad('consent', 'Centang persetujuan dulu ya.');
  if (creating) {
    const jc = prop_('JOIN_CODE');
    if (!jc) return bad('invite', 'Pendaftaran belum dibuka. Hubungi AJ.');
    if (!sameStr_(String(d.invite || '').trim().toLowerCase(), jc.trim().toLowerCase())) return bad('invite', 'Kode undangan tidak cocok. Minta kode yang benar ke AJ.');
    c.code = String(d.code || '').toLowerCase();
    if (!/^[a-z0-9]{3,16}$/.test(c.code)) return bad('code', 'Pakai 3 sampai 16 huruf kecil atau angka.');
    if (COACH_RESERVED.indexOf(c.code) >= 0) return bad('code', 'Kode ini sudah dipakai halaman lain. Coba yang lain.');
  } else { c.code = self.code; }
  c.name = txt(d.name, 40).replace(/["&\\]/g, '').trim();
  if (c.name.length < 3) return bad('name', 'Isi nama yang tampil.');
  const nm = c.name.toLowerCase();
  if (COACH_FIXED_NAMES.indexOf(nm) >= 0) return bad('name', 'Nama ini sudah dipakai coach lain. Tambahkan nama belakang, misalnya “dr. Jena W.”');
  c.fullName = txt(d.fullName, 60).replace(/["&\\]/g, '').trim() || c.name;
  c.wa = String(d.wa || '').replace(/\D/g, '');
  if (!/^[1-9]\d{9,14}$/.test(c.wa) || (c.wa.indexOf('62') === 0 && (c.wa.length < 11 || c.wa.length > 14))) return bad('wa', 'Nomor WhatsApp belum benar.');
  c.email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(c.email)) return bad('email', 'Email belum benar.');
  c.booking = String(d.booking || '').trim().slice(0, 300);
  if (c.booking && !/^https:\/\/[^\s"'<>\\]+$/.test(c.booking)) return bad('booking', 'Link booking harus diawali https://');
  c.palette = ['sky', 'rose', 'sage'].indexOf(d.palette) >= 0 ? d.palette : 'sky';
  const kg0 = num(d.kg && d.kg.from), kg1 = num(d.kg && d.kg.to);
  if (kg0 === null || kg1 === null || isNaN(kg0) || isNaN(kg1) || !(kg0 > kg1) || kg0 > 400 || kg1 < 20) return bad('kg', 'Cek berat awal dan sekarang. Berat sekarang harus lebih kecil.');
  c.kgFrom = kg0; c.kgTo = kg1;
  const pair = (obj, key, lo, hi) => {
    const a = num(obj && obj.from), b = num(obj && obj.to);
    if (!obj || (a === null && b === null)) return { ok: true, a: '', b: '' };
    if (a === null || b === null || isNaN(a) || isNaN(b) || !(a > b) || a < lo || a > hi || b < lo) return null;
    return { ok: true, a: a, b: b };
  };
  const fat = pair(d.fat, 'fat', 3, 70); if (!fat) return bad('fat', 'Cek angka lemak tubuh, atau kosongkan keduanya.');
  const vfa = pair(d.vfa, 'vfa', 1, 60); if (!vfa) return bad('vfa', 'Cek angka lemak visceral, atau kosongkan keduanya.');
  c.fatFrom = fat.a; c.fatTo = fat.b; c.vfaFrom = vfa.a; c.vfaTo = vfa.b;
  c.storyId = txt(d.story, 420);
  if (c.storyId.length < 60) return bad('story', 'Ceritanya masih terlalu pendek.');
  c.hlId = txt(d.highlight, 50);
  return { ok: true, c: c };
}
function decodeImage_(key, dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { err: 'Foto ' + key + ' tidak terbaca. Pilih ulang fotonya.' };
  const bytes = Utilities.base64Decode(m[1]);
  if (!bytes || bytes.length < 2000) return { err: 'Foto ' + key + ' terlalu kecil atau rusak.' };
  if (bytes.length > IMG_MAX_BYTES) return { err: 'Foto ' + key + ' terlalu besar.' };
  if ((bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[2] & 255) !== 255) return { err: 'Foto ' + key + ' bukan JPEG yang valid.' };
  return { bytes: bytes };
}
function hashHex_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes).map(b => ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2)).join('').slice(0, 8);
}
function siteFileName_(code, key, h) {
  return ({ before: code + '-before-' + h + '.jpg', after: code + '-after-' + h + '.jpg', photo: 'coach-' + code + '-' + h + '.jpg', face: 'coach-' + code + '-face-' + h + '.jpg' })[key];
}
function siteDir_(key) { return key === 'before' || key === 'after' ? 'images/results/' : 'images/'; }

function coachRoot_() {
  const id = prop_('COACH_ROOT_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName('transformwithST coaches');
  const f = it.hasNext() ? it.next() : DriveApp.createFolder('transformwithST coaches');
  PropertiesService.getScriptProperties().setProperty('COACH_ROOT_FOLDER', f.getId());
  return f;
}
/* Saves the photos that arrived (keys of `images`) into the coach's Drive folder; returns the updated files map. */
function storeImages_(code, folderId, files, images) {
  let folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) {} }
  if (!folder) folder = coachRoot_().createFolder(code);
  const out = Object.assign({}, files);
  IMG_KEYS.forEach(k => {
    if (!images || !images[k]) return;
    const dec = decodeImage_(k, images[k]);
    const h = hashHex_(dec.bytes), name = siteFileName_(code, k, h);
    const f = folder.createFile(Utilities.newBlob(dec.bytes, 'image/jpeg', name));
    if (out[k] && out[k].id) { try { DriveApp.getFileById(out[k].id).setTrashed(true); } catch (e) {} }
    out[k] = { id: f.getId(), name: name };
  });
  return { folderId: folder.getId(), files: out };
}
function checkImages_(images, need) {
  images = images || {};
  for (let i = 0; i < IMG_KEYS.length; i++) {
    const k = IMG_KEYS[i];
    if (!images[k]) { if (need) return { ok: false, field: '', error: 'image', message: 'Foto ' + k + ' belum ada.' }; continue; }
    const dec = decodeImage_(k, images[k]);
    if (dec.err) return { ok: false, field: '', error: 'image', message: dec.err };
  }
  return { ok: true };
}

/* ---------- entry points (called from doPost / doGet) ---------- */
function coachPost_(d) {
  try {
    if (d.op === 'submit') return coachSubmit_(d);
    if (d.op === 'edit') return coachEdit_(d);
    return { ok: false, error: 'op', message: 'Permintaan tidak dikenali.' };
  } catch (err) {
    try { console.error(String(err && err.stack || err)); } catch (e) {}
    return { ok: false, error: 'server', message: 'Ada gangguan di server. Coba lagi sebentar lagi. Kalau terus begini, hubungi AJ.' };
  }
}
function coachGetRoute_(p) {
  try {
    if (p.a === 'get') return json_(coachGet_(String(p.t || '')));
    if (p.a === 'review') return coachReviewPage_(String(p.c || ''), String(p.k || ''));
    if (p.a === 'approve' || p.a === 'reject') return coachDecidePage_(p.a, String(p.c || ''), String(p.k || ''), p.go === '1');
  } catch (err) {
    try { console.error(String(err && err.stack || err)); } catch (e) {}
    if (p.a === 'get') return json_({ ok: false, message: 'Ada gangguan di server.' });
    return HtmlService.createHtmlOutput('<p style="font:16px system-ui;padding:24px">Ada gangguan: ' + htmlEsc_(String(err && err.message || err)) + '</p>');
  }
  return json_({ ok: false, message: 'Tidak dikenali.' });
}

function coachSubmit_(d) {
  const cache = CacheService.getScriptCache();
  const rk = 'req:' + String(d.reqId || '').slice(0, 80);
  if (d.reqId) { const hit = cache.get(rk); if (hit) return JSON.parse(hit); }
  const n = Number(cache.get('rate') || 0);
  if (n > 40) return { ok: false, error: 'rate', message: 'Terlalu banyak percobaan. Coba lagi satu jam lagi.' };
  cache.put('rate', String(n + 1), 3600);
  const v = coachClean_(d, true);
  if (!v.ok) return v;
  const c = v.c;
  const im = checkImages_(d.images, true); if (!im.ok) return im;
  const pre = readCoaches_(coachSheet_());
  if (pre.some(r => r.code === c.code)) return { ok: false, field: 'code', error: 'code', message: 'Kode ini sudah dipakai coach lain. Coba yang lain.' };
  if (pre.some(r => r.name.toLowerCase() === c.name.toLowerCase())) return { ok: false, field: 'name', error: 'name', message: 'Nama ini sudah dipakai coach lain. Tambahkan nama belakang, misalnya “dr. Jena W.”' };

  const stored = storeImages_(c.code, '', {}, d.images);   /* slow part, done before taking the lock */
  const now = new Date().toISOString();
  const row = Object.assign({}, c, { status: 'pending', created: now, updated: now, storyEn: '', hlEn: '',
    token: randHex_(48), approveKey: randHex_(24), folder: stored.folderId, files: JSON.stringify(stored.files), imgNew: 'TRUE', published: '', reqId: String(d.reqId || ''), note: '' });
  const lock = coachLock_(20000);
  try {
    const sh = coachSheet_(), rows = readCoaches_(sh);
    if (rows.some(r => r.code === c.code) || rows.some(r => r.name.toLowerCase() === c.name.toLowerCase())) {
      try { DriveApp.getFolderById(stored.folderId).setTrashed(true); } catch (e) {}
      return { ok: false, field: 'code', error: 'code', message: 'Kode atau nama ini baru saja dipakai coach lain. Coba yang lain.' };
    }
    sh.appendRow(COACH_FIELDS.map(f => String(row[f[0]] == null ? '' : row[f[0]])));
  } finally { lock.releaseLock(); }

  const editUrl = SITE_URL + '/join/?edit=' + row.token;
  const reviewUrl = webAppUrl_() + '?a=review&c=' + row.code + '&k=' + row.approveKey;
  try {
    MailApp.sendEmail({ to: DEFAULT_EMAIL, subject: 'Coach baru menunggu dicek: ' + row.name,
      body: ['Ada coach baru yang mengisi form.', '', row.fullName + ' (' + row.name + ')', 'Link: ' + SITE_URL + '/' + row.code,
        'WhatsApp: +' + row.wa, 'Email: ' + row.email, 'Berat: ' + row.kgFrom + ' -> ' + row.kgTo + ' kg', '', 'Cerita:', row.storyId, '',
        'Cek foto dan ceritanya, lalu setujui atau tolak di sini:', reviewUrl, '', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()].join('\n') });
  } catch (err) {}
  try {
    MailApp.sendEmail({ to: row.email, subject: 'Link edit profil coach #transformwithST kamu',
      body: ['Halo ' + row.name + ',', '', 'Terima kasih sudah mengisi. AJ akan mengecek kartu hasilmu. Begitu disetujui, link pribadimu ' + SITE_URL + '/' + row.code + ' langsung tayang dan kamu dapat email lagi.', '',
        'Simpan link ini. Lewat link ini kamu bisa mengubah nomor WhatsApp, email, foto, angka, atau ceritamu kapan saja. Jangan dibagikan ke orang lain.', editUrl].join('\n') });
  } catch (err) {}
  const res = { ok: true, code: row.code, token: row.token, editUrl: editUrl, status: 'pending' };
  if (d.reqId) cache.put(rk, JSON.stringify(res), 21600);
  return res;
}

function coachEdit_(d) {
  const sh0 = coachSheet_();
  const cur0 = findBy_(readCoaches_(sh0), 'token', d.token);
  if (!cur0) return { ok: false, error: 'token', message: 'Link edit tidak dikenali.' };
  const cache = CacheService.getScriptCache();
  const rk = 'req:' + String(d.reqId || '').slice(0, 80);
  if (d.reqId) { const hit = cache.get(rk); if (hit) return JSON.parse(hit); }
  const v = coachClean_(d, false, cur0);
  if (!v.ok) return v;
  const c = v.c;
  const im = checkImages_(d.images, false); if (!im.ok) return im;
  if (readCoaches_(sh0).some(r => r.code !== cur0.code && r.name.toLowerCase() === c.name.toLowerCase())) return { ok: false, field: 'name', error: 'name', message: 'Nama ini sudah dipakai coach lain.' };
  let files = {}; try { files = JSON.parse(cur0.files || '{}'); } catch (e) {}
  const hasNew = IMG_KEYS.some(k => d.images && d.images[k]);
  const stored = hasNew ? storeImages_(cur0.code, cur0.folder, files, d.images) : { folderId: cur0.folder, files: files };

  const lock = coachLock_(20000);
  let row, status, wasApproved;
  try {
    const sh = coachSheet_();
    row = findBy_(readCoaches_(sh), 'token', d.token);
    if (!row) return { ok: false, error: 'token', message: 'Link edit tidak dikenali.' };
    wasApproved = row.status === 'approved';
    const storyChanged = row.storyId !== c.storyId, hlChanged = row.hlId !== c.hlId;
    Object.keys(c).forEach(k => { row[k] = c[k]; });
    if (storyChanged) row.storyEn = '';
    if (hlChanged) row.hlEn = '';
    row.files = JSON.stringify(stored.files); row.folder = stored.folderId;
    if (hasNew) row.imgNew = 'TRUE';
    row.updated = new Date().toISOString();
    if (row.status === 'rejected') row.status = 'pending';
    status = row.status;
    writeCoach_(sh, row);
  } finally { lock.releaseLock(); }

  let warn = '';
  if (status === 'approved') {
    try { publish_('Update coach ' + row.code + ' (via /join)'); }
    catch (err) { warn = String(err && err.message || err); try { console.error(warn); } catch (e) {} }
  }
  try {
    MailApp.sendEmail({ to: DEFAULT_EMAIL, subject: 'Coach mengubah profil: ' + row.name,
      body: [row.name + ' (' + SITE_URL + '/' + row.code + ') baru mengubah profilnya.', 'Status: ' + status + (wasApproved ? ' (perubahan langsung tayang)' : ''),
        warn ? 'Publish ke website GAGAL: ' + warn + ' (jalankan menu Coaches > Publish ke website setelah diperbaiki)' : '', '',
        'WhatsApp: +' + row.wa, 'Email: ' + row.email, '', 'Cerita:', row.storyId].join('\n') });
  } catch (err) {}
  const res = { ok: true, status: status };
  if (warn) res.warning = 'Perubahan tersimpan, tapi belum sampai ke website. AJ sudah diberi tahu.';
  if (d.reqId) cache.put(rk, JSON.stringify(res), 21600);
  return res;
}

function coachGet_(token) {
  const row = findBy_(readCoaches_(coachSheet_()), 'token', token);
  if (!row) return { ok: false, message: 'Link edit tidak dikenali.' };
  let files = {}; try { files = JSON.parse(row.files || '{}'); } catch (e) {}
  const images = {};
  IMG_KEYS.forEach(k => {
    if (!files[k] || !files[k].id) return;
    try { images[k] = 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(files[k].id).getBlob().getBytes()); } catch (e) {}
  });
  const pr = (a, b) => (a === '' || b === '') ? null : { from: Number(a), to: Number(b) };
  return { ok: true, coach: { code: row.code, status: row.status, name: row.name, fullName: row.fullName, wa: row.wa, email: row.email, booking: row.booking,
    palette: row.palette, kg: pr(row.kgFrom, row.kgTo), fat: pr(row.fatFrom, row.fatTo), vfa: pr(row.vfaFrom, row.vfaTo),
    story: row.storyId, highlight: row.hlId, images: images } };
}

/* ---------- AJ's review and decision pages ---------- */
function reviewShell_(title, body) {
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + htmlEsc_(title) + '</title><style>' +
    'body{margin:0;font:16px/1.5 system-ui,-apple-system,sans-serif;color:#1B2A4E;background:#F4F7FC}.w{max-width:640px;margin:0 auto;padding:20px 16px 60px}' +
    'h1{font-size:1.5rem;margin:.2em 0 .4em}.c{background:#fff;border:1px solid #E3E9F5;border-radius:16px;padding:16px;margin:14px 0}' +
    '.imgs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.imgs img{width:100%;border-radius:10px;display:block}.face{width:72px!important;height:72px;border-radius:50%;object-fit:cover}' +
    '.b{display:block;text-align:center;padding:16px;border-radius:999px;font-weight:700;text-decoration:none;margin:10px 0}.ok{background:#172554;color:#fff}.no{background:#fff;border:1px solid #E3E9F5;color:#B91C1C}' +
    'small{color:#4B5872}</style></head><body><div class="w">' + body + '</div></body></html>').addMetaTag('viewport', 'width=device-width, initial-scale=1').setTitle(title);
}
function coachByKey_(code, key) {
  const rows = readCoaches_(coachSheet_());
  const r = rows.filter(x => x.code === code)[0];
  return r && r.approveKey && sameStr_(r.approveKey, key) ? r : null;
}
function coachReviewPage_(code, key) {
  const r = coachByKey_(code, key);
  if (!r) return reviewShell_('Tidak ditemukan', '<h1>Link tidak berlaku</h1><p>Link ini salah atau coach-nya sudah dihapus dari sheet.</p>');
  let files = {}; try { files = JSON.parse(r.files || '{}'); } catch (e) {}
  const img = (k, cls) => { try { return '<img ' + (cls ? 'class="' + cls + '" ' : '') + 'alt="' + k + '" src="data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(files[k].id).getBlob().getBytes()) + '">'; } catch (e) { return '<p><small>(foto ' + k + ' tidak terbaca)</small></p>'; } };
  const base = webAppUrl_() + '?c=' + encodeURIComponent(r.code) + '&k=' + encodeURIComponent(r.approveKey) + '&go=1&a=';
  const metric = (l, a, b, u) => a === '' ? '' : '<div>' + l + ': <b>' + htmlEsc_(a) + ' → ' + htmlEsc_(b) + u + '</b></div>';
  const body = '<small>Status sekarang: ' + htmlEsc_(r.status) + '</small><h1>' + htmlEsc_(r.fullName) + '</h1>' +
    '<div class="c"><b>' + htmlEsc_(r.name) + '</b> · ' + SITE_URL + '/' + htmlEsc_(r.code) + '<br>WhatsApp +' + htmlEsc_(r.wa) + '<br>' + htmlEsc_(r.email) + '<br>Palet: ' + htmlEsc_(r.palette) + (r.booking ? '<br>Booking: ' + htmlEsc_(r.booking) : '') + '</div>' +
    '<div class="c">' + metric('Berat', r.kgFrom, r.kgTo, ' kg') + metric('Lemak tubuh', r.fatFrom, r.fatTo, '%') + metric('VFA', r.vfaFrom, r.vfaTo, ' level') + '</div>' +
    '<div class="c"><div class="imgs">' + img('before') + img('after') + '</div></div>' +
    '<div class="c">' + img('photo') + '<p>' + img('face', 'face') + '</p></div>' +
    '<div class="c"><b>Cerita</b><p>' + htmlEsc_(r.storyId) + '</p>' + (r.hlId ? '<p><small>Frasa: ' + htmlEsc_(r.hlId) + '</small></p>' : '') + '</div>' +
    '<a class="b ok" target="_top" href="' + base + 'approve">Setujui dan tayangkan</a><a class="b no" target="_top" href="' + base + 'reject">Tolak</a>' +
    '<p><small>Menyetujui langsung mengirim kartu ini ke website. Terjemahan Inggris dibuat otomatis, dan bisa kamu ubah di sheet Coaches lalu pilih menu Coaches > Publish ke website.</small></p>';
  return reviewShell_('Cek coach: ' + r.name, body);
}
function coachDecidePage_(action, code, key, go) {
  const r = coachByKey_(code, key);
  if (!r) return reviewShell_('Tidak ditemukan', '<h1>Link tidak berlaku</h1>');
  if (!go) return coachReviewPage_(code, key);   /* mail scanners that open the link never decide anything */
  const lock = coachLock_(20000);
  let sh, row;
  try {
    sh = coachSheet_();
    row = findBy_(readCoaches_(sh), 'approveKey', key);
    if (action === 'reject') { row.status = 'rejected'; row.updated = new Date().toISOString(); writeCoach_(sh, row); return reviewShell_('Ditolak', '<h1>Ditolak</h1><p>' + htmlEsc_(row.name) + ' tidak ditayangkan. Kamu bisa menghubungi coach-nya langsung.</p>'); }
    if (row.status === 'approved') return reviewShell_('Sudah tayang', '<h1>Sudah disetujui</h1><p><a href="' + SITE_URL + '/' + htmlEsc_(row.code) + '">' + SITE_URL + '/' + htmlEsc_(row.code) + '</a></p>');
    row.status = 'approved'; row.updated = new Date().toISOString(); writeCoach_(sh, row);
  } finally { lock.releaseLock(); }
  try {
    publish_('Tambah coach ' + row.code + ' (via /join)');
  } catch (err) {
    const l2 = coachLock_(20000);
    try { const r2 = findBy_(readCoaches_(sh), 'approveKey', key); r2.status = 'pending'; r2.note = 'Publish gagal: ' + String(err && err.message || err).slice(0, 200); writeCoach_(sh, r2); } finally { l2.releaseLock(); }
    return reviewShell_('Gagal', '<h1>Belum berhasil tayang</h1><p>Gagal mengirim ke website: <b>' + htmlEsc_(String(err && err.message || err)) + '</b></p><p>Cek GITHUB_TOKEN di Script properties, lalu buka link review lagi.</p>');
  }
  try {
    MailApp.sendEmail({ to: row.email, cc: DEFAULT_EMAIL, subject: 'Kartu hasil kamu sudah disetujui, ' + row.name,
      body: ['Halo ' + row.name + ',', '', 'Kartu hasilmu sudah disetujui dan tayang di alvacy.com dalam beberapa menit.', '',
        'Link pribadimu (untuk dibagikan): ' + SITE_URL + '/' + row.code, 'Kartu hasilmu: ' + SITE_URL + '/transform/#' + row.code, '',
        'Calon klien yang masuk lewat link-mu dikirim ke email ini dan ke WhatsApp-mu.', '',
        'Mau mengubah nomor, email, foto, atau cerita? Pakai link edit kamu: ' + SITE_URL + '/join/?edit=' + row.token].join('\n') });
  } catch (err) {}
  return reviewShell_('Tayang', '<h1>Disetujui dan dikirim ke website</h1><p>Tunggu sekitar 3 sampai 5 menit sampai situs selesai diperbarui.</p><p><a href="' + SITE_URL + '/' + htmlEsc_(row.code) + '">' + SITE_URL + '/' + htmlEsc_(row.code) + '</a></p><p><small>Email konfirmasi sudah dikirim ke ' + htmlEsc_(row.name) + '.</small></p>');
}

/* ---------- publishing to the website (GitHub) ---------- */
function toPublic_(r) {
  let f = {}; try { f = JSON.parse(r.files || '{}'); } catch (e) {}
  if (!IMG_KEYS.every(k => f[k] && f[k].name)) return null;
  const m = [{ k: 'kg', from: Number(r.kgFrom), to: Number(r.kgTo) }];
  if (r.fatFrom !== '' && r.fatTo !== '') m.push({ k: 'fat', from: Number(r.fatFrom), to: Number(r.fatTo) });
  if (r.vfaFrom !== '' && r.vfaTo !== '') m.push({ k: 'vfa', from: Number(r.vfaFrom), to: Number(r.vfaTo) });
  return { code: r.code, name: r.name, fullName: r.fullName, wa: r.wa, palette: r.palette, booking: r.booking,
    photo: f.photo.name, face: f.face.name, before: f.before.name, after: f.after.name, metrics: m,
    highlight: { id: r.hlId, en: r.hlEn || r.hlId }, story: { id: r.storyId, en: r.storyEn || r.storyId } };
}
function ensureEn_(sh, r) {
  let changed = false;
  const tr = t => { try { return LanguageApp.translate(t, 'id', 'en'); } catch (e) { return t; } };
  if (!r.storyEn && r.storyId) { r.storyEn = tr(r.storyId); changed = true; }
  if (!r.hlEn && r.hlId) { r.hlEn = tr(r.hlId); changed = true; }
  if (changed) writeCoach_(sh, r);
}
function gh_(method, path, body) {
  const token = prop_('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN belum diisi di Script properties');
  const repo = prop_('GITHUB_REPO') || 'ajthereal/alvacy';
  const opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'transformwithst-apps-script' } };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + path, opt);
  const code = res.getResponseCode(), txt = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('GitHub ' + code + ' ' + method + ' ' + path + ': ' + txt.slice(0, 160));
  return JSON.parse(txt);
}
function commitFiles_(files, message) {
  const branch = prop_('GITHUB_BRANCH') || 'main';
  const entries = files.map(f => ({ path: f.path, mode: '100644', type: 'blob', sha: gh_('POST', '/git/blobs', { content: f.b64, encoding: 'base64' }).sha }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = gh_('GET', '/git/ref/heads/' + branch).object.sha;
    const base = gh_('GET', '/git/commits/' + head).tree.sha;
    const tree = gh_('POST', '/git/trees', { base_tree: base, tree: entries });
    const commit = gh_('POST', '/git/commits', { message: message, tree: tree.sha, parents: [head] });
    try { gh_('PATCH', '/git/refs/heads/' + branch, { sha: commit.sha, force: false }); return commit.sha; }
    catch (err) { if (attempt === 2 || !/ 4(09|22) /.test(String(err.message))) throw err; Utilities.sleep(1500); }   /* the branch moved (a rebuild commit): try again on the new head */
  }
}
/* Rebuilds data/coaches.js from every approved row and uploads the photos that are new. One commit. */
function publish_(message, forceImages) {
  const lock = coachLock_(30000);
  try {
    const sh = coachSheet_();
    const rows = readCoaches_(sh).filter(r => r.status === 'approved');
    rows.forEach(r => ensureEn_(sh, r));
    const list = [], skipped = [];
    rows.forEach(r => { const p = toPublic_(r); if (p) list.push(p); else skipped.push(r.code); });
    const b64 = s => Utilities.base64Encode(Utilities.newBlob(s, 'text/plain').getBytes());
    const files = [{ path: 'data/coaches.js', b64: b64('window.ALV_EXTRA=' + JSON.stringify({ v: 1, updated: new Date().toISOString(), coaches: list }) + ';\n') }];
    /* Google Sheets can turn the text TRUE into a real boolean, so compare loosely. A coach that never went live always gets its photos. */
    const withImg = rows.filter(r => !!forceImages || String(r.imgNew).toUpperCase() === 'TRUE' || !r.published);
    withImg.forEach(r => {
      let f = {}; try { f = JSON.parse(r.files || '{}'); } catch (e) {}
      IMG_KEYS.forEach(k => { if (f[k] && f[k].id) files.push({ path: siteDir_(k) + f[k].name, b64: Utilities.base64Encode(DriveApp.getFileById(f[k].id).getBlob().getBytes()) }); });
    });
    const sha = commitFiles_(files, message || 'Update coaches (via /join)');
    const now = new Date().toISOString();
    rows.forEach(r => { r.published = now; if (withImg.indexOf(r) >= 0) r.imgNew = ''; if (skipped.indexOf(r.code) >= 0) r.note = 'Tidak dipublish: file gambar belum lengkap'; writeCoach_(sh, r); });
    return { commit: sha, count: list.length, skipped: skipped };
  } finally { lock.releaseLock(); }
}

/* ---------- menu in the Sheet ---------- */
function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Coaches').addItem('Publish ke website', 'publishFromMenu').addItem('Cek pengaturan', 'setupCoaches').addToUi();
    SpreadsheetApp.getUi().createMenu('Leads portal').addItem('Set up and email me the links', 'setupLeadsPortal').addToUi(); } catch (e) {}
}
function publishFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = publish_('Update coaches (dari menu Sheet)');
    ui.alert('Terkirim ke website', r.count + ' coach tayang. Situs selesai diperbarui dalam 3 sampai 5 menit.' + (r.skipped.length ? '\nDilewati (gambar belum lengkap): ' + r.skipped.join(', ') : ''), ui.ButtonSet.OK);
  } catch (err) { ui.alert('Gagal', String(err && err.message || err), ui.ButtonSet.OK); }
}
/* Run once from the editor: creates the Coaches sheet and Drive folder, asks for permissions, and reports what is missing. */
function setupCoaches() {
  const out = [];
  coachSheet_(); out.push('Sheet "Coaches": siap');
  coachRoot_(); out.push('Folder Drive "transformwithST coaches": siap');
  try { LanguageApp.translate('halo', 'id', 'en'); out.push('Terjemahan otomatis: siap'); } catch (e) { out.push('Terjemahan otomatis: GAGAL (' + e.message + ')'); }
  out.push(prop_('JOIN_CODE') ? 'JOIN_CODE: ada' : 'JOIN_CODE: BELUM DIISI (Project Settings > Script properties)');
  if (!prop_('GITHUB_TOKEN')) out.push('GITHUB_TOKEN: BELUM DIISI (Project Settings > Script properties)');
  else { try { const r = gh_('GET', ''); out.push('GitHub: tersambung ke ' + r.full_name + (r.permissions && r.permissions.push ? ' (boleh menulis)' : ' (TIDAK boleh menulis: cek izin Contents di token)')); } catch (e) { out.push('GitHub: GAGAL (' + e.message + ')'); } }
  out.push('Web app: ' + webAppUrl_());
  try { SpreadsheetApp.getUi().alert('Cek pengaturan Coaches', out.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return out.join('\n');
}

/* =====================================================================================================================
   APPROVE FROM THE SHEET (no review page needed, works from the Sheets app on a phone)
   Run aktifkanAutoTayang() once from the editor. After that, open the "Coaches" tab and change a coach's Status cell:
     approved = goes live on the website (and the coach gets the "approved" email)
     hidden or rejected = taken off the website if it was live
   publishNow() pushes every approved coach to the website without any screen; run it from the editor if ever needed.
   ===================================================================================================================== */
function publishNow() {
  const r = publish_('Update coaches (manual)');
  return r.count + ' coach tayang' + (r.skipped.length ? ', dilewati (gambar belum lengkap): ' + r.skipped.join(', ') : '');
}

/* Sends the photos of every approved coach to the website again (use if a photo is missing on the site). */
function publishAllImages() {
  const r = publish_('Kirim ulang semua gambar coach', true);
  return r.count + ' coach tayang, gambar dikirim ulang';
}

function approvalMail_(row) {
  try {
    MailApp.sendEmail({ to: row.email, cc: DEFAULT_EMAIL, subject: 'Kartu hasil kamu sudah disetujui, ' + row.name,
      body: ['Halo ' + row.name + ',', '', 'Kartu hasilmu sudah disetujui dan tayang di alvacy.com dalam beberapa menit.', '',
        'Link pribadimu (untuk dibagikan): ' + SITE_URL + '/' + row.code, 'Kartu hasilmu: ' + SITE_URL + '/transform/#' + row.code, '',
        'Calon klien yang masuk lewat link-mu dikirim ke email ini dan ke WhatsApp-mu.', '',
        'Mau mengubah nomor, email, foto, atau cerita? Pakai link edit kamu: ' + SITE_URL + '/join/?edit=' + row.token].join('\n') });
  } catch (err) {}
}

/* Installed by aktifkanAutoTayang(). Fires when someone edits a cell in the Sheet. */
function onCoachSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    const rg = e.range, sh = rg.getSheet();
    if (sh.getName() !== COACH_SHEET || rg.getColumn() !== 2 || rg.getRow() < 2 || rg.getNumRows() !== 1) return;
    const val = String(rg.getValue()).trim().toLowerCase();
    if (['pending', 'approved', 'rejected', 'hidden'].indexOf(val) < 0) return;
    const lock = coachLock_(20000);
    let row, first = false, wasLive = false, prev = '';
    try {
      row = readCoaches_(sh).filter(r => r._row === rg.getRow())[0];
      if (!row) return;
      wasLive = !!row.published;
      prev = String(e.oldValue || '').trim().toLowerCase();
      if (['pending', 'approved', 'rejected', 'hidden'].indexOf(prev) < 0 || prev === val) prev = wasLive ? 'approved' : 'pending';
      first = val === 'approved' && !row.published;
      row.status = val; row.updated = new Date().toISOString();
      writeCoach_(sh, row);
    } finally { lock.releaseLock(); }
    if (val !== 'approved' && !wasLive) return;   /* nothing on the website to change */
    let warn = '';
    try { publish_((val === 'approved' ? 'Tayangkan coach ' : 'Ubah status coach ') + row.code + ' (dari Sheet)'); }
    catch (err) { warn = String(err && err.message || err); }
    if (warn) {
      const l2 = coachLock_(20000);
      try {
        const r2 = readCoaches_(sh).filter(r => r._row === rg.getRow())[0];
        if (r2) { r2.status = prev || 'pending'; r2.note = 'Publish gagal: ' + warn.slice(0, 200); writeCoach_(sh, r2); }
      } finally { l2.releaseLock(); }
      try { MailApp.sendEmail({ to: DEFAULT_EMAIL, subject: 'Coach ' + row.name + ' belum bisa tayang', body: 'Gagal mengirim ke website: ' + warn + '\n\nStatus dikembalikan ke ' + (prev || 'pending') + '. Cek GITHUB_TOKEN di Script properties, lalu ubah Status lagi.' }); } catch (e2) {}
      return;
    }
    if (first) approvalMail_(row);
    else { try { MailApp.sendEmail({ to: DEFAULT_EMAIL, subject: 'Website diperbarui: ' + row.name + ' (' + val + ')', body: row.name + ' sekarang berstatus ' + val + '. Situs selesai diperbarui dalam 3 sampai 5 menit.\n' + SITE_URL + '/' + row.code }); } catch (e3) {} }
  } catch (err) { try { console.error(String(err && err.stack || err)); } catch (e4) {} }
}

/* Run once from the editor. Installs the Sheet trigger and gives the Status column a dropdown. */
function aktifkanAutoTayang() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = coachSheet_();
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'onCoachSheetEdit') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onCoachSheetEdit').forSpreadsheet(ss).onEdit().create();
  try {
    sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['pending', 'approved', 'rejected', 'hidden'], true).setAllowInvalid(false).build());
  } catch (e) {}
  return 'Aktif. Di tab Coaches, ubah kolom Status ke "approved" untuk menayangkan coach.';
}

/* =====================================================================================================================
   LEADS PORTAL: alvacy.com/leads
   Each coach opens alvacy.com/leads/#k=<their key> and sees ONLY their own leads (the server filters by the coach's
   display name in column D; nothing about other coaches is ever sent). They can tap WhatsApp (marks the lead Contacted
   with the time), move the stage, set the next follow-up date, tick a checklist and add notes.
   Their work is saved in the Leads sheet, columns AG-AL, and every change is appended to the "Lead History" sheet
   (never overwritten). AJ opens alvacy.com/leads/#admin=<LEADS_ADMIN_KEY> for the speed board of every coach.
   Coach AJ is left out on purpose: his leads go to HQ's CRM.

   One-time setup: run setupLeadsPortal() from the editor (or the Sheet menu "Leads portal"), then
   Deploy -> Manage deployments -> edit -> Version: New version -> Deploy. It makes a key for every approved coach
   (column "Kunci leads" in Coaches), emails AJ every coach's link and his admin link, and adds the 08:00 reminder.
   To switch a coach off: set their Status to hidden, or make a new link for them in the admin view.
   ===================================================================================================================== */
const PORTAL_URL = SITE_URL + '/leads/';
const PORTAL_V = 1;
const P_COL = BODY_COL + BODY_HEADERS.length;   /* column AG */
const P_HEADERS = ['Stage', 'First contact', 'Next follow-up', 'Checklist', 'Coach notes', 'Coach updated'];
const P_STAGES = ['New', 'Contacted', 'Consult booked', 'Consult done', 'Customer', 'Not now'];
const P_OPEN = ['New', 'Contacted', 'Consult booked', 'Consult done'];
const P_CHECKS = ['Replied', 'Explained result', 'Shared a story', 'Sent program info', 'Body check done'];
const P_HISTORY = 'Lead History';
const P_HISTORY_HEADS = ['Time', 'Coach', 'Session ID', 'Lead', 'Action', 'Detail'];
const P_SKIP = ['coach aj'];                    /* coaches whose leads stay in HQ only */
const P_LAST = P_COL + P_HEADERS.length - 1;    /* last column read from Leads */

function pNorm_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
function pMs_(v) { if (v instanceof Date) return v.getTime(); const t = Date.parse(v); return isNaN(t) ? 0 : t; }
function pDay_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
  const m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : '';
}
function pToday_() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'); }
function pWaKey_(wa) {
  let d = String(wa || '').replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
  return d;
}
function pFail_(code, msg) { return { ok: false, code: code, msg: msg }; }

/* A sheet only has the columns it was made with; add any that are missing before writing past them. */
function pEnsureCols_(sh, n) { const have = sh.getMaxColumns(); if (have < n) sh.insertColumnsAfter(have, n - have); }
function pLeadsSheet_() {
  const sh = sheet_();
  pEnsureCols_(sh, P_LAST);
  const cur = sh.getRange(1, P_COL, 1, P_HEADERS.length).getValues()[0];
  if (cur.join('|') !== P_HEADERS.join('|')) {
    sh.getRange(1, P_COL, 1, P_HEADERS.length).setValues([P_HEADERS]);
    sh.getRange(2, P_COL + 2, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');   /* Next follow-up stays plain yyyy-mm-dd text */
  }
  return sh;
}
function pHistory_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(P_HISTORY);
  if (!sh) {
    sh = ss.insertSheet(P_HISTORY);
    sh.getRange(1, 1, 1, P_HISTORY_HEADS.length).setValues([P_HISTORY_HEADS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function pLog_(coach, sid, lead, action, detail) {
  try { pHistory_().appendRow([new Date(), coach, sid, clean_(lead), action, clean_(String(detail || '').slice(0, 300))]); } catch (e) {}
}

/* Coaches who can use the portal: approved, with a key, not in P_SKIP. */
function pCoaches_() {
  return readCoaches_(coachSheet_()).filter(c => c.status === 'approved' && c.leadsKey && P_SKIP.indexOf(pNorm_(c.name)) < 0);
}
function pAuth_(d) {
  const k = String(d.k || '');
  const admin = prop_('LEADS_ADMIN_KEY');
  if (admin && k.length >= 20 && sameStr_(k, admin)) {
    const r = { admin: true, coach: null };
    if (d.coach) { r.coach = pCoaches_().filter(c => c.code === String(d.coach))[0] || null; if (!r.coach) return { err: pFail_('NOCOACH', 'That coach was not found or has no portal link yet.') }; }
    return r;
  }
  const row = findBy_(readCoaches_(coachSheet_()), 'leadsKey', k);
  if (!row) return { err: pFail_('AUTH', 'This link is not valid any more. Please ask Coach AJ for your new link.') };
  if (row.status !== 'approved') return { err: pFail_('AUTH', 'This link has been switched off. Please ask Coach AJ if you think this is a mistake.') };
  return { admin: false, coach: row };
}

/* Reads every lead row once. r = sheet row number. */
function pReadLeads_() {
  const sh = pLeadsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { sh: sh, rows: [] };
  const vals = sh.getRange(2, 1, last - 1, P_LAST).getValues();
  return { sh: sh, rows: vals.map((v, i) => ({ r: i + 2, v: v })) };
}
function pChecks_(s) { const have = String(s || '').split(',').map(x => x.trim()); return P_CHECKS.filter(c => have.indexOf(c) >= 0); }
function pNotes_(s) {
  return String(s || '').split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(.*)$/);
    return m ? { t: m[1], x: m[2] } : { t: '', x: line.replace(/^'/, '') };
  });
}
function pStage_(v) { const s = String(v[P_COL - 1] || ''); return P_STAGES.indexOf(s) >= 0 ? s : 'New'; }
function pLeadOut_(row, dup) {
  const v = row.v, n = i => (v[i] === '' || v[i] == null) ? null : Number(v[i]);
  return {
    sid: String(v[1]), ts: pMs_(v[0]), name: String(v[5]), wa: pWaKey_(v[6]), email: String(v[7]), ig: String(v[31] || ''),
    city: String(v[8]), mode: String(v[9]), lang: String(v[4] || 'id'), total: n(10), band: String(v[11]),
    s: [n(12), n(13), n(14), n(15), n(16)], age: String(v[17]), gender: String(v[18]), goal: String(v[19]), start: String(v[20]),
    tried: String(v[21]), h: n(29), w: n(30), src: String(v[25] || ''), plateau: /plateau/i.test(String(v[28] || '')),
    stage: pStage_(v), first: pMs_(v[P_COL]), next: pDay_(v[P_COL + 1]), checks: pChecks_(v[P_COL + 2]),
    notes: pNotes_(v[P_COL + 3]), upd: pMs_(v[P_COL + 4]), dup: dup || 1
  };
}
/* One coach's full leads, one entry per person (same WhatsApp number = same person). */
function pCoachLeads_(all, coach) {
  const name = pNorm_(coach.name);
  const mine = all.filter(x => pNorm_(x.v[3]) === name && x.v[2] === 'Lead masuk' && String(x.v[5]).trim());
  const groups = {};
  mine.forEach(x => { const k = pWaKey_(x.v[6]) || ('sid:' + x.v[1]); (groups[k] = groups[k] || []).push(x); });
  return Object.keys(groups).map(k => {
    const g = groups[k].sort((a, b) => pMs_(b.v[0]) - pMs_(a.v[0]));
    const worked = g.filter(x => x.v[P_COL - 1] || x.v[P_COL + 3]);
    return { row: worked[0] || g[0], dup: g.length };
  });
}
function pPartials_(all, coach) {
  const name = pNorm_(coach.name), since = Date.now() - 30 * 86400000;
  return all.filter(x => pNorm_(x.v[3]) === name && x.v[2] !== 'Lead masuk' && pMs_(x.v[0]) > since).length;
}
function pStats_(leads) {
  const now = Date.now(), today = pToday_(), since = now - 30 * 86400000;
  const o = { total: leads.length, waiting: 0, late: 0, due: 0, active: 0, customers: 0, notNow: 0, median: null, last: 0 };
  const waits = [];
  leads.forEach(L => {
    if (L.stage === 'New') { o.waiting++; if (now - L.ts > 86400000) o.late++; }
    else if (L.stage === 'Customer') o.customers++;
    else if (L.stage === 'Not now') o.notNow++;
    else o.active++;
    if (L.next && L.next <= today && P_OPEN.indexOf(L.stage) >= 0) o.due++;
    if (L.first && L.ts > since && L.first >= L.ts) waits.push((L.first - L.ts) / 3600000);
    if (L.upd > o.last) o.last = L.upd;
  });
  if (waits.length) { waits.sort((a, b) => a - b); o.median = Math.round(waits[Math.floor(waits.length / 2)] * 10) / 10; }
  return o;
}

function portalPost_(d) {
  try {
    const a = String(d.a || '');
    const au = pAuth_(d);
    if (au.err) return au.err;
    if (a === 'a_overview' || a === 'a_rotate') {
      if (!au.admin) return pFail_('AUTH', 'Only Coach AJ can open this.');
      return a === 'a_overview' ? pOverview_() : pRotate_(d);
    }
    if (!au.coach) return pFail_('NOCOACH', 'Pick a coach first.');
    if (a === 'list') return pList_(au.coach, au.admin);
    if (a === 'save' || a === 'contacted') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(15000)) return pFail_('BUSY', 'The sheet is busy right now. Nothing was saved. Please try again in a few seconds.');
      try { return pSave_(au.coach, d, a === 'contacted', au.admin); } finally { lock.releaseLock(); }
    }
    return pFail_('BAD', 'Unknown request.');
  } catch (err) {
    return pFail_('SERVER', 'The server had a problem: ' + String(err && err.message || err).slice(0, 160) + '. Nothing was changed.');
  }
}
function pList_(coach, admin) {
  const all = pReadLeads_().rows;
  const leads = pCoachLeads_(all, coach).map(g => pLeadOut_(g.row, g.dup)).sort((a, b) => b.ts - a.ts);
  return { ok: true, v: PORTAL_V, now: Date.now(), today: pToday_(), admin: !!admin,
    coach: { code: coach.code, name: coach.name, fullName: coach.fullName },
    stages: P_STAGES, checks: P_CHECKS, leads: leads, partial: pPartials_(all, coach), stats: pStats_(leads) };
}
function pSave_(coach, d, contacted, admin) {
  const sid = String(d.sid || '');
  const all = pReadLeads_();
  const g = pCoachLeads_(all.rows, coach).filter(x => String(x.row.v[1]) === sid)[0];
  if (!g) return pFail_('NOLEAD', 'This lead was not found in your list. Pull down to refresh.');
  const row = g.row, v = row.v.slice();
  const who = coach.name + (admin ? ' (by AJ)' : ''), lead = String(v[5]);
  const before = pStage_(v);
  let stage = before, first = v[P_COL], next = pDay_(v[P_COL + 1]), checks = pChecks_(v[P_COL + 2]), notes = String(v[P_COL + 3] || '');
  const log = [];
  if (contacted) {
    if (stage === 'New') { stage = 'Contacted'; log.push(['Stage', 'New -> Contacted (WhatsApp opened)']); }
    else log.push(['WhatsApp', 'opened chat']);
  }
  if (d.stage != null && String(d.stage) !== stage) {
    if (P_STAGES.indexOf(String(d.stage)) < 0) return pFail_('BAD', 'Unknown stage.');
    log.push(['Stage', stage + ' -> ' + d.stage]); stage = String(d.stage);
  }
  if (d.next != null && String(d.next) !== next) {
    const nx = String(d.next);
    if (nx && !/^\d{4}-\d{2}-\d{2}$/.test(nx)) return pFail_('BAD', 'The follow-up date is not valid.');
    log.push(['Follow-up', nx || 'cleared']); next = nx;
  }
  if (Array.isArray(d.checks)) {
    const nc = P_CHECKS.filter(c => d.checks.indexOf(c) >= 0);
    if (nc.join(',') !== checks.join(',')) {
      const add = nc.filter(c => checks.indexOf(c) < 0), rem = checks.filter(c => nc.indexOf(c) < 0);
      log.push(['Checklist', (add.length ? '+ ' + add.join(', ') : '') + (add.length && rem.length ? ' / ' : '') + (rem.length ? '- ' + rem.join(', ') : '')]);
      checks = nc;
    }
  }
  const note = String(d.note || '').replace(/[\u0000-\u001f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (note) {
    const line = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm') + '  ' + (admin ? '[AJ] ' : '') + note;
    notes = (notes ? notes + '\n' : '') + line;
    if (notes.length > 45000) return pFail_('FULL', 'This lead has too many notes to add more.');
    log.push(['Note', note]);
  }
  if (!log.length) return { ok: true, v: PORTAL_V, now: Date.now(), lead: pLeadOut_(row, g.dup) };
  if (!first && stage !== 'New') first = new Date();
  const out = [stage, first || '', next, checks.join(', '), notes, new Date()];
  all.sh.getRange(row.r, P_COL, 1, out.length).setValues([out]);
  log.forEach(l => pLog_(who, sid, lead, l[0], l[1]));
  for (let i = 0; i < out.length; i++) v[P_COL - 1 + i] = out[i];
  return { ok: true, v: PORTAL_V, now: Date.now(), lead: pLeadOut_({ r: row.r, v: v }, g.dup) };
}
function pLink_(c) { return PORTAL_URL + '#k=' + c.leadsKey; }
function pOverview_() {
  const all = pReadLeads_().rows;
  const coaches = readCoaches_(coachSheet_()).filter(c => c.status === 'approved' && P_SKIP.indexOf(pNorm_(c.name)) < 0);
  const known = coaches.map(c => pNorm_(c.name)).concat(P_SKIP);
  const list = coaches.map(c => {
    const leads = pCoachLeads_(all, c).map(g => pLeadOut_(g.row, g.dup));
    return { code: c.code, name: c.name, wa: pWaKey_(c.wa), link: c.leadsKey ? pLink_(c) : '', stats: pStats_(leads), partial: pPartials_(all, c) };
  }).sort((a, b) => b.stats.late - a.stats.late || b.stats.total - a.stats.total);
  const orphans = {};
  all.forEach(x => { if (x.v[2] === 'Lead masuk' && known.indexOf(pNorm_(x.v[3])) < 0) { const k = String(x.v[3] || '(no coach)'); orphans[k] = (orphans[k] || 0) + 1; } });
  return { ok: true, v: PORTAL_V, now: Date.now(), coaches: list, orphans: orphans };
}
function pRotate_(d) {
  const lock = coachLock_(15000);
  try {
    const sh = coachSheet_();
    const row = readCoaches_(sh).filter(c => c.code === String(d.coach || ''))[0];
    if (!row) return pFail_('NOCOACH', 'That coach was not found.');
    if (row.status !== 'approved') return pFail_('NOCOACH', 'This coach is not approved, so they cannot have a portal link.');
    const had = !!row.leadsKey;
    row.leadsKey = randHex_(24); row.updated = new Date().toISOString();
    writeCoach_(sh, row);
    pLog_('AJ', '', '', 'New portal link', row.name + (had ? ': the old link stopped working' : ': first link'));
    return { ok: true, v: PORTAL_V, now: Date.now(), code: row.code, link: pLink_(row) };
  } finally { lock.releaseLock(); }
}

/* Line added to every new-lead email, so the coach opens the lead straight in the portal. */
function portalLine_(d) {
  try {
    const c = pCoaches_().filter(x => pNorm_(x.name) === pNorm_(d.coach))[0];
    return c ? ['', 'Open this lead in your portal (tap WhatsApp there, so it counts as contacted):', pLink_(c) + '&l=' + encodeURIComponent(d.sid || '')] : [];
  } catch (e) { return []; }
}
/* Block added to AJ's 21:00 daily summary. */
function portalSpeedText_() {
  try {
    const o = pOverview_();
    if (!o.coaches.length) return '';
    const lines = o.coaches.map(c => '- ' + c.name + ': ' + c.stats.waiting + ' not contacted (' + c.stats.late + ' over 24 h), ' + c.stats.due + ' follow-ups due, ' + c.stats.customers + ' customers' + (c.stats.median != null ? ', median first reply ' + c.stats.median + ' h' : ''));
    return '\n\nLeads portal:\n' + lines.join('\n') + '\nSpeed board: ' + PORTAL_URL + '#admin=' + prop_('LEADS_ADMIN_KEY');
  } catch (e) { return '\n\nLeads portal: could not read the numbers (' + String(e && e.message || e).slice(0, 120) + ')'; }
}
/* 08:00 every day: each coach with leads waiting or follow-ups due gets one short email. */
function portalNudge_() {
  const all = pReadLeads_().rows;
  pCoaches_().forEach(c => {
    if (!c.email) return;
    const st = pStats_(pCoachLeads_(all, c).map(g => pLeadOut_(g.row, g.dup)));
    if (!st.waiting && !st.due) return;
    const parts = [];
    if (st.waiting) parts.push(st.waiting + ' lead' + (st.waiting > 1 ? 's' : '') + ' not contacted yet' + (st.late ? ' (' + st.late + ' waiting over 24 hours)' : ''));
    if (st.due) parts.push(st.due + ' follow-up' + (st.due > 1 ? 's' : '') + ' due today');
    try {
      sendMail_(c.email, 'Good morning ' + c.name + ': ' + parts.join(', '),
        'Hi ' + c.name + ',\n\nYou have ' + parts.join(' and ') + '.\nThe faster the first chat, the more people say yes, so start with the newest ones.\n\nOpen your leads: ' + pLink_(c) + '\n\n#transformwithST');
    } catch (err) { logMailError_('portal reminder ' + c.name, err); }
  });
}

/* Run once from the editor (or Sheet menu "Leads portal"). Safe to run again: it only fills in what is missing. */
function setupLeadsPortal() {
  pLeadsSheet_(); pHistory_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('LEADS_ADMIN_KEY')) props.setProperty('LEADS_ADMIN_KEY', randHex_(32));
  const lock = coachLock_(15000);
  const made = [];
  try {
    const sh = coachSheet_();
    readCoaches_(sh).forEach(c => {
      if (c.status !== 'approved' || c.leadsKey || P_SKIP.indexOf(pNorm_(c.name)) >= 0) return;
      c.leadsKey = randHex_(24); writeCoach_(sh, c); made.push(c.name);
    });
  } finally { lock.releaseLock(); }
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'portalNudge_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('portalNudge_').timeBased().atHour(8).everyDays(1).create();
  const admin = PORTAL_URL + '#admin=' + props.getProperty('LEADS_ADMIN_KEY');
  const links = pCoaches_().map(c => '- ' + c.name + (c.email ? '' : ' (no email, send by WhatsApp)') + ': ' + pLink_(c));
  const body = 'Your speed board (keep this private):\n' + admin + '\n\nEach coach\'s private link (send each coach only their own):\n' + links.join('\n') +
    '\n\nYou can also send them from the speed board with one tap each.\nCoaches get a reminder email at 08:00 when leads are waiting.' +
    '\n\nLast step if not done yet: Deploy -> Manage deployments -> edit -> Version: New version -> Deploy.';
  let mailed = 'emailed to ' + DEFAULT_EMAIL;
  try { sendMail_(DEFAULT_EMAIL, 'Leads portal links', body); } catch (err) { mailed = 'NOT emailed (' + String(err && err.message || err) + '), copy them from this log'; }
  const msg = 'Leads portal ready. New links for: ' + (made.join(', ') || 'nobody new') + '. Links ' + mailed + '.\n\n' + body;
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast('Leads portal ready. Links ' + mailed + '.', 'Leads portal', 20); } catch (e) {}
  return msg;
}
