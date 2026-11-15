/**
 * Where an episode sits, from what it stores (Evoni, 2026-11-15, Producer
 * Mode navigation): its season snapshot only. Nothing is worked out from
 * the episode's number or dates, and a special is in no slot.
 */
import { describe, test, expect, vi } from 'vitest';
import { seasonContextOf, episodeSeasonNumber, episodeSeasonHref, episodeSlotLink } from './episodePlace';

const weekly = { season_number: 2, slot_number: 5, label: 'S2 · E5' };
const special = { season_number: 2, slot_number: null, label: 'S2 · Bonus after E5', special: { id: 'sp-1', kind: 'bonus', label: 'Bonus after E5', after_slot_number: 5 } };

describe('seasonContextOf', () => {
  test('an object, a JSON string, or nothing', () => {
    expect(seasonContextOf({ season_context: weekly })).toEqual(weekly);
    expect(seasonContextOf({ season_context: JSON.stringify(weekly) })).toEqual(weekly);
    for (const ep of [null, {}, { season_context: null }, { season_context: '' }, { season_context: [] }, { season_context: '[1]' }, { season_context: '"x"' }]) {
      expect(seasonContextOf(ep)).toBeNull();
    }
  });
  test('a snapshot that is not JSON is no snapshot, and is logged', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(seasonContextOf({ season_context: '{nope' })).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('the season', () => {
  test('is the snapshot\'s, never the episode\'s own column', () => {
    expect(episodeSeasonNumber({ season_context: weekly, season_number: 9 })).toBe(2);
    // An episode no season placed: its column says 1 whatever seasons the show has.
    expect(episodeSeasonNumber({ season_number: 1 })).toBeNull();
    expect(episodeSeasonNumber({ season_context: { season_number: 0 } })).toBeNull();
    expect(episodeSeasonNumber({ season_context: { season_number: '3' } })).toBe(3);
    expect(episodeSeasonNumber({ season_context: { season_number: 'x' } })).toBeNull();
  });
  test('the Season page opens on it; with none, on the season in progress', () => {
    expect(episodeSeasonHref('show-1', { season_context: weekly }, 'episodes')).toBe('/shows/show-1/season?tab=episodes&season=2');
    expect(episodeSeasonHref('show-1', { season_number: 1, episode_number: 30 }, 'episodes')).toBe('/shows/show-1/season?tab=episodes');
    expect(episodeSeasonHref('show 1', null, 'episodes')).toBe('/shows/show%201/season?tab=episodes');
  });
});

describe('episodeSlotLink', () => {
  test('a weekly episode: its stored slot, opened on the Roadmap of its season', () => {
    expect(episodeSlotLink('show-1', { season_context: weekly })).toEqual({
      kind: 'slot', slot: 5, season: 2, label: 'S2 · E5', href: '/shows/show-1/season?tab=roadmap&season=2&slot=5',
    });
    expect(episodeSlotLink('show-1', { season_context: { slot_number: 7 } })).toMatchObject({ label: 'E7', href: '/shows/show-1/season?tab=roadmap&slot=7' });
  });

  test('the slot is the stored one, not the episode number', () => {
    // Episode 12 of the show, placed in slot 3 of season 2.
    const link = episodeSlotLink('show-1', { episode_number: 12, season_number: 1, season_context: { season_number: 2, slot_number: 3, label: 'S2 · E3' } });
    expect(link.href).toBe('/shows/show-1/season?tab=roadmap&season=2&slot=3');
  });

  test('a special is in no slot: the Roadmap of its season, and no slot is taken from the one it follows', () => {
    const link = episodeSlotLink('show-1', { season_context: special });
    expect(link).toEqual({ kind: 'special', slot: null, season: 2, label: 'S2 · Bonus after E5', href: '/shows/show-1/season?tab=roadmap&season=2' });
    expect(link.href).not.toMatch(/slot=/);
    expect(episodeSlotLink('show-1', { season_context: { slot_number: null, special: { id: 'sp-2', label: 'Holiday special' } } })).toMatchObject({ kind: 'special', label: 'Holiday special', href: '/shows/show-1/season?tab=roadmap' });
  });

  test('no stored place: no link, whatever its number or dates say', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const ep of [
      null, {}, { episode_number: 5, season_number: 1, air_date: '2026-11-12' },
      { season_context: {} }, { season_context: { season_number: 2 } }, { season_context: { slot_number: 0 } },
      { season_context: { slot_number: -1 } }, { season_context: { slot_number: 'five' } }, { season_context: { slot_number: 2.5 } },
      { season_context: { special: {} } }, { season_context: '{nope' },
    ]) {
      expect(episodeSlotLink('show-1', ep)).toBeNull();
    }
    expect(episodeSlotLink(null, { season_context: weekly })).toBeNull();
    err.mockRestore();
  });
});
