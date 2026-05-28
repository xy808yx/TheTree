// Person editor: core facts, trait tags, a story box with an evocative-prompt
// library, photos, and family links. Writes plain files when an archive folder
// is connected; in demo mode it updates the in-memory store only (not saved).

import { el, clear } from '../dom.js';
import { store, displayName, uid } from '../store.js';
import { writePerson, writeUnion, importPhoto } from '../fsa.js';
import { lookupPlace, parseLatLng } from '../geo.js';

const STORY_PROMPTS = [
  'What were they known for?',
  'A decision they made that you admire',
  'What did money teach them?',
  'A talent, skill, or trade',
  'How did they handle a hard time?',
  'What would they want you to remember?',
];

function commaList(s) { return String(s || '').split(',').map((x) => x.trim()).filter(Boolean); }

export function openPersonEditor({ root, person }) {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  const isNew = !person;
  const data = person ? JSON.parse(JSON.stringify(person.data)) : { id: uid('p'), unions: [], parents_union: null };
  const names = data.names || (data.names = {});
  const body0 = person ? person.body : '';

  const f = {}; // field refs
  const row = (label, input, hint) => el('div', { class: 'form-row' },
    el('label', {}, label), input, hint ? el('div', { class: 'hint' }, hint) : null);

  f.display = el('input', { type: 'text', value: names.display || '', placeholder: 'e.g. Eleanor Vance' });
  f.given = el('input', { type: 'text', value: names.given || '' });
  f.family = el('input', { type: 'text', value: names.family || '' });
  f.maiden = el('input', { type: 'text', value: names.maiden || '' });
  f.aka = el('input', { type: 'text', value: (names.also_known_as || []).join(', '), placeholder: 'comma-separated' });
  f.sex = el('select', {}, ...['', 'F', 'M', 'other'].map((v) => el('option', { value: v, selected: (data.sex || '') === v || undefined }, v || '—')));
  f.birth = el('input', { type: 'text', value: (data.birth && data.birth.date) || '' });
  f.birthPlace = el('input', { type: 'text', value: (data.birth && data.birth.place) || '' });
  f.death = el('input', { type: 'text', value: (data.death && data.death.date) || '' });
  f.deathPlace = el('input', { type: 'text', value: (data.death && data.death.place) || '' });
  const birthGeo = makeGeo(f.birthPlace, data.birth);
  const deathGeo = makeGeo(f.deathPlace, data.death);
  f.living = el('input', { type: 'checkbox' }); f.living.checked = data.living === true;
  f.talent = el('input', { type: 'text', value: ((data.tags && data.tags.talent) || []).join(', '), placeholder: 'running, painting…' });
  f.health = el('input', { type: 'text', value: ((data.tags && data.tags.health) || []).join(', '), placeholder: 'heart-disease…' });
  f.story = el('textarea', { placeholder: 'Their story. Add lessons with a line like:  {lesson: money} …  or  {mistake: health} …' }, body0);

  const promptBar = el('div', { class: 'prompt-library' },
    ...STORY_PROMPTS.map((q) => el('button', { type: 'button', class: 'prompt-chip', onclick: () => insert(f.story, `\n\n**${q}**\n`) }, q)),
    el('button', { type: 'button', class: 'prompt-chip', onclick: () => insert(f.story, '\n- {lesson: money} ') }, '+ lesson'),
    el('button', { type: 'button', class: 'prompt-chip', onclick: () => insert(f.story, '\n- {mistake: health} ') }, '+ mistake'));

  // family links
  const unionOptions = [el('option', { value: '' }, 'Unknown / not recorded'),
    ...store.allUnions().map((u) => el('option', { value: u.id, selected: data.parents_union === u.id || undefined }, unionLabel(u)))];
  f.parents = el('select', {}, ...unionOptions);
  const curRel = parentsRelation(person);
  f.relation = el('select', {}, ...['biological', 'adopted', 'step'].map((v) => el('option', { value: v, selected: curRel === v || undefined }, v)));
  f.spouse = el('select', {}, el('option', { value: '' }, '— none —'),
    ...store.allPeople().filter((p) => p.id !== data.id).sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .map((p) => el('option', { value: p.id }, displayName(p))));

  // photos (archive only)
  const photoStatus = el('div', { class: 'hint' });
  const photoInput = el('input', { type: 'file', accept: 'image/*', onchange: (e) => addPhotos(e.target.files) });
  data.photos = data.photos || [];
  async function addPhotos(files) {
    if (!root) { photoStatus.textContent = 'Photos can be added once you open an archive folder.'; return; }
    for (const file of files) {
      try { const name = await importPhoto(root, data.id, file); data.photos.push({ file: name, caption: '', date: '' }); photoStatus.textContent = `Added ${data.photos.length} photo(s).`; }
      catch (err) { photoStatus.textContent = err.message; }
    }
  }

  const err = el('div', { class: 'hint', style: { color: 'var(--oxblood)' } });

  async function save() {
    const display = f.display.value.trim();
    if (!display && !f.given.value.trim()) { err.textContent = 'Please enter at least a name.'; return; }
    names.display = display || [f.given.value, f.family.value].filter(Boolean).join(' ').trim();
    names.given = f.given.value.trim() || undefined;
    names.family = f.family.value.trim() || undefined;
    names.maiden = f.maiden.value.trim() || undefined;
    const aka = commaList(f.aka.value); names.also_known_as = aka.length ? aka : undefined;
    data.sex = f.sex.value || undefined;
    data.birth = withCoords(clean({ date: f.birth.value.trim(), place: f.birthPlace.value.trim() }), birthGeo);
    data.death = withCoords(clean({ date: f.death.value.trim(), place: f.deathPlace.value.trim() }), deathGeo);
    data.living = f.living.checked || undefined;
    const tags = data.tags || {};
    setTag(tags, 'talent', commaList(f.talent.value));
    setTag(tags, 'health', commaList(f.health.value));
    data.tags = Object.keys(tags).length ? tags : undefined;
    const body = f.story.value.trim();

    try {
      await persistPerson(root, data, body);
      await applyParents(root, data, f.parents.value || null, f.relation.value);
      if (f.spouse.value) await applySpouse(root, data, f.spouse.value);
      close();
      window.dispatchEvent(new CustomEvent('data:changed', { detail: { focus: data.id } }));
    } catch (e) { err.textContent = 'Could not save: ' + e.message; }
  }

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  function close() { backdrop.remove(); }

  backdrop.append(el('div', { class: 'modal' },
    el('h2', {}, isNew ? 'Add a person' : `Edit ${displayName(person)}`),
    row('Full name', f.display),
    el('div', { class: 'form-grid' }, row('Given', f.given), row('Family', f.family), row('Maiden', f.maiden), row('Sex', f.sex)),
    row('Also known as', f.aka),
    el('div', { class: 'form-grid' },
      row('Born', f.birth, 'e.g. 1938-04-12, 1938, or “abt 1850”'),
      row('Birthplace', el('div', {}, f.birthPlace, birthGeo.wrap), 'coordinates fill in automatically, offline'),
      row('Died', f.death, 'leave blank if living'),
      row('Place of death', el('div', {}, f.deathPlace, deathGeo.wrap))),
    el('div', { class: 'form-row' }, el('label', {}, el('span', {}, 'Living'), ' ', f.living)),
    el('div', { class: 'form-grid' }, row('Talents', f.talent), row('Health', f.health)),
    row('Story', el('div', {}, f.story, promptBar)),
    el('hr', { class: 'section-rule' }),
    el('div', { class: 'form-grid' }, row('Parents (a union)', f.parents), row('Relation to parents', f.relation)),
    row('Add a spouse / partner', f.spouse, 'creates a marriage link to the chosen person'),
    root ? row('Add photos', el('div', {}, photoInput, photoStatus)) : null,
    err,
    el('div', { class: 'form-actions' },
      el('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: save }, isNew ? 'Add person' : 'Save')),
  ));
  document.body.append(backdrop);
  f.display.focus();
}

// ---- persistence helpers (write files in archive mode; in-memory in demo) ----
async function persistPerson(root, data, body) {
  if (root) await writePerson(root, data, body);
  store.upsertPerson({ data, body });
}
async function persistUnion(root, u) {
  if (root) await writeUnion(root, u.data, u.body || '');
  store.upsertUnion({ data: u.data, body: u.body || '' });
}

async function applyParents(root, data, newPU, relation) {
  const oldPU = store.getPerson(data.id) ? store.getPerson(data.id).data.parents_union : null;
  // remove from old union's children if it changed
  if (oldPU && oldPU !== newPU) {
    const ou = store.getUnion(oldPU);
    if (ou) { ou.data.children = (ou.data.children || []).filter((c) => c.person !== data.id); await persistUnion(root, ou); }
  }
  data.parents_union = newPU || null;
  if (newPU) {
    const u = store.getUnion(newPU);
    if (u) {
      const kids = u.data.children || (u.data.children = []);
      const entry = kids.find((c) => c.person === data.id);
      if (entry) entry.relation = relation; else kids.push({ person: data.id, relation });
      await persistUnion(root, u);
    }
  }
  await persistPerson(root, data, store.getPerson(data.id) ? store.getPerson(data.id).body : '');
}

async function applySpouse(root, data, spouseId) {
  const exists = store.allUnions().find((u) => (u.data.partners || []).includes(data.id) && (u.data.partners || []).includes(spouseId));
  if (exists) return;
  const u = { data: { id: uid('u'), type: 'marriage', partners: [data.id, spouseId], status: 'married', children: [] }, body: '' };
  await persistUnion(root, u);
  for (const pid of [data.id, spouseId]) {
    const p = store.getPerson(pid);
    if (!p) continue;
    p.data.unions = [...new Set([...(p.data.unions || []), u.data.id])];
    await persistPerson(root, p.data, p.body);
  }
}

// ---- small utilities ----
function insert(textarea, snippet) {
  const s = textarea.selectionStart ?? textarea.value.length;
  textarea.value = textarea.value.slice(0, s) + snippet + textarea.value.slice(s);
  textarea.focus();
  const pos = s + snippet.length;
  textarea.setSelectionRange(pos, pos);
}
function clean(obj) { const o = {}; for (const [k, v] of Object.entries(obj)) if (v) o[k] = v; return Object.keys(o).length ? o : undefined; }

// A place field paired with an offline coordinate lookup. Typing a place and
// tabbing out resolves coordinates from the bundled gazetteer (no network); the
// user can also paste lat/lng by hand or click Locate to refresh.
function makeGeo(placeInput, existing) {
  const haveOld = existing && isFinite(+existing.lat) && isFinite(+existing.lng);
  const coords = el('input', { type: 'text', placeholder: 'lat, lng', value: haveOld ? `${existing.lat}, ${existing.lng}` : '' });
  const status = el('div', { class: 'coord-status' });
  const set = (msg, cls) => { status.textContent = msg; status.className = 'coord-status' + (cls ? ' ' + cls : ''); };
  async function locate(force) {
    const place = placeInput.value.trim();
    if (!place) { set(''); return; }
    if (!force && parseLatLng(coords.value)) return; // keep coords we already have
    set('Looking up…');
    try {
      const hit = await lookupPlace(place);
      if (hit) { coords.value = `${hit.lat}, ${hit.lng}`; set(`Found ${hit.label}${hit.country ? ', ' + hit.country : ''} — pinned offline`, 'is-found'); }
      else set('Not in the offline list — paste coordinates (right-click a spot in any map app → copy).', 'is-missing');
    } catch (e) { set('Lookup unavailable: ' + e.message, 'is-missing'); }
  }
  placeInput.addEventListener('blur', () => locate(false));
  coords.addEventListener('input', () => set(''));
  const wrap = el('div', {},
    el('div', { class: 'coord-row' }, coords, el('button', { type: 'button', class: 'btn btn-small', onclick: () => locate(true) }, 'Locate')),
    status);
  return { coords, wrap };
}

// Attach lat/lng from a geo field to a birth/death object (0 is a valid latitude,
// so we set the numbers explicitly rather than routing them through clean()).
function withCoords(obj, geo) {
  const c = parseLatLng(geo.coords.value);
  if (!c) return obj;
  const o = obj || {};
  o.lat = c.lat; o.lng = c.lng;
  return o;
}
function setTag(tags, key, arr) { if (arr.length) tags[key] = arr; else delete tags[key]; }
function unionLabel(u) {
  const names = (u.data.partners || []).map((id) => { const p = store.getPerson(id); return p ? displayName(p) : '?'; });
  return names.join(' & ') || u.id;
}
function parentsRelation(person) {
  if (!person || !person.data.parents_union) return 'biological';
  const u = store.getUnion(person.data.parents_union);
  const e = u && (u.data.children || []).find((c) => c.person === person.id);
  return (e && e.relation) || 'biological';
}
