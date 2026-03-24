import React, { useEffect, useCallback, useRef, useState } from 'react';
import StudioCanvas from './Canvas/StudioCanvas';
import Toolbar, { PLATFORM_PRESETS } from './Toolbar';
import ObjectsPanel from './panels/ObjectsPanel';
import AssetDrawer from './panels/AssetDrawer';
import InspectorPanel from './panels/InspectorPanel';
import useSceneStudioState from './useSceneStudioState';
import sceneService from '../../services/sceneService';
import './SceneStudio.css';

/**
 * SceneStudio — Main orchestrator component for the Canva-like scene editor.
 *
 * Works with both scenes (sceneId) and scene sets (sceneSetId).
 * Loads canvas state from API, manages all panels, handles keyboard shortcuts,
 * and auto-saves.
 */

export default function SceneStudio({ sceneId, sceneSetId, showId, episodeId, onBack }) {
  const state = useSceneStudioState();
  const canvasContainerRef = useRef(null);
  const [platform, setPlatform] = useState('youtube');
  const [isSaving, setIsSaving] = useState(false);
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const saveTimerRef = useRef(null);

  const canvasWidth = PLATFORM_PRESETS[platform]?.width || 1920;
  const canvasHeight = PLATFORM_PRESETS[platform]?.height || 1080;

  // ── Load canvas data ──

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (sceneId) {
          const result = await sceneService.getCanvas(sceneId);
          if (result.success) {
            state.loadFromApi(result.data, 'scene');
          }
        } else if (sceneSetId) {
          const result = await sceneService.getSceneSetCanvas(sceneSetId);
          if (result.success) {
            state.loadFromApi(result.data, 'sceneSet');
          }
        }
      } catch (err) {
        console.error('Scene Studio load error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sceneId, sceneSetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──

  const save = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = state.serializeForSave();
      if (state.contextType === 'scene') {
        await sceneService.saveCanvas(state.contextId, payload);
      } else {
        await sceneService.saveSceneSetCanvas(state.contextId, payload);
      }
      state.markClean();
    } catch (err) {
      console.error('Scene Studio save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [state, isSaving]);

  // Auto-save (3s debounce)
  useEffect(() => {
    if (!state.isDirty || isLoading) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 3000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.isDirty, state.objects, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
      if (isInput) return;

      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
      }
      // Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
      }
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.selectedIds.forEach((id) => state.removeObject(id));
      }
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        state.copySelected();
      }
      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        state.pasteClipboard();
      }
      // Escape
      if (e.key === 'Escape') {
        state.deselectAll();
      }
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') state.setActiveTool('select');
      if (e.key === 'h' || e.key === 'H') state.setActiveTool('hand');
      if (e.key === 't' || e.key === 'T') state.setActiveTool('text');
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) state.setActiveTool('shape');
      // Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, save]);

  // ── Tool actions (click on canvas to add text/shape) ──

  const handleCanvasClickForTool = useCallback(() => {
    if (state.activeTool === 'text') {
      state.addObject({
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        assetId: null,
        assetUrl: '',
        x: canvasWidth / 2 - 100,
        y: canvasHeight / 2 - 20,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        label: 'Text',
        styleData: {
          textContent: 'Double-click to edit',
          fontSize: 24,
          fontFamily: 'Lora, serif',
          fill: '#FFFFFF',
        },
      });
      state.setActiveTool('select');
    }
    if (state.activeTool === 'shape') {
      state.addObject({
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'shape',
        assetId: null,
        assetUrl: '',
        x: canvasWidth / 2 - 75,
        y: canvasHeight / 2 - 50,
        width: 150,
        height: 100,
        rotation: 0,
        opacity: 1,
        label: 'Shape',
        styleData: {
          shapeType: 'rect',
          fill: 'rgba(102, 126, 234, 0.3)',
          stroke: '#667eea',
          strokeWidth: 2,
          cornerRadius: 8,
        },
      });
      state.setActiveTool('select');
    }
  }, [state, canvasWidth, canvasHeight]);

  // ── Background URL (from scene or scene set angle) ──

  const backgroundUrl = (() => {
    if (state.contextType === 'scene') {
      const s = state.sceneData;
      return s?.background_url
        || s?.sceneAngle?.enhanced_still_url
        || s?.sceneAngle?.still_image_url
        || s?.sceneSet?.base_still_url
        || null;
    }
    if (state.contextType === 'sceneSet') {
      const angle = state.angles?.find((a) => a.id === state.activeAngleId);
      return angle?.still_image_url || state.sceneSetData?.base_still_url || null;
    }
    return null;
  })();

  const studioTitle = state.contextType === 'scene'
    ? state.sceneData?.title || 'Scene Studio'
    : state.sceneSetData?.name || 'Scene Set Studio';

  // ── Zoom handlers ──

  const handleZoomIn = useCallback(() => {
    state.setZoom(Math.min(5, state.canvasSettings.zoom * 1.2));
  }, [state]);

  const handleZoomOut = useCallback(() => {
    state.setZoom(Math.max(0.1, state.canvasSettings.zoom / 1.2));
  }, [state]);

  const handleFitToScreen = useCallback(() => {
    if (canvasContainerRef.current) {
      const { clientWidth, clientHeight } = canvasContainerRef.current;
      state.fitToScreen(clientWidth, clientHeight, canvasWidth, canvasHeight);
    }
  }, [state, canvasWidth, canvasHeight]);

  // Fit on first load
  useEffect(() => {
    if (!isLoading && canvasContainerRef.current) {
      // Small delay for DOM to settle
      const timer = setTimeout(handleFitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="scene-studio-loading-screen">
        <div className="scene-studio-spinner" />
        <span>Loading Scene Studio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scene-studio-error-screen">
        <p>Failed to load: {error}</p>
        <button className="scene-studio-btn primary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="scene-studio">
      {/* Toolbar */}
      <Toolbar
        activeTool={state.activeTool}
        onSetTool={state.setActiveTool}
        zoom={state.canvasSettings.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        undoCount={state.undoCount}
        redoCount={state.redoCount}
        onUndo={state.undo}
        onRedo={state.redo}
        isDirty={state.isDirty}
        isSaving={isSaving}
        onSave={save}
        title={studioTitle}
        platform={platform}
        onPlatformChange={setPlatform}
        gridVisible={state.canvasSettings.gridVisible}
        onToggleGrid={() => state.updateCanvasSettings({ gridVisible: !state.canvasSettings.gridVisible })}
        onBack={onBack}
      />

      <div className="scene-studio-body">
        {/* Left Panel */}
        <div className="scene-studio-left-panel">
          <ObjectsPanel
            objects={state.objects}
            selectedIds={state.selectedIds}
            onSelect={state.selectObject}
            onToggleVisibility={state.toggleVisibility}
            onToggleLock={state.toggleLock}
            onReorder={state.reorderObject}
            onDelete={state.removeObject}
            onDuplicate={state.duplicateObject}
          />

          <AssetDrawer
            showId={showId}
            episodeId={episodeId}
            onAddAsset={state.addObject}
            isOpen={assetDrawerOpen}
            onToggle={() => setAssetDrawerOpen(!assetDrawerOpen)}
          />
        </div>

        {/* Canvas */}
        <div className="scene-studio-canvas-container" ref={canvasContainerRef}>
          <StudioCanvas
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            backgroundUrl={backgroundUrl}
            objects={state.objects}
            selectedIds={state.selectedIds}
            activeTool={state.activeTool}
            zoom={state.canvasSettings.zoom}
            panX={state.canvasSettings.panX}
            panY={state.canvasSettings.panY}
            snapGuides={state.snapGuides}
            gridVisible={state.canvasSettings.gridVisible}
            onSelect={state.selectObject}
            onDeselect={() => {
              state.deselectAll();
              handleCanvasClickForTool();
            }}
            onUpdateObject={state.updateObject}
            onDragEnd={state.commitObjectChange}
            onTransformEnd={state.commitObjectChange}
            onZoom={state.setZoom}
            onPan={state.setPan}
            containerRef={canvasContainerRef}
          />
        </div>

        {/* Right Panel */}
        <div className="scene-studio-right-panel">
          <InspectorPanel
            objects={state.objects}
            selectedIds={state.selectedIds}
            canvasSettings={state.canvasSettings}
            variantGroups={state.variantGroups}
            angles={state.angles}
            activeAngleId={state.activeAngleId}
            onUpdateObject={state.updateObjectWithHistory}
            onReorder={state.reorderObject}
            onDelete={state.removeObject}
            onDuplicate={state.duplicateObject}
            onToggleVisibility={state.toggleVisibility}
            onToggleLock={state.toggleLock}
            onUpdateCanvasSettings={state.updateCanvasSettings}
            onActivateVariant={state.activateVariant}
            onSetActiveAngle={state.setActiveAngleId}
            contextType={state.contextType}
          />
        </div>
      </div>
    </div>
  );
}
