#!/usr/bin/env python3
"""Generate /en/transformwithAJ/ and /zh/transformwithAJ/ from the Indonesian source page.
Source of truth: transformwithAJ/index.html. Translations: scripts/aj_i18n.json (keyed by source string).
Run: python3 scripts/build_aj.py"""
import re, json, os
from urllib.parse import urlparse, parse_qs, quote
from bs4 import BeautifulSoup, NavigableString, Comment, Doctype

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'transformwithAJ', 'index.html')
TR = json.load(open(os.path.join(ROOT, 'scripts', 'aj_i18n.json'), encoding='utf-8'))

LANGS = {
 'en': dict(html='en', loc='en_US', dec='.', rl='en', wpm=285, cjk=False, hreflang='en',
   ch=['Story','Six paths','What ages','TRMe','Coaching','Results','Chat'],
   start='Start · 7 parts · <span>± {n} min</span>', step='<b>{i} of 7</b> · {ch}{last} <span>· {t}</span>',
   last=' · last part', end="You're at the end", lt1='almost done', rem='± {n} min left'),
 'zh': dict(html='zh-Hans', loc='zh_CN', dec='.', rl='zh', wpm=460, cjk=True, hreflang='zh-Hans',
   ch=['故事','六条路','什么在老化','TRMe','教练','成果','聊聊'],
   start='开始 · 共7部分 · <span>约 {n} 分钟</span>', step='<b>第 {i}/7 部分</b> · {ch}{last} <span>· {t}</span>',
   last=' · 最后一部分', end='已读完', lt1='快读完了', rem='还剩约 {n} 分钟'),
}
SKIP = ('script', 'style', 'svg', 'noscript')

def skip(el):
    return any(p.name in SKIP for p in el.parents)

def dec(s, d):
    return re.sub(r'(?<=\d),(?=\d)', d, s) if d != ',' else s

def build(code):
    L = LANGS[code]; tr = TR[code]
    soup = BeautifulSoup(open(SRC, encoding='utf-8').read(), 'html.parser')
    def t(s):
        k = re.sub(r'\s+', ' ', s.strip())
        return tr.get(k) or dec(k, L['dec'])
    for n in list(soup.find_all(string=True)):
        if isinstance(n, (Comment, Doctype)) or n.parent.name in SKIP or skip(n): continue
        raw = str(n); k = raw.strip()
        if not k: continue
        lead = raw[:len(raw) - len(raw.lstrip())]; trail = raw[len(raw.rstrip()):]
        n.replace_with(NavigableString(lead + t(k) + trail))
    for el in soup.find_all(True):
        if el.name == 'svg' or skip(el): pass
        else:
            for a in ('alt', 'aria-label', 'title', 'placeholder'):
                if el.has_attr(a): el[a] = t(el[a])
        if el.name == 'meta' and el.get('content') and (el.get('name') == 'description' or el.get('property') in ('og:title', 'og:description')):
            el['content'] = t(el['content'])
        if el.name == 'a':
            h = el.get('href', '')
            if h.startswith('https://wa.me'):
                u = urlparse(h); q = parse_qs(u.query).get('text', [''])[0]
                el['href'] = 'https://wa.me%s?text=%s' % (u.path, quote(t(q), safe=''))
            elif h.startswith('/aj/'):
                el['href'] = '/en/test/?utm_source=profil-aj&utm_medium=halaman#aj'
            elif h == '/privacy/':
                el['href'] = '/en/privacy/'
            elif h == '/':
                el['href'] = '/en/'
    soup.title.string = t(soup.title.string)
    html = soup.find('html'); html['lang'] = L['html']; html['data-page-lang'] = 'en' if code == 'en' else code
    url = 'https://alvacy.com/%s/transformwithAJ/' % code
    soup.find('link', rel='canonical')['href'] = url
    for m in soup.find_all('meta', property='og:url'): m['content'] = url
    for m in soup.find_all('meta', property='og:locale'): m['content'] = L['loc']
    for a in soup.select('.lang a'):
        if a.get('hreflang') == L['hreflang']: a['aria-current'] = 'true'
        elif a.has_attr('aria-current'): del a['aria-current']
    cfg = json.dumps({k: L[k] for k in ('rl', 'dec', 'wpm', 'cjk', 'ch', 'start', 'step', 'last', 'end', 'lt1', 'rem')}, ensure_ascii=False)
    out = str(soup)
    out = out.replace('<script src="/data/coaches.js"></script>', '<script>window.TWA_I18N=%s;</script>\n<script src="/data/coaches.js"></script>' % cfg, 1)
    d = os.path.join(ROOT, code, 'transformwithAJ'); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(out)
    # report leftovers that still look Indonesian
    ID = re.compile(r"\b(yang|dan|untuk|dengan|kamu|aku|tidak|dari|sampai|bukan|karena|sudah|kalau|pada|badan|hasil)\b", re.I)
    left = [x for x in re.findall(r'>([^<>]{12,})<', re.sub(r'<(script|style)[\s\S]*?</\1>', '', out)) if ID.search(x)]
    print(code, 'written', len(out), 'bytes; leftover-indonesian:', len(left)); [print('  ', x[:100]) for x in left[:15]]

if __name__ == '__main__':
    for c in LANGS: build(c)
