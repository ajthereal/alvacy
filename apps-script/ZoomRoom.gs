/**
 * Zoom Room API: booking for one shared Zoom meeting room (alvacy.com/zoom).
 * Standalone Apps Script. It creates its own private Google Sheet ("Zoom Room Data") the first time setup() runs.
 *
 * Privacy rule this file enforces on the server (the page cannot be trusted):
 *   - A member only ever receives their OWN bookings. Everyone else's time comes back as merged "busy" ranges with
 *     no names, no counts, no lengths, no ids. Admin-only actions need the admin key.
 *   - Zoom access details (join link, passcode, host key) live in the private Sheet, never in the repo or the page.
 *     The host key is only handed out during the member's own booking window.
 *
 * Setup (once): script.google.com -> New project -> paste this file -> run setup() and accept permissions ->
 *   Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone -> Deploy. Send the /exec URL.
 *   Later edits: Deploy -> Manage deployments -> (pencil) -> Version: New version -> Deploy. This keeps the same URL.
 */
const ZR_VERSION = 1;
const ZR_SLOT = 30 * 60000;
const ZR_WIB = 7 * 3600000;
const ZR_TAB = { settings: 'Settings', members: 'Members', bookings: 'Bookings', log: 'Log', start: 'Start here' };
const ZR_BK = ['id', 'memberId', 'member', 'startMs', 'endMs', 'start (WIB)', 'end (WIB)', 'status', 'kind', 'label', 'created', 'updated', 'revealedAt', 'endedAt'];
const ZR_MB = ['id', 'name', 'tokenHash', 'status', 'created', 'updated'];
const ZR_DEFAULTS = {
  joinLink: '', passcode: '', hostKey: '', note: '',
  maxDurationMin: '180', maxFuture: '5', wrapUpMin: '10', noShowMin: '15',
  openStartHour: '6', openEndHour: '23', daysAhead: '60'
};
const ZR_NUM = ['maxDurationMin', 'maxFuture', 'wrapUpMin', 'noShowMin', 'openStartHour', 'openEndHour', 'daysAhead'];

/* ---------- small helpers ---------- */
function zrNow_() { return (typeof ZR_NOW === 'number') ? ZR_NOW : Date.now(); }
function zrFail_(code, msg) { throw { zr: true, code: code, msg: msg }; }
function zrClean_(v, max) {
  v = String(v == null ? '' : v).trim().slice(0, max || 200);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function zrHash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function zrRand_(n) { let s = ''; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n); }
function zrFmt_(ms) { return Utilities.formatDate(new Date(ms), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm'); }
function zrJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function zrProp_() { return PropertiesService.getScriptProperties(); }

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
  Object.keys(o).forEach(k => { s[k] = ZR_NUM.indexOf(k) >= 0 ? (isFinite(Number(o[k])) && o[k] !== '' ? Number(o[k]) : Number(ZR_DEFAULTS[k])) : o[k]; });
  return s;
}

function zrWithLock_(fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { zrFail_('BUSY', 'The server is busy right now. Nothing was saved. Please try again in a few seconds.'); }
  try { return fn(); } finally { try { SpreadsheetApp.flush(); } catch (e) {} lock.releaseLock(); }
}

/* ---------- time rules ---------- */
function zrNum_(b, k) { return Number(b[k]); }
/* A member booking is released if its host key was never opened by noShowMin minutes after the start. */
function zrNoShow_(b, now, s) {
  return b.kind === 'member' && b.status === 'active' && !b.revealedAt && now > zrNum_(b, 'startMs') + s.noShowMin * 60000 && zrNum_(b, 'endMs') > now;
}
/* Does this booking still hold the room? */
function zrLive_(b, now, s) { return b.status === 'active' && zrNum_(b, 'endMs') > now && !zrNoShow_(b, now, s); }
function zrEffStatus_(b, now, s) {
  if (b.status === 'noshow') return 'released';
  if (b.status === 'active') {
    if (zrNoShow_(b, now, s)) return 'released';
    if (zrNum_(b, 'endMs') <= now) return 'done';
  }
  return b.status;
}
function zrInOpenHours_(start, end, s) {
  for (let t = start; t < end; t += ZR_SLOT) {
    const h = Math.floor((((t + ZR_WIB) % 86400000) + 86400000) % 86400000 / 3600000);
    if (h < s.openStartHour || h >= s.openEndHour) return false;
  }
  return true;
}
function zrOverlaps_(bks, start, end, now, s, exceptId) {
  return bks.filter(b => b.id !== exceptId && zrLive_(b, now, s) && zrNum_(b, 'startMs') < end && start < zrNum_(b, 'endMs'));
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
/* Persist releases that have become true, so the Sheet history is accurate. Only called inside the lock. */
function zrSweep_(bks, now, s) {
  bks.forEach(b => {
    if (zrNoShow_(b, now, s)) {
      b.status = 'noshow'; b.updated = new Date().toISOString(); zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
      zrLog_('system', 'noshow', b.id, 'host key not opened');
    }
  });
}

/* ---------- auth ---------- */
function zrMember_(k) {
  if (!k || typeof k !== 'string' || k.length < 20) zrFail_('AUTH', 'This link is not active. Ask for a new invite link.');
  const h = zrHash_(k);
  const m = zrTable_(ZR_TAB.members, ZR_MB).filter(x => x.tokenHash === h && x.status === 'active')[0];
  if (!m) zrFail_('AUTH', 'This link is not active. Ask for a new invite link.');
  return m;
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
function zrMine_(b, now, s) {
  const st = zrEffStatus_(b, now, s);
  const start = zrNum_(b, 'startMs'), end = zrNum_(b, 'endMs');
  return {
    id: b.id, start: start, end: end, status: st, revealed: !!b.revealedAt,
    canReveal: st === 'active' && now >= start - 15 * 60000 && now < end
  };
}
function zrMemberView_(m, now, s, bks) {
  const mine = bks.filter(b => b.memberId === m.id && b.kind === 'member' && zrNum_(b, 'endMs') > now - 24 * 3600000)
    .map(b => zrMine_(b, now, s)).sort((a, b) => a.start - b.start).slice(-40);
  const others = bks.filter(b => b.memberId !== m.id && zrLive_(b, now, s)).map(b => [zrNum_(b, 'startMs'), zrNum_(b, 'endMs')]);
  const hasLive = mine.some(x => x.status === 'active');
  const out = {
    ok: true, v: ZR_VERSION, now: now, name: m.name,
    busy: zrMerge_(others), mine: mine,
    rules: { slotMin: 30, maxDurationMin: s.maxDurationMin, wrapUpMin: s.wrapUpMin, noShowMin: s.noShowMin, daysAhead: s.daysAhead,
      openStartHour: s.openStartHour, openEndHour: s.openEndHour, maxFuture: s.maxFuture, tz: 'WIB' }
  };
  if (hasLive) out.access = { joinLink: s.joinLink, passcode: s.passcode };
  return out;
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
    } else m = zrMember_(d.k);
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
    zrSweep_(bks, now, s);
    if (!actorAdmin) {
      const upcoming = bks.filter(b => b.memberId === m.id && b.kind === 'member' && zrLive_(b, now, s)).length;
      if (upcoming >= s.maxFuture) zrFail_('LIMIT', 'You have reached the limit of ' + s.maxFuture + ' upcoming bookings. Cancel one or wait until a session ends.');
    }
    const mineClash = zrOverlaps_(bks, start, end, now, s).filter(b => b.memberId === m.id);
    if (mineClash.length) zrFail_('OWN', 'You already have a booking that overlaps this time.');
    const clash = zrOverlaps_(bks, start, end, now, s);
    if (clash.length) {
      if (actorAdmin) zrFail_('TAKEN', 'That time overlaps: ' + clash.map(b => (b.kind === 'block' ? 'Blocked: ' + b.label : b.member) + ' ' + zrFmt_(zrNum_(b, 'startMs')) + '-' + zrFmt_(zrNum_(b, 'endMs')).slice(11)).join('; '));
      zrFail_('TAKEN', 'That time is no longer available. Please pick another time.');
    }
    const iso = new Date().toISOString();
    const b = zrAppendRow_(ZR_TAB.bookings, ZR_BK, {
      id: Utilities.getUuid(), memberId: m.id, member: m.name, startMs: start, endMs: end,
      'start (WIB)': zrFmt_(start), 'end (WIB)': zrFmt_(end), status: 'active', kind: 'member', label: '',
      created: iso, updated: iso, revealedAt: '', endedAt: ''
    });
    zrLog_(actorAdmin ? 'admin' : m.name, 'book', b.id, zrFmt_(start) + ' ' + dur + 'min');
    return { ok: true, booking: zrMine_(b, now, s) };
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
    const s = zrSettings_(), m = zrMember_(d.k), bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    zrSweep_(bks, now, s);
    const b = zrOwn_(bks, m, d.id);
    if (!zrLive_(b, now, s)) zrFail_('GONE', 'That booking is already finished or released.');
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
    const s = zrSettings_(), m = zrMember_(d.k), bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    zrSweep_(bks, now, s);
    const b = zrOwn_(bks, m, d.id);
    if (!zrLive_(b, now, s)) zrFail_('GONE', 'That booking is already finished or released.');
    const start = zrNum_(b, 'startMs'), end = zrNum_(b, 'endMs'), newEnd = end + ZR_SLOT;
    if ((newEnd - start) / 60000 > s.maxDurationMin) zrFail_('LIMIT', 'The longest booking is ' + (s.maxDurationMin / 60) + ' hours.');
    if (!zrInOpenHours_(end, newEnd, s)) zrFail_('HOURS', 'The room closes at ' + s.openEndHour + ':00 WIB.');
    if (zrOverlaps_(bks, end, newEnd, now, s, b.id).length) zrFail_('TAKEN', 'The next 30 minutes are already taken, so this session cannot be extended. Please wrap up on time.');
    b.endMs = newEnd; b['end (WIB)'] = zrFmt_(newEnd); b.updated = new Date().toISOString();
    zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
    zrLog_(m.name, 'extend', b.id, '+30');
    return { ok: true, booking: zrMine_(b, now, s) };
  });
}
function zrReveal_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const s = zrSettings_(), m = zrMember_(d.k), bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    const b = zrOwn_(bks, m, d.id);
    if (zrNoShow_(b, now, s) || b.status === 'noshow') zrFail_('RELEASED', 'This booking was released because the host key was not opened in time. Please book again.');
    if (b.status !== 'active' || zrNum_(b, 'endMs') <= now) zrFail_('GONE', 'That booking is already finished.');
    if (now < zrNum_(b, 'startMs') - 15 * 60000) zrFail_('EARLY', 'The host key opens 15 minutes before your start time.');
    if (!b.revealedAt) { b.revealedAt = new Date().toISOString(); b.updated = b.revealedAt; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b); zrLog_(m.name, 'reveal', b.id, ''); }
    return { ok: true, hostKey: s.hostKey, note: s.note, joinLink: s.joinLink, passcode: s.passcode };
  });
}

/* ---------- admin actions ---------- */
function zrAdminView_(now) {
  const s = zrSettings_();
  const bks = zrTable_(ZR_TAB.bookings, ZR_BK).filter(b => zrNum_(b, 'endMs') > now - 7 * 86400000);
  const live = bks.filter(b => zrLive_(b, now, s)).sort((a, b) => zrNum_(a, 'startMs') - zrNum_(b, 'startMs'));
  const conflicts = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    if (zrNum_(live[j], 'startMs') < zrNum_(live[i], 'endMs')) conflicts.push([live[i].id, live[j].id]);
  }
  return {
    ok: true, v: ZR_VERSION, now: now, settings: s, conflicts: conflicts,
    members: zrTable_(ZR_TAB.members, ZR_MB).map(m => ({ id: m.id, name: m.name, status: m.status, created: m.created })),
    bookings: bks.map(b => ({
      id: b.id, memberId: b.memberId, member: b.member, start: zrNum_(b, 'startMs'), end: zrNum_(b, 'endMs'),
      status: zrEffStatus_(b, now, s), kind: b.kind, label: b.label, revealed: !!b.revealedAt
    })).sort((a, b) => a.start - b.start)
  };
}
function zrAdminBlock_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const s = zrSettings_();
    const start = Number(d.start), dur = Number(d.dur);
    if (!isFinite(start) || !isFinite(dur) || start % ZR_SLOT !== 0 || dur % 30 !== 0 || dur < 30 || dur > 7 * 1440) zrFail_('BAD', 'That block time is not valid.');
    const end = start + dur * 60000;
    const bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    zrSweep_(bks, now, s);
    const clash = zrOverlaps_(bks, start, end, now, s);
    if (clash.length && !d.override) zrFail_('TAKEN', 'This overlaps ' + clash.length + ' booking(s): ' + clash.map(b => (b.kind === 'block' ? 'Blocked: ' + b.label : b.member) + ' ' + zrFmt_(zrNum_(b, 'startMs'))).join('; ') + '. Tick "cancel overlapping bookings" to go ahead.');
    const iso = new Date().toISOString();
    clash.forEach(b => { b.status = 'cancelled'; b.label = 'cancelled by admin'; b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b); zrLog_('admin', 'cancel-for-block', b.id, b.member); });
    const b = zrAppendRow_(ZR_TAB.bookings, ZR_BK, {
      id: Utilities.getUuid(), memberId: '', member: '', startMs: start, endMs: end, 'start (WIB)': zrFmt_(start), 'end (WIB)': zrFmt_(end),
      status: 'active', kind: 'block', label: zrClean_(d.label || 'Blocked', 80), created: iso, updated: iso, revealedAt: '', endedAt: ''
    });
    zrLog_('admin', 'block', b.id, zrFmt_(start) + ' ' + dur + 'min');
    return { ok: true, cancelled: clash.length };
  });
}
function zrAdminCancel_(d) {
  const now = zrNow_();
  return zrWithLock_(() => {
    const bks = zrTable_(ZR_TAB.bookings, ZR_BK);
    const b = bks.filter(x => x.id === d.id)[0];
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
    if (d.a === 'a_member_add') {
      const name = zrClean_(d.name, 60);
      if (!name) zrFail_('BAD', 'Please type a name.');
      if (members.some(m => m.status === 'active' && String(m.name).toLowerCase() === name.toLowerCase())) zrFail_('DUP', 'A member with that name already exists. Use a slightly different name.');
      const token = zrRand_(40);
      const m = zrAppendRow_(ZR_TAB.members, ZR_MB, { id: Utilities.getUuid(), name: name, tokenHash: zrHash_(token), status: 'active', created: iso, updated: iso });
      zrLog_('admin', 'member-add', m.id, name);
      return { ok: true, member: { id: m.id, name: name }, token: token };
    }
    const m = members.filter(x => x.id === d.id)[0];
    if (!m) zrFail_('NOMEMBER', 'That member was not found.');
    if (d.a === 'a_member_reset') {
      const token = zrRand_(40);
      m.tokenHash = zrHash_(token); m.status = 'active'; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrLog_('admin', 'member-reset', m.id, m.name);
      return { ok: true, member: { id: m.id, name: m.name }, token: token };
    }
    if (d.a === 'a_member_rename') {
      const name = zrClean_(d.name, 60);
      if (!name) zrFail_('BAD', 'Please type a name.');
      m.name = name; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrLog_('admin', 'member-rename', m.id, name);
      return { ok: true };
    }
    if (d.a === 'a_member_revoke') {
      const now = zrNow_(), s = zrSettings_();
      m.status = 'revoked'; m.updated = iso; zrWriteRow_(ZR_TAB.members, ZR_MB, m);
      zrTable_(ZR_TAB.bookings, ZR_BK).filter(b => b.memberId === m.id && zrLive_(b, now, s) && zrNum_(b, 'startMs') > now).forEach(b => {
        b.status = 'cancelled'; b.label = 'member removed'; b.updated = iso; zrWriteRow_(ZR_TAB.bookings, ZR_BK, b);
      });
      zrLog_('admin', 'member-revoke', m.id, m.name);
      return { ok: true };
    }
    zrFail_('BAD', 'Unknown member action.');
  });
}
function zrAdminSettings_(d) {
  return zrWithLock_(() => {
    const incoming = d.settings || {};
    const sh = zrTab_(ZR_TAB.settings);
    const rows = Object.keys(ZR_DEFAULTS).map(k => {
      let v = incoming[k] !== undefined ? incoming[k] : zrSettings_()[k];
      if (ZR_NUM.indexOf(k) >= 0) {
        v = Number(v);
        if (!isFinite(v) || v < 0) zrFail_('BAD', 'The setting "' + k + '" must be a number.');
        if ((k === 'maxDurationMin') && (v < 30 || v % 30)) zrFail_('BAD', 'Longest booking must be a multiple of 30 minutes.');
        if (k === 'openStartHour' || k === 'openEndHour') { if (v > 24) zrFail_('BAD', 'Hours must be between 0 and 24.'); }
        if (k === 'maxFuture' && v < 1) zrFail_('BAD', 'Upcoming bookings per member must be at least 1.');
      } else v = zrClean_(v, 500);
      return [k, v];
    });
    if (Number(rows.filter(r => r[0] === 'openStartHour')[0][1]) >= Number(rows.filter(r => r[0] === 'openEndHour')[0][1])) zrFail_('BAD', 'Opening hour must be earlier than closing hour.');
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
    zrLog_('admin', 'settings', '', 'updated');
    return { ok: true };
  });
}

/* ---------- entry points ---------- */
function zrHandle_(d) {
  const now = zrNow_();
  switch (String(d.a || '')) {
    case 'view': {
      const m = zrMember_(d.k), s = zrSettings_();
      return zrMemberView_(m, now, s, zrTable_(ZR_TAB.bookings, ZR_BK));
    }
    case 'book': return zrBook_(d, false);
    case 'cancel': return zrCancel_(d);
    case 'extend': return zrExtend_(d);
    case 'reveal': return zrReveal_(d);
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
      case 'a_member_add': case 'a_member_reset': case 'a_member_rename': case 'a_member_revoke': return zrAdminMember_(d);
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
    ['Keep this Sheet private. Do not share it with anyone: it holds every name and booking, and the Zoom host key.'],
    [adminKey ? 'Your admin link (open on your iPhone or iPad, then add to Home Screen): https://alvacy.com/zoom/#admin=' + adminKey : 'Your admin key was set earlier and is not shown again. Run resetAdminKey() in the script editor to get a new one.'],
    ['After you have saved the admin link, delete the line above.'],
    ['Settings tab: edit the Zoom join link, passcode and host key here or in the admin page.'],
    ['Bookings tab: do not sort or delete rows. The page keeps history here.']
  ];
  if (adminKey || sh.getRange(1, 1).getValue() === '') sh.getRange(1, 1, lines.length, 1).setValues(lines);
}
