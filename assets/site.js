/* Shared site config: coaches, language, coach memory. Loaded by every page. */
window.ALV = (function () {
  /* Each coach gets a link: any page + #code (letters/numbers only). Photos live in /images (photo: square portrait, face: small round avatar).
     booking: optional appointment-booking link shown after a lead unlocks results.
     stat: optional headline result shown big on the home page (leave it out if the coach has none). */
  /* To add a coach: copy the block below, change the key (the code used in links: any page + #code), and fill it in.
     palette (optional): sky (default), rose, sage. More live in assets/palettes.css.
     transform (optional): the "first story" block on the #transformwithST results page: a headline number with one line,
     and a story. Leave it out and that block is hidden. If photo is empty, the coach's own "after" photo is used.
     See COACHES.md for the whole checklist. */
  const COACHES = {
    aj: { name: 'Coach AJ', wa: '628170241185', pretty: '+62 817 0241 185', city: '', photo: 'coach-aj.jpg', face: 'coach-aj-face.jpg', booking: '',
      palette: 'sky',
      transform: {
        proof: { value: '−18 kg', id: 'bareng istri, tanpa berhenti kerja', en: 'with my wife, without stepping away from work' },
        story: { id: 'Dulu aku sibuk jalanin startup game development, punya 3 anak, dan ikutan “hamil” tiap istri hamil, sampai akhirnya kegemukan. Bareng istri, aku turun 18 kg tanpa berhenti kerja. Sekarang aku bantu profesional sibuk menemukan cara yang muat di jadwal mereka.',
                 en: 'I was busy running a game development startup, raising 3 kids, and gaining “sympathy weight” every time my wife was pregnant. Together with my wife, I lost 18 kg without stepping away from work. Now I help busy professionals find a way that fits their schedule.' } },
      stat: { value: '−18 kg', id: 'dalam 90 hari, bareng istri, tanpa berhenti kerja', en: 'in 90 days, with my wife, without stepping away from work' },
      story: { id: 'Dulu aku sibuk jalanin startup game development, punya 3 anak, dan ikutan “hamil” tiap istri hamil, sampai akhirnya kegemukan. Bareng istri, aku turun 18 kg dalam 90 hari tanpa berhenti kerja. Sekarang aku bantu profesional sibuk menemukan cara yang muat di jadwal mereka.',
               en: 'I was busy running a game development startup, raising 3 kids, and gaining “sympathy weight” every time my wife was pregnant. Together with my wife, I lost 18 kg in 90 days without stepping away from work. Now I help busy professionals find a way that fits their schedule.' } },
    nova: { name: 'dr. Nova', wa: '628989180720', pretty: '+62 898-9180-720', city: '', photo: 'coach-novalia.jpg', face: 'coach-novalia-face.jpg', booking: '',
      palette: 'rose',
      transform: {
        proof: { value: '−10 kg', id: 'sambil tetap menyusui', en: 'while still breastfeeding' },
        story: { id: 'Sebagai dokter, saya terbiasa merawat orang lain, tapi sering lupa merawat diri sendiri. Sebagai ibu, saya ingin memberikan yang terbaik untuk anak, dan itu berarti saya juga harus sehat dan tercukupi nutrisinya.',
                 en: 'As a doctor I’m used to caring for others, but I often forget to care for myself. As a mother I want to give my child the best, and that means I have to be healthy and well nourished too.' } } },
    lala: { name: 'dr. Lala', wa: '6281809999918', pretty: '+62 818-0999-9918', city: '', photo: 'coach-lala.jpg', face: 'coach-lala-face.jpg', booking: '',
      palette: 'rose',
      transform: {
        proof: { value: '−7 kg', id: 'dan prosesnya akhirnya jadi mudah', en: 'and the process finally got easy' },
        story: { id: 'Sebagai dokter estetik yang harus estetik, tindakan “beauty is pain” sudah sering aku lakukan dan ubah lifestyle is a must. But the result, nggak signifikan. Sampai akhirnya #transformwithST bikin prosesnya jadi mudah.',
                 en: 'As an aesthetic doctor I’m supposed to look the part, so I’ve done plenty of “beauty is pain” treatments, and changing my lifestyle was a must. But the results weren’t significant, until #transformwithST made the process easy.' } } },
    jevon: { name: 'dr. Jevon', wa: '6281809521794', pretty: '+62 818-0952-1794', city: '', photo: 'coach-jevon.jpg', face: 'coach-jevon-face.jpg', booking: '',
      palette: 'sky',
      transform: {
        proof: { value: { id: '−18,1 kg', en: '−18.1 kg' }, id: 'dengan cara yang enjoy', en: 'in a way he actually enjoyed' },
        story: { id: 'Dulu sudah coba segala cara. Gym 4 sampai 5 kali seminggu, catering sehat, sampai suntik kurus, tapi dalam 6 bulan cuma turun 2 kg. Beruntung ketemu #transformwithST, dan turun dengan cara yang enjoy.',
                 en: 'I tried everything. Gym four to five times a week, healthy catering, even weight-loss injections, and in six months I lost only 2 kg. Luckily I found #transformwithST, and the weight came off in a way I actually enjoyed.' } } },
    melita: { name: 'dr. Melita', wa: '6281317223077', pretty: '+62 813-1722-3077', city: '', photo: 'coach-melita.jpg', face: 'coach-melita-face.jpg', booking: '',
      palette: 'rose',
      transform: {
        proof: { value: '−11 kg', id: 'dan bebas beli baju yang aku suka', en: 'and free to wear the clothes I love' },
        story: { id: 'Dulu aku juga pikir aku nggak perlu diet. Setelah #transformwithST, aku happy banget bisa bebas beli baju yang aku suka, bahkan jadi ibu yang lebih baik dan tentunya lebih fit buat anak-anak perempuanku.',
                 en: 'I used to think I didn’t need to diet either. After #transformwithST I’m so happy to be free to buy the clothes I love, and even to be a better mom, and of course fitter for my daughters.' } } },
    lucky: { name: 'dr. Lucky', wa: '6281220477774', pretty: '+62 812-2047-7774', city: '', photo: 'coach-lucky.jpg', face: 'coach-lucky-face.jpg', booking: '',
      palette: 'sky',
      transform: {
        proof: { value: '−19 kg', id: 'dan kesehatannya kembali', en: 'and his health back' },
        story: { id: 'Dulu aku kepala IGD yang sibuk mengurus kesehatan orang lain, sementara kesehatanku sendiri bermasalah: obesitas, hipertensi, dan pegal-pegal di mana-mana. Lewat #transformwithST, aku menemukan kesehatanku lagi.',
                 en: 'I used to head an ER, busy looking after everyone else’s health while my own was in trouble: obesity, high blood pressure, and aches everywhere. Through #transformwithST I found my health again.' } } }
  };
  const DEFAULT = 'aj';

  /* Meta Pixel: paste the Pixel ID from Meta Events Manager here. Empty = no tracking loads. */
  const PIXEL_ID = '';

  /* GoatCounter visitor stats (dashboard: https://alvacy.goatcounter.com). Empty = no stats load. */
  const GOATCOUNTER = 'alvacy';

  function coachCode() {
    const h = (location.hash || '').slice(1).toLowerCase();
    if (COACHES[h]) { try { localStorage.setItem('alv-coach', h); } catch (e) {} return h; }
    try { const s = localStorage.getItem('alv-coach'); if (s && COACHES[s]) return s; } catch (e) {}
    return DEFAULT;
  }
  /* True when this visit really came through a coach (a #code in the link, or a coach remembered from an earlier link),
     as opposed to the default coach being shown because nobody invited this visitor. */
  function hasCoach() {
    const h = (location.hash || '').slice(1).toLowerCase();
    if (COACHES[h]) return true;
    try { const s = localStorage.getItem('alv-coach'); if (s && COACHES[s]) return true; } catch (e) {}
    return false;
  }
  /* Colours: pages that load /assets/palettes.css take the palette of the coach who invited the visitor.
     ?palette=rose previews one without changing anything. */
  function applyPalette() {
    const c = COACHES[coachCode()] || {};
    document.documentElement.setAttribute('data-palette', window.PALETTE_OVERRIDE || new URLSearchParams(location.search).get('palette') || c.palette || 'sky');
  }
  /* Keep the coach attached while the visitor moves around the site, even when the browser blocks storage:
     links between our own pages get #code added (links that already point to a section keep theirs). */
  function tagLinks() {
    if (!hasCoach()) return;
    const code = coachCode();
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (!h || /^(https?:|mailto:|tel:|#|\/\/)/.test(h) || h.indexOf('#') >= 0) return;
      a.setAttribute('href', h + '#' + code);
    });
  }
  /* Language: Indonesian pages live at /, English copies at /en/ (generated by scripts/build.py).
     The address decides the language. The ID/EN toggle switches in place and rewrites the address,
     so a reload or a shared link opens the same language, and links inside a page stay in that language. */
  const PAGE_LANG = document.documentElement.getAttribute('data-page-lang') === 'en' ? 'en' : 'id';
  function langPath(l) {
    let p = location.pathname;
    const isEn = p === '/en' || p.indexOf('/en/') === 0;
    if (l === 'en' && !isEn) p = '/en' + p;
    if (l === 'id' && isEn) p = p.slice(3) || '/';
    return p;
  }
  function syncUrl(l) {
    try { if (/^https?:$/.test(location.protocol)) { const p = langPath(l); if (p !== location.pathname) history.replaceState(history.state, '', p + location.search + location.hash); } } catch (e) {}
  }
  function getLang() {
    if (!/^https?:$/.test(location.protocol)) return PAGE_LANG;
    return langPath('en') === location.pathname ? 'en' : 'id';
  }
  function setLang(l) { try { localStorage.setItem('csb-lang', l); } catch (e) {} document.documentElement.lang = l; syncUrl(l); }

  /* Where did this visitor come from? A link with utm_* wins; otherwise the first outside referrer is kept. */
  function captureSource() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('alv-src') || 'null'); } catch (e) {}
    const q = new URLSearchParams(location.search);
    const pick = k => (q.get(k) || '').slice(0, 100);
    const utm = { source: pick('utm_source'), medium: pick('utm_medium'), campaign: pick('utm_campaign'), content: pick('utm_content') };
    let next = null;
    if (utm.source || utm.campaign) next = utm;
    else if (q.get('fbclid')) next = { source: 'facebook/instagram', medium: 'click', campaign: '', content: '' };
    else if (!stored) {
      let ref = '';
      try { const r = new URL(document.referrer); if (r.hostname && r.hostname !== location.hostname) ref = r.hostname.replace(/^www\./, ''); } catch (e) {}
      next = { source: ref || 'langsung', medium: ref ? 'referral' : '', campaign: '', content: '' };
    }
    if (next) {
      next.landing = location.pathname.replace(/^\/alvacy/, '') || '/';
      try { localStorage.setItem('alv-src', JSON.stringify(next)); } catch (e) {}
      return next;
    }
    return stored || { source: 'langsung', medium: '', campaign: '', content: '', landing: '' };
  }
  const SOURCE = captureSource();

  /* GoatCounter: counts page views, referrers and utm_* campaigns. No cookies. */
  if (GOATCOUNTER && /(^|\.)alvacy\.com$/.test(location.hostname)) {
    const gc = document.createElement('script');
    gc.async = true;
    gc.src = 'https://gc.zgo.at/count.js';
    gc.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER + '.goatcounter.com/count');
    document.head.appendChild(gc);
  }

  /* Meta Pixel loader + a tiny track() helper that is safe to call when the Pixel is off. */
  if (PIXEL_ID) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }
  function track(event, params, eventId, custom) {
    try { if (window.fbq) fbq(custom ? 'trackCustom' : 'track', event, params || {}, eventId ? { eventID: eventId } : undefined); } catch (e) {}
  }

  /* Scroll reveal: elements with class "reveal" fade up once as they enter the screen. */
  (function reveal() {
    const root = document.documentElement;
    if (!('IntersectionObserver' in window)) return;
    root.classList.add('js');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    const watch = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  })();

  applyPalette();
  addEventListener('hashchange', applyPalette);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagLinks); else tagLinks();

  return { COACHES, DEFAULT, hasCoach, applyPalette, tagLinks, coachCode, getLang, setLang, coach: () => COACHES[coachCode()], source: () => SOURCE, track };
})();
