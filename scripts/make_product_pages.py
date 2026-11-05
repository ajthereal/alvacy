#!/usr/bin/env python3
"""Generate the bilingual product pages (ID at /<slug>/, EN at /en/<slug>/) from the content modules in scripts/products/.
Reuses scripts/lifepak/page.css. Also writes an og image per product and updates data/products.json.
Run: python3 scripts/make_product_pages.py   then   python3 scripts/make_products.py
Content pairs are (indonesian, english) tuples; plain strings are shared by both languages."""
import sys, json, html, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from products import wellness, skincare

CSS = (ROOT / 'scripts' / 'lifepak' / 'page.css').read_text(encoding='utf-8').strip() + """
.hero .pimg{margin-top:clamp(4px,2vw,16px);max-height:420px;width:auto;max-width:min(100%,520px);object-fit:contain}
.hero .meta span span{display:inline;gap:0}.hero .meta span span::before{display:none}
.bl{list-style:none;display:grid;gap:9px;margin-top:10px}.bl li{position:relative;padding-left:20px;font-size:.93rem;line-height:1.5;color:var(--ink)}.bl li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:99px;background:var(--pop)}
.rel{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:6px}
.dl{display:grid;gap:12px;max-width:720px;margin-inline:auto}
.dl div{background:var(--cloud);border:1px solid var(--cloud-line);border-radius:20px;padding:16px 20px}
.dl b{display:block;color:var(--head);margin-bottom:4px}
.dl p{color:var(--ink);font-size:.95rem;line-height:1.6}
.knw{max-width:720px;margin:0 auto;display:grid;gap:12px}
.knw p{padding:14px 18px;border-radius:var(--r-sm);background:var(--cloud);border:1px solid var(--cloud-line);font-size:.95rem;line-height:1.6;color:var(--ink)}
.seealso{margin-top:26px;text-align:center;color:var(--muted);font-size:.9rem}
"""

E = html.escape
SUPP = {'g3', 'r2', 'youth', 'marineomega', 'reset'}


def short(x, n):
    if len(x) <= n:
        return x
    cut = x[:n]
    for sep in ('. ', ', ', ' '):
        k = cut.rfind(sep)
        if k > n * 0.55:
            return cut[:k].rstrip(',. ')
    return cut
ENTRIES = [(m, p) for m in (wellness, skincare) for p in m.PRODUCTS]
ALL = {p['slug']: p for _, p in ENTRIES}
EXTRA = {'lifepak': ('LifePak®', '/lifepak/', '/en/lifepak/')}
WA = 'https://wa.me/628170241185'


def P(x, en):
    return (x[1] if en else x[0]) if isinstance(x, tuple) else x


def build(p, en):
    t = lambda x: E(P(x, en))
    base = '/en' if en else ''
    path = f"{base}/{p['slug']}/"
    # sections
    nav = []
    sec = []
    sec.append(f'<section id="apa"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Apa itu", "What it is"))}</p><h2>{t(p["name"])}</h2></div>'
               f'<div class="prose reveal">{"".join("<p>" + t(x) + "</p>" for x in p["what"])}</div>'
               f'<div class="who reveal"><b>{t(p["who"][0])}</b><p>{t(p["who"][1])}</p></div></div></section>')
    nav.append(('#apa', ('Apa itu', 'What it is')))
    cards = ''.join(f'<article class="bc"><h3>{t(h)}</h3><ul>{"".join("<li>" + t(i) + "</li>" for i in items)}</ul></article>' for h, items in p['bens'])
    sec.append(f'<section id="manfaat" style="background:linear-gradient(var(--sky),transparent)"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Manfaat", "Benefits"))}</p><h2>{t(("Manfaat menurut materi resmi", "Benefits per the official material"))}</h2></div><div class="bens reveal">{cards}</div></div></section>')
    nav.append(('#manfaat', ('Manfaat', 'Benefits')))
    tc = ''.join(f'<article class="tc"><span class="n">{i + 1:02d}</span><h3>{t(h)}</h3><p>{t(x)}</p></article>' for i, (h, x) in enumerate(p['use']))
    sec.append(f'<section id="pakai"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Cara pakai", "How to use"))}</p><h2>{t(("Cara pakainya", "How to take or use it"))}</h2></div><div class="three reveal">{tc}</div></div></section>')
    nav.append(('#pakai', ('Cara pakai', 'How to use')))
    blocks = []
    for b in p['inside']:
        h = f'<h3>{t(b["h"])}</h3>'
        if b['kind'] == 'facts':
            rows = ''.join(f'<tr><th>{t(l)}</th><td>{t(v)}</td></tr>' for l, v in b['rows'])
            body = f'<table class="facts"><tbody>{rows}</tbody></table>' + (f'<p class="ing">{t(b["text"])}</p>' if b.get('text') else '')
        elif b['kind'] == 'list':
            body = '<ul class="bl">' + ''.join(f'<li>{t(i)}</li>' for i in b['items']) + '</ul>'
        else:
            body = f'<p class="ing">{t(b["text"])}</p>'
        blocks.append(f'<article class="pc"><div class="ph">{h}</div>{body}</article>')
    sec.append(f'<section id="isi" style="background:linear-gradient(var(--sky),transparent)"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Isinya", "Inside"))}</p><h2>{t(("Isinya, dari label dan materi resmi", "What is inside, from the label and official material"))}</h2></div><div class="pcs reveal">{"".join(blocks)}</div></div></section>')
    nav.append(('#isi', ('Isinya', 'Inside')))
    knw = ''.join(f'<p>{t(x)}</p>' for x in p['know'])
    sec.append(f'<section id="catatan"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Perlu diketahui", "Good to know"))}</p><h2>{t(("Sebelum mulai", "Before you start"))}</h2></div><div class="knw reveal">{knw}</div></div></section>')
    faq = ''.join(f'<details><summary>{t(q)}</summary><p>{t(a)}</p></details>' for q, a in p['faq'])
    rel = ''
    for s in p['links']:
        if s in ALL:
            nm, ip, ep = ALL[s]['name'], f"/{s}/", f"/en/{s}/"
        else:
            nm, ip, ep = EXTRA[s]
        rel += f'<a class="btn quiet" href="{ep if en else ip}">{E(nm)}</a>'
    sec.append(f'<section id="tanya"><div class="wrap"><div class="head reveal"><p class="kicker">{t(("Tanya jawab", "FAQ"))}</p><h2>{t(("Pertanyaan yang sering muncul", "Common questions"))}</h2></div><div class="faq reveal">{faq}</div>'
               f'<p class="seealso">{t(("Lihat juga", "See also"))}</p><div class="rel">{rel}</div></div></section>')
    nav.append(('#tanya', ('Tanya jawab', 'FAQ')))
    sec.append(f'<section><div class="wrap"><div class="cta reveal"><h2>{t(("Mau tanya soal ini?", "Questions about this?"))}</h2>'
               f'<p>{t(("Ceritakan kebutuhanmu. Aku jawab apa adanya. Aku bukan dokter, jadi untuk urusan medis aku arahkan ke dokter kamu.", "Tell me what you need and I will answer plainly. I am not a doctor, so for medical questions I will point you to yours."))}</p>'
               f'<div class="ctas"><a class="btn primary js-wa" href="{WA}"><span>Chat <span class="cn">Coach AJ</span> {t(("di WhatsApp", "on WhatsApp"))}</span></a>'
               f'<a class="btn quiet" href="{"/en" if en else ""}/test/?utm_source={p["slug"]}-page&amp;utm_medium=halaman">{t(("Cek body age gratis", "Free body age check"))}</a></div></div></div></section>')

    chips = ''.join(f'<span>{t(c)}</span>' for c in p['chips'])
    chips += f'<span>{t(("Cek ketersediaan di Indonesia lewat Coach AJ", "Check availability in Indonesia with Coach AJ"))}</span>'
    if p['slug'] in SUPP:
        p = dict(p, know=list(p['know']) + [('Pernyataan khasiat belum dievaluasi oleh badan pengawas obat dan makanan AS (FDA). Produk ini tidak dimaksudkan untuk mendiagnosis, mengobati, menyembuhkan atau mencegah penyakit.', 'These statements have not been evaluated by the US Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease.')])
        # rebuild the know section with the extra line
        knw2 = ''.join(f'<p>{t(x)}</p>' for x in p['know'])
        sec = [re.sub(r'(<div class="knw reveal">).*?(</div></div></section>)', lambda m: m.group(1) + knw2 + m.group(2), x, flags=re.S) if 'id="catatan"' in x else x for x in sec]
    navhtml = ''.join(f'<a href="{h}" class="hide-sm">{t(l)}</a>' for h, l in nav)
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": P(p['title'], en), "url": f"https://alvacy.com{path}",
          "inLanguage": 'en' if en else 'id', "description": P(p['desc'], en)}
    pre, post = (('Hi ', f", I just read the {p['name']} page. Can I ask a question?") if en else ('Halo ', f", aku baru baca halaman {p['name']}. Boleh tanya?"))
    src_h = 'Sumber' if not en else 'Source'
    out = f'''<!doctype html>
<html lang="{'en' if en else 'id'}"{' data-page-lang="en"' if en else ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!-- GENERATED by scripts/make_product_pages.py from scripts/products/*.py. Edit those, then run it. -->
<title>{E(short(P(p["title"], en), 60))}</title>
<meta name="description" content="{E(short(P(p["desc"], en), 158))}">
<link rel="canonical" href="https://alvacy.com{path}">
<link rel="alternate" hreflang="id" href="https://alvacy.com/{p['slug']}/">
<link rel="alternate" hreflang="en" href="https://alvacy.com/en/{p['slug']}/">
<link rel="alternate" hreflang="x-default" href="https://alvacy.com/{p['slug']}/">
<link rel="icon" href="/images/icon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="/images/icon-192.png?v=2" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v=2">
<meta name="theme-color" content="#1E3A8A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="#transformwithST">
<meta property="og:title" content="{E(short(P(p["title"], en), 60))}">
<meta property="og:description" content="{t(p["hub"])}">
<meta property="og:url" content="https://alvacy.com{path}">
<meta property="og:image" content="https://alvacy.com/images/products/og-{p['slug']}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{'en_US' if en else 'id_ID'}">
<meta property="og:locale:alternate" content="{'id_ID' if en else 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Geist+Mono:wght@500&display=swap">
<script>
document.documentElement.setAttribute('data-theme','light');
</script>
<link rel="stylesheet" href="/assets/site.css?v=1793167738">
<link rel="stylesheet" href="/assets/palettes.css?v=1793167738">
<style>
{CSS}
</style>
</head>
<body>

<header class="site-top"><div class="wrap">
  <a class="logo" href="{path}"><b>{E(p["name"])}</b></a>
  <nav class="site-nav">
    {navhtml}
    <span class="lang" role="group" aria-label="Language"><a href="/{p['slug']}/" hreflang="id" lang="id"{'' if en else ' aria-current="true"'}>ID</a><a href="/en/{p['slug']}/" hreflang="en" lang="en"{' aria-current="true"' if en else ''}>EN</a></span>
    <a class="btn small primary js-wa" href="{WA}">WhatsApp</a>
  </nav>
</div></header>

<main>
<div class="hero-wrap"><div class="hero">
  <p class="kicker">{E(p["brand"]) + (" · Nu Skin" if p["brand"] != "Nu Skin" else "")}</p>
  <h1>{t(p["h1"])}<small>{t(p["sub"])}</small></h1>
  <p class="lede">{t(p["lede"])}</p>
  <div class="ctas">
    <a class="btn primary" href="#manfaat">{t(("Lihat manfaatnya", "See the benefits"))}</a>
    <a class="btn quiet js-wa" href="{WA}"><span>{t(("Tanya", "Message"))} <span class="cn">Coach AJ</span></span></a>
  </div>
  <div class="meta"><span><span>{P(("Dikelola <b class=\"cn\">Coach AJ</b>, Distributor Nu Skin Resmi, bukan situs resmi Nu Skin", "Run by <b class=\"cn\">Coach AJ</b>, an official Nu Skin distributor, not the official Nu Skin site"), en)}</span></span>{chips}</div>
  <img class="pimg" src="{p['img']}" alt="{E(p["full"])}" width="520" height="420" fetchpriority="high">
</div></div>

{chr(10).join(sec)}
</main>

<footer class="site-foot"><div class="wrap">
  <div class="legal">
    <p>{src_h}: {t(p["src"])}</p>
    <p>{('Dikelola oleh <span class="cn">Coach AJ</span>, Distributor Nu Skin Resmi. Bukan situs resmi Nu Skin. Foto produk berasal dari Product Information Page Nu Skin.' if not en else 'Run by <span class="cn">Coach AJ</span>, an official Nu Skin distributor. Not the official Nu Skin site. Product photos come from the Nu Skin Product Information Page.')}</p>
  </div>
  <nav><a href="{'/en/' if en else '/'}">#transformwithST</a><a class="js-about" href="{'/en/transformwithAJ/' if en else '/transformwithAJ/'}">{t(("Tentang AJ", "About AJ"))}</a><a href="{'/en/privacy/' if en else '/privacy/'}">Privacy Policy</a></nav>
  <span>{t(("© #transformwithST. Konten edukasi, bukan nasihat medis. Suplemen dan perangkat tidak menggantikan pola makan seimbang atau perawatan dokter. Hasil tiap orang beda-beda. Kalau sedang hamil, menyusui, minum obat, atau punya kondisi medis, konsultasikan dengan dokter. Ketersediaan dan izin edar di Indonesia belum tentu sama dengan materi sumber, tanya aku dulu.", "© #transformwithST. Educational content, not medical advice. Supplements and devices do not replace a balanced diet or medical care. Results differ from person to person. If you are pregnant, nursing, on medication or have a medical condition, talk to your doctor. Availability and registration in Indonesia may differ from the source material, check with me first."))}</span>
</div></footer>

<div class="dock"><a class="btn primary js-wa" href="{WA}"><span>Chat <span class="cn">Coach AJ</span> {t(("di WhatsApp", "on WhatsApp"))}</span></a></div>

<script src="/data/coaches.js"></script>
<script src="/assets/site.js?v=1793167738"></script>
<script>
(function(){{
  var d=document.querySelector('.dock');function f(){{d.classList.toggle('on',scrollY>520)}}addEventListener('scroll',f,{{passive:true}});f();
  document.querySelectorAll('.lang a').forEach(function(a){{a.addEventListener('click',function(){{try{{localStorage.setItem('csb-lang',a.lang)}}catch(e){{}}}})}});
  function who(){{
    var c=window.ALV&&ALV.coach&&ALV.coach(); if(!c)return;
    var msg={json.dumps(pre)}+c.name+{json.dumps(post)};
    document.querySelectorAll('.js-wa').forEach(function(a){{a.href='https://wa.me/'+c.wa+'?text='+encodeURIComponent(msg)}});
    document.querySelectorAll('.cn').forEach(function(n){{n.textContent=c.name}});
    var aj=ALV.coachCode()==='aj';
    document.querySelectorAll('.js-about').forEach(function(a){{a.hidden=!aj}});
  }}
  who();addEventListener('hashchange',who);
}})();
</script>
</body>
</html>
'''
    f = ROOT / (f"en/{p['slug']}/index.html" if en else f"{p['slug']}/index.html")
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(out, encoding='utf-8')


def og(p):
    from PIL import Image
    W, H = 1200, 630
    bg = Image.new('RGB', (W, H), (234, 240, 250))
    im = Image.open(ROOT / p['img'].lstrip('/')).convert('RGBA')
    im.thumbnail((480, 520))
    bg.paste(im, (W - im.width - 90, (H - im.height) // 2), im)
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(bg)
    def font(sz, bold=True):
        for fp in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
            try:
                return ImageFont.truetype(fp, sz)
            except Exception:
                pass
        return ImageFont.load_default()
    name = p['name']
    words, lines, cur = name.split(), [], ''
    for w in words:
        if len(cur + ' ' + w) > 16 and cur:
            lines.append(cur); cur = w
        else:
            cur = (cur + ' ' + w).strip()
    lines.append(cur)
    y = 190
    for ln in lines:
        d.text((80, y), ln, fill=(23, 37, 84), font=font(60)); y += 76
    d.text((80, y + 14), '#transformwithST', fill=(30, 58, 138), font=font(30))
    out = ROOT / 'images' / 'products' / f"og-{p['slug']}.jpg"
    bg.save(out, quality=88)


def update_json():
    jp = ROOT / 'data' / 'products.json'
    data = json.loads(jp.read_text(encoding='utf-8'))
    have = {d['id'] for d in data}
    for m, p in ENTRIES:
        if p['slug'] in have:
            data = [d for d in data if d['id'] != p['slug']]
        cat = 'wellness' if m is wellness else 'beauty'
        data.append({"id": p['slug'], "added": "2026-11-05", "cat": cat, "brand": p['brand'] if p['brand'] != 'Nu Skin' else 'Nu Skin',
                     "path": f"/{p['slug']}/", "en_path": f"/en/{p['slug']}/", "img": p['img'], "name": p['name'],
                     "id_line": p['hub'][0], "en_line": p['hub'][1]})
    jp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    for _, p in ENTRIES:
        for en in (False, True):
            build(p, en)
        og(p)
        print('ok', p['slug'])
    update_json()
