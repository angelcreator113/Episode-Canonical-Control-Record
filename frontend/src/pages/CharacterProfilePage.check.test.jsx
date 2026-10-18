/**
 * The consistency check on the character page (Character Consistency Engine
 * step 3; Evoni, 2026-10-16): flag-only, with "Fix", "Edit the text" and
 * "It's intentional". Suggest fixes and Fix all (Evoni, 2026-10-17: "i want
 * to be able to auto fix the text issues").
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { ProfileCheck } from './CharacterProfilePage';

const FLAG = {
  id: 'abc123abc123', check: 'followers', field: 'character.description', field_label: 'Description',
  found: '1.2M followers', expected: '2M followers', excerpt: 'A slow-fashion creator with 1.2M followers who stopped posting.',
};
const result = (flags, intentional = []) => ({ data: { success: true, flags, intentional, checked: 12, skipped: { mask: 4, author: 2 }, undecided: [] } });

describe('ProfileCheck', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.delete.mockReset(); });

  test('runs on request and lists what disagrees, saying what was not checked', async () => {
    api.get.mockResolvedValue(result([FLAG]));
    render(<ProfileCheck characterId="c1" />);
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    const box = await screen.findByTestId('ch-check');
    expect(await within(box).findByText(/1 place disagrees with their facts/)).toBeTruthy();
    expect(within(box).getByText(/what they post \(4\) and author-only notes \(2\) are not checked/)).toBeTruthy();
    expect(within(box).getByText(FLAG.excerpt)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check');
  });

  test('"It\'s intentional" marks it and re-checks; it moves to the intentional list', async () => {
    api.get.mockResolvedValueOnce(result([FLAG])).mockResolvedValueOnce(result([], [{ ...FLAG, note: null }]));
    api.post.mockResolvedValue({ data: { success: true } });
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    fireEvent.click(await screen.findByText('It’s intentional'));
    expect(await screen.findByText('1 marked intentional')).toBeTruthy();
    expect(screen.getByText(/Everything agrees with their facts./)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check/intentional', { flag_id: FLAG.id, note: null });
  });

  test('"Fix" puts the suggested wording in place and shows the check after', async () => {
    const flag = { ...FLAG, fix: '2M followers', editable: true, text: FLAG.excerpt };
    api.get.mockResolvedValue(result([flag]));
    api.post.mockResolvedValue(result([]));
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    fireEvent.click(await screen.findByText('Fix: “2M followers”'));
    expect(await screen.findByText(/Everything agrees with their facts./)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check/fix', { flag_id: FLAG.id });
  });

  test('"Edit the text" opens the whole field and saves her own wording', async () => {
    const flag = { ...FLAG, fix: null, editable: true, text: 'A slow-fashion creator with 1.2M followers.' };
    api.get.mockResolvedValue(result([flag]));
    api.post.mockResolvedValue(result([]));
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    expect(screen.queryByText(/^Fix:/)).toBeNull();
    fireEvent.click(await screen.findByText('Edit the text'));
    const box = screen.getByLabelText('Description');
    expect(box.value).toBe(flag.text);
    fireEvent.change(box, { target: { value: 'A slow-fashion creator who stopped posting.' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText(/Everything agrees with their facts./)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check/fix', { flag_id: FLAG.id, text: 'A slow-fashion creator who stopped posting.' });
  });

  test('a stored copy has a fix but no text to edit', async () => {
    api.get.mockResolvedValue(result([{ ...FLAG, fix: '2M', editable: false }]));
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    expect(await screen.findByText('Fix: “2M”')).toBeTruthy();
    expect(screen.queryByText('Edit the text')).toBeNull();
  });

  test('a failed check says so', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'Character not found' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    expect((await screen.findByRole('alert')).textContent).toBe('Character not found');
  });

  const STATUS = {
    id: 'def456def456', check: 'account_status', field: 'character.description', field_label: 'Description',
    found: 'went dark', expected: 'account status "rising"', excerpt: '…She went dark after the retakes…',
    fix: null, editable: true, text: 'She went dark after the retakes.',
  };
  const MOOD = { ...STATUS, id: 'aaa111aaa111', found: 'goes quiet', field_label: 'Wound', excerpt: '…she goes quiet for days…' };

  test('Suggest fixes shows a rewrite to use, or that it is fine as it is', async () => {
    api.get.mockResolvedValue(result([STATUS, MOOD]));
    api.post.mockImplementation(async (url) => (url.endsWith('/suggest') ? { data: { suggestions: [
      { flag_id: STATUS.id, verdict: 'fix', before: 'She went dark after the retakes.', after: 'She kept posting through the retakes.', why: 'She is rising.' },
      { flag_id: MOOD.id, verdict: 'fine', before: 'she goes quiet for days.', after: null, why: 'A mood, not her account.' },
    ] } } : result([MOOD])));
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    fireEvent.click(await screen.findByText('Suggest fixes'));
    expect(await screen.findByText(/Suggested: “She kept posting through the retakes.”/)).toBeTruthy();
    expect(screen.getByText('Looks fine as it is.')).toBeTruthy();
    expect(screen.getByText(/A mood, not her account./)).toBeTruthy();
    fireEvent.click(screen.getByText('Use this'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check/fix',
      { flag_id: STATUS.id, before: 'She went dark after the retakes.', after: 'She kept posting through the retakes.' }));
  });

  test('Fix all applies the one-click fixes and every suggestion; a fine one is marked intentional with why', async () => {
    const followers = { ...FLAG, fix: '2M followers', editable: true, text: FLAG.excerpt };
    api.get.mockResolvedValueOnce(result([followers, STATUS, MOOD])).mockResolvedValue(result([], [{ ...MOOD, note: 'A mood.' }]));
    api.post.mockImplementation(async (url) => (url.endsWith('/suggest') ? { data: { suggestions: [
      { flag_id: STATUS.id, verdict: 'fix', before: 'She went dark after the retakes.', after: 'She kept posting.', why: '' },
      { flag_id: MOOD.id, verdict: 'fine', before: 'x', after: null, why: 'A mood.' },
    ] } } : { data: { success: true } }));
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    expect(await screen.findByText('Fix all 1')).toBeTruthy();
    fireEvent.click(screen.getByText('Suggest fixes'));
    fireEvent.click(await screen.findByText('Fix all 3'));
    expect(await screen.findByText('Fixed 3.')).toBeTruthy();
    const posts = api.post.mock.calls.map(([url, body]) => [url.replace('/api/v1/cast/characters/c1/check', ''), body]);
    expect(posts).toEqual([
      ['/suggest', undefined],
      ['/fix', { flag_id: FLAG.id }],
      ['/fix', { flag_id: STATUS.id, before: 'She went dark after the retakes.', after: 'She kept posting.' }],
      ['/intentional', { flag_id: MOOD.id, note: 'A mood.' }],
    ]);
    expect(screen.getByText(/Everything agrees with their facts./)).toBeTruthy();
  });
});
