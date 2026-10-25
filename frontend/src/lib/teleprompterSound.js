/**
 * Sound cues in the teleprompter: a script's `[SFX: …]` line is a sound the
 * edit will add (a phone buzz, a door), and she reacts to it on camera. The
 * teleprompter shows it as the same 3-second reaction cue as an on-screen
 * moment (lib/teleprompterScreen),
 *   { kind: 'screen', sound: true, kicker: 'Sound', who: null, verb: 'SFX',
 *     target, text, icon: 'sound', seconds: 3 }
 * so it is counted, paced and hidden ("Show on-screen moments" off) exactly
 * like one. Pure: no React, no network.
 */
import { SCREEN_SECONDS } from './teleprompterScreen';

export const SOUND_KICKER = 'Sound';
const SFX_LINE = /^\s*\[\s*(?:SFX|SOUND)\s*:\s*([^\]]*?)\s*\]?\s*$/i;

/** "phone_buzz x2" → "Phone buzz x2": the sound in plain words. */
export function soundWords(value) {
  const t = String(value || '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** The cue for a `[SFX: …]` line, or null for any other line. */
export function soundLine(line) {
  const m = String(line ?? '').match(SFX_LINE);
  if (!m) return null;
  const words = soundWords(m[1]);
  if (!words) return null;
  return { kind: 'screen', sound: true, kicker: SOUND_KICKER, who: null, verb: 'SFX', target: words, text: words, icon: 'sound', seconds: SCREEN_SECONDS };
}
