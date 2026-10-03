import { describe, beforeEach, test, expect } from 'vitest';
import { activeShowId, rememberShow, rememberedShowId, showIdFromPath } from './activeShow';

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
