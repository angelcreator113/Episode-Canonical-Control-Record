/** Notes to the writer in "Ready to film?" (lib/scriptWriterNotes; Evoni, 2026-10-25). */
import { describe, it, expect } from 'vitest';
import { writerNoteOf, writerNotes, writerNoteRows, cardNumber, MAX_NOTE_ROWS } from './scriptWriterNotes';
import { scriptHealth } from './scriptHealth';

describe('writerNoteOf', () => {
  it.each([
    ['[IF she won the last event] Me: Told you.', 'if'],
    ['[NOTE: punch this up]', 'note'],
    ['Note: check the lighting here', 'note'],
    ['Lala: Hi! (only include this line if the guest is Marcus)', 'only-if'],
    ['(use this if we have time)', 'only-if'],
    ['Me: TODO a better joke', 'todo'],
    ['Lala: The prize is TBD', 'todo'],
    ['FIXME', 'todo'],
    ['Me: ??? something about the shoes', 'unknown'],
    ['[ALT: Me: Or this way]', 'alt'],
    ['Lala: Hey {guest name}!', 'placeholder'],
    ['[STAT: coins -XX]', 'xx'],
    ['Me: That costs XX coins', 'xx'],
  ])('%s is a note (%s)', (line, key) => {
    expect(writerNoteOf(line)?.key).toBe(key);
  });

  it.each([
    'Me: What??? No way.',
    'Lala: I have so much to do today',
    '[TODO_MODE: shopping]',
    '[UI:OPEN ClosetItems x5]',
    'Lala: Size XXL is sold out',
    '(She smiles)',
    '(She checks if the door is locked)',
    'Lala (V.O.): If only.',
    '',
  ])('%s is not a note', (line) => {
    expect(writerNoteOf(line)).toBeNull();
  });
});

describe('cardNumber', () => {
  it('counts the cards the Script tab shows, hidden stat and mail lines left out', () => {
    expect(cardNumber(['Me: a', '[STAT: coins -5]', '[MAIL: x]', 'Me: b'], 3)).toBe(2);
    expect(cardNumber(['---', 'Me: a'], 1)).toBe(1);
  });
});

describe('writerNotes and rows', () => {
  const beats = [
    { id: 'beat-1', number: 1, lines: ['Me: Hi', '[STAT: coins -5]', '[NOTE: louder]'] },
    { id: 'beat-2', number: 2, lines: ['Lala: Hey {name}'] },
  ];

  it('names the beat and the line', () => {
    expect(writerNotes(beats).map((n) => [n.beatNumber, n.line, n.key])).toEqual([[1, 2, 'note'], [2, 1, 'placeholder']]);
    const rows = writerNoteRows(beats);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ ok: false, beatId: 'beat-1' });
    expect(rows[0].text).toMatch(/^Beat 1, line 2: a note/);
    expect(rows[0].text).toContain('[NOTE: louder]');
  });

  it('is one clear row when there are none', () => {
    expect(writerNoteRows([{ id: 'b', number: 1, lines: ['Me: hi'] }])).toEqual([{ key: 'writer-notes', ok: true, beatId: null, text: 'No notes to the writer left in the script.' }]);
  });

  it('counts the rest past the cap', () => {
    const many = [{ id: 'b', number: 3, lines: Array.from({ length: MAX_NOTE_ROWS + 3 }, (_, i) => `Me: TODO ${i}`) }];
    const rows = writerNoteRows(many);
    expect(rows).toHaveLength(MAX_NOTE_ROWS + 1);
    expect(rows[rows.length - 1].text).toBe('3 more notes to the writer in the script.');
  });

  it('shows up in Ready to film?', () => {
    const rows = scriptHealth({ beats });
    expect(rows.some((r) => r.key === 'writer-note-beat-1-2' && !r.ok)).toBe(true);
  });
});
