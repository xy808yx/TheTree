#!/usr/bin/env node
// Inline the whole app — styles.css, every app/*.js module, and the vendored ES
// libraries (EXCEPT the 2.2 MB gazetteer vendor/cities.js) — into one
// self-contained index.html. That file is both what's hosted (the editor) and the
// template every saved family.html is built from.
//
// How the single file runs ES modules without a server:
//   • Each module's source is embedded verbatim in an inert <script type="text/plain"
//     data-tt-mod="path"> tag (the browser doesn't execute these).
//   • Their local import specifiers are rewritten at build time to placeholder
//     tokens (@@MOD:path@@, and @@CITIES@@ for the one external gazetteer import).
//   • A tiny bootstrap turns each module into a Blob URL in dependency order,
//     substitutes the tokens with the real URLs, and import()s the entry module.
// This preserves exact ES-module semantics (live bindings, the vendor libs run
// untouched) with no bundler and no transform of the vendor code.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = __dirname;
const APP_DIR = path.join(ROOT, 'app');
const CITIES = 'app/vendor/cities.js';   // stays an external sibling, lazy-loaded by geo.js
const ENTRY = 'app/main.js';
const OUT = path.join(ROOT, 'index.html');
const STARTER = path.join(ROOT, 'family.html');
const QUESTIONS_SRC = path.join(APP_DIR, 'questions.js');
const QUESTIONS_OUT = path.join(ROOT, 'questions.html');

// ---- the printable question sheet -----------------------------------------
// Reads app/questions.js (the same module the in-app Guide renders) and writes a
// standalone questions.html: no scripts, no styles.css, nothing external, so it
// prints cleanly and survives being emailed on its own.
function readQuestions() {
  const src = fs.readFileSync(QUESTIONS_SRC, 'utf8');
  if (/^\s*import\s/m.test(src) || /^[ \t]*export\b(?!\s+const\b)/m.test(src)) {
    console.error('build: app/questions.js must stay pure data (only `export const`, no imports) — this build evaluates it directly');
    process.exit(1);
  }
  const q = vm.runInNewContext(
    src.replace(/^[ \t]*export\s+const\s/gm, 'const ')
      + '\n;({ lead: INTERVIEW_LEAD, craft: INTERVIEW_CRAFT, themes: INTERVIEW_THEMES, closer: INTERVIEW_CLOSER });',
    Object.create(null), { filename: 'app/questions.js' });
  for (const k of ['lead', 'craft', 'themes', 'closer']) {
    if (!q[k]) { console.error(`build: app/questions.js is missing its ${k} export`); process.exit(1); }
  }
  return q;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function buildQuestionsPage() {
  const q = readQuestions();
  // Inline the favicon too: this sheet should survive being emailed on its own.
  const icon = 'data:image/svg+xml;base64,'
    + fs.readFileSync(path.join(ROOT, 'icon.svg')).toString('base64');
  const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const block = (t) => `  <section class="theme">
    <h2>${esc(t.title)}</h2>
    <p class="note">${esc(t.note)}</p>
    <h3>Start here</h3>
    ${list(t.starters)}
    <h3>Go deeper</h3>
    ${list(t.deeper)}
  </section>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Questions worth asking · The Tree</title>
  <meta name="description" content="A printable list of questions for interviewing family, grouped by theme, from The Tree.">
  <link rel="icon" href="${icon}">
  <style>
:root {
  --paper: #f5f4ef; --ink: #221f1a; --ink-soft: #4a4640; --ink-faint: #807a6e;
  --hairline: #ddd8cc; --gold-deep: #74633a;
  --serif: 'Iowan Old Style', 'Charter', 'Palatino Linotype', 'Hoefler Text', Palatino, Georgia, 'Times New Roman', serif;
  --sans: ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 3rem 1.5rem 4rem; background: var(--paper); color: var(--ink);
  font-family: var(--serif); font-size: 1.05rem; line-height: 1.55;
  font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
  -webkit-text-size-adjust: 100%;
}
main { max-width: 40rem; margin: 0 auto; }
h1 { font-size: 2rem; font-weight: 600; letter-spacing: -.01em; margin: 0 0 .5rem; }
.lead { color: var(--ink-soft); margin: 0 0 .5rem; }
.kicker { font-family: var(--sans); font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-deep); margin: 0 0 .75rem; }
.craft { margin: 2rem 0 2.5rem; padding: 1.25rem 1.5rem; border: 1px solid var(--hairline); border-radius: 9px; background: #fbfaf6; }
.craft h2, .theme h2 { font-size: 1.3rem; font-weight: 600; margin: 0 0 .75rem; }
.craft ul { margin: 0; padding-left: 1.1rem; }
.craft li { margin: 0 0 .5rem; color: var(--ink-soft); }
.craft li strong, .theme li strong { color: var(--ink); }
.theme { margin: 0 0 2.25rem; padding-top: 1.5rem; border-top: 1px solid var(--hairline); }
.theme .note { font-family: var(--sans); font-size: .84rem; color: var(--ink-faint); margin: 0 0 1rem; }
.theme h3 {
  font-family: var(--sans); font-size: .72rem; letter-spacing: .1em; text-transform: uppercase;
  color: var(--gold-deep); font-weight: 600; margin: 1.25rem 0 .5rem;
}
.theme ul { margin: 0; padding-left: 1.1rem; }
.theme li { margin: 0 0 .45rem; }
footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--hairline); font-family: var(--sans); font-size: .8rem; color: var(--ink-faint); }
footer a { color: inherit; }
@media print {
  body { background: #fff; color: #000; padding: 0; font-size: 10.5pt; }
  main { max-width: none; }
  .craft { background: none; border-color: #999; break-inside: avoid; }
  .theme { break-inside: avoid; border-top-color: #999; }
  .theme h3, .kicker { color: #555; }
  .theme .note { color: #444; }
  h1, h2, h3 { break-after: avoid; }
  footer { display: none; }
  a { color: #000; text-decoration: none; }
  @page { margin: 16mm; }
}
  </style>
</head>
<body>
<main>
  <p class="kicker">The Tree</p>
  <h1>Questions worth asking</h1>
  <p class="lead">${esc(q.lead)}</p>

  <section class="craft">
    <h2>Before you start</h2>
    <ul>${q.craft.map((c) => `<li><strong>${esc(c.label)}:</strong> ${esc(c.text)}</li>`).join('')}</ul>
  </section>

${q.themes.map(block).join('\n\n')}

  <section class="theme">
    <h2>${esc(q.closer.title)}</h2>
    <p class="note">${esc(q.closer.note)}</p>
    ${list(q.closer.questions)}
  </section>

  <footer>Print this, or keep it open on a second device. The archive itself lives in your <code>family.html</code>.</footer>
</main>
</body>
</html>
`;
}

// ---- gather modules -------------------------------------------------------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

const modules = new Map(); // posixPath -> { raw, isVendor }
for (const abs of walk(APP_DIR)) {
  if (!abs.endsWith('.js')) continue;
  const p = rel(abs);
  if (p === CITIES) continue; // external on purpose
  modules.set(p, { raw: fs.readFileSync(abs, 'utf8'), isVendor: p.startsWith('app/vendor/') });
}
if (!modules.has(ENTRY)) { console.error(`build: entry ${ENTRY} not found`); process.exit(1); }

// ---- resolve a relative specifier against an importing module -------------
function resolveSpec(fromPath, spec) {
  if (!spec.startsWith('.')) return null; // bare specifier — not ours
  const dir = fromPath.split('/').slice(0, -1).join('/');
  const out = [];
  for (const seg of (dir ? dir + '/' + spec : spec).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

const RESERVED = /@@MOD:|@@ENDSCRIPT@@|__TTURL\(/; // tokens the build inserts must not pre-exist
const STATIC_FROM_RE = /\bfrom\s*["'](\.\.?\/[^"']+)["']/g;            // import/export ... from '...'
const STATIC_SIDE_RE = /(?:^|[;\s])import\s*["'](\.\.?\/[^"']+)["']/g; // side-effect import '...'
const DYN_RE = /\bimport\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;           // dynamic import('...')
const STATIC_REWRITE_RE = /(\bfrom\s*|\bimport\s*)(["'])(\.\.?\/[^"']+)\2/g;

// ---- per-module: assert, compute static deps, rewrite specifiers ----------
const deps = new Map();      // path -> Set(bundled dep paths)  (static imports only)
const rewritten = new Map(); // path -> source with tokens

for (const [p, m] of modules) {
  if (RESERVED.test(m.raw)) { console.error(`build: ${p} contains a reserved bundler token (@@MOD:/@@CITIES@@)`); process.exit(1); }

  // static-import edges (for topological ordering of blob creation)
  const d = new Set();
  for (const re of [STATIC_FROM_RE, STATIC_SIDE_RE]) {
    re.lastIndex = 0;
    let mm;
    while ((mm = re.exec(m.raw))) {
      const target = resolveSpec(p, mm[1]);
      if (target && modules.has(target)) d.add(target);
    }
  }
  deps.set(p, d);

  // Rewrite specifiers (vendors have none). Two cases:
  //  • dynamic import('./x') → import(__TTURL('app/x')) — resolved at runtime, because
  //    its target blob may be created LATER in the order (dynamic imports aren't topo
  //    edges). __TTURL also covers the one external import, the gazetteer.
  //  • static import/from './x' → '@@MOD:app/x@@' — substituted eagerly when the blob
  //    is built; topological order guarantees the dependency blob already exists.
  let src = m.raw;
  if (!m.isVendor) {
    src = src.replace(DYN_RE, (full, spec) => {
      const target = resolveSpec(p, spec);
      if (target === CITIES || (target && modules.has(target))) return `import(__TTURL('${target}'))`;
      return full;
    });
    src = src.replace(STATIC_REWRITE_RE, (full, kw, q, spec) => {
      const target = resolveSpec(p, spec);
      if (target && modules.has(target)) return `${kw}${q}@@MOD:${target}@@${q}`;
      return full; // anything that doesn't resolve to a bundled module — leave as-is
    });
  }

  // "</script" anywhere (e.g. in a comment or string) would end the inert tag early.
  // Swap it for a token the bootstrap restores before running the module.
  src = src.replace(/<\/script/gi, '@@ENDSCRIPT@@');
  if (/<\/script/i.test(src)) { console.error(`build: ${p} still contains "</script" after escaping`); process.exit(1); }
  rewritten.set(p, src);
}

// ---- dependency-first ordering (deps emitted before dependents) -----------
function topoOrder() {
  const order = [];
  const done = new Set();
  const remaining = new Set(modules.keys());
  while (remaining.size) {
    let progressed = false;
    for (const p of [...remaining]) {
      if ([...deps.get(p)].every((d) => done.has(d))) {
        order.push(p); done.add(p); remaining.delete(p); progressed = true;
      }
    }
    if (!progressed) { console.error('build: import cycle among ' + [...remaining].join(', ')); process.exit(1); }
  }
  return order;
}
const order = topoOrder();

// ---- assemble index.html --------------------------------------------------
const styles = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
if (/<\/style/i.test(styles)) { console.error('build: styles.css contains "</style"'); process.exit(1); }

const moduleTags = order.map((p) =>
  `<script type="text/plain" data-tt-mod="${p}">\n${rewritten.get(p)}\n</script>`).join('\n');

const bootstrap = `<script type="module">
const __urls = Object.create(null);
// The one external module — the gazetteer, lazy-loaded as a sibling of this page.
__urls['${CITIES}'] = new URL('${CITIES}', document.baseURI).href;
// Runtime resolver for dynamic imports (the target may be built after the importer).
globalThis.__TTURL = (p) => {
  const u = __urls[p];
  if (!u) throw new Error('The Tree: unknown module ' + p);
  return u;
};
for (const node of document.querySelectorAll('script[data-tt-mod]')) {
  let src = node.textContent;
  src = src.split('@@ENDSCRIPT@@').join('</scr' + 'ipt');
  src = src.replace(/@@MOD:([^@]+)@@/g, (m, p) => {
    const u = __urls[p];
    if (!u) throw new Error('The Tree bootstrap: missing static dependency ' + p);
    return u;
  });
  __urls[node.getAttribute('data-tt-mod')] = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
}
const __entry = __urls['${ENTRY}'];
if (!__entry) throw new Error('The Tree bootstrap: no entry module');
import(__entry).catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) app.textContent = 'The Tree could not start: ' + ((err && err.message) || err);
});
</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>The Tree: Family Archive</title>
  <meta name="description" content="A private family history archive: stories, lessons, and the people behind them. The whole archive is this one file.">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icon.svg">
  <meta name="theme-color" content="#2b2823">
  <style>
${styles}
  </style>
</head>
<body>
  <div id="app"></div>

  <!-- The family archive: an array of {kind,data,body} docs. Empty in the shell;
       each saved family.html carries its own. "<" is escaped so it can never end this tag. -->
  <script type="application/json" id="archive-data">[]</script>

  <!-- The app, inlined. These are inert source; the bootstrap below runs them. -->
${moduleTags}

  ${bootstrap}
</body>
</html>
`;

// ---- questions.html: the printable interview question list ----------------
// One source of truth. app/questions.js is an ES module the Guide renders inside
// the app; this build reads that same file to emit a standalone, self-contained
// sheet to print or keep open on a second device while interviewing. The module is
// pure data (no imports, no functions), so stripping `export` and evaluating it is
// enough — and the guard in readQuestions() keeps it that way.
const questionsHtml = buildQuestionsPage();

// Stamp the service-worker cache name with a content hash, so any change to the
// hosted shell auto-invalidates the old cache instead of serving a stale page.
// The hash covers EVERY precached asset (the SW serves them cache-first with no
// revalidation) — a gazetteer/manifest/icon-only change must invalidate too.
const hash = crypto.createHash('sha256')
  .update(html)
  .update(questionsHtml)
  .update(fs.readFileSync(path.join(ROOT, CITIES)))
  .update(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest')))
  .update(fs.readFileSync(path.join(ROOT, 'icon.svg')))
  .digest('hex').slice(0, 10);
const swPath = path.join(ROOT, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
const newSw = sw.replace(/const CACHE = 'thetree-[^']+';/, `const CACHE = 'thetree-${hash}';`);

// Everything above can still fail; nothing below can. Writing only once every byte
// is computed keeps a bad run from leaving a fresh index.html paired with a stale
// questions.html and an un-restamped sw.js, which would pin every installed client
// to the old cache forever.
fs.writeFileSync(OUT, html);
fs.writeFileSync(STARTER, html); // a ready-to-use starter copy (identical empty archive)
fs.writeFileSync(QUESTIONS_OUT, questionsHtml);
if (newSw === sw && !/thetree-/.test(sw)) console.warn('build: could not find CACHE constant in sw.js to stamp');
else if (newSw !== sw) fs.writeFileSync(swPath, newSw);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`build: wrote ${rel(OUT)}, ${rel(STARTER)}, and ${rel(QUESTIONS_OUT)}`);
console.log(`  modules inlined: ${order.length}  (entry: ${ENTRY})`);
console.log(`  shell size: ${kb(Buffer.byteLength(html))}  (data/photos add to this; gazetteer ${CITIES} stays external)`);
console.log(`  sw cache: thetree-${hash}  (auto-invalidates on every content change)`);
