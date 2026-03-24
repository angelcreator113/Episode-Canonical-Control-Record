import React, { useCallback } from 'react';

/**
 * ShapesTab — Grid of shape presets that can be added to the canvas.
 */

const SHAPE_PRESETS = [
  {
    label: 'Rectangle',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <rect x="6" y="10" width="36" height="28" rx="2" fill="rgba(102,126,234,0.3)" stroke="#667eea" strokeWidth="2" />
      </svg>
    ),
    styleData: { shapeType: 'rect', fill: 'rgba(102, 126, 234, 0.3)', stroke: '#667eea', strokeWidth: 2, cornerRadius: 0 },
    width: 200, height: 140,
  },
  {
    label: 'Rounded Rect',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <rect x="6" y="10" width="36" height="28" rx="10" fill="rgba(102,126,234,0.3)" stroke="#667eea" strokeWidth="2" />
      </svg>
    ),
    styleData: { shapeType: 'rect', fill: 'rgba(102, 126, 234, 0.3)', stroke: '#667eea', strokeWidth: 2, cornerRadius: 12 },
    width: 200, height: 140,
  },
  {
    label: 'Circle',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r="18" fill="rgba(234,102,102,0.3)" stroke="#ea6666" strokeWidth="2" />
      </svg>
    ),
    styleData: { shapeType: 'circle', fill: 'rgba(234, 102, 102, 0.3)', stroke: '#ea6666', strokeWidth: 2 },
    width: 150, height: 150,
  },
  {
    label: 'Line',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <line x1="6" y1="24" x2="42" y2="24" stroke="#FFFFFF" strokeWidth="3" />
      </svg>
    ),
    styleData: { shapeType: 'line', stroke: '#FFFFFF', strokeWidth: 3, fill: 'transparent' },
    width: 200, height: 4,
  },
  {
    label: 'Star',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <polygon points="24,4 29.5,17.5 44,19 33,29 36,44 24,37 12,44 15,29 4,19 18.5,17.5" fill="rgba(234,190,50,0.3)" stroke="#eabe32" strokeWidth="2" />
      </svg>
    ),
    styleData: { shapeType: 'star', fill: 'rgba(234, 190, 50, 0.3)', stroke: '#eabe32', strokeWidth: 2, numPoints: 5, innerRadius: 40 },
    width: 150, height: 150,
  },
  {
    label: 'Triangle',
    preview: (
      <svg viewBox="0 0 48 48" width="48" height="48">
        <polygon points="24,6 42,42 6,42" fill="rgba(102,234,162,0.3)" stroke="#66eaa2" strokeWidth="2" />
      </svg>
    ),
    styleData: { shapeType: 'triangle', fill: 'rgba(102, 234, 162, 0.3)', stroke: '#66eaa2', strokeWidth: 2 },
    width: 150, height: 130,
  },
];

export default function ShapesTab({ canvasWidth, canvasHeight, onAddObject }) {
  const handleAdd = useCallback((preset) => {
    if (!onAddObject) return;
    onAddObject({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'shape',
      assetId: null,
      assetUrl: '',
      x: (canvasWidth || 1920) / 2 - (preset.width / 2),
      y: (canvasHeight || 1080) / 2 - (preset.height / 2),
      width: preset.width,
      height: preset.height,
      rotation: 0,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      label: preset.label,
      styleData: { ...preset.styleData },
    });
  }, [canvasWidth, canvasHeight, onAddObject]);

  return (
    <div className="scene-studio-shapes-tab">
      <div className="scene-studio-section-label">Shapes</div>
      <div className="scene-studio-shape-grid">
        {SHAPE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="scene-studio-shape-card"
            onClick={() => handleAdd(preset)}
            title={preset.label}
          >
            {preset.preview}
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
