/**
 * Zoom Room API: scheduling only, so the team never clashes on the shared Zoom room (alvacy.com/zoom).
 * Standalone Apps Script. It creates its own private Google Sheet ("Zoom Room Data") the first time setup() runs.
 *
 * Who is who: a member types a name (and, if they like, a secret word) the first time. The name is their identity.
 * This is a light check on purpose, not bank-grade security.
 *
 * Privacy rule this file enforces on the server (the page cannot be trusted):
 *   - A member only ever receives their OWN bookings. Everyone else's time comes back as merged "busy" ranges with
 *     no names, no counts, no lengths, no ids. Admin-only actions need the admin key.
 *
 * Setup (once): script.google.com -> New project -> paste this file -> run setup() and accept permissions ->
 *   Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone -> Deploy. Send the /exec URL.
 *   Later edits: Deploy -> Manage deployments -> (pencil) -> Version: New version -> Deploy. This keeps the same URL.
 */
const ZR_VERSION = 2;
const ZR_SLOT = 30 * 60000;
const ZR_WIB = 7 * 3600000;
const ZR_TAB = { settings: 'Settings', members: 'Members', bookings: 'Bookings', log: 'Log', start: 'Start here' };
const ZR_BK = ['id', 'memberId', 'member', 'startMs', 'endMs', 'start (WIB)', 'end (WIB)', 'status', 'kind', 'label', 'created', 'updated', 'endedAt'];
const ZR_MB = ['id', 'name', 'nameKey', 'secretHash', 'status', 'created', 'updated'];
const ZR_DEFAULTS = { maxDurationMin: '180', maxFuture: '5', wrapUpMin: '10', openStartHour: '0', openEndHour: '24', daysAhead: '60' };
const ZR_NUM = ['maxDurationMin', 'maxFuture', 'wrapUpMin', 'openStartHour', 'openEndHour', 'daysAhead'];

/* ---------- small helpers ---------- */
function zrNow_() { return (typeof ZR_NOW === 'number') ? ZR_NOW : Date.now(); }
function zrFail_(code, msg) { throw { zr: true, code: code, msg: msg }; }
function zrClean_(v, max) {
  v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function zrHash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function zrNameKey_(name) { return String(name == null ? '' : name).replace(/\s+/g, ' ').trim().toLowerCase(); }
function zrSecretHash_(nameKey, secret) { return secret ? zrHash_(nameKey + '|' + String(secret).trim().toLowerCase()) : ''; }
function zrFmt_(ms) { return Utilities.formatDate(new Date(ms), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm'); }
function zrJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function zrProp_() { return PropertiesService.getScriptProperties(); }
function zrRand_(n) { let s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }

function zrSs_() {
  const id = zrProp_().getProperty('ZR_SHEET_ID');
  if (!id) zrFail_('SETUP', 'The booking sheet is not set up yet. Run setup() once in the script editor.');
  return SpreadsheetApp.openById(id);
}
function zrTab_(name) {
  const sh = zrSs_().getSheetByName(name);
  if (!sh) zrFail_('SETUP', 'The sheet tab "' + name + '" is missing. Run setup() again.');
  return sh;
}
function zrTable_(name, head) {
  const sh = zrTab_(name);
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, head.length).getValues().map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => { o[h] = r[j]; });
    return o;
  });
}
function zrWriteRow_(name, head, o) {
  zrTab_(name).getRange(o._row, 1, 1, head.length).setValues([head.map(h => o[h] == null ? '' : o[h])]);
}
function zrAppendRow_(name, head, o) {
  const sh = zrTab_(name);
  const row = Math.max(sh.getLastRow(), 1) + 1;
  o._row = row;
  sh.getRange(row, 1, 1, head.length).setValues([head.map(h => o[h] == null ? '' : o[h])]);
  return o;
}
function zrLog_(actor, action, id, detail) {
  try {
    const sh = zrTab_(ZR_TAB.log);
    sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, 5).setValues([[new Date().toISOString(), actor, action, id || '', String(detail || '').slice(0, 300)]]);
  } catch (e) { /* logging must never block a booking */ }
}
function zrSettings_() {
  const sh = zrTab_(ZR_TAB.settings);
  const n = sh.getLastRow();
  const o = Object.assign({}, ZR_DEFAULTS);
  if (n >= 2) sh.getRange(2, 1, n - 1, 2).getValues().forEach(r => { if (r[0] in ZR_DEFAULTS) o[r[0]] = r[1] == null ? '' : String(r[1]); });
  const s = {};
  Object.keys(o).forEach(k => { s[k] = isFinite(Number(o[k])) && o[k] !== '' ? Number(o[k]) : Number(ZR_DEFAULTS[k]); });
  return s;
}
function zrWithLock_(fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { zrFail_('BUSY', 'The server is busy right now. Nothing was saved. Please try again in a few seconds.'); }
  try { return fn(); } finally { try { SpreadsheetApp.flush(); } catch (e) {} lock.releaseLock(); }
}

/* ---------- time rules ---------- */
function zrNum_(b, k) { return Number(b[k]); }
/* Does this booking still hold the room? */
function zrLive_(b, now) { return b.status === 'active' && zrNum_(b, 'endMs') > now; }
function zrEffStatus_(b, now) {
  if (b.status === 'active' && zrNum_(b, 'endMs') <= now) return 'done';
  return b.status;
}
function zrInOpenHours_(start, end, s) {
  for (let t = start; t < end; t += ZR_SLOT) {
    const h = Math.floor((((t + ZR_WIB) % 86400000) + 86400000) % 86400000 / 3600000);
    if (h < s.openStartHour || h >= s.openEndHour) return false;
  }
  return true;
}
function zrOverlaps_(bks, start, end, now, exceptId) {
  return bks.filter(b => b.id !== exceptId && zrLive_(b, now) && zrNum_(b, 'startMs') < end && start < zrNum_(b, 'endMs'));
}
function zrMerge_(ranges) {
  const r = ranges.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  r.forEach(x => {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else out.push([x[0], x[1]]);
  });
  return out;
}

/* ---------- who is calling ---------- */
const ZR_AUTH_MSG = 'Please sign in again with your name.';
function zrFindMember_(nameKey) {
  return zrTable_(ZR_TAB.members, ZR_MB).filter(x => x.nameKey === nameKey)[0] || null;
}
function zrCheckMember_(m, secret) {
  if (m.status !== 'active') zrFail_('AUTH', 'This name has been removed. Please ask your leader.');
  if (m.secretHash && zrSecretHash_(m.nameKey, secret) !== m.secretHash) zrFail_('AUTH', 'That name needs its secret word. Type the word you chose the first time.');
  return m;
}
function zrMember_(d) {
  const key = zrNameKey_(d.n);
  if (!key) zrFail_('AUTH', ZR_AUTH_MSG);
  const m = zrFindMember_(key);
  if (!m) zrFail_('AUTH', ZR_AUTH_MSG);
  return zrCheckMember_(m, d.s);
}
/* First sign-in: creates the member if the name is new. */
function zrJoin_(d) {
  return zrWithLock_(() => {
    const name = zrClean_(d.n, 40), key = zrNameKey_(name);
    if (key.length < 2) zrFail_('BAD', 'Please type your name (at least 2 letters).');
    const m = zrFindMember_(key);
    if (m) { zrCheckMember_(m, d.s); return { ok: true, name: m.name, created: false }; }
    const iso = new Date().toISOString();
    const nm = zrAppendRow_(ZR_TAB.members, ZR_MB, { id: Utilities.getUuid(), name: name, nameKey: key, secretHash: zrSecretHash_(key, d.s), status: 'active', created: iso, updated: iso });
    zrLog_(name, 'join', nm.id, d.s ? 'with secret word' : 'name only');
    return { ok: true, name: name, created: true };
  });
}
function zrAdmin_(k) {
  const p = zrProp_();
  let st = {};
  try { st = JSON.parse(p.getProperty('ZR_ADMIN_FAILS') || '{}'); } catch (e) {}
  if (st.until && zrNow_() < st.until) zrFail_('AUTH', 'Admin sign-in is locked for a few minutes after several wrong tries.');
  const ok = k && typeof k === 'string' && zrHash_(k) === p.getProperty('ZR_ADMIN_HASH');
  if (!ok) {
    st.count = (st.count || 0) + 1;
    if (st.count >= 5) { st.until = zrNow_() + 15 * 60000; st.count = 0; }
    p.setProperty('ZR_ADMIN_FAILS', JSON.stringify(st));
    zrFail_('AUTH', 'Admin sign-in failed.');
  }
  if (st.count || st.until) p.setProperty('ZR_ADMIN_FAILS', '{}');
}

/* ---------- member views ---------- */
function zrMine_(b, now) {
  return { id: b.id, start: zrNum_(b, 'startMs'), end: zrNum_(b, 'endMs'), status: zrEffStatus_(b, now) };
}
function zrMemberView_(m, now, s, bks) {
  const mine = bks.filter(b => b.memberId === m.id && b.kind === 'member' && zrNum_(b, 'endMs') > now - 24 * 3600000)
    .map(b => zrMine_(b, now)).sort((a, b) => a.start - b.start).slice(-40);
  const others = bks.filter(b => b.memberId !== m.id && zrLive_(b, now)).map(b => [zrNum_(b, 'startMs'), zrNum_(b, 'endMs')]);
  return {
    ok: true, v: ZR_VERSION, now: now, name: m.name,
    busy: zrMerge_(others), mine: mine,
    rules: { slotMin: 30, maxDurationMin: s.maxDurationMin, wrapUpMin: s.wrapUpMin, daysAhead: s.daysAhead,
      openStartHour: s.openStartHour, openEndHour: s.openEndHour, maxFuture: s.maxFuture, tz: 'WIB' }
  };
}

/* ---------- member actions ---------- */
function zrBook_(d, actorAdmin) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const s = zrSettings_();
    let m;
    if (actorAdmin) {
      m = zrTable_(ZR_TAB.members, ZR_MB).filter(x => x.id === d.memberId && x.status === 'active')[0];
      if (!m) zrFail_('NOMEMBER', 'That member was not found or is removed.');
    } else m = zrMember_(d);
    const start = Number(d.start), dur = Number(d.dur);
    if (!isFinite(start) || !isFinite(dur) || start % ZR_SLOT !== 0 || dur % 30 !== 0 || dur < 30) zrFail_('BAD', 'That time is not valid. Please pick a start time and length again.');
    const end = start + dur * 60000;
    if (!actorAdmin) {
      if (dur > s.maxDurationMin) zrFail_('LIMIT', 'The longest booking is ' + (s.maxDurationMin / 60) + ' hours.');
      if (start < Math.floor(now / ZR_SLOT) * ZR_SLOT) zrFail_('PAST', 'That time has already passed.');
      if (start > now + s.daysAhead * 86400000) zrFail_('FAR', 'You can book up to ' + s.daysAhead + ' days ahead.');
      if (!zrInOpenHours_(start, end, s)) zrFail_('HOURS', 'The room is open ' + s.openStartHour + ':00 to ' + s.openEndHour + ':00 WIB. Please pick a time inside those hours.');
    }
    const bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    if (!actorAdmin) {
      const upcoming = bks.filter(b => b.memberId === m.id && b.kind === 'member' && zrLive_(b, now)).length;
      if (upcoming >= s.maxFuture) zrFail_('LIMIT', 'You have reached the limit of ' + s.maxFuture + ' upcoming bookings. Cancel one or wait until a session ends.');
    }
    const clash = zrOverlaps_(bks, start, end, now);
    if (clash.some(b => b.memberId === m.id)) zrFail_('OWN', 'You already have a booking that overlaps this time.');
    if (clash.length) {
      if (actorAdmin) zrFail_('TAKEN', 'That time overlaps: ' + clash.map(b => (b.kind === 'block' ? 'Blocked: ' + b.label : b.member) + ' ' + zrFmt_(zrNum_(b, 'startMs')) + '-' + zrFmt_(zrNum_(b, 'endMs')).slice(11)).join('; '));
      zrFail_('TAKEN', 'That time is no longer available. Please pick another time.');
    }
    const iso = new Date().toISOString();
    const b = zrAppendRow_(ZR_TAB.bookings, ZR_BK, {
      id: Utilities.getUuid(), memberId: m.id, member: m.name, startMs: start, endMs: end,
      'start (WIB)': zrFmt_(start), 'end (WIB)': zrFmt_(end), status: 'active', kind: 'member', label: '',
      created: iso, updated: iso, endedAt: ''
    });
    zrLog_(actorAdmin ? 'admin' : m.name, 'book', b.id, zrFmt_(start) + ' ' + dur + 'min');
    return { ok: true, booking: zrMine_(b, now) };
  });
}
function zrOwn_(bks, m, id) {
  const b = bks.filter(x => x.id === id && x.memberId === m.id && x.kind === 'member')[0];
  if (!b) zrFail_('GONE', 'That booking was not found.');
  return b;
}
function zrCancel_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const m = zrMember_(d), bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    const b = zrOwn_(bks, m, d.id);
    if (!zrLive_(b, now)) zrFail_('GONE', 'That booking is already finished.');
    const iso = new Date().toISOString();
    if (zrNum_(b, 'startMs') <= now) { b.status = 'ended'; b.endedAt = iso; } else b.status = 'cancelled';
    b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
    zrLog_(m.name, b.status === 'ended' ? 'end-early' : 'cancel', b.id, '');
    return { ok: true };
  });
}
function zrExtend_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const s = zrSettings_(), m = zrMember_(d), bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    const b = zrOwn_(bks, m, d.id);
    if (!zrLive_(b, now)) zrFail_('GONE', 'That booking is already finished.');
    const start = zrNum_(b, 'startMs'), end = zrNum_(b, 'endMs'), newEnd = end + ZR_SLOT;
    if ((newEnd - start) / 60000 > s.maxDurationMin) zrFail_('LIMIT', 'The longest booking is ' + (s.maxDurationMin / 60) + ' hours.');
    if (!zrInOpenHours_(end, newEnd, s)) zrFail_('HOURS', 'The room closes at ' + s.openEndHour + ':00 WIB.');
    if (zrOverlaps_(bks, end, newEnd, now, b.id).length) zrFail_('TAKEN', 'The next 30 minutes are already taken, so this session cannot be extended. Please wrap up on time.');
    b.endMs = newEnd; b['end (WIB)'] = zrFmt_(newEnd); b.updated = new Date().toISOString();
    zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
    zrLog_(m.name, 'extend', b.id, '+30');
    return { ok: true, booking: zrMine_(b, now) };
  });
}

/* ---------- admin actions ---------- */
function zrAdminView_(now) {
  const s = zrSettings_();
  const bks = zrTable_(ZR_TAB.bookings, ZR_BK).filter(b => zrNum_(b, 'endMs') > now - 7 * 86400000);
  const live = bks.filter(b => zrLive_(b, now)).sort((a, b) => zrNum_(a, 'startMs') - zrNum_(b, 'startMs'));
  const conflicts = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    if (zrNum_(live[j], 'startMs') < zrNum_(live[i], 'endMs')) conflicts.push([live[i].id, live[j].id]);
  }
  return {
    ok: true, v: ZR_VERSION, now: now, settings: s, conflicts: conflicts,
    members: zrTable_(ZR_TAB.members, ZR_MB).map(m => ({ id: m.id, name: m.name, status: m.status, created: m.created, hasSecret: !!m.secretHash })),
    bookings: bks.map(b => ({
      id: b.id, memberId: b.memberId, member: b.member, start: zrNum_(b, 'startMs'), end: zrNum_(b, 'endMs'),
      status: zrEffStatus_(b, now), kind: b.kind, label: b.label
    })).sort((a, b) => a.start - b.start)
  };
}
function zrAdminBlock_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const start = Number(d.start), dur = Number(d.dur);
    if (!isFinite(start) || !isFinite(dur) || start % ZR_SLOT !== 0 || dur % 30 !== 0 || dur < 30 || dur > 7 * 1440) zrFail_('BAD', 'That block time is not valid.');
    const end = start + dur * 60000;
    const bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    const clash = zrOverlaps_(bks, start, end, now);
    if (clash.length && !d.override) zrFail_('TAKEN', 'This overlaps ' + clash.length + ' booking(s): ' + clash.map(b => (b.kind === 'block' ? 'Blocked: ' + b.label : b.member) + ' ' + zrFmt_(zrNum_(b, 'startMs'))).join('; ') + '. Tick "cancel overlapping bookings" to go ahead.');
    const iso = new Date().toISOString();
    clash.forEach(b => { b.status = 'cancelled'; b.label = 'cancelled by admin'; b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b); zrLog_('admin', 'cancel-for-block', b.id, b.member); });
    const b = zrAppendRow_(ZR_TAB.bookings, ZR_BK, {
      id: Utilities.getUuid(), memberId: '', member: '', startMs: start, endMs: end, 'start (WIB)': zrFmt_(start), 'end (WIB)': zrFmt_(end),
      status: 'active', kind: 'block', label: zrClean_(d.label || 'Blocked', 80), created: iso, updated: iso, endedAt: ''
    });
    zrLog_('admin', 'block', b.id, zrFmt_(start) + ' ' + dur + 'min');
    return { ok: true, cancelled: clash.length };
  });
}
function zrAdminCancel_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const b = zrTable_(ZR_TAB.bookings, ZR_BK).filter(x => x.id === d.id)[0];
    if (!b || b.status !== 'active') zrFail_('GONE', 'That booking was not found or is already closed.');
    const iso = new Date().toISOString();
    if (zrNum_(b, 'startMs') <= now) { b.status = 'ended'; b.endedAt = iso; } else b.status = 'cancelled';
    if (b.kind === 'member') b.label = 'cancelled by admin';
    b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
    zrLog_('admin', 'cancel', b.id, b.member);
    return { ok: true };
  });
}
function zrAdminMember_(d) {
  return zrWithLock_(() => {
    const members = zrTable_(ZR_TAB.members, ZR_MB);
    const iso = new Date().toISOString();
    const m = members.filter(x => x.id === d.id)[0];
    if (!m) zrFail_('NOMEMBER', 'That member was not found.');
    if (d.a === 'a_member_rename') {
      const name = zrClean_(d.name, 40), key = zrNameKey_(name);
      if (key.length < 2) zrFail_('BAD', 'Please type a name (at least 2 letters).');
      if (members.some(x => x.id !== m.id && x.nameKey === key)) zrFail_('DUP', 'Another member already has that name.');
      m.name = name;
      if (m.secretHash) m.secretHash = '';           /* the secret was tied to the old name, so it is cleared */
      m.nameKey = key; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrTable_(ZR_TAB.bookings, ZR_BK).filter(b => b.memberId === m.id).forEach(b => { b.member = name; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b); });
      zrLog_('admin', 'member-rename', m.id, name);
      return { ok: true };
    }
    if (d.a === 'a_member_reset') {
      m.secretHash = ''; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrLog_('admin', 'member-clear-secret', m.id, m.name);
      return { ok: true };
    }
    if (d.a === 'a_member_revoke') {
      const now = zrNow_();
      m.status = 'revoked'; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrTable_(ZR_TAB.bookings, ZR_BK).filter(b => b.memberId === m.id && zrLive_(b, now) && zrNum_(b, 'startMs') > now).forEach(b => {
        b.status = 'cancelled'; b.label = 'member removed'; b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
      });
      zrLog_('admin', 'member-revoke', m.id, m.name);
      return { ok: true };
    }
    if (d.a === 'a_member_restore') {
      m.status = 'active'; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrLog_('admin', 'member-restore', m.id, m.name);
      return { ok: true };
    }
    zrFail_('BAD', 'Unknown member action.');
  });
}
function zrAdminSettings_(d) {
  return zrWithLock_(() => {
    const incoming = d.settings || {};
    const current = zrSettings_();
    const rows = Object.keys(ZR_DEFAULTS).map(k => {
      const v = Number(incoming[k] !== undefined ? incoming[k] : current[k]);
      if (!isFinite(v) || v < 0) zrFail_('BAD', 'The setting "' + k + '" must be a number.');
      if (k === 'maxDurationMin' && (v < 30 || v % 30)) zrFail_('BAD', 'Longest booking must be a multiple of 30 minutes.');
      if ((k === 'openStartHour' || k === 'openEndHour') && v > 24) zrFail_('BAD', 'Hours must be between 0 and 24.');
      if (k === 'maxFuture' && v < 1) zrFail_('BAD', 'Upcoming bookings per member must be at least 1.');
      return [k, v];
    });
    const get = k => rows.filter(r => r[0] === k)[0][1];
    if (get('openStartHour') >= get('openEndHour')) zrFail_('BAD', 'Opening hour must be earlier than closing hour.');
    zrTab_(ZR_TAB.settings).getRange(2, 1, rows.length, 2).setValues(rows);
    zrLog_('admin', 'settings', '', 'updated');
    return { ok: true };
  });
}

/* ---------- entry points ---------- */
function zrHandle_(d) {
  const now = zrNow_();
  switch (String(d.a || '')) {
    case 'join': return zrJoin_(d);
    case 'view': return zrMemberView_(zrMember_(d), now, zrSettings_(), zrTable_(ZR_TAB.bookings, ZR_BK));
    case 'book': return zrBook_(d, false);
    case 'cancel': return zrCancel_(d);
    case 'extend': return zrExtend_(d);
    default: break;
  }
  if (String(d.a || '').indexOf('a_') === 0) {
    zrAdmin_(d.k);
    switch (d.a) {
      case 'a_view': return zrAdminView_(now);
      case 'a_book': return zrBook_(d, true);
      case 'a_block': return zrAdminBlock_(d);
      case 'a_cancel': return zrAdminCancel_(d);
      case 'a_settings': return zrAdminSettings_(d);
      case 'a_member_rename': case 'a_member_reset': case 'a_member_revoke': case 'a_member_restore': return zrAdminMember_(d);
      default: break;
    }
  }
  zrFail_('BAD', 'Unknown request. Please refresh the page.');
}
function doPost(e) {
  try {
    let d;
    try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { zrFail_('BAD', 'The request was not understood. Please refresh the page.'); }
    return zrJson_(zrHandle_(d || {}));
  } catch (err) {
    if (err && err.zr) return zrJson_({ ok: false, code: err.code, msg: err.msg });
    try { zrLog_('system', 'error', '', String(err && err.message || err)); } catch (e2) {}
    return zrJson_({ ok: false, code: 'SERVER', msg: 'Something went wrong on the server. Nothing was saved. Please try again.' });
  }
}
function doGet() { return ContentService.createTextOutput('Zoom Room API is running.'); }

/* ---------- one-time setup ---------- */
function zrEnsureTab_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (head) {
    const cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (cur.join('|') !== head.join('|')) { sh.getRange(1, 1, 1, head.length).setValues([head]); try { sh.setFrozenRows(1); } catch (e) {} }
  }
  return sh;
}
function setup() {
  const p = zrProp_();
  let ss;
  const id = p.getProperty('ZR_SHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create('Zoom Room Data'); p.setProperty('ZR_SHEET_ID', ss.getId()); }
  zrEnsureTab_(ss, ZR_TAB.bookings, ZR_BK);
  zrEnsureTab_(ss, ZR_TAB.members, ZR_MB);
  zrEnsureTab_(ss, ZR_TAB.log, ['time', 'who', 'action', 'id', 'detail']);
  const st = zrEnsureTab_(ss, ZR_TAB.settings, ['key', 'value']);
  if (st.getLastRow() < 2) st.getRange(2, 1, Object.keys(ZR_DEFAULTS).length, 2).setValues(Object.keys(ZR_DEFAULTS).map(k => [k, ZR_DEFAULTS[k]]));
  zrEnsureTab_(ss, ZR_TAB.start, null);
  try { const first = ss.getSheetByName('Sheet1'); if (first && ss.getSheets().length > 1) ss.deleteSheet(first); } catch (e) {}
  let adminKey = '';
  if (!p.getProperty('ZR_ADMIN_HASH')) { adminKey = zrRand_(32); p.setProperty('ZR_ADMIN_HASH', zrHash_(adminKey)); }
  zrStartTab_(ss, adminKey);
  Logger.log('Sheet: ' + ss.getUrl());
  if (adminKey) Logger.log('Admin key (also on the "Start here" tab): ' + adminKey);
  return ss.getUrl();
}
function resetAdminKey() {
  const p = zrProp_();
  const key = zrRand_(32);
  p.setProperty('ZR_ADMIN_HASH', zrHash_(key)); p.setProperty('ZR_ADMIN_FAILS', '{}');
  zrStartTab_(zrSs_(), key);
  Logger.log('New admin key: ' + key);
}
function zrStartTab_(ss, adminKey) {
  const sh = ss.getSheetByName(ZR_TAB.start);
  const lines = [
    ['Zoom Room: start here'],
    ['Keep this Sheet private. It holds every name and booking.'],
    [adminKey ? 'Your admin link (open on your iPhone or iPad, then add to Home Screen): https://alvacy.com/zoom/#admin=' + adminKey : 'Your admin key was set earlier and is not shown again. Run resetAdminKey() in the script editor to get a new one.'],
    ['After you have saved the admin link, delete the line above.'],
    ['Team link to share with everyone: https://alvacy.com/zoom/'],
    ['Bookings tab: do not sort or delete rows. The page keeps history here.']
  ];
  if (adminKey || sh.getRange(1, 1).getValue() === '') sh.getRange(1, 1, lines.length, 1).setValues(lines);
}
