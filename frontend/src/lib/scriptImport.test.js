/**
 * Import a script (lib/scriptImport; Evoni, 2026-10-25): an outside script
 * turned into the app's way of writing one, and what it couldn't convert.
 */
import { describe, it, expect } from 'vitest';
import { convertScript, convertHeader, convertSpeaker, convertStep, matchPiece, importedScript } from './scriptImport';
import { speakerLine } from './scriptSpeaker';
import { parseMoment } from './scriptMoments';
import { normalizeBeatHeaders, HAS_BEAT_HEADER } from './beatLabelNumber';

const look = [
  { id: 'w-101', name: 'Gold Hoop Earrings' },
  { id: 'w-102', name: 'Pink Satin Gown' },
  { id: 'w-103', name: 'Silver Strappy Heels' },
  { id: 'w-104', name: 'Silver Clutch' },
];
const onScreen = {
  screens: [{ id: 'home', name: 'Home Screen' }, { id: 'mail', name: 'Mail' }],
  overlays: [{ key: 'invitation', label: 'Invitation Letter' }],
  icons: [],
};

describe('convertHeader', () => {
  it.each([
    ['BEAT 1 — Opening Ritual', '## BEAT: 1 · Opening Ritual'],
    ['BEAT 1 —', '## BEAT: 1'],
    ['BEAT 2: Login', '## BEAT: 2 · Login'],
    ['Beat 3 - Welcome', '## BEAT: 3 · Welcome'],
    ['# Beat 4', '## BEAT: 4'],
    ['### BEAT 5 · Reveal', '## BEAT: 5 · Reveal'],
    ['**Beat 6.** Strategic Reaction', '## BEAT: 6 · Strategic Reaction'],
    ['BEAT #7 | Pulse', '## BEAT: 7 · Pulse'],
    ['beat 8', '## BEAT: 8'],
    ['## BEAT: 9 · Reminder', '## BEAT: 9 · Reminder'],
  ])('%s → %s', (input, want) => {
    expect(convertHeader(input)).toBe(want);
  });

  it('leaves a line that only starts with "Beat" alone', () => {
    expect(convertHeader('Beat 3 times on the door')).toBeNull();
    expect(convertHeader('Beating heart')).toBeNull();
    expect(convertHeader('Lala: Beat 1 is done')).toBeNull();
  });

  it('writes headers the beat parser reads', () => {
    const h = convertHeader('BEAT 11 — The Event');
    expect(HAS_BEAT_HEADER.test(normalizeBeatHeaders(h))).toBe(true);
  });
});

describe('convertSpeaker', () => {
  it.each([
    ['PRIME: Hey besties', 'Prime: Hey besties'],
    ['Prime (VO): Welcome back', 'Prime: Welcome back'],
    ['PRIME (V.O.): Welcome back', 'Prime: Welcome back'],
    ['LALA: Okay!', 'Lala: Okay!'],
    ['Lala (VO): I wonder…', 'Lala (V.O.): I wonder…'],
    ['LALA (AUTOMATIC REACTION): Ooh!', 'Lala (auto): Ooh!'],
    ['Lala (auto): Yes!', 'Lala (auto): Yes!'],
    ['ME: Let us go', 'Me: Let us go'],
    ['JUSTAWOMAN: Hi', 'JustAWoman: Hi'],
    ['jawihp: hi', 'JAWIHP: hi'],
    ['MARCUS: Welcome to the gala', 'Marcus: Welcome to the gala'],
    ['**LALA:** Bold line', 'Lala: Bold line'],
    ['Prime (softly): Shh', 'Prime (softly): Shh'],
  ])('%s → %s', (input, want) => {
    expect(convertSpeaker(input)).toBe(want);
  });

  it('keeps labels and narration as they are', () => {
    expect(convertSpeaker('Location: The loft')).toBeNull();
    expect(convertSpeaker('Suddenly: the lights go out')).toBeNull();
    expect(convertSpeaker('then: she leaves')).toBeNull();
    expect(convertSpeaker('LALA:')).toBeNull();
  });

  it('every converted line is read by the app as the same person', () => {
    expect(speakerLine(convertSpeaker('PRIME: Hi')).speaker).toBe('Prime');
    expect(speakerLine(convertSpeaker('LALA (AUTO): Wow')).auto).toBe(true);
  });
});

describe('matchPiece', () => {
  it('finds a piece by id, by name, and by its words', () => {
    expect(matchPiece('w-102', look).piece.id).toBe('w-102');
    expect(matchPiece('pink satin gown', look).piece.id).toBe('w-102');
    expect(matchPiece('Gold Hoops', look)).toBeNull();
    expect(matchPiece('Gold Hoop', look).piece.id).toBe('w-101');
    expect(matchPiece('Strappy Heels', look).piece.id).toBe('w-103');
  });

  it('says when a name fits more than one piece', () => {
    expect(matchPiece('Silver', look).several.map((p) => p.id)).toEqual(['w-103', 'w-104']);
  });

  it('finds nothing without a look or a name', () => {
    expect(matchPiece('Gown', [])).toBeNull();
    expect(matchPiece('', look)).toBeNull();
    expect(matchPiece('Leather Jacket', look)).toBeNull();
  });
});

describe('convertStep', () => {
  it('maps clicks and opens to the episode\'s own screens and overlays', () => {
    expect(convertStep('[CLICK invite]', onScreen)).toEqual({ line: '[UI:DISPLAY Invitation Letter]', found: true });
    expect(convertStep('[OPEN mail]', onScreen)).toEqual({ line: '[UI:OPEN Mail]', found: true });
    expect(convertStep('[GAME: TAP Home Screen]', onScreen)).toEqual({ line: '[UI:CLICK Home Screen]', found: true });
  });

  it('brings the phone up and puts it away', () => {
    expect(convertStep('[OPEN phone]').line).toBe('[UI:SHOW phone]');
    expect(convertStep("[CLOSE Lala's phone]").line).toBe('[UI:HIDE phone]');
  });

  it("falls back to the show's own names when the Phone Hub has no match", () => {
    expect(convertStep('[CLICK invite]').line).toBe('[UI:DISPLAY InviteLetterOverlay]');
    expect(convertStep('[TAP voice icon]').line).toBe('[UI:CLICK VoiceIcon]');
    expect(convertStep('[OPEN mail]').line).toBe('[UI:OPEN MailPanel]');
    expect(convertStep('[CLICK mail]').line).toBe('[UI:CLICK MailIcon]');
    expect(convertStep('[OPEN closet]').line).toBe('[UI:OPEN Closet]');
    expect(convertStep('[SHOW to-do list]').line).toBe('[UI:DISPLAY ToDoListOverlay]');
  });

  it('writes an unknown target as one name and says it was not found', () => {
    expect(convertStep('[CLICK sale banner]')).toEqual({ line: '[UI:CLICK SaleBanner]', found: false });
  });

  it('keeps a message\'s words', () => {
    expect(convertStep("[NOTIFY Mail: You're invited]").line).toBe("[UI:NOTIFY Mail: You're invited]");
  });

  it('every line it writes is a moment the app reads', () => {
    for (const l of ['[CLICK invite]', '[OPEN phone]', '[GAME: PRESS login]', '[SWIPE feed]']) {
      expect(parseMoment(convertStep(l).line)).not.toBeNull();
    }
  });

  it('leaves app lines and other lines alone', () => {
    expect(convertStep('[UI:CLICK MailIcon]')).toBeNull();
    expect(convertStep('Lala: click it')).toBeNull();
  });
});

describe('convertScript', () => {
  const pasted = [
    'EPISODE 4: The Gala',
    '',
    'BEAT 1 — Opening Ritual',
    'PRIME: Hey besties, welcome back.',
    '*She puts her headphones on*',
    '',
    'Beat 5 - Reveal',
    '[CLICK invite]',
    'LALA: Oh my gosh!',
    'Lala (automatic reaction): Squeal!',
    '[IF she won the last event] Prime: Told you.',
    '',
    '# Beat 8',
    '[GAME: EQUIP Pink Satin Gown]',
    '[GAME: EQUIP Leather Jacket]',
    '[COINS -50]',
    'CUT TO:',
    '{guest name}: Welcome!',
    '[CAMERA ZOOM]',
  ].join('\n');

  it('converts the whole script', () => {
    const { script, counts } = convertScript(pasted, { look, onScreen });
    expect(script).toBe([
      'EPISODE 4: The Gala',
      '',
      '## BEAT: 1 · Opening Ritual',
      'Prime: Hey besties, welcome back.',
      '(She puts her headphones on)',
      '',
      '## BEAT: 5 · Reveal',
      '[UI:DISPLAY Invitation Letter]',
      'Lala: Oh my gosh!',
      'Lala (auto): Squeal!',
      '[IF she won the last event] Prime: Told you.',
      '',
      '## BEAT: 8',
      '[WEAR: w-102]',
      '[GAME: EQUIP Leather Jacket]',
      '[STAT: coins -50]',
      '[TRANSITION: CUT TO]',
      '{guest name}: Welcome!',
      '[CAMERA ZOOM]',
    ].join('\n'));
    expect(counts).toEqual({ beats: 3, speakers: 3, wear: 1, steps: 1 });
  });

  it('lists what it could not convert, with the line it came from', () => {
    const { notes } = convertScript(pasted, { look, onScreen });
    expect(notes.map((n) => n.line)).toEqual([11, 15, 18, 19]);
    expect(notes[0].why).toMatch(/condition/);
    expect(notes[1].why).toMatch(/No piece of this episode's look is called "Leather Jacket"/);
    expect(notes[2].why).toMatch(/placeholder/);
    expect(notes[3].why).toMatch(/don't know this tag/);
  });

  it('says the look is not locked when there is no wardrobe list', () => {
    const { script, notes } = convertScript('BEAT 8\n[EQUIP: Pink Satin Gown]');
    expect(script).toContain('[EQUIP: Pink Satin Gown]');
    expect(notes[0].why).toMatch(/isn't locked/);
  });

  it('asks which piece when a name fits several', () => {
    const { notes } = convertScript('BEAT 8\n[GAME: EQUIP Silver]', { look });
    expect(notes[0].why).toMatch(/Silver Strappy Heels or Silver Clutch/);
  });

  it('keeps a [WEAR: id] the look has, and matches one written by name', () => {
    expect(convertScript('BEAT 8\n[WEAR: w-103]', { look }).script).toBe('## BEAT: 8\n[WEAR: w-103]');
    expect(convertScript('BEAT 8\n[WEAR: Silver Clutch]', { look }).script).toBe('## BEAT: 8\n[WEAR: w-104]');
    expect(convertScript('BEAT 8\n[WEAR: w-9]').script).toBe('## BEAT: 8\n[WEAR: w-9]');
  });

  it('reads a screenplay-style name on its own line', () => {
    const { script } = convertScript('BEAT 2\nLALA\n(excited)\nWe are in!\n\nPRIME\nLet us go.');
    expect(script).toBe('## BEAT: 2\nLala: (excited) We are in!\n\nPrime: Let us go.');
  });

  it("keeps the app's own lines as they are", () => {
    const app = '## BEAT: 1 · Opening Ritual\n[UI:CLICK VoiceIcon]\nLala: Hi\n[STAT: coins -20]\n[TRANSITION: fade]';
    expect(convertScript(app).script).toBe(app);
    expect(convertScript(app).notes).toEqual([]);
  });

  it('warns when there are no beat headers', () => {
    const { notes } = convertScript('PRIME: hi');
    expect(notes[0].line).toBeNull();
    expect(notes[0].why).toMatch(/No beat headers/);
  });

  it('handles Windows line ends and empty input', () => {
    expect(convertScript('BEAT 1\r\nPRIME: hi\r\n').script).toBe('## BEAT: 1\nPrime: hi');
    expect(convertScript('').script).toBe('');
    expect(convertScript(null).notes).toEqual([]);
  });

  it('puts a blank line before each beat and no more than one anywhere', () => {
    expect(convertScript('BEAT 1\nPRIME: a\nBEAT 2\n\n\n\nPRIME: b').script).toBe('## BEAT: 1\nPrime: a\n\n## BEAT: 2\n\nPrime: b');
  });
});

describe('importedScript', () => {
  it('replaces, or adds to the end', () => {
    expect(importedScript('## BEAT: 1\nMe: old', '## BEAT: 2\nMe: new', 'replace')).toBe('## BEAT: 2\nMe: new');
    expect(importedScript('## BEAT: 1\nMe: old\n', '## BEAT: 2\nMe: new', 'append')).toBe('## BEAT: 1\nMe: old\n\n## BEAT: 2\nMe: new');
    expect(importedScript('', '## BEAT: 2', 'append')).toBe('## BEAT: 2');
  });
});
