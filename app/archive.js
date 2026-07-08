// Single-file storage layer. The whole archive — the app, the family data, and
// the (compressed) photos — lives in one family.html. This module reads the data
// embedded in the page, writes an updated self-contained copy of the page back to
// disk (in place via the File System Access API where available, or as a download
// everywhere else), and turns chosen photos into compressed data URIs so there is
// no media/ folder to carry around.
//
// Replaces the old folder-of-files layer (fsa.js). The in-memory `store` keeps its
// {kind, data, body} document shape, so every view and the editor are unchanged.

import { store } from './store.js';

// Where the editor is hosted — the one place a relative gets the app to open or
// start an archive. Shared with the in-app guide (views/guide.js) so it can't drift.
export const APP_URL = 'https://xy808yx.github.io/TheTree/';

const DATA_ID = 'archive-data';
const ARCHIVE_FILENAME = 'family.html';

// ---------- read the data embedded in this page ----------

// Escape "<" so a JSON payload can never contain the literal "</script>" that would
// end the <script> tag early. JSON.parse turns < back into "<" on the way in.
function encodeData(docs) { return JSON.stringify(docs).replace(/</g, '\\u003c'); }

function parseDocsJSON(text) {
  const t = (text || '').trim();
  if (!t) return [];
  const docs = JSON.parse(t);
  return Array.isArray(docs) ? docs : [];
}

// Read the <script id="archive-data"> in THIS document → array of docs (or []).
export function loadEmbedded() {
  const el = document.getElementById(DATA_ID);
  if (!el) return [];
  try { return parseDocsJSON(el.textContent); }
  catch (e) { console.error('The Tree: embedded archive data could not be read', e); return []; }
}

// Pull the embedded data out of another family.html's text (used when opening or
// reconnecting to a file). Throws if the file isn't one of ours.
function extractDocsFromHTML(text) {
  const doc = new DOMParser().parseFromString(String(text || ''), 'text/html');
  const el = doc.getElementById(DATA_ID);
  if (!el) throw new Error('That file isn’t a family.html archive. No embedded family data was found in it.');
  return parseDocsJSON(el.textContent);
}

// The live store back to the embeddable doc array the views/editor produced.
export function currentDocs() {
  return [...store.allPeople(), ...store.allUnions()].map((r) => ({ kind: r.kind, data: r.data, body: r.body || '' }));
}

// ---------- build a fresh self-contained copy of this page ----------

// Clone the running document, blank the rendered UI and any transient overlays,
// and stamp in the current data — yielding a complete, openable family.html. The
// inlined styles, code modules and bootstrap ride along in the clone automatically,
// so the running page is its own template.
export function buildArchiveHTML(docs) {
  const html = document.documentElement.cloneNode(true);
  const appEl = html.querySelector('#app');
  if (appEl) appEl.replaceChildren();
  html.querySelectorAll('.toast-stack, .modal-backdrop').forEach((n) => n.remove());
  const dataEl = html.querySelector('#' + DATA_ID);
  if (!dataEl) throw new Error('This page has no #archive-data slot, so it can’t save itself.');
  dataEl.textContent = encodeData(docs);
  return '<!doctype html>\n' + html.outerHTML + '\n';
}

// ---------- capability checks ----------

export function canUseFilePickers() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && window.isSecureContext;
}

// ---------- file handle persistence (IndexedDB) ----------
const IDB_NAME = 'thetree';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'archive-file';

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbSet(key, val) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
function idbGet(key) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  }));
}
export function getSavedFileHandle() { return idbGet(HANDLE_KEY).catch(() => null); }
export function rememberFileHandle(h) { return idbSet(HANDLE_KEY, h); }
export function forgetFileHandle() { return idbSet(HANDLE_KEY, undefined); }

// Re-grant read/write on a stored handle. Must run inside a user gesture if it
// needs to prompt. Returns true only when access is granted.
export async function verifyPermission(handle, write = true) {
  if (!handle) return false;
  const opts = { mode: write ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch { /* handle from a previous session may be unusable — treat as no access */ }
  return false;
}

// ---------- open / reconnect to a family.html on disk ----------

// Open a family.html the user chooses. Uses the File System Access picker where
// available (so later saves can write in place), falling back to a plain file input
// (read-only; saves become downloads) on Safari/Firefox. Returns {handle, name,
// docs} — handle is null on the fallback path. Resolves null if the user cancels.
export async function openArchiveFile() {
  if (canUseFilePickers()) {
    let handle;
    try {
      [handle] = await window.showOpenFilePicker({
        id: 'thetree-archive',
        types: [{ description: 'Family archive', accept: { 'text/html': ['.html', '.htm'] } }],
        multiple: false,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }
    const docs = extractDocsFromHTML(await (await handle.getFile()).text());
    await rememberFileHandle(handle);
    return { handle, name: handle.name, docs };
  }
  return openArchiveViaInput();
}

function openArchiveViaInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      try { resolve({ handle: null, name: file.name, docs: extractDocsFromHTML(await file.text()) }); }
      catch (e) { reject(e); }
    };
    // If the dialog is dismissed with no choice, no change event fires — that's fine,
    // the promise simply never resolves and the caller's flow ends quietly.
    input.click();
  });
}

// Re-read the data from a previously connected file handle (the returning-user path).
export async function readArchiveFromHandle(handle) {
  return extractDocsFromHTML(await (await handle.getFile()).text());
}

// ---------- save ----------

async function writeHandle(handle, text) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

export function downloadArchive(docs, filename = ARCHIVE_FILENAME) {
  const blob = new Blob([buildArchiveHTML(docs)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Ask the user where family.html should live, and remember it for one-click saves.
export async function pickSaveLocation(suggestedName = ARCHIVE_FILENAME) {
  const handle = await window.showSaveFilePicker({
    id: 'thetree-archive',
    suggestedName,
    types: [{ description: 'Family archive', accept: { 'text/html': ['.html'] } }],
  });
  await rememberFileHandle(handle);
  return handle;
}

// Save the whole archive. With a writable handle (hosted editor, secure context)
// this overwrites the one file in place. Otherwise it downloads a fresh copy the
// user keeps (standalone file://, Safari). Returns { method, name }.
export async function saveArchive(docs, { handle } = {}) {
  const html = buildArchiveHTML(docs);
  if (handle && (await verifyPermission(handle))) {
    await writeHandle(handle, html);
    return { method: 'inplace', name: handle.name };
  }
  downloadArchive(docs);
  return { method: 'download', name: ARCHIVE_FILENAME };
}

// ---------- photos → compressed data URIs ----------
const MAX_DIM = 1600;       // longest edge, px
const JPEG_QUALITY = 0.8;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('Could not read that file.'));
    fr.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image couldn’t be decoded in the browser.'));
    img.src = src;
  });
}

// Resize (longest edge ≤ MAX_DIM) and re-encode as JPEG, returning a data URI to
// store directly on the person. Keeps the one file modest — "wisdom, not a
// scrapbook." HEIC still can't decode in a canvas, so we reject it honestly.
export async function importPhoto(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'heic' || ext === 'heif') {
    throw new Error('HEIC/HEIF photos can’t be shown in the browser yet. In Photos, export a JPEG copy and add that instead.');
  }
  const img = await loadImage(await fileToDataURL(file));
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('That image has no readable dimensions.');
  const longest = Math.max(w, h);
  if (longest > MAX_DIM) { const s = MAX_DIM / longest; w = Math.round(w * s); h = Math.round(h * s); }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // flatten any transparency for JPEG
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
