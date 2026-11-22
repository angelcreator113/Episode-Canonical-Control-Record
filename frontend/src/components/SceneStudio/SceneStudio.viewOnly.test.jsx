/**
 * Scene Studio for someone who is not an admin (P2a; Evoni, 2026-11-22):
 * the page opens and shows the scene, says "View-only — Admin editing
 * required", disables Save and the editing panels, and sends no write and no
 * paid request (the automatic suggest-objects call among them). For an admin
 * it is as before. Display only: the server refuses these writes with 403
 * whatever the page does.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('./Canvas/StudioCanvas', () => ({ default: React.forwardRef(() => <div data-testid="canvas" />) }));
vi.mock('./Canvas/MaskLayer', () => ({ default: () => null }));
vi.mock('./EraseBrushCanvas', () => ({ default: React.forwardRef(() => null) }));
vi.mock('./panels/CreationPanel', () => ({
  default: ({ onAddObject }) => (
    <button type="button" data-testid="add-object" onClick={() => onAddObject({ id: 'obj-new', type: 'image', x: 0, y: 0, width: 10, height: 10 })}>
      add
    </button>
  ),
}));
vi.mock('./panels/InspectorPanel', () => ({
  default: ({ onRegenerateVariation }) => (
    <button type="button" data-testid="restyle" onClick={() => onRegenerateVariation && onRegenerateVariation()}>restyle</button>
  ),
}));

const svc = vi.hoisted(() => ({
  getCanvas: vi.fn(),
  getSceneSetCanvas: vi.fn(),
  saveCanvas: vi.fn(),
  saveSceneSetCanvas: vi.fn(),
  suggestObjects: vi.fn(),
  regenerateBackground: vi.fn(),
  regenerateSceneSetBackground: vi.fn(),
  updateScene: vi.fn(),
  updateSceneSet: vi.fn(),
}));
vi.mock('../../services/sceneService', () => ({ default: svc }));
vi.mock('../../services/assetService', () => ({ default: { getConfigCheck: vi.fn().mockResolvedValue({ data: { data: {} } }) } }));

import SceneStudio from './SceneStudio';
import AuthContext from '../../contexts/AuthContext';

const SCENE = {
  success: true,
  data: {
    scene: { id: 'scene-1', title: 'Kitchen', background_url: 'https://cdn.test/kitchen.png', canvas_settings: {} },
    objects: [],
    variantGroups: [],
  },
};
const SET = {
  success: true,
  data: {
    sceneSet: { id: 'set-1', name: 'Loft', base_still_url: 'https://cdn.test/loft.png', canvas_settings: {} },
    angles: [],
    objects: [],
    variantGroups: [],
  },
};

const open = (user, props = { sceneId: 'scene-1' }) => render(
  <AuthContext.Provider value={{ user }}>
    <SceneStudio {...props} onBack={() => {}} />
  </AuthContext.Provider>,
);
const writes = () => [svc.saveCanvas, svc.saveSceneSetCanvas, svc.suggestObjects, svc.regenerateBackground, svc.regenerateSceneSetBackground, svc.updateScene, svc.updateSceneSet];

// jsdom has no ResizeObserver; the Studio fits its canvas with one.
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

beforeEach(() => {
  Object.values(svc).forEach((fn) => fn.mockReset());
  svc.getCanvas.mockResolvedValue(SCENE);
  svc.getSceneSetCanvas.mockResolvedValue(SET);
  svc.suggestObjects.mockResolvedValue({ success: true, data: { suggestions: [{ label: 'A lamp', prompt: 'a lamp' }] } });
  svc.saveCanvas.mockResolvedValue({ success: true, data: {} });
});

describe.each([
  ['an editor', { id: 'u1', groups: ['editor'] }],
  ['a viewer', { id: 'u2', groups: ['viewer'] }],
  ['someone in no group', { id: 'u3', groups: [] }],
  ['no one signed in', null],
])('Scene Studio opened by %s', (_who, user) => {
  it('shows the scene with the view-only notice, and Save is disabled', async () => {
    open(user);
    expect((await screen.findByTestId('scene-studio-view-only')).textContent).toBe('View-only — Admin editing required');
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(svc.getCanvas).toHaveBeenCalledWith('scene-1');
    const save = screen.getByTitle('View-only — Admin editing required');
    expect(save.disabled).toBe(true);
  });

  it('asks for no suggestions and sends no write, whatever is clicked', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    // The editing panels are inert and marked disabled.
    const add = screen.getByTestId('add-object');
    expect(add.closest('[data-view-only="true"]').getAttribute('aria-disabled')).toBe('true');
    expect(add.closest('[data-view-only="true"]').hasAttribute('inert')).toBe(true);
    // jsdom does not enforce inert, so the handlers themselves must do nothing.
    fireEvent.click(add);
    fireEvent.click(screen.getByTestId('restyle'));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Only an admin can change scenes, sets or footage.'));
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it('a scene set opens the same way', async () => {
    open(user, { sceneSetId: 'set-1' });
    expect(await screen.findByTestId('scene-studio-view-only')).toBeTruthy();
    expect(svc.getSceneSetCanvas).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('restyle'));
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });
});

describe.each([
  ['admin', { id: 'a1', groups: ['admin'] }],
  ['ADMIN among others', { id: 'a2', groups: ['editor', 'ADMIN'] }],
])('Scene Studio opened by an admin (%s)', (_who, user) => {
  it('has no notice, Save is enabled, and the suggestions are asked for as before', async () => {
    open(user);
    await screen.findByTestId('canvas');
    expect(screen.queryByTestId('scene-studio-view-only')).toBeNull();
    expect(screen.getByTitle('Save (Ctrl+S)').disabled).toBe(false);
    expect(screen.getByTestId('add-object').closest('[data-view-only="true"]')).toBeNull();
    await waitFor(() => expect(svc.suggestObjects).toHaveBeenCalledWith('scene-1'));
  });

  it('a server 403 on save is said in plain words', async () => {
    const refused = Object.assign(new Error('Request failed with status code 403'), {
      response: { status: 403, data: { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' } },
    });
    svc.saveCanvas.mockRejectedValue(refused);
    open(user);
    await screen.findByTestId('canvas');
    fireEvent.click(screen.getByTitle('Save (Ctrl+S)'));
    await waitFor(() => expect(svc.saveCanvas).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Only an admin can change scenes, sets or footage.'));
  });
});
