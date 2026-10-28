/* #transformwithST results: the data and the before/after carousel, shared by the main page and /transform/.
   A page needs <div id="results"></div>, the two assets (results.css, results.js) and two calls:
   ALVResults.mount(document.getElementById('results')) once, ALVResults.render(lang) whenever the language changes.

   To add a coach's result, add one block to CASES below (the checklist is in COACHES.md). */
window.ALVResults = (function () {
  const T = {
    id: { before: 'Sebelum', after: 'Sesudah', phBefore: 'Foto sebelum', phAfter: 'Foto sesudah', phSoon: 'Foto sebelum menyusul',
      grip: 'Geser buat membandingkan foto sebelum dan sesudah', tagCoach: 'Coach', sample: 'Contoh tampilan',
      mKg: 'berat badan', mFat: 'lemak tubuh', mVfa: 'lemak visceral (VFA), diukur dengan <span style="white-space:nowrap">Omron HBF-375</span>', mVfa2: 'lemak visceral (VFA)',
      dKg: 'kg', dPt: 'poin', dLv: 'level', railRes: 'Hasil sebelum dan sesudah', prev: 'Sebelumnya', next: 'Berikutnya',
      sPeople: 'coach', sKg: 'kg total turun' },
    en: { before: 'Before', after: 'After', phBefore: 'Before photo', phAfter: 'After photo', phSoon: 'Before photo coming soon',
      grip: 'Drag to compare the before and after photos', tagCoach: 'Coach', sample: 'Layout sample',
      mKg: 'weight', mFat: 'body fat', mVfa: 'visceral fat (VFA), measured on an <span style="white-space:nowrap">Omron HBF-375</span>', mVfa2: 'visceral fat (VFA)',
      dKg: 'kg', dPt: 'pts', dLv: 'levels', railRes: 'Before and after results', prev: 'Previous', next: 'Next',
      sPeople: 'coaches', sKg: 'kg lost in total' }
  };

  /* ---------------------------------------------------------------------------------------------
     RESULTS: the only place to edit when a new coach's result arrives.
     Each case: coach (optional: the coach's code from assets/site.js, so their own card comes first on their link),
     name, before/after photo paths (/images/results/...), metrics m, quote {id,en}. No day counts are shown.
     A metric is {from,to,...} (start and end, the drop is worked out) or {drop,...} when only the drop is known.
     suf = unit after the numbers, u = label key, d = unit word after the drop, k:1 = the weight row (used for totals).
     Photos: same pose, light and distance for before and after. Only list a coach once they agreed to be shown.
     Only coaches are shown here, never clients. The order on screen is random on every visit;
     a visitor who came through a coach's link sees that coach first.
     Totals above the carousel appear on their own once there are 3 or more real coach cases.
     --------------------------------------------------------------------------------------------- */
  const CASES = [
 {coach:'aj',name:'AJ Jonathan Ong',before:'/images/results/aj-before.jpg',after:'/images/results/aj-after.jpg',
  m:[{from:85.1,to:67,suf:' kg',u:'mKg',d:'dKg',k:1},{from:23.7,to:9.9,suf:'%',u:'mFat',d:'dPt'},{from:13.5,to:5.5,u:'mVfa',d:'dLv'}],
  quote:{id:'Dulu pernah diet sendiri dengan OMAD, lari seminggu 4 kali, water fasting, tapi meskipun turun, gampang banget naik lagi. #transformwithST yang akhirnya jadi solusi turun sehat, lemak turun, otot naik, dan sustainable.',
         en:'I used to diet on my own with OMAD, running four times a week and water fasting. The weight came off, but it came back very easily. #transformwithST is what finally gave me a healthy, sustainable way to lose fat while my muscle went up.'}},
 {coach:'jevon',name:'dr. Jevon Darmawan',before:'/images/results/jevon-before.jpg',after:'/images/results/jevon-after.jpg',
  m:[{from:78.1,to:60,suf:' kg',u:'mKg',d:'dKg',k:1},{from:22.8,to:12,suf:'%',u:'mFat',d:'dPt'},{from:11,to:4,u:'mVfa2',d:'dLv'}],
  quote:{id:'Dulu sudah coba segala cara. Gym 4 sampai 5 kali seminggu, catering sehat, sampai suntik kurus, tapi dalam 6 bulan cuma turun 2 kg. Beruntung ketemu #transformwithST, dalam 3 bulan turun lebih dari 15 kg dengan cara yang enjoy.',
         en:'I tried everything. Gym four to five times a week, healthy catering, even weight-loss injections, and in six months I lost only 2 kg. Luckily I found #transformwithST, and in 3 months I lost more than 15 kg in a way I actually enjoyed.'}},
 {coach:'lala',name:'dr. Emanuella Tamara',before:'/images/results/emanuella-before.jpg',after:'/images/results/emanuella-after.jpg',
  m:[{from:57,to:50,suf:' kg',u:'mKg',d:'dKg',k:1},{from:28,to:19,suf:'%',u:'mFat',d:'dPt'},{from:3,to:1.5,u:'mVfa2',d:'dLv'}],
  quote:{id:'Sebagai dokter estetik yang harus estetik, tindakan “beauty is pain” sudah sering aku lakukan, ubah lifestyle is a must. But the result, nggak signifikan. Sampai akhirnya #transformwithST bikin prosesnya jadi mudah, and the rest is history.',
         en:'As an aesthetic doctor I’m supposed to look the part, so I’ve done plenty of “beauty is pain” treatments, and changing my lifestyle was a must. But the results weren’t significant. Until #transformwithST made the process easy, and the rest is history.'}},
 {coach:'nova',name:'dr. Novalia Sutjiady',before:'/images/results/novalia-before.jpg',after:'/images/results/novalia-after.jpg',
  m:[{from:60.5,to:50.5,suf:' kg',u:'mKg',d:'dKg',k:1},{from:27.7,to:20.5,suf:'%',u:'mFat',d:'dPt'},{from:3.5,to:1.5,u:'mVfa2',d:'dLv'}],
  quote:{id:'Sebagai dokter, saya terbiasa merawat orang lain, tapi sering lupa merawat diri sendiri. Lewat #transformwithST saya belajar merawat diri dengan lebih terarah. Yang paling berarti, saya bisa menjalani program sambil tetap menyusui dengan ASI yang melimpah dan berkualitas. Merawat diri ternyata tidak mengurangi perhatian untuk anak, justru membantu saya memberikan yang terbaik untuknya.',
         en:'As a doctor I’m used to caring for others, but I often forget to care for myself. Through #transformwithST I learned to look after myself in a more focused way. What meant the most was being able to do the program while still breastfeeding, with plenty of good-quality milk. Taking care of myself doesn’t take attention away from my child. It helps me give them my best.'}},
 {coach:'melita',name:'dr. Melita Sutjiady',before:'/images/results/melita-before.jpg',after:'/images/results/melita-after.jpg',
  m:[{from:65.3,to:54.3,suf:' kg',u:'mKg',d:'dKg',k:1},{from:34.9,to:27.7,suf:'%',u:'mFat',d:'dPt'},{from:8.5,to:4.5,u:'mVfa2',d:'dLv'}],
  quote:{id:'Sudah laku, nggak apa-apa, yang penting sehat. Dulu aku juga pikir aku nggak perlu diet, tapi setelah #transformwithST, aku happy banget bisa bebas beli baju yang aku suka, bahkan jadi ibu yang lebih baik dan tentunya lebih fit buat anak-anak perempuanku.',
         en:'Already taken, and that’s fine, what matters is being healthy. I used to think I didn’t need to diet either, but after #transformwithST I’m so happy to be free to buy the clothes I love, and even to be a better mom, and of course fitter for my daughters.'}}
];

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Numbers start at 0 and count up only for real visitors who allow motion. The search build (headless browser)
     and anyone without JavaScript get the real numbers in the page text. */
  const ZERO = !RM && !navigator.webdriver;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SIL = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="36" r="17" fill="currentColor" opacity=".3"/><path d="M14 100c0-25 16-40 36-40s36 15 36 40z" fill="currentColor" opacity=".3"/></svg>';
  const ARROWS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>';
  const CHEV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  let lang = 'id', firstPaint = true, root, rail, bar, prevBtn, nextBtn, strip;
  let base = null;           /* the random order, fixed for this visit */
  let auto = !RM, autoTimer = null, hovering = false, visible = false;

  const decs = v => { const x = String(v).split('.')[1]; return x ? x.length : 0; };
  const fmt = (v, d) => { const x = Number(v).toFixed(d || 0); return lang === 'id' ? x.replace('.', ',') : x; };
  const cu = (v, dec) => `<b class="cu" data-to="${v}" data-dec="${dec || 0}">${fmt(firstPaint && ZERO ? 0 : v, dec)}</b>`;
  function drop(m) { const d = Math.max(decs(m.from), decs(m.to)); return m.from != null ? Math.round((m.from - m.to) * 10 ** d) / 10 ** d : m.drop; }

  function panel(side, src, label, alt) {
    const cls = side === 'a' ? 'after' : 'before';
    return src
      ? `<div class="ph ${cls}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" draggable="false"></div>`
      : `<div class="ph ${cls} empty ${side}">${SIL}<small>${esc(label)}</small></div>`;
  }
  function metric(m, t) {
    if (m.from == null) return `<div class="row"><small>${t[m.u]}</small><span class="num k">−${cu(m.drop, decs(m.drop))} ${t[m.d]}</span></div>`;
    return `<div class="row"><small>${t[m.u]}</small><span class="num">${cu(m.from, decs(m.from))} → ${cu(m.to, decs(m.to))}${m.suf || ''}</span><span class="drop">−${cu(drop(m), decs(drop(m)))} ${t[m.d]}</span></div>`;
  }
  function caseCard(c, t) {
    return `<article class="rc${c.sample ? ' is-sample' : ''}">
  <div class="cmp" style="--p:50">
   ${panel('b', c.before, c.sample ? t.phBefore : t.phSoon, `${c.name}, ${t.before}`)}${panel('a', c.after, t.phAfter, `${c.name}, ${t.after}`)}
   <span class="line"></span><span class="chip b">${t.before}</span><span class="chip a">${t.after}</span>
   <button type="button" class="grip" role="slider" aria-label="${esc(t.grip)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${ARROWS}</button>
  </div>
  <div class="body">
   <div class="top"><span class="name">${esc(c.name)}</span><span class="tag${c.sample ? ' sample' : ''}">${c.sample ? t.sample : t.tagCoach}</span></div>
   <div class="nums">${c.m.map(m => metric(m, t)).join('')}</div>
   <blockquote>${esc(c.quote[lang])}</blockquote>
  </div></article>`;
  }

  /* ---- before/after slider ---- */
  function setP(c, v) { v = Math.max(0, Math.min(100, v)); c.style.setProperty('--p', v); c._p = v; const g = c.querySelector('.grip'); if (g) g.setAttribute('aria-valuenow', Math.round(v)); }
  function glide(c, to, ms, done) {
    cancelAnimationFrame(c._r); const from = c._p == null ? 50 : c._p;
    if (RM || from === to) { setP(c, to); if (done) done(); return; }
    const t0 = performance.now();
    (function f(n) { const k = Math.min(1, (n - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; setP(c, from + (to - from) * e); if (k < 1) c._r = requestAnimationFrame(f); else if (done) done(); })(t0);
  }
  function hint(c) { glide(c, 34, 520, () => glide(c, 66, 760, () => glide(c, 50, 520))); }
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest('.grip'); if (!g) return;
    const c = g.closest('.cmp'); cancelAnimationFrame(c._r);
    drag = { c, id: e.pointerId }; try { g.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = drag.c.getBoundingClientRect(); setP(drag.c, (e.clientX - r.left) / r.width * 100);
  });
  ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, e => { if (drag && e.pointerId === drag.id) drag = null; }));
  document.addEventListener('click', e => {
    const c = e.target.closest('.cmp'); if (!c || e.target.closest('.grip') || !c.closest('#results')) return;
    cancelAnimationFrame(c._r); glide(c, (c._p == null ? 50 : c._p) >= 50 ? 0 : 100, 480);
  });
  document.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('.grip'); if (!g) return;
    const c = g.closest('.cmp'), p = c._p == null ? 50 : c._p;
    const to = { ArrowLeft: p - 5, ArrowRight: p + 5, Home: 0, End: 100 }[e.key];
    if (to == null) return; e.preventDefault(); cancelAnimationFrame(c._r); setP(c, to);
  });

  /* ---- count up, once, when a card is first seen ---- */
  function countUp(el) {
    const to = +el.dataset.to, d = +el.dataset.dec || 0; if (RM) { el.textContent = fmt(to, d); return; }
    const t0 = performance.now(), dur = 900;
    (function f(n) { const k = Math.min(1, (n - t0) / dur); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)), d); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  let io = null;
  function armCards() {
    if (!ZERO) return;
    if (!io) io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      e.target.querySelectorAll('.cu').forEach(countUp);
      const c = e.target.querySelector('.cmp'); if (c && !RM) setTimeout(() => { if (c._p == null) hint(c); }, 350);
    }), { threshold: .55 });
    rail.querySelectorAll('.rc').forEach(el => io.observe(el));
  }

  /* ---- the rail: the card in the middle is biggest, cards shrink and fade as they leave ---- */
  const cards = () => [...rail.children];
  function focusEffect() {
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = null, bd = 1e9;
    cards().forEach(el => {
      const w = el.offsetWidth + 16, d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid) / w, k = Math.min(1, d);
      el.style.transform = `scale(${(1 - .17 * k).toFixed(3)})`;
      el.style.opacity = (1 - .5 * k).toFixed(3);
      el.style.zIndex = d < .5 ? 2 : 1;
      if (d < bd) { bd = d; best = el; }
    });
    cards().forEach(el => el.classList.toggle('on', el === best));
    const max = rail.scrollWidth - rail.clientWidth, w = Math.min(100, rail.clientWidth / rail.scrollWidth * 100);
    bar.style.width = w + '%'; bar.style.left = (max > 0 ? rail.scrollLeft / max * (100 - w) : 0) + '%';
    prevBtn.disabled = rail.scrollLeft < 4; nextBtn.disabled = rail.scrollLeft > max - 4;
  }
  const current = () => Math.max(0, cards().findIndex(el => el.classList.contains('on')));
  function goTo(i, smooth) {
    const el = cards()[Math.max(0, Math.min(cards().length - 1, i))]; if (!el) return;
    rail.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2, behavior: smooth && !RM ? 'smooth' : 'auto' });
  }

  /* ---- auto-roll: a gentle step every few seconds, for good until the visitor touches anything ---- */
  function tick() {
    if (!auto || hovering || !visible || document.hidden) return;
    const n = cards().length; if (n < 2) return;
    goTo(current() >= n - 1 ? 0 : current() + 1, true);
  }
  function stopAuto() { auto = false; clearInterval(autoTimer); }
  function startAuto() { clearInterval(autoTimer); if (auto) autoTimer = setInterval(tick, 4300); }

  /* ---- order: random each visit; a coach's own card first when the visit came through that coach ---- */
  function shuffled() {
    const a = CASES.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function ordered() {
    if (!base) base = ZERO ? shuffled() : CASES.slice();   /* the search build keeps the written order */
    const code = window.ALV && ALV.hasCoach() ? ALV.coachCode() : null;
    return base.slice().sort((a, b) => (b.coach === code) - (a.coach === code) || 0);
  }

  function mount(el) {
    root = el;
    root.innerHTML = `<div class="strip wrap reveal" hidden><div class="s"><span class="v" data-k="people"></span><span class="l" data-k="lp"></span></div><div class="s"><span class="v" data-k="kg"></span><span class="l" data-k="lk"></span></div></div>
<div class="stage"><div class="rail" tabindex="0"></div>
<div class="railbar"><div class="prog"><i></i></div><div class="nav2"><button type="button" data-dir="-1" disabled>${CHEV('M15 6l-6 6 6 6')}</button><button type="button" data-dir="1">${CHEV('M9 6l6 6-6 6')}</button></div></div></div>`;
    strip = root.querySelector('.strip'); rail = root.querySelector('.rail'); bar = root.querySelector('.prog i');
    [prevBtn, nextBtn] = root.querySelectorAll('.nav2 button');
    let tickF = false;
    rail.addEventListener('scroll', () => { if (!tickF) { tickF = true; requestAnimationFrame(() => { tickF = false; focusEffect(); }); } }, { passive: true });
    addEventListener('resize', focusEffect);
    root.querySelectorAll('.nav2 button').forEach(b => b.addEventListener('click', () => { stopAuto(); goTo(current() + (+b.dataset.dir), true); }));
    /* touching, dragging, scrolling, typing or tabbing anywhere in the carousel turns the auto-roll off for good */
    ['pointerdown', 'touchstart', 'wheel', 'keydown', 'focusin'].forEach(n => root.addEventListener(n, stopAuto, { passive: true }));
    root.addEventListener('mouseenter', () => { hovering = true; }); root.addEventListener('mouseleave', () => { hovering = false; });
    /* tapping a card that is off to the side brings it to the middle instead of flipping its photo */
    rail.addEventListener('click', e => {
      const card = e.target.closest('.rc'); if (!card || card.classList.contains('on')) return;
      e.stopPropagation(); e.preventDefault(); goTo(cards().indexOf(card), true);
    }, true);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .35 }).observe(root); else visible = true;
    addEventListener('hashchange', () => render(lang, true));
    startAuto();
  }

  function render(l, keepScroll) {
    lang = l || lang; const t = T[lang];
    const list = ordered(), keep = rail.scrollLeft;
    rail.innerHTML = list.map(x => caseCard(x, t)).join('');
    rail.setAttribute('aria-label', t.railRes);
    prevBtn.setAttribute('aria-label', t.prev); nextBtn.setAttribute('aria-label', t.next);
    const real = CASES.filter(x => !x.sample);
    strip.hidden = real.length < 3;
    strip.querySelector('[data-k=people]').textContent = real.length;
    strip.querySelector('[data-k=kg]').textContent = Math.round(real.reduce((a, x) => a + drop(x.m.find(m => m.k) || { drop: 0 }), 0));
    strip.querySelector('[data-k=lp]').textContent = t.sPeople; strip.querySelector('[data-k=lk]').textContent = t.sKg;
    if (keepScroll === true || !firstPaint) rail.scrollLeft = keep; else goTo(0, false);
    focusEffect();
    if (firstPaint) { firstPaint = false; armCards(); }
  }

  return { mount, render, CASES };
})();
