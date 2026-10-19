// Script tab audit, 2026-10-15: the export reads every kind of script line.
import { describe, test, expect } from 'vitest';
import { toFountain, toPlainText, readLine, momentWords, scriptSections, scriptFileSlug } from './scriptExport';
import { parseMoment } from './scriptMoments';

const SCRIPT = [
  '[EVENT: velour-gala]',
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties, we are LIVE."',
  'Me: “You look ready.”',
  '(She slides on her headphones.)',
  '[UI:OPEN closet]',
  '[STAT: coins -50]',
  '[TRANSITION: cut to]',
  '',
  '## BEAT: 5 · Reveal',
  'Kelli: (whispering) "Did you see it?"',
  '[UI:CLICK MailIcon]',
  '[UI:DISPLAY InviteLetterOverlay]',
  '[UI:NOTIFY Kelli: call me]',
  'The room goes quiet.',
].join('\n');

describe('readLine', () => {
  test('dialogue loses its straight and curly quotes; Me is Prime', () => {
    expect(readLine('Lala: "Hi there"')).toEqual({ type: 'dialogue', speaker: 'Lala', ext: null, paren: null, text: 'Hi there' });
    expect(readLine('Me: “Curly”')).toMatchObject({ speaker: 'Prime', text: 'Curly' });
  });
  test('a leading parenthetical is kept apart from the words', () => {
    expect(readLine('Kelli: (softly) "Go"')).toMatchObject({ paren: '(softly)', text: 'Go' });
  });
  test('an action loses its parentheses', () => {
    expect(readLine('(She sits.)')).toEqual({ type: 'action', text: 'She sits.' });
  });
  test('tags are not spoken', () => {
    for (const t of ['[STAT: coins +5]', '[MAIL: invite]', '[WEAR: p1]', '[DELIVER: d1]', '[TODO_MODE: deal]', '[SCENE: Loft', '[LOCATION_HINT: Loft]']) {
      expect(readLine(t).type).toBe('tag');
    }
    expect(readLine('[TRANSITION: cut to]')).toEqual({ type: 'transition', text: 'cut to' });
  });
});

describe('momentWords', () => {
  const w = (l) => momentWords(parseMoment(l));
  test('reads a moment in words', () => {
    expect(w('[UI:OPEN closet]')).toBe('Lala opens the Closet');
    expect(w('[UI:CLICK MailIcon]')).toBe('Lala taps Mail');
    expect(w('[UI:DISPLAY InviteLetterOverlay]')).toBe('On screen: Invite Letter');
    expect(w('[UI:HIDE InviteLetterOverlay]')).toBe('Invite Letter leaves the screen');
    expect(w('[UI:SHOW phone]')).toBe("Lala's phone comes on screen");
    expect(w('[UI:NOTIFY Kelli: call me]')).toBe('Notification from Kelli: “call me”');
    expect(w('[UI:POST new look]')).toBe('Lala posts: “new look”');
  });
  test('uses the screen name the tab resolved', () => {
    expect(momentWords(parseMoment('[UI:OPEN closet]'), { kind: 'phone', name: "Lala's Closet" })).toBe("Lala opens Lala's Closet");
  });
});

describe('scriptSections', () => {
  test('keeps the preamble apart and numbers beats by their header', () => {
    const s = scriptSections(SCRIPT);
    expect(s.preamble).toEqual(['[EVENT: velour-gala]']);
    expect(s.beats.map((b) => [b.number, b.name])).toEqual([[1, 'Opening Ritual'], [5, 'Reveal']]);
  });
  test('a headerless script is one section with no number', () => {
    const s = scriptSections('Lala: hi\n(waves)');
    expect(s.beats).toEqual([{ number: null, name: null, label: '', lines: ['Lala: hi', '(waves)'] }]);
  });
});

describe('toFountain', () => {
  const f = toFountain(SCRIPT, { title: 'Ep 3: The Gala', scenes: { 5: 'Velour Ballroom' } });

  test('a title page, sections and a scene heading only where the scene is known', () => {
    expect(f.startsWith('Title: Ep 3: The Gala\n\n')).toBe(true);
    expect(f).toContain('\n\n# 1 · Opening Ritual\n\n');
    expect(f).toContain('# 5 · Reveal\n\n.VELOUR BALLROOM\n\n');
    expect(f).not.toMatch(/# 1 · Opening Ritual\n\n\./);
  });
  test('dialogue: speaker in capitals over the words, quotes gone, parenthetical kept', () => {
    expect(f).toContain('\n\nLALA\nOkay besties, we are LIVE.\n\n');
    expect(f).toContain('\n\nPRIME\nYou look ready.\n\n');
    expect(f).toContain('\n\nKELLI\n(whispering)\nDid you see it?\n\n');
  });
  test('actions without parentheses, moments in words, tags as notes, transitions', () => {
    expect(f).toContain('\n\nShe slides on her headphones.\n\n');
    expect(f).toContain('\n\nLala opens the Closet\n\n');
    expect(f).toContain('\n\nLala taps Mail\n\n');
    expect(f).toContain('\n\n[[STAT: coins -50]]\n\n');
    expect(f).toContain('\n\n> CUT TO:\n\n');
    expect(f).toContain('\n\nThe room goes quiet.\n');
    expect(f).not.toContain('[UI:');
  });
  test('the preamble comes before the first section', () => {
    expect(f.indexOf('[[EVENT: velour-gala]]')).toBeLessThan(f.indexOf('# 1 ·'));
  });
  test('a headerless script has no sections; an all-caps action is forced', () => {
    const h = toFountain('Lala: hi\nBANG.\n(waves)');
    expect(h).toBe('Title: Untitled script\n\nLALA\nhi\n\n!BANG.\n\nwaves\n');
  });
  test('a beat names its own scene when the plan has none', () => {
    expect(toFountain('## BEAT: 2 · Login Sequence\n[SCENE: Lala\'s loft]\nLala: hi')).toContain('# 2 · Login Sequence\n\n.LALA\'S LOFT\n\n[[SCENE: Lala\'s loft]]');
  });
});

describe('toPlainText', () => {
  test('a readable printout without tags', () => {
    const t = toPlainText(SCRIPT, { title: 'Gala' });
    expect(t.startsWith('Gala\n====\n\n')).toBe(true);
    expect(t).toContain('Beat 1 · Opening Ritual\n-----------------------');
    expect(t).toContain('LALA\n  Okay besties, we are LIVE.');
    expect(t).toContain('KELLI\n  (whispering)\n  Did you see it?');
    expect(t).toContain('(She slides on her headphones.)');
    expect(t).toContain('[Lala opens the Closet]');
    expect(t).toContain('CUT TO:');
    expect(t).not.toMatch(/STAT|EVENT|velour-gala/);
  });
  test('a headerless script prints its lines', () => {
    expect(toPlainText('Lala: hi')).toBe('LALA\n  hi\n');
  });
});

test('scriptFileSlug', () => {
  expect(scriptFileSlug('Ep 3: The Gala!')).toBe('ep-3-the-gala');
  expect(scriptFileSlug('')).toBe('script');
});

describe('named beat headers (Script tab audit, 2026-10-15)', () => {
  test("a skeleton header by name is its canonical beat, as the tab reads it", () => {
    const { beats } = scriptSections('## BEAT: OPENING_RITUAL\nLala: Hi.\n\n## BEAT: TRANSFORMATION\nLala: The dress.');
    expect(beats.map((b) => [b.number, b.name])).toEqual([[1, 'Opening Ritual'], [8, 'Transformation Loop']]);
  });
});

// Script tab re-audit (2026-10-15): the tab's speaker rule (lib/scriptSpeaker.js).
describe('who speaks, as the Script tab reads it', () => {
  test('V.O., two-word and inner-capital names speak; Note: does not', () => {
    expect(readLine('Lala (V.O.): "I need this."')).toMatchObject({ type: 'dialogue', speaker: 'Lala', ext: '(V.O.)', text: 'I need this.' });
    expect(readLine('Mary Jane: "Hi"')).toMatchObject({ type: 'dialogue', speaker: 'Mary Jane' });
    expect(readLine('JustAWoman: "Hi"')).toMatchObject({ type: 'dialogue', speaker: 'JustAWoman' });
    expect(readLine('LALA: "Hi"')).toMatchObject({ type: 'dialogue', speaker: 'Lala' });
    expect(readLine('Note: remember the lighting')).toEqual({ type: 'narration', text: 'Note: remember the lighting' });
  });
  test('the Fountain character carries the V.O.', () => {
    expect(toFountain('## BEAT: 1 · Opening Ritual\nLala (V.O.): "Hi"')).toContain('LALA (V.O.)\nHi');
  });
});


describe("today's beat names (Script page audit 3, 2026-10-19)", () => {
  test('a saved header with an old name reads as the beat is called now', () => {
    const { beats } = scriptSections('## BEAT: 11 · Event Outcome\nLala: Here.\n\n## BEAT: 12 · Deliverable Creation\nLala: Walk.\n\n## BEAT: 15 · Bonus Scene\nLala: Extra.');
    expect(beats.map((b) => `${b.number} · ${b.name}`)).toEqual(['11 · The Event', '12 · Fashion Challenge', '15 · Bonus Scene']);
  });
});
