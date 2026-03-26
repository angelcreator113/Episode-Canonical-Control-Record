import React, { useRef, useCallback, useState } from 'react';
import { Line, Group, Rect } from 'react-konva';

/**
 * MaskLayer — Brush painting overlay for the erase/inpaint tool.
 *
 * When active, captures mouse/touch events and draws red semi-transparent
 * strokes on a mask layer. The mask can be exported as a black/white PNG
 * data URL for the inpainting API (white = area to fill, black = keep).
 *
 * Coordinates are transformed from screen space to canvas space so the
 * brush paints accurately regardless of zoom/pan level.
 */

const DEFAULT_BRUSH_SIZE = 30;

function getBackgroundExportPoint(point, targetLayout) {
  return {
    x: ((point.x - targetLayout.drawX) / targetLayout.drawWidth) * targetLayout.sourceWidth,
    y: ((point.y - targetLayout.drawY) / targetLayout.drawHeight) * targetLayout.sourceHeight,
  };
}

function getObjectLocalPoint(point, targetObject) {
  const width = targetObject.width || 1;
  const height = targetObject.height || 1;
  const rotationDeg = targetObject.rotation || 0;
  const rad = (rotationDeg * Math.PI) / 180;

  const signedScaleX = (targetObject.flipX ? -1 : 1) * (targetObject.scaleX || 1);
  const signedScaleY = (targetObject.flipY ? -1 : 1) * (targetObject.scaleY || 1);

  if (signedScaleX === 0 || signedScaleY === 0) {
    return { x: 0, y: 0 };
  }

  const offsetX = targetObject.flipX ? width : 0;
  const offsetY = targetObject.flipY ? height : 0;

  const tx = point.x - (targetObject.x || 0);
  const ty = point.y - (targetObject.y || 0);

  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const ux = tx * cos - ty * sin;
  const uy = tx * sin + ty * cos;

  return {
    x: ux / signedScaleX + offsetX,
    y: uy / signedScaleY + offsetY,
  };
}

function getObjectExportPoint(point, targetObject) {
  const local = getObjectLocalPoint(point, targetObject);
  const width = targetObject.width || 1;
  const height = targetObject.height || 1;
  const crop = targetObject.cropData;

  if (crop) {
    return {
      x: (crop.x || 0) + (local.x / width) * (crop.width || width),
      y: (crop.y || 0) + (local.y / height) * (crop.height || height),
    };
  }

  return {
    x: (local.x / width) * targetObject.sourceWidth,
    y: (local.y / height) * targetObject.sourceHeight,
  };
}

function getObjectLineScale(targetObject) {
  const width = targetObject.width || 1;
  const height = targetObject.height || 1;
  const crop = targetObject.cropData;

  const sourceW = crop ? (crop.width || width) : (targetObject.sourceWidth || width);
  const sourceH = crop ? (crop.height || height) : (targetObject.sourceHeight || height);

  const signedScaleX = (targetObject.flipX ? -1 : 1) * (targetObject.scaleX || 1);
  const signedScaleY = (targetObject.flipY ? -1 : 1) * (targetObject.scaleY || 1);

  const canvasPerLocalX = Math.abs(signedScaleX) || 1;
  const canvasPerLocalY = Math.abs(signedScaleY) || 1;

  const sourcePerCanvasX = (sourceW / width) / canvasPerLocalX;
  const sourcePerCanvasY = (sourceH / height) / canvasPerLocalY;

  return (sourcePerCanvasX + sourcePerCanvasY) / 2;
}

/**
 * Convert screen pointer position to canvas coordinates,
 * accounting for stage zoom (scale) and pan (position).
 */
function getCanvasPoint(stage) {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  return transform.point(pointer);
}

export default function MaskLayer({
  active,
  canvasWidth,
  canvasHeight,
  brushSize = DEFAULT_BRUSH_SIZE,
  mode = 'add',
  onMaskChange,
  stageRef,
}) {
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);

  const handleMouseDown = useCallback((e) => {
    if (!active) return;
    isDrawing.current = true;
    const stage = e.target.getStage();
    const pos = getCanvasPoint(stage);
    if (!pos) return;
    setLines((prev) => [...prev, { points: [pos.x, pos.y], strokeWidth: brushSize, mode }]);
  }, [active, brushSize, mode]);

  const handleMouseMove = useCallback((e) => {
    if (!active || !isDrawing.current) return;
    const stage = e.target.getStage();
    const point = getCanvasPoint(stage);
    if (!point) return;
    setLines((prev) => {
      const lastLine = prev[prev.length - 1];
      if (!lastLine) return prev;
      const updated = {
        ...lastLine,
        points: [...lastLine.points, point.x, point.y],
      };
      return [...prev.slice(0, -1), updated];
    });
  }, [active]);

  const handleMouseUp = useCallback(() => {
    if (!active) return;
    isDrawing.current = false;
    if (onMaskChange) onMaskChange(lines.length > 0);
  }, [active, lines.length, onMaskChange]);

  /**
   * Export the current mask as a black/white PNG data URL.
   * White = areas to inpaint (where user painted).
   * Black = areas to keep.
   */
  const exportMask = useCallback((options = {}) => {
    const targetLayout = options.targetLayout;
    const targetObject = options.targetObject;

    const exportWidth = targetObject?.sourceWidth || targetLayout?.sourceWidth || canvasWidth;
    const exportHeight = targetObject?.sourceHeight || targetLayout?.sourceHeight || canvasHeight;
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');

    // Fill black (keep everything)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Draw white where user painted (areas to remove)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const line of lines) {
      const scale = targetObject
        ? getObjectLineScale(targetObject)
        : targetLayout
          ? (targetLayout.sourceWidth / targetLayout.drawWidth)
          : 1;
      ctx.lineWidth = (line.strokeWidth || DEFAULT_BRUSH_SIZE) * scale;
      ctx.beginPath();
      ctx.globalCompositeOperation = line.mode === 'subtract' ? 'destination-out' : 'source-over';
      for (let i = 0; i < line.points.length; i += 2) {
        const rawPoint = { x: line.points[i], y: line.points[i + 1] };
        const point = targetObject
          ? getObjectExportPoint(rawPoint, targetObject)
          : targetLayout
            ? getBackgroundExportPoint(rawPoint, targetLayout)
            : rawPoint;
        const x = point.x;
        const y = point.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/png');
  }, [lines, canvasWidth, canvasHeight]);

  const clearMask = useCallback(() => {
    setLines([]);
    if (onMaskChange) onMaskChange(false);
  }, [onMaskChange]);

  const hasMask = lines.length > 0;

  // Expose exportMask and clearMask to parent via static methods
  React.useEffect(() => {
    MaskLayer._exportMask = exportMask;
    MaskLayer._clearMask = clearMask;
    MaskLayer._hasMask = hasMask;
  }, [exportMask, clearMask, hasMask]);

  if (!active && lines.length === 0) return null;

  return (
    <Group>
      {/* Invisible rect to capture mouse events across entire canvas */}
      {active && (
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill="transparent"
          listening={true}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
      )}

      {/* Render mask strokes — red semi-transparent for visibility */}
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          stroke={line.mode === 'subtract' ? 'rgba(30, 144, 255, 0.45)' : 'rgba(220, 53, 53, 0.4)'}
          strokeWidth={line.strokeWidth || DEFAULT_BRUSH_SIZE}
          lineCap="round"
          lineJoin="round"
          listening={false}
          globalCompositeOperation="source-over"
        />
      ))}
    </Group>
  );
}

// Static methods for parent access
MaskLayer._exportMask = () => '';
MaskLayer._clearMask = () => {};
MaskLayer._hasMask = false;
