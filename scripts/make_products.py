#!/usr/bin/env python3
"""Generate /products/ (ID) and /en/products/ (EN) from data/products.json.
To add a product: append an object to data/products.json (fields: id, added, cat wellness|beauty, brand,
path, optional en_path, img, name, id_line, en_line, optional en_note), then run: python3 scripts/make_products.py"""
import json, html, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = json.loads((ROOT / 'data' / 'products.json').read_text(encoding='utf-8'))
P.sort(key=lambda x: x['added'], reverse=True)
e = html.escape

CSS = """
.btn.primary{background:var(--pop);color:var(--pop-ink);box-shadow:0 6px 18px var(--pop-glow)}
.btn.primary:hover{background:var(--pop-hover)}
.hero-wrap{padding:12px 12px 0}
.hero{max-width:1240px;margin:0 auto;border-radius:var(--r-lg);background:var(--sky);border:1px solid var(--sky-line);box-shadow:var(--rim);padding:clamp(44px,8vw,88px) 20px clamp(28px,5vw,44px);display:grid;justify-items:center;text-align:center;gap:16px}
.hero h1{max-width:820px}.hero .lede{max-width:600px}
.hero .meta{font-size:.85rem;color:var(--muted)}
section{padding-block:clamp(36px,7vw,72px)}
.tools{max-width:1120px;margin:0 auto 22px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips button{font:inherit;font-weight:600;font-size:.9rem;padding:9px 16px;border-radius:99px;background:var(--surface);border:1.5px solid var(--cloud-line);color:var(--head);cursor:pointer}
.chips button[aria-pressed=true]{border-color:var(--pop);background:#FFF4EA}
.q{font:inherit;font-size:.95rem;padding:10px 16px;border-radius:99px;border:1.5px solid var(--cloud-line);background:var(--surface);color:var(--ink);min-width:220px;max-width:100%}
.grid{max-width:1120px;margin-inline:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--cloud-line);border-radius:26px;box-shadow:var(--lift);overflow:hidden;display:grid;grid-template-rows:auto 1fr;color:inherit}
.card:hover{border-color:var(--accent)}
.card .ph{background:var(--cloud);aspect-ratio:4/3;position:relative;overflow:hidden}
.card .ph img{position:absolute;inset:10px;width:calc(100% - 20px);height:calc(100% - 20px);object-fit:contain}
.card .bd{padding:18px 20px 22px;display:grid;gap:8px;align-content:start}
.card .tag{font-family:var(--f-mono);font-size:.74rem;color:var(--accent);letter-spacing:.02em}
.card h3{font-size:1.15rem;color:var(--head);line-height:1.3}
.card p{font-size:.93rem;line-height:1.55;color:var(--ink)}
.card .go{font-weight:700;color:var(--accent);font-size:.92rem;margin-top:4px}
.card .nt{font-size:.78rem;color:var(--muted)}
.empty{max-width:1120px;margin:20px auto 0;text-align:center;color:var(--muted);display:none}
.grow{max-width:760px;margin:36px auto 0;padding:18px 20px;border-radius:var(--r-sm);background:var(--cloud);border:1px solid var(--cloud-line);text-align:center;font-size:.95rem;line-height:1.6;color:var(--ink)}
.dock{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;transform:translateY(120%);transition:transform .45s var(--ease);pointer-events:none}
.dock.on{transform:none}.dock .btn{pointer-events:auto;box-shadow:0 10px 30px rgba(23,37,84,.25)}
@media (min-width:900px){.dock{display:none}}
.lang{display:inline-flex;gap:2px;padding:3px;border-radius:99px;background:var(--cloud);border:1px solid var(--cloud-line)}
.lang a{font-size:.74rem;font-weight:700;letter-spacing:.02em;padding:5px 8px;border-radius:99px;color:var(--muted);line-height:1}
.lang a[aria-current]{background:var(--surface);color:var(--head);box-shadow:0 1px 4px rgba(23,37,84,.12)}
.legal{max-width:780px;margin:0 auto;display:grid;gap:8px;font-size:.82rem;line-height:1.55;color:var(--muted)}
"""

T = {
 'id': dict(title='Produk Nu Skin dan Pharmanex pilihan Coach AJ · #transformwithST',
  desc='Daftar produk Nu Skin dan Pharmanex yang aku rekomendasikan, untuk Wellness dan Beauty. Tiap produk punya halaman penjelasan sendiri, dari label dan materi resminya.',
  kick='Pharmanex · Nu Skin', h1='Produk yang aku rekomendasikan',
  lede='Hanya produk Nu Skin dan Pharmanex, dibagi dua: Wellness dan Beauty. Tiap produk punya halaman sendiri dengan isi label asli, cara pakai, dan jawaban pertanyaan yang sering muncul.',
  meta='Dikelola Coach AJ, Distributor Nu Skin Resmi. Bukan situs resmi Nu Skin.',
  all='Semua', wellness='Wellness', beauty='Beauty', search='Cari produk', empty='Belum ada yang cocok. Coba kata lain, atau tanya aku lewat WhatsApp.',
  open='Buka halaman', grow='Daftar ini terus bertambah. Cari produk yang belum ada? Tanya lewat WhatsApp, aku bantu.',
  nav='Produk', wa='Chat di WhatsApp', about='Tentang AJ', wam='Halo {n}, aku lihat halaman produk dan mau tanya.',
  legal='Dikelola oleh {c}, Distributor Nu Skin Resmi. Bukan situs resmi Nu Skin.',
  foot='© #transformwithST. Konten edukasi, bukan nasihat medis. Hasil tiap orang beda-beda.', ogl='id_ID', path='/products/', home='/', ab='/transformwithAJ/', pv='/privacy/'),
 'en': dict(title='Nu Skin and Pharmanex products picked by Coach AJ · #transformwithST',
  desc='The Nu Skin and Pharmanex products I recommend, across Wellness and Beauty. Each product has its own page built from its real label and official material.',
  kick='Pharmanex · Nu Skin', h1='Products I recommend',
  lede='Only Nu Skin and Pharmanex products, in two groups: Wellness and Beauty. Each product has its own page with the real label contents, how to use it, and answers to the questions people ask most.',
  meta='Run by Coach AJ, an official Nu Skin distributor. Not the official Nu Skin site.',
  all='All', wellness='Wellness', beauty='Beauty', search='Search products', empty='Nothing matches yet. Try another word, or ask me on WhatsApp.',
  open='Open page', grow='This list keeps growing. Looking for a product that is not here yet? Ask on WhatsApp.',
  nav='Products', wa='Chat on WhatsApp', about='About AJ', wam='Hi {n}, I looked at the products page and have a question.',
  legal='Run by {c}, an official Nu Skin distributor. Not the official Nu Skin site.',
  foot='© #transformwithST. Educational content, not medical advice. Results differ from person to person.', ogl='en_US', path='/en/products/', home='/en/', ab='/en/transformwithAJ/', pv='/en/privacy/'),
}

def card(p, L):
    t = T[L]
    href = p.get('en_path', p['path']) if L == 'en' else p['path']
    note = p.get('en_note') if L == 'en' and href == p['path'] and p.get('en_note') else ''
    catname = t[p['cat']]
    hay = e((p['name'] + ' ' + p['id_line'] + ' ' + p['en_line'] + ' ' + p['brand'] + ' ' + p['cat']).lower())
    return (f'<a class="card" href="{e(href)}" data-cat="{p["cat"]}" data-h="{hay}">'
            f'<div class="ph"><img src="{e(p["img"])}" alt="{e(p["name"])}" loading="lazy"></div>'
            f'<div class="bd"><span class="tag">{e(p["brand"])} · {e(catname)}</span><h3>{e(p["name"])}</h3>'
            f'<p>{e(p[L + "_line"])}</p>' + (f'<span class="nt">{e(note)}</span>' if note else '') +
            f'<span class="go">{t["open"]} →</span></div></a>')

def build(L):
    t = T[L]
    cards = '\n'.join(card(p, L) for p in P)
    cur_id = '' if L == 'en' else ' aria-current="true"'
    cur_en = ' aria-current="true"' if L == 'en' else ''
    pl = ' data-page-lang="en"' if L == 'en' else ''
    url = 'https://alvacy.com' + t['path']
    doc = f'''<!doctype html>
<html lang="{L}"{pl}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!-- GENERATED by scripts/make_products.py from data/products.json. Add products there, then re-run the script. -->
<title>{e(t['title'])}</title>
<meta name="description" content="{e(t['desc'])}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="id" href="https://alvacy.com/products/">
<link rel="alternate" hreflang="en" href="https://alvacy.com/en/products/">
<link rel="alternate" hreflang="x-default" href="https://alvacy.com/products/">
<link rel="icon" href="/images/icon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="/images/icon-192.png?v=2" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v=2">
<meta name="theme-color" content="#1E3A8A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="#transformwithST">
<meta property="og:title" content="{e(t['h1'])}">
<meta property="og:description" content="{e(t['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://alvacy.com/images/{'og-en.png' if L == 'en' else 'og-id.png'}">
<meta property="og:locale" content="{t['ogl']}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Geist+Mono:wght@500&display=swap">
<script>document.documentElement.setAttribute('data-theme','light');</script>
<link rel="stylesheet" href="/assets/site.css?v=1793167738">
<link rel="stylesheet" href="/assets/palettes.css?v=1793167738">
<style>{CSS}</style>
</head>
<body>
<header class="site-top"><div class="wrap">
  <a class="logo" href="{t['path']}"><b>{t['nav']}</b></a>
  <nav class="site-nav">
    <span class="lang" role="group" aria-label="Language"><a href="/products/" hreflang="id" lang="id"{cur_id}>ID</a><a href="/en/products/" hreflang="en" lang="en"{cur_en}>EN</a></span>
    <a class="btn small primary js-wa" href="https://wa.me/628170241185">WhatsApp</a>
  </nav>
</div></header>
<main>
<div class="hero-wrap"><div class="hero">
  <p class="kicker">{t['kick']}</p>
  <h1>{e(t['h1'])}</h1>
  <p class="lede">{e(t['lede'])}</p>
  <p class="meta">{e(t['meta'])}</p>
</div></div>
<section><div class="wrap">
  <div class="tools">
    <div class="chips" id="chips"><button type="button" data-c="all" aria-pressed="true">{t['all']}</button><button type="button" data-c="wellness" aria-pressed="false">{t['wellness']}</button><button type="button" data-c="beauty" aria-pressed="false">{t['beauty']}</button></div>
    <input class="q" id="q" type="search" placeholder="{t['search']}" aria-label="{t['search']}">
  </div>
  <div class="grid" id="grid">
{cards}
  </div>
  <p class="empty" id="empty">{e(t['empty'])}</p>
  <p class="grow">{e(t['grow'])}</p>
</div></section>
</main>
<footer class="site-foot"><div class="wrap">
  <div class="legal"><p>{t['legal'].format(c='<span class="cn">Coach AJ</span>')}</p></div>
  <nav><a href="{t['home']}">#transformwithST</a><a class="js-about" href="{t['ab']}">{t['about']}</a><a href="{t['pv']}">Privacy Policy</a></nav>
  <span>{e(t['foot'])}</span>
</div></footer>
<div class="dock"><a class="btn primary js-wa" href="https://wa.me/628170241185"><span>{t['wa']}</span></a></div>
<script src="/data/coaches.js"></script>
<script src="/assets/site.js?v=1793167738"></script>
<script>
(function(){{
  var d=document.querySelector('.dock');function f(){{d.classList.toggle('on',scrollY>360)}}addEventListener('scroll',f,{{passive:true}});f();
  document.querySelectorAll('.lang a').forEach(function(a){{a.addEventListener('click',function(){{try{{localStorage.setItem('csb-lang',a.lang)}}catch(e){{}}}})}});
  var MSG={json.dumps(t['wam'])};
  function who(){{var c=window.ALV&&ALV.coach&&ALV.coach();if(!c)return;
    document.querySelectorAll('.js-wa').forEach(function(a){{a.href='https://wa.me/'+c.wa+'?text='+encodeURIComponent(MSG.replace('{{n}}',c.name))}});
    document.querySelectorAll('.cn').forEach(function(n){{n.textContent=c.name}});
    var aj=ALV.coachCode()==='aj';document.querySelectorAll('.js-about').forEach(function(a){{a.hidden=!aj}});}}
  who();addEventListener('hashchange',who);
  var cat='all',cards=[].slice.call(document.querySelectorAll('.card')),q=document.getElementById('q'),em=document.getElementById('empty');
  function apply(){{var s=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){{var ok=(cat==='all'||c.dataset.cat===cat)&&(!s||c.dataset.h.indexOf(s)>-1);c.hidden=!ok;if(ok)n++}});em.style.display=n?'none':'block'}}
  document.getElementById('chips').addEventListener('click',function(ev){{var b=ev.target.closest('button');if(!b)return;cat=b.dataset.c;
    this.querySelectorAll('button').forEach(function(x){{x.setAttribute('aria-pressed',x===b?'true':'false')}});apply()}});
  q.addEventListener('input',apply);
}})();
</script>
</body>
</html>
'''
    out = ROOT / ('en/products/index.html' if L == 'en' else 'products/index.html')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding='utf-8')
    print('wrote', out.relative_to(ROOT))

for L in ('id', 'en'):
    build(L)
