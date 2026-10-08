/**
 * The Show Bible's front page in the hub (the mock, 2026-10-06). The canon
 * guard runs only when asked ("Check on request"), sends the show's
 * episodes and events as guard items, lists what disagrees, and never
 * shows a batch it could not check as a pass.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import ShowBibleSummary from './ShowBibleSummary';

const SHOW = { id: 'show-b', name: 'Styling Adventures' };
const ENTRIES = [
  { id: 1, status: 'active', always_inject: true, severity: 'critical', title: 'Prime Coins are the only currency.', category: 'franchise_law' },
  { id: 2, status: 'active', category: 'locked_decision', title: "Lala's social page is her own account", created_at: '2026-10-02T00:00:00Z', applies_to: ['feed', 'release'] },
];
const renderIt = (props = {}) => render(
  <MemoryRouter><ShowBibleSummary entries={ENTRIES} loading={false} show={SHOW} onAddRule={vi.fn()} onOpen={vi.fn()} {...props} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes')) return { data: { data: [{ id: 'ep1', episode_number: 1, title: 'Planning', description: 'No venue.' }], pagination: { total: 1 } } };
    if (url === '/api/v1/world/show-b/events') return { data: { events: [{ id: 'e1', name: 'Studio Session', venue_name: "STUDIO BY SABLE's Studio" }] } };
    return { data: {} };
  });
});

describe('ShowBibleSummary', () => {
  test('always true and decisions come from the entries; the guard does not run on load', () => {
    const onAddRule = vi.fn();
    renderIt({ onAddRule });
    expect(screen.getByTestId('always-true').textContent).toContain('Prime Coins are the only currency.');
    expect(screen.getByTestId('decisions-timeline').textContent).toContain("Lala's social page is her own account");
    expect(screen.getByTestId('decisions-timeline').textContent).toContain('Affects: Feed, Release');
    expect(screen.getByTestId('canon-guard').textContent).toContain('Nothing has been checked yet');
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a rule' }));
    expect(onAddRule).toHaveBeenCalled();
  });

  test('with no rules or decisions each card says so plainly', () => {
    renderIt({ entries: [] });
    expect(screen.getByTestId('always-true-empty').textContent).toContain('No rule is marked always-inject yet');
    expect(screen.getByTestId('decisions-empty').textContent).toContain('No locked decisions yet');
  });

  test('"Check now" sends the episodes and events as items and lists what disagrees, linked to it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'issues', rules_checked: 12, warnings: [{ item: 'episode:ep1', law: 'Venues', risk: 'Says "No venue", but the event is at STUDIO BY SABLE\'s Studio.', suggestion: '' }] } });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await screen.findByTestId('canon-guard-count');
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/franchise-brain/guard');
    expect(body.items.map((i) => i.key)).toEqual(['episode:ep1', 'event:e1']);
    expect(body.items[0]).not.toHaveProperty('to');
    expect(screen.getByTestId('canon-guard-count').textContent).toBe('1 to check');
    expect(screen.getByTestId('canon-guard-scope').textContent).toBe('Checked 2 items (1 episode, 1 event) against 12 rules.');
    expect(screen.getByText('Episode 1 · Planning')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open episode' }).getAttribute('href')).toBe('/episodes/ep1');
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));
    expect(screen.getByTestId('canon-guard-count').textContent).toBe('Nothing to check');
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
  });

  test('a batch the guard could not check is said, never shown as a pass', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('limit'), { response: { status: 429 } }));
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await waitFor(() => expect(screen.getByTestId('canon-guard-failed').textContent).toContain('2 items could not be checked. That is not a pass'));
    expect(screen.queryByText('Nothing disagrees with the Bible.')).toBeNull();
    spy.mockRestore();
  });

  // Wiring map fix-list item 25 (2026-10-08): the guard read every show's
  // rules, so a show was checked against another show's canon.
  test("the check sends the show, so its episodes are checked against the franchise's rules and this show's", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'passed', rules_checked: 9, warnings: [] } });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await screen.findByTestId('canon-guard-count');
    const [, body] = vi.mocked(api.post).mock.calls[0];
    expect(body.show_id).toBe('show-b');
    expect(body.items).toHaveLength(2);
  });

  test('a guard that answers check_failed is not a pass either', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'check_failed', warnings: [], rules_checked: 3 } });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await screen.findByTestId('canon-guard-failed');
    expect(screen.queryByText('Nothing disagrees with the Bible.')).toBeNull();
  });
});
