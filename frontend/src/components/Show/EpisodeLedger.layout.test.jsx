/**
 * The Episode Ledger (the Season page's Results tab; Producer Mode's
 * Episodes → Results until 2026-10-25), laid out to Evoni's list of
 * 2026-10-22 ("how can we improve the results tab in production layout"):
 * one summary strip for the tiers and the season's money, filter and sort
 * chips, rows whose header is a button, and an opened episode with its
 * actions first and the Evaluation heading only when it has scores.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeLedger from './EpisodeLedger';

const EPISODES = [
  { id: 'ep-1', episode_number: 1, title: 'Studio by Sable', status: 'published', evaluation_status: 'accepted', evaluation_json: { tier_final: 'slay', score: 92, outfit_match: 22 } },
  { id: 'ep-2', episode_number: 2, title: 'Rooftop Brunch', status: 'published', evaluation_status: 'accepted', evaluation_json: { tier_final: 'pass', score: 78 } },
  { id: 'ep-3', episode_number: 3, title: 'Gala Night', status: 'draft', evaluation_status: null, evaluation_json: null },
];

function renderLedger() {
  return render(
    <MemoryRouter>
      <EpisodeLedger showId="show-1" api={api} episodes={EPISODES} events={[]} />
    </MemoryRouter>
  );
}

const rowTitles = () => [...document.querySelectorAll('.wa-ledger-title')].map((t) => t.textContent);

describe('Episodes › Results layout', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
      if (url === '/api/v1/shows/show-1/financial-summary') {
        return { data: { by_episode: [{ episode_id: 'ep-1', income: 900, expenses: 400 }, { episode_id: 'ep-2', income: 100, expenses: 300 }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('the tiers and the season money are one strip, not two rows of boxes', async () => {
    renderLedger();
    const strip = await screen.findByTestId('ledger-summary');
    expect([...within(strip).getByRole('list', { name: 'Tiers' }).querySelectorAll('li')].map((li) => li.textContent))
      .toEqual(['👑 1 Slay', '✨ 1 Pass', '😐 0 Safe', '💔 0 Fail']);
    expect(within(strip).getByText('Net P&L').parentElement.textContent).toBe('Net P&L+300');
    expect(screen.queryByText('🏆 Tier Distribution')).toBeNull();
  });

  test('filter and sort the episodes', async () => {
    renderLedger();
    await screen.findByText('Gala Night');
    expect(rowTitles()).toEqual(['Studio by Sable', 'Rooftop Brunch', 'Gala Night']);
    const show = screen.getByRole('group', { name: 'Show' });
    expect(within(show).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 3', 'Evaluated 2', 'Not evaluated 1']);
    fireEvent.click(within(show).getByRole('button', { name: /Not evaluated/ }));
    expect(rowTitles()).toEqual(['Gala Night']);
    fireEvent.click(within(show).getByRole('button', { name: /^Evaluated/ }));
    expect(rowTitles()).toEqual(['Studio by Sable', 'Rooftop Brunch']);
    fireEvent.click(within(show).getByRole('button', { name: /^All/ }));
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'score' } });
    expect(rowTitles()).toEqual(['Studio by Sable', 'Rooftop Brunch', 'Gala Night']);
  });

  test('a row header is a button that says whether it is open; the opened episode has its actions first', async () => {
    renderLedger();
    const head = (await screen.findByText('Studio by Sable')).closest('button');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    const row = screen.getByTestId('ledger-row-ep-1');
    const actions = row.querySelector('.wa-ledger-actions');
    expect(within(actions).getAllByRole('link').map((a) => a.textContent)).toEqual(['Open episode', 'Re-evaluate', 'Todo List']);
    expect(within(actions).getByRole('link', { name: 'Open episode' }).getAttribute('href')).toBe('/episodes/ep-1');
    // Its first part: nothing above the actions but the header.
    expect(row.querySelector('.wa-ledger-case').firstElementChild).toBe(actions);
    // It has a score to show, so the Evaluation heading shows.
    expect(within(row).getByText('🏆 Evaluation')).toBeTruthy();
  });

  test('the Evaluation heading is gone when there is nothing to show; an unevaluated episode says Evaluate', async () => {
    renderLedger();
    fireEvent.click(await screen.findByText('Rooftop Brunch'));
    expect(within(screen.getByTestId('ledger-row-ep-2')).queryByText('🏆 Evaluation')).toBeNull();
    fireEvent.click(screen.getByText('Gala Night'));
    expect(within(screen.getByTestId('ledger-row-ep-3')).getByRole('link', { name: 'Evaluate' })).toBeTruthy();
  });
});
