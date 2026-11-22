import { describe, it, expect, vi } from 'vitest';
import { viewOnlyState, viewOnlyService } from './viewOnly';
import { sceneAdminOnlyMessage, adminOnlyMessage, SCENE_ADMIN_ONLY_MESSAGE, VIEW_ONLY_NOTICE } from '../../utils/authGroups';

describe('viewOnlyState', () => {
  const make = () => ({
    isDirty: true,
    objects: [{ id: 'o1' }],
    addObject: vi.fn(), removeObject: vi.fn(), updateObjectWithHistory: vi.fn(), duplicateObject: vi.fn(),
    pasteClipboard: vi.fn(), markDirty: vi.fn(), activateSceneState: vi.fn(), undo: vi.fn(),
    selectObject: vi.fn(), setZoom: vi.fn(), setPan: vi.fn(), loadFromApi: vi.fn(), setActiveTool: vi.fn(),
  });

  it('keeps reads and the viewport, turns edits into nothing, and is never dirty', () => {
    const state = make();
    const view = viewOnlyState(state);
    expect(view.isDirty).toBe(false);
    expect(view.objects).toBe(state.objects);
    for (const name of ['addObject', 'removeObject', 'updateObjectWithHistory', 'duplicateObject', 'pasteClipboard', 'markDirty', 'activateSceneState', 'undo']) {
      view[name]({ id: 'x' });
      expect(state[name]).not.toHaveBeenCalled();
    }
    view.selectObject('o1'); view.setZoom(2); view.setPan(1, 1); view.loadFromApi({}, 'scene');
    expect(state.selectObject).toHaveBeenCalledWith('o1');
    expect(state.setZoom).toHaveBeenCalledWith(2);
    expect(state.setPan).toHaveBeenCalledWith(1, 1);
    expect(state.loadFromApi).toHaveBeenCalled();
    // The original is not changed.
    expect(state.isDirty).toBe(true);
  });

  it('lets a viewer hold only the pointing and panning tools', () => {
    const state = make();
    const view = viewOnlyState(state);
    for (const tool of ['text', 'shape', 'erase', 'select-object']) view.setActiveTool(tool);
    expect(state.setActiveTool).not.toHaveBeenCalled();
    view.setActiveTool('hand');
    view.setActiveTool('select');
    expect(state.setActiveTool.mock.calls).toEqual([['hand'], ['select']]);
  });
});

describe('viewOnlyService', () => {
  const make = () => ({
    getCanvas: vi.fn().mockResolvedValue('canvas'),
    getSceneSetCanvas: vi.fn().mockResolvedValue('set canvas'),
    listSceneAssets: vi.fn().mockResolvedValue([]),
    saveCanvas: vi.fn(), suggestObjects: vi.fn(), inpaintScene: vi.fn(), segmentObject: vi.fn(),
    regenerateBackground: vi.fn(), generateDepth: vi.fn(), updateScene: vi.fn(), animateScene: vi.fn(),
  });

  it('passes reads through', async () => {
    const service = make();
    const view = viewOnlyService(service);
    await expect(view.getCanvas('s1')).resolves.toBe('canvas');
    await expect(view.getSceneSetCanvas('set1')).resolves.toBe('set canvas');
    await expect(view.listSceneAssets('s1')).resolves.toEqual([]);
    expect(service.getCanvas).toHaveBeenCalledWith('s1');
  });

  it('sends no write or paid request, and rejects the way the server would', async () => {
    const service = make();
    const refused = vi.fn();
    const view = viewOnlyService(service, refused);
    for (const name of ['saveCanvas', 'suggestObjects', 'inpaintScene', 'segmentObject', 'regenerateBackground', 'generateDepth', 'updateScene', 'animateScene']) {
      const err = await view[name]('s1', {}).catch((e) => e);
      expect(service[name]).not.toHaveBeenCalled();
      expect(err.response).toMatchObject({ status: 403, data: { code: 'AUTH_GROUP_REQUIRED' } });
      // The page turns it into its sentence.
      expect(sceneAdminOnlyMessage(err)).toBe(SCENE_ADMIN_ONLY_MESSAGE);
    }
    expect(refused).toHaveBeenCalledTimes(8);
  });
});

describe('sceneAdminOnlyMessage', () => {
  const refusal = (data, status = 403) => Object.assign(new Error('x'), { response: { status, data } });

  it('gives the page sentence for the middleware refusal', () => {
    expect(sceneAdminOnlyMessage(refusal({ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' })))
      .toBe('Only an admin can change scenes, sets or footage.');
  });

  it("gives a handler's own sentence when it sent one", () => {
    const own = 'Only an admin can link a scene set to an episode.';
    expect(sceneAdminOnlyMessage(refusal({ success: false, code: 'AUTH_GROUP_REQUIRED', error: own, message: own, fields: ['episode_ids'] }))).toBe(own);
  });

  it('is null for anything else, so a caller keeps its own message', () => {
    expect(sceneAdminOnlyMessage(refusal({ error: 'Nope' }, 400))).toBeNull();
    expect(sceneAdminOnlyMessage(refusal({ error: 'Forbidden', code: 'OTHER' }))).toBeNull();
    expect(sceneAdminOnlyMessage(new Error('network'))).toBeNull();
    expect(adminOnlyMessage(null)).toBeNull();
  });

  it('the notice is the approved wording', () => {
    expect(VIEW_ONLY_NOTICE).toBe('View-only — Admin editing required');
  });
});
