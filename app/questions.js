// Questions worth asking: the interview list, grouped by theme and tiered into
// easy openers and questions that go further. Rendered in the Guide, and read
// directly by build.js to write the printable questions.html.
//
// KEEP THIS FILE PURE DATA: only `export const`, no imports, no functions. The
// build evaluates it as a plain script to generate the printable sheet, and fails
// loudly if that stops being true.
//
// Every theme carries at least one question about what went wrong. That is the
// point of this archive: a life told only in its wins is a life half recorded.

export const INTERVIEW_LEAD =
  'This is a list to talk from, not a form to fill in. Start easy, go slow, and remember that what a person got wrong is worth as much to this family as what they got right.';

export const INTERVIEW_CRAFT = [
  { label: 'Ask before you record', text: 'Ask first, say who will hear it and that you will stop any time they want, then put the recorder between you and open with the date and both your names.' },
  { label: 'One question at a time', text: 'Two questions in one breath means they answer the easy half and the hard half is lost.' },
  { label: 'Count to ten', text: 'Ask, then close your mouth, because the best part almost always comes after the silence.' },
  { label: 'Do not comfort them', text: 'When they say they got something wrong, do not tell them it was fine. Nod, and let them finish.' },
  { label: 'When they will not answer', text: 'Do not push. Ask the same thing about other people instead, or put a photo or an old tool in their hands and ask what it is.' },
  { label: 'Never correct them', text: 'Let the wrong date or name stand, write it down quietly, and check it later in the papers or with another relative.' },
  { label: 'Go where they go', text: 'When they light up about something that is not on the page, leave the page. Stop after an hour, so there is a next visit.' },
];

export const INTERVIEW_THEMES = [
  {
    title: 'Beginnings',
    note: 'Start here every visit. Easy ground first, then one day in detail, and let the silences run.',
    starters: [
      'Tell me about the first place you remember living.',
      'What did kids do for fun where you grew up?',
      'What was there when you were small that is gone now?',
    ],
    deeper: [
      'What is the first thing you remember?',
      'What did you do when the grown-ups were not watching?',
      'Who kept an eye on you when you were small?',
      'What was hard to get hold of when you were young?',
      'Who were you careful around, and why?',
    ],
  },
  {
    title: 'Everyday life',
    note: 'Ask about one single day, not a whole year. Chase the smells, the sounds, the prices.',
    starters: [
      'What woke you up in the mornings?',
      'Who did the cooking where you grew up?',
      'Walk me through one ordinary day when you were ten.',
    ],
    deeper: [
      'Tell me about the food you ate most days.',
      'Tell me about your neighbours when you were small.',
      'What were you made to do around the house?',
      'What happened when you got in trouble?',
      'How did people make do when there was nothing?',
    ],
  },
  {
    title: 'Work and money',
    note: 'Start with the earliest work they remember. Save the money mistakes for the end.',
    starters: [
      'Tell me about the first work you remember doing.',
      'Who taught you to work, and how did they teach you?',
      'What did you do with the first money you earned?',
    ],
    deeper: [
      'What did the work do to your body?',
      'What could you do back then that nobody can do now?',
      'Tell me about money that came between you and someone.',
      'Who did you work for that you would not work for again?',
      'What did you get wrong about money when you were young?',
    ],
  },
  {
    title: 'Love and family',
    note: 'Leave the falling-out questions for later, once they are talking freely.',
    starters: [
      'Tell me about the people who raised you.',
      'Tell me how young people met each other back then.',
      'Which relative do you wish I had met?',
    ],
    deeper: [
      'Who did you fall for first, and what happened?',
      'What did the people who raised you get wrong?',
      'What did people in this family fall out over?',
      'Which relative did people stop talking about, and why?',
      'What did you swear you would never do, and did anyway?',
    ],
  },
  {
    title: 'Leaving and arriving',
    note: 'Anchor to one day. If they never moved, ask who did leave and what was said after.',
    starters: [
      'Tell me about the furthest you ever moved.',
      'What did you carry with you when you left?',
      'Take me through the day you arrived.',
    ],
    deeper: [
      'Who decided you were going, and how did you find out?',
      'Tell me about the people who stayed behind.',
      'Who was good to you when you arrived, and who was not?',
      'What did you get wrong about the new place?',
      'What would you tell somebody leaving today?',
    ],
  },
  {
    title: 'Hard times',
    note: 'Save these for a later visit. Ask once, then stay quiet. If they will not answer, move on.',
    starters: [
      'What did people do when someone got sick?',
      'Tell me about the worst weather you ever lived through.',
      'Tell me about the toughest person you knew growing up.',
    ],
    deeper: [
      'Tell me about a year you would not want to live again.',
      'Take me through one day from the worst of those years.',
      'Who should have helped you and did not?',
      'Tell me about the sickest you have ever been.',
      'Who in this family died young, and of what?',
    ],
  },
  {
    title: 'Mistakes and regrets',
    note: 'Ask these late, once they are warm. Say it is for the young ones, and drop any they refuse.',
    starters: [
      'Tell me about something you learned the hard way.',
      'What is the worst advice anyone ever gave you?',
      'Tell me about something you were never any good at.',
    ],
    deeper: [
      'Who did you not listen to, and what happened?',
      'What did you do to your body that you pay for now?',
      'What should I stay away from?',
      'Who would you say sorry to, and what for?',
      'Who stuck by you when you were in the wrong?',
    ],
  },
  {
    title: 'Belief and what lasts',
    note: 'Ask these last. Tell them the young ones will hear it, then let them think.',
    starters: [
      'What would the older people not let you do?',
      'Tell me about one day of the year your family always marked.',
      'Tell me about someone you knew who lived a good life.',
    ],
    deeper: [
      'Tell me about someone whose life you would not want.',
      'What did you believe at twenty that you do not believe now?',
      'Tell me about a time you had to keep your mouth shut.',
      'What should the young ones in this family keep doing?',
      'What should this family stop doing?',
    ],
  },
];

export const INTERVIEW_CLOSER = {
  title: 'Before you go',
  note: 'Ask these at the end of every visit, even a short one. Then stop the recorder and sit a while. Come back another day: the third visit is often the best one.',
  questions: [
    'What have I not asked you about?',
    'What should the young ones not copy from you?',
    'Who else should I be talking to?',
    'What have you always wanted to ask me?',
  ],
};
