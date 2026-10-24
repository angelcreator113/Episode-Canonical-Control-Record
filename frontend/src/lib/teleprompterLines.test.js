// What the teleprompter shows (Evoni, 2026-10-20).
import { describe, test, expect } from 'vitest';
import { teleprompterLines, teleprompterScript, pastedParagraphs, takeName, pickRecordType, recordingProblem, cameraErrorMessage, downloadName, clock } from './teleprompterLines';

describe('teleprompterLines', () => {
  test('her names are hers, others are cues, directions dim, tags hidden', () => {
    const out = teleprompterLines(['Me: "Hi."', '**JustAWoman:** Bold one.', 'JAWIHP (softly): Quiet.', 'Prime: Yes.', 'Lala: "Okay."', '(beat)', 'Suddenly: the lights go out.', '[UI:OPEN closet]', '[STAT: coins 5]', '[WEAR: p1]', '[TRANSITION: cut to]', '']);
    expect(out.map((l) => l.kind)).toEqual(['mine', 'mine', 'mine', 'mine', 'cue', 'direction', 'direction']);
    expect(out[1]).toMatchObject({ speaker: 'JustAWoman', text: 'Bold one.' });
    // Her line is labelled JustAWoman whatever she typed (reader audit, 2026-10-24).
    expect(out[2]).toMatchObject({ speaker: 'JustAWoman', text: 'Quiet.' });
    expect(out[0]).toMatchObject({ speaker: 'JustAWoman', who: 'JustAWoman' });
  });
  test('a script is beats with canonical names; pasted text keeps its paragraphs', () => {
    const s = teleprompterScript('## BEAT: 8 · Old\nMe: hi');
    expect(s.beats[0]).toMatchObject({ number: 8, name: 'Transformation Loop' });
    expect(pastedParagraphs('a\nb\r\n\r\n\nc  \n')).toEqual(['a\nb', 'c']);
  });
  test('names, types and messages', () => {
    expect(takeName({ number: 8, name: 'Transformation Loop' }, 2)).toBe('Beat 8 · Transformation Loop · take 2');
    expect(pickRecordType({ isTypeSupported: (t) => !t.startsWith('video/mp4') })).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecordType({ isTypeSupported: () => true })).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
    expect(pickRecordType(undefined)).toBe('');
    expect(recordingProblem({ isSecureContext: false })).toMatch(/secure/);
    expect(recordingProblem({ isSecureContext: true, navigator: {} })).toMatch(/camera/);
    expect(recordingProblem({ navigator: { mediaDevices: { getUserMedia() {} } } })).toMatch(/record video/);
    expect(recordingProblem({ navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder() {} })).toBeNull();
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/No camera/);
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/in use/);
    expect(downloadName('video/mp4', new Date(2026, 9, 20, 14, 5))).toBe('Teleprompter take 2026-10-20 14-05.mp4');
    expect(clock(65.4)).toBe('1:05');
  });
});
