import { useReducer } from "react";

/**
 * Initial state for Scene Composer
 */
const initialState = {
  // Loading states
  loading: true,
  saving: false,
  creating: false,

  // Compositions (templates)
  compositions: [],
  activeCompositionId: null,

  // Selection & interaction
  selectedElementId: null,
  selectedLayerId: null, // Alias for backward compatibility
  
  // Canvas controls
  snapEnabled: true,
  showGrid: true,
  showRulers: true,
  canvasZoom: 1,
  
  // Tool state
  tool: "select", // select | move | resize
  isDragging: false,
  isResizing: false,

  // UI modals & dialogs
  ui: {
    showCreateDialog: false,
    showRoleDialog: false,
    pendingScene: null,
    pendingAsset: null,
    pendingWardrobe: null,
    toast: null,
  },

  // Processing state
  processingAsset: null,
  processingStatus: {},

  // History for undo/redo
  history: [],
  historyIndex: -1,
};

/**
 * Reducer for Scene Composer state management
 */
function reducer(state, action) {
  switch (action.type) {
    // ==================== LOADING ====================
    case "LOAD_START":
      return { ...state, loading: true };

    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        compositions: action.compositions || [],
        activeCompositionId:
          state.activeCompositionId ?? action.compositions?.[0]?.id ?? null,
      };

    case "LOAD_ERROR":
      return {
        ...state,
        loading: false,
        ui: { ...state.ui, toast: action.error },
      };

    // ==================== COMPOSITIONS ====================
    case "SET_COMPOSITIONS":
      return { ...state, compositions: action.compositions };

    case "ADD_COMPOSITION":
      return {
        ...state,
        compositions: [...state.compositions, action.composition],
        activeCompositionId: action.composition.id,
      };

    case "UPDATE_COMPOSITION":
      return {
        ...state,
        compositions: state.compositions.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };

    case "DELETE_COMPOSITION":
      const remaining = state.compositions.filter((c) => c.id !== action.id);
      return {
        ...state,
        compositions: remaining,
        activeCompositionId:
          state.activeCompositionId === action.id
            ? remaining[0]?.id ?? null
            : state.activeCompositionId,
      };

    case "SET_ACTIVE_COMPOSITION":
      return {
        ...state,
        activeCompositionId: action.id,
        selectedElementId: null,
        selectedLayerId: null,
      };

    // ==================== SELECTION ====================
    case "SELECT_ELEMENT":
    case "SELECT_LAYER":
      return {
        ...state,
        selectedElementId: action.id,
        selectedLayerId: action.id, // For backward compatibility
      };

    case "DESELECT":
      return {
        ...state,
        selectedElementId: null,
        selectedLayerId: null,
      };

    // ==================== CANVAS CONTROLS ====================
    case "TOGGLE_SNAP":
      return { ...state, snapEnabled: !state.snapEnabled };

    case "SET_SNAP":
      return { ...state, snapEnabled: action.enabled };

    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid };

    case "TOGGLE_RULERS":
      return { ...state, showRulers: !state.showRulers };

    case "SET_ZOOM":
      return { ...state, canvasZoom: action.zoom };

    case "ZOOM_IN":
      return { ...state, canvasZoom: Math.min(state.canvasZoom + 0.25, 2) };

    case "ZOOM_OUT":
      return { ...state, canvasZoom: Math.max(state.canvasZoom - 0.25, 0.25) };

    // ==================== TOOL STATE ====================
    case "SET_TOOL":
      return { ...state, tool: action.tool };

    case "START_DRAG":
      return { ...state, isDragging: true };

    case "END_DRAG":
      return { ...state, isDragging: false };

    case "START_RESIZE":
      return { ...state, isResizing: true };

    case "END_RESIZE":
      return { ...state, isResizing: false };

    // ==================== UI MODALS ====================
    case "UI":
      return { ...state, ui: { ...state.ui, ...action.patch } };

    case "SHOW_CREATE_DIALOG":
      return { ...state, ui: { ...state.ui, showCreateDialog: true } };

    case "HIDE_CREATE_DIALOG":
      return { ...state, ui: { ...state.ui, showCreateDialog: false } };

    case "SHOW_ROLE_DIALOG":
      return {
        ...state,
        ui: {
          ...state.ui,
          showRoleDialog: true,
          pendingScene: action.scene,
          pendingAsset: action.asset,
          pendingWardrobe: action.wardrobe,
        },
      };

    case "HIDE_ROLE_DIALOG":
      return {
        ...state,
        ui: {
          ...state.ui,
          showRoleDialog: false,
          pendingScene: null,
          pendingAsset: null,
          pendingWardrobe: null,
        },
      };

    case "SHOW_TOAST":
      return { ...state, ui: { ...state.ui, toast: action.message } };

    case "HIDE_TOAST":
      return { ...state, ui: { ...state.ui, toast: null } };

    // ==================== PROCESSING ====================
    case "SET_PROCESSING_ASSET":
      return { ...state, processingAsset: action.asset };

    case "SET_PROCESSING_STATUS":
      return {
        ...state,
        processingStatus: { ...state.processingStatus, ...action.status },
      };

    // ==================== SAVING ====================
    case "SAVE_START":
      return { ...state, saving: true };

    case "SAVE_SUCCESS":
      return { ...state, saving: false };

    case "SAVE_ERROR":
      return {
        ...state,
        saving: false,
        ui: { ...state.ui, toast: action.error },
      };

    // ==================== CREATING ====================
    case "CREATE_START":
      return { ...state, creating: true };

    case "CREATE_SUCCESS":
      return { ...state, creating: false };

    case "CREATE_ERROR":
      return {
        ...state,
        creating: false,
        ui: { ...state.ui, toast: action.error },
      };

    // ==================== HISTORY ====================
    case "PUSH_HISTORY":
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action.state);
      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };

    case "UNDO":
      if (state.historyIndex > 0) {
        return { ...state, historyIndex: state.historyIndex - 1 };
      }
      return state;

    case "REDO":
      if (state.historyIndex < state.history.length - 1) {
        return { ...state, historyIndex: state.historyIndex + 1 };
      }
      return state;

    // ==================== RESET ====================
    case "RESET":
      return { ...initialState, ...action.keepState };

    default:
      return state;
  }
}

/**
 * Custom hook for Scene Composer state management
 * 
 * @returns {[state, dispatch]} Tuple of state and dispatch function
 */
export function useSceneComposerState() {
  return useReducer(reducer, initialState);
}

export default useSceneComposerState;
