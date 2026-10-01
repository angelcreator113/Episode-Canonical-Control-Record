/**
 * The Scene Brief before a paid generation (S2, Evoni 2026-09-30), and the
 * scene-set page opening it before "AI Generate".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneBriefConfirm, { estimateText, SOURCE_LABELS } from './SceneBriefConfirm';

const line = (key, over = {}) => ({ layer: 'place', key, label: key[0].toUpperCase() + key.slice(1), text: `${key} text.`, source: 'venue', essential: false, ...over });
const BRIEF = (over = {}) => ({
  version: 1, scene_set_id: 'set-1', world_location_id: 'loc-1', event_id: null, angle: 'WIDE',
  lines: [
    line('identity', { label: 'Place', essential: true }),
    line('description', { label: 'Description', essential: true }),
    line('architecture'),
    line('camera', { layer: 'shot', label: 'Camera', essential: true }),
    line('time', { layer: 'environment', label: 'Time of day', essential: true }),
  ],
  rules: ['An empty space with no people.'],
  missing: [],
  overrides: {},
  ...over,
});
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const ESTIMATE = { usd: 0.03, priced: true, model: 'fal-ai/flux/dev', base_model: 'flux-dev' };

describe('SceneBriefConfirm (S2)', () => {
  beforeEach(() => { vi.mocked(apiClient.post).mockReset(); });

  test('shows each line with its source label, the rules and the cost; no event layer without an event', async () => {
    vi.mocked(apiClient.post).mockReturnValue(ok({ target: { kind: 'base' }, brief: BRIEF(), prompt: 'p', estimate: ESTIMATE }));
    render(<SceneBriefConfirm setId="set-1" title="Generate the base image" onConfirm={() => {}} onCancel={() => {}} />);
    expect(await screen.findByTestId('sbc-line-architecture')).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/brief', {});
    expect(screen.getByTestId('sbc-source-architecture').textContent).toBe('From venue');
    expect(screen.getByTestId('sbc-no-event')).toBeTruthy();
    expect(screen.getByText('An empty space with no people.')).toBeTruthy();
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.03');
    expect(screen.queryByTestId('sbc-missing')).toBeNull();
  });

  test('missing essentials are flagged at the top and on their line; generating stays possible', async () => {
    vi.mocked(apiClient.post).mockReturnValue(ok({
      target: { kind: 'base' },
      brief: BRIEF({
        lines: [line('identity', { essential: true }), line('time', { layer: 'environment', label: 'Time of day', text: '', essential: true })],
        missing: [{ layer: 'place', key: 'world_location', label: 'World Location' }, { layer: 'environment', key: 'time', label: 'Time of day' }],
      }),
      estimate: null,
    }));
    render(<SceneBriefConfirm setId="set-1" title="t" onConfirm={() => {}} onCancel={() => {}} />);
    expect((await screen.findByTestId('sbc-missing')).textContent).toMatch(/Missing essentials: World Location, Time of day/);
    expect(within(screen.getByTestId('sbc-line-time')).getByText('Missing')).toBeTruthy();
    expect(screen.getByTestId('sbc-confirm').disabled).toBe(false);
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate');
  });

  test('editing a line makes it "Your override"; removing and resetting re-ask the brief; confirm hands over the overrides', async () => {
    vi.mocked(apiClient.post).mockImplementation((_url, body) => {
      const ov = body.overrides || {};
      const lines = BRIEF().lines
        .filter((l) => !(l.key in ov && ov[l.key] === '' && !l.essential))
        .map((l) => (l.key in ov ? { ...l, text: ov[l.key], source: 'override' } : l));
      return ok({ target: { kind: 'angle' }, brief: BRIEF({ lines, overrides: ov }), estimate: null });
    });
    const onConfirm = vi.fn();
    render(<SceneBriefConfirm setId="set-1" angleId="a-1" title="t" onConfirm={onConfirm} onCancel={() => {}} />);
    await screen.findByTestId('sbc-line-architecture');
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/v1/scene-sets/set-1/brief', { angle_id: 'a-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Architecture' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Architecture text' }), { target: { value: 'A brick warehouse.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    await waitFor(() => expect(screen.getByTestId('sbc-source-architecture').textContent).toBe(SOURCE_LABELS.override));
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/v1/scene-sets/set-1/brief', { angle_id: 'a-1', overrides: { architecture: 'A brick warehouse.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Architecture' }));
    await waitFor(() => expect(screen.getByTestId('sbc-source-architecture').textContent).toBe('From venue'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Architecture' }));
    expect(await screen.findByTestId('sbc-removed-architecture')).toBeTruthy();
    // An essential line can be edited, never removed.
    expect(screen.queryByRole('button', { name: 'Remove Place' })).toBeNull();

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    expect(onConfirm).toHaveBeenCalledWith({ architecture: '' });
  });

  test('the refine brief and an unsaved description are asked for', async () => {
    vi.mocked(apiClient.post).mockReturnValue(ok({ target: { kind: 'angle' }, brief: BRIEF(), estimate: null }));
    render(<SceneBriefConfirm setId="set-1" angleId="a-1" refine description="A moonlit terrace." title="t" onConfirm={() => {}} onCancel={() => {}} />);
    await screen.findByTestId('sbc-line-architecture');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/brief', { angle_id: 'a-1', refine: true, canonical_description: 'A moonlit terrace.' });
  });

  test('estimateText', () => {
    expect(estimateText(null)).toBeNull();
    expect(estimateText({ usd: null, priced: false })).toBe('price not set');
    expect(estimateText({ usd: 0.034 })).toBe('est. $0.03');
  });
});

describe('SceneSetsTab opens the brief before "AI Generate" (S2)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  test('AI Generate shows the brief; nothing is generated until confirmed, then the overrides are sent', async () => {
    const SceneSetsTab = (await import('../pages/SceneSetsTab')).default;
    const SET = { id: 'set-1', name: 'The Glasshouse', scene_type: 'OTHER', angles: [], generation_status: 'pending', base_still_url: null };
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url.includes('/scene-sets/set-1')) return ok(SET);
      if (url.includes('/scene-sets')) return ok([SET]);
      return ok([]);
    });
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url.endsWith('/brief')) return ok({ target: { kind: 'base' }, brief: BRIEF(), estimate: ESTIMATE });
      if (url.endsWith('/generate-base')) return ok({ status: 'generating' });
      return ok({});
    });
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /AI Generate/ }));
    expect(await screen.findByTestId('scene-brief-confirm')).toBeTruthy();
    await screen.findByTestId('sbc-line-architecture');
    expect(apiClient.post.mock.calls.some(([u]) => u.endsWith('/generate-base'))).toBe(false);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(apiClient.post.mock.calls.some(([u]) => u.endsWith('/generate-base'))).toBe(true));
    const [, body] = apiClient.post.mock.calls.find(([u]) => u.endsWith('/generate-base'));
    expect(body).toEqual({ overrides: {} });
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
  });
});
