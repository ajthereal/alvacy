/* Tests for the leads portal in Code.gs. Run: node apps-script/leads-portal.test.js
   Loads the real Code.gs into a sandbox with an in-memory Leads sheet, so "a coach sees only their own leads",
   duplicate merging, saving and the admin board are checked against the actual code. Not deployed anywhere. */
const assert = require('assert');
const { seeded } = require('./leads-portal.mock');

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { console.error('FAIL ' + name + '\n     ' + (e && e.stack)); process.exitCode = 1; } }

const { E, key: _key, ADMIN } = seeded();
const msg = E.ctx.setupLeadsPortal();
const key = code => E.ctx.readCoaches_(E.ctx.coachSheet_()).find(r => r.code === code).leadsKey;

test('setup adds columns, keys for approved coaches only (not Coach AJ, not hidden), admin key, and emails AJ the links', () => {
  assert(key('msfionahd') && key('lala') && key('tien'));
  assert(!key('aj') && !key('gone'));
  assert(ADMIN && ADMIN.length === 32);
  assert.strictEqual(E.leads.getRange(1, 33, 1, 6).getValues()[0].join('|'), E.ctx.P_HEADERS.join('|'));
  assert(E.mails.some(m => m.subject === 'Leads portal links' && m.body.includes(key('lala')) && m.body.includes(ADMIN)));
  assert(/Tien \(no email/.test(msg));
});
test('running setup again does not change existing keys', () => { const k = key('lala'); E.ctx.setupLeadsPortal(); assert.strictEqual(E.ctx.readCoaches_(E.ctx.coachSheet_()).find(r => r.code === 'lala').leadsKey, k); });
test('a wrong or empty key is refused plainly', () => { assert.strictEqual(E.call({ a: 'list', k: 'nope' }).code, 'AUTH'); assert.strictEqual(E.call({ a: 'list' }).code, 'AUTH'); });
test('Fiona sees only her own full leads, newest first, duplicates merged by WhatsApp number', () => {
  const r = E.call({ a: 'list', k: key('msfionahd') });
  assert(r.ok, r.msg);
  assert.deepStrictEqual(r.leads.map(l => l.name), ['Budi again', 'Ani']);
  assert.strictEqual(r.leads[0].dup, 2);
  assert.strictEqual(r.partial, 1);
  assert(!JSON.stringify(r).includes('Citra') && !JSON.stringify(r).includes('Dodi'));
  assert.strictEqual(r.stats.waiting, 2); assert.strictEqual(r.stats.late, 1);
});
test('Lala never receives Fiona\'s leads', () => { const r = E.call({ a: 'list', k: key('lala') }); assert.deepStrictEqual(r.leads.map(l => l.name), ['Citra']); });
test('tapping WhatsApp marks the lead Contacted with a first-contact time and logs it', () => {
  const r = E.call({ a: 'contacted', k: key('msfionahd'), sid: 's1' });
  assert(r.ok, r.msg); assert.strictEqual(r.lead.stage, 'Contacted'); assert(r.lead.first > 0);
  const h = E.ss.getSheetByName('Lead History')._data;
  assert(h.some(x => x[2] === 's1' && /New -> Contacted/.test(x[5])));
});
test('a coach cannot touch another coach\'s lead', () => { assert.strictEqual(E.call({ a: 'save', k: key('lala'), sid: 's1', stage: 'Customer' }).code, 'NOLEAD'); });
test('stage, follow-up date, checklist and notes save; notes append with time; history grows', () => {
  const k = key('msfionahd');
  let r = E.call({ a: 'save', k, sid: 's1', stage: 'Consult booked', next: '2026-11-25', checks: ['Replied', 'Bogus'], note: 'Wants video call Tuesday' });
  assert(r.ok, r.msg);
  assert.strictEqual(r.lead.stage, 'Consult booked'); assert.strictEqual(r.lead.next, '2026-11-25'); assert.deepStrictEqual(r.lead.checks, ['Replied']);
  r = E.call({ a: 'save', k, sid: 's1', note: '=HYPERLINK("x")' });
  assert.strictEqual(r.lead.notes.length, 2); assert.strictEqual(r.lead.notes[0].x, 'Wants video call Tuesday');
  assert(/^\d{4}-/.test(String(E.leads._data[1][36]).split('\n')[1]), 'note lines start with the date, so the sheet never reads them as a formula');
  assert.strictEqual(E.call({ a: 'save', k, sid: 's1', stage: 'Married' }).code, 'BAD');
  assert.strictEqual(E.call({ a: 'save', k, sid: 's1', next: 'tomorrow' }).code, 'BAD');
  const h = E.ss.getSheetByName('Lead History')._data.filter(x => x[2] === 's1');
  assert(h.length >= 5);
});
test('work saved on one duplicate keeps showing after the same person takes the quiz again', () => {
  const k = key('msfionahd');
  E.call({ a: 'save', k, sid: 's3', stage: 'Not now' });
  const r1 = E.call({ a: 'list', k });
  assert.strictEqual(r1.leads.find(l => l.dup === 2).stage, 'Not now');
});
test('admin board shows every approved coach (minus Coach AJ), unmatched coach names, and no access with a coach key', () => {
  const r = E.call({ a: 'a_overview', k: ADMIN });
  assert(r.ok, r.msg);
  assert.deepStrictEqual(r.coaches.map(c => c.code).sort(), ['lala', 'msfionahd', 'tien']);
  assert.strictEqual(r.orphans['Someone Else'], 1); assert.strictEqual(r.orphans['Gone Coach'], 1); assert(!r.orphans['Coach AJ']);
  assert.strictEqual(E.call({ a: 'a_overview', k: key('lala') }).code, 'AUTH');
  const f = r.coaches.find(c => c.code === 'msfionahd'); assert(f.stats.median != null);
});
test('admin can open a coach\'s list and a new link switches the old one off', () => {
  assert.strictEqual(E.call({ a: 'list', k: ADMIN, coach: 'lala' }).leads[0].name, 'Citra');
  const old = key('lala');
  const r = E.call({ a: 'a_rotate', k: ADMIN, coach: 'lala' });
  assert(r.ok && r.link.indexOf('#k=') > 0 && !r.link.includes(old));
  assert.strictEqual(E.call({ a: 'list', k: old }).code, 'AUTH');
});
test('a hidden coach\'s link stops working', () => {
  const sh = E.ctx.coachSheet_(); const row = E.ctx.readCoaches_(sh).find(r => r.code === 'tien'); const k = row.leadsKey;
  row.status = 'hidden'; E.ctx.writeCoach_(sh, row);
  assert.strictEqual(E.call({ a: 'list', k }).code, 'AUTH');
  row.status = 'approved'; E.ctx.writeCoach_(sh, row);
});
test('new-lead email carries the portal link; reminder email goes to coaches with waiting leads; AJ summary has the speed block', () => {
  const line = E.ctx.portalLine_({ coach: 'dr. Lala', sid: 's5' }).join('\n'); assert(/leads\/#k=.*&l=s5/.test(line));
  assert.strictEqual(E.ctx.portalLine_({ coach: 'Coach AJ', sid: 'x' }).length, 0);
  E.mails.length = 0; E.ctx.portalNudge_();
  assert(E.mails.some(m => m.to === 'l@x' && /1 lead not contacted/.test(m.subject)));
  assert(/Leads portal:\n- /.test(E.ctx.portalSpeedText_()));
});
test('the quiz lead logger still works and ignores the portal columns', () => {
  const r = E.ctx.doPost({ postData: { contents: JSON.stringify({ sid: 's9', status: 'Lead masuk', coach: 'dr. Lala', name: 'Gita', wa: '6287777', total: 50 }) } });
  assert.strictEqual(r.text, 'ok');
  assert.strictEqual(E.call({ a: 'list', k: E.ctx.readCoaches_(E.ctx.coachSheet_()).find(x => x.code === 'lala').leadsKey }).leads[0].name, 'Gita');
});
console.log(passed + ' passed');
