// The editor's cue sheet: notes by beat, the cold open first, beat times from a take.
import { describe, test, expect } from 'vitest';
import { cueSheet, cueSheetText, lineCues, cueSheetFileName } from './cueSheet';

const SCRIPT = [
  '[SHOT: wide of the closet, lights off]',
  '[SFX: door creak]',
  'Host: Lala',
  '## BEAT: 1 · Opening Ritual',
  '[MUSIC: theme up]',
  'Me: "Hi besties." [CAMERA: push in]',
  '[UI:OPEN ClosetApp]',
  '## BEAT: 2 · Login Sequence',
  'Lala: "Logging in."',
  '## BEAT: 3 · Welcome',
  '[VIDEO: b-roll of the invite]',
  '[TRANSITION: whip pan]',
  '[EDIT: punch-in on her corner frame]',
].join('\n');

describe('cue sheet', () => {
  test('a line\'s notes, on their own or inside a line', () => {
    expect(lineCues('[SFX: notification_ping]')).toEqual([{ kind: 'SFX', label: 'Sound', text: 'notification ping' }]);
    expect(lineCues('Me: "Hi." [CAMERA: push in] [MUSIC: sting]').map((c) => c.kind)).toEqual(['CAMERA', 'MUSIC']);
    expect(lineCues('[UI:OPEN ClosetApp]')).toEqual([]);
    expect(lineCues('[TRANSITION: fade')).toEqual([{ kind: 'TRANSITION', label: 'Transition', text: 'fade' }]);
  });

  test('grouped by beat, the cold open first, beat times from the markers', () => {
    const sheet = cueSheet(SCRIPT, { marks: [{ beat: 1, t: 4.2 }, { beat: 3, t: 125 }] });
    expect(sheet.coldOpen.map((c) => c.text)).toEqual(['wide of the closet, lights off', 'door creak']);
    expect(sheet.beats.map((b) => [b.number, b.start, b.cues.length])).toEqual([[1, 4.2, 2], [2, null, 0], [3, 125, 3]]);
    expect(sheet.count).toBe(7);
  });

  test('as text: the shot list at the top, empty beats left out, start times shown', () => {
    const text = cueSheetText(cueSheet(SCRIPT, { marks: [{ beat: 1, t: 4.2 }, { beat: 3, t: 125 }] }), { title: 'The Gala', takeLabel: 'Full episode · take 2' });
    const lines = text.split('\n');
    expect(lines[0]).toBe('Cue sheet · The Gala');
    expect(lines[1]).toBe('Beat times from: Full episode · take 2');
    expect(lines.indexOf('COLD OPEN SHOT LIST')).toBeLessThan(lines.findIndex((l) => l.startsWith('BEAT 1')));
    expect(text).toMatch(/BEAT 1 · Opening Ritual · starts at 0:04\.2\n {2}\[ \] Music: theme up\n {2}\[ \] Camera: push in/);
    expect(text).not.toMatch(/BEAT 2/);
    expect(text).toMatch(/BEAT 3 · Welcome · starts at 2:05\.0/);
  });

  test('no notes: says so; no take: no times', () => {
    expect(cueSheetText(cueSheet('## BEAT: 1\nMe: "Hi."'))).toMatch(/No sound, music/);
    expect(cueSheetText(cueSheet(SCRIPT))).not.toMatch(/starts at/);
    expect(cueSheetFileName('ep-3-the-gala')).toBe('ep-3-the-gala-cue-sheet.txt');
  });
});
