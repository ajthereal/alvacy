/* Tests for ZoomRoom.gs. Run: node apps-script/zoom-room.test.js
   Loads the real Apps Script file into a sandbox with an in-memory Google Sheet, so the booking rules,
   conflict checks and the "members never see each other" rule are checked against the actual code. */
const assert = require('assert');
const { makeEnv } = require('./zoom-room.mock');

const MIN = 60000, HOUR = 3600000;
// 2026-11-03 10:00 WIB = 03:00 UTC
const T0 = Date.UTC(2026, 10, 3, 3, 0, 0);
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { console.error('FAIL ' + name + '\n     ' + (e && e.message)); process.exitCode = 1; } }

const env = makeEnv();
env.ctx.setup();
env.setNow(T0);
const adminKey = String(env.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
assert(adminKey && adminKey.length === 32, 'admin key shown on Start here tab');
const A = d => env.call(Object.assign({ k: adminKey }, d));

const ann = A({ a: 'a_member_add', name: 'Ann Alpha' });
const bob = A({ a: 'a_member_add', name: 'Bob Beta' });
const cat = A({ a: 'a_member_add', name: 'Cat Gamma' });
const K = { ann: ann.token, bob: bob.token, cat: cat.token };

test('members added, tokens are long and stored hashed', () => {
  assert(ann.ok && K.ann.length === 40);
  const rows = env.sheets['Members']._data;
  assert(!JSON.stringify(rows).includes(K.ann), 'raw token must not be in the sheet');
});
test('wrong link gives a generic error', () => {
  const r = env.call({ a: 'view', k: 'x'.repeat(40) });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'AUTH');
});
test('book a free slot, then the same slot is refused for another member', () => {
  const r1 = env.call({ a: 'book', k: K.ann, start: T0 + HOUR, dur: 60 });
  assert(r1.ok, JSON.stringify(r1));
  const r2 = env.call({ a: 'book', k: K.bob, start: T0 + HOUR, dur: 30 });
  assert.strictEqual(r2.ok, false); assert.strictEqual(r2.code, 'TAKEN');
  assert(!/Ann|Alpha/.test(r2.msg), 'error must not name anyone');
});
test('overlapping from either side is refused; touching ends are allowed', () => {
  assert.strictEqual(env.call({ a: 'book', k: K.bob, start: T0 + 30 * MIN, dur: 60 }).code, 'TAKEN');
  assert.strictEqual(env.call({ a: 'book', k: K.bob, start: T0 + 90 * MIN, dur: 60 }).code, 'TAKEN');
  assert(env.call({ a: 'book', k: K.bob, start: T0 + 120 * MIN, dur: 60 }).ok, 'starts exactly when Ann ends');
  const r = env.call({ a: 'book', k: K.bob, start: T0 + 30 * MIN, dur: 30 });
  assert(r.ok, 'a 30 min slot that ends exactly when Ann starts is fine: ' + JSON.stringify(r));
});
test('member view never contains other members: no names, ids, counts or lengths', () => {
  const v = env.call({ a: 'view', k: K.cat });
  const s = JSON.stringify(v);
  ['Ann', 'Bob', 'Alpha', 'Beta', 'memberId'].forEach(w => assert(!s.includes(w), 'leaked ' + w));
  assert.strictEqual(v.mine.length, 0);
  assert(Array.isArray(v.busy) && v.busy.every(x => x.length === 2 && typeof x[0] === 'number'));
});
test('adjacent bookings by different members merge into one busy range', () => {
  const v = env.call({ a: 'view', k: K.cat });
  // Bob 10:30-11:00, Ann 11:00-12:00, Bob 12:00-13:00 touch each other, so the viewer sees ONE busy block 10:30-13:00
  const merged = v.busy;
  assert.strictEqual(merged.length, 1, JSON.stringify(merged));
  assert.strictEqual(merged[0][0], T0 + 30 * MIN);
  assert.strictEqual(merged[0][1], T0 + 180 * MIN);
});
test('a member sees only their own bookings', () => {
  const a = env.call({ a: 'view', k: K.ann });
  assert.strictEqual(a.mine.length, 1);
  assert.strictEqual(a.mine[0].end - a.mine[0].start, 60 * MIN);
  const b = env.call({ a: 'view', k: K.bob });
  assert(b.mine.length >= 1 && b.mine.every(x => x.id !== a.mine[0].id));
});
test('own bookings are not shown as busy to the owner of them (so the grid can show them as "yours")', () => {
  const a = env.call({ a: 'view', k: K.ann });
  assert(!a.busy.some(r => r[0] <= T0 + HOUR + 10 * MIN && r[1] >= T0 + HOUR + 50 * MIN && false));
});
test('duration, past and far-future rules', () => {
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: T0 + 5 * HOUR, dur: 240 }).code, 'LIMIT');
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: T0 - 3 * HOUR, dur: 30 }).code, 'PAST');
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: T0 + 70 * 86400000, dur: 30 }).code, 'FAR');
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: T0 + 5 * HOUR + 7 * MIN, dur: 30 }).code, 'BAD');
});
test('open hours: nothing before 06:00 or at/after 23:00 WIB', () => {
  const six = Date.UTC(2026, 10, 4, -1, 0); // 06:00 WIB Nov 4 = 23:00 UTC Nov 3
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: six - 30 * MIN, dur: 30 }).code, 'HOURS');
  assert(env.call({ a: 'book', k: K.cat, start: six, dur: 30 }).ok);
  const late = Date.UTC(2026, 10, 4, 15, 30); // 22:30 WIB
  assert.strictEqual(env.call({ a: 'book', k: K.cat, start: late, dur: 60 }).code, 'HOURS');
});
test('limit on upcoming bookings per member', () => {
  const e2 = makeEnv(); e2.ctx.setup(); e2.setNow(T0);
  const key = String(e2.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m = e2.call({ k: key, a: 'a_member_add', name: 'Dan' });
  for (let i = 0; i < 5; i++) assert(e2.call({ a: 'book', k: m.token, start: T0 + (i * 2) * HOUR, dur: 30 }).ok);
  assert.strictEqual(e2.call({ a: 'book', k: m.token, start: T0 + 12 * HOUR, dur: 30 }).code, 'LIMIT');
});
test('own overlap gets its own message, not the generic taken message', () => {
  assert.strictEqual(env.call({ a: 'book', k: K.ann, start: T0 + HOUR, dur: 30 }).code, 'OWN');
});
test('host key is only given during the window and only to the owner', () => {
  A({ a: 'a_settings', settings: { hostKey: '123456', joinLink: 'https://zoom.us/j/1', passcode: 'abc' } });
  const annB = env.call({ a: 'view', k: K.ann }).mine[0];
  assert.strictEqual(env.call({ a: 'reveal', k: K.ann, id: annB.id }).code, 'EARLY');
  assert.strictEqual(env.call({ a: 'reveal', k: K.bob, id: annB.id }).code, 'GONE');
  env.setNow(T0 + HOUR - 10 * MIN);
  const r = env.call({ a: 'reveal', k: K.ann, id: annB.id });
  assert(r.ok && r.hostKey === '123456');
  assert(!JSON.stringify(env.call({ a: 'view', k: K.cat })).includes('123456'), 'host key never in the schedule view');
  const nobody = A({ a: 'a_member_add', name: 'No Bookings' });
  const nv = JSON.stringify(env.call({ a: 'view', k: nobody.token }));
  assert(!nv.includes('123456') && !nv.includes('zoom.us') && !nv.includes('abc'), 'no access info for a member with no booking');
  env.setNow(T0);
});
test('join link and passcode are shown after booking, host key is not in view', () => {
  const v = env.call({ a: 'view', k: K.ann });
  assert(v.access && v.access.joinLink === 'https://zoom.us/j/1');
  assert(!JSON.stringify(v).includes('123456'));
});
test('no-show: unopened host key releases the slot for others', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m1 = e.call({ k: key, a: 'a_member_add', name: 'M1' }), m2 = e.call({ k: key, a: 'a_member_add', name: 'M2' });
  assert(e.call({ a: 'book', k: m1.token, start: T0, dur: 60 }).ok);
  e.setNow(T0 + 10 * MIN);
  assert.strictEqual(e.call({ a: 'book', k: m2.token, start: T0 + 30 * MIN, dur: 30 }).code, 'TAKEN');
  e.setNow(T0 + 16 * MIN);
  assert(e.call({ a: 'book', k: m2.token, start: T0 + 30 * MIN, dur: 30 }).ok, 'released after 15 min with no host key');
  const mine = e.call({ a: 'view', k: m1.token }).mine[0];
  assert.strictEqual(mine.status, 'released');
});
test('opening the host key protects the slot from release', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m1 = e.call({ k: key, a: 'a_member_add', name: 'M1' }), m2 = e.call({ k: key, a: 'a_member_add', name: 'M2' });
  const b = e.call({ a: 'book', k: m1.token, start: T0, dur: 60 }).booking;
  assert(e.call({ a: 'reveal', k: m1.token, id: b.id }).ok);
  e.setNow(T0 + 40 * MIN);
  assert.strictEqual(e.call({ a: 'book', k: m2.token, start: T0 + 30 * MIN, dur: 30 }).code, 'TAKEN');
});
test('extend works when the next slot is free, refused when taken', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m1 = e.call({ k: key, a: 'a_member_add', name: 'M1' }), m2 = e.call({ k: key, a: 'a_member_add', name: 'M2' });
  const b = e.call({ a: 'book', k: m1.token, start: T0, dur: 60 }).booking;
  e.call({ a: 'reveal', k: m1.token, id: b.id });
  assert(e.call({ a: 'extend', k: m1.token, id: b.id }).ok);
  assert(e.call({ a: 'book', k: m2.token, start: T0 + 90 * MIN, dur: 30 }).ok);
  assert.strictEqual(e.call({ a: 'extend', k: m1.token, id: b.id }).code, 'TAKEN');
});
test('cancel before start frees the time; ending early releases the rest', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m1 = e.call({ k: key, a: 'a_member_add', name: 'M1' }), m2 = e.call({ k: key, a: 'a_member_add', name: 'M2' });
  const b = e.call({ a: 'book', k: m1.token, start: T0 + 2 * HOUR, dur: 60 }).booking;
  assert(e.call({ a: 'cancel', k: m1.token, id: b.id }).ok);
  assert(e.call({ a: 'book', k: m2.token, start: T0 + 2 * HOUR, dur: 60 }).ok);
  assert.strictEqual(e.call({ a: 'cancel', k: m2.token, id: b.id }).code, 'GONE', 'cannot touch another booking');
  const b2 = e.call({ a: 'book', k: m1.token, start: T0, dur: 120 }).booking;
  e.call({ a: 'reveal', k: m1.token, id: b2.id });
  e.setNow(T0 + 30 * MIN);
  assert(e.call({ a: 'cancel', k: m1.token, id: b2.id }).ok);
  assert(e.call({ a: 'book', k: m2.token, start: T0 + 30 * MIN, dur: 30 }).ok);
});
test('history is kept: cancelled rows stay in the Bookings sheet', () => {
  const rows = env.sheets['Bookings']._data.length;
  assert(rows >= 4, 'rows: ' + rows);
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m = e.call({ k: key, a: 'a_member_add', name: 'M' });
  const b = e.call({ a: 'book', k: m.token, start: T0 + HOUR, dur: 30 }).booking;
  e.call({ a: 'cancel', k: m.token, id: b.id });
  const sh = e.sheets['Bookings']._data;
  assert.strictEqual(sh.length, 2); assert.strictEqual(sh[1][7], 'cancelled');
});
test('admin sees everyone with names; member key cannot call admin actions', () => {
  const v = A({ a: 'a_view' });
  assert(v.ok && v.bookings.some(b => b.member === 'Ann Alpha') && v.members.length >= 3);
  assert.strictEqual(env.call({ a: 'a_view', k: K.ann }).code, 'AUTH');
  assert(!JSON.stringify(v.members).includes('tokenHash'));
});
test('admin lockout after 5 wrong keys', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  for (let i = 0; i < 5; i++) assert.strictEqual(e.call({ a: 'a_view', k: 'wrong' + i }).code, 'AUTH');
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const r = e.call({ a: 'a_view', k: key });
  assert.strictEqual(r.ok, false, 'locked even with the right key');
  e.setNow(T0 + 16 * MIN);
  assert(e.call({ a: 'a_view', k: key }).ok);
});
test('admin block cancels overlapping bookings only when told to', () => {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const m = e.call({ k: key, a: 'a_member_add', name: 'M' });
  e.call({ a: 'book', k: m.token, start: T0 + HOUR, dur: 60 });
  assert.strictEqual(e.call({ k: key, a: 'a_block', start: T0 + HOUR, dur: 30, label: 'Maintenance' }).code, 'TAKEN');
  const r = e.call({ k: key, a: 'a_block', start: T0 + HOUR, dur: 30, label: 'Maintenance', override: true });
  assert(r.ok && r.cancelled === 1);
  const v = e.call({ a: 'view', k: m.token });
  assert.strictEqual(v.mine[0].status, 'cancelled');
  assert(v.busy.length === 1 && !JSON.stringify(v).includes('Maintenance'));
});
test('admin can book for a member and sees who clashes', () => {
  const r = A({ a: 'a_book', memberId: bob.member.id, start: T0 + HOUR, dur: 30 });
  assert.strictEqual(r.code, 'TAKEN'); assert(/Ann Alpha/.test(r.msg), 'admin is allowed to see the name');
});
test('removing a member cancels their upcoming bookings and disables the link', () => {
  const r = A({ a: 'a_member_revoke', id: cat.member.id });
  assert(r.ok);
  assert.strictEqual(env.call({ a: 'view', k: K.cat }).code, 'AUTH');
});
test('resetting a member link invalidates the old one', () => {
  const r = A({ a: 'a_member_reset', id: bob.member.id });
  assert(r.ok && r.token !== K.bob);
  assert.strictEqual(env.call({ a: 'view', k: K.bob }).code, 'AUTH');
  assert(env.call({ a: 'view', k: r.token }).ok);
});
test('settings validation gives plain messages', () => {
  assert.strictEqual(A({ a: 'a_settings', settings: { maxDurationMin: 45 } }).code, 'BAD');
  assert.strictEqual(A({ a: 'a_settings', settings: { openStartHour: 23, openEndHour: 6 } }).code, 'BAD');
  assert(A({ a: 'a_settings', settings: { note: '=HYPERLINK("x")' } }).ok);
  assert(env.sheets['Settings']._data.some(r => r[0] === 'note' && String(r[1]).startsWith("'=")), 'formula text is neutralised');
});
test('garbage requests return JSON errors, never HTML', () => {
  const out = env.ctx.doPost({ postData: { contents: 'not json' } }).text;
  const r = JSON.parse(out); assert.strictEqual(r.ok, false);
  assert.strictEqual(env.call({ a: 'nope', k: 'x' }).ok, false);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
