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

// Trim every file's backup history to the most recent KEEP_BACKUPS. Runs once per
// archive open (not per save, which would re-scan the whole folder on every write).
// Backup names are `<iso-stamp>-<sub>-<filename>`; we group by everything after the
// fixed-width stamp so all snapshots of one file land together — including those of
// since-renamed records, whose old-slug backups would otherwise accumulate forever.
const KEEP_BACKUPS = 10;
export async function pruneBackups(root) {
  let backups;
  try { backups = await root.getDirectoryHandle('_backups'); } catch { return; } // nothing to prune
  const groups = new Map(); // `<sub>-<filename>` -> [backup names]
  for await (const [name, h] of backups.entries()) {
    if (h.kind !== 'file') continue;
    const m = name.match(/^\d{4}-\d\d-\d\dT[\d-]+Z-(.+)$/);
    const key = m ? m[1] : name; // unrecognized names get their own group (never pruned)
    let arr = groups.get(key);
    if (!arr) { arr = []; groups.set(key, arr); }
    arr.push(name);
  }
  for (const names of groups.values()) {
    if (names.length <= KEEP_BACKUPS) continue;
    names.sort(); // fixed-width ISO stamp prefix => oldest first
    for (const name of names.slice(0, names.length - KEEP_BACKUPS)) {
      try { await backups.removeEntry(name); } catch { /* ignore a single stuck file */ }
    }
  }
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

async function fileExists(dir, name) {
  try { await dir.getFileHandle(name); return true; }
  catch (e) { if (e && e.name === 'NotFoundError') return false; throw e; } // don't mask a dir clash or lost access
}

// Pick a name that isn't taken in dir, suffixing "-2", "-3", … before the
// extension — so re-importing "IMG_001.jpg" never overwrites a different image.
async function uniqueFileName(dir, name) {
  if (!(await fileExists(dir, name))) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!(await fileExists(dir, candidate))) return candidate;
  }
}

// Copy a chosen image into media/<personId>/. Refuses HEIC rather than storing a
// file the browser can't display (honest failure beats a silent broken image), and
// never overwrites an existing different photo (the filename is made unique first).
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
  const name = await uniqueFileName(pdir, file.name);
  const fh = await pdir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  return name;
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

// A plain-language README written into the archive root the first time it's opened,
// so the folder explains itself on any computer, in any decade — and so whoever
// inherits the USB drive or iCloud copy knows what it is and how to open it. Written
// verbatim (not via safeWrite, which expects YAML frontmatter) and only when absent,
// so a hand-edited README is never clobbered.
// Where the static app is hosted — the one place a relative gets the app to open
// the folder. Shared with the in-app guide (views/guide.js) so it can't drift.
export const APP_URL = 'https://xy808yx.github.io/TheTree/';

const README_NAME = 'READ ME FIRST.md';
const README_TEXT = `# This folder is a family archive

This is a collection of plain text files — one per person — that together hold a
family's history: who they were, the stories worth keeping, and the hard-won
lessons (and mistakes) worth passing on.

**You own these files.** They are readable in any text editor, on any computer,
with no special app, forever. Nothing here depends on a company, a subscription,
or the internet.

## How to open it with the app

The Tree is a small web app that reads this folder and shows it as a tree,
timeline, map, and printable book. It stores nothing itself — it is just a nicer
way to read and edit what's already here.

1. On a Mac, Windows, or Linux **computer**, open **Chrome or Edge**.
2. Go to **${APP_URL}**
3. Click **Open your archive folder** and choose *this* folder.

(Editing needs Chrome or Edge on a desktop. Phones and Safari can't open the
folder, but anyone can read the PDF book described below.)

## What's in here

- \`people/\`   — one Markdown file per person (the heart of the archive)
- \`unions/\`   — marriages and partnerships, which link people together
- \`media/\`    — photos, grouped by person
- \`_backups/\` — automatic safety copies made before each save. Safe to delete
  anytime if the folder gets large.

## Backing it up

- Keep this folder in **iCloud Drive** (or another synced folder) so it is backed
  up automatically and follows you to a new computer.
- Every so often, **copy the whole folder to a USB drive** and store it somewhere
  safe. That copy survives any account, company, or computer.

## Sharing it with family

- **A PDF book** — open the app, go to **Book**, and choose *Save as PDF*. Print
  or send that; it is the easiest thing for most relatives to read.
- **A copy of this folder** — for someone who wants to open the app themselves or
  read the files directly.
- **A GEDCOM file** — export one from the app if a relative uses Ancestry,
  FamilySearch, or other genealogy software.

---
*Written by The Tree. You can edit or delete this file — the app won't replace it.*
`;

// Write READ ME FIRST.md into the archive root if it isn't already there.
export async function ensureReadme(root) {
  if (await fileExists(root, README_NAME)) return false; // never clobber a hand-edited one
  const fh = await root.getFileHandle(README_NAME, { create: true });
  const w = await fh.createWritable();
  await w.write(README_TEXT);
  await w.close();
  return true;
}
