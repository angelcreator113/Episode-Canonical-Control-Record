/**
 * The Studio's suggestions are a paid call the server answers for an admin
 * only (P2a; Evoni, 2026-11-22: "Do not initiate the automatic
 * suggest-objects paid request for non-admin users").
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ suggestObjects: vi.fn() }));
vi.mock('../../../services/sceneService', () => ({ default: svc }));

import SmartSuggestions from './SmartSuggestions';

const props = { sceneId: 'scene-1', objectCount: 0, hasBackground: true, contextType: 'scene', onSuggestionClick: () => {} };

beforeEach(() => {
  svc.suggestObjects.mockReset();
  svc.suggestObjects.mockResolvedValue({ success: true, data: { suggestions: [{ label: 'A lamp', prompt: 'a brass lamp' }] } });
});

describe('SmartSuggestions', () => {
  it('someone who cannot edit: no request is made and nothing is shown', async () => {
    const { container, rerender } = render(<SmartSuggestions {...props} canEdit={false} />);
    rerender(<SmartSuggestions {...props} objectCount={1} canEdit={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });

  it('with canEdit left out: no request either (closed by default)', async () => {
    render(<SmartSuggestions {...props} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
  });

  it('an admin: the suggestions are asked for once and shown, as before', async () => {
    render(<SmartSuggestions {...props} canEdit />);
    await waitFor(() => expect(svc.suggestObjects).toHaveBeenCalledWith('scene-1'));
    expect(await screen.findByText('A lamp')).toBeTruthy();
    expect(svc.suggestObjects).toHaveBeenCalledTimes(1);
  });

  it('an admin on a scene set: none, as before', async () => {
    render(<SmartSuggestions {...props} contextType="sceneSet" canEdit />);
    await new Promise((r) => setTimeout(r, 20));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
  });
});
