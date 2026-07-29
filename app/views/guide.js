// "How this works" — a calm, always-available explanation of the one-file model:
// the archive is a single family.html that is both the app and the data. Where it
// lives, how it's backed up, and how to share it. Reachable before any archive is
// open (the top nav is hidden on the landing), so a brand-new user can read it first.

import { el, clear } from '../dom.js';
import { APP_URL } from '../archive.js';
import { INTERVIEW_LEAD, INTERVIEW_CRAFT, INTERVIEW_THEMES, INTERVIEW_CLOSER } from '../questions.js';

// The printable sheet build.js writes from the same app/questions.js. Absolute, so
// the link still works from a family.html sitting on someone's desktop.
const QUESTIONS_URL = new URL('questions.html', APP_URL).href;

function section(title, ...children) {
  return el('div', { class: 'guide-section' }, el('h2', {}, title), ...children);
}

// One theme of the interview list: collapsed by default, so the whole bank stays a
// quiet stack of headings until you open the one the conversation is already near.
// tiers is [label, questions] pairs; a tier with no questions is skipped.
function questionTheme(title, note, tiers) {
  return el('details', { class: 'collapse qa-theme' },
    el('summary', {}, title),
    el('div', { class: 'collapse-body' },
      el('p', { class: 'qa-note' }, note),
      ...tiers.map(([label, items]) => (items && items.length
        ? el('div', { class: 'qa-tier' },
          el('h3', { class: 'qa-tier-label' }, label),
          el('ul', { class: 'qa-list' }, ...items.map((q) => el('li', {}, q))))
        : null))));
}

export function renderGuide(view) {
  clear(view);
  const guide = el('section', { class: 'guide' });

  guide.append(
    // A way back for the first-run case, where the top nav isn't shown yet.
    el('a', { class: 'guide-back', href: '#/' }, '← Back'),
    el('h1', { class: 'page-title' }, 'How The Tree works'),
    el('p', { class: 'guide-lead' },
      'Your whole family archive is a single file: ', el('code', {}, 'family.html'), '. That one file is both the app and the data: open it and it shows itself. Here’s where it lives, how to back it up, and how to share it.'),

    section('One file is the whole thing',
      el('p', {},
        'Everyone you add, and everything about them (names, dates, places, stories, hard-won lessons, even the photos, shrunk to fit), lives inside ', el('code', {}, 'family.html'), '. There’s no folder to manage, no database, nothing to install.'),
      el('ul', {},
        el('li', {}, el('strong', {}, 'To read it:'), ' double-click the file. It opens in any browser, on any device (your Mac, an iPhone, anything) and shows the tree, timeline, map, lessons, and book. No setup, no internet.'),
        el('li', {}, el('strong', {}, 'To edit it:'), ' open the file and use ', el('strong', {}, 'Add person'), ' or ', el('strong', {}, 'Edit'), '. On Chrome or Edge on a desktop, ', el('strong', {}, 'Save'), ' writes the changes straight back into the file. On other browsers, Save hands you an updated copy to keep.'))),

    section('Where to get the editor',
      el('p', {},
        'You can edit by opening the file directly. For the smoothest one-click saving in place, use the hosted editor:'),
      el('ol', {},
        el('li', {}, 'On a desktop, open ', el('strong', {}, 'Chrome or Edge'), '.'),
        el('li', {}, 'Go to ', el('a', { href: APP_URL, target: '_blank', rel: 'noopener' }, APP_URL), '.'),
        el('li', {}, 'Choose ', el('strong', {}, 'Open a family.html'), ' to edit yours, or ', el('strong', {}, 'Start a new archive'), '. Saving writes your one file in place.')),
      el('p', { class: 'guide-note' },
        'The hosted page stores nothing itself. It’s just a convenient way to open and edit your file. Your archive only ever lives in your ', el('code', {}, 'family.html'), '.')),

    section('Backing it up',
      el('ul', {},
        el('li', {}, el('strong', {}, 'Keep the file in a synced cloud folder'), ': iCloud Drive, Dropbox, or Google Drive. It’s backed up automatically and follows you to your other devices. Because it’s one file, this just works.'),
        el('li', {}, el('strong', {}, 'For real privacy, keep it in iCloud Drive with Advanced Data Protection turned on'), ' (System Settings → your name → iCloud). That makes iCloud end-to-end encrypted, so not even Apple can read your family’s stories.'),
        el('li', {}, el('strong', {}, 'Every so often, copy the file to a USB drive'), ' and store it safely. One file is easy to tuck away, and that offline copy outlives any account, company, or computer.'))),

    section('Sharing it with family',
      el('ul', {},
        el('li', {}, el('strong', {}, 'Send the whole file'), ': AirDrop, email, or message ', el('code', {}, 'family.html'), ' to someone and they just open it. They get the full, living archive, no app needed.'),
        el('li', {}, el('strong', {}, 'A PDF book'), ', for the “safe parts” to hand around freely: open ', el('strong', {}, 'Book'), ' and choose Save as PDF. Print it, AirDrop it, or email it.'),
        el('li', {}, el('strong', {}, 'A GEDCOM or Markdown export'), ', from the ', el('strong', {}, 'Book'), ' page, for relatives who use Ancestry or FamilySearch (GEDCOM) or who just want the plain text files (Markdown).'))),

    section('Interviewing family',
      el('p', {}, INTERVIEW_LEAD),
      el('ul', {},
        ...INTERVIEW_CRAFT.map((c) => el('li', {}, el('strong', {}, c.label + ':'), ' ' + c.text))),
      el('div', { class: 'qa-themes' },
        ...INTERVIEW_THEMES.map((t) => questionTheme(t.title, t.note, [['Start here', t.starters], ['Go deeper', t.deeper]])),
        questionTheme(INTERVIEW_CLOSER.title, INTERVIEW_CLOSER.note, [['Ask these last', INTERVIEW_CLOSER.questions]])),
      el('p', { class: 'guide-note' },
        el('a', { href: QUESTIONS_URL, target: '_blank', rel: 'noopener' }, 'Print the whole list'),
        ' (a few pages to carry with you, or to keep open on a second device).')),

    section('Nothing is locked in',
      el('p', {},
        'The file is plain HTML and your data sits inside it as plain text. From the ', el('strong', {}, 'Book'), ' page you can export everyone as plain Markdown files (one per person, readable in any editor, forever) or as GEDCOM. “One simple file” never costs you “readable forever.”')),

    section('Photos',
      el('p', {},
        'Add JPEG, PNG, GIF, or WebP images and they’re shrunk to fit and tucked inside the file. iPhone photos are usually HEIC, which browsers can’t display. In Apple Photos, choose ', el('strong', {}, 'File → Export'), ' and export a JPEG copy first. Keep photos modest: this is a place for wisdom, not a scrapbook.')),

    section('If something looks off',
      el('ul', {},
        el('li', {}, 'If a save ever can’t finish (say the browser lost access to the file), The Tree keeps your edit in the tab and offers to download a copy, so nothing is lost.'),
        el('li', {}, 'Keep one good backup before any big change. Because the archive is a single file, a backup is just a copy of that file.'),
        el('li', {}, 'When in doubt, ', el('strong', {}, 'Save / download'), ' a fresh copy and tuck it somewhere safe.'))),
  );

  view.append(guide);
}
