// In-memory model + relationship resolution. People and unions are indexed by
// id; relationships live on union records (GEDCOM-style), so all traversal
// (parents, spouses, children, ancestors, descendants) resolves through here.

import { parseDate, scanLessons } from './parse.js';

export const THEMES = ['money', 'health', 'relationships', 'work', 'faith'];

export function slugify(s) {
  return String(s || '')
    .toLowerCase().normalize('NFKD')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .slice(0, 48) || 'unnamed';
}

export function uid(prefix = 'p') {
  const r = (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
  return `${prefix}-${r}`;
}

function normPerson(doc) {
  const data = doc.data || {};
  return {
    kind: 'person', id: data.id || doc.id, data, body: doc.body || '',
    slug: data.slug || slugify((data.names && (data.names.display || data.names.given)) || data.id),
    birth: parseDate(data.birth && data.birth.date),
    death: parseDate(data.death && data.death.date),
  };
}

function normUnion(doc) {
  const data = doc.data || {};
  return {
    kind: 'union', id: data.id || doc.id, data, body: doc.body || '',
    start: parseDate(data.start), end: parseDate(data.end),
  };
}

export function displayName(p) {
  if (!p) return 'Unknown';
  const n = p.data.names || {};
  if (n.display) return n.display;
  const joined = [n.given, n.family].filter(Boolean).join(' ').trim();
  return joined || p.slug || 'Unknown';
}

export function lifespan(p) {
  if (!p) return '';
  const by = p.birth.known ? p.birth.year : null;
  const dy = p.death.known ? p.death.year : null;
  const living = p.data.living === true || p.death.living === true;
  if (by && dy) return `${by}–${dy}`;
  if (by && living) return `b. ${by}`;
  if (by) return `${by}–`;
  if (dy) return `d. ${dy}`;
  return '';
}

class Store {
  constructor() { this.people = new Map(); this.unions = new Map(); }
  clear() { this.people.clear(); this.unions.clear(); return this; }

  // docs: [{ kind:'person'|'union', id?, data, body }]
  loadDocs(docs) {
    this.clear();
    for (const d of docs) {
      if (d.kind === 'person') { const r = normPerson(d); this.people.set(r.id, r); }
      else if (d.kind === 'union') { const r = normUnion(d); this.unions.set(r.id, r); }
    }
    return this;
  }

  upsertPerson(doc) { const r = normPerson(doc); this.people.set(r.id, r); return r; }
  upsertUnion(doc) { const r = normUnion(doc); this.unions.set(r.id, r); return r; }

  getPerson(id) { return this.people.get(id) || null; }
  getUnion(id) { return this.unions.get(id) || null; }
  allPeople() { return [...this.people.values()]; }
  allUnions() { return [...this.unions.values()]; }
  get size() { return this.people.size; }

  // Unions this person is a partner in.
  unionsOf(p) {
    const ids = (p && p.data.unions) || [];
    return ids.map((id) => this.getUnion(id)).filter(Boolean);
  }

  // Spouses/partners across all of this person's unions: [{ person, union }].
  partnersOf(p) {
    const out = [];
    for (const u of this.unionsOf(p)) {
      for (const pid of u.data.partners || []) {
        if (pid !== p.id) { const other = this.getPerson(pid); if (other) out.push({ person: other, union: u }); }
      }
    }
    return out;
  }

  // Children across all of this person's unions: [{ person, relation, union }].
  childrenOf(p) {
    const out = [];
    for (const u of this.unionsOf(p)) {
      for (const c of u.data.children || []) {
        const child = this.getPerson(c.person);
        if (child) out.push({ person: child, relation: c.relation || 'biological', union: u });
      }
    }
    return out;
  }

  parentsUnionOf(p) { return p && p.data.parents_union ? this.getUnion(p.data.parents_union) : null; }

  // Parents via parents_union: [{ person, relation, union }]. relation = how THIS
  // person joined the union (biological/adopted/step), enabling honest labels.
  parentsOf(p) {
    const u = this.parentsUnionOf(p);
    if (!u) return [];
    const childEntry = (u.data.children || []).find((c) => c.person === p.id);
    const relation = childEntry ? (childEntry.relation || 'biological') : 'biological';
    return (u.data.partners || [])
      .map((id) => this.getPerson(id))
      .filter(Boolean)
      .map((person) => ({ person, relation, union: u }));
  }

  // Co-children of the same parents_union (excludes self).
  siblingsOf(p) {
    const u = this.parentsUnionOf(p);
    if (!u) return [];
    return (u.data.children || [])
      .filter((c) => c.person !== p.id)
      .map((c) => ({ person: this.getPerson(c.person), relation: c.relation || 'biological' }))
      .filter((x) => x.person);
  }

  // All {lesson}/{mistake} markers across everyone, grouped by theme.
  // -> { theme: [{ person, kind, text }] }
  lessonsByTheme() {
    const groups = {};
    for (const p of this.allPeople()) {
      for (const l of scanLessons(p.body)) {
        (groups[l.theme] || (groups[l.theme] = [])).push({ person: p, kind: l.kind, text: l.text });
      }
    }
    return groups;
  }

  // Flat list of tags for the query view: [{ category, value, people: [p,...] }].
  tagIndex() {
    const map = new Map(); // `${category}::${value}` -> {category,value,people:Set}
    for (const p of this.allPeople()) {
      const tags = p.data.tags || {};
      for (const [category, raw] of Object.entries(tags)) {
        const values = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
        for (const value of values) {
          const key = `${category}::${value}`;
          if (!map.has(key)) map.set(key, { category, value: String(value), people: [] });
          map.get(key).people.push(p);
        }
      }
    }
    return [...map.values()].sort((a, b) =>
      a.category.localeCompare(b.category) || a.value.localeCompare(b.value));
  }

  // Free-text search over names for the jump-to-person box.
  search(q) {
    const needle = String(q || '').toLowerCase().trim();
    if (!needle) return [];
    return this.allPeople()
      .filter((p) => displayName(p).toLowerCase().includes(needle))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .slice(0, 20);
  }
}

export const store = new Store();
