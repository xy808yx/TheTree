// The storage layer: pick a real folder via the File System Access API, persist
// the handle across reloads, re-grant permission, and read/write the archive.
// All writes go through safeWrite (back up the old file, validate the new one).

import { parseDoc, serializeDoc, assertParses } from './parse.js';
import { slugify } from './store.js';

const SUBDIRS = ['people', 'unions', 'media', '_backups'];

export function isSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ---- handle persistence (IndexedDB) ----
const IDB_NAME = 'thetree';
const IDB_STORE = 'handles';

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

export function getSavedHandle() { return idbGet('archive'); }
export async function forgetArchive() { return idbSet('archive', undefined); }

// Must be called from a user gesture (click).
export async function pickArchive() {
  const handle = await window.showDirectoryPicker({
    id: 'thetree-archive', mode: 'readwrite', startIn: 'documents',
  });
  await idbSet('archive', handle);
  return handle;
}

// Re-grant permission on a saved handle. Must be called from a user gesture if
// it needs to prompt. Returns true only when read/write access is granted.
export async function verifyPermission(handle, write = true) {
  if (!handle) return false;
  const opts = { mode: write ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export async function ensureStructure(root) {
  const dirs = {};
  for (const name of SUBDIRS) dirs[name] = await root.getDirectoryHandle(name, { create: true });
  return dirs;
}

// Read every people/*.md and unions/*.md into docs the store can load.
// Unparseable files are skipped (and reported) rather than aborting the load.
export async function loadArchive(root) {
  const docs = [];
  const skipped = [];
  for (const sub of ['people', 'unions']) {
    let dir;
    try { dir = await root.getDirectoryHandle(sub); } catch { continue; }
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== 'file' || !name.endsWith('.md')) continue;
      try {
        const text = await (await h.getFile()).text();
        const { data, body } = parseDoc(text);
        docs.push({ kind: sub === 'people' ? 'person' : 'union', name, data, body });
      } catch (e) {
        skipped.push({ name, error: e.message });
      }
    }
  }
  return { docs, skipped };
}

// Safe write: validate the new text parses, snapshot the existing file to
// _backups/, then commit. Protects irreplaceable data from app logic bugs.
export async function safeWrite(root, sub, filename, text) {
  assertParses(text); // throws before we touch disk if YAML is malformed
  const dir = await root.getDirectoryHandle(sub, { create: true });

  try {
    const existing = await dir.getFileHandle(filename);
    const current = await (await existing.getFile()).text();
    const backups = await root.getDirectoryHandle('_backups', { create: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bh = await backups.getFileHandle(`${stamp}-${sub}-${filename}`, { create: true });
    const bw = await bh.createWritable();
    await bw.write(current);
    await bw.close();
  } catch (e) {
    if (e && e.name !== 'NotFoundError') throw e; // a real error, not "no prior file"
  }

  const fh = await dir.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
  return filename;
}

function fileNameFor(data) {
  const name = (data.names && (data.names.display || data.names.given)) || data.id;
  return `${data.id}-${slugify(name)}.md`;
}

export async function writePerson(root, data, body) {
  return safeWrite(root, 'people', fileNameFor(data), serializeDoc(data, body));
}
export async function writeUnion(root, data, body) {
  return safeWrite(root, 'unions', `${data.id}-${slugify(data.type || 'union')}.md`, serializeDoc(data, body));
}

export async function readManifest(root) {
  try {
    const fh = await root.getFileHandle('archive.json');
    return JSON.parse(await (await fh.getFile()).text());
  } catch { return null; }
}
export async function writeManifest(root, obj) {
  const fh = await root.getFileHandle('archive.json', { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(obj, null, 2));
  await w.close();
}

const VIEWABLE = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];

// Copy a chosen image into media/<personId>/. Refuses HEIC rather than storing
// a file the browser can't display (honest failure beats a silent broken image).
export async function importPhoto(root, personId, file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'heic' || ext === 'heif') {
    throw new Error('HEIC/HEIF photos can’t be shown in the browser yet. In Photos, export a JPEG copy and add that instead.');
  }
  if (!VIEWABLE.includes(ext)) {
    throw new Error(`Unsupported image type “.${ext}”. Use JPEG, PNG, GIF, or WebP.`);
  }
  const media = await root.getDirectoryHandle('media', { create: true });
  const pdir = await media.getDirectoryHandle(personId, { create: true });
  const fh = await pdir.getFileHandle(file.name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  return file.name;
}

// Resolve a stored photo to an object URL for display. Returns null if missing.
export async function photoURL(root, personId, filename) {
  try {
    const media = await root.getDirectoryHandle('media');
    const pdir = await media.getDirectoryHandle(personId);
    const fh = await pdir.getFileHandle(filename);
    return URL.createObjectURL(await fh.getFile());
  } catch { return null; }
}
