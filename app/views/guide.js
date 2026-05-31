// "How this works" — a calm, always-available explanation of where the data lives,
// how it's backed up, and how to share it. The app is a lens; the folder of plain
// files is the real archive. The same model is written into the archive itself as
// READ ME FIRST.md (see ensureReadme in fsa.js) so the folder explains itself too.

import { el, clear } from '../dom.js';
import { APP_URL } from '../fsa.js';

function section(title, ...children) {
  return el('div', { class: 'guide-section' }, el('h2', {}, title), ...children);
}

export function renderGuide(view) {
  clear(view);
  const guide = el('section', { class: 'guide' });

  // A way back for the first-run case, where the top nav isn't shown yet.
  guide.append(
    el('a', { class: 'guide-back', href: '#/' }, '← Back'),
    el('h1', { class: 'page-title' }, 'How The Tree works'),
    el('p', { class: 'guide-lead' },
      'The app is just a lens. Your family lives in a folder of plain files you own forever — here’s where they are, how they’re backed up, and how to share them.'),

    section('Your data is a folder of plain files',
      el('p', {},
        'Every person is a small Markdown file you can open in any text editor, on any computer, with no special app — now or in forty years. Nothing here depends on a company, a subscription, or the internet.'),
      el('ul', {},
        el('li', {}, el('code', {}, 'people/'), ' — one file per person, the heart of the archive'),
        el('li', {}, el('code', {}, 'unions/'), ' — marriages and partnerships that link people'),
        el('li', {}, el('code', {}, 'media/'), ' — photos, grouped by person'),
        el('li', {}, el('code', {}, '_backups/'), ' — automatic safety copies made before each save; safe to delete anytime'))),

    section('The app is just a lens',
      el('p', {},
        'The Tree reads that folder and shows it as a tree, timeline, map, and printable book. It stores nothing itself. To open your archive on any desktop:'),
      el('ol', {},
        el('li', {}, 'Open ', el('strong', {}, 'Chrome or Edge'), ' on a Mac, Windows, or Linux computer.'),
        el('li', {}, 'Go to ', el('a', { href: APP_URL, target: '_blank', rel: 'noopener' }, APP_URL), '.'),
        el('li', {}, 'Click ', el('strong', {}, 'Open your archive folder'), ' and choose your folder.')),
      el('p', { class: 'guide-note' },
        'Editing needs Chrome or Edge on a desktop. Phones and Safari can read the PDF book below, but can’t open the folder directly.')),

    section('Backing it up — two layers',
      el('ul', {},
        el('li', {}, el('strong', {}, 'Keep the folder in iCloud Drive'), ' (or another synced folder). It’s then backed up automatically and follows you to a new computer.'),
        el('li', {}, el('strong', {}, 'Every so often, copy the whole folder to a USB drive'), ' and store it safely. That copy outlives any account, company, or computer.'))),

    section('Sharing it with family — three ways',
      el('ul', {},
        el('li', {}, el('strong', {}, 'A PDF book'), ' — open ', el('strong', {}, 'Book'), ' and choose Save as PDF. Print it, AirDrop it, or email it. Easiest for most relatives.'),
        el('li', {}, el('strong', {}, 'A copy of the folder'), ' — for someone who’ll open the app themselves or read the files directly.'),
        el('li', {}, el('strong', {}, 'A GEDCOM file'), ' — export from the Book view for relatives who use Ancestry, FamilySearch, or other genealogy software.'))),

    section('Photos',
      el('p', {},
        'Add JPEG, PNG, GIF, or WebP images. iPhone photos are usually HEIC, which browsers can’t display — in Apple Photos, choose ', el('strong', {}, 'File → Export'), ' and export a JPEG copy first.')),

    section('If something looks off',
      el('ul', {},
        el('li', {}, 'The Tree backs up each file before it saves, and tells you if a save can’t finish — for example, if the browser lost access to your folder. Just reconnect and try again.'),
        el('li', {}, 'If you hand-edit a file and a person disappears, check the ', el('code', {}, '---'), ' lines at the top of that file; the app will say how many files it couldn’t read.'),
        el('li', {}, 'The ', el('code', {}, '_backups/'), ' folder is yours to delete anytime if it grows large.'))),
  );

  view.append(guide);
}
