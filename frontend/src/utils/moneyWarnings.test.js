/**
 * MB4 (§8(gg)): the confirm message shown before Complete.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../services/api';
import { completeMoneyWarning } from './moneyWarnings';

describe('completeMoneyWarning', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });

  test('lists each warning and asks to complete anyway', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { warnings: [
      { code: 'PROJECTED_BELOW_ZERO', message: "After this episode Lala's balance is projected at -40: 40 short." },
      { code: 'COSTS_EXCEED_BALANCE', message: 'Event spending (150) is more than Lala has (100): 50 short before any income arrives.' },
    ] } } });

    const text = await completeMoneyWarning('show-1', 'ep-1');

    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/episodes/ep-1/money');
    expect(text).toBe("Money warning:\n• After this episode Lala's balance is projected at -40: 40 short.\n• Event spending (150) is more than Lala has (100): 50 short before any income arrives.\n\nComplete anyway?");
  });

  test('null when nothing warns, when ids are missing, or when the read fails', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { warnings: [] } } });
    expect(await completeMoneyWarning('show-1', 'ep-1')).toBeNull();
    expect(await completeMoneyWarning(null, 'ep-1')).toBeNull();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    expect(await completeMoneyWarning('show-1', 'ep-1')).toBeNull();
  });
});
