// Bootstrap, app state, landing screen, top chrome, and hash routing.

import { el, clear, go, toast } from './dom.js';
import { store, displayName } from './store.js';
import { sampleDocs, SAMPLE_FOCUS } from './sample-data.js';
import {
  isSupported, getSavedHandle, pickArchive, verifyPermission,
  ensureStructure, loadArchive, readManifest, writeManifest,
} from './fsa.js';
import { renderTree } from './views/tree.js';
import { renderPerson } from './views/person.js';
import { renderTimeline } from './views/timeline.js';
import { renderMap } from './views/map.js';
import { renderLessons } from './views/lessons.js';
import { renderQuery } from './views/query.js';
import { renderBook } from './views/book.js';

const app = { mode: null, root: null, archiveName: '', focus: null };
let savedHandle = null;

export function context() { return { root: app.root, mode: app.mode }; }
export function defaultFocus() {
  if (app.focus && store.getPerson(app.focus)) return app.focus;
  const first = store.allPeople()[0];
  return first ? first.id : null;
}

// ---------- chrome ----------
function renderChrome() {
  const root = document.getElementById('app');
  clear(root);
  root.append(
    el('header', { class: 'topbar' },
      el('a', { class: 'brand', href: '#/' },
        el('span', { class: 'brand-mark', 'aria-hidden': 'true' }, treeGlyph()),
        el('span', { class: 'brand-word' }, 'The Tree')),
      el('nav', { class: 'mainnav', id: 'mainnav' }),
      el('div', { class: 'topbar-right', id: 'topbar-right' })),
    el('main', { id: 'view', class: 'view' }),
    el('footer', { class: 'appfoot' }, el('span', {}, 'A private family archive')),
  );
  renderNav();
}

function treeGlyph() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M12 2a4 4 0 0 1 3.5 6 4 4 0 0 1-2.5 7.4V22h-2v-6.6A4 4 0 0 1 8.5 8 4 4 0 0 1 12 2z');
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

function navLink(label, path, active) {
  return el('a', { class: 'navlink' + (active ? ' is-active' : ''), href: path }, label);
}

function renderNav() {
  const nav = document.getElementById('mainnav');
  const right = document.getElementById('topbar-right');
  if (!nav || !right) return;
  clear(nav); clear(right);
  if (store.size === 0 && app.mode !== 'archive') return; // landing: bare header

  const route = (location.hash.split('/')[1] || 'tree');
  nav.append(
    navLink('Tree', '#/tree', route === 'tree'),
    navLink('Timeline', '#/timeline', route === 'timeline'),
    navLink('Map', '#/map', route === 'map'),
    navLink('Lessons', '#/lessons', route === 'lessons'),
    navLink('People', '#/query', route === 'query'),
    navLink('Book', '#/book', route === 'book'),
  );

  if (app.mode === 'archive') {
    right.append(
      el('span', { class: 'archive-pill', title: 'Saving to ' + app.archiveName },
        el('span', { class: 'dot' }), app.archiveName || 'Archive'));
  } else {
    right.append(el('span', { class: 'demo-pill', title: 'You are exploring sample data. Nothing you change is saved.' },
      el('span', { class: 'dot' }), 'Demo — not saved'));
    if (isSupported()) right.append(el('button', { class: 'btn btn-small', onclick: () => connect() }, 'Open a folder'));
  }
  right.append(el('button', { class: 'btn btn-small btn-primary', onclick: () => addPerson() }, '+ Add person'));
}

// ---------- landing ----------
function renderLanding(view) {
  clear(view);
  const actions = el('div', { class: 'landing-actions' });
  if (isSupported()) {
    // Prefer reconnect if we have a saved folder — it's the returning-user path.
    if (savedHandle) {
      actions.append(el('button', { class: 'btn btn-primary btn-large', onclick: () => reconnect() },
        `Open “${savedHandle.name}”`));
      actions.append(el('button', { class: 'btn', onclick: () => connect() }, 'Open a different folder'));
    } else {
      actions.append(el('button', { class: 'btn btn-primary btn-large', onclick: () => connect() },
        'Open your archive folder'));
    }
    actions.append(el('button', { class: 'btn btn-ghost', onclick: () => enterDemo() }, 'Or explore the demo'));
  } else {
    // Read-only browsers (Safari, Firefox, mobile): demo IS the primary action.
    actions.append(el('button', { class: 'btn btn-primary btn-large', onclick: () => enterDemo() }, 'Explore the demo family'));
  }

  const notice = isSupported() ? null
    : el('p', { class: 'banner' },
        el('span', { class: 'banner-icon', 'aria-hidden': 'true' }, '◆'),
        el('span', {},
          el('strong', {}, 'Editing requires Chrome or Edge on a desktop. '),
          'On this browser you can read the demo. To start your own archive, open this page in Chrome or Edge on a Mac, Windows, or Linux computer.'));

  view.append(el('section', { class: 'landing' },
    el('div', { class: 'landing-mark', 'aria-hidden': 'true' }, '· · ·'),
    el('h1', { class: 'landing-title' }, 'The Tree'),
    el('p', { class: 'landing-sub' },
      'A quiet archive of who your family was — their stories, their hard-won lessons, and the mistakes worth not repeating.'),
    notice,
    actions,
    el('hr', { class: 'landing-rule' }),
    el('p', { class: 'landing-fine' }, 'Plain files in a folder you choose. Nothing leaves your computer.'),
  ));
}

function renderEmptyArchive(view) {
  clear(view);
  view.append(el('section', { class: 'landing' },
    el('div', { class: 'landing-mark', 'aria-hidden': 'true' }, '· · ·'),
    el('p', { class: 'results-caption' }, 'Your archive'),
    el('h1', { class: 'landing-title' }, app.archiveName || 'Untitled'),
    el('p', { class: 'landing-sub' }, 'An empty room. Start by adding one person — a name and a single story is enough. You can fill the rest in later.'),
    el('div', { class: 'landing-actions' },
      el('button', { class: 'btn btn-primary btn-large', onclick: () => addPerson() }, '+ Add the first person')),
    el('hr', { class: 'landing-rule' }),
    el('p', { class: 'landing-fine' }, 'Files will be written to this folder under ', el('code', {}, 'people/'), ' and ', el('code', {}, 'unions/'), '. Backups land in ', el('code', {}, '_backups/'), '.'),
  ));
}

// ---------- data loading ----------
function enterDemo() {
  store.loadDocs(sampleDocs());
  app.mode = 'demo'; app.root = null; app.focus = SAMPLE_FOCUS;
  go(`#/tree/${SAMPLE_FOCUS}`);
  router();
}

async function useRoot(root) {
  app.root = root; app.mode = 'archive'; app.archiveName = root.name;
  await ensureStructure(root);
  const { docs, skipped } = await loadArchive(root);
  store.loadDocs(docs);
  if (skipped.length) console.warn('The Tree: skipped unparseable files', skipped);
  const man = (await readManifest(root)) || {};
  app.focus = (man.focus && store.getPerson(man.focus)) ? man.focus : defaultFocus();
  await writeManifest(root, { schemaVersion: 1, appVersion: 1, lastOpened: new Date().toISOString(), focus: app.focus });
  go(app.focus ? `#/tree/${app.focus}` : '#/');
  router();
}

async function connect() {
  try {
    const root = await pickArchive();
    if (!(await verifyPermission(root))) {
      toast('Folder access wasn’t granted. Click the button again and allow read & write to use this folder.', { kind: 'error' });
      return;
    }
    savedHandle = root;
    await useRoot(root);
    toast(`Opened “${root.name}”`, { kind: 'success' });
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user cancelled the picker — no message
    console.error(e);
    toast('Could not open that folder: ' + e.message, { kind: 'error' });
  }
}

async function reconnect() {
  try {
    if (!savedHandle) return;
    if (!(await verifyPermission(savedHandle))) {
      toast(`Couldn’t reopen “${savedHandle.name}”. The browser needs you to confirm access again.`, { kind: 'error' });
      return;
    }
    await useRoot(savedHandle);
    toast(`Opened “${savedHandle.name}”`, { kind: 'success' });
  } catch (e) {
    console.error(e);
    toast('Could not reconnect: ' + e.message, { kind: 'error' });
  }
}

async function addPerson() {
  const { openPersonEditor } = await import('./views/edit.js');
  openPersonEditor({ root: app.root, person: null });
}

// ---------- routing ----------
function router() {
  const view = document.getElementById('view');
  if (!view) return;
  if (store.size === 0) {
    if (app.mode === 'archive') renderEmptyArchive(view); else renderLanding(view);
    renderNav();
    return;
  }
  const parts = location.hash.replace(/^#\/?/, '').split('/'); // e.g. ['tree','p-marcus']
  const route = parts[0] || 'tree';
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;
  clear(view);
  if (route === 'person' && id) renderPerson(view, id);
  else if (route === 'timeline') renderTimeline(view);
  else if (route === 'map') renderMap(view);
  else if (route === 'lessons') renderLessons(view);
  else if (route === 'query') renderQuery(view);
  else if (route === 'book') renderBook(view);
  else renderTree(view, (id && store.getPerson(id)) ? id : defaultFocus());
  renderNav();
  window.scrollTo(0, 0);
}

// ---------- boot ----------
async function boot() {
  renderChrome();
  if (isSupported()) {
    try { savedHandle = await getSavedHandle(); } catch { savedHandle = null; }
  }
  window.addEventListener('hashchange', router);
  window.addEventListener('data:changed', (e) => {
    const focus = e.detail && e.detail.focus;
    if (focus) go(`#/person/${focus}`); else router();
    router();
  });
  router();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
