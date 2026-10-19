/**
 * The Script tab in the studio look (Evoni's mockup, 2026-10-19): each beat
 * row's status badge (APPROVED, NEEDS REVISION, DRAFT), the open beat's
 * checklist count, its Scene Context fields, Assets & Links, and the
 * previous / next beat arrows.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

// Beat 2 talks before Lala's voice icon is clicked (a Ready-to-film row of
// beat 2); beat 1 is approved; beat 3 has nothing to fix.
const SCRIPT = [
  '## BEAT: 1 · Opening Ritual', '(Morning light.)', 'Lala (V.O.): "A blank day."',
  '## BEAT: 2 · Login Sequence', 'Lala: "Logging in."',
  '## BEAT: 3 · Welcome', '(She spins.)',
].join('\n');
const PLAN = [
  { beat_number: 1, sceneSet: { name: "Lala's home", scene_type: 'HOME_BASE', base_still_url: 'https://x/base.png' }, angle_label: 'Window', shot_type: 'establishing', emotional_intent: 'Reflective, excited', scene_context: 'Opens the episode.', director_note: 'Show her space.', location: { image: { url: 'https://x/home.png', label: "Lala's home · Window" } } },
];

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [1] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
    return { data: { data: [] } };
  });
});

describe('Script tab, studio look', () => {
  test('each beat row carries its status badge', async () => {
    renderTab();
    await screen.findByTestId('script-beatlist');
    const status = (n) => screen.getByTestId(`script-nav-status-${n}`).textContent;
    expect(status(1)).toBe('APPROVED');
    await waitFor(() => expect(status(2)).toBe('NEEDS REVISION'));
    expect(status(3)).toBe('DRAFT');
    expect(screen.getByTestId('script-row-2').dataset.status).toBe('revision');
    expect(screen.getByTestId('script-nav-2').getAttribute('aria-label')).toBe('Beat 2: Login Sequence, needs revision');
    expect(screen.getByTestId('script-beatlist-sum').textContent).toMatch(/^3 beats · ~\d+s$/);
    // The open beat shows its own badge.
    expect(screen.getByTestId('script-beat-status-1').textContent).toBe('APPROVED');
  });

  test("the open beat's Scene Context shows only the plan's fields, and its tags", async () => {
    renderTab();
    const ctx = await screen.findByTestId('script-context-1');
    await waitFor(() => expect(within(ctx).getByTestId('script-context-location').textContent).toBe("LocationLala's home · Window"));
    expect([...ctx.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Location', 'Setting', 'Mood', 'Shot', 'Context', 'Notes']);
    expect(within(ctx).getByTestId('script-context-setting').textContent).toBe('SettingHome Base');
    expect(within(ctx).getByTestId('script-context-mood').textContent).toBe('MoodReflective, excited');
    expect(screen.getByTestId('script-tag-mood').textContent.trim()).toBe('Reflective, excited');
    // A beat with no plan says so, with no made-up fields.
    fireEvent.click(screen.getByTestId('script-nav-3'));
    expect(screen.getByTestId('script-context-3').querySelector('dl')).toBeNull();
    expect(screen.getByTestId('script-context-3').textContent).toContain('No scene planned for this beat yet');
  });

  test('the Beat Checklist counts what is done, with this beat\'s Ready-to-film rows', async () => {
    renderTab();
    await screen.findByTestId('script-checklist-1');
    await waitFor(() => expect(screen.getByTestId('script-checklist-count-1').textContent).toMatch(/^\d+ \/ \d+$/));
    const items = () => within(screen.getByTestId('script-checklist-1')).getAllByTestId('script-checklist-item');
    const [done, total] = screen.getByTestId('script-checklist-count-1').textContent.split(' / ').map(Number);
    expect(total).toBe(items().length);
    expect(done).toBe(items().filter((i) => i.dataset.ok === 'true').length);
    expect(items().find((i) => i.textContent.startsWith('Approved and locked')).dataset.ok).toBe('true');
    expect(items().find((i) => i.textContent.startsWith('Has a scene picture')).dataset.ok).toBe('true');
    fireEvent.click(screen.getByTestId('script-nav-2'));
    await waitFor(() => expect(within(screen.getByTestId('script-checklist-2')).getAllByTestId('script-checklist-item').some((i) => i.dataset.ok === 'false' && /voice icon/.test(i.textContent))).toBe(true));
    const two = within(screen.getByTestId('script-checklist-2')).getAllByTestId('script-checklist-item');
    expect(two.find((i) => i.textContent.startsWith('Has a scene picture')).dataset.ok).toBe('false');
    expect(two.find((i) => i.textContent.startsWith('Approved and locked')).dataset.ok).toBe('false');
  });

  test('Assets & Links lists the location; the arrows step through the beats', async () => {
    renderTab();
    const assets = await screen.findByTestId('script-assets-1');
    await waitFor(() => expect(within(assets).getAllByTestId('script-asset').map((a) => a.textContent)).toEqual(["Lala's home (Location)"]));
    expect(screen.getByTestId('script-beat-prev').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('script-beat-next'));
    expect(screen.getByTestId('script-beat-2').className).toContain('is-open');
    expect(screen.getByTestId('script-nav-2').getAttribute('aria-current')).toBe('true');
  });

  test('line cards: number, kind, and the speaker note kept apart from the speaker', async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const rows = beat.querySelectorAll('.esp-line-row');
    expect([...rows].map((r) => r.querySelector('.esp-line-n').textContent)).toEqual(['1', '2']);
    expect(rows[0].querySelector('.esp-line-kind').textContent).toBe('Visual');
    expect(rows[1].querySelector('.esp-line-speaker').textContent).toBe('Lala');
    expect(rows[1].querySelector('.esp-line-note').textContent).toBe('(V.O.)');
    expect(rows[0].querySelector('.esp-line-dur').textContent).toBe('3s');
  });

  test('two pictures of the scene: the big one and the thumbnails; a thumbnail shows its picture', async () => {
    renderTab();
    const thumbs = await screen.findByTestId('script-thumbs-1');
    const buttons = within(thumbs).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(screen.getByTestId('script-picture-1').querySelector('img').getAttribute('src')).toBe('https://x/base.png');
  });
});
