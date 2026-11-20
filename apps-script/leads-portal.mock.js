/* In-memory stand-in for the Leads Google Sheet and Apps Script services, so Code.gs can run under Node.
   Used by leads-portal.test.js. Not deployed anywhere. */
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');

function makeEnv() {
  const props = {}, sheets = [], mails = [], triggers = [];
  function mkSheet(name, cols) {
    const data = []; let maxCols = cols || 26;
    const sh = {
      getName: () => name, _data: data,
      getMaxRows: () => Math.max(data.length, 1000), getMaxColumns: () => maxCols,
      insertColumnsAfter(after, n) { maxCols += n; },
      getLastRow() { let n = data.length; while (n > 0 && (data[n - 1] || []).every(v => v === '' || v == null)) n--; return n; },
      appendRow(row) { data[sh.getLastRow()] = row.slice(); },
      setFrozenRows() {}, setColumnWidth() {},
      getRange(r, c, nr = 1, nc = 1) {
        const rg = {
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
          setValues(vals) { if (c - 1 + nc > maxCols) throw new Error('outside the dimensions of the sheet'); for (let i = 0; i < nr; i++) { data[r - 1 + i] = data[r - 1 + i] || []; for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = vals[i][j]; } return rg; },
          getValue() { const v = (data[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
          setNumberFormat() { return rg; }, setFontWeight() { return rg; }
        };
        return rg;
      }
    };
    sheets.push(sh); return sh;
  }
  const ss = { getSheets: () => sheets, getSheetByName: n => sheets.find(s => s.getName() === n) || null, insertSheet: n => mkSheet(n), getUrl: () => 'https://sheet', toast() {} };
  const lock = { waitLock() {}, tryLock: () => true, releaseLock() {} };
  const sandbox = {
    console, Date, Math, JSON, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent,
    Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi() { throw new Error('no ui'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => lock, getDocumentLock: () => lock },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: o => mails.push(o) },
    ScriptApp: { getProjectTriggers: () => triggers, deleteTrigger() {}, newTrigger: f => ({ timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create: () => triggers.push({ getHandlerFunction: () => f }) }) }), everyMinutes: () => ({ create() {} }) }) }), getService: () => ({ getUrl: () => '' }) },
    Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, fmt) => { const t = new Date(d.getTime() + 7 * 3600000); const p = n => String(n).padStart(2, '0'); const day = `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`; return fmt === 'yyyy-MM-dd' ? day : fmt === 'HH:mm' ? `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}` : `${day} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`; }
    }
  };
  const ctx = vm.createContext(sandbox);
  const leads = mkSheet('Leads', 32);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), ctx);
  Object.assign(ctx, vm.runInContext('({ COACH_FIELDS, HEADERS, P_HEADERS })', ctx));
  return { ctx, ss, props, mails, leads, call: d => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ kind: 'leads' }, d)) } }).text) };
}


/* A small realistic sheet: 4 coaches + Coach AJ, a few leads. Returns { E, key(code), ADMIN }. */
function seeded() {
  const E = makeEnv();
  const cs = E.ss.insertSheet('Coaches'); cs.insertColumnsAfter(26, 2);
  const COLS = E.ctx.COACH_FIELDS.length - 1;
  const coachRow = (code, status, name, full, email) => { const r = new Array(COLS).fill(''); r[0] = code; r[1] = status; r[4] = name; r[5] = full; r[6] = '0812345'; r[7] = email; return r; };
  cs.getRange(1, 1, 1, COLS).setValues([E.ctx.COACH_FIELDS.slice(0, COLS).map(f => f[1])]);
  [coachRow('msfionahd', 'approved', 'Ms. FIONA HD', 'Fiona Hidayani Dwiningrum', 'f@x'), coachRow('lala', 'approved', 'dr. Lala', 'dr. Emanuella Tamara', 'l@x'), coachRow('gone', 'hidden', 'Gone Coach', 'Gone', 'g@x'), coachRow('aj', 'approved', 'Coach AJ', 'AJ', 'aj@x'), coachRow('tien', 'approved', 'Tien', 'Tien Vanny Setyawan', '')]
    .forEach((r, i) => cs.getRange(i + 2, 1, 1, COLS).setValues([r]));
  const H = 3600000, NOW = Date.now();
  const lead = (hrsAgo, sid, status, coach, name, wa) => { const r = new Array(32).fill(''); r[0] = new Date(NOW - hrsAgo * H); r[1] = sid; r[2] = status; r[3] = coach; r[4] = 'id'; r[5] = name; r[6] = wa; r[7] = name.toLowerCase().replace(/\W/g, '') + '@gmail.com'; r[8] = 'Bandung'; r[9] = 'Online dulu (video call)'; r[10] = 45; r[11] = 'Sinyalnya jelas'; r[12] = 60; r[13] = 40; r[14] = 30; r[15] = 50; r[16] = 70; r[17] = '30–34'; r[18] = 'Wanita'; r[19] = 'Turun lemak, terutama perut'; r[20] = 'Secepatnya'; r[21] = 'Diet ketat atau hitung kalori, Puasa intermiten'; r[25] = 'threads / social'; r[29] = 158; r[30] = 72; return r; };
  E.leads.getRange(1, 1, 1, 24).setValues([E.ctx.HEADERS]);
  [lead(50, 's1', 'Lead masuk', 'Ms. FIONA HD', 'Ani', '6281111'), lead(2, 's2', 'Lead masuk', 'Ms. FIONA HD', 'Budi', '082222'),
   lead(1, 's3', 'Lead masuk', 'Ms. FIONA HD', 'Budi again', '6282222'), lead(3, 's4', 'Selesai kuis', 'Ms. FIONA HD', '', ''),
   lead(5, 's5', 'Lead masuk', 'dr. Lala', 'Citra', '6283333'), lead(5, 's6', 'Lead masuk', 'Coach AJ', 'Dodi', '6284444'),
   lead(5, 's7', 'Lead masuk', 'Gone Coach', 'Eka', '6285555'), lead(5, 's8', 'Lead masuk', 'Someone Else', 'Fani', '6286666')]
    .forEach((r, i) => E.leads.getRange(i + 2, 1, 1, 32).setValues([r]));
  E.ctx.setupLeadsPortal();
  const key = code => E.ctx.readCoaches_(E.ctx.coachSheet_()).find(r => r.code === code).leadsKey;
  return { E, key, ADMIN: E.props.LEADS_ADMIN_KEY };
}
module.exports = { makeEnv, seeded };
