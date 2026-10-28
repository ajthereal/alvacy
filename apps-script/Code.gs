/**
 * #transformwithST | Cek Sinyal Badan - lead logger + coach email alert.
 * Lives in the leads Google Sheet: Extensions -> Apps Script.
 * After editing: Deploy -> Manage deployments -> (edit) -> Version: New version -> Deploy.
 * One row per quiz session (Session ID); later events update the same row.
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

/* Height and weight from the quiz live in columns AD-AE, right after the source columns. */
const BODY_COL = SRC_COL + SRC_HEADERS.length;
const BODY_HEADERS = ['Tinggi (cm)','Berat (kg)'];
const BODY_KEYS = ['height','weight'];

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
    if (d.status === 'Lead masuk') notify_(d);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function notify_(d) {
  const to = coachEmails_()[d.coach] || DEFAULT_EMAIL;
  const wa = String(d.wa || '').replace(/\D/g, '');
  const body = [
    'Lead baru dari Body Age Assessment (coach: ' + (d.coach || '-') + ')',
    '',
    'Nama: ' + d.name,
    'WhatsApp: +' + wa + '  ->  https://wa.me/' + wa,
    'Email: ' + d.email,
    'Kota: ' + d.city + ' | Mau: ' + d.mode,
    'Sumber: ' + (d.src || '-') + (d.campaign ? ' | Campaign: ' + d.campaign : '') + (d.content ? ' | Iklan: ' + d.content : ''),
    '',
    'Skor total: ' + d.total + '/100 (' + d.band + ')',
    'Pola makan ' + d.food + ' | Energi ' + d.energy + ' | Tidur & stres ' + d.sleep + ' | Gerak & otot ' + d.move + ' | Tren badan ' + d.trend,
    '',
    'Usia: ' + d.age + ' | Gender: ' + d.gender + ' | Tinggi: ' + (d.height || '-') + ' cm | Berat: ' + (d.weight || '-') + ' kg',
    'Goal: ' + d.goal + ' | Mulai: ' + d.start,
    'Pernah coba: ' + d.tried
  ].concat(to === DEFAULT_EMAIL ? ['', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()] : []).join('\n');
  const mail = { to: to, subject: 'Lead baru: ' + d.name + ' (' + d.total + '/100)', body: body };
  if (to !== DEFAULT_EMAIL) mail.cc = DEFAULT_EMAIL;
  try { MailApp.sendEmail(mail); } catch (err) {}
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
  ['imgNew', 'Gambar baru'], ['published', 'Tayang terakhir'], ['reqId', 'Request ID'], ['note', 'Catatan']
];
/* Codes that must never be taken: the coaches written in assets/site.js and every folder or page on the site. */
const COACH_RESERVED = ['aj', 'nova', 'lala', 'jevon', 'melita', 'lucky', 'test', 'kalori', 'lunch', 'tools', 'privacy', 'transform', 'en', 'images',
  'assets', 'scripts', 'data', 'join', 'body-age', 'index', 'api', 'admin', 'coach', 'coaches', 'www', 'alvacy', 'github', 'apps-script', 'tim'];
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
function publish_(message) {
  const lock = coachLock_(30000);
  try {
    const sh = coachSheet_();
    const rows = readCoaches_(sh).filter(r => r.status === 'approved');
    rows.forEach(r => ensureEn_(sh, r));
    const list = [], skipped = [];
    rows.forEach(r => { const p = toPublic_(r); if (p) list.push(p); else skipped.push(r.code); });
    const b64 = s => Utilities.base64Encode(Utilities.newBlob(s, 'text/plain').getBytes());
    const files = [{ path: 'data/coaches.js', b64: b64('window.ALV_EXTRA=' + JSON.stringify({ v: 1, updated: new Date().toISOString(), coaches: list }) + ';\n') }];
    rows.filter(r => r.imgNew === 'TRUE').forEach(r => {
      let f = {}; try { f = JSON.parse(r.files || '{}'); } catch (e) {}
      IMG_KEYS.forEach(k => { if (f[k] && f[k].id) files.push({ path: siteDir_(k) + f[k].name, b64: Utilities.base64Encode(DriveApp.getFileById(f[k].id).getBlob().getBytes()) }); });
    });
    const sha = commitFiles_(files, message || 'Update coaches (via /join)');
    const now = new Date().toISOString();
    rows.forEach(r => { r.published = now; if (r.imgNew === 'TRUE') r.imgNew = ''; if (skipped.indexOf(r.code) >= 0) r.note = 'Tidak dipublish: file gambar belum lengkap'; writeCoach_(sh, r); });
    return { commit: sha, count: list.length, skipped: skipped };
  } finally { lock.releaseLock(); }
}

/* ---------- menu in the Sheet ---------- */
function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Coaches').addItem('Publish ke website', 'publishFromMenu').addItem('Cek pengaturan', 'setupCoaches').addToUi(); } catch (e) {}
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
