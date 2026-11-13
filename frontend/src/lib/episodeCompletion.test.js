/**
 * The one completion operation every screen uses (Evoni, 2026-11-12).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../services/api';
import { completeEpisode, completionRefusal, COMPLETE_CONFIRM } from './episodeCompletion';

const refused = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
const yes = () => true;

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: { warnings: [] } } });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: { success: true, data: { evaluation: { tier: 'pass', score: 71 } } } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('completeEpisode', () => {
  test('asks first, then calls the one authoritative endpoint, by the episode\'s own id', async () => {
    const confirm = vi.fn(() => true);
    const out = await completeEpisode({ showId: 'show-1', episodeId: 'ep-1', title: 'Gala Night', confirm });
    expect(confirm).toHaveBeenCalledWith(COMPLETE_CONFIRM('Gala Night'));
    expect(vi.mocked(api.post).mock.calls).toEqual([['/api/v1/world/show-1/episodes/ep-1/complete']]);
    expect(out).toEqual({ status: 'completed', data: { evaluation: { tier: 'pass', score: 71 } } });
  });

  test('says it is final and what it does', () => {
    expect(COMPLETE_CONFIRM('Gala Night')).toMatch(/books its money in the ledger/);
    expect(COMPLETE_CONFIRM('Gala Night')).toMatch(/It is final/);
  });

  test('cancelled at the question: nothing is sent', async () => {
    expect(await completeEpisode({ showId: 'show-1', episodeId: 'ep-1', confirm: () => false })).toEqual({ status: 'cancelled' });
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a money warning is asked about too; declining it sends nothing', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { warnings: [{ message: 'This leaves 12 coins.' }] } } });
    const confirm = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(await completeEpisode({ showId: 'show-1', episodeId: 'ep-1', confirm })).toEqual({ status: 'cancelled' });
    expect(confirm.mock.calls[1][0]).toMatch(/This leaves 12 coins/);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a repeat is "already", never an error', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { already_completed: true, evaluation: { tier_final: 'pass' } } } });
    expect((await completeEpisode({ showId: 'show-1', episodeId: 'ep-1', confirm: yes })).status).toBe('already');
  });

  test('without the show it is refused here, and nothing is sent', async () => {
    const out = await completeEpisode({ showId: null, episodeId: 'ep-1', confirm: yes });
    expect(out.status).toBe('refused');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a refusal is returned, not thrown, in the server\'s words', async () => {
    vi.mocked(api.post).mockRejectedValue(refused(409, { success: false, error: 'The terms of "Velvet Gala" are reopened. Save and relock them first.', code: 'EVENT_TERMS_REOPENED', event: { id: 'ev-1' } }));
    const out = await completeEpisode({ showId: 'show-1', episodeId: 'ep-1', confirm: yes });
    expect(out.status).toBe('refused');
    expect(out.refusal).toEqual({
      status: 409, code: 'EVENT_TERMS_REOPENED', title: 'The event\'s terms are reopened',
      message: 'The terms of "Velvet Gala" are reopened. Save and relock them first.',
      action: { label: 'Open the event package', to: '/shows/show-1/events/ev-1' },
    });
  });
});

describe('completionRefusal: each known refusal has a title and somewhere to go', () => {
  const ids = { showId: 'show-1', episodeId: 'ep-1' };
  test.each([
    ['INSUFFICIENT_COINS', { label: 'Open Money', tab: 'money' }],
    ['UNSUPPORTED_SECONDARY_OBLIGATIONS', { label: 'Open this episode\'s events', tab: 'overview' }],
    ['EPISODE_EVENT_LINK_INCONSISTENT', { label: 'Open this episode\'s events', tab: 'overview' }],
    ['TWO_PART_TO_BE_CONTINUED', { label: 'Open the Season Roadmap', to: '/shows/show-1/season?tab=roadmap' }],
    ['RETRY', { label: 'Try again', retry: true }],
  ])('%s', (code, action) => {
    const r = completionRefusal(refused(409, { success: false, error: 'The server said why.', code }), ids);
    expect(r.code).toBe(code);
    expect(r.message).toBe('The server said why.');
    expect(r.title).toBeTruthy();
    expect(r.action).toEqual(action);
  });

  test('not an admin: said plainly, with nothing to press', () => {
    const r = completionRefusal(refused(403, { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }), ids);
    expect(r).toMatchObject({ status: 403, code: 'AUTH_GROUP_REQUIRED', title: 'Only an admin can complete an episode', action: null });
    expect(r.message).toMatch(/needs an admin account/);
  });

  test('an unknown refusal keeps the server\'s words; a server failure says so; no response at all still says something', () => {
    expect(completionRefusal(refused(409, { error: 'Something specific.', code: 'SOMETHING_NEW' }), ids)).toMatchObject({ title: 'The episode was not completed', message: 'Something specific.', action: null });
    expect(completionRefusal(refused(500, { error: 'boom' }), ids).title).toBe('The server could not complete the episode');
    expect(completionRefusal(new Error('Network Error'), ids)).toMatchObject({ status: null, code: null, message: 'Network Error' });
  });
});
