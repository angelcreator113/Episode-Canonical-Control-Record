/**
 * Admin › The Pulse › Brands (Evoni, 2026-10-18): the houses, their
 * accounts, "Draft a post" as the brand or signed by the rep, the week for
 * every brand, and deals that only the account or a founder announces.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import PulseBrands, { postState } from './PulseBrands';

const velour = {
  id: 'b-1', slug: 'velour_atelier', name: 'Velour Atelier', principle: 'Nothing extraneous',
  account: { id: 9, handle: 'velouratelier' },
  reps: [{ key: 'vivienne_laurent', name: 'Vivienne Laurent', title: 'Creative Director', authority: 'High creative authority', announces_deals: false }],
  posts: [{ id: 'p-1', content_text: 'Ivory, cut close.', status: 'live' }],
  replies: [],
};
const view = (over = {}) => ({ data: { success: true, accounts_missing: 0, brands: [velour], ...over } });
const renderIt = () => render(<MemoryRouter><PulseBrands showId="s-1" /></MemoryRouter>);

describe('PulseBrands', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue(view());
  });

  test('missing accounts: one click gives the brands their Pulse accounts', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(view({ accounts_missing: 1, brands: [{ ...velour, account: null }] }));
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, created: [{ brand: 'Velour Atelier', handle: 'velouratelier' }], existing: [] } });
    renderIt();
    expect(await screen.findByText('No Pulse account yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Give the brands their Pulse accounts/ }));
    expect(await screen.findByText('Made 1 account: @velouratelier.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/brand-pulse/accounts');
  });

  test('Draft a post, signed by the rep', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, published: false, review: ['gate'] } });
    renderIt();
    const card = await screen.findByTestId('pb-brand-velour_atelier');
    expect(card.textContent).toContain('@velouratelier');
    expect(within(card).getByText('Ivory, cut close.')).toBeTruthy();
    fireEvent.change(within(card).getByLabelText('Who posts'), { target: { value: 'vivienne_laurent' } });
    fireEvent.change(within(card).getByLabelText('About (optional)'), { target: { value: 'the new coat' } });
    fireEvent.click(within(card).getByRole('button', { name: /Draft a post/ }));
    expect(await within(card).findByText('Drafted: it waits in Review.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/brand-pulse/brands/b-1/draft', { show_id: 's-1', rep: 'vivienne_laurent', about: 'the new coat' });
  });

  test('a post that passes the gate is scheduled, not posted at once', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, published: false, review: [], scheduled_at: '2026-10-20T15:00:00Z' } });
    renderIt();
    const card = await screen.findByTestId('pb-brand-velour_atelier');
    fireEvent.click(within(card).getByRole('button', { name: /Draft a post/ }));
    expect((await within(card).findByText(/^Scheduled: it passed the gate and goes out/)).textContent).not.toContain('Posted');
  });

  test('this week for every brand: what was scheduled and what waits', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, routed: [{ scheduled_at: '2026-10-20T15:00:00Z' }, { scheduled_at: null }], failed: [] } });
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: /Draft this week for every brand/ }));
    expect(await screen.findByText('Drafted 2 posts: 1 scheduled, 1 in Review.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/brand-pulse/draft-week', { show_id: 's-1' });
  });

  test('deals: a booked one can be announced; the others say why not', async () => {
    renderIt();
    const card = await screen.findByTestId('pb-brand-velour_atelier');
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, deals: [
      { id: 'd-1', name: 'Gala dress', status: 'booked', announce: { ok: true, reason: null } },
      { id: 'd-2', name: 'Spring film', status: 'negotiating', announce: { ok: false, reason: 'The deal is negotiating: only a booked deal is announced.' } },
    ] } });
    fireEvent.click(within(card).getByRole('button', { name: /Deals/ }));
    const deals = await screen.findByTestId('pb-deals-velour_atelier');
    expect(deals.textContent).toContain('only a booked deal is announced');
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, published: false, review: ['brand_deal'] } });
    fireEvent.click(within(deals).getByRole('button', { name: /Draft the announcement/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/brand-pulse/brands/b-1/deals/d-1/announce', { rep: null }));
    expect(await within(card).findByText('Announcement drafted: it waits in Review.')).toBeTruthy();
  });

  test('a post\'s state in words', () => {
    expect(postState({ status: 'live' })).toBe('Live');
    expect(postState({ status: 'draft', review: ['brand_deal'] })).toBe('Deal announcement: in Review');
    expect(postState({ status: 'draft', review: ['gate'] })).toBe('In Review');
    expect(postState({ status: 'draft', release_state: 'scheduled', release_at: '2026-10-20T15:00:00Z' })).toMatch(/^Scheduled for /);
  });

  test('tokens only, and text on a fill reads 4.5:1', () => {
    const css = readFileSync(resolve(__dirname, 'PulseBrands.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
    const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
    const t = (name) => readToken([tokens], name);
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, sel, b]) => ({ sel: sel.trim(), bg: b.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: b.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1] }))
      .filter((r) => r.bg && r.fg);
    expect(rules.length).toBeGreaterThan(3);
    for (const r of rules) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
  });
});
