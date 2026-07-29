// GEDCOM 5.5.1 export. Our model maps almost 1:1: each person -> INDI, each
// union -> FAM (HUSB/WIFE/CHIL, MARR, DIV). Partial dates convert to GEDCOM date
// phrases (ABT/BEF/AFT), stored coordinates become PLAC/MAP/LATI/LONG, adopted
// children carry a PEDI tag and step relations a FAMC note — so the archive
// opens cleanly in any genealogy program. This is the payoff for modelling
// relationships GEDCOM-style.

import { store, displayName } from './store.js';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const esc = (s) => String(s == null ? '' : s).replace(/\r/g, '').replace(/@/g, '@@');

function gedDate(parsed) {
  if (!parsed || parsed.living) return null;
  if (parsed.known) {
    let core;
    if (parsed.precision === 'day') core = `${parsed.day} ${MON[parsed.month - 1]} ${parsed.year}`;
    else if (parsed.precision === 'month') core = `${MON[parsed.month - 1]} ${parsed.year}`;
    else core = `${parsed.year}`;
    const q = parsed.qualifier === 'about' ? 'ABT ' : parsed.qualifier === 'before' ? 'BEF ' : parsed.qualifier === 'after' ? 'AFT ' : '';
    return q + core;
  }
  return parsed.raw ? `(${esc(parsed.raw)})` : null; // freeform date phrase
}

function eventBlock(out, tag, parsedDate, place) {
  const date = gedDate(parsedDate);
  const lat = place && isFinite(+place.lat) ? +place.lat : null;
  const lng = place && isFinite(+place.lng) ? +place.lng : null;
  const placeName = place && place.place;
  if (!date && !placeName) return;
  out.push(`1 ${tag}`);
  if (date) out.push(`2 DATE ${date}`);
  if (placeName) {
    out.push(`2 PLAC ${esc(placeName)}`);
    if (lat != null && lng != null) {
      out.push('3 MAP');
      out.push(`4 LATI ${lat >= 0 ? 'N' : 'S'}${Math.abs(lat)}`);
      out.push(`4 LONG ${lng >= 0 ? 'E' : 'W'}${Math.abs(lng)}`);
    }
  }
}

function nameLines(out, p) {
  const n = p.data.names || {};
  const given = n.given || '';
  const surname = n.family || '';
  if (given || surname) {
    out.push(`1 NAME ${esc(given)} /${esc(surname)}/`.replace(/\s+\//, ' /'));
    if (given) out.push(`2 GIVN ${esc(given)}`);
    if (surname) out.push(`2 SURN ${esc(surname)}`);
  } else {
    out.push(`1 NAME ${esc(n.display || displayName(p))}`);
  }
  const aka = n.also_known_as || [];
  if (aka.length) out.push(`2 NICK ${esc(aka.join(', '))}`);
  // The maiden name is the PRE-marriage name: a standard alternate NAME with
  // TYPE maiden, not _MARNM (which means the name AFTER marriage — inverted).
  if (n.maiden) {
    out.push(`1 NAME ${esc(given)} /${esc(n.maiden)}/`.replace(/\s+\//, ' /'));
    out.push('2 TYPE maiden');
  }
}

function noteLines(out, text) {
  // Chunk long lines with CONC so no physical line exceeds GEDCOM 5.5.1's
  // 255-char limit (strict importers truncate or reject longer ones). Slice the
  // RAW line at 120 before esc() — escaping doubles '@', so a longer raw chunk
  // could re-break the limit. CONC splits mid-word on purpose: importers may
  // trim spaces adjacent to a CONC break.
  const parts = String(text).replace(/\r/g, '').split('\n');
  parts.forEach((line, i) => {
    let tag = i === 0 ? '1 NOTE' : '2 CONT';
    let s = line;
    do {
      out.push(`${tag} ${esc(s.slice(0, 120))}`);
      s = s.slice(120);
      tag = '2 CONC';
    } while (s);
  });
}

export function buildGedcom() {
  const people = store.allPeople();
  const unions = store.allUnions();
  const indi = new Map(); people.forEach((p, i) => indi.set(p.id, `@I${i + 1}@`));
  const fam = new Map(); unions.forEach((u, i) => fam.set(u.id, `@F${i + 1}@`));

  const out = [];
  const today = new Date();
  out.push('0 HEAD');
  out.push('1 SOUR TheTree');
  out.push('2 NAME The Tree');
  out.push('1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED');
  out.push('1 CHAR UTF-8');
  out.push('1 SUBM @SUB1@'); // 5.5.1 requires a submitter; record is before TRLR
  out.push(`1 DATE ${today.getDate()} ${MON[today.getMonth()]} ${today.getFullYear()}`);

  for (const p of people) {
    out.push(`0 ${indi.get(p.id)} INDI`);
    nameLines(out, p);
    if (p.data.sex === 'M' || p.data.sex === 'F') out.push(`1 SEX ${p.data.sex}`);
    eventBlock(out, 'BIRT', p.birth, p.data.birth);
    eventBlock(out, 'DEAT', p.death, p.data.death);

    // FAMC (the union this person was born/adopted into) with pedigree
    const pu = p.data.parents_union;
    if (pu && fam.has(pu)) {
      out.push(`1 FAMC ${fam.get(pu)}`);
      const u = store.getUnion(pu);
      const entry = u && (u.data.children || []).find((c) => c.person === p.id);
      const rel = entry && entry.relation;
      if (rel === 'adopted') out.push('2 PEDI adopted');
      else if (rel === 'biological') out.push('2 PEDI birth');
      // 5.5.1 has no PEDI value for step; 'foster' is a materially different
      // claim, so record the truth in the FAMC's legal NOTE substructure.
      else if (rel === 'step') out.push('2 NOTE Step relationship to this family');
    }
    // FAMS (unions this person is a partner in)
    for (const uid of p.data.unions || []) if (fam.has(uid)) out.push(`1 FAMS ${fam.get(uid)}`);

    const body = (p.body || '').trim();
    if (body) noteLines(out, body);
  }

  for (const u of unions) {
    out.push(`0 ${fam.get(u.id)} FAM`);
    const parts = (u.data.partners || []).map((id) => store.getPerson(id)).filter(Boolean);
    // Prefer M->HUSB, F->WIFE. When only one role resolves by sex, keep it and
    // fill just the empty slot — resetting both could export a man as WIFE.
    let husb = parts.find((p) => p.data.sex === 'M');
    let wife = parts.find((p) => p.data.sex === 'F');
    if (!husb && !wife) { husb = parts[0]; wife = parts[1]; }
    else {
      if (!husb) husb = parts.find((p) => p !== wife);
      if (!wife) wife = parts.find((p) => p !== husb);
    }
    if (husb) out.push(`1 HUSB ${indi.get(husb.id)}`);
    if (wife && wife !== husb) out.push(`1 WIFE ${indi.get(wife.id)}`);

    const marrDate = gedDate(u.start);
    if (marrDate || u.data.type) {
      out.push('1 MARR');
      if (marrDate) out.push(`2 DATE ${marrDate}`);
      if (u.data.type && u.data.type !== 'marriage') out.push(`2 TYPE ${esc(u.data.type)}`);
    }
    if (u.data.status === 'divorced' || u.data.status === 'separated' || u.data.status === 'ended') {
      out.push('1 DIV');
      const endDate = gedDate(u.end);
      if (endDate) out.push(`2 DATE ${endDate}`);
    }
    for (const c of u.data.children || []) if (indi.has(c.person)) out.push(`1 CHIL ${indi.get(c.person)}`);
    const notes = (u.body || '').trim();
    if (notes) noteLines(out, notes);
  }

  out.push('0 @SUB1@ SUBM', '1 NAME The Tree');
  out.push('0 TRLR');
  return out.join('\n') + '\n';
}

export function downloadGedcom(basename = 'family') {
  const text = buildGedcom();
  const blob = new Blob([text], { type: 'text/vnd.familysearch.gedcom;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `the-${String(basename).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family'}-family.ged`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
