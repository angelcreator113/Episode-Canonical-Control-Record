import { describe, beforeEach, test, expect } from 'vitest';
import { activeShowId, rememberShow, rememberedShowId, showIdFromPath, showLabel } from './activeShow';

// Task #3140: two shows of the same name read the same in a picker.
describe('showLabel', () => {
  test('a unique name is just the name', () => {
    expect(showLabel({ id: 'a1', name: 'Styling Adventures' }, [{ id: 'a1', name: 'Styling Adventures' }, { id: 'b2', name: 'Other' }])).toBe('Styling Adventures');
  });

  test('a shared name adds the episode count, and the id when the counts match too', () => {
    const shows = [
      { id: 'aaaaaaaa-1', name: 'Styling Adventures', episodeCount: 12 },
      { id: 'bbbbbbbb-2', name: 'Styling Adventures', episodeCount: 0 },
    ];
    expect(showLabel(shows[0], shows)).toBe('Styling Adventures · 12 episodes');
    expect(showLabel(shows[1], shows)).toBe('Styling Adventures · 0 episodes');
    const same = [{ id: 'aaaaaaaa-1', name: 'S', episodeCount: 1 }, { id: 'bbbbbbbb-2', name: 'S', episodeCount: 1 }];
    expect(showLabel(same[0], same)).toBe('S · 1 episode · aaaaaaaa');
    expect(showLabel({ id: 'cccccccc-3', name: 'S' }, [...same, { id: 'cccccccc-3', name: 'S' }])).toBe('S · cccccccc');
  });
});

const SHOWS = [{ id: 'show-a' }, { id: 'show-b' }];

describe('activeShow', () => {
  beforeEach(() => { window.localStorage.clear(); });

  test('reads the show from /shows/:id paths only', () => {
    expect(showIdFromPath('/shows/show-b/world')).toBe('show-b');
    expect(showIdFromPath('/shows/show-b')).toBe('show-b');
    expect(showIdFromPath('/shows')).toBeNull();
    expect(showIdFromPath('/shows/create')).toBeNull();
    expect(showIdFromPath('/episodes/ep-1')).toBeNull();
  });

  test('the URL\'s show, else the remembered one, else the only show; several and none to go on is null', () => {
    expect(activeShowId({ pathname: '/shows/show-b/world', shows: SHOWS })).toBe('show-b');
    expect(activeShowId({ pathname: '/', shows: SHOWS })).toBeNull();
    rememberShow('show-b');
    expect(rememberedShowId()).toBe('show-b');
    expect(activeShowId({ pathname: '/', shows: SHOWS })).toBe('show-b');
    // The URL wins over the remembered show.
    expect(activeShowId({ pathname: '/shows/show-a', shows: SHOWS })).toBe('show-a');
    // A remembered show that no longer exists is ignored.
    rememberShow('gone');
    expect(activeShowId({ pathname: '/', shows: SHOWS })).toBeNull();
    expect(activeShowId({ pathname: '/', shows: [{ id: 'only' }] })).toBe('only');
  });
});
