// Map: where the family lived and moved. A self-contained SVG world (vendored
// Natural Earth outline — no tiles, no network) onto which we plot every place
// that has stored coordinates, and draw a gentle arc for each person's journey
// from birthplace to where they died. Coordinates are filled in on entry via the
// offline gazetteer (see geo.js / edit.js); nothing here touches the network.

import { el, clear } from '../dom.js';
import { store, displayName, lifespan } from '../store.js';
import { LAND } from '../vendor/worldmap.js';

const W = 1280, H = 640; // equirectangular canvas (2:1)
const SVG = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  for (const c of kids) if (c != null) n.append(c);
  return n;
}
const projX = (lng) => ((+lng + 180) / 360) * W;
const projY = (lat) => ((90 - +lat) / 180) * H;
const hasCoord = (d) => d && isFinite(+d.lat) && isFinite(+d.lng);

function gather() {
  const places = new Map(); // "lat,lng" -> { lat, lng, name, born:[], died:[] }
  const journeys = [];      // { person, from:{lat,lng}, to:{lat,lng} }
  const unlocated = [];
  const place = (coord, name, person, kind) => {
    const key = `${(+coord.lat).toFixed(3)},${(+coord.lng).toFixed(3)}`;
    let p = places.get(key);
    if (!p) places.set(key, (p = { lat: +coord.lat, lng: +coord.lng, name: name || '', born: [], died: [] }));
    if (name && !p.name) p.name = name;
    (kind === 'died' ? p.died : p.born).push(person);
  };
  for (const person of store.allPeople()) {
    const b = person.data.birth, d = person.data.death;
    const bc = hasCoord(b), dc = hasCoord(d);
    if (bc) place(b, b.place, person, 'born');
    if (dc) place(d, d.place, person, 'died');
    if (bc && dc && (Math.abs(b.lat - d.lat) > 0.05 || Math.abs(b.lng - d.lng) > 0.05)) {
      journeys.push({ person, from: { lat: +b.lat, lng: +b.lng, name: b.place || '' }, to: { lat: +d.lat, lng: +d.lng, name: d.place || '' } });
    }
    if (!bc && !dc) unlocated.push(person);
  }
  return { places: [...places.values()], journeys, unlocated };
}

function arcPath(from, to) {
  const x1 = projX(from.lng), y1 = projY(from.lat), x2 = projX(to.lng), y2 = projY(to.lat);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  // bow the curve perpendicular to the line, scaled gently with distance
  const off = Math.min(120, len * 0.18);
  const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function landPath() {
  let d = '';
  for (const poly of LAND) {
    for (const ring of poly) {
      if (ring.length < 2) continue;
      d += 'M' + ring.map(([lng, lat]) => `${projX(lng).toFixed(1)} ${projY(lat).toFixed(1)}`).join(' L ') + ' Z ';
    }
  }
  return d;
}

export function renderMap(view) {
  clear(view);
  const { places, journeys, unlocated } = gather();

  const wrap = el('section', { class: 'map' },
    el('h1', { class: 'page-title' }, 'Map'),
    el('p', { class: 'page-intro' }, 'Where the family came from and where they went — each line a life’s journey from birthplace to the place they died.'));

  if (!places.length) {
    wrap.append(el('p', { class: 'empty-note' },
      'No places located yet. Add a birthplace or place of death to someone — the editor will look up its coordinates offline and pin it here.'));
    if (unlocated.length) wrap.append(el('p', { class: 'page-intro', style: { marginTop: '.5rem' } }, `${unlocated.length} ${unlocated.length === 1 ? 'person has' : 'people have'} a place recorded but no coordinates yet.`));
    view.append(wrap);
    return;
  }

  // ---- build the SVG ----
  let scale = 1;
  const svg = s('svg', { class: 'map-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  svg.append(s('rect', { x: 0, y: 0, width: W, height: H, class: 'map-ocean' }));
  svg.append(s('path', { d: landPath(), class: 'map-land', 'fill-rule': 'evenodd' }));

  const arcLayer = s('g', { class: 'map-arcs' });
  for (const j of journeys) arcLayer.append(s('path', { d: arcPath(j.from, j.to), class: 'map-arc' },
    s('title', {}, `${displayName(j.person)}: ${j.from.name || 'birthplace'} → ${j.to.name || 'death'}`)));
  svg.append(arcLayer);

  const detail = el('aside', { class: 'map-side' });
  const showPlace = (pl) => {
    clear(detail);
    detail.append(el('h3', { class: 'section-title' }, pl.name || 'This place'));
    const list = (title, people) => people.length ? el('div', { class: 'map-side-group' },
      el('h4', {}, title),
      el('div', { class: 'person-chips' }, people.map((p) => el('a', { class: 'person-link', href: `#/person/${p.id}` },
        displayName(p), lifespan(p) ? el('span', { class: 'pl-life' }, lifespan(p)) : null)))) : null;
    detail.append(list('Born here', pl.born), list('Died here', pl.died));
  };

  const dots = s('g', { class: 'map-dots' });
  for (const pl of places) {
    const n = pl.born.length + pl.died.length;
    const r = 4 + Math.min(9, Math.sqrt(n) * 2.2);
    const cx = projX(pl.lng), cy = projY(pl.lat);
    const dot = s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: r.toFixed(1), class: 'map-dot', tabindex: '0', role: 'button' },
      s('title', {}, `${pl.name || 'Place'} — ${n} ${n === 1 ? 'person' : 'people'}`));
    dot.addEventListener('click', () => { showPlace(pl); highlight(cx, cy); });
    dot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPlace(pl); highlight(cx, cy); } });
    dots.append(dot);
  }
  const ring = s('circle', { r: 0, class: 'map-dot-ring' });
  dots.append(ring);
  function highlight(cx, cy) { ring.setAttribute('cx', cx.toFixed(1)); ring.setAttribute('cy', cy.toFixed(1)); ring.setAttribute('r', 16); }
  svg.append(dots);

  const canvas = el('div', { class: 'map-canvas', style: { width: W + 'px', height: H + 'px' } }, svg);
  const mapWrap = el('div', { class: 'map-wrap' }, canvas);
  const zoomLabel = el('span', { class: 'tree-zoom-label', title: 'Zoom' }, '100%');
  const setScale = (z) => {
    scale = Math.min(4, Math.max(0.5, z));
    canvas.style.transform = `scale(${scale})`;
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  };

  const zoomGroup = el('div', { class: 'btn-group', role: 'group', 'aria-label': 'Zoom' },
    el('button', { class: 'btn btn-small', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => setScale(scale - 0.3) }, '−'),
    zoomLabel,
    el('button', { class: 'btn btn-small', title: 'Reset zoom', onclick: () => setScale(1) }, 'Reset'),
    el('button', { class: 'btn btn-small', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => setScale(scale + 0.3) }, '+'));

  const toolbar = el('div', { class: 'map-toolbar' },
    el('span', { class: 'tree-crumb' }, `${places.length} ${places.length === 1 ? 'place' : 'places'} · ${journeys.length} ${journeys.length === 1 ? 'journey' : 'journeys'}`),
    el('span', { class: 'toolbar-spacer' }),
    zoomGroup);

  // default side content: the journeys, read as a list
  clear(detail);
  detail.append(el('h3', { class: 'section-title' }, journeys.length ? 'Journeys' : 'Places'));
  if (journeys.length) {
    const jl = el('ul', { class: 'journey-list' });
    for (const j of journeys.sort((a, b) => displayName(a.person).localeCompare(displayName(b.person)))) {
      jl.append(el('li', {},
        el('a', { class: 'tl-person', href: `#/person/${j.person.id}` }, displayName(j.person)),
        el('span', { class: 'journey-route' }, `${j.from.name || '—'} → ${j.to.name || '—'}`)));
    }
    detail.append(jl);
  } else {
    detail.append(el('p', { class: 'page-intro' }, 'Select a marker to see who lived there.'));
  }

  const legend = el('div', { class: 'map-legend' },
    el('span', { class: 'map-legend-item' }, el('span', { class: 'map-legend-swatch' }), 'A place lived'),
    el('span', { class: 'map-legend-item' }, el('span', { class: 'map-legend-swatch', style: { transform: 'scale(1.6)' } }), 'Larger = more people'),
    el('span', { class: 'map-legend-item' }, el('span', { class: 'map-legend-swatch arc' }), 'A life’s journey'),
  );

  wrap.append(toolbar, el('div', { class: 'map-layout' }, mapWrap, detail), legend);

  if (unlocated.length) {
    wrap.append(el('p', { class: 'map-unlocated' },
      `${unlocated.length} ${unlocated.length === 1 ? 'person is' : 'people are'} not on the map yet — no place coordinates recorded.`));
  }

  view.append(wrap);

  // center the scroll on the spread of plotted points
  requestAnimationFrame(() => {
    const xs = places.map((p) => projX(p.lng)), ys = places.map((p) => projY(p.lat));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    mapWrap.scrollLeft = cx - mapWrap.clientWidth / 2;
    mapWrap.scrollTop = cy - mapWrap.clientHeight / 2;
  });
}
