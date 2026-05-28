// The Family Book: the whole archive laid out as one long, readable document,
// ordered oldest-first so it reads like a chronicle. A print stylesheet turns
// the browser's "Save as PDF" into a durable, app-free copy of everything. The
// same page also offers the GEDCOM export — the two ways to take the archive out.

import { el, clear } from '../dom.js';
import { store, displayName, lifespan } from '../store.js';
import { scanLessons, storyProse } from '../parse.js';
import { context } from '../main.js';
import { photoURL } from '../fsa.js';
import { marked } from '../vendor/marked.esm.js';
import DOMPurify from '../vendor/purify.es.js';

function dominantSurname() {
  const counts = {};
  for (const p of store.allPeople()) {
    const fam = p.data.names && p.data.names.family;
    if (fam) counts[fam] = (counts[fam] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function orderedPeople() {
  return store.allPeople().slice().sort((a, b) => {
    const ay = a.birth.known ? a.birth.sortKey : Infinity;
    const by = b.birth.known ? b.birth.sortKey : Infinity;
    return ay - by || displayName(a).localeCompare(displayName(b));
  });
}

function placeLine(p) {
  const bits = [];
  const b = p.data.birth, d = p.data.death;
  if (p.birth.display || (b && b.place)) bits.push('Born ' + [p.birth.display, b && b.place].filter(Boolean).join(', '));
  if (p.death.display || (d && d.place)) bits.push('Died ' + [p.death.display, d && d.place].filter(Boolean).join(', '));
  else if (p.data.living === true && p.birth.known) bits.push('Living');
  return bits.join('  ·  ');
}

function names(list) {
  return list.map((x) => {
    const nm = displayName(x.person);
    const life = lifespan(x.person);
    const rel = x.relation && x.relation !== 'biological' ? ` (${x.relation})` : '';
    return life ? `${nm} (${life})${rel}` : `${nm}${rel}`;
  }).join(', ');
}

function entry(p, root) {
  const wrap = el('article', { class: 'book-entry' });

  const head = el('div', { class: 'book-head' },
    el('h2', { class: 'book-name' }, displayName(p),
      lifespan(p) ? el('span', { class: 'book-life' }, ` (${lifespan(p)})`) : null),
    placeLine(p) ? el('div', { class: 'book-facts' }, placeLine(p)) : null);
  const tags = p.data.tags || {};
  const tagText = Object.entries(tags).map(([k, v]) => `${k}: ${(Array.isArray(v) ? v : [v]).join(', ')}`).join('  ·  ');
  if (tagText) head.append(el('div', { class: 'book-tags' }, tagText));
  wrap.append(head);

  // photos (only in a connected archive; demo has none on disk)
  const photos = p.data.photos || [];
  if (root && photos.length) {
    const row = el('div', { class: 'book-photos' });
    for (const ph of photos) {
      const fig = el('figure', { class: 'book-photo' });
      row.append(fig);
      photoURL(root, p.id, ph.file).then((url) => {
        if (url) fig.append(el('img', { src: url, alt: ph.caption || '' }),
          ph.caption ? el('figcaption', {}, ph.caption) : null);
      });
    }
    wrap.append(row);
  }

  const prose = storyProse(p.body);
  if (prose) {
    const div = el('div', { class: 'book-story' });
    div.innerHTML = DOMPurify.sanitize(marked.parse(prose, { breaks: true }));
    wrap.append(div);
  }

  const lessons = scanLessons(p.body).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'mistake' ? -1 : 1));
  if (lessons.length) {
    const ul = el('ul', { class: 'book-lessons' });
    for (const l of lessons) {
      ul.append(el('li', { class: 'book-lesson' + (l.kind === 'mistake' ? ' is-mistake' : '') },
        el('span', { class: 'book-lesson-kind' }, (l.kind === 'mistake' ? 'Mistake' : 'Lesson') + ` — ${l.theme}: `),
        l.text));
    }
    wrap.append(ul);
  }

  const fam = [
    ['Parents', store.parentsOf(p)],
    ['Spouses & partners', store.partnersOf(p)],
    ['Children', store.childrenOf(p)],
    ['Siblings', store.siblingsOf(p)],
  ].filter(([, list]) => list.length);
  if (fam.length) {
    const dl = el('dl', { class: 'book-family' });
    for (const [label, list] of fam) dl.append(el('dt', {}, label), el('dd', {}, names(list)));
    wrap.append(dl);
  }
  return wrap;
}

export function renderBook(view) {
  clear(view);
  const { root } = context();
  const people = orderedPeople();
  const surname = dominantSurname();
  const title = surname ? `The ${surname} Family` : 'A Family Archive';
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const toolbar = el('div', { class: 'book-toolbar' },
    el('div', { class: 'tree-crumb' }, 'A printable copy of the whole archive. Use “Save as PDF” to keep one forever.'),
    el('span', { style: { flex: '1' } }),
    el('button', { class: 'btn btn-small', id: 'book-gedcom' }, 'Download GEDCOM'),
    el('button', { class: 'btn btn-primary btn-small', onclick: () => window.print() }, 'Save as PDF / Print'));

  const book = el('div', { class: 'book' });

  if (!people.length) {
    book.append(el('p', { class: 'empty-note' }, 'The archive is empty — add a person to begin the book.'));
    view.append(toolbar, book);
    return;
  }

  // title page
  book.append(el('section', { class: 'book-title-page' },
    el('div', { class: 'book-tp-mark' }, '❦'),
    el('h1', { class: 'book-tp-title' }, title),
    el('p', { class: 'book-tp-sub' }, 'A family archive — their stories, their hard-won lessons, and the mistakes worth not repeating.'),
    el('p', { class: 'book-tp-meta' }, `${people.length} lives · compiled ${today}`)));

  // entries
  const body = el('section', { class: 'book-body' });
  for (const p of people) body.append(entry(p, root));
  book.append(body);

  // lessons appendix
  const groups = store.lessonsByTheme();
  const themes = Object.keys(groups).filter((t) => groups[t] && groups[t].length).sort();
  if (themes.length) {
    const ap = el('section', { class: 'book-appendix' },
      el('h1', { class: 'book-appendix-title' }, 'The Family Lessons'),
      el('p', { class: 'book-appendix-intro' }, 'Gathered from every life in these pages, grouped by theme.'));
    for (const theme of themes) {
      const items = groups[theme].slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'mistake' ? -1 : 1));
      const sec = el('div', { class: 'book-appendix-theme' }, el('h2', {}, theme));
      const ul = el('ul', { class: 'book-lessons' });
      for (const it of items) {
        ul.append(el('li', { class: 'book-lesson' + (it.kind === 'mistake' ? ' is-mistake' : '') },
          el('span', { class: 'book-lesson-kind' }, (it.kind === 'mistake' ? 'Mistake' : 'Lesson') + ' — '),
          it.text || '(no detail)',
          el('span', { class: 'book-lesson-who' }, ` — ${displayName(it.person)}`)));
      }
      sec.append(ul);
      ap.append(sec);
    }
    book.append(ap);
  }

  view.append(toolbar, book);

  // GEDCOM export (lazy — keeps the gedcom serializer out of the app shell)
  const gedBtn = document.getElementById('book-gedcom');
  if (gedBtn) gedBtn.addEventListener('click', async () => {
    const { downloadGedcom } = await import('../gedcom.js');
    downloadGedcom(surname || 'family');
  });
}
