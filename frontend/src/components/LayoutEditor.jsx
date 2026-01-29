import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line, Group } from 'react-konva';
import useImage from 'use-image';
import './LayoutEditor.css';

/**
 * LayoutEditor Component
 * Konva-based canvas for adjusting asset positions and scales within template layout
 */

// Asset Image Component with drag/scale
const AssetNode = ({ asset, layoutConfig, onChange, isSelected, onSelect }) => {
  const [image] = useImage(asset.url || '', 'Anonymous');
  const nodeRef = useRef();

  const handleDragEnd = (e) => {
    const node = e.target;
    const stage = node.getStage();
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    onChange({
      ...asset,
      xPct: (node.x() / stageWidth) * 100,
      yPct: (node.y() / stageHeight) * 100,
    });
  };

  const handleTransformEnd = (e) => {
    const node = nodeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and update size
    node.scaleX(1);
    node.scaleY(1);

    onChange({
      ...asset,
      scale: asset.scale * Math.max(scaleX, scaleY),
    });
  };

  const x = (asset.xPct / 100) * (layoutConfig?.canvasWidth || 1920);
  const y = (asset.yPct / 100) * (layoutConfig?.canvasHeight || 1080);
  const width = (asset.wPct / 100) * (layoutConfig?.canvasWidth || 1920);
  const height = (asset.hPct / 100) * (layoutConfig?.canvasHeight || 1080);

  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      onTap={onSelect}
      ref={nodeRef}
    >
      <KonvaImage
        image={image}
        width={width}
        height={height}
        scaleX={asset.scale || 1}
        scaleY={asset.scale || 1}
        opacity={asset.visible !== false ? 1 : 0.3}
      />
      {isSelected && (
        <Rect
          width={width}
          height={height}
          stroke="#667eea"
          strokeWidth={3}
          dash={[10, 5]}
        />
      )}
    </Group>
  );
};

// Safe Zone Guides Component
const SafeZones = ({ canvasWidth, canvasHeight, safeZones }) => {
  if (!safeZones) return null;

  const guides = [];

  // YouTube title-safe area (default 5% margin)
  if (safeZones.youtube_title) {
    const margin = safeZones.youtube_title;
    const x = (margin.x / 100) * canvasWidth;
    const y = (margin.y / 100) * canvasHeight;
    const w = (margin.w / 100) * canvasWidth;
    const h = (margin.h / 100) * canvasHeight;

    guides.push(
      <Rect
        key="youtube-safe"
        x={x}
        y={y}
        width={w}
        height={h}
        stroke="#10b981"
        strokeWidth={2}
        dash={[15, 10]}
        listening={false}
      />
    );
  }

  // Center cross
  if (safeZones.center_cross) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    guides.push(
      <Line
        key="center-h"
        points={[0, centerY, canvasWidth, centerY]}
        stroke="#f59e0b"
        strokeWidth={1}
        dash={[5, 5]}
        listening={false}
      />
    );
    guides.push(
      <Line
        key="center-v"
        points={[centerX, 0, centerX, canvasHeight]}
        stroke="#f59e0b"
        strokeWidth={1}
        dash={[5, 5]}
        listening={false}
      />
    );
  }

  // Grid
  if (safeZones.grid) {
    const { columns = 12, rows = 9 } = safeZones.grid;
    const colWidth = canvasWidth / columns;
    const rowHeight = canvasHeight / rows;

    for (let i = 1; i < columns; i++) {
      guides.push(
        <Line
          key={`grid-v-${i}`}
          points={[i * colWidth, 0, i * colWidth, canvasHeight]}
          stroke="#d1d5db"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }

    for (let i = 1; i < rows; i++) {
      guides.push(
        <Line
          key={`grid-h-${i}`}
          points={[0, i * rowHeight, canvasWidth, i * rowHeight]}
          stroke="#d1d5db"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
  }

  return <>{guides}</>;
};

export default function LayoutEditor({ composition, onSave, onDiscard }) {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    loadCompositionAssets();
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [composition]);

  const updateDimensions = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth - 32; // padding
      const aspectRatio = 16 / 9;
      const height = containerWidth / aspectRatio;
      setDimensions({ width: containerWidth, height });
    }
  };

  const loadCompositionAssets = async () => {
    try {
      // Get composition assets
      const response = await fetch(`/api/v1/compositions/${composition.id}`);
      const data = await response.json();
      const comp = data.data || data;

      // Transform to canvas-ready format
      const template = comp.template || composition.template;
      const layoutConfig = template?.layout_config || {};
      const layoutOverrides = comp.layout_overrides || {};
      const draftOverrides = comp.draft_overrides || {};

      const canvasAssets = (comp.compositionAssets || []).map((ca) => {
        const asset = ca.asset;
        const role = ca.asset_role;
        
        // Get position from: draft > overrides > template config
        const draftPos = draftOverrides.roles?.[role];
        const overridePos = layoutOverrides.roles?.[role];
        const templatePos = layoutConfig.roles?.[role];

        const pos = draftPos || overridePos || templatePos || {
          xPct: 10,
          yPct: 10,
          wPct: 20,
          hPct: 20,
          scale: 1,
          visible: true,
          z: 1,
        };

        return {
          id: asset.id,
          role,
          name: asset.name || role,
          url: asset.s3_url_processed || asset.s3_url_raw || asset.thumbnail_url,
          xPct: pos.xPct || pos.x || 10,
          yPct: pos.yPct || pos.y || 10,
          wPct: pos.wPct || pos.w || 20,
          hPct: pos.hPct || pos.h || 20,
          scale: pos.scale || 1,
          visible: pos.visible !== false,
          z: pos.z || 1,
        };
      });

      // Sort by z-index
      canvasAssets.sort((a, b) => a.z - b.z);
      setAssets(canvasAssets);
    } catch (error) {
      console.error('Failed to load composition assets:', error);
    }
  };

  const handleAssetChange = (updatedAsset) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    setHasChanges(true);
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);

      // Convert assets to draft_overrides format
      const draftOverrides = {
        roles: {},
      };

      assets.forEach((asset) => {
        draftOverrides.roles[asset.role] = {
          xPct: asset.xPct,
          yPct: asset.yPct,
          wPct: asset.wPct,
          hPct: asset.hPct,
          scale: asset.scale,
          visible: asset.visible,
          z: asset.z,
        };
      });

      const response = await fetch(`/api/v1/compositions/${composition.id}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_overrides: draftOverrides }),
      });

      if (!response.ok) throw new Error('Failed to save draft');

      setHasChanges(false);
      if (onSave) onSave();
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('Failed to save draft: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyDraft = async () => {
    if (!window.confirm('Apply changes and create new version? This will require regenerating outputs.')) {
      return;
    }

    try {
      setSaving(true);

      const formats = composition.selected_formats || ['YOUTUBE'];
      const response = await fetch(`/api/v1/compositions/${composition.id}/apply-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate_formats: formats }),
      });

      if (!response.ok) throw new Error('Failed to apply changes');

      setHasChanges(false);
      if (onSave) onSave();
      alert('Changes applied! Outputs queued for regeneration.');
    } catch (error) {
      console.error('Failed to apply changes:', error);
      alert('Failed to apply changes: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (hasChanges && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    
    loadCompositionAssets();
    setHasChanges(false);
    if (onDiscard) onDiscard();
  };

  const handleResetAsset = () => {
    if (!selectedAssetId) return;
    
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;

    // Reset to template defaults
    const template = composition.template;
    const templatePos = template?.layout_config?.roles?.[asset.role];

    if (templatePos) {
      handleAssetChange({
        ...asset,
        xPct: templatePos.xPct || templatePos.x || 10,
        yPct: templatePos.yPct || templatePos.y || 10,
        wPct: templatePos.wPct || templatePos.w || 20,
        hPct: templatePos.hPct || templatePos.h || 20,
        scale: templatePos.scale || 1,
      });
    }
  };

  const template = composition.template;
  const layoutConfig = template?.layout_config || {};
  const safeZones = layoutConfig.safeZones || {
    youtube_title: { x: 5, y: 5, w: 90, h: 90 },
    center_cross: true,
    grid: { columns: 12, rows: 9 },
  };

  return (
    <div className="layout-editor">
      {/* Top Bar */}
      <div className="layout-editor__toolbar">
        <div className="layout-editor__toolbar-left">
          <h3 className="layout-editor__title">Adjust Layout</h3>
          {hasChanges && (
            <span className="layout-editor__unsaved-indicator">● Unsaved Changes</span>
          )}
        </div>

        <div className="layout-editor__toolbar-actions">
          <button
            className="layout-editor__btn layout-editor__btn--secondary"
            onClick={handleDiscard}
            disabled={!hasChanges}
          >
            Discard
          </button>
          <button
            className="layout-editor__btn layout-editor__btn--primary"
            onClick={handleSaveDraft}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            className="layout-editor__btn layout-editor__btn--success"
            onClick={handleApplyDraft}
            disabled={saving || !composition.has_unsaved_changes}
          >
            Apply & Regenerate
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="layout-editor__content">
        {/* Canvas */}
        <div className="layout-editor__canvas-container" ref={containerRef}>
          <div className="layout-editor__canvas-info">
            <span>Global Layout (affects all formats)</span>
            <span className="layout-editor__canvas-resolution">
              Preview: {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
            </span>
          </div>

          <Stage
            width={dimensions.width}
            height={dimensions.height}
            className="layout-editor__canvas"
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedAssetId(null);
              }
            }}
          >
            <Layer>
              {/* Background */}
              <Rect
                width={dimensions.width}
                height={dimensions.height}
                fill="#1f2937"
              />

              {/* Safe Zones */}
              <SafeZones
                canvasWidth={dimensions.width}
                canvasHeight={dimensions.height}
                safeZones={safeZones}
              />

              {/* Assets */}
              {assets.map((asset) => (
                <AssetNode
                  key={asset.id}
                  asset={asset}
                  layoutConfig={{ canvasWidth: dimensions.width, canvasHeight: dimensions.height }}
                  onChange={handleAssetChange}
                  isSelected={asset.id === selectedAssetId}
                  onSelect={() => setSelectedAssetId(asset.id)}
                />
              ))}
            </Layer>
          </Stage>

          {/* Legend */}
          <div className="layout-editor__legend">
            <div className="layout-editor__legend-item">
              <div className="layout-editor__legend-line layout-editor__legend-line--safe"></div>
              <span>YouTube Safe Zone</span>
            </div>
            <div className="layout-editor__legend-item">
              <div className="layout-editor__legend-line layout-editor__legend-line--center"></div>
              <span>Center Guides</span>
            </div>
            <div className="layout-editor__legend-item">
              <div className="layout-editor__legend-line layout-editor__legend-line--grid"></div>
              <span>Grid (12×9)</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Role List */}
        <div className="layout-editor__panel">
          <h4 className="layout-editor__panel-title">Assets by Role</h4>

          {assets.length === 0 ? (
            <div className="layout-editor__panel-empty">
              <p>No assets assigned</p>
            </div>
          ) : (
            <div className="layout-editor__role-list">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className={`layout-editor__role-item ${
                    asset.id === selectedAssetId ? 'layout-editor__role-item--selected' : ''
                  }`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <div className="layout-editor__role-header">
                    <span className="layout-editor__role-name">{asset.role}</span>
                    <input
                      type="checkbox"
                      checked={asset.visible}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleAssetChange({ ...asset, visible: e.target.checked });
                      }}
                      title="Toggle visibility"
                    />
                  </div>
                  <div className="layout-editor__role-preview">
                    {asset.url ? (
                      <img src={asset.url} alt={asset.name} />
                    ) : (
                      <div className="layout-editor__role-placeholder">No preview</div>
                    )}
                  </div>
                  <div className="layout-editor__role-name-label">{asset.name}</div>

                  {asset.id === selectedAssetId && (
                    <div className="layout-editor__role-controls">
                      <div className="layout-editor__control-group">
                        <label>X: {asset.xPct.toFixed(1)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={asset.xPct}
                          onChange={(e) =>
                            handleAssetChange({ ...asset, xPct: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <div className="layout-editor__control-group">
                        <label>Y: {asset.yPct.toFixed(1)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={asset.yPct}
                          onChange={(e) =>
                            handleAssetChange({ ...asset, yPct: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <div className="layout-editor__control-group">
                        <label>Scale: {asset.scale.toFixed(2)}×</label>
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.01"
                          value={asset.scale}
                          onChange={(e) =>
                            handleAssetChange({ ...asset, scale: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <button
                        className="layout-editor__reset-btn"
                        onClick={handleResetAsset}
                      >
                        Reset to Template Default
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
