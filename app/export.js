// "Export Markdown" — the no-lock-in escape hatch. Emits the whole archive in the
// original plain-files layout (people/<id>-<slug>.md, unions/<id>-<type>.md) plus a
// short README, packed into one .zip with no dependencies. The Markdown is the
// durable, app-free record of names, dates, places, stories, and lessons; photos
// stay as data URIs inside family.html and are not copied here (their captions are).

import { store, slugify } from './store.js';
import { serializeDoc } from './parse.js';

function personFileName(data) {
  const name = (data.names && (data.names.display || data.names.given)) || data.id;
  return `people/${data.id}-${slugify(name)}.md`;
}
function unionFileName(data) {
  return `unions/${data.id}-${slugify(data.type || 'union')}.md`;
}

// Drop the heavy base64 photo data from frontmatter (it isn't meaningful as plain
// text); keep each photo's caption/date so the record still notes a picture existed.
function withoutPhotoData(data) {
  if (!data.photos || !data.photos.length) return data;
  const copy = JSON.parse(JSON.stringify(data));
  copy.photos = copy.photos.map((ph) => ({ caption: ph.caption || '', date: ph.date || '' }));
  return copy;
}

const README = `# A family archive, as plain files

These are the people and relationships from a family.html archive, written out as
plain Markdown — one file per person in \`people/\`, one per marriage or partnership
in \`unions/\`. Open any of them in a text editor; no app required, now or ever.

This is an export for safekeeping and for genealogy tools. The living, browsable
archive is the single \`family.html\` file these came from — open that in a browser
to read the tree, timeline, map, and book, or to keep editing.
`;

function gatherFiles() {
  const files = [];
  for (const p of store.allPeople()) {
    files.push({ name: personFileName(p.data), text: serializeDoc(withoutPhotoData(p.data), p.body || '') });
  }
  for (const u of store.allUnions()) {
    files.push({ name: unionFileName(u.data), text: serializeDoc(u.data, u.body || '') });
  }
  files.push({ name: 'READ ME.md', text: README });
  return files;
}

// ---- minimal store-only ZIP (no compression, no dependencies) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), // sig, version, flags, method (0 = store)
      ...u16(0), ...u16(0x21),                              // mod time, mod date (a fixed valid date)
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    chunks.push(new Uint8Array(local), nameBytes, data);
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }
  const centralStart = offset;
  for (const c of central) {
    const cd = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0x21),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(c.offset),
    ];
    chunks.push(new Uint8Array(cd), c.nameBytes);
    offset += cd.length + c.nameBytes.length;
  }
  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(offset - centralStart), ...u32(centralStart), ...u16(0),
  ];
  chunks.push(new Uint8Array(eocd));
  return new Blob(chunks, { type: 'application/zip' });
}

export function downloadMarkdownZip(basename = 'family') {
  const url = URL.createObjectURL(zip(gatherFiles()));
  const a = document.createElement('a');
  a.href = url;
  a.download = `the-${String(basename).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family'}-family-markdown.zip`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
