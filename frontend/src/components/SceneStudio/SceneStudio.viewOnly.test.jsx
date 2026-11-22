/**
 * Scene Studio for someone who is not an admin (P2a; Evoni, 2026-11-22):
 * the page opens and shows the scene, says "View-only — Admin editing
 * required", disables the editing actions, applies no edit from the
 * keyboard, the canvas or a menu, and sends no write and no paid request
 * (the automatic suggest-objects call among them). For an admin it is as
 * before. Display only: the server refuses these writes with 403 whatever
 * the page does.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// The canvas stand-in shows what the Studio gives it and lets a test act as
// the pointer would: pick an object, drag it, resize it, retype it.
vi.mock('./Canvas/StudioCanvas', () => ({
  default: React.forwardRef(({ objects, selectedIds, readOnly, activeTool, onSelect, onUpdateObject, onDragEnd, onTransformEnd, onZoom }, _ref) => (
    <div
      data-testid="canvas"
      data-objects={JSON.stringify(objects.map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width })))}
      data-selected={JSON.stringify([...selectedIds])}
      data-readonly={String(!!readOnly)}
      data-tool={activeTool}
    >
      <button type="button" data-testid="pick" onClick={() => onSelect('obj-1', false)}>pick</button>
      <button type="button" data-testid="drag" onClick={() => { onUpdateObject('obj-1', { x: 500 }); onDragEnd('obj-1', { x: 500, y: 60 }); }}>drag</button>
      <button type="button" data-testid="resize" onClick={() => onTransformEnd('obj-1', { width: 999 })}>resize</button>
      <button type="button" data-testid="zoom" onClick={() => onZoom(2, { x: 0, y: 0 })}>zoom</button>
    </div>
  )),
}));
vi.mock('./Canvas/MaskLayer', () => ({ default: () => null }));
vi.mock('./EraseBrushCanvas', () => ({ default: React.forwardRef(() => <div data-testid="erase-tool" />) }));
vi.mock('./panels/CreationPanel', () => ({
  default: ({ onAddObject }) => (
    <button type="button" data-testid="add-object" onClick={() => onAddObject({ id: 'obj-new', type: 'image', x: 0, y: 0, width: 10, height: 10 })}>
      add
    </button>
  ),
}));
vi.mock('./panels/InspectorPanel', () => ({
  default: ({ objects, selectedIds, onRegenerateVariation, onUpdateObject }) => (
    <div data-testid="inspector" data-inspecting={JSON.stringify(objects.filter((o) => selectedIds.has(o.id)).map((o) => o.label))}>
      <button type="button" data-testid="restyle" onClick={() => onRegenerateVariation && onRegenerateVariation()}>restyle</button>
      <input data-testid="x-field" defaultValue="40" onChange={() => onUpdateObject('obj-1', { x: 777 })} />
    </div>
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
  inpaintScene: vi.fn(),
  segmentObject: vi.fn(),
  generateDepth: vi.fn(),
}));
vi.mock('../../services/sceneService', () => ({ default: svc }));
vi.mock('../../services/assetService', () => ({ default: { getConfigCheck: vi.fn().mockResolvedValue({ data: { data: {} } }) } }));

import SceneStudio from './SceneStudio';
import AuthContext from '../../contexts/AuthContext';

const OBJECT = { id: 'obj-1', object_type: 'image', asset_id: 'asset-1', position_x: 40, position_y: 60, width: 120, height: 90, object_label: 'Lamp', asset: { s3_url_raw: 'https://cdn.test/lamp.png' } };
const scene = (over = {}) => ({
  success: true,
  data: {
    scene: { id: 'scene-1', title: 'Kitchen', background_url: 'https://cdn.test/kitchen.png', canvas_settings: {}, ...over },
    objects: [OBJECT],
    variantGroups: [],
  },
});
const SET = {
  success: true,
  data: {
    sceneSet: { id: 'set-1', name: 'Loft', base_still_url: 'https://cdn.test/loft.png', canvas_settings: {} },
    angles: [],
    objects: [],
    variantGroups: [],
  },
};

const Page = ({ user, ...props }) => (
  <AuthContext.Provider value={{ user }}>
    <SceneStudio onBack={() => {}} {...props} />
  </AuthContext.Provider>
);
const open = (user, props = { sceneId: 'scene-1' }) => render(<Page user={user} {...props} />);
const writes = () => [
  svc.saveCanvas, svc.saveSceneSetCanvas, svc.suggestObjects, svc.regenerateBackground, svc.regenerateSceneSetBackground,
  svc.updateScene, svc.updateSceneSet, svc.inpaintScene, svc.segmentObject, svc.generateDepth,
];
const noWrites = () => { for (const fn of writes()) expect(fn).not.toHaveBeenCalled(); };
const canvas = () => screen.getByTestId('canvas');
const objects = () => JSON.parse(canvas().getAttribute('data-objects'));
const selected = () => JSON.parse(canvas().getAttribute('data-selected'));
const key = (init) => act(() => { fireEvent.keyDown(window, init); });
const SENTENCE = 'Only an admin can change scenes, sets or footage.';
const NOTICE = 'View-only — Admin editing required';

// jsdom has no ResizeObserver; the Studio fits its canvas with one.
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

beforeEach(() => {
  Object.values(svc).forEach((fn) => fn.mockReset());
  svc.getCanvas.mockResolvedValue(scene());
  svc.getSceneSetCanvas.mockResolvedValue(SET);
  svc.suggestObjects.mockResolvedValue({ success: true, data: { suggestions: [{ label: 'A lamp', prompt: 'a lamp' }] } });
  svc.saveCanvas.mockResolvedValue({ success: true, data: {} });
});

describe.each([
  ['an editor', { id: 'u1', groups: ['USER', 'EDITOR'] }],
  ['a viewer', { id: 'u2', groups: ['viewer'] }],
  ['someone in no group', { id: 'u3', groups: [] }],
  ['no one signed in (or the user not loaded yet)', null],
])('Scene Studio opened by %s', (_who, user) => {
  it('shows the scene with the view-only notice, read aloud as a status', async () => {
    open(user);
    const notice = await screen.findByTestId('scene-studio-view-only');
    expect(notice.textContent).toBe(NOTICE);
    expect(notice.getAttribute('role')).toBe('status');
    expect(canvas().getAttribute('data-readonly')).toBe('true');
    expect(objects()).toEqual([{ id: 'obj-1', x: 40, y: 60, width: 120 }]);
    expect(svc.getCanvas).toHaveBeenCalledWith('scene-1');
  });

  it('Save, the editing tools and the panels\' controls are disabled; pointing and panning are not', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    const save = screen.getByText('Save').closest('button');
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.getAttribute('title')).toBe(NOTICE);
    expect(screen.getByText('Erase').closest('button').disabled).toBe(true);
    expect(screen.getByText('Select').closest('button').disabled).toBe(false);
    expect(screen.getByText('Pan').closest('button').disabled).toBe(false);
    // Every control inside a panel is disabled by its fieldset, so it is not
    // focusable and a click does nothing.
    for (const id of ['add-object', 'restyle', 'x-field']) {
      const control = screen.getByTestId(id);
      const group = control.closest('fieldset');
      expect(group.disabled).toBe(true);
      expect(group.getAttribute('aria-disabled')).toBe('true');
      expect(control.matches(':disabled')).toBe(true);
      expect(control.closest('[data-view-only="true"]')).toBeTruthy();
    }
    // The add, edit and undo actions of the bottom bar are not offered.
    expect(screen.queryByText('Add')).toBeNull();
    expect(screen.queryByText('Erase & Fill')).toBeNull();
    expect(screen.queryByText('Undo')).toBeNull();
    // The panel toggles are (they are how a narrow screen opens a panel to read).
    expect(screen.getByTitle('Inspector')).toBeTruthy();
    expect(screen.getByTitle('Objects & Library')).toBeTruthy();
  });

  it('an object can be picked to look at, and Escape lets go of it', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    fireEvent.click(screen.getByTestId('pick'));
    expect(selected()).toEqual(['obj-1']);
    expect(JSON.parse(screen.getByTestId('inspector').getAttribute('data-inspecting'))).toEqual(['Lamp']);
    key({ key: 'Escape' });
    expect(selected()).toEqual([]);
    noWrites();
  });

  it('no key changes the scene: delete, nudge, undo, redo, paste, duplicate, tool keys', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    fireEvent.click(screen.getByTestId('pick'));
    const before = objects();
    for (const init of [
      { key: 'Delete' }, { key: 'Backspace' },
      { key: 'ArrowLeft' }, { key: 'ArrowRight', shiftKey: true }, { key: 'ArrowUp' }, { key: 'ArrowDown' },
      { key: 'c', ctrlKey: true }, { key: 'v', ctrlKey: true }, { key: 'v', metaKey: true }, { key: 'd', ctrlKey: true },
      { key: 'z', ctrlKey: true }, { key: 'y', ctrlKey: true }, { key: 'z', ctrlKey: true, shiftKey: true },
      { key: 't' }, { key: 's' }, { key: 'e' }, { key: 'E' },
    ]) key(init);
    expect(objects()).toEqual(before);
    expect(selected()).toEqual(['obj-1']);
    // The erase tool (which leads to paid calls) cannot be held; pan and select can.
    expect(screen.queryByTestId('erase-tool')).toBeNull();
    expect(canvas().getAttribute('data-tool')).toBe('select');
    key({ key: 'h' });
    expect(canvas().getAttribute('data-tool')).toBe('hand');
    key({ key: 'v' });
    expect(canvas().getAttribute('data-tool')).toBe('select');
    noWrites();
  });

  it('Ctrl+S and Cmd+S send nothing and say why', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    key({ key: 's', ctrlKey: true });
    key({ key: 's', metaKey: true });
    expect(screen.getByRole('alert').textContent).toContain(SENTENCE);
    noWrites();
  });

  it('no pointer path changes the scene: drag, resize, a panel field, the context menu; zoom still works', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    fireEvent.click(screen.getByTestId('pick'));
    const before = objects();
    fireEvent.click(screen.getByTestId('drag'));
    fireEvent.click(screen.getByTestId('resize'));
    fireEvent.click(screen.getByTestId('add-object'));
    fireEvent.click(screen.getByTestId('restyle'));
    fireEvent.change(screen.getByTestId('x-field'), { target: { value: '777' } });
    expect(objects()).toEqual(before);
    // The context menu offers a viewer nothing that edits.
    fireEvent.contextMenu(canvas());
    expect(screen.queryByText('Paste')).toBeNull();
    expect(screen.queryByText('Duplicate')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getByText('Deselect All')).toBeTruthy();
    fireEvent.click(screen.getByTestId('zoom'));
    // Nothing became dirty, so the auto-save never runs.
    await new Promise((r) => setTimeout(r, 30));
    noWrites();
  });

  it('a scene with no background says so, with no button that opens an editing panel', async () => {
    svc.getCanvas.mockResolvedValue({ success: true, data: { scene: { id: 'scene-1', title: 'Empty', background_url: null, canvas_settings: {} }, objects: [], variantGroups: [] } });
    open(user);
    const empty = await screen.findByTestId('scene-studio-empty-view-only');
    expect(empty.textContent).toContain('This scene has no background yet.');
    expect(empty.textContent).toContain(NOTICE);
    expect(empty.querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByText('Start building your scene')).toBeNull();
    expect(screen.queryByText('Add from Library')).toBeNull();
    expect(screen.queryByText('Upload')).toBeNull();
    expect(screen.queryByText('Generate')).toBeNull();
    noWrites();
  });

  it('a scene set opens the same way', async () => {
    open(user, { sceneSetId: 'set-1' });
    expect(await screen.findByTestId('scene-studio-view-only')).toBeTruthy();
    expect(svc.getSceneSetCanvas).toHaveBeenCalled();
    key({ key: 's', ctrlKey: true });
    fireEvent.click(screen.getByTestId('restyle'));
    noWrites();
  });

  it('never asks for suggestions', async () => {
    open(user);
    await screen.findByTestId('scene-studio-view-only');
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
  });
});

describe('while the signed-in user is still loading', () => {
  it('no suggestion request is made; once the user turns out to be an admin it is made once', async () => {
    svc.getCanvas.mockResolvedValue({ success: true, data: { scene: { id: 'scene-1', title: 'Kitchen', background_url: 'https://cdn.test/kitchen.png', canvas_settings: {} }, objects: [], variantGroups: [] } });
    const { rerender } = render(<Page user={undefined} sceneId="scene-1" />);
    await screen.findByTestId('scene-studio-view-only');
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
    rerender(<Page user={{ id: 'a1', groups: ['admin'] }} sceneId="scene-1" />);
    await waitFor(() => expect(svc.suggestObjects).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('scene-studio-view-only')).toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.suggestObjects).toHaveBeenCalledTimes(1);
  });

  it('and once the user turns out not to be an admin it is never made', async () => {
    const { rerender } = render(<Page user={undefined} sceneId="scene-1" />);
    await screen.findByTestId('scene-studio-view-only');
    rerender(<Page user={{ id: 'u1', groups: ['USER', 'EDITOR'] }} sceneId="scene-1" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.suggestObjects).not.toHaveBeenCalled();
  });
});

describe.each([
  ['admin', { id: 'a1', groups: ['admin'] }],
  ['ADMIN among others', { id: 'a2', groups: ['editor', 'ADMIN'] }],
])('Scene Studio opened by an admin (%s): as before', (_who, user) => {
  it('has no notice, nothing is disabled, and the canvas is editable', async () => {
    open(user);
    await screen.findByTestId('canvas');
    expect(screen.queryByTestId('scene-studio-view-only')).toBeNull();
    expect(screen.getByTitle('Save (Ctrl+S)').disabled).toBe(false);
    expect(screen.getByText('Erase').closest('button').disabled).toBe(false);
    expect(canvas().getAttribute('data-readonly')).toBe('false');
    for (const id of ['add-object', 'restyle', 'x-field']) {
      expect(screen.getByTestId(id).closest('fieldset')).toBeNull();
      expect(screen.getByTestId(id).closest('[data-view-only="true"]')).toBeNull();
    }
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByText('Erase & Fill')).toBeTruthy();
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('the keyboard and the pointer edit: drag, nudge, delete, the erase tool', async () => {
    open(user);
    await screen.findByTestId('canvas');
    fireEvent.click(screen.getByTestId('pick'));
    fireEvent.click(screen.getByTestId('drag'));
    expect(objects()[0].x).toBe(500);
    key({ key: 'ArrowRight', shiftKey: true });
    expect(objects()[0].x).toBe(510);
    fireEvent.click(screen.getByTestId('resize'));
    expect(objects()[0].width).toBe(999);
    key({ key: 'e' });
    expect(screen.getByTestId('erase-tool')).toBeTruthy();
    key({ key: 'v' });
    key({ key: 'Delete' });
    expect(objects()).toEqual([]);
  });

  it('Ctrl+S saves', async () => {
    open(user);
    await screen.findByTestId('canvas');
    key({ key: 's', ctrlKey: true });
    await waitFor(() => expect(svc.saveCanvas).toHaveBeenCalledTimes(1));
    expect(svc.saveCanvas.mock.calls[0][0]).toBe('scene-1');
  });

  it('the suggestions are asked for once on load', async () => {
    svc.getCanvas.mockResolvedValue({ success: true, data: { scene: { id: 'scene-1', title: 'Kitchen', background_url: 'https://cdn.test/kitchen.png', canvas_settings: {} }, objects: [], variantGroups: [] } });
    open(user);
    await screen.findByTestId('canvas');
    await waitFor(() => expect(svc.suggestObjects).toHaveBeenCalledWith('scene-1'));
    await new Promise((r) => setTimeout(r, 30));
    expect(svc.suggestObjects).toHaveBeenCalledTimes(1);
  });

  it('an empty scene still invites building it', async () => {
    svc.getCanvas.mockResolvedValue({ success: true, data: { scene: { id: 'scene-1', title: 'Empty', background_url: null, canvas_settings: {} }, objects: [], variantGroups: [] } });
    open(user);
    expect(await screen.findByText('Start building your scene')).toBeTruthy();
    expect(screen.getByText('Add from Library')).toBeTruthy();
    expect(screen.getByText('Generate')).toBeTruthy();
    expect(screen.queryByTestId('scene-studio-empty-view-only')).toBeNull();
    // The context menu edits, as before.
    fireEvent.contextMenu(canvas());
    expect(screen.getByText('Paste')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(SENTENCE));
  });
});
