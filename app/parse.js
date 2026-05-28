// The data contract: parse/serialize person & union markdown files, parse the
// partial-date convention, and scan inline lesson/mistake markers.
// Everything else in the app depends on the shapes produced here.

import { load as yamlLoad, dump as yamlDump, CORE_SCHEMA } from './vendor/js-yaml.js';

export class ParseError extends Error {}

// CORE_SCHEMA deliberately omits the YAML timestamp type, so "1938-04-12" stays
// a string instead of becoming a Date — dates are human text in this app.
const YAML_OPTS = { schema: CORE_SCHEMA };
const DUMP_OPTS = { schema: CORE_SCHEMA, lineWidth: 100, noRefs: true, sortKeys: false };

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// text -> { data, body }
export function parseDoc(text) {
  const raw = text == null ? '' : String(text);
  const m = raw.match(FRONTMATTER);
  if (!m) return { data: {}, body: raw.trim() };
  let data;
  try {
    data = yamlLoad(m[1], YAML_OPTS) || {};
  } catch (e) {
    throw new ParseError(`Invalid YAML frontmatter: ${e.message}`);
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ParseError('Frontmatter must be a key/value block.');
  }
  return { data, body: (m[2] || '').trim() };
}

// { data, body } -> canonical markdown string (used by safe-write round-trip)
export function serializeDoc(data, body) {
  const fm = yamlDump(data, DUMP_OPTS).replace(/\s+$/, '');
  const text = (body || '').trim();
  return `---\n${fm}\n---\n\n${text}\n`;
}

// Throws if the frontmatter we're about to write isn't valid YAML — the guard
// the safe-write wrapper relies on before overwriting a good file.
export function assertParses(text) {
  parseDoc(text);
  return true;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Parse the partial-date convention, never losing the original text.
// Accepts: "1938-04-12", "1938-04", "1938", "abt 1850", "before 1900",
// "after 1945", "living", "" (unknown). Returns { raw, known, display, sortKey, ... }.
export function parseDate(input) {
  const raw = (input == null ? '' : String(input)).trim();
  if (!raw) return { raw: '', known: false, display: '' };
  if (/^living$/i.test(raw)) return { raw, known: false, living: true, display: 'Living' };

  let qualifier = null;
  let rest = raw;
  let mq;
  if ((mq = rest.match(/^(?:abt|about|circa|ca?\.?|~)\s*/i))) { qualifier = 'about'; rest = rest.slice(mq[0].length); }
  else if ((mq = rest.match(/^(?:before|bef\.?)\s+/i))) { qualifier = 'before'; rest = rest.slice(mq[0].length); }
  else if ((mq = rest.match(/^(?:after|aft\.?)\s+/i))) { qualifier = 'after'; rest = rest.slice(mq[0].length); }

  const iso = rest.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!iso) return { raw, known: false, display: raw, qualifier };

  const year = +iso[1];
  const month = iso[2] ? +iso[2] : null;
  const day = iso[3] ? +iso[3] : null;
  const precision = day ? 'day' : month ? 'month' : 'year';

  let sortKey = year + ((month ? month - 1 : 0) / 12) + ((day ? day - 1 : 0) / 372);
  if (qualifier === 'before') sortKey -= 0.001;
  if (qualifier === 'after') sortKey += 0.001;

  let core;
  if (precision === 'day') core = `${MONTHS[month - 1]} ${day}, ${year}`;
  else if (precision === 'month') core = `${MONTHS[month - 1]} ${year}`;
  else core = `${year}`;

  let display = core;
  if (qualifier === 'about') display = `c. ${core}`;
  else if (qualifier === 'before') display = `before ${core}`;
  else if (qualifier === 'after') display = `after ${core}`;

  return { raw, known: true, year, month, day, precision, qualifier, sortKey, display };
}

export const LESSON_LINE = /\{\s*(lesson|mistake)\s*:\s*([a-zA-Z][\w-]*)\s*\}\s*(.*)$/;
const stripBullet = (line) => line.replace(/^[\s>*\-+\d.)]+/, '');

// Scan a person's body for inline {lesson: theme} / {mistake: theme} markers.
export function scanLessons(body) {
  const out = [];
  if (!body) return out;
  for (const line of String(body).split(/\r?\n/)) {
    const m = stripBullet(line).match(LESSON_LINE);
    if (m) out.push({ kind: m[1].toLowerCase(), theme: m[2].toLowerCase(), text: m[3].trim() });
  }
  return out;
}

// The prose with lesson-marker lines and the "Lessons & Mistakes" heading removed,
// so a profile can render a clean story and show lessons as styled cards instead.
export function storyProse(body) {
  if (!body) return '';
  const kept = [];
  for (const line of String(body).split(/\r?\n/)) {
    if (LESSON_LINE.test(stripBullet(line))) continue;
    if (/^#{1,6}\s*lessons?\b/i.test(line.trim())) continue;
    if (/^#{1,6}\s+story\s*$/i.test(line.trim())) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
