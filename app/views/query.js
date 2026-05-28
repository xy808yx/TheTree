// People directory: search by name, or browse/filter by trait tags
// ("show everyone who…").

import { el, clear, go } from '../dom.js';
import { store, displayName, lifespan } from '../store.js';

export function renderQuery(view) {
  clear(view);
  const state = { query: '', tag: null };
  const tags = store.tagIndex();

  const results = el('div', { class: 'results' });
  const cloud = el('div', { class: 'tag-cloud' });

  function renderResults() {
    clear(results);
    let people;
    let caption;
    if (state.query) { people = store.search(state.query); caption = `Matches for “${state.query}”`; }
    else if (state.tag) {
      const found = tags.find((t) => `${t.category}::${t.value}` === state.tag);
      people = found ? [...found.people].sort((a, b) => displayName(a).localeCompare(displayName(b))) : [];
      caption = found ? `${found.category}: ${found.value}` : '';
    } else {
      people = store.allPeople().sort((a, b) => displayName(a).localeCompare(displayName(b)));
      caption = `All ${people.length} people`;
    }
    results.append(el('div', { class: 'theme-count', style: { marginBottom: '.5rem' } }, caption));
    if (!people.length) { results.append(el('p', { class: 'empty-note' }, 'No one matches.')); return; }
    for (const p of people) {
      results.append(el('a', { class: 'person-row', href: `#/person/${p.id}` },
        el('span', {}, displayName(p)),
        el('span', { class: 'pr-life' }, lifespan(p))));
    }
  }

  function renderCloud() {
    clear(cloud);
    for (const t of tags) {
      const key = `${t.category}::${t.value}`;
      cloud.append(el('button', {
        class: 'tag-chip' + (state.tag === key ? ' is-active' : ''),
        onclick: () => { state.tag = state.tag === key ? null : key; state.query = ''; search.value = ''; renderCloud(); renderResults(); },
      }, `${t.category}: ${t.value}`, el('span', { class: 'tc-count' }, t.people.length)));
    }
  }

  const search = el('input', {
    class: 'searchbox', type: 'search', placeholder: 'Search people by name…', 'aria-label': 'Search people by name',
    oninput: (e) => { state.query = e.target.value.trim(); state.tag = null; renderCloud(); renderResults(); },
  });

  const wrap = el('section', { class: 'query' },
    el('h1', { class: 'landing-title', style: { fontSize: '2.2rem', textAlign: 'left' } }, 'People'),
    search,
    tags.length ? el('p', { class: 'section-title', style: { marginTop: '1.25rem' } }, 'Browse by trait') : null,
    cloud,
    results);

  renderCloud();
  renderResults();
  view.append(wrap);
}
