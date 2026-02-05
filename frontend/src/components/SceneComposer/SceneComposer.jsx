import React, { useEffect } from "react";
import { useSceneComposerState } from "./useSceneComposerState";
import videoCompositionService from "../../services/videoCompositionService";

import ComposerHeader from "./components/ComposerHeader";
import SourcePanel from "./components/SourcePanel";
import CanvasStage from "./components/CanvasStage";
import InspectorPanel from "./components/InspectorPanel";
import VideoCompositionWorkspace from "../VideoCompositionWorkspace";

// Modular CSS with clear visual hierarchy
import "./styles/index.css";

/**
 * SceneComposer - Orchestration layer for the Scene Composer
 * 
 * This component manages state via reducer and coordinates between child components.
 * Currently delegates to VideoCompositionWorkspace for backward compatibility,
 * but provides the structure to incrementally move logic into child components.
 * 
 * @param {string} episodeId - Episode ID
 * @param {object} episode - Episode data
 * @param {array} episodeScenes - Available scenes
 * @param {array} episodeAssets - Available assets
 * @param {array} episodeWardrobes - Available wardrobe items
 */
export default function SceneComposer({
  episodeId,
  episode,
  episodeScenes = [],
  episodeAssets = [],
  episodeWardrobes = []
}) {
  const [state, dispatch] = useSceneComposerState();

  // Load compositions on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      dispatch({ type: "LOAD_START" });
      try {
        const data = await videoCompositionService.list(episodeId);
        const compositions = data.data || data.compositions || [];
        if (!cancelled) {
          dispatch({ type: "LOAD_SUCCESS", compositions });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: "LOAD_ERROR", error: error.message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  const activeComposition = state.compositions.find(
    (c) => c.id === state.activeCompositionId
  ) || null;

  // For now, we just pass through to VideoCompositionWorkspace
  // In future iterations, we'll move logic into the orchestration layer
  return (
    <VideoCompositionWorkspace
      episodeId={episodeId}
      episode={episode}
      episodeScenes={episodeScenes}
      episodeAssets={episodeAssets}
      episodeWardrobes={episodeWardrobes}
    />
  );

  /*
   * Future structure (uncomment and migrate incrementally):
   * 
   * return (
   *   <div className="video-workspace">
   *     <ComposerHeader
   *       episode={episode}
   *       compositions={state.compositions}
   *       activeCompositionId={state.activeCompositionId}
   *       onSelectComposition={(id) => dispatch({ type: "SET_ACTIVE_COMPOSITION", id })}
   *       snapEnabled={state.snapEnabled}
   *       onToggleSnap={() => dispatch({ type: "TOGGLE_SNAP" })}
   *       onCreateNew={() => dispatch({ type: "SHOW_CREATE_DIALOG" })}
   *       canvasZoom={state.canvasZoom}
   *       onZoomIn={() => dispatch({ type: "ZOOM_IN" })}
   *       onZoomOut={() => dispatch({ type: "ZOOM_OUT" })}
   *       showGrid={state.showGrid}
   *       onToggleGrid={() => dispatch({ type: "TOGGLE_GRID" })}
   *       showRulers={state.showRulers}
   *       onToggleRulers={() => dispatch({ type: "TOGGLE_RULERS" })}
   *     />
   *
   *     <div className="sc-editor">
   *       <SourcePanel
   *         episodeScenes={episodeScenes}
   *         episodeAssets={episodeAssets}
   *         episodeWardrobes={episodeWardrobes}
   *         onAddScene={(scene) => {}}
   *         onAddAsset={(asset) => {}}
   *         onAddWardrobe={(wardrobe) => {}}
   *       />
   *
   *       <div className="sc-main">
   *         <CanvasStage
   *           composition={activeComposition}
   *           selectedLayerId={state.selectedLayerId}
   *           onSelectLayer={(id) => dispatch({ type: "SELECT_LAYER", id })}
   *           snapEnabled={state.snapEnabled}
   *           canvasZoom={state.canvasZoom}
   *           showGrid={state.showGrid}
   *           showRulers={state.showRulers}
   *         />
   *       </div>
   *
   *       <InspectorPanel
   *         composition={activeComposition}
   *         selectedLayerId={state.selectedLayerId}
   *         onUpdateLayer={(id, updates) => {}}
   *         onDeleteLayer={(id) => {}}
   *       />
   *     </div>
   *   </div>
   * );
   */
}


