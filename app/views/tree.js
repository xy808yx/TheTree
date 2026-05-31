// Focus-on-person tree. Descendants and ancestors are laid out as separate
// subtrees, both anchored on the focus (col 0); siblings (incl. half/step/
// adopted) sit left of the focus and spouses to the right. Every parent→child
// and spouse edge is then derived from the data, so half-siblings, step-parents
// and remarriages all connect correctly. HTML cards over an SVG edge layer.

import { el, clear, go } from '../dom.js';
import { store, displayName, lifespan } from '../store.js';

const NODE_W = 150, NODE_H = 64, COLSTEP = 178, ROWSTEP = 134, PAD = 48;
const MAX_UP = 3, MAX_DOWN = 2;

const SVG = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}

export function renderTree(view, focusId) {
  clear(view);
  const focus = store.getPerson(focusId);
  if (!focus) { view.append(el('p', { class: 'empty-note' }, 'No one to show yet.')); return; }

  const nodes = [];
  const byId = new Map();
  const seen = new Set();
  let cursor = 0;

  function add(person, gen, col, kind, relation) {
    const n = { person, gen, col, kind, relation: relation || null };
    nodes.push(n); byId.set(person.id, n); return n;
  }

  // ---- descendants (focus subtree) ----
  function layoutDesc(person, gen, relation) {
    if (seen.has(person.id)) return byId.get(person.id) ? byId.get(person.id).col : cursor;
    seen.add(person.id);
    const kids = gen < MAX_DOWN ? store.childrenOf(person).filter((c) => !seen.has(c.person.id)) : [];
    let col;
    if (!kids.length) { col = cursor; cursor += 1; }
    else {
      const cols = kids.map((c) => layoutDesc(c.person, gen + 1, c.relation));
      col = (cols[0] + cols[cols.length - 1]) / 2;
    }
    add(person, gen, col, gen === 0 ? 'focus' : 'desc', relation);
    return col;
  }
  layoutDesc(focus, 0, null);

  // normalize so focus sits at col 0
  const focusCol = byId.get(focus.id).col;
  for (const n of nodes) n.col -= focusCol;

  // ---- siblings (left) incl. half/step/adopted ----
  let leftCol = -1;
  for (const sib of allSiblings(focus)) {
    if (byId.has(sib.person.id)) continue;
    add(sib.person, 0, leftCol, 'sibling', sib.label);
    leftCol -= 1;
  }

  // ---- spouses (right) ----
  let rightCol = 1;
  for (const { person: sp } of store.partnersOf(focus)) {
    if (byId.has(sp.id)) continue;
    add(sp, 0, rightCol, 'spouse', null);
    rightCol += 1;
  }

  // ---- ancestors (pedigree), own cursor then aligned to focus ----
  let cursorA = 0;
  const anc = [];
  const ancSeen = new Map(); // personId -> col; breaks cycles / pedigree-collapse loops
  function layoutAnc(person, gen) {
    if (ancSeen.has(person.id)) return ancSeen.get(person.id); // already placed — never recurse a loop
    ancSeen.set(person.id, cursorA); // tentative slot so a cyclic ancestor resolves instead of hanging
    const parents = gen > -MAX_UP ? store.parentsOf(person).map((x) => x.person) : [];
    let col;
    if (!parents.length) { col = cursorA; cursorA += 1; }
    else { const cols = parents.map((p) => layoutAnc(p, gen - 1)); col = cols.reduce((a, b) => a + b, 0) / cols.length; }
    ancSeen.set(person.id, col);
    if (gen !== 0) anc.push({ person, gen, col });
    return col;
  }
  const focusAncCol = layoutAnc(focus, 0);
  for (const r of anc) if (!byId.has(r.person.id)) add(r.person, r.gen, r.col - focusAncCol, 'anc', ancRelation(r.person, focus));

  // ---- position to pixels ----
  const minCol = Math.min(...nodes.map((n) => n.col));
  const minGen = Math.min(...nodes.map((n) => n.gen));
  const maxCol = Math.max(...nodes.map((n) => n.col));
  const maxGen = Math.max(...nodes.map((n) => n.gen));
  for (const n of nodes) {
    n.px = PAD + (n.col - minCol) * COLSTEP;
    n.py = PAD + (n.gen - minGen) * ROWSTEP;
  }
  const width = PAD * 2 + (maxCol - minCol) * COLSTEP + NODE_W;
  const height = PAD * 2 + (maxGen - minGen) * ROWSTEP + NODE_H;

  // ---- edges (derived from data) ----
  const edges = [];
  for (const n of nodes) {
    for (const { person: par } of store.parentsOf(n.person)) {
      const pn = par && byId.get(par.id);
      if (pn) edges.push(elbow(n, pn));
    }
  }
  const drawnSpouse = new Set();
  for (const u of store.allUnions()) {
    const parts = (u.data.partners || []).map((id) => byId.get(id)).filter(Boolean);
    if (parts.length === 2) {
      const key = parts.map((p) => p.person.id).sort().join('|');
      if (!drawnSpouse.has(key)) { drawnSpouse.add(key); edges.push(spouseEdge(parts[0], parts[1])); }
    }
  }

  // ---- DOM ----
  let scale = 1;
  const canvas = el('div', { class: 'tree-canvas', style: { width: width + 'px', height: height + 'px' } });
  const svg = svgEl('svg', { class: 'tree-edges', width, height, viewBox: `0 0 ${width} ${height}` });
  for (const e of edges) svg.append(svgEl('path', { d: e.d, class: e.cls || '' }));
  canvas.append(svg);
  for (const n of nodes) canvas.append(card(n, focus.id));

  const wrap = el('div', { class: 'tree-wrap' }, canvas);

  const zoomLabel = el('span', { class: 'tree-zoom-label', title: 'Zoom' }, '100%');
  const setScale = (s) => {
    scale = Math.min(1.6, Math.max(0.4, s));
    canvas.style.transform = `scale(${scale})`;
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  };
  const zoomGroup = el('div', { class: 'btn-group', role: 'group', 'aria-label': 'Zoom' },
    el('button', { class: 'btn btn-small', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => setScale(scale - 0.15) }, '−'),
    zoomLabel,
    el('button', { class: 'btn btn-small', title: 'Reset zoom', onclick: () => setScale(1) }, 'Reset'),
    el('button', { class: 'btn btn-small', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => setScale(scale + 0.15) }, '+'));

  const toolbar = el('div', { class: 'tree-toolbar' },
    el('span', { class: 'tree-crumb' }, 'Centered on ', el('strong', {}, displayName(focus)), ' — click any card to re-center'),
    el('a', { class: 'btn btn-small', href: `#/person/${focus.id}` }, 'Open profile'),
    el('span', { class: 'toolbar-spacer' }),
    zoomGroup);

  const legend = el('div', { class: 'tree-legend' },
    el('span', { class: 'tree-legend-item' }, el('span', { class: 'tree-legend-swatch sex-F' }), 'Female'),
    el('span', { class: 'tree-legend-item' }, el('span', { class: 'tree-legend-swatch sex-M' }), 'Male'),
    el('span', { class: 'tree-legend-item' }, el('span', { class: 'tree-legend-swatch focus' }), 'Click a card to re-center'),
  );

  view.append(toolbar, wrap, legend);
}

function card(n, focusId) {
  const p = n.person;
  const sexClass = p.data.sex === 'F' ? ' sex-F' : p.data.sex === 'M' ? ' sex-M' : '';
  const isFocus = p.id === focusId;
  const c = el('div', {
    class: 'node-card' + sexClass + (isFocus ? ' is-focus' : ''),
    style: { left: n.px + 'px', top: n.py + 'px' },
    title: isFocus ? 'This is the focus — click to open profile' : `Click to center on ${displayName(p)}`,
    onclick: () => { if (isFocus) go(`#/person/${p.id}`); else go(`#/tree/${p.id}`); },
  },
    el('div', { class: 'node-name' }, displayName(p)),
    lifespan(p) ? el('div', { class: 'node-life' }, lifespan(p)) : null,
    n.relation && n.relation !== 'biological' ? el('div', { class: 'node-rel' }, n.relation) : null);
  return c;
}

function elbow(childNode, parentNode) {
  const cx = childNode.px + NODE_W / 2, ct = childNode.py;
  const px = parentNode.px + NODE_W / 2, pb = parentNode.py + NODE_H;
  const mid = (pb + ct) / 2;
  return { d: `M ${cx} ${ct} L ${cx} ${mid} L ${px} ${mid} L ${px} ${pb}` };
}

function spouseEdge(a, b) {
  const left = a.px <= b.px ? a : b, right = a.px <= b.px ? b : a;
  return { d: `M ${left.px + NODE_W} ${left.py + NODE_H / 2} L ${right.px} ${right.py + NODE_H / 2}`, cls: 'is-spouse' };
}

// Siblings across BOTH parents' unions; labels full(null)/adopted/step/half.
function allSiblings(focus) {
  const pu = store.parentsUnionOf(focus);
  if (!pu) return [];
  const parents = (pu.data.partners || []).map((id) => store.getPerson(id)).filter(Boolean);
  const out = new Map();
  for (const parent of parents) {
    for (const c of store.childrenOf(parent)) {
      if (c.person.id === focus.id || out.has(c.person.id)) continue;
      const samePU = c.person.data.parents_union === focus.data.parents_union;
      const label = samePU ? (c.relation !== 'biological' ? c.relation : null) : 'half';
      out.set(c.person.id, { person: c.person, label });
    }
  }
  return [...out.values()];
}

function ancRelation(person, focus) {
  // label a parent of the focus if the focus joined that union non-biologically
  const fpu = store.parentsUnionOf(focus);
  if (fpu && (fpu.data.partners || []).includes(person.id)) {
    const entry = (fpu.data.children || []).find((c) => c.person === focus.id);
    if (entry && entry.relation && entry.relation !== 'biological') return entry.relation;
  }
  return null;
}
