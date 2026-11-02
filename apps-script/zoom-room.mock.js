/* In-memory stand-in for Google Sheets, Properties, Lock and Utilities, so ZoomRoom.gs can run under Node.
   Used by zoom-room.test.js. Not deployed anywhere. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

function makeEnv() {
  const props = {};
  const sheets = {};
  function mkSheet(name) {
    const data = [];
    const sh = {
      name,
      getLastRow() { let n = data.length; while (n > 0 && (data[n - 1] || []).every(v => v === '' || v == null)) n--; return n; },
      getRange(r, c, nr = 1, nc = 1) {
        return {
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
          setValues(vals) { for (let i = 0; i < nr; i++) { data[r - 1 + i] = data[r - 1 + i] || []; for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = vals[i][j]; } },
          getValue() { const v = (data[r - 1] || [])[c - 1]; return v === undefined ? '' : v; }
        };
      },
      setFrozenRows() {}, _data: data
    };
    return sh;
  }
  const ss = {
    getId: () => 'sheet1', getUrl: () => 'https://sheet/1',
    getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)),
    getSheets: () => Object.values(sheets), deleteSheet: s => { delete sheets[s.name]; }
  };
  sheets['Sheet1'] = mkSheet('Sheet1');
  const sandbox = {
    console, Date, Math, JSON, Number, String, Object, Array, isFinite, parseInt,
    Logger: { log() {} },
    SpreadsheetApp: { create: () => ss, openById: () => ss, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz, fmt) => { const t = new Date(d.getTime() + 7 * 3600000); const p = n => String(n).padStart(2, '0'); return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`; }
    }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'ZoomRoom.gs'), 'utf8'), ctx);
  const call = (d) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(d) } }).text);
  return { ctx, call, sheets, props, setNow: t => { ctx.ZR_NOW = t; } };
}

module.exports = { makeEnv };
