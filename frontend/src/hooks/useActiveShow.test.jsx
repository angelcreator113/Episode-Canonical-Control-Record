/**
 * useActiveShow (audit CTX-01, 2026-10-03): the active show by the shared
 * rule, and "needs a choice" with several shows and nothing to go on, never
 * the first show the API returned.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import useActiveShow from './useActiveShow';
import { rememberShow, rememberedShowId } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const at = (path) => ({ wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter> });

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: SHOWS } });
});

describe('useActiveShow', () => {
  test('several shows and nothing to go on: no show, a choice needed; choosing remembers it', async () => {
    const { result } = renderHook(() => useActiveShow(), at('/universe'));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.show).toBeNull();
    expect(result.current.needsChoice).toBe(true);
    act(() => result.current.choose('show-b'));
    expect(result.current.showId).toBe('show-b');
    expect(result.current.show.name).toBe('Styling Adventures');
    expect(result.current.needsChoice).toBe(false);
    expect(rememberedShowId()).toBe('show-b');
  });

  test('the show in the URL, else the remembered one, else the only show', async () => {
    const inUrl = renderHook(() => useActiveShow(), at('/shows/show-a/world'));
    await waitFor(() => expect(inUrl.result.current.showId).toBe('show-a'));
    expect(inUrl.result.current.needsChoice).toBe(false);

    rememberShow('show-b');
    const remembered = renderHook(() => useActiveShow(), at('/stories'));
    await waitFor(() => expect(remembered.result.current.showId).toBe('show-b'));

    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'only', name: 'Only Show' }] } });
    window.localStorage.clear();
    const only = renderHook(() => useActiveShow(), at('/stories'));
    await waitFor(() => expect(only.result.current.showId).toBe('only'));
  });

  test('a failed shows read is failed, not a choice and not a show', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    const { result } = renderHook(() => useActiveShow(), at('/universe'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({ failed: true, show: null, needsChoice: false, shows: [] });
    spy.mockRestore();
  });
});
