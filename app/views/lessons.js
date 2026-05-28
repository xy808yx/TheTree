// Family Lessons: every {lesson:theme}/{mistake:theme} marker written on a
// person, gathered and grouped by theme.

import { el, clear } from '../dom.js';
import { store, displayName, THEMES } from '../store.js';

export function renderLessons(view) {
  clear(view);
  const groups = store.lessonsByTheme();
  const themes = [...THEMES, ...Object.keys(groups).filter((t) => !THEMES.includes(t))].filter((t) => groups[t] && groups[t].length);

  const wrap = el('section', { class: 'lessons' },
    el('h1', { class: 'landing-title', style: { fontSize: '2.2rem', textAlign: 'left' } }, 'Family Lessons'),
    el('p', { class: 'lessons-intro' },
      'Hard-won wisdom and cautionary tales, gathered from across the family and grouped by theme — written on each person, collected here.'));

  if (!themes.length) {
    wrap.append(el('p', { class: 'empty-note' },
      'No lessons yet. Add a line like “{lesson: money} …” or “{mistake: health} …” to anyone’s story.'));
    view.append(wrap); return;
  }

  for (const theme of themes) {
    const items = groups[theme];
    const section = el('div', { class: 'theme-section' },
      el('h2', { class: 'theme-title' }, theme),
      el('div', { class: 'theme-count' }, `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`));
    const cards = el('div', { class: 'lesson-cards' });
    // mistakes first within a theme — the via-negativa emphasis
    items.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'mistake' ? -1 : 1));
    for (const it of items) {
      cards.append(el('div', { class: 'lesson-card' + (it.kind === 'mistake' ? ' is-mistake' : '') },
        el('p', { class: 'lc-text' }, it.text || '(no detail)'),
        el('div', { class: 'lc-who' },
          el('span', { class: 'lc-kind' }, it.kind === 'mistake' ? 'Mistake' : 'Lesson'),
          el('a', { href: `#/person/${it.person.id}` }, displayName(it.person)))));
    }
    section.append(cards);
    wrap.append(section);
  }
  view.append(wrap);
}
