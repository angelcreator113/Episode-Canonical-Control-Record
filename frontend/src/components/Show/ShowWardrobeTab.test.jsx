/**
 * The show page's wardrobe links open Producer Mode → Assets → Wardrobe
 * (Evoni, 2026-10-01: "The show page's "Open wardrobe" button doesn't open
 * Producer Mode → Assets → Wardrobe."). ?tab=wardrobe names the Assets tab,
 * which opens on its first sub-tab, Scene Sets; the Wardrobe sub-tab is
 * ?tab=wardrobe-items.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import ShowWardrobeTab from './ShowWardrobeTab';
import ShowAssetsTab from './ShowAssetsTab';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>;
}

const renderOnShow = (ui) => render(
  <MemoryRouter initialEntries={['/shows/show-1']}>
    <Routes>
      <Route path="/shows/show-1" element={ui} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>
);

describe('the show page opens Producer Mode → Assets → Wardrobe', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  });

  test('"Open Full Wardrobe" on the Wardrobe tab', async () => {
    renderOnShow(<ShowWardrobeTab show={{ id: 'show-1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open Full Wardrobe/ }));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/world?tab=wardrobe-items');
  });

  test('the Wardrobe card on the Assets tab', async () => {
    renderOnShow(<ShowAssetsTab show={{ id: 'show-1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Wardrobe Library/ }));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/world?tab=wardrobe-items');
  });

  test('no link that means the wardrobe sends ?tab=wardrobe (it opens Scene Sets)', () => {
    const sources = import.meta.glob(['../../**/*.jsx', '!../../**/*.test.jsx'], { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(sources)
      .filter(([, src]) => /world\?tab=wardrobe(?![-\w])/.test(src))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
