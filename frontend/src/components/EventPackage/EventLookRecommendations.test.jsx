/**
 * EventLookRecommendations — whole outfits from the closet (Evoni,
 * 2026-10-03, episode creation step 3): Use this look saves the outfit at
 * once with an Undo that saves the outfit it replaced back (Evoni,
 * 2026-10-23: undo instead of confirm), asks first only when the outfit it
 * replaces cannot be read, and a failed page refresh after the save is not
 * reported as a failed save.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EventLookRecommendations from './EventLookRecommendations';
import { resetUndoStore } from './useUndo';
import { hideFloatingUndos } from './UndoNotice';

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

// The closet for wardrobe-options; the event's current outfit for GET …/outfit.
const mockGets = (current = []) => api.get.mockImplementation(async (url) => (
  url === OUTFIT ? { data: { success: true, pieces: current } } : { data: { items: CLOSET } }
));

beforeEach(() => {
  vi.clearAllMocks();
  resetUndoStore();
  hideFloatingUndos();
  mockGets();
  api.put.mockResolvedValue({ data: { success: true } });
});
afterEach(() => { resetUndoStore(); hideFloatingUndos(); });

describe('EventLookRecommendations', () => {
  test('Use this look saves the outfit through PUT and refreshes the page', async () => {
    const { onSaved } = renderLooks();
    const [use] = await screen.findAllByTestId('look-use');
    expect(api.get).toHaveBeenCalledWith(OPTIONS);
    fireEvent.click(use);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(OUTFIT, { wardrobe_ids: expect.arrayContaining(['midi']) });
  });

  test('with an outfit chosen (hasOutfit), it is replaced at once; Undo saves the previous pieces back and refreshes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockGets([{ id: 'old-dress' }, { id: 'old-shoes' }]);
    const { onSaved } = renderLooks({ hasOutfit: true });
    const [use] = await screen.findAllByTestId('look-use');
    fireEvent.click(use);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(OUTFIT, { wardrobe_ids: expect.arrayContaining(['midi']) }));
    expect(confirmSpy).not.toHaveBeenCalled();
    // The page refreshes at once (it then hides these recommendations), and
    // the Undo floats at the foot of the screen, a live region with a button.
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const notice = await screen.findByTestId('undo-floating-notice');
    expect(notice.textContent).toMatch(/chosen/);
    expect(notice.closest('[role="status"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(OUTFIT, { wardrobe_ids: ['old-dress', 'old-shoes'] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('undo-floating-notice')).toBeNull());
    confirmSpy.mockRestore();
  });

  test('when the outfit it would replace cannot be read, it asks first (Undo could not restore it); declined, nothing is sent', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.get.mockImplementation(async (url) => {
      if (url === OUTFIT) throw new Error('network');
      return { data: { items: CLOSET } };
    });
    renderLooks({ hasOutfit: true });
    const [use] = await screen.findAllByTestId('look-use');
    fireEvent.click(use);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
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
