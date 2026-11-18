# QuickBill — Receipt Maker and Bill Maker

- **Live site:** https://billmaker.pixara.in
- **Repository:** https://github.com/mrinalkumardey/billgenerator
- **Hosting:** GitHub Pages, `main` branch, repository root (no build step)

The Bill tab is shown by default; the Quick Receipt tab is one click away.

## Deployed files

| File | Purpose |
| --- | --- |
| `index.html` | The merged bill + receipt tool (all forms, previews, export logic) |
| `bill.html` | Redirect stub for old links → `/#bill` (noindex + canonical) |
| `geo.js`, `logo.js` | Currency/region helper and logo helper |
| `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Icons |
| `og-image.png` | Social sharing image (1376×768) |
| `site.webmanifest` | PWA manifest |
| `robots.txt`, `sitemap.xml` | Crawler instructions |
| `CNAME` | Custom domain for GitHub Pages (`billmaker.pixara.in`) |
| `.nojekyll` | Skips Jekyll processing so files are served as-is |

`_backup/` (original pre-merge pages) and `tools/` (local validator) are not needed by the site.

## Deploying updates

```bash
git add -A
git commit -m "Describe the change"
git push
```

GitHub Pages rebuilds automatically from `main`.

## First-time GitHub Pages setup

1. Repo → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch**.
2. Branch: **main**, folder: **/(root)** → **Save**.
3. Custom domain is already set by the `CNAME` file: `billmaker.pixara.in`.
4. At your DNS provider add:
   - **CNAME** — host `billmaker` → target `mrinalkumardey.github.io`
5. Once GitHub issues the certificate, tick **Enforce HTTPS**.
6. Check `https://billmaker.pixara.in/` and `https://billmaker.pixara.in/bill.html` (should redirect to `/#bill`).

## SEO status

- Canonical, hreflang, Open Graph, Twitter card and JSON-LD all use `https://billmaker.pixara.in`.
- `robots.txt` points at `https://billmaker.pixara.in/sitemap.xml`; the sitemap lists the home page.
- Submit the sitemap in Google Search Console and Bing Webmaster Tools after the domain is live.
- If the domain ever changes, update `index.html`, `bill.html`, `robots.txt`, `sitemap.xml` and `CNAME`.
- Optional: export a 1200×630 Open Graph image for ideal social previews.
- Optional: delete the unused `og-image.png.png`, `apple-touch-icon.png.png` and `assets/` folder.

## URLs

- `/` or `/#bill` → Bill / tax invoice maker (default)
- `/#receipt` → Quick cash receipt
- Deep links work on load and update the address bar without reloading.

## Local checks

```bash
node tools/validate.js
```

Verifies unique IDs, ARIA references, script-to-DOM references, JSON-LD, inline JavaScript syntax, HTML tag balance, one `<h1>`, and that every referenced asset exists.
