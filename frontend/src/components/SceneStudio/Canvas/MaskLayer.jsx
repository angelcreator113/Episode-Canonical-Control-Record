import React, { useRef, useCallback, useState } from 'react';
import { Line, Group, Rect } from 'react-konva';

/**
 * MaskLayer — Brush painting overlay for the erase/inpaint tool.
 *
 * When active, captures mouse/touch events and draws red semi-transparent
 * strokes on a mask layer. The mask can be exported as a black/white PNG
 * data URL for the inpainting API (white = area to fill, black = keep).
 */

const DEFAULT_BRUSH_SIZE = 30;

export default function MaskLayer({
  active,
  canvasWidth,
  canvasHeight,
  brushSize = DEFAULT_BRUSH_SIZE,
  onMaskChange,
  stageRef,
}) {
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);

  const handleMouseDown = useCallback((e) => {
    if (!active) return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines((prev) => [...prev, { points: [pos.x, pos.y], strokeWidth: brushSize }]);
  }, [active, brushSize]);

  const handleMouseMove = useCallback((e) => {
    if (!active || !isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
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
    // Notify parent that mask changed
    if (onMaskChange) onMaskChange(lines.length > 0);
  }, [active, lines.length, onMaskChange]);

  /**
   * Export the current mask as a black/white PNG data URL.
   * White = areas to inpaint (where user painted).
   * Black = areas to keep.
   */
  const exportMask = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // Fill black (keep everything)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw white where user painted (areas to remove)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const line of lines) {
      ctx.lineWidth = line.strokeWidth || DEFAULT_BRUSH_SIZE;
      ctx.beginPath();
      for (let i = 0; i < line.points.length; i += 2) {
        const x = line.points[i];
        const y = line.points[i + 1];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  }, [lines, canvasWidth, canvasHeight]);

  const clearMask = useCallback(() => {
    setLines([]);
    if (onMaskChange) onMaskChange(false);
  }, [onMaskChange]);

  const hasMask = lines.length > 0;

  // Expose exportMask and clearMask to parent via ref pattern
  // Parent can call these by passing a ref callback
  React.useEffect(() => {
    if (onMaskChange) {
      // Attach methods to a global so parent can call them
      MaskLayer._exportMask = exportMask;
      MaskLayer._clearMask = clearMask;
      MaskLayer._hasMask = hasMask;
    }
  }, [exportMask, clearMask, hasMask, onMaskChange]);

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
          stroke="rgba(220, 53, 53, 0.4)"
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
