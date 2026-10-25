// [SFX: …] lines become the same 3-second reaction cue as an on-screen moment.
import { describe, test, expect } from 'vitest';
import { soundLine, soundWords, SOUND_KICKER } from './teleprompterSound';
import { teleprompterLines, teleprompterScript, withoutScreen } from './teleprompterLines';
import { SCREEN_SECONDS } from './teleprompterScreen';

describe('sound cues', () => {
  test('an [SFX:] line is a screen cue with a Sound kicker and 3 seconds', () => {
    expect(soundLine('[SFX: phone_buzz]')).toEqual({
      kind: 'screen', sound: true, kicker: SOUND_KICKER, who: null, verb: 'SFX', target: 'Phone buzz', text: 'Phone buzz', icon: 'sound', seconds: SCREEN_SECONDS,
    });
    expect(soundLine('[MUSIC: theme]')).toBeNull();
    expect(soundLine('[SFX: ]')).toBeNull();
    expect(soundWords('door  creak')).toBe('Door creak');
  });

  test('the teleprompter keeps it with on-screen moments, and hides it with them', () => {
    const lines = teleprompterLines(['[SFX: notification ping]', 'Me: "Who is texting us?"', '[MUSIC: sting]'], { screen: true });
    expect(lines.map((l) => l.kind)).toEqual(['screen', 'mine']);
    expect(lines[0].text).toBe('Notification ping');
    expect(withoutScreen(lines).map((l) => l.kind)).toEqual(['mine']);
    // Without screen moments the lines are as before (voice-clip indexes unchanged).
    expect(teleprompterLines(['[SFX: ping]', 'Me: "Hi."']).map((l) => l.kind)).toEqual(['mine']);
  });

  test('in a picked script it has no voice-clip index, like a [UI:] moment', () => {
    const { beats } = teleprompterScript('## BEAT: 4 · Interruption\n[SFX: ping]\nMe: "Hold on."');
    expect(beats[0].lines.map((l) => [l.kind, l.vi])).toEqual([['screen', null], ['mine', 0]]);
  });
});
