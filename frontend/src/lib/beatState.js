/**
 * What is true at a beat of the script (Task #2882): the "True at Beat N"
 * card. Every value is the episode's own, or says honestly that there is
 * none (docs/reads/2026-10-11-beat-state-read.md; Evoni's choices of
 * 2026-10-11):
 *
 *   Coins     - Lala's balance before the episode (the ledger less this
 *               episode's own rows), plus the script's [STAT: coins ±n] tags
 *               up to and including this beat.
 *   Wearing   - before the closet beat she is getting dressed; from it on,
 *               the look locked on the Wardrobe tab.
 *   Where     - the beat's scene plan row.
 *   In the room - who speaks in the beat; the event's featured guests as an
 *               episode-wide "Cast" line.
 *   Story time - "During Ep n" (every beat of an episode is the same story
 *               time, services/storyClock) with the event's own date and time.
 *
 * Stress is left off: it changes once, when the episode is completed, so it
 * cannot be true per beat.
 */
import { beatSpeakers } from './scriptMoments';
import { resolveEventVenueAndDate } from '../utils/eventReadiness';
import { coinChange } from './scriptStats';

// A coin line in any form the writer uses, read by the one reader every
// check shares (lib/scriptStats; Script page re-audit, 2026-10-19: the card,
// the rules and the server's coin pass each read them their own way).
export { coinChange };

/** The sum of a beat's [STAT: coins ±n] tags. */
export function beatCoins(lines = []) {
  return (lines || []).reduce((sum, line) => sum + (coinChange(line) ?? 0), 0);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
function dateText(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  const m = s.match(ISO_DATE);
  if (!m) return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString()}`;

/**
 * beats: the Script tab's beats ({ number, lines }); index: the open beat's.
 * balanceBefore: a number, or null when it could not be read. outfit: the
 * locked pieces, or null when they could not be read. closetAt: the closet
 * beat's number (closetBeat), or null.
 */
export function beatState(beats = [], index = 0, { balanceBefore = null, outfit = [], closetAt = null, scenePlan = [], event = null, episodeNumber = null } = {}) {
  const beat = beats[index];
  if (!beat) return null;

  // Coins: the balance before the episode, and the script's changes so far.
  const fromScript = beats.slice(0, index + 1).reduce((sum, b) => sum + beatCoins(b.lines), 0);
  const here = beatCoins(beat.lines);
  const coins = Number.isFinite(balanceBefore)
    ? {
      value: balanceBefore + fromScript,
      text: `${(balanceBefore + fromScript).toLocaleString()} coins`,
      detail: fromScript ? `${balanceBefore.toLocaleString()} before the episode, ${signed(fromScript)} in the script so far${here ? ` (${signed(here)} here)` : ''}` : `${balanceBefore.toLocaleString()} before the episode; no coin changes in the script yet`,
    }
    : { value: null, text: 'Coins not read', detail: null };

  // Wearing: getting dressed before the closet beat, the locked look from it on.
  const names = Array.isArray(outfit) ? outfit.map((p) => p?.name).filter(Boolean) : [];
  let wearing;
  // Before the closet beat by place in the script, as the to-do list reads it
  // (todoModeAt), so moved beats don't make the two cards disagree.
  const closetIndex = closetAt == null ? -1 : beats.findIndex((b) => b.number === closetAt);
  const beforeCloset = closetAt != null && (closetIndex >= 0 ? index < closetIndex : beat.number < closetAt);
  if (beforeCloset) wearing = { text: `Getting dressed at Beat ${closetAt}`, pieces: [], beforeCloset: true };
  else if (outfit === null) wearing = { text: 'Look not read', pieces: [] };
  else if (Array.isArray(outfit) && outfit.length) wearing = { text: `${outfit.length} piece${outfit.length === 1 ? '' : 's'}${names.length ? `: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : ''}`, pieces: names };
  else wearing = { text: 'Not dressed yet', pieces: [] };

  // Where: the beat's scene plan row.
  const plan = (scenePlan || []).find((p) => p && p.beat_number === beat.number);
  const where = plan?.scene_set_name || 'No scene set';

  // In the room: who speaks here; the featured guests across the episode.
  const speaking = beatSpeakers(beat.lines);
  const guests = (event?.canon_consequences?.automation?.guest_profiles || []).filter((g) => g && g.featured);
  const cast = [...new Set(guests.map((g) => g.display_name || g.handle).filter(Boolean))];

  // Story time: the episode, with the event's own date and time.
  const { eventDate, eventTime } = event ? resolveEventVenueAndDate(event) : {};
  const when = [dateText(eventDate), typeof eventTime === 'string' && eventTime.trim() ? eventTime.trim() : null].filter(Boolean);
  const storyTime = Number.isFinite(Number(episodeNumber)) && episodeNumber !== null && episodeNumber !== ''
    ? [`During Ep ${Number(episodeNumber)}`, ...when].join(' · ')
    : when.length ? when.join(' · ') : 'Story time not set';

  return {
    number: beat.number,
    coins,
    wearing,
    where,
    speaking: speaking.length ? speaking.join(', ') : 'No one speaks yet',
    cast: cast.length ? cast.join(', ') : null,
    storyTime,
    eventTimed: when.length > 0,
  };
}
