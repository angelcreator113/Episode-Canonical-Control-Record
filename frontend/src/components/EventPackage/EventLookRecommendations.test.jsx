/**
 * EventLookRecommendations — whole outfits from the closet (Evoni,
 * 2026-10-03, episode creation step 3): Use this look saves the outfit,
 * asks first when it would replace one, and a failed page refresh after the
 * save is not reported as a failed save.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EventLookRecommendations from './EventLookRecommendations';

const piece = (id, clothing_category, event_match) => ({ id, name: id, clothing_category, event_match, is_owned: true, coin_cost: 0 });
const CLOSET = [piece('midi', 'dress', 92), piece('sandals', 'sandals', 90), piece('hoops', 'earrings', 88)];
const OPTIONS = '/api/v1/world/show-1/events/ev-1/wardrobe-options';
const OUTFIT = '/api/v1/world/show-1/events/ev-1/outfit';

const renderLooks = (props = {}) => {
  const onSaved = vi.fn(async () => {});
  const onToast = vi.fn();
  render(<EventLookRecommendations showId="show-1" eventId="ev-1" onSaved={onSaved} onToast={onToast} onBrowse={() => {}} {...props} />);
  return { onSaved, onToast };
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { items: CLOSET } });
  api.put.mockResolvedValue({ data: { success: true } });
});

describe('EventLookRecommendations', () => {
  test('Use this look saves the outfit through PUT and refreshes the page', async () => {
    const { onSaved } = renderLooks();
    const [use] = await screen.findAllByTestId('look-use');
    expect(api.get).toHaveBeenCalledWith(OPTIONS);
    fireEvent.click(use);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(OUTFIT, { wardrobe_ids: expect.arrayContaining(['midi']) });
  });

  test('with an outfit chosen (hasOutfit), it asks before replacing it; declined, nothing is sent', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLooks({ hasOutfit: true });
    const [use] = await screen.findAllByTestId('look-use');
    fireEvent.click(use);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(api.put).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('without one, no question is asked', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderLooks();
    const [use] = await screen.findAllByTestId('look-use');
    fireEvent.click(use);
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('a save that succeeds while the page refresh fails says so, not "Failed to save"', async () => {
    const onSaved = vi.fn().mockRejectedValue(new Error('reload failed'));
    const { onToast } = renderLooks({ onSaved });
    const [use] = await screen.findAllByTestId('look-use');
    fireEvent.click(use);
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/^Saved — couldn't refresh/)));
    expect(onToast.mock.calls.some(([m]) => /Failed/.test(m))).toBe(false);
  });

  test('a failed closet load says so', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderLooks();
    expect(await screen.findByTestId('looks-failed')).toBeTruthy();
  });
});
