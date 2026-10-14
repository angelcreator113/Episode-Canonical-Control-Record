/**
 * Voice on Lala's Phone (spec §3; Evoni's ruling of 2026-10-14 on the phase 1
 * read, Task #3163): Voice is an action, not a screen. Tapping it shows a
 * brief "Lala speaks" toast and opens nothing, until the script cue language
 * (spec §8) gives it more to do.
 *
 * The phone is per-show data with no fixed key list, so the Voice icon is
 * found by its key or name: "voice", "talk", "talking", "speak" (her icon is
 * `talking_icon`). A zone is a Voice zone when it was placed from that icon.
 */
import { isIcon, resolveZoneIconKey } from './overlayUtils';

export const VOICE_TOAST = 'Lala speaks';

const VOICE_WORD = /(^|[^a-z])(voice|talk|talking|speak|speaking)([^a-z]|$)/i;

export const isVoiceIcon = (icon) => isIcon(icon) && VOICE_WORD.test(`${icon.id || ''} ${icon.name || ''}`);

export function isVoiceZone(zone, icons = []) {
  const key = resolveZoneIconKey(zone, icons);
  return !!key && isVoiceIcon((icons || []).find((i) => i.id === key));
}
