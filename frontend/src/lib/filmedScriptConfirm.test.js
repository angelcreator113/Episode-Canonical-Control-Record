/**
 * The filmed-script confirmation (Evoni, 2026-11-12; src/services/scriptSave.js):
 * asked once per episode per sitting, remembered only in the set the caller
 * holds, answered with that episode's own id, and never resent in a loop.
 */
import { describe, test, expect, vi } from 'vitest';
import { withFilmedConfirm, filmedConfirmBody, FILMED_CONFIRM_CODE, FILMED_CONFIRM_QUESTION } from './filmedScriptConfirm';

const asks = (episodeId, code = FILMED_CONFIRM_CODE) => Object.assign(new Error(code), { response: { status: 409, data: { code, episode_id: episodeId, error: 'filmed' } } });

describe('filmedScriptConfirm', () => {
  test('nothing is sent until the person has confirmed this episode', () => {
    const confirmed = new Set();
    expect(filmedConfirmBody(confirmed, 'ep-1')).toEqual({});
    confirmed.add('ep-1');
    expect(filmedConfirmBody(confirmed, 'ep-1')).toEqual({ confirm_filmed_edit: 'ep-1' });
    expect(filmedConfirmBody(confirmed, 'ep-2')).toEqual({});
    expect(filmedConfirmBody(null, 'ep-1')).toEqual({});
  });

  test('an episode that is not filmed: one request, no question', async () => {
    const send = vi.fn(async () => 'saved');
    const ask = vi.fn();
    expect(await withFilmedConfirm(new Set(), 'ep-1', send, ask)).toBe('saved');
    expect(send.mock.calls).toEqual([[{}]]);
    expect(ask).not.toHaveBeenCalled();
  });

  test('the server asks: the person is asked once, the save is sent again with this episode\'s id, and later saves bring it without asking', async () => {
    const confirmed = new Set();
    const send = vi.fn().mockRejectedValueOnce(asks('ep-1')).mockResolvedValue('saved');
    const ask = vi.fn(() => true);
    expect(await withFilmedConfirm(confirmed, 'ep-1', send, ask)).toBe('saved');
    expect(ask.mock.calls).toEqual([[FILMED_CONFIRM_QUESTION]]);
    expect(send.mock.calls).toEqual([[{}], [{ confirm_filmed_edit: 'ep-1' }]]);
    expect(await withFilmedConfirm(confirmed, 'ep-1', send, ask)).toBe('saved');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[2]).toEqual([{ confirm_filmed_edit: 'ep-1' }]);
  });

  test('"no": nothing more is sent, the error is marked filmedDeclined, and the next save asks again', async () => {
    const confirmed = new Set();
    const send = vi.fn().mockRejectedValue(asks('ep-1'));
    const err = await withFilmedConfirm(confirmed, 'ep-1', send, () => false).catch((e) => e);
    expect(err.filmedDeclined).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(confirmed.size).toBe(0);
    const ask = vi.fn(() => false);
    await withFilmedConfirm(confirmed, 'ep-1', send, ask).catch(() => {});
    expect(ask).toHaveBeenCalledTimes(1);
  });

  test('one episode\'s answer is not sent for another, which is asked for itself', async () => {
    const confirmed = new Set(['ep-1']);
    const send = vi.fn().mockRejectedValueOnce(asks('ep-2')).mockResolvedValue('saved');
    const ask = vi.fn(() => true);
    await withFilmedConfirm(confirmed, 'ep-2', send, ask);
    expect(send.mock.calls).toEqual([[{}], [{ confirm_filmed_edit: 'ep-2' }]]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  test('a refusal that names another episode, another code, or one that comes back after confirming is passed on, not answered', async () => {
    const ask = vi.fn(() => true);
    for (const error of [asks('ep-9'), asks('ep-1', 'FILMED_SCRIPT_PROTECTED'), asks('ep-1', 'SCRIPT_CHANGED'), new Error('network')]) {
      const send = vi.fn().mockRejectedValue(error);
      // eslint-disable-next-line no-await-in-loop
      expect(await withFilmedConfirm(new Set(), 'ep-1', send, ask).catch((e) => e)).toBe(error);
      expect(send).toHaveBeenCalledTimes(1);
    }
    expect(ask).not.toHaveBeenCalled();
    // Still asked for after the confirmation was sent: sent twice at most, never in a loop.
    const send = vi.fn().mockRejectedValue(asks('ep-1'));
    await withFilmedConfirm(new Set(), 'ep-1', send, ask).catch(() => {});
    expect(send).toHaveBeenCalledTimes(2);
    const already = new Set(['ep-1']);
    const again = vi.fn().mockRejectedValue(asks('ep-1'));
    await withFilmedConfirm(already, 'ep-1', again, ask).catch(() => {});
    expect(again).toHaveBeenCalledTimes(1);
  });
});
