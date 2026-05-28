// Person profile: facts, story (markdown), tagged lessons as cards, photo
// gallery, and linked relationships.

import { el, clear } from '../dom.js';
import { store, displayName, lifespan } from '../store.js';
import { scanLessons, storyProse } from '../parse.js';
import { photoURL } from '../fsa.js';
import { context } from '../main.js';
import { marked } from '../vendor/marked.esm.js';
import DOMPurify from '../vendor/purify.es.js';

function mdBlock(text) {
  const div = el('div', { class: 'story' });
  if (text) div.innerHTML = DOMPurify.sanitize(marked.parse(text, { breaks: true }));
  return div;
}

function personLink(p, relation) {
  if (!p) return null;
  const life = lifespan(p);
  return el('a', { class: 'person-link', href: `#/person/${p.id}` },
    displayName(p),
    life ? el('span', { class: 'pl-life' }, life) : null,
    relation && relation !== 'biological' ? el('span', { class: `rel-badge ${relation}` }, relation) : null);
}

function group(title, links) {
  links = links.filter(Boolean);
  if (!links.length) return null;
  return el('div', { class: 'relation-group' },
    el('h4', {}, title),
    el('div', { class: 'person-chips' }, links));
}

function lifeLines(p) {
  const d = p.data;
  const lines = [];
  const born = p.birth.display || (d.birth && d.birth.place ? '' : null);
  if (p.birth.display || (d.birth && d.birth.place)) {
    lines.push(el('div', {}, p.birth.display ? `Born ${p.birth.display}` : 'Born',
      d.birth && d.birth.place ? el('span', { class: 'profile-place' }, ` · ${d.birth.place}`) : null));
  }
  if (p.death.display || (d.death && d.death.place)) {
    lines.push(el('div', {}, p.death.display ? `Died ${p.death.display}` : 'Died',
      d.death && d.death.place ? el('span', { class: 'profile-place' }, ` · ${d.death.place}`) : null));
  } else if (d.living === true && p.birth.known) {
    lines.push(el('div', {}, 'Living'));
  }
  return lines;
}

function tagPills(tags) {
  const out = [];
  for (const [cat, raw] of Object.entries(tags || {})) {
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      out.push(el('span', { class: 'tag' }, el('span', { class: 'tag-cat' }, cat), String(v)));
    }
  }
  return out;
}

function fillPhotos(container, root, person) {
  const photos = person.data.photos || [];
  for (const ph of photos) {
    const cell = el('figure', { class: 'photo' });
    const missing = el('div', { class: 'photo-missing' }, ph.caption || ph.file || 'Photo');
    cell.append(missing, ph.caption ? el('figcaption', { class: 'photo-cap' }, ph.caption + (ph.date ? ` · ${ph.date}` : '')) : null);
    container.append(cell);
    if (root) {
      photoURL(root, person.id, ph.file).then((url) => {
        if (!url) return;
        const img = el('img', { src: url, alt: ph.caption || person.id, loading: 'lazy' });
        missing.replaceWith(img);
      });
    }
  }
}

export function renderPerson(view, id) {
  const p = store.getPerson(id);
  clear(view);
  if (!p) { view.append(el('p', { class: 'empty-note' }, 'No record for this person.')); return; }

  const { root } = context();
  const aka = (p.data.names && p.data.names.also_known_as) || [];
  const wrap = el('article', { class: 'profile' });

  const portrait = el('div', { class: 'portrait-blank' }, monogram(p));
  const head = el('header', { class: 'profile-head' },
    portrait,
    el('div', {},
      el('h1', { class: 'profile-name' }, displayName(p),
        aka.length ? el('span', { class: 'profile-aka' }, ` · “${aka.join('”, “')}”`) : null),
      el('div', { class: 'profile-life' }, ...lifeLines(p)),
      el('div', { class: 'profile-actions' },
        el('a', { class: 'btn btn-small', href: `#/tree/${p.id}` }, 'View in tree'),
        el('button', { class: 'btn btn-small', onclick: () => editPerson(p) }, 'Edit')),
      Object.keys(p.data.tags || {}).length ? el('div', { class: 'tags' }, tagPills(p.data.tags)) : null));
  wrap.append(head);

  // photos
  if ((p.data.photos || []).length) {
    wrap.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'section-title' }, 'Photographs'));
    const gallery = el('div', { class: 'gallery' });
    wrap.append(gallery);
    fillPhotos(gallery, root, p);
  }

  // story
  const prose = storyProse(p.body);
  if (prose) {
    wrap.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'section-title' }, 'Story'), mdBlock(prose));
  }

  // lessons
  const lessons = scanLessons(p.body);
  if (lessons.length) {
    wrap.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'section-title' }, 'Lessons & Mistakes'));
    const list = el('ul', { class: 'lesson-list' });
    for (const l of lessons) {
      list.append(el('li', { class: 'lesson' + (l.kind === 'mistake' ? ' is-mistake' : '') },
        el('span', { class: 'lesson-theme' }, l.theme),
        el('div', {}, el('span', { class: 'lesson-kind' }, l.kind === 'mistake' ? 'Mistake — ' : 'Lesson — '), l.text)));
    }
    wrap.append(list);
  }

  // relationships
  const parents = store.parentsOf(p);
  const partners = store.partnersOf(p);
  const children = store.childrenOf(p);
  const siblings = store.siblingsOf(p);
  const rel = el('div', { class: 'relations' });
  const groups = [
    group('Parents', parents.map((x) => personLink(x.person, x.relation))),
    group('Spouses & partners', partners.map((x) => personLink(x.person, unionNote(x.union)))),
    group('Children', children.map((x) => personLink(x.person, x.relation))),
    group('Siblings', siblings.map((x) => personLink(x.person, x.relation))),
  ].filter(Boolean);
  if (groups.length) {
    wrap.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'section-title' }, 'Family'));
    rel.append(...groups);
    wrap.append(rel);
  }

  view.append(wrap);
}

function unionNote(u) {
  if (!u) return null;
  const s = u.data.status;
  return s && s !== 'married' ? s : null;
}

function monogram(p) {
  const n = displayName(p).trim();
  const initials = n.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return initials || '?';
}

async function editPerson(p) {
  const { openPersonEditor } = await import('./edit.js');
  openPersonEditor({ root: context().root, person: p });
}
