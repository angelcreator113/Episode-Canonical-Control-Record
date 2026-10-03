/**
 * Brain Update (Brain Update step 1; docs/BRAIN_OWNERSHIP.md): the button
 * says where the page stands; the drawer shows new, changed (before and
 * after), retiring and unchanged; Update Brain applies what was reviewed.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import { MemoryRouter } from 'react-router-dom';
import BrainUpdate, { BrainUpdateElsewhere } from './BrainUpdate';

const card = (key, title, content) => ({ source_key: key, title, content, category: 'world', severity: 'important', domain: 'Social Archetype' });
const PREVIEW = {
  source: 'social_systems', label: 'Social Systems', domains: ['Social Archetype', 'Influence Force'],
  state: 'updates', pending: 3, legacy: 8, skipped: [], last_synced: '2026-10-03T10:00:00Z', fingerprint: 'fp-1',
  new: [card('social_systems:archetype:the-rebel', 'The Rebel — Social Archetype', 'The Rebel (Social Archetype)\nContent: Anti-trend')],
  changed: [{
    ...card('social_systems:archetype:the-connector', 'The Connector — Social Archetype', 'Audience effect: Creates network clusters and hosts gatherings'),
    entry_id: 7, before: { title: 'The Connector — Social Archetype', content: 'Audience effect: Creates network clusters' },
  }],
  retired: [{ source_key: 'social_systems:influence-force:reach', title: 'Reach — Influence Force', entry_id: 9, content: 'Reach' }],
  unchanged: [{ source_key: 'social_systems:archetype:the-drama-magnet', title: 'The Drama Magnet — Social Archetype', entry_id: 8 }],
};
const UP_TO_DATE = { ...PREVIEW, state: 'up_to_date', pending: 0, new: [], changed: [], retired: [], fingerprint: 'fp-2' };
const DATA = { ARCHETYPES: [{ name: 'The Connector' }] };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
});

describe('BrainUpdate', () => {
  test('waits for the page content before previewing', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: PREVIEW } });
    const { rerender } = render(<BrainUpdate source="social_systems" data={DATA} ready={false} />);
    expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Checking Brain…');
    await new Promise((r) => setTimeout(r, 500));
    expect(api.post).not.toHaveBeenCalled();
    rerender(<BrainUpdate source="social_systems" data={DATA} ready />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 3 Brain Updates'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/social_systems/preview', { page_data: DATA });
  });

  test('the button names the state: connect, up to date', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...UP_TO_DATE, state: 'not_connected', pending: 1 } } });
    const { unmount } = render(<BrainUpdate source="social_systems" data={DATA} />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Connect to Brain'));
    unmount();
    vi.mocked(api.post).mockResolvedValue({ data: { data: UP_TO_DATE } });
    render(<BrainUpdate source="social_systems" data={DATA} />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Brain Up to Date ✓'));
    fireEvent.click(screen.getByTestId('brain-update-button'));
    expect(screen.getByTestId('brain-update-summary').textContent).toBe('Brain already matches this page. No update required.');
    expect(screen.getByTestId('brain-update-apply').disabled).toBe(true);
  });

  test('the drawer shows new, changed before and after, retiring, unchanged and the legacy note', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: PREVIEW } });
    render(<BrainUpdate source="social_systems" data={DATA} />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').dataset.state).toBe('updates'));
    fireEvent.click(screen.getByTestId('brain-update-button'));
    const drawer = screen.getByTestId('brain-update-drawer');
    expect(within(drawer).getByText('Social Systems → Brain Update')).toBeTruthy();
    expect(screen.getByTestId('brain-update-summary').textContent).toBe('1 new · 1 changed · 1 retiring · 1 unchanged');
    const changed = screen.getByTestId('brain-changed-social_systems:archetype:the-connector');
    fireEvent.click(within(changed).getByRole('button'));
    expect(changed.textContent).toContain('Current Brain');
    expect(changed.textContent).toContain('Audience effect: Creates network clusters');
    expect(changed.textContent).toContain('Page now says');
    expect(changed.textContent).toContain('hosts gatherings');
    expect(screen.getByTestId('brain-update-retired').textContent).toContain('Reach — Influence Force');
    fireEvent.click(screen.getByTestId('brain-update-unchanged-toggle'));
    expect(screen.getByTestId('brain-update-unchanged').textContent).toBe('The Drama Magnet — Social Archetype');
    expect(screen.getByTestId('brain-update-legacy').textContent).toMatch(/^8 older Brain entries from this source/);
  });

  test('Update Brain applies with the fingerprint and shows the result', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/apply')
      ? { data: { data: { applied: { new: 1, changed: 1, retired: 1 }, preview: UP_TO_DATE } } }
      : { data: { data: PREVIEW } }));
    render(<BrainUpdate source="social_systems" data={DATA} />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').dataset.state).toBe('updates'));
    fireEvent.click(screen.getByTestId('brain-update-button'));
    fireEvent.click(screen.getByTestId('brain-update-apply'));
    expect((await screen.findByTestId('brain-update-message')).textContent).toBe('Brain updated: 1 new, 1 changed, 1 retired.');
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/social_systems/apply', { page_data: DATA, fingerprint: 'fp-1' });
    expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Brain Up to Date ✓');
  });

  test('a stale review says why and previews again', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/apply')) throw { response: { status: 409, data: { error: 'The page or the Brain changed since this review. Review the update again.' } } };
      return { data: { data: PREVIEW } };
    });
    render(<BrainUpdate source="social_systems" data={DATA} />);
    await waitFor(() => expect(screen.getByTestId('brain-update-button').dataset.state).toBe('updates'));
    fireEvent.click(screen.getByTestId('brain-update-button'));
    fireEvent.click(screen.getByTestId('brain-update-apply'));
    expect((await screen.findByTestId('brain-update-message')).textContent).toMatch(/changed since this review/);
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith('/preview'))).toHaveLength(2));
    spy.mockRestore();
  });

  test('a page with two sources names each button', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: UP_TO_DATE } });
    render(<><BrainUpdate source="cultural_calendar" name="Calendar" data={DATA} /><BrainUpdate source="cultural_memory" name="Memory" data={DATA} /></>);
    await waitFor(() => expect(screen.getByTestId('brain-update-button-calendar').textContent).toBe('🧠 Calendar: Brain Up to Date ✓'));
    expect(screen.getByTestId('brain-update-button-memory').textContent).toBe('🧠 Memory: Brain Up to Date ✓');
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/cultural_memory/preview', { page_data: DATA });
  });

  test('an older editor links to the page its data syncs from, and never calls the Brain', () => {
    render(<MemoryRouter><BrainUpdateElsewhere to="/culture-events" label="Culture & Events" /></MemoryRouter>);
    const link = screen.getByTestId('brain-update-elsewhere');
    expect(link.textContent).toBe('🧠 Brain updates on Culture & Events →');
    expect(link.getAttribute('href')).toBe('/culture-events');
    expect(api.post).not.toHaveBeenCalled();
  });
});
