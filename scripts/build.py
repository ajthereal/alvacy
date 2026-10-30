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
ASSET_V = '2'  # bump when share images or icons change, so WhatsApp and browsers fetch the new ones

PAGES = [
    {
        'path': '', 'kind': 'home',
        'id': {'title': '#transformwithST · Cek Umur Badan Gratis & Program Sehat 90 Hari',
               'desc': 'Buat kamu yang 35+ dan super sibuk: cek umur badan gratis, tools makan sehari-hari, dan program 90 hari bareng coach.'},
        'en': {'title': '#transformwithST · Free Body Age Check & 90-Day Coaching',
               'desc': 'For busy professionals 35+: a free body age check, everyday eating tools, and a 90-day program with a coach.'},
    },
    {
        'path': 'test/', 'kind': 'test',
        'id': {'title': 'Cek Umur Badan Gratis, 3 Menit · Body Age Assessment · #transformwithST',
               'desc': 'Berapa umur badan kamu sebenarnya? 30-an pertanyaan singkat, 3 menit, gratis. Lihat area mana yang paling nahan progress kamu.'},
        'en': {'title': 'Free Body Age Assessment, 3 Minutes · #transformwithST',
               'desc': 'How old is your body, really? 30 quick questions, 3 minutes, free. See which area is holding your progress back.'},
    },
    {
        'path': 'tools/', 'kind': 'tools',
        'id': {'title': 'Kalkulator Kalori Nasi Padang, Gula Minuman & Protein · #transformwithST',
               'desc': 'Kalkulator gratis: hitung kalori nasi Padang dan pesan yang lebih ringan, audit gula dari minuman, dan target protein harian kamu.'},
        'en': {'title': 'Nasi Padang Calorie Calculator, Drink Sugar & Protein · #transformwithST',
               'desc': 'Free calculators: count the calories in nasi Padang and order lighter, audit the sugar in your drinks, and find your daily protein target.'},
    },
    {
        'path': 'lunch/', 'kind': 'lunch',
        'id': {'title': 'What’s For Lunch? Menu Makan Siang, Gojek & Client Dinner yang Lebih Ringan · #transformwithST',
               'desc': 'Pilih situasinya: makan siang kantor, pesan online, atau client dinner. Lihat menu mana yang paling aman, lengkap dengan kalori, protein, dan kalimat siap pesan. Gratis.'},
        'en': {'title': 'What’s For Lunch? Lighter Office, Delivery & Client Dinner Picks · #transformwithST',
               'desc': 'Pick your situation: office lunch, food delivery, or a client dinner. See which dishes are safest, with calories, protein, and the exact line to order. Free.'},
    },
    {
        'path': 'kalori/', 'kind': 'calc',
        'id': {'title': 'Kalkulator Kalori Harian untuk Turun Berat Badan · #transformwithST',
               'desc': 'Hitung kebutuhan kalori harian, target protein, dan kapan kamu sampai berat target. Gratis, pace aman, pakai rumus Mifflin-St Jeor.'},
        'en': {'title': 'Weight Loss Calorie Calculator & Goal Date · #transformwithST',
               'desc': 'Work out your daily calories, protein target, and when you could reach your goal weight. Free, safe pace, Mifflin-St Jeor equation.'},
    },
    {
        # Not branded #transformwithST, not in the sitemap, and told to stay out of search until it holds real results.
        # Remove 'noindex' (and add a link from the home page) once real before/after photos are in place.
        'path': 'transform/', 'kind': 'results', 'brand': '#transformwithST', 'noindex': True,
        'og': 'og-transform',
        'id': {'title': '#transformwithST · Hasil Nyata Sebelum dan Sesudah',
               'desc': 'Foto sebelum dan sesudah para coach #transformwithST, lengkap dengan angka dan cerita mereka sendiri.'},
        'en': {'title': '#transformwithST · Real Before and After Results',
               'desc': 'Before and after photos of the #transformwithST coaches, with their numbers and their own words.'},
    },
    {
        'path': 'privacy/', 'kind': 'privacy',
        'id': {'title': 'Kebijakan Privasi · #transformwithST',
               'desc': 'Bagaimana #transformwithST mengumpulkan, memakai, dan menjaga data kamu.'},
        'en': {'title': 'Privacy Policy · #transformwithST',
               'desc': 'How #transformwithST collects, uses, and protects your data.'},
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
        graph.append({'@type': 'Organization', '@id': f'{SITE}/#org', 'name': '#transformwithST', 'url': f'{SITE}/',
                      'logo': f'{SITE}/images/icon-512.png'})
        graph.append({'@type': 'WebSite', '@id': f'{SITE}/#website', 'name': '#transformwithST', 'url': f'{SITE}/',
                      'inLanguage': ['id', 'en'], 'publisher': {'@id': f'{SITE}/#org'}})
    webpage = {'@type': 'WebPage', 'url': u, 'name': t['title'], 'description': t['desc'], 'inLanguage': lang}
    if 'brand' not in page:  # pages with their own brand are not part of the #transformwithST website entity
        webpage['isPartOf'] = {'@id': f'{SITE}/#website'}
    graph.append(webpage)
    if page['kind'] in ('tools', 'test', 'calc', 'lunch'):
        name = {'tools': 'Transform Toolkit', 'test': 'Body Age Assessment', 'calc': 'Kalkulator Kalori #transformwithST', 'lunch': 'What’s For Lunch?'}[page['kind']]
        graph.append({'@type': 'WebApplication', 'name': name, 'url': u, 'description': t['desc'],
                      'applicationCategory': 'HealthApplication', 'operatingSystem': 'Any', 'inLanguage': lang,
                      'isAccessibleForFree': True,
                      'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'IDR'}})
    if faq and page['kind'] in ('home', 'test', 'calc', 'lunch'):  # tools/ uses <details> for its source list, not a FAQ
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
        f'<link rel="icon" href="/images/icon.svg?v={ASSET_V}" type="image/svg+xml">',
        f'<link rel="icon" href="/images/icon-192.png?v={ASSET_V}" sizes="192x192" type="image/png">',
        f'<link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v={ASSET_V}">',
        '<meta name="theme-color" content="#1E3A8A">',
        *(['<meta name="robots" content="noindex, nofollow">'] if page.get('noindex') else []),
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{e(page.get("brand", "#transformwithST"))}">',
        f'<meta property="og:title" content="{e(t["title"])}">',
        f'<meta property="og:description" content="{e(t["desc"])}">',
        f'<meta property="og:url" content="{url(lang, p)}">',
        f'<meta property="og:image" content="{SITE}/images/{page.get("og", "og")}-{lang}.png?v={ASSET_V}">',
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


RESERVED = {'test', 'kalori', 'lunch', 'tools', 'privacy', 'transform', 'en', 'images', 'assets', 'scripts', 'apps-script', 'body-age', 'index',
            'join', 'data', 'tim', 'api', 'admin', 'coach', 'coaches', 'www', 'alvacy', 'github'}

COACH_LINK = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cek umur badan kamu · {name}</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="Cek umur badan kamu bareng {name}">
<meta property="og:description" content="30-an pertanyaan, 3 menit, gratis. Hasilnya dijelaskan langsung oleh {name}.">
<meta property="og:image" content="https://alvacy.com/images/og-id.png?v={ASSET_V}">
<meta name="twitter:card" content="summary_large_image">
<style>body{{margin:0;background:#F4F8FE;font-family:system-ui,sans-serif;color:#2B3A5E;display:grid;place-items:center;min-height:100vh}}a{{color:#2F55D4}}</style>
<script>
/* Short coach link (alvacy.com/{code}), generated by scripts/build.py from COACHES in assets/site.js. Do not edit by hand.
   Remembers the coach and where the visit came from, then opens the Body Age test.
   ?to=home opens the main page instead, ?to=hasil opens the results page, ?to=trme opens the TRMe product page. utm_* in the link wins over the guess below. */
(function(){{
  var CODE = '{code}', DEST = {{test: '../test/', home: '../', hasil: '../transform/', trme: '../trme/'}};
  var p = new URLSearchParams(location.search), to = p.get('to') || 'test';
  p.delete('to');
  var q = p.toString() ? '?' + p.toString() : '';
  var ref = '';
  try {{ ref = new URL(document.referrer).hostname.replace(/^www\\./, ''); if (ref === location.hostname) ref = ''; }} catch (e) {{}}
  try {{
    localStorage.setItem('alv-coach', CODE);
    if (!/utm_/.test(q)) localStorage.setItem('alv-src', JSON.stringify({{source: ref || 'link /' + CODE, medium: 'bio', campaign: '', content: '/' + CODE, landing: '/' + CODE}}));
  }} catch (e) {{}}
  location.replace((DEST[to] || DEST.test) + q + '#' + CODE);
}})();
</script>
</head>
<body><noscript><p><a href="../test/#{code}">Buka Body Age Assessment</a></p></noscript></body>
</html>
"""


def coach_codes():
    text = (ROOT / 'assets' / 'site.js').read_text(encoding='utf-8')
    return re.findall(r"^    (\w+): \{ name: '([^']+)'", text, flags=re.M)


def extra_coaches():
    """Coaches added through alvacy.com/join live in data/coaches.js (written by the Apps Script).
    A broken file or entry is reported and skipped, so it can never stop the build."""
    f = ROOT / 'data' / 'coaches.js'
    try:
        m = re.search(r'window\.ALV_EXTRA\s*=\s*(\{.*\})\s*;?\s*$', f.read_text(encoding='utf-8'), re.S)
        return json.loads(m.group(1)).get('coaches', [])
    except FileNotFoundError:
        return []
    except Exception as e:  # noqa: BLE001
        print(f'  WARNING: data/coaches.js could not be read ({e}); no /join coaches this build')
        return []


def write_coach_links():
    static = coach_codes()
    for code, name in static:
        if code in RESERVED:
            raise SystemExit(f"Coach code '{code}' clashes with a page or folder; pick another code in assets/site.js")
        d = ROOT / code
        d.mkdir(exist_ok=True)
        (d / 'index.html').write_text(COACH_LINK.format(code=code, name=name, ASSET_V=ASSET_V), encoding='utf-8')
        print(f'  https://alvacy.com/{code}/  ->  Body Age test, coach {name}')
    taken = {c for c, _ in static}
    for c in extra_coaches():
        code, name = str(c.get('code', '')), html.escape(str(c.get('name', '')), quote=True)
        if not re.fullmatch(r'[a-z0-9]{3,16}', code) or code in RESERVED or code in taken or not name:
            print(f'  WARNING: skipped /join coach {code!r} (bad code, name, or clash)')
            continue
        d = ROOT / code
        d.mkdir(exist_ok=True)
        (d / 'index.html').write_text(COACH_LINK.format(code=code, name=name, ASSET_V=ASSET_V), encoding='utf-8')
        print(f'  https://alvacy.com/{code}/  ->  Body Age test, coach {name} (joined via /join)')


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
    write_coach_links()


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
        'User-agent: *\nDisallow: /apps-script/\nDisallow: /scripts/\nDisallow: /join/\n\n'
        f'Sitemap: {SITE}/sitemap.xml\n', encoding='utf-8')


# ---------- share images and icons (run with --images) ----------

ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1E3A8A"/>
<path d="M11 34.25H17.71Q17.85 35.69 18.7 36.44Q19.55 37.2 20.91 37.2Q22.31 37.2 23.12 36.55Q23.93 35.91 23.93 34.77Q23.93 33.81 23.29 33.18Q22.64 32.56 21.7 32.15Q20.76 31.74 19.03 31.23Q16.53 30.46 14.94 29.68Q13.36 28.91 12.22 27.4Q11.07 25.89 11.07 23.46Q11.07 19.84 13.69 17.8Q16.31 15.76 20.51 15.76Q24.78 15.76 27.39 17.8Q30.01 19.84 30.19 23.49H23.38Q23.31 22.24 22.46 21.52Q21.61 20.8 20.28 20.8Q19.14 20.8 18.44 21.41Q17.74 22.02 17.74 23.16Q17.74 24.41 18.92 25.11Q20.1 25.81 22.61 26.62Q25.11 27.47 26.68 28.24Q28.24 29.02 29.38 30.49Q30.53 31.97 30.53 34.29Q30.53 36.5 29.4 38.3Q28.28 40.11 26.14 41.18Q24.01 42.24 21.09 42.24Q18.26 42.24 16.01 41.32Q13.76 40.4 12.42 38.6Q11.07 36.79 11 34.25ZM53 16.12V21.17H46.15V41.99H39.85V21.17H32.99V16.12Z" fill="#fff"/>
<rect x="11" y="47.5" width="42" height="5.5" rx="2.75" fill="#F97316"/>
</svg>"""

OG_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#172554;color:#fff;font-family:'Plus Jakarta Sans','Poppins','Segoe UI',Helvetica,Arial,sans-serif;overflow:hidden;position:relative;display:flex}
.p{position:relative;height:630px;overflow:hidden}
.p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.b{width:470px}
.b img{object-position:50% 20%;filter:saturate(.55) contrast(.95) brightness(.92)}
.a{width:730px}
.a img{object-position:50% 0}
.a:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,37,84,0) 38%,rgba(23,37,84,.92) 100%)}
.b:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,37,84,.35) 0%,rgba(23,37,84,0) 28%,rgba(23,37,84,0) 72%,rgba(23,37,84,.96) 100%)}
.tag{position:absolute;z-index:2;font-weight:800;font-size:22px;letter-spacing:.14em;text-transform:uppercase;padding:9px 18px;border-radius:999px}
.b .tag{left:32px;bottom:34px;background:rgba(255,255,255,.92);color:#172554}
.a .tag{right:36px;top:34px;background:#F97316;color:#fff}
.brand{position:absolute;z-index:2;left:32px;top:30px;font-weight:800;font-size:28px;letter-spacing:-.01em;text-shadow:0 2px 12px rgba(0,0,0,.45)}
.stat{position:absolute;z-index:2;left:60px;right:40px;bottom:36px}
.stat b{display:block;font-size:150px;line-height:.95;font-weight:800;letter-spacing:-.04em}
.stat b i{font-style:normal;color:#FDBA74;margin-right:6px}
.stat span{display:block;margin-top:12px;font-size:33px;font-weight:600;opacity:.95}
.arrow{position:absolute;z-index:3;left:470px;top:315px;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:#F97316;border:6px solid #172554;display:grid;place-items:center}
.arrow svg{width:40px;height:40px}
</style></head><body>
<div class="p b"><img src="{before}"><div class="brand">{brand}</div><span class="tag">{tb}</span></div>
<div class="p a"><img src="{after}"><span class="tag">{ta}</span><div class="stat"><b><i>&minus;</i>{kg}<small style="font-size:.5em;letter-spacing:-.01em"> kg</small></b><span>{line}</span></div></div>
<div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
</body></html>"""

OG_TEXT = {
    'id': {'brand': '#transformwithST', 'kg': '18', 'tb': 'Sebelum', 'ta': 'Sesudah',
           'line': 'dalam 90 hari, bareng coach'},
    'en': {'brand': '#transformwithST', 'kg': '18', 'tb': 'Before', 'ta': 'After',
           'line': 'in 90 days, with a coach'},
    # #transformwithST share cards: results page
    'transform-id': {'brand': '#transformwithST', 'kg': '18', 'tb': 'Sebelum', 'ta': 'Sesudah',
                     'line': 'dalam 90 hari, hasil nyata'},
    'transform-en': {'brand': '#transformwithST', 'kg': '18', 'tb': 'Before', 'ta': 'After',
                     'line': 'in 90 days, real results'},
}


def build_images():
    from PIL import Image
    img = ROOT / 'images'
    (img / 'icon.svg').write_text(ICON_SVG, encoding='utf-8')
    card = img / '_og-card.html'
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 512, 'height': 512})
        pg.set_content(f'<body style="margin:0">{ICON_SVG.replace("<svg ", "<svg width=512 height=512 ", 1)}</body>')
        pg.screenshot(path=str(img / 'icon-512.png'), omit_background=True)
        for lang, t in OG_TEXT.items():
            pg = b.new_page(viewport={'width': 1200, 'height': 630})
            html_ = OG_HTML
            for k, v in {**t, 'before': 'results/aj-before.jpg', 'after': 'results/aj-after.jpg'}.items():
                html_ = html_.replace('{' + k + '}', v)
            card.write_text(html_, encoding='utf-8')
            pg.goto(card.resolve().as_uri())
            pg.wait_for_timeout(400)
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
