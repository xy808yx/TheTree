// Timeline: the family laid out across the years. Births, deaths, marriages and
// their endings become dated events (via parse.js sortKeys), sorted and grouped
// by decade so you can read the family forward through its eras. Dates that
// don't parse aren't dropped — they're listed, undated, at the end.

import { el, clear } from '../dom.js';
import { store, displayName } from '../store.js';

const TYPE_ORDER = { birth: 0, union: 1, 'union-end': 2, death: 3 };

function partners(u) {
  return (u.data.partners || []).map((id) => store.getPerson(id)).filter(Boolean);
}

function buildEvents() {
  const events = [];
  const undated = [];

  for (const p of store.allPeople()) {
    if (p.birth.known) {
      events.push({ sortKey: p.birth.sortKey, year: p.birth.year, when: p.birth.display, type: 'birth', people: [p], place: place(p.data.birth) });
    } else if (p.birth.raw) {
      undated.push({ type: 'birth', people: [p], raw: p.birth.raw });
    }
    if (p.death.known) {
      events.push({ sortKey: p.death.sortKey, year: p.death.year, when: p.death.display, type: 'death', people: [p], place: place(p.data.death) });
    } else if (p.death.raw && !p.death.living) {
      undated.push({ type: 'death', people: [p], raw: p.death.raw });
    }
  }

  for (const u of store.allUnions()) {
    const ppl = partners(u);
    if (!ppl.length) continue;
    if (u.start.known) {
      events.push({ sortKey: u.start.sortKey, year: u.start.year, when: u.start.display, type: 'union', utype: u.data.type, people: ppl });
    }
    // Only show an ending when it's a separation; a widowing already shows as a death.
    const status = u.data.status;
    if (u.end.known && (status === 'divorced' || status === 'separated' || status === 'ended')) {
      events.push({ sortKey: u.end.sortKey, year: u.end.year, when: u.end.display, type: 'union-end', status, people: ppl });
    }
  }

  events.sort((a, b) => a.sortKey - b.sortKey || (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]));
  return { events, undated };
}

function place(d) { return (d && d.place) || ''; }

function peopleLinks(people) {
  const out = [];
  people.forEach((p, i) => {
    if (i) out.push(el('span', { class: 'tl-amp' }, people.length === 2 ? ' & ' : ', '));
    out.push(el('a', { class: 'tl-person', href: `#/person/${p.id}` }, displayName(p)));
  });
  return out;
}

function verb(ev) {
  if (ev.type === 'birth') return 'born';
  if (ev.type === 'death') return 'died';
  if (ev.type === 'union') {
    return ev.utype === 'partnership' ? 'began a partnership'
      : ev.utype === 'unmarried' ? 'together'
        : 'married';
  }
  if (ev.type === 'union-end') return ev.status === 'divorced' ? 'divorced' : ev.status === 'separated' ? 'separated' : 'parted';
  return '';
}

function eventRow(ev) {
  const fineWhen = ev.when && /\s/.test(ev.when) ? ev.when : null; // month/day precision worth showing in full
  return el('div', { class: `tl-event tl-${ev.type}`, title: fineWhen || undefined },
    el('div', { class: 'tl-year' }, String(ev.year)),
    el('div', { class: 'tl-rail' }, el('span', { class: 'tl-dot' })),
    el('div', { class: 'tl-body' },
      el('span', { class: 'tl-line' }, ...peopleLinks(ev.people), ' ', el('span', { class: 'tl-what' }, verb(ev))),
      ev.place ? el('span', { class: 'tl-place' }, ev.place) : null,
      fineWhen ? el('span', { class: 'tl-fine' }, fineWhen) : null));
}

export function renderTimeline(view) {
  clear(view);
  const { events, undated } = buildEvents();

  const wrap = el('section', { class: 'timeline' },
    el('h1', { class: 'page-title' }, 'Timeline'),
    el('p', { class: 'page-intro' },
      'The family read forward through the years — births, marriages, and partings, in the order they happened.'));

  if (!events.length) {
    wrap.append(el('p', { class: 'empty-note' }, 'No dated events yet. Add birth or death years to people, or dates to marriages, and they will appear here.'));
    view.append(wrap);
    return;
  }

  const first = events[0].year, last = events[events.length - 1].year;
  wrap.append(el('p', { class: 'tl-span' }, `${first}–${last} · ${events.length} events`));

  const track = el('div', { class: 'tl-track' });
  let currentDecade = null;
  for (const ev of events) {
    const decade = Math.floor(ev.year / 10) * 10;
    if (decade !== currentDecade) {
      currentDecade = decade;
      track.append(el('div', { class: 'tl-era' },
        el('div', { class: 'tl-year' }),
        el('div', { class: 'tl-rail' }, el('span', { class: 'tl-era-node' })),
        el('div', { class: 'tl-era-label' }, `${decade}s`)));
    }
    track.append(eventRow(ev));
  }
  wrap.append(track);

  if (undated.length) {
    const list = el('ul', { class: 'tl-undated-list' });
    for (const u of undated) {
      list.append(el('li', {},
        ...peopleLinks(u.people), ' ', el('span', { class: 'tl-what' }, u.type === 'birth' ? 'born' : 'died'),
        el('span', { class: 'tl-place' }, `“${u.raw}”`)));
    }
    wrap.append(
      el('h2', { class: 'tl-undated-title' }, 'Dates not yet placed'),
      el('p', { class: 'page-intro', style: { marginBottom: '.6rem' } }, 'Recorded, but without a year specific enough to position on the line.'),
      list);
  }

  view.append(wrap);
}
