#!/usr/bin/env python3
"""Generate the bilingual LifePak page from scripts/lifepak/page.tpl.html + page.css.
Pairs in the template are written as ⟦indonesian‖english⟧. Run: python3 scripts/make_lifepak.py
Writes lifepak/index.html (ID) and en/lifepak/index.html (EN). Not part of build.py PAGES."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / 'scripts' / 'lifepak'
tpl = (D / 'page.tpl.html').read_text(encoding='utf-8')
css = (D / 'page.css').read_text(encoding='utf-8').strip()
PAIR = re.compile(r'⟦(.*?)‖(.*?)⟧', re.S)

def build(lang):
    en = lang == 'en'
    s = tpl.replace('{{CSS}}', css)
    s = PAIR.sub(lambda m: m.group(2 if en else 1), s)
    rep = {
        '{{PAGELANG}}': ' data-page-lang="en"' if en else '',
        '{{PATH}}': '/en/lifepak/' if en else '/lifepak/',
        '{{CUR_ID}}': '' if en else ' aria-current="true"',
        '{{CUR_EN}}': ' aria-current="true"' if en else '',
        '{{TESTPATH}}': '/en/test/' if en else '/test/',
        '{{HOMEPATH}}': '/en/' if en else '/',
        '{{ABOUTPATH}}': '/en/transformwithAJ/' if en else '/transformwithAJ/',
        '{{PRIVACYPATH}}': '/en/privacy/' if en else '/privacy/',
    }
    for k, v in rep.items():
        s = s.replace(k, v)
    assert '{{' not in s and '⟦' not in s and '‖' not in s, 'unreplaced marker'
    out = ROOT / ('en/lifepak/index.html' if en else 'lifepak/index.html')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(s, encoding='utf-8')
    print('wrote', out.relative_to(ROOT), len(s))

for l in ('id', 'en'):
    build(l)
