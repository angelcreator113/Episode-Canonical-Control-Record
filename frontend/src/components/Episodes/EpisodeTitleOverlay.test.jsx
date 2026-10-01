/**
 * The title overlay panel (ruling P11 as amended, Evoni 2026-09-30):
 * lettering styles at no image cost, the band, the AI flourish with its
 * estimate, and the framed card as the full-screen option.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTitleCard from './EpisodeTitleCard';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' };
const ESTIMATE = { usd: 0.04, priced: true };
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const approvedState = (over = {}) => ({
  title: 'Gala Night', approved: true, approved_value: 'Gala Night', card: null,
  offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
  overlay: null,
  overlay_offer: { offered: true, variants: [{ key: 'classic', label: 'Classic serif' }], flourish_estimate: ESTIMATE },
  ...over,
});
const VARIANTS = {
  variants: [
    { key: 'classic', label: 'Classic serif', preview: 'data:image/png;base64,AAA' },
    { key: 'italic', label: 'Editorial italic', preview: 'data:image/png;base64,BBB' },
    { key: 'engraved', label: 'Engraved capitals', preview: 'data:image/png;base64,CCC' },
  ],
  band: { min: 0.2, max: 0.4, default: 0.3 },
};
const OVERLAY = { asset_id: 'o1', designed_for: 'Gala Night', outdated: false, image_url: 'data:image/png;base64,OVR', style: { variant: 'italic', band: { enabled: true, opacity: 0.3 }, flourish: null } };

describe('EpisodeTitleCard: the title overlay', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  test('approved: the overlay is offered at no image cost; the framed card is the full-screen option', async () => {
    vi.mocked(api.get).mockReturnValue(ok(approvedState()));
    render(<EpisodeTitleCard episode={EPISODE} />);
    expect(await screen.findByTestId('etc-overlay-styles')).toBeTruthy();
    expect(screen.getByTestId('etc-overlay-styles').textContent).toMatch(/no image cost/);
    expect(screen.getByRole('button', { name: 'Full-screen framed card — est. $0.04' })).toBeTruthy();
  });

  test('choose a lettering style, switch the band on at 25%, save', async () => {
    vi.mocked(api.get).mockImplementation((url) => (url.endsWith('/variants') ? ok(VARIANTS) : ok(approvedState())));
    vi.mocked(api.post).mockReturnValue(ok(OVERLAY));
    render(<EpisodeTitleCard episode={EPISODE} />);
    fireEvent.click(await screen.findByTestId('etc-overlay-styles'));
    expect(await screen.findByAltText('Editorial italic lettering')).toBeTruthy();
    fireEvent.click(screen.getByTestId('etc-variant-italic'));
    expect(screen.getByTestId('etc-variant-italic').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('etc-band-toggle'));
    fireEvent.change(screen.getByTestId('etc-band-opacity'), { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('etc-overlay-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-overlay', {
      variant: 'italic', band: { enabled: true, opacity: 0.25 },
    }));
    expect(await screen.findByTestId('etc-overlay-thumb')).toBeTruthy();
  });

  test('the flourish is offered with its cost; once added it can be removed', async () => {
    vi.mocked(api.get).mockReturnValue(ok(approvedState({ overlay: OVERLAY })));
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/flourish')
      ? ok({ ...OVERLAY, style: { ...OVERLAY.style, flourish: { asset_id: 'f1', url: 'u' } } })
      : ok(OVERLAY)));
    render(<EpisodeTitleCard episode={EPISODE} />);
    const add = await screen.findByTestId('etc-flourish-add');
    expect(add.textContent).toBe('Add AI flourish behind the letters — est. $0.04');
    fireEvent.click(add);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-overlay/flourish'));
    fireEvent.click(await screen.findByTestId('etc-flourish-remove'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-overlay', expect.objectContaining({ flourish: false })));
  });

  test('a changed title marks the overlay outdated until the title is approved again', async () => {
    vi.mocked(api.get).mockReturnValue(ok(approvedState({
      approved: false, overlay_offer: { offered: false }, overlay: { ...OVERLAY, outdated: true },
      offer: { offered: false },
    })));
    render(<EpisodeTitleCard episode={{ ...EPISODE, title: 'Gala Night Two' }} />);
    expect((await screen.findByTestId('etc-overlay-outdated')).textContent).toMatch(/overlay outdated/);
    expect(screen.queryByTestId('etc-overlay-styles')).toBeNull();
  });
});
