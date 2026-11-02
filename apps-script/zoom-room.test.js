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

function fresh() {
  const e = makeEnv(); e.ctx.setup(); e.setNow(T0);
  const key = String(e.sheets['Start here'].getRange(3, 1).getValue()).split('#admin=')[1];
  const A = d => e.call(Object.assign({ k: key }, d));
  const who = (n, s) => ({ n, s });
  const as = (u, d) => e.call(Object.assign({}, u, d));
  return { e, key, A, who, as };
}

const { e: env, key: adminKey, A, who, as } = fresh();
const ann = who('Ann Alpha'), bob = who('Bob Beta', 'tiger'), cat = who('Cat Gamma');
[ann, bob, cat].forEach(u => assert(env.call(Object.assign({ a: 'join' }, u)).ok));

test('admin key is on the Start here tab', () => assert(adminKey && adminKey.length === 32));
test('joining with a new name creates the member; the same name (any case or spacing) is the same person', () => {
  const r = env.call({ a: 'join', n: '  ann   ALPHA ' });
  assert(r.ok && r.created === false && r.name === 'Ann Alpha');
  assert.strictEqual(A({ a: 'a_view' }).members.filter(m => m.name === 'Ann Alpha').length, 1);
});
test('a name with a secret word needs that word; the wrong word is refused plainly', () => {
  assert.strictEqual(env.call({ a: 'view', n: 'Bob Beta' }).code, 'AUTH');
  assert.strictEqual(env.call({ a: 'view', n: 'Bob Beta', s: 'lion' }).code, 'AUTH');
  assert(env.call({ a: 'view', n: 'bob beta', s: ' TIGER ' }).ok, 'secret word is case-insensitive');
  assert(/secret word/.test(env.call({ a: 'join', n: 'Bob Beta', s: 'lion' }).msg));
});
test('the secret word is stored hashed, never in plain text', () => {
  assert(!JSON.stringify(env.sheets['Members']._data).includes('tiger'));
});
test('unknown name cannot view or book until it has joined', () => {
  assert.strictEqual(env.call({ a: 'view', n: 'Nobody Here' }).code, 'AUTH');
  assert.strictEqual(env.call({ a: 'book', n: 'Nobody Here', start: T0 + HOUR, dur: 30 }).code, 'AUTH');
});
test('too-short names are refused', () => assert.strictEqual(env.call({ a: 'join', n: 'A' }).code, 'BAD'));
test('book a free slot, then the same slot is refused for another member with a generic message', () => {
  const r1 = as(ann, { a: 'book', start: T0 + HOUR, dur: 60 });
  assert(r1.ok, JSON.stringify(r1));
  const r2 = as(bob, { a: 'book', start: T0 + HOUR, dur: 30 });
  assert.strictEqual(r2.ok, false); assert.strictEqual(r2.code, 'TAKEN');
  assert(!/Ann|Alpha/.test(r2.msg), 'error must not name anyone');
});
test('overlap from either side is refused; touching ends are allowed', () => {
  assert.strictEqual(as(bob, { a: 'book', start: T0 + 30 * MIN, dur: 60 }).code, 'TAKEN');
  assert.strictEqual(as(bob, { a: 'book', start: T0 + 90 * MIN, dur: 60 }).code, 'TAKEN');
  assert(as(bob, { a: 'book', start: T0 + 30 * MIN, dur: 30 }).ok, 'ends exactly when Ann starts');
  assert(as(bob, { a: 'book', start: T0 + 120 * MIN, dur: 60 }).ok, 'starts exactly when Ann ends');
});
test('member view never contains other members: no names, ids, counts or lengths', () => {
  const v = as(cat, { a: 'view' });
  const s = JSON.stringify(v);
  ['Ann', 'Bob', 'Alpha', 'Beta', 'memberId', 'tiger'].forEach(w => assert(!s.includes(w), 'leaked ' + w));
  assert.strictEqual(v.mine.length, 0);
  assert(Array.isArray(v.busy) && v.busy.every(x => x.length === 2 && typeof x[0] === 'number'));
});
test('adjacent bookings by different members merge into one busy range', () => {
  const busy = as(cat, { a: 'view' }).busy;
  assert.strictEqual(busy.length, 1, JSON.stringify(busy));
  assert.strictEqual(busy[0][0], T0 + 30 * MIN); assert.strictEqual(busy[0][1], T0 + 180 * MIN);
});
test('a member sees only their own bookings', () => {
  const a = as(ann, { a: 'view' });
  assert.strictEqual(a.mine.length, 1); assert.strictEqual(a.mine[0].end - a.mine[0].start, 60 * MIN);
  const b = as(bob, { a: 'view' });
  assert(b.mine.length === 2 && b.mine.every(x => x.id !== a.mine[0].id));
});
test('a member cannot cancel or extend someone else\'s booking', () => {
  const id = as(ann, { a: 'view' }).mine[0].id;
  assert.strictEqual(as(bob, { a: 'cancel', id }).code, 'GONE');
  assert.strictEqual(as(bob, { a: 'extend', id }).code, 'GONE');
});
test('duration, past, far-future and grid rules', () => {
  assert.strictEqual(as(cat, { a: 'book', start: T0 + 5 * HOUR, dur: 240 }).code, 'LIMIT');
  assert.strictEqual(as(cat, { a: 'book', start: T0 - 3 * HOUR, dur: 30 }).code, 'PAST');
  assert.strictEqual(as(cat, { a: 'book', start: T0 + 70 * 86400000, dur: 30 }).code, 'FAR');
  assert.strictEqual(as(cat, { a: 'book', start: T0 + 5 * HOUR + 7 * MIN, dur: 30 }).code, 'BAD');
});
test('open hours: when narrowed to 06-23, nothing outside; default is 24h', () => {
  assert(as(cat, { a: 'book', start: Date.UTC(2026, 10, 3, 20, 0), dur: 30 }).ok); // 03:00 WIB open by default
  A({ a: 'a_settings', settings: { openStartHour: 6, openEndHour: 23 } });
  const six = Date.UTC(2026, 10, 3, 23, 0); // 06:00 WIB Nov 4
  assert.strictEqual(as(cat, { a: 'book', start: six - 30 * MIN, dur: 30 }).code, 'HOURS');
  assert(as(cat, { a: 'book', start: six, dur: 30 }).ok);
  assert.strictEqual(as(cat, { a: 'book', start: Date.UTC(2026, 10, 4, 15, 30), dur: 60 }).code, 'HOURS');
});
test('limit on upcoming bookings per member', () => {
  const x = fresh(), u = x.who('Dan Delta');
  x.e.call({ a: 'join', n: u.n });
  for (let i = 0; i < 5; i++) assert(x.as(u, { a: 'book', start: T0 + (i * 2) * HOUR, dur: 30 }).ok);
  assert.strictEqual(x.as(u, { a: 'book', start: T0 + 12 * HOUR, dur: 30 }).code, 'LIMIT');
});
test('own overlap gets its own message', () => assert.strictEqual(as(ann, { a: 'book', start: T0 + HOUR, dur: 30 }).code, 'OWN'));
test('extend works when the next slot is free, refused when taken', () => {
  const x = fresh(), u = x.who('Eve Echo'), w = x.who('Fay Foxtrot');
  x.e.call({ a: 'join', n: u.n }); x.e.call({ a: 'join', n: w.n });
  const b = x.as(u, { a: 'book', start: T0, dur: 60 }).booking;
  assert(x.as(u, { a: 'extend', id: b.id }).ok);
  assert(x.as(w, { a: 'book', start: T0 + 90 * MIN, dur: 30 }).ok);
  assert.strictEqual(x.as(u, { a: 'extend', id: b.id }).code, 'TAKEN');
});
test('cancel before start frees the time; ending early releases the rest', () => {
  const x = fresh(), u = x.who('Gus Golf'), w = x.who('Hal Hotel');
  x.e.call({ a: 'join', n: u.n }); x.e.call({ a: 'join', n: w.n });
  const b = x.as(u, { a: 'book', start: T0 + 2 * HOUR, dur: 60 }).booking;
  assert(x.as(u, { a: 'cancel', id: b.id }).ok);
  assert(x.as(w, { a: 'book', start: T0 + 2 * HOUR, dur: 60 }).ok);
  const b2 = x.as(u, { a: 'book', start: T0, dur: 120 }).booking;
  x.e.setNow(T0 + 30 * MIN);
  assert(x.as(u, { a: 'cancel', id: b2.id }).ok);
  assert(x.as(w, { a: 'book', start: T0 + 30 * MIN, dur: 30 }).ok);
});
test('history is kept: cancelled rows stay in the Bookings sheet', () => {
  const x = fresh(), u = x.who('Ivy India');
  x.e.call({ a: 'join', n: u.n });
  const b = x.as(u, { a: 'book', start: T0 + HOUR, dur: 30 }).booking;
  x.as(u, { a: 'cancel', id: b.id });
  const rows = x.e.sheets['Bookings']._data;
  assert.strictEqual(rows.length, 2); assert.strictEqual(rows[1][7], 'cancelled');
});
test('admin sees everyone with names; a member name cannot call admin actions', () => {
  const v = A({ a: 'a_view' });
  assert(v.ok && v.bookings.some(b => b.member === 'Ann Alpha') && v.members.length >= 3);
  assert(!JSON.stringify(v.members).includes('secretHash'));
  assert.strictEqual(env.call({ a: 'a_view', k: 'x'.repeat(32) }).code, 'AUTH');
  assert.strictEqual(as(ann, { a: 'a_view' }).code, 'AUTH');
});
test('admin lockout after 5 wrong keys, then recovers', () => {
  const x = fresh();
  for (let i = 0; i < 5; i++) assert.strictEqual(x.e.call({ a: 'a_view', k: 'wrong' + i }).code, 'AUTH');
  assert.strictEqual(x.A({ a: 'a_view' }).ok, false, 'locked even with the right key');
  x.e.setNow(T0 + 16 * MIN);
  assert(x.A({ a: 'a_view' }).ok);
});
test('admin block cancels overlapping bookings only when told to; label never reaches members', () => {
  const x = fresh(), u = x.who('Jon Juliet');
  x.e.call({ a: 'join', n: u.n });
  x.as(u, { a: 'book', start: T0 + HOUR, dur: 60 });
  assert.strictEqual(x.A({ a: 'a_block', start: T0 + HOUR, dur: 30, label: 'Maintenance' }).code, 'TAKEN');
  const r = x.A({ a: 'a_block', start: T0 + HOUR, dur: 30, label: 'Maintenance', override: true });
  assert(r.ok && r.cancelled === 1);
  const v = x.as(u, { a: 'view' });
  assert.strictEqual(v.mine[0].status, 'cancelled');
  assert(!JSON.stringify(v).includes('Maintenance'));
});
test('admin can book for a member and sees exactly who clashes', () => {
  const id = A({ a: 'a_view' }).members.filter(m => m.name === 'Cat Gamma')[0].id;
  const r = A({ a: 'a_book', memberId: id, start: T0 + HOUR, dur: 30 });
  assert.strictEqual(r.code, 'TAKEN'); assert(/Ann Alpha/.test(r.msg));
});
test('admin can remove a member (upcoming bookings cancelled, name blocked), restore, and clear a forgotten secret word', () => {
  const x = fresh(), u = x.who('Kim Kilo', 'moon');
  x.e.call(Object.assign({ a: 'join' }, u));
  x.as(u, { a: 'book', start: T0 + HOUR, dur: 30 });
  const id = x.A({ a: 'a_view' }).members[0].id;
  assert(x.A({ a: 'a_member_revoke', id }).ok);
  assert.strictEqual(x.as(u, { a: 'view' }).code, 'AUTH');
  assert(x.A({ a: 'a_view' }).bookings.every(b => b.status !== 'active'));
  assert(x.A({ a: 'a_member_restore', id }).ok);
  assert.strictEqual(x.e.call({ a: 'view', n: u.n }).code, 'AUTH', 'still needs the secret word');
  assert(x.A({ a: 'a_member_reset', id }).ok);
  assert(x.e.call({ a: 'view', n: u.n }).ok, 'word cleared, name alone works');
});
test('renaming a member updates their bookings and rejects duplicates', () => {
  const x = fresh();
  x.e.call({ a: 'join', n: 'Lee Lima' }); x.e.call({ a: 'join', n: 'Max Mike' });
  x.as(x.who('Lee Lima'), { a: 'book', start: T0 + HOUR, dur: 30 });
  const ms = x.A({ a: 'a_view' }).members;
  const lee = ms.filter(m => m.name === 'Lee Lima')[0];
  assert.strictEqual(x.A({ a: 'a_member_rename', id: lee.id, name: 'max mike' }).code, 'DUP');
  assert(x.A({ a: 'a_member_rename', id: lee.id, name: 'Lee L.' }).ok);
  assert(x.A({ a: 'a_view' }).bookings.some(b => b.member === 'Lee L.'));
  assert(x.e.call({ a: 'view', n: 'Lee L.' }).ok);
});
test('settings validation gives plain messages and saves good values', () => {
  assert.strictEqual(A({ a: 'a_settings', settings: { maxDurationMin: 45 } }).code, 'BAD');
  assert.strictEqual(A({ a: 'a_settings', settings: { openStartHour: 23, openEndHour: 6 } }).code, 'BAD');
  assert(A({ a: 'a_settings', settings: { maxDurationMin: 120 } }).ok);
  assert.strictEqual(as(ann, { a: 'view' }).rules.maxDurationMin, 120);
});
test('names that look like spreadsheet formulas are neutralised', () => {
  env.call({ a: 'join', n: '=HYPERLINK("x")' });
  assert(env.sheets['Members']._data.some(r => String(r[1]).startsWith("'=")));
});
test('garbage requests return JSON errors, never HTML', () => {
  const r = JSON.parse(env.ctx.doPost({ postData: { contents: 'not json' } }).text);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(env.call({ a: 'nope', n: 'x' }).ok, false);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
