'use strict';

/**
 * Scripts for the line identity tests (architecture A1a): the beat header
 * forms the Script tab reads, a preamble, CRLF text, a script with no header,
 * tags and hidden cues, duplicate lines and typographic variants. Read by the
 * server tests (tests/unit/utils/lineKeys.test.js) and the frontend parity
 * test (frontend/src/lib/lineKeys.test.js). Episode 1 comes from
 * tests/fixtures/myLittleListEpisode1.js, unchanged.
 */

// Each header form with the beat its lines belong to.
const HEADER_FORMS = [
  { name: 'canonical, number and name', script: '## BEAT: 5 · Reveal\nLala: Oh, a letter.', beats: [5] },
  { name: 'number before the colon', script: '## Beat 5: Reveal\nLala: Oh, a letter.', beats: [5] },
  { name: 'three hashes', script: '### BEAT: 5\nLala: Oh, a letter.', beats: [5] },
  { name: 'bold', script: '**## BEAT: 5**\nLala: Oh, a letter.', beats: [5] },
  { name: 'space before the colon', script: '##  BEAT : 11\nLala: Filming now.', beats: [11] },
  { name: 'one hash, number first', script: '# BEAT 11:\nLala: Filming now.', beats: [11] },
  { name: 'canonical name only', script: '## BEAT: TRANSFORMATION\n[WEAR: p-dress]', beats: [8] },
  { name: 'Beat word before the number', script: '## BEAT: Beat 4 · Pulse\n[UI:NOTIFY Mail]', beats: [4] },
  { name: 'a name that names no beat, numbered by its place', script: '## BEAT: 1 · Opening\nLala: Hi.\n## BEAT: Bonus scene\nLala: Extra.', beats: [1, 2] },
  { name: 'past fourteen keeps its own number', script: '## BEAT: 15 · Extra\nLala: More.', beats: [15] },
  { name: 'CRLF line ends', script: '## BEAT: 1 · Opening\r\nLala: Morning.\r\n## BEAT: 2 · Login\r\n[UI:OPEN Phone]', beats: [1, 2] },
  { name: 'preamble before the first header', script: '[EVENT: ev-studio]\n## BEAT: 1 · Opening\nLala: Morning.', beats: [0, 1] },
  { name: 'no header at all', script: 'Lala: Morning.\nPrime: Hi, chat.', beats: [null, null] },
];

// Tags and hidden cues are lines; headers and blank lines are not.
const TAGGED = [
  '## BEAT: 2 · Login Sequence',
  '',
  'Prime: Let\'s see what Lala\'s up to.',
  '[UI:CLICK Voice Icon]',
  'Lala: Morning! Big day?',
  '   ',
  '## BEAT: 8 · Transformation Loop',
  '[WEAR: p-dress]',
  '[TALK: Nia]',
  '[LEARNS: deal_accepted]',
  'Lala (V.O.): I hope this works.',
].join('\n');
const TAGGED_LINES = [
  "Prime: Let's see what Lala's up to.",
  '[UI:CLICK Voice Icon]',
  'Lala: Morning! Big day?',
  '[WEAR: p-dress]',
  '[TALK: Nia]',
  '[LEARNS: deal_accepted]',
  'Lala (V.O.): I hope this works.',
];

// Spellings of one line that are the same line, and one that is not.
const SAME_LINE = [
  "Lala: It's the gold ones — obviously.",
  'Lala:  It’s the gold ones – obviously.  ',
  'Lala:\tIt’s the gold ones — obviously.',
  'Lala: It’s the gold ones - obviously.',
];
const OTHER_LINE = "Lala: It's the silver ones — obviously.";

// A beat with the same line twice.
const DUPLICATES = [
  '## BEAT: 3 · Welcome',
  'Lala: Okay.',
  'Prime: Hi, chat.',
  'Lala: Okay.',
].join('\n');

// A small episode to edit.
const BASE = [
  '## BEAT: 1 · Opening Ritual',
  'Lala: Morning. Coffee first.',
  'Prime: Good morning, everyone.',
  '## BEAT: 4 · Interruption Pulse 1',
  '[UI:NOTIFY Mail]',
  'Lala: Ooh, mail!',
  '## BEAT: 5 · Reveal',
  'Lala: Oh, a letter from the studio.',
  '[UI:DISPLAY Invitation]',
  'Lala: They want me at the studio!',
].join('\n');

/** A seeded random source (mulberry32), so minted keys repeat in tests. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { HEADER_FORMS, TAGGED, TAGGED_LINES, SAME_LINE, OTHER_LINE, DUPLICATES, BASE, seeded };
