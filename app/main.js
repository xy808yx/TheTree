// Bootstrap, app state, landing screen, top chrome, and hash routing.
//
// Single-file model: the archive is one family.html. On boot we read the data
// embedded in this page; if there's none (the hosted editor, or a blank file) we
// show a landing that can start a new archive, open a family.html, reconnect the
// last one, or explore the demo. Saving writes an updated self-contained copy of
// this page back to disk — in place via the File System Access API, or as a
// download everywhere else (see archive.js).

import { el, clear, go, toast } from './dom.js';
import { store } from './store.js';
import { app } from './context.js';
import { sampleDocs, SAMPLE_FOCUS } from './sample-data.js';
import {
  loadEmbedded, currentDocs, openArchiveFile, readArchiveFromHandle,
  saveArchive, pickSaveLocation, downloadArchive,
  getSavedFileHandle, verifyPermission, canUseFilePickers,
} from './archive.js';
import { renderTree } from './views/tree.js';
import { renderPerson } from './views/person.js';
import { renderTimeline } from './views/timeline.js';
import { renderMap } from './views/map.js';
import { renderLessons } from './views/lessons.js';
import { renderQuery } from './views/query.js';
import { renderBook } from './views/book.js';
import { renderGuide } from './views/guide.js';

let savedFileHandle = null; // the last-used family.html handle (for one-click reconnect)

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
    navLink('Guide', '#/guide', route === 'guide'),
  );

  if (app.mode === 'archive') {
    const label = app.archiveName || 'family.html';
    right.append(
      el('span', { class: 'archive-pill', title: app.file ? 'Saving in place to ' + label : 'Not saved to a file yet — Save downloads a copy' },
        el('span', { class: 'dot' + (app.dirty ? ' is-dirty' : '') }),
        label, app.dirty ? el('span', { class: 'pill-flag', title: 'Unsaved changes' }, ' •') : null));
    right.append(el('button', { class: 'btn btn-small' + (app.dirty ? ' btn-primary' : ''), onclick: () => requestSave() },
      app.file ? 'Save' : 'Save / download'));
  } else {
    right.append(el('span', { class: 'demo-pill', title: 'You are exploring sample data. Nothing you change is saved.' },
      el('span', { class: 'dot' }), 'Demo — not saved'));
    right.append(el('button', { class: 'btn btn-small', onclick: () => backToLanding() }, 'Start your own'));
  }
  right.append(el('button', { class: 'btn btn-small btn-primary', onclick: () => addPerson() }, '+ Add person'));
}

// ---------- landing ----------
function renderLanding(view) {
  clear(view);
  const actions = el('div', { class: 'landing-actions' });
  if (savedFileHandle) {
    actions.append(el('button', { class: 'btn btn-primary btn-large', onclick: () => reconnectSaved() },
      `Open “${savedFileHandle.name}”`));
    actions.append(el('button', { class: 'btn', onclick: () => openFile() }, 'Open a different family.html'));
    actions.append(el('button', { class: 'btn', onclick: () => startNewArchive() }, 'Start a new archive'));
  } else {
    actions.append(el('button', { class: 'btn btn-primary btn-large', onclick: () => startNewArchive() }, 'Start a new archive'));
    actions.append(el('button', { class: 'btn', onclick: () => openFile() }, 'Open a family.html'));
  }
  actions.append(el('button', { class: 'btn btn-ghost', onclick: () => enterDemo() }, 'Or explore the demo'));

  const note = canUseFilePickers() ? null
    : el('p', { class: 'banner' },
        el('span', { class: 'banner-icon', 'aria-hidden': 'true' }, '◆'),
        el('span', {},
          el('strong', {}, 'This browser works for reading and writing. '),
          'When you Save, an updated family.html downloads. For one-click saving in place, open this page in Chrome or Edge on a desktop.'));

  view.append(el('section', { class: 'landing' },
    el('div', { class: 'landing-mark', 'aria-hidden': 'true' }, '· · ·'),
    el('h1', { class: 'landing-title' }, 'The Tree'),
    el('p', { class: 'landing-sub' },
      'A quiet archive of who your family was — their stories, their hard-won lessons, and the mistakes worth not repeating.'),
    note,
    actions,
    el('hr', { class: 'landing-rule' }),
    el('p', { class: 'landing-fine' },
      'Your whole family lives in one file you own — open it on any device, back it up anywhere, hand it to anyone. Nothing leaves your computer. ',
      el('a', { href: '#/guide' }, 'How this works')),
  ));
}

function renderEmptyArchive(view) {
  clear(view);
  view.append(el('section', { class: 'landing' },
    el('div', { class: 'landing-mark', 'aria-hidden': 'true' }, '· · ·'),
    el('p', { class: 'results-caption' }, 'Your archive'),
    el('h1', { class: 'landing-title' }, app.archiveName || 'family.html'),
    el('p', { class: 'landing-sub' }, 'An empty room. Start by adding one person — a name and a single story is enough. You can fill the rest in later.'),
    el('div', { class: 'landing-actions' },
      el('button', { class: 'btn btn-primary btn-large', onclick: () => addPerson() }, '+ Add the first person')),
    el('hr', { class: 'landing-rule' }),
    el('p', { class: 'landing-fine' },
      'Everything you add lives inside one ', el('code', {}, 'family.html'), ' you keep. When you’re ready, ', el('strong', {}, 'Save'), ' writes it ',
      canUseFilePickers() ? 'to disk' : 'as a download', ' — then back it up to iCloud, a USB drive, anywhere. ',
      el('a', { href: '#/guide' }, 'How this works')),
  ));
}

// ---------- entering an archive / demo ----------
function enterArchive(docs, { file = null, name = 'family.html' } = {}) {
  store.loadDocs(docs);
  app.mode = 'archive'; app.file = file; app.archiveName = name; app.dirty = false;
  if (file) savedFileHandle = file;
  app.focus = defaultFocus();
  go(app.focus ? `#/tree/${app.focus}` : '#/');
  router();
}

function enterDemo() {
  store.loadDocs(sampleDocs());
  app.mode = 'demo'; app.file = null; app.archiveName = ''; app.dirty = false; app.focus = SAMPLE_FOCUS;
  go(`#/tree/${SAMPLE_FOCUS}`);
  router();
}

function backToLanding() {
  store.clear();
  app.mode = null; app.file = null; app.archiveName = ''; app.focus = null; app.dirty = false;
  go('#/');
  router();
}

function startNewArchive() {
  store.clear();
  app.mode = 'archive'; app.file = null; app.archiveName = 'family.html'; app.dirty = false; app.focus = null;
  go('#/');
  router();
}

async function openFile() {
  try {
    const res = await openArchiveFile();
    if (!res) return; // cancelled
    enterArchive(res.docs, { file: res.handle, name: res.name });
    toast(`Opened “${res.name}”.`, { kind: 'success' });
    if (!res.handle && !canUseFilePickers()) {
      toast('This browser can read the file but can’t write back to it — Save will download an updated copy.', { duration: 7000 });
    }
  } catch (e) {
    console.error(e);
    toast('Couldn’t open that file: ' + (e.message || e), { kind: 'error' });
  }
}

async function reconnectSaved() {
  if (!savedFileHandle) return;
  try {
    if (!(await verifyPermission(savedFileHandle))) {
      toast(`The browser needs you to allow access to “${savedFileHandle.name}” again. Click Open and confirm.`, { kind: 'error' });
      return;
    }
    const docs = await readArchiveFromHandle(savedFileHandle);
    enterArchive(docs, { file: savedFileHandle, name: savedFileHandle.name });
    toast(`Opened “${savedFileHandle.name}”.`, { kind: 'success' });
  } catch (e) {
    console.error(e);
    toast('Couldn’t reopen that file: ' + (e.message || e), { kind: 'error' });
  }
}

// ---------- saving ----------
// Write the whole archive back to family.html. With a handle (hosted, secure) it
// writes in place; the first save in the hosted editor asks once where the file
// should live. Everywhere else it downloads a fresh copy. A failed write never
// loses the edit — it stays in memory and the user is offered a download.
async function requestSave({ silent = false } = {}) {
  if (app.mode !== 'archive') return;
  const docs = currentDocs();
  try {
    if (canUseFilePickers() && !app.file) {
      app.file = await pickSaveLocation(app.archiveName || 'family.html');
      savedFileHandle = app.file;
      app.archiveName = app.file.name;
    }
    const result = await saveArchive(docs, { handle: app.file });
    app.dirty = false;
    renderNav();
    if (!silent) {
      if (result.method === 'inplace') toast(`Saved to “${result.name}”.`, { kind: 'success' });
      else toast('Saved — an updated family.html was downloaded. Keep this copy and back it up.', { kind: 'success', duration: 6000 });
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { // cancelled the save-location picker
      app.dirty = true; renderNav();
      toast('Not saved yet — your changes are still here. Click Save when you’re ready to choose a location.', { duration: 6000 });
      return;
    }
    console.error('The Tree: save failed', e);
    app.dirty = true; renderNav();
    const download = el('button', { type: 'button', class: 'btn btn-small',
      onclick: () => { downloadArchive(currentDocs()); } }, 'Download a copy');
    toast(el('span', {}, 'Couldn’t write the file — your edit is safe in this tab. ', download),
      { kind: 'error', sticky: true });
  }
}

async function addPerson() {
  const { openPersonEditor } = await import('./views/edit.js');
  openPersonEditor({ person: null });
}

// ---------- routing ----------
// Hash segments can contain a stray "%"; decodeURIComponent throws on those. Fall
// back to the raw segment so a malformed hash never crashes the router.
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

function router() {
  const view = document.getElementById('view');
  if (!view) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/'); // e.g. ['tree','p-david']
  const route = parts[0] || 'tree';
  const id = parts[1] ? safeDecode(parts[1]) : null;

  // The guide is static — reachable even before an archive or the demo is loaded.
  if (route === 'guide') { clear(view); renderGuide(view); renderNav(); window.scrollTo(0, 0); return; }

  if (store.size === 0) {
    if (app.mode === 'archive') renderEmptyArchive(view); else renderLanding(view);
    renderNav();
    return;
  }
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

  // The data this file already carries (a standalone family.html → open it straight away).
  const embedded = loadEmbedded();

  // Remember the last family.html we wrote, so a returning hosted user can one-click reopen.
  try { savedFileHandle = await getSavedFileHandle(); } catch { savedFileHandle = null; }

  window.addEventListener('hashchange', router);
  window.addEventListener('data:changed', (e) => {
    const detail = e.detail || {};
    if (detail.focus) { app.focus = detail.focus; go(`#/person/${detail.focus}`); }
    router();
    if (detail.persist) {
      if (app.mode === 'archive') { app.dirty = true; renderNav(); requestSave(); }
      else if (app.mode === 'demo') toast('Demo mode — changes live only in this tab and aren’t saved.', { duration: 5000 });
    }
  });

  if (embedded.length) {
    // A file that already holds an archive. On the hosted page this is rare; on a
    // double-clicked family.html it's the norm — render immediately, no landing.
    enterArchive(embedded, { file: null, name: 'family.html' });
  } else {
    router(); // landing (or empty archive, once one is started)
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // Resolve against the page, not this (blob-URL) module, so it finds the site-root sw.js.
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {});
  }
}

boot();
