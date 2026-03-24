import React, { useCallback } from 'react';

/**
 * TextTab — Text style presets that can be added to the canvas.
 */

const TEXT_PRESETS = [
  {
    label: 'Heading',
    styleData: { textContent: 'Heading', fontSize: 48, fontFamily: 'Lora, serif', fill: '#FFFFFF', fontStyle: 'bold' },
    width: 300, height: 60,
    previewStyle: { fontSize: '20px', fontFamily: 'Lora, serif', fontWeight: 'bold', color: '#2C2C2C' },
  },
  {
    label: 'Subheading',
    styleData: { textContent: 'Subheading', fontSize: 32, fontFamily: 'Lora, serif', fill: '#FFFFFF' },
    width: 260, height: 44,
    previewStyle: { fontSize: '16px', fontFamily: 'Lora, serif', color: '#2C2C2C' },
  },
  {
    label: 'Body',
    styleData: { textContent: 'Body text', fontSize: 20, fontFamily: 'Lora, serif', fill: '#FFFFFF' },
    width: 200, height: 30,
    previewStyle: { fontSize: '13px', fontFamily: 'Lora, serif', color: '#555' },
  },
  {
    label: 'Caption',
    styleData: { textContent: 'Caption', fontSize: 14, fontFamily: 'DM Mono, monospace', fill: '#B8962E' },
    width: 160, height: 22,
    previewStyle: { fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#B8962E' },
  },
  {
    label: 'Quote',
    styleData: { textContent: '"Quote text"', fontSize: 24, fontFamily: 'Lora, serif', fill: '#FFFFFF', fontStyle: 'italic' },
    width: 260, height: 36,
    previewStyle: { fontSize: '14px', fontFamily: 'Lora, serif', fontStyle: 'italic', color: '#666' },
  },
  {
    label: 'Label',
    styleData: { textContent: 'LABEL', fontSize: 12, fontFamily: 'DM Mono, monospace', fill: '#FFFFFF', fontStyle: 'normal' },
    width: 120, height: 20,
    previewStyle: { fontSize: '10px', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' },
  },
];

export default function TextTab({ canvasWidth, canvasHeight, onAddObject }) {
  const handleAdd = useCallback((preset) => {
    if (!onAddObject) return;
    onAddObject({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
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
    <div className="scene-studio-text-tab">
      <div className="scene-studio-section-label">Text Styles</div>
      <div className="scene-studio-text-presets">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="scene-studio-text-card"
            onClick={() => handleAdd(preset)}
          >
            <span style={preset.previewStyle}>{preset.styleData.textContent}</span>
            <span className="scene-studio-text-card-label">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
