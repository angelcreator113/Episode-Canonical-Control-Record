import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import RateCardTab from './RateCardTab';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const TIERS = [
  { tier: 1, key: 'emerging', label: 'Emerging' }, { tier: 2, key: 'rising', label: 'Rising' },
  { tier: 3, key: 'established', label: 'Established' }, { tier: 4, key: 'influential', label: 'Influential' },
  { tier: 5, key: 'elite', label: 'Elite' },
];
const table = (version, videoAt3 = 225) => ({
  version,
  tiers: TIERS,
  anchors: [
    { component: 'paid_appearance', label: 'Appearance fee', unit: 'flat', amounts: { 1: 150, 2: 250, 3: 450, 4: 650, 5: 900 } },
    { component: 'brand_partnership_base', label: 'Partnership base', unit: 'flat', amounts: { 1: null, 2: 500, 3: 900, 4: 1300, 5: 1800 } },
    { component: 'pulse_video', label: 'Pulse video', unit: 'per piece', amounts: { 1: 75, 2: 125, 3: videoAt3, 4: 325, 5: 450 } },
  ],
  premiums: [{ kind: 'paid_ad', label: 'Paid ad / whitelisting', keys: [{ key: 'whitelisting', percent: null }] }],
});
const VERSIONS = [{ version: 2, note: 'Seeded: v1 plus the deliverable formats', created_by_name: 'migration', created_at: '2026-10-01T00:00:00Z', changes: null }];

describe('RateCardTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, table: table(2), versions: VERSIONS } });
  });

  it('shows each price at each career tier, empty where not offered, and the versions', async () => {
    render(<RateCardTab />);
    expect((await screen.findByLabelText('Pulse video, Established')).value).toBe('225');
    expect((screen.getByLabelText('Partnership base, Emerging')).value).toBe('');
    expect(screen.getByText('Elite')).toBeTruthy();
    expect(screen.getByText(/Seeded: v1 plus the deliverable formats/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/deal-rates/editor');
    expect((screen.getByTestId('rate-card-save')).disabled).toBe(true);
  });

  it('saves only the edited cells, against the version shown, and shows the new version', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {
      success: true, saved: { version: 3 }, table: table(3, 260),
      versions: [{ version: 3, note: 'Up at Established', created_by_name: 'Evoni', changes: { anchors: [{ component: 'pulse_video', career_tier: 3, from: 225, to: 260 }], premiums: [] } }, ...VERSIONS],
    } });
    render(<RateCardTab />);
    fireEvent.change(await screen.findByLabelText('Pulse video, Established'), { target: { value: '260' } });
    fireEvent.change(screen.getByLabelText('Paid ad / whitelisting whitelisting, percent'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Appearance fee, Elite'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Why the change'), { target: { value: 'Up at Established' } });
    fireEvent.click(screen.getByTestId('rate-card-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/deal-rates', {
      based_on: 2,
      note: 'Up at Established',
      changes: {
        anchors: [{ component: 'pulse_video', career_tier: 3, amount: 260 }, { component: 'paid_appearance', career_tier: 5, amount: null }],
        premiums: [{ kind: 'paid_ad', key: 'whitelisting', percent: 30 }],
      },
    }));
    expect((await screen.findByRole('status')).textContent).toContain('Saved as version 3');
    expect((screen.getByLabelText('Pulse video, Established')).value).toBe('260');
    expect(screen.getByText(/Pulse video, Established: 225 → 260/)).toBeTruthy();
  });

  it('will not save a price that is not a whole number', async () => {
    render(<RateCardTab />);
    fireEvent.change(await screen.findByLabelText('Pulse video, Established'), { target: { value: '12.5' } });
    expect((screen.getByTestId('rate-card-save')).disabled).toBe(true);
    expect(screen.getByText(/whole number/)).toBeTruthy();
  });

  it('says only an admin can change it when the save is refused', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 403, data: { error: 'Forbidden' } } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RateCardTab />);
    fireEvent.change(await screen.findByLabelText('Pulse video, Established'), { target: { value: '260' } });
    fireEvent.click(screen.getByTestId('rate-card-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Only an admin can change the rate card.');
    spy.mockRestore();
  });
});
