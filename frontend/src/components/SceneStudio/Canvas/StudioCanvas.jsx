import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Transformer, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';
import ImageObject from './objects/ImageObject';
import VideoObject from './objects/VideoObject';
import TextObject from './objects/TextObject';
import ShapeObject from './objects/ShapeObject';

/**
 * StudioCanvas — Main Konva canvas for Scene Studio.
 *
 * Renders all scene objects with transform handles, handles selection,
 * zoom/pan, and background image.
 */

const OBJECT_RENDERERS = {
  image: ImageObject,
  video: VideoObject,
  text: TextObject,
  shape: ShapeObject,
  decor: ImageObject,
  overlay: ImageObject,
};

function BackgroundImage({ src, width, height }) {
  // Load without crossOrigin to avoid CORS failures on S3 images
  const [image] = useImage(src);
  if (!image) return null;

  // Cover fit
  const imgRatio = image.width / image.height;
  const canvasRatio = width / height;
  let drawW, drawH, drawX, drawY;

  if (imgRatio > canvasRatio) {
    drawH = height;
    drawW = height * imgRatio;
    drawX = (width - drawW) / 2;
    drawY = 0;
  } else {
    drawW = width;
    drawH = width / imgRatio;
    drawX = 0;
    drawY = (height - drawH) / 2;
  }

  return (
    <KonvaImage
      image={image}
      x={drawX}
      y={drawY}
      width={drawW}
      height={drawH}
      listening={false}
    />
  );
}

function SnapGuides({ guides, canvasWidth, canvasHeight }) {
  if (!guides || guides.length === 0) return null;

  return guides.map((guide, i) => {
    if (guide.orientation === 'vertical') {
      return (
        <Line
          key={`guide-${i}`}
          points={[guide.position, 0, guide.position, canvasHeight]}
          stroke="#FFD700"
          strokeWidth={1}
          dash={[4, 4]}
          listening={false}
        />
      );
    }
    return (
      <Line
        key={`guide-${i}`}
        points={[0, guide.position, canvasWidth, guide.position]}
        stroke="#FFD700"
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    );
  });
}

const StudioCanvas = React.forwardRef(function StudioCanvas({
  canvasWidth,
  canvasHeight,
  backgroundUrl,
  objects,
  selectedIds,
  activeTool,
  zoom,
  panX,
  panY,
  snapGuides,
  onSelect,
  onDeselect,
  onUpdateObject,
  onDragEnd,
  onTransformEnd,
  onZoom,
  onPan,
  gridVisible,
  containerRef,
  editingTextId,
  onClearEditingText,
}, forwardedRef) {
  const stageRef = useRef(null);

  // Expose stage ref to parent for export
  React.useImperativeHandle(forwardedRef, () => stageRef.current, []);
  const transformerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Fit stage to container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef?.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setStageSize({ width: clientWidth, height: clientHeight });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [containerRef]);

  // Update Transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    const selectedNodes = [];
    if (selectedIds.size > 0) {
      selectedIds.forEach((id) => {
        const node = stage.findOne(`#${id}`);
        if (node) selectedNodes.push(node);
      });
    }
    transformer.nodes(selectedNodes);
    transformer.getLayer().batchDraw();
  }, [selectedIds, objects]);

  // Handle click on stage background (deselect)
  const handleStageClick = useCallback((e) => {
    // Clicked on stage itself (not on an object)
    if (e.target === e.target.getStage() || e.target.name() === 'canvas-bg') {
      if (onDeselect) onDeselect();
    }
  }, [onDeselect]);

  // Handle object selection
  const handleObjectSelect = useCallback((objId) => (e) => {
    e.cancelBubble = true;
    if (onSelect) {
      const shiftKey = e.evt?.shiftKey || false;
      onSelect(objId, shiftKey);
    }
  }, [onSelect]);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    if (!onZoom) return;

    const scaleBy = 1.08;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const oldScale = zoom;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    // Zoom toward pointer
    const mousePointTo = {
      x: (pointer.x - panX) / oldScale,
      y: (pointer.y - panY) / oldScale,
    };

    onZoom(clampedScale, {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [zoom, panX, panY, onZoom]);

  // Sort objects by layer_order for rendering
  const sortedObjects = [...objects].sort((a, b) => (a.layerOrder || 0) - (b.layerOrder || 0));

  // Only show objects that are visible or selected
  const visibleObjects = sortedObjects.filter(
    (obj) => obj.isVisible || selectedIds.has(obj.id)
  );

  // Filter to only active variants (if part of a variant group)
  const renderableObjects = visibleObjects.filter(
    (obj) => !obj.variantGroupId || obj.isActiveVariant
  );

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      scaleX={zoom}
      scaleY={zoom}
      x={panX}
      y={panY}
      onClick={handleStageClick}
      onTap={handleStageClick}
      onWheel={handleWheel}
      draggable={activeTool === 'hand'}
      onDragEnd={(e) => {
        if (activeTool === 'hand' && onPan) {
          onPan(e.target.x(), e.target.y());
        }
      }}
      style={{ cursor: activeTool === 'hand' ? 'grab' : 'default' }}
    >
      {/* Background layer */}
      <Layer>
        {/* Canvas background color */}
        <Rect
          name="canvas-bg"
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill="#1a1a2e"
          listening={true}
        />
        {backgroundUrl && (
          <BackgroundImage
            src={backgroundUrl}
            width={canvasWidth}
            height={canvasHeight}
          />
        )}

        {/* Grid */}
        {gridVisible && Array.from({ length: Math.floor(canvasWidth / 100) }, (_, i) => (
          <Line
            key={`grid-v-${i}`}
            points={[(i + 1) * 100, 0, (i + 1) * 100, canvasHeight]}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            listening={false}
          />
        ))}
        {gridVisible && Array.from({ length: Math.floor(canvasHeight / 100) }, (_, i) => (
          <Line
            key={`grid-h-${i}`}
            points={[0, (i + 1) * 100, canvasWidth, (i + 1) * 100]}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            listening={false}
          />
        ))}
      </Layer>

      {/* Objects layer */}
      <Layer>
        {renderableObjects.map((obj) => {
          const Renderer = OBJECT_RENDERERS[obj.type] || ImageObject;
          return (
            <Renderer
              key={obj.id}
              obj={obj}
              isSelected={selectedIds.has(obj.id)}
              onSelect={handleObjectSelect(obj.id)}
              onDragEnd={onDragEnd}
              onTransformEnd={onTransformEnd}
              onUpdateObject={onUpdateObject}
              autoEdit={obj.type === 'text' && editingTextId === obj.id}
              onClearAutoEdit={onClearEditingText}
            />
          );
        })}

        {/* Transform handles */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={[
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
            'middle-left', 'middle-right', 'top-center', 'bottom-center',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            // Enforce minimum size
            if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
              return oldBox;
            }
            return newBox;
          }}
          anchorFill="#667eea"
          anchorStroke="#4c5fc7"
          anchorSize={8}
          borderStroke="#667eea"
          borderStrokeWidth={2}
          rotateAnchorOffset={25}
        />

        {/* Snap guides */}
        <SnapGuides
          guides={snapGuides}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      </Layer>
    </Stage>
  );
});

export default StudioCanvas;
