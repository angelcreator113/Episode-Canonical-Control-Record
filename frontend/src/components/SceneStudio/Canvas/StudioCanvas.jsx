import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Transformer, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';
import ImageObject from './objects/ImageObject';
import VideoObject from './objects/VideoObject';
import TextObject from './objects/TextObject';
import ShapeObject from './objects/ShapeObject';
import ParallaxLayer from './ParallaxLayer';
import MaskLayer from './MaskLayer';

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

function getCoverLayout(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  const imgRatio = imageWidth / imageHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  if (imgRatio > canvasRatio) {
    const drawHeight = canvasHeight;
    const drawWidth = canvasHeight * imgRatio;
    return {
      x: (canvasWidth - drawWidth) / 2,
      y: 0,
      width: drawWidth,
      height: drawHeight,
    };
  }

  const drawWidth = canvasWidth;
  const drawHeight = canvasWidth / imgRatio;
  return {
    x: 0,
    y: (canvasHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function BackgroundImage({ src, width, height, isSelected, onClick, onLayoutChange }) {
  // Load without crossOrigin to avoid CORS failures on S3 images
  const [image] = useImage(src);
  const [displayImage, setDisplayImage] = useState(null);

  useEffect(() => {
    if (image) {
      setDisplayImage(image);
    }
  }, [image]);

  const activeImage = displayImage || image;
  // Compute layout only when image is ready; null otherwise so hooks below are safe.
  const layout = activeImage
    ? getCoverLayout(activeImage.width, activeImage.height, width, height)
    : null;

  // These effects must be declared unconditionally (Rules of Hooks).
  // Guard logic is handled inside the effect bodies.
  useEffect(() => {
    if (!onLayoutChange || !activeImage || !layout) return undefined;

    onLayoutChange({
      sourceWidth: activeImage.width,
      sourceHeight: activeImage.height,
      drawX: layout.x,
      drawY: layout.y,
      drawWidth: layout.width,
      drawHeight: layout.height,
    });

    return undefined;
  }, [activeImage, layout, onLayoutChange]);

  useEffect(() => {
    if (!onLayoutChange) return undefined;
    return () => onLayoutChange(null);
  }, [onLayoutChange]);

  if (!activeImage || !layout) return null;

  return (
    <>
      <KonvaImage
        image={activeImage}
        x={layout.x}
        y={layout.y}
        width={layout.width}
        height={layout.height}
        listening={true}
        onClick={(e) => {
          e.cancelBubble = true;
          if (onClick) onClick();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          if (onClick) onClick();
        }}
      />
      {isSelected && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke="#667eea"
          strokeWidth={3}
          dash={[8, 4]}
          listening={false}
        />
      )}
    </>
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
  backgroundSelected,
  onBackgroundSelect,
  onBackgroundLayoutChange,
  depthMapUrl,
  depthEffects,
  brushSize,
  onMaskChange,
}, forwardedRef) {
  const stageRef = useRef(null);

  // Expose stage ref to parent for export
  React.useImperativeHandle(forwardedRef, () => stageRef.current, []);
  const transformerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });

  // Drag selection box
  const [selectionBox, setSelectionBox] = useState(null); // { x1, y1, x2, y2 }
  const isSelecting = useRef(false);

  // Snap guides
  const [activeGuides, setActiveGuides] = useState([]);

  const parallaxEnabled = depthEffects?.parallaxEnabled && depthMapUrl;

  // Mouse tracking for parallax
  const handleMouseMove = useCallback((e) => {
    if (!parallaxEnabled) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (pointer) {
      setMousePosition({
        x: pointer.x / stageSize.width,
        y: pointer.y / stageSize.height,
      });
    }
  }, [parallaxEnabled, stageSize.width, stageSize.height]);

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

  // Handle click on stage background (deselect) — skip when erase tool active
  const handleStageClick = useCallback((e) => {
    if (activeTool === 'erase') return; // Don't deselect while erasing
    if (e.target === e.target.getStage() || e.target.name() === 'canvas-bg') {
      if (onDeselect) onDeselect();
    }
  }, [onDeselect, activeTool]);

  // Drag selection box — click and drag on empty canvas to select multiple objects
  const handleStageMouseDown = useCallback((e) => {
    if (activeTool !== 'select') return;
    // Only start selection on stage/bg click, not on objects
    if (e.target !== e.target.getStage() && e.target.name() !== 'canvas-bg') return;
    const stage = e.target.getStage();
    const pos = stage.getAbsoluteTransform().copy().invert().point(stage.getPointerPosition());
    isSelecting.current = true;
    setSelectionBox({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
  }, [activeTool]);

  const handleStageMouseMove2 = useCallback((e) => {
    if (!isSelecting.current || !selectionBox) return;
    const stage = e.target.getStage();
    const pos = stage.getAbsoluteTransform().copy().invert().point(stage.getPointerPosition());
    setSelectionBox((prev) => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
  }, [selectionBox]);

  const handleStageMouseUp = useCallback(() => {
    if (!isSelecting.current || !selectionBox) {
      isSelecting.current = false;
      setSelectionBox(null);
      return;
    }
    isSelecting.current = false;
    // Find objects within the selection box
    const x1 = Math.min(selectionBox.x1, selectionBox.x2);
    const y1 = Math.min(selectionBox.y1, selectionBox.y2);
    const x2 = Math.max(selectionBox.x1, selectionBox.x2);
    const y2 = Math.max(selectionBox.y1, selectionBox.y2);
    const boxW = x2 - x1;
    const boxH = y2 - y1;

    // Only select if box is big enough (avoid click-as-select)
    if (boxW > 10 && boxH > 10 && onSelect) {
      objects.forEach((obj) => {
        const ox = obj.x || 0;
        const oy = obj.y || 0;
        const ow = obj.width || 0;
        const oh = obj.height || 0;
        // Check if object intersects selection box
        if (ox < x2 && ox + ow > x1 && oy < y2 && oy + oh > y1) {
          onSelect(obj.id, true); // true = add to selection
        }
      });
    }
    setSelectionBox(null);
  }, [selectionBox, objects, onSelect]);

  // Compute snap guides during drag
  const SNAP_THRESHOLD = 8;
  const handleObjectDragMove = useCallback((e) => {
    const node = e.target;
    const guides = [];
    const nodeX = node.x();
    const nodeY = node.y();
    const nodeW = node.width() * Math.abs(node.scaleX());
    const nodeH = node.height() * Math.abs(node.scaleY());
    const nodeCX = nodeX + nodeW / 2;
    const nodeCY = nodeY + nodeH / 2;

    // Canvas center guides
    const canvasCX = canvasWidth / 2;
    const canvasCY = canvasHeight / 2;
    if (Math.abs(nodeCX - canvasCX) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'vertical', position: canvasCX });
      node.x(canvasCX - nodeW / 2);
    }
    if (Math.abs(nodeCY - canvasCY) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'horizontal', position: canvasCY });
      node.y(canvasCY - nodeH / 2);
    }
    // Canvas edge guides
    if (Math.abs(nodeX) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'vertical', position: 0 });
      node.x(0);
    }
    if (Math.abs(nodeY) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'horizontal', position: 0 });
      node.y(0);
    }
    if (Math.abs(nodeX + nodeW - canvasWidth) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'vertical', position: canvasWidth });
      node.x(canvasWidth - nodeW);
    }
    if (Math.abs(nodeY + nodeH - canvasHeight) < SNAP_THRESHOLD) {
      guides.push({ orientation: 'horizontal', position: canvasHeight });
      node.y(canvasHeight - nodeH);
    }

    setActiveGuides(guides);
  }, [canvasWidth, canvasHeight]);

  const handleObjectDragEnd = useCallback((id, changes) => {
    setActiveGuides([]); // Clear guides
    if (onDragEnd) onDragEnd(id, changes);
  }, [onDragEnd]);

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

  // Filter to only active variants (if part of a variant group), but keep selected objects
  const renderableObjects = visibleObjects.filter(
    (obj) => !obj.variantGroupId || obj.isActiveVariant || selectedIds.has(obj.id)
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
      onMouseMove={(e) => { handleMouseMove(e); handleStageMouseMove2(e); }}
      onMouseDown={handleStageMouseDown}
      onMouseUp={handleStageMouseUp}
      draggable={activeTool === 'hand'}
      onDragEnd={(e) => {
        if (activeTool === 'hand' && onPan) {
          onPan(e.target.x(), e.target.y());
        }
      }}
      style={{ cursor: activeTool === 'hand' ? 'grab' : activeTool === 'erase' ? 'crosshair' : 'default' }}
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
        {backgroundUrl && parallaxEnabled ? (
          <ParallaxLayer
            bgSrc={backgroundUrl}
            depthMapSrc={depthMapUrl}
            width={canvasWidth}
            height={canvasHeight}
            isSelected={backgroundSelected}
            onClick={onBackgroundSelect}
            mousePosition={mousePosition}
            depthEffects={depthEffects}
            onLayoutChange={onBackgroundLayoutChange}
          />
        ) : backgroundUrl ? (
          <BackgroundImage
            src={backgroundUrl}
            width={canvasWidth}
            height={canvasHeight}
            isSelected={backgroundSelected}
            onClick={onBackgroundSelect}
            onLayoutChange={onBackgroundLayoutChange}
          />
        ) : null}
        {backgroundSelected && parallaxEnabled && (
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            stroke="#667eea"
            strokeWidth={3}
            dash={[8, 4]}
            listening={false}
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

      {/* Objects layer — disabled when erase tool is active */}
      <Layer listening={activeTool !== 'erase'}>
        {renderableObjects.map((obj) => {
          const Renderer = OBJECT_RENDERERS[obj.type] || ImageObject;
          return (
            <Renderer
              key={obj.id}
              obj={obj}
              isSelected={selectedIds.has(obj.id)}
              onSelect={handleObjectSelect(obj.id)}
              onDragMove={handleObjectDragMove}
              onDragEnd={handleObjectDragEnd}
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

        {/* Canvas center snap guides — shown when dragging near center */}
        {activeGuides.map((guide, i) => (
          <Line
            key={`snap-${i}`}
            points={guide.orientation === 'vertical'
              ? [guide.position, 0, guide.position, canvasHeight]
              : [0, guide.position, canvasWidth, guide.position]
            }
            stroke="rgba(184, 150, 46, 0.5)"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ))}

        {/* Drag selection box */}
        {selectionBox && (
          <Rect
            x={Math.min(selectionBox.x1, selectionBox.x2)}
            y={Math.min(selectionBox.y1, selectionBox.y2)}
            width={Math.abs(selectionBox.x2 - selectionBox.x1)}
            height={Math.abs(selectionBox.y2 - selectionBox.y1)}
            fill="rgba(102, 126, 234, 0.1)"
            stroke="#667eea"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        )}
      </Layer>

      {/* Mask layer for erase/inpaint tool — always rendered to preserve strokes, on top of everything */}
      <Layer listening={activeTool === 'erase'}>
        <MaskLayer
          active={activeTool === 'erase'}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          brushSize={brushSize || 30}
          onMaskChange={onMaskChange}
          stageRef={stageRef}
        />
      </Layer>
    </Stage>
  );
});

export default StudioCanvas;
