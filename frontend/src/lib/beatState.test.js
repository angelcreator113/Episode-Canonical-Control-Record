/**
 * What is true at a beat (Task #2882): every value the episode's own, or an
 * honest empty state.
 */
import { describe, test, expect } from 'vitest';
import { beatState, beatCoins } from './beatState';

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

  test('coins: the balance before the episode plus the script so far', () => {
    expect(beatState(BEATS, 0, opts).coins).toEqual({ value: 420, text: '420 coins', detail: '420 before the episode; no coin changes in the script yet' });
    expect(beatState(BEATS, 1, opts).coins).toMatchObject({ value: 450, detail: '420 before the episode, +30 in the script so far (+30 here)' });
    expect(beatState(BEATS, 3, opts).coins).toMatchObject({ value: 350, detail: '420 before the episode, −70 in the script so far (−100 here)' });
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

  test('nothing in the data says so', () => {
    const s = beatState([{ number: 2, lines: ['(She waits.)'] }], 0, {});
    expect(s).toMatchObject({ where: 'No scene set', speaking: 'No one speaks yet', cast: null, storyTime: 'Story time not set', eventTimed: false });
    expect(beatState([{ number: 2, lines: [] }], 0, { episodeNumber: 3, event: { event_date: 'the night of the gala' } }).storyTime).toBe('During Ep 3 · the night of the gala');
    expect(beatState([], 0, {})).toBeNull();
  });
});
