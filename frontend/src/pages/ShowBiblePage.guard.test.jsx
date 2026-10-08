/**
 * The Show Bible's Guard tab speaks the guard route's contract (2026-10-04):
 * it sends scene_brief and characters_in_scene (it sent scene_text, which
 * the route refused with 400), and renders the route's one result format in
 * its three states: passed, issues found (law, risk, suggestion), and check
 * failed, which is never shown as a pass. A refused request is a failed
 * check too, with the route's own reason.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ShowBiblePage from './ShowBiblePage';

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><ShowBiblePage embedded /></MemoryRouter>);
const check = async (text, characters) => {
  renderAt('/universe?tab=bible&sub=guard');
  await screen.findByRole('button', { name: /Check Scene/ });
  if (characters) fireEvent.change(screen.getByLabelText('Characters in scene'), { target: { value: characters } });
  fireEvent.change(screen.getByLabelText('Scene brief'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Check Scene/ }));
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('Show Bible: the Guard contract', () => {
  test('sends scene_brief and characters_in_scene; a pass renders as a pass', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'passed', passed: true, warnings: [], rules_checked: 12, message: 'No franchise risk found against 12 rules' } });
    await check('Lala arrives at the gala alone.', 'Lala, Kelli');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/guard', { scene_brief: 'Lala arrives at the gala alone.', characters_in_scene: ['Lala', 'Kelli'] }));
    const box = await screen.findByTestId('guard-result-passed');
    expect(box.textContent).toContain('Passed: No franchise risk found against 12 rules');
    expect(box.textContent).toContain('Checked against 12 rules');
  });

  test('issues render each law, risk and suggestion', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'issues', passed: false, rules_checked: 12, message: '1 risk found against 12 rules', warnings: [{ law: 'Lala never apologises in public', risk: 'The brief has her apologising on stage', suggestion: 'Make it a private apology' }] } });
    await check('Lala apologises on stage.');
    const box = await screen.findByTestId('guard-result-issues');
    expect(box.textContent).toContain('1 risk found');
    expect(box.textContent).toContain('Lala never apologises in public');
    expect(box.textContent).toContain('The brief has her apologising on stage');
    expect(box.textContent).toContain('Make it a private apology');
    expect(screen.queryByTestId('guard-result-passed')).toBeNull();
  });

  test('a failed check is never a pass', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'check_failed', passed: false, warnings: [], rules_checked: 12, message: 'The guard could not read its own verdict. Check again.' } });
    await check('x');
    const box = await screen.findByTestId('guard-result-check_failed');
    expect(box.textContent).toContain('Check failed: The guard could not read its own verdict');
    expect(box.textContent).toContain('Nothing was checked. This is not a pass.');
    expect(screen.queryByTestId('guard-result-passed')).toBeNull();
  });

  test("a refused request is a failed check with the route's reason", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { error: 'scene_brief is required' } } });
    await check('x');
    const box = await screen.findByTestId('guard-result-check_failed');
    expect(box.textContent).toContain('scene_brief is required');
  });

  test('an older result without status is read by its warnings and passed fields', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { passed: true, warnings: [] } });
    await check('x');
    expect(await screen.findByTestId('guard-result-passed')).toBeTruthy();
  });

  // Wiring map fix-list item 25 (2026-10-08): the route read every show's
  // rules; with the active show's id it reads the franchise's and that show's.
  test("with an active show it sends show_id, so the brief is checked against that show's rules, not another's", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/shows'
      ? { data: { data: [{ id: 'show-uuid-a', name: 'Styling Adventures' }] } }
      : { data: { data: [] } }));
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'passed', passed: true, warnings: [], rules_checked: 9, message: 'No franchise risk found against 9 rules' } });
    renderAt('/universe?tab=bible&sub=guard');
    await screen.findByText('This show');
    fireEvent.change(screen.getByLabelText('Scene brief'), { target: { value: 'Lala arrives at the gala alone.' } });
    fireEvent.click(screen.getByRole('button', { name: /Check Scene/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/guard', { scene_brief: 'Lala arrives at the gala alone.', characters_in_scene: [], show_id: 'show-uuid-a' }));
  });
});
