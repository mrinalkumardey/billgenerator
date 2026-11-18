/* Development validator for the merged page (not part of the deployed site). */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
let problems = 0;
const fail = (msg) => { problems++; console.log('FAIL: ' + msg); };
const ok = (msg) => console.log('ok: ' + msg);

/* ---------- 1. IDs ---------- */
const idRe = /\sid="([^"]+)"/g;
const ids = [];
let m;
while ((m = idRe.exec(html))) ids.push(m[1]);
const counts = {};
ids.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
const dupes = Object.keys(counts).filter((k) => counts[k] > 1);
if (dupes.length) fail('duplicate ids: ' + dupes.join(', '));
else ok(ids.length + ' unique element ids');

/* ---------- 2. aria references ---------- */
for (const attr of ['aria-controls', 'aria-labelledby']) {
    const re = new RegExp(attr + '="([^"]+)"', 'g');
    let r;
    while ((r = re.exec(html))) {
        r[1].split(/\s+/).forEach((id) => {
            if (!counts[id]) fail(attr + ' points at missing id "' + id + '"');
        });
    }
}
ok('aria-controls / aria-labelledby targets resolved');

/* ---------- 3. element references used by scripts ---------- */
const used = new Set();
const refRe = /\$\(\s*'([A-Za-z0-9_-]+)'\s*\)|getElementById\(\s*'([A-Za-z0-9_-]+)'\s*\)/g;
while ((m = refRe.exec(html))) used.add(m[1] || m[2]);
const missing = [...used].filter((id) => !counts[id]);
if (missing.length) fail('script references missing ids: ' + missing.join(', '));
else ok(used.size + ' script id references resolved');

/* ---------- 4. JSON-LD ---------- */
const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
let blocks = 0;
while ((m = ldRe.exec(html))) {
    blocks++;
    try {
        const data = JSON.parse(m[1]);
        const graph = data['@graph'] || [data];
        ok('JSON-LD block ' + blocks + ' parses (' + graph.map((n) => n['@type']).join(', ') + ')');
        if (data['@graph']) {
            const faq = graph.find((n) => n['@type'] === 'FAQPage');
            if (!faq) fail('no FAQPage node');
            else {
                const qs = faq.mainEntity.map((q) => q.name);
                qs.forEach((q) => {
                    if (html.indexOf('>' + q + '<') === -1) fail('FAQ question not visible on page: ' + q);
                });
                ok(qs.length + ' FAQ questions in schema, all visible in the page');
            }
        }
    } catch (e) {
        fail('JSON-LD block ' + blocks + ' is invalid JSON: ' + e.message);
    }
}
if (!blocks) fail('no JSON-LD found');

/* ---------- 5. inline JS syntax ---------- */
const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
let n = 0;
while ((m = scriptRe.exec(html))) {
    if (/type="application\/ld\+json"/.test(m[1])) continue;
    n++;
    try {
        new Function(m[2]);
        ok('inline script ' + n + ' parses (' + m[2].split('\n').length + ' lines)');
    } catch (e) {
        fail('inline script ' + n + ' syntax error: ' + e.message);
    }
}

/* ---------- 6. tag balance ---------- */
let s = html.replace(/<!--[\s\S]*?-->/g, '');
s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>');
s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'stop', 'use']);
// HTML allows these end tags to be omitted (the original dashboard markup relies on it)
const OPTIONAL = new Set(['option', 'li', 'p', 'tr', 'td', 'th', 'dt', 'dd']);
const stack = [];
const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
let t;
let tagErrors = 0;
while ((t = tagRe.exec(s))) {
    const closing = t[1] === '/';
    const name = t[2].toLowerCase();
    const selfClosed = t[4] === '/' || VOID.has(name) || /\/$/.test(t[3].trim());
    if (closing) {
        while (stack.length && OPTIONAL.has(stack[stack.length - 1]) && stack[stack.length - 1] !== name) stack.pop();
        if (!stack.length) { fail('extra closing </' + name + '>'); tagErrors++; continue; }
        const top = stack.pop();
        if (top !== name) { fail('mismatched tag: <' + top + '> closed by </' + name + '>'); tagErrors++; }
    } else if (!selfClosed) {
        stack.push(name);
    }
}
if (stack.length) fail('unclosed tags: ' + stack.join(' > '));
if (!tagErrors && !stack.length) ok('HTML tag nesting balanced');

/* ---------- 7. SEO checks ---------- */
const need = ['<title>', 'name="description"', 'rel="canonical"', 'property="og:title"', 'name="twitter:card"', 'name="robots"', 'hreflang="x-default"'];
need.forEach((token) => { if (html.indexOf(token) === -1) fail('missing SEO tag: ' + token); });
const h1 = (html.match(/<h1\b/g) || []).length;
if (h1 !== 1) fail('expected exactly one <h1>, found ' + h1); else ok('exactly one <h1>');

/* ---------- 8. local assets referenced by the page ---------- */
['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'og-image.png', 'robots.txt', 'sitemap.xml', 'geo.js', 'logo.js']
    .forEach((name) => {
        if (!fs.existsSync(path.join(__dirname, '..', name))) fail('missing asset: ' + name);
    });
ok('local assets present');

/* ---------- 9. manifest + sitemap are valid ---------- */
try {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site.webmanifest'), 'utf8'));
    if (!manifest.icons || manifest.icons.length < 2) fail('manifest needs 192px and 512px icons');
    else ok('site.webmanifest parses');
} catch (e) { fail('site.webmanifest is not valid JSON: ' + e.message); }
try {
    const sitemap = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
    if (sitemap.indexOf('<urlset') === -1 || sitemap.indexOf('<loc>') === -1) fail('sitemap.xml looks incomplete');
    else ok('sitemap.xml present');
} catch (e) { fail('sitemap.xml missing: ' + e.message); }

console.log(problems ? '\n' + problems + ' problem(s) found' : '\nAll checks passed');
process.exit(problems ? 1 : 0);
