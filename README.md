# alvacy

Website for #transformwithST, served by GitHub Pages at https://alvacy.com

- `index.html` — landing page. `test/` — Body Age Assessment (30-question quiz with lead form). `tools/` — Transform Toolkit (Padang, drink sugar, protein). `privacy/` — privacy policy.
- Coach links: add `#code` (e.g. `#aj`) to any page; coaches are configured in `COACHES` in `assets/site.js`. `aj/` is the short link alvacy.com/aj. `body-age/` is a readable short link to `test/` for AJ's Threads bio (tags the visit as source threads, coach aj).
- `transformwithAJ/` — AJ's personal profile page (alvacy.com/transformwithAJ). Hand-written, not in `PAGES`, so the build never touches it; `noindex` for now. Share image: `images/og-aj-profil.png`. `404.html` sends a lowercase `/transformwithaj` to it.
- `images/` — coach photos, icons and share images (`og-id.png`, `og-en.png`). `CNAME` — custom domain.

## Search (SEO) build

Pages fill in their text with JavaScript, so `scripts/build.py` renders each page in headless
Chromium and writes the text into the HTML, which is what Google reads. It also generates:

- `en/` — the English pages (Indonesian lives at `/`). **Generated: never edit by hand.**
- the `<head>` tags between `<!-- seo:start -->` and `<!-- seo:end -->` (titles, descriptions,
  canonical, hreflang, share preview, structured data). Change titles and descriptions in `PAGES` in the script.
- `sitemap.xml` and `robots.txt`.

Workflow: edit the Indonesian source pages (both languages' text lives in their `T`/`UI` objects),
then run `python3 scripts/build.py` (needs `pip install playwright pillow` and
`python -m playwright install chromium`). The GitHub Action in `.github/workflows/build.yml` also runs it
on every push to `main` and commits the result. `python3 scripts/build.py --images` redraws icons and share images.

Rules for source pages: link to assets and images as `/assets/...` and `/images/...` (root-absolute);
link between pages relatively (`test/`, `../privacy/`) so English pages link to English pages.
