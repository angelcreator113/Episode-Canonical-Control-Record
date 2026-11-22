/**
 * viewOnly — what Scene Studio is for someone who may open a shared scene or
 * set but not change it (anyone not in the admin group; Evoni, 2026-11-22).
 *
 * Display only: the server refuses these writes with 403 whatever the page
 * does. This keeps the page from pretending an edit happened, and from
 * sending a request (some of them paid) that can only be refused.
 */

// Actions of useSceneStudioState that change the scene. For a viewer they do
// nothing, so the canvas stays as it was loaded.
const EDIT_ACTIONS = [
  'addObject', 'removeObject', 'updateObject', 'updateObjectWithHistory', 'commitObjectChange',
  'duplicateObject', 'reorderObject', 'toggleLock', 'pasteClipboard', 'undo', 'redo',
  'activateVariant', 'markDirty', 'updateDepthMapUrl', 'updateDepthEffects',
  'groupObjects', 'ungroupObjects', 'replaceObjectAsset',
  'createSceneState', 'activateSceneState', 'deleteSceneState', 'renameSceneState',
];

// Tools a viewer may hold: pointing and panning. The rest (text, shape,
// erase, select-object …) edit the scene or start a paid call.
const VIEW_TOOLS = new Set(['select', 'hand']);

const noop = () => {};

/** The Studio's state for a viewer: reads and the viewport work, edits do nothing, nothing is ever dirty. */
export function viewOnlyState(state) {
  const out = { ...state, isDirty: false };
  for (const name of EDIT_ACTIONS) {
    if (typeof out[name] === 'function') out[name] = noop;
  }
  out.setActiveTool = (tool) => { if (VIEW_TOOLS.has(tool)) state.setActiveTool(tool); };
  return out;
}

const READS = /^(get|list|check)/;

/**
 * A service for a viewer: reads go through, every other method sends nothing
 * and rejects the way the server would (403, AUTH_GROUP_REQUIRED), after
 * telling the page so it can say why.
 */
export function viewOnlyService(service, onRefused) {
  return new Proxy(service, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function' || READS.test(String(prop))) return value;
      return async () => {
        if (onRefused) onRefused();
        const err = new Error('View-only: an admin makes this change');
        err.viewOnly = true;
        err.response = { status: 403, data: { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' } };
        throw err;
      };
    },
  });
}
