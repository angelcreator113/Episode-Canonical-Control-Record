/**
 * What is true at a beat (Task #2882): every value the episode's own, or an
 * honest empty state.
 */
import { describe, test, expect } from 'vitest';
import { beatState, beatCoins, beatCoinParts } from './beatState';

const BEATS = [
  { number: 1, lines: ['Prime: "Hi besties."'] },
  { number: 4, lines: ['[STAT: coins +50]', 'Lala: "Paid!"', '[STAT: coins -20]'] },
  { number: 8, lines: ['[UI:OPEN Closet]', 'Prime: "What are we wearing?"'] },
  { number: 11, lines: ['[STAT: coins -100]', 'Marcus: "Welcome."', 'Lala: "Thank you."'] },
];
const OUTFIT = [{ name: 'Crimson Pump' }, { name: 'Satin Slip' }];
const EVENT = { event_date: '2026-11-12', event_time: '6:30 PM', canon_consequences: { automation: { guest_profiles: [{ display_name: 'Marcus', featured: true }, { handle: 'quiet_one' }] } } };
const PLAN = [{ beat_number: 11, scene_set_name: "STUDIO BY SABLE's Studio" }];
const opts = { balanceBefore: 420, outfit: OUTFIT, closetAt: 8, scenePlan: PLAN, event: EVENT, episodeNumber: 1 };

describe('beatState', () => {
  test('beatCoins sums a beat\'s coin tags only', () => {
    expect(beatCoins(BEATS[1].lines)).toBe(30);
    expect(beatCoins(['[STAT: stress +1]', 'Lala: "coins +5"'])).toBe(0);
  });

  // A + coin line is owed, paid next episode: not in the balance, and said
  // so (Script tab audit 6, 2026-10-24: +50 was counted).
  test('coins: the balance before the episode plus what the script spends so far; + lines are owed, not counted', () => {
    expect(beatCoinParts(BEATS[1].lines)).toEqual({ spent: -20, owed: 50 });
    expect(beatState(BEATS, 0, opts).coins).toEqual({ value: 420, text: '420 coins', detail: '420 before the episode; no coin changes in the script yet' });
    expect(beatState(BEATS, 1, opts).coins).toMatchObject({ value: 400, owed: 50, detail: '420 before the episode, −20 in the script so far (−20 here); +50 in + coin lines not counted (what she is owed is paid next episode)' });
    expect(beatState(BEATS, 3, opts).coins).toMatchObject({ value: 300, detail: '420 before the episode, −120 in the script so far (−100 here); +50 in + coin lines not counted (what she is owed is paid next episode)' });
    expect(beatState([{ number: 4, lines: ['[STAT: coins +50]'] }], 0, opts).coins.detail).toBe('420 before the episode; no coin changes in the script yet; +50 in + coin lines not counted (what she is owed is paid next episode)');
    expect(beatState(BEATS, 3, { ...opts, balanceBefore: null }).coins).toEqual({ value: null, text: 'Coins not read', detail: null });
  });

  test('wearing: getting dressed before the closet beat, the locked look from it on', () => {
    expect(beatState(BEATS, 1, opts).wearing).toMatchObject({ text: 'Getting dressed at Beat 8', beforeCloset: true });
    expect(beatState(BEATS, 2, opts).wearing.text).toBe('2 pieces: Crimson Pump, Satin Slip');
    expect(beatState(BEATS, 3, { ...opts, outfit: [] }).wearing.text).toBe('Not dressed yet');
    expect(beatState(BEATS, 3, { ...opts, outfit: null }).wearing.text).toBe('Look not read');
    expect(beatState(BEATS, 0, { ...opts, closetAt: null }).wearing.text).toBe('2 pieces: Crimson Pump, Satin Slip');
  });

  test('where, who speaks, the featured cast, and story time', () => {
    const s = beatState(BEATS, 3, opts);
    expect(s.where).toBe("STUDIO BY SABLE's Studio");
    expect(s.speaking).toBe('Marcus, Lala');
    expect(s.cast).toBe('Marcus');
    expect(s.storyTime).toBe('During Ep 1 · Thu, Nov 12, 2026 · 6:30 PM');
    expect(beatState(BEATS, 2, opts).where).toBe('No scene set');
  });

  // Script tab audit 6 (2026-10-24): the writer's cast, creator_name first.
  test("the cast is the writer's: the host and featured guests, by their real names when read", () => {
    const event = { source_profile_id: 5, canon_consequences: { automation: { guest_profiles: [{ profile_id: 9, display_name: 'Truthville', featured: true }] } } };
    const profiles = [{ id: 5, creator_name: 'Celeste Rue', display_name: 'Celeste Studio' }, { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville' }];
    expect(beatState(BEATS, 0, { event, profiles }).cast).toBe('Celeste Rue, Marcus Hale');
    expect(beatState(BEATS, 0, { event }).cast).toBe('Truthville');
  });

  test('nothing in the data says so', () => {
    const s = beatState([{ number: 2, lines: ['(She waits.)'] }], 0, {});
    expect(s).toMatchObject({ where: 'No scene set', speaking: 'No one speaks yet', cast: null, storyTime: 'Story time not set', eventTimed: false });
    expect(beatState([{ number: 2, lines: [] }], 0, { episodeNumber: 3, event: { event_date: 'the night of the gala' } }).storyTime).toBe('During Ep 3 · the night of the gala');
    expect(beatState([], 0, {})).toBeNull();
  });
});
