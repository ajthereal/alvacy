/* Shared site config: coaches, language, coach memory. Loaded by every page. */
window.ALV = (function () {
  /* Each coach gets a link: any page + #code (letters/numbers only). Photos live in /images (photo: square portrait, face: small round avatar). */
  const COACHES = {
    aj: { name: 'Coach AJ', wa: '628170241185', pretty: '+62 817 0241 185', city: 'Jakarta', photo: 'coach-aj.jpg', face: 'coach-aj-face.jpg',
      story: { id: 'Dulu sibuk, perut buncit, gampang capek. Turun 18 kg dalam 90 hari sambil tetap kerja.',
               en: 'Used to be busy, carrying belly fat and always tired. Lost 18 kg in 90 days while still working.' } }
  };
  const DEFAULT = 'aj';
  function coachCode() {
    const h = (location.hash || '').slice(1).toLowerCase();
    if (COACHES[h]) { try { localStorage.setItem('alv-coach', h); } catch (e) {} return h; }
    try { const s = localStorage.getItem('alv-coach'); if (s && COACHES[s]) return s; } catch (e) {}
    return DEFAULT;
  }
  function getLang() { try { const s = localStorage.getItem('csb-lang'); if (s === 'en' || s === 'id') return s; } catch (e) {} return 'id'; }
  function setLang(l) { try { localStorage.setItem('csb-lang', l); } catch (e) {} document.documentElement.lang = l; }
  return { COACHES, DEFAULT, coachCode, getLang, setLang, coach: () => COACHES[coachCode()] };
})();
