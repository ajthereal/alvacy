#!/usr/bin/env python3
"""Build the search-friendly version of alvacy.com.

Every page fills in its text with JavaScript, so a search engine reading the raw HTML
sees almost nothing. This script opens each page in headless Chromium, takes the text
it renders, and writes it straight into the HTML. It also:

  * generates the English copies under /en/ (Indonesian stays at /),
  * writes the <head> tags between <!-- seo:start --> and <!-- seo:end -->
    (title, description, canonical, hreflang, share preview, structured data),
  * writes sitemap.xml and robots.txt.

Edit the Indonesian source pages (index.html, tools/, test/, privacy/) and the PAGES
table below, then run:   python3 scripts/build.py
Never edit files in /en/ by hand: they are overwritten on every build.
The GitHub Action in .github/workflows/build.yml runs this automatically on push.

Share images and icons:   python3 scripts/build.py --images
"""
import functools
import html
import http.server
import json
import re
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://alvacy.com'

PAGES = [
    {
        'path': '', 'kind': 'home',
        'id': {'title': 'Alvacy · Cek Umur Badan Gratis & Program Sehat 90 Hari',
               'desc': 'Buat kamu yang 35+ dan super sibuk: cek umur badan gratis, tools makan sehari-hari, dan program 90 hari bareng coach.'},
        'en': {'title': 'Alvacy · Free Body Age Check & 90-Day Coaching',
               'desc': 'For busy professionals 35+: a free body age check, everyday eating tools, and a 90-day program with a coach.'},
    },
    {
        'path': 'test/', 'kind': 'test',
        'id': {'title': 'Cek Umur Badan Gratis, 3 Menit · Body Age Assessment · Alvacy',
               'desc': 'Berapa umur badan kamu sebenarnya? 30 pertanyaan singkat, 3 menit, gratis. Lihat area mana yang paling nahan progress kamu.'},
        'en': {'title': 'Free Body Age Assessment, 3 Minutes · Alvacy',
               'desc': 'How old is your body, really? 30 quick questions, 3 minutes, free. See which area is holding your progress back.'},
    },
    {
        'path': 'tools/', 'kind': 'tools',
        'id': {'title': 'Kalkulator Kalori Nasi Padang, Gula Minuman & Protein · Alvacy',
               'desc': 'Kalkulator gratis: hitung kalori nasi Padang dan pesan yang lebih ringan, audit gula dari minuman, dan target protein harian kamu.'},
        'en': {'title': 'Nasi Padang Calorie Calculator, Drink Sugar & Protein · Alvacy',
               'desc': 'Free calculators: count the calories in nasi Padang and order lighter, audit the sugar in your drinks, and find your daily protein target.'},
    },
    {
        'path': 'kalori/', 'kind': 'calc',
        'id': {'title': 'Kalkulator Kalori Harian untuk Turun Berat Badan · Alvacy',
               'desc': 'Hitung kebutuhan kalori harian, target protein, dan kapan kamu sampai berat target. Gratis, pace aman, pakai rumus Mifflin-St Jeor.'},
        'en': {'title': 'Weight Loss Calorie Calculator & Goal Date · Alvacy',
               'desc': 'Work out your daily calories, protein target, and when you could reach your goal weight. Free, safe pace, Mifflin-St Jeor equation.'},
    },
    {
        # Not branded Alvacy, not in the sitemap, and told to stay out of search until it holds real results.
        # Remove 'noindex' (and add a link from the home page) once real before/after photos are in place.
        'path': 'transform/', 'kind': 'results', 'brand': '#transformwithST', 'noindex': True,
        'og': 'og-transform',
        'id': {'title': '#transformwithST · Hasil Nyata Sebelum dan Sesudah',
               'desc': 'Foto sebelum dan sesudah dari orang-orang yang menjalani program 90 hari, lengkap dengan angka dan cerita mereka sendiri.'},
        'en': {'title': '#transformwithST · Real Before and After Results',
               'desc': 'Before and after photos from people who did the 90-day program, with their numbers and their own words.'},
    },
    {
        'path': 'privacy/', 'kind': 'privacy',
        'id': {'title': 'Kebijakan Privasi · Alvacy',
               'desc': 'Bagaimana Alvacy mengumpulkan, memakai, dan menjaga data kamu.'},
        'en': {'title': 'Privacy Policy · Alvacy',
               'desc': 'How Alvacy collects, uses, and protects your data.'},
    },
]

LOCALE = {'id': 'id_ID', 'en': 'en_US'}
SEO_RE = re.compile(r'<!-- seo:start.*?<!-- seo:end -->\n?', re.S)


def url(lang, path):
    return f"{SITE}/{'en/' if lang == 'en' else ''}{path}"


def src_file(path):
    return ROOT / path / 'index.html'


def out_file(lang, path):
    return ROOT / ('en' if lang == 'en' else '') / path / 'index.html'


def make_en_copy(text):
    """Indonesian source -> English copy one folder deeper.
    Page links stay relative (so they lead to the English pages); assets and images
    must be written as /assets/... and /images/... in the source pages."""
    return text.replace('<html lang="id">', '<html lang="en" data-page-lang="en">', 1)


def schema(page, lang, faq):
    t = page[lang]
    u = url(lang, page['path'])
    graph = []
    if page['kind'] == 'home':
        graph.append({'@type': 'Organization', '@id': f'{SITE}/#org', 'name': 'Alvacy', 'url': f'{SITE}/',
                      'logo': f'{SITE}/images/icon-512.png'})
        graph.append({'@type': 'WebSite', '@id': f'{SITE}/#website', 'name': 'Alvacy', 'url': f'{SITE}/',
                      'inLanguage': ['id', 'en'], 'publisher': {'@id': f'{SITE}/#org'}})
    webpage = {'@type': 'WebPage', 'url': u, 'name': t['title'], 'description': t['desc'], 'inLanguage': lang}
    if 'brand' not in page:  # pages with their own brand are not part of the Alvacy website entity
        webpage['isPartOf'] = {'@id': f'{SITE}/#website'}
    graph.append(webpage)
    if page['kind'] in ('tools', 'test', 'calc'):
        name = {'tools': 'Transform Toolkit', 'test': 'Body Age Assessment', 'calc': 'Kalkulator Kalori Alvacy'}[page['kind']]
        graph.append({'@type': 'WebApplication', 'name': name, 'url': u, 'description': t['desc'],
                      'applicationCategory': 'HealthApplication', 'operatingSystem': 'Any', 'inLanguage': lang,
                      'isAccessibleForFree': True,
                      'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'IDR'}})
    if faq and page['kind'] in ('home', 'test', 'calc'):  # tools/ uses <details> for its source list, not a FAQ
        graph.append({'@type': 'FAQPage', 'url': u, 'inLanguage': lang, 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]})
    data = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=1)
    return data.replace('</', '<\\/')


def head_block(page, lang, faq):
    t = page[lang]
    e = lambda s: html.escape(s, quote=True)
    p = page['path']
    other = 'id' if lang == 'en' else 'en'
    lines = [
        '<!-- seo:start (written by scripts/build.py: change titles and descriptions in PAGES there) -->',
        f'<title>{e(t["title"])}</title>',
        f'<meta name="description" content="{e(t["desc"])}">',
        f'<link rel="canonical" href="{url(lang, p)}">',
        f'<link rel="alternate" hreflang="id" href="{url("id", p)}">',
        f'<link rel="alternate" hreflang="en" href="{url("en", p)}">',
        f'<link rel="alternate" hreflang="x-default" href="{url("id", p)}">',
        '<link rel="icon" href="/images/icon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/images/icon-192.png" sizes="192x192" type="image/png">',
        '<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">',
        '<meta name="theme-color" content="#1E3A8A">',
        *(['<meta name="robots" content="noindex, nofollow">'] if page.get('noindex') else []),
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{e(page.get("brand", "Alvacy"))}">',
        f'<meta property="og:title" content="{e(t["title"])}">',
        f'<meta property="og:description" content="{e(t["desc"])}">',
        f'<meta property="og:url" content="{url(lang, p)}">',
        f'<meta property="og:image" content="{SITE}/images/{page.get("og", "og")}-{lang}.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:locale" content="{LOCALE[lang]}">',
        f'<meta property="og:locale:alternate" content="{LOCALE[other]}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<script type="application/ld+json">\n{schema(page, lang, faq)}\n</script>',
        '<!-- seo:end -->',
    ]
    return '\n'.join(lines) + '\n'


def set_head(text, block):
    if SEO_RE.search(text):
        return SEO_RE.sub(lambda m: block, text, count=1)
    text = re.sub(r'<title>.*?</title>\n?', '', text, count=1, flags=re.S)
    text = re.sub(r'<meta name="description"[^>]*>\n?', '', text, count=1)
    m = re.search(r'<meta name="viewport"[^>]*>\n', text)
    return text[:m.end()] + block + text[m.end():]


def set_body(text, rendered):
    """Replace everything between <body> and the first <script> with the rendered markup."""
    m = re.search(r'<body[^>]*>', text)
    s = text.index('<script', m.end())
    return text[:m.end()] + '\n' + rendered.strip() + '\n\n' + text[s:]


SNAPSHOT_JS = r"""() => {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let out = '';
  for (const n of document.body.childNodes) {
    if (n.nodeType === 1 && n.tagName === 'SCRIPT') break;
    if (n.nodeType === 1) out += n.outerHTML; else if (n.nodeType === 3) out += esc(n.textContent);
  }
  const faq = [...document.querySelectorAll('.faq details')].map(d => {
    const s = d.querySelector('summary'); if (!s) return null;
    const a = [...d.children].filter(c => c !== s).map(c => c.textContent.trim()).join(' ').trim();
    return a ? [s.textContent.trim(), a] : null;
  }).filter(Boolean);
  return {body: out, faq};
}"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


def render(browser, base, lang, path):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Only local files: no fonts, no lead logging, no tracking during the build.
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base) else r.abort())
    page.goto(f"{base}/{'en/' if lang == 'en' else ''}{path}", wait_until='load')
    page.wait_for_timeout(400)
    snap = page.evaluate(SNAPSHOT_JS)
    ctx.close()
    if errors:
        raise SystemExit(f'JavaScript error on {lang}/{path}: {errors}')
    return snap


def build():
    httpd, base = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for page in PAGES:
            path = page['path']
            source = src_file(path).read_text(encoding='utf-8')
            # English copy first, from the current Indonesian source.
            en = out_file('en', path)
            en.parent.mkdir(parents=True, exist_ok=True)
            en.write_text(make_en_copy(source), encoding='utf-8')
            for lang in ('id', 'en'):
                f = out_file(lang, path)
                snap = render(browser, base, lang, path)
                text = f.read_text(encoding='utf-8')
                text = set_body(text, snap['body'])
                text = set_head(text, head_block(page, lang, snap['faq']))
                f.write_text(text, encoding='utf-8')
                words = len(re.sub(r'<[^>]+>', ' ', snap['body']).split())
                print(f'  {url(lang, path):38} {words:5} words, {len(snap["faq"])} FAQ')
        browser.close()
    httpd.shutdown()
    write_sitemap()
    write_robots()


def write_sitemap():
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for page in PAGES:
        if page.get('noindex'):
            continue
        for lang in ('id', 'en'):
            rows.append(f'  <url>\n    <loc>{url(lang, page["path"])}</loc>')
            for alt in ('id', 'en'):
                rows.append(f'    <xhtml:link rel="alternate" hreflang="{alt}" href="{url(alt, page["path"])}"/>')
            rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url("id", page["path"])}"/>\n  </url>')
    rows.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(rows) + '\n', encoding='utf-8')


def write_robots():
    (ROOT / 'robots.txt').write_text(
        'User-agent: *\nDisallow: /apps-script/\nDisallow: /scripts/\n\n'
        f'Sitemap: {SITE}/sitemap.xml\n', encoding='utf-8')


# ---------- share images and icons (run with --images) ----------

ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1E3A8A"/>
<path d="M18 48 32 14l14 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M23.5 36h17" stroke="#F97316" stroke-width="6" stroke-linecap="round"/>
</svg>
"""

OG_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#1E3A8A;color:#fff;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;
display:grid;grid-template-columns:1fr 330px;gap:56px;align-items:center;padding:72px 80px;overflow:hidden;position:relative}
body:after{content:"";position:absolute;right:-140px;bottom:-200px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.06)}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px;letter-spacing:-.01em}
.brand svg{width:48px;height:48px}
h1{font-size:64px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin:34px 0 26px}
h1 em{font-style:normal;color:#FDBA74}
p{font-size:28px;opacity:.88;line-height:1.35}
.pill{display:inline-block;margin-top:34px;background:#F97316;color:#172554;font-weight:800;font-size:26px;padding:14px 26px;border-radius:999px}
.ph{position:relative;z-index:1}
.ph img{width:330px;height:330px;border-radius:36px;object-fit:cover;border:6px solid rgba(255,255,255,.18)}
.ph span{display:block;text-align:center;margin:16px -60px 0;white-space:nowrap;font-size:21px;opacity:.85}
</style></head><body>
<div><div class="brand">{icon}{brand}</div><h1>{h1}</h1><p>{p}</p><span class="pill">{cta}</span></div>
<div class="ph"><img src="{photo}"><span>{who}</span></div>
</body></html>"""

OG_TEXT = {
    'id': {'h1': 'Berapa umur badan kamu <em>sebenarnya?</em>',
           'p': 'Buat kamu yang 35+ dan super sibuk. Cek gratis, cuma 3 menit.',
           'cta': 'alvacy.com', 'who': 'Coach AJ · turun 18 kg dalam 90 hari'},
    'en': {'h1': 'How old is your body, <em>really?</em>',
           'p': 'For busy professionals 35+. Free check, just 3 minutes.',
           'cta': 'alvacy.com/en', 'who': 'Coach AJ · lost 18 kg in 90 days'},
    # #transformwithST share cards: their own brand, no Alvacy name or logo mark
    'transform-id': {'brand': '#transformwithST', 'h1': 'Mereka mulai dari titik yang <em>sama kayak kamu.</em>',
                     'p': 'Foto sebelum dan sesudah, lengkap dengan angka dan cerita mereka.',
                     'cta': 'Lihat hasilnya', 'who': 'AJ Jonathan Ong · turun 18,1 kg'},
    'transform-en': {'brand': '#transformwithST', 'h1': 'They started from the <em>same place you are.</em>',
                     'p': 'Before and after photos, with their numbers and their own words.',
                     'cta': 'See the results', 'who': 'AJ Jonathan Ong · lost 18.1 kg'},
}


def build_images():
    from PIL import Image
    img = ROOT / 'images'
    (img / 'icon.svg').write_text(ICON_SVG, encoding='utf-8')
    photo = 'coach-aj.jpg'
    card = img / '_og-card.html'
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 512, 'height': 512})
        pg.set_content(f'<body style="margin:0">{ICON_SVG.replace("<svg ", "<svg width=512 height=512 ", 1)}</body>')
        pg.screenshot(path=str(img / 'icon-512.png'), omit_background=True)
        for lang, t in OG_TEXT.items():
            pg = b.new_page(viewport={'width': 1200, 'height': 630})
            card.write_text(OG_HTML.replace('{icon}', '' if t.get('brand') else ICON_SVG)
                            .replace('{brand}', t.get('brand', 'Alvacy')).replace('{photo}', photo)
                            .replace('{h1}', t['h1']).replace('{p}', t['p']).replace('{cta}', t['cta'])
                            .replace('{who}', t['who']), encoding='utf-8')
            pg.goto(card.resolve().as_uri())
            pg.wait_for_timeout(200)
            pg.screenshot(path=str(img / f'og-{lang}.png'))
        b.close()
    card.unlink()
    big = Image.open(img / 'icon-512.png').convert('RGBA')
    big.resize((192, 192), Image.LANCZOS).save(img / 'icon-192.png', optimize=True)
    big.resize((180, 180), Image.LANCZOS).save(img / 'apple-touch-icon.png', optimize=True)
    big.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    for lang in OG_TEXT:
        Image.open(img / f'og-{lang}.png').convert('RGB').save(img / f'og-{lang}.png', optimize=True)
    print('  icons and share images written to images/')


if __name__ == '__main__':
    if '--images' in sys.argv:
        build_images()
    build()
