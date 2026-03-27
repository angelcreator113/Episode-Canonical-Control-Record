import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
} from 'react';
import {
  Stage,
  Layer,
  Rect,
  Transformer,
  Image as KonvaImage,
  Line,
} from 'react-konva';
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
 * zoom/pan, mask painting, and background image/parallax.
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

function BackgroundImage({
  src,
  width,
  height,
  isSelected,
  onClick,
  onLayoutChange,
}) {
  // Load without crossOrigin to avoid CORS failures on S3 images
  const [image] = useImage(src);
  const [displayImage, setDisplayImage] = useState(null);

  useEffect(() => {
    if (image) {
      setDisplayImage(image);
    }
  }, [image]);

  const activeImage = displayImage || image;

  const imgW = activeImage ? activeImage.width : 0;
  const imgH = activeImage ? activeImage.height : 0;
  const layout = activeImage ? getCoverLayout(imgW, imgH, width, height) : null;

  const layoutX = layout ? layout.x : 0;
  const layoutY = layout ? layout.y : 0;
  const layoutW = layout ? layout.width : 0;
  const layoutH = layout ? layout.height : 0;

  useEffect(() => {
    if (!onLayoutChange || !activeImage || !layout) return;

    onLayoutChange({
      sourceWidth: imgW,
      sourceHeight: imgH,
      drawX: layoutX,
      drawY: layoutY,
      drawWidth: layoutW,
      drawHeight: layoutH,
    });
  }, [imgW, imgH, layoutX, layoutY, layoutW, layoutH, onLayoutChange, activeImage]);

  useEffect(() => {
    return () => {
      onLayoutChange?.(null);
    };
  }, [onLayoutChange]);

  if (!activeImage || !layout) return null;


  return (
    <>
      <KonvaImage
        image={activeImage}
        x={layoutX}
        y={layoutY}
        width={layoutW}
        height={layoutH}
        listening
        onClick={(e) => {
          e.cancelBubble = true;
          onClick?.();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onClick?.();
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

function SnapGuides({ guides, canvasWidth, canvasHeight, stroke = '#FFD700' }) {
  if (!guides || guides.length === 0) return null;

  return guides.map((guide, i) => {
    if (guide.orientation === 'vertical') {
      return (
        <Line
          key={`guide-${i}`}
          points={[guide.position, 0, guide.position, canvasHeight]}
          stroke={stroke}
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
        stroke={stroke}
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    );
  });
}

const StudioCanvas = React.forwardRef(function StudioCanvas(props, forwardedRef) {
  const {
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
    maskMode,
    onMaskChange,
  } = props;

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const maskLayerRef = useRef(null);

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });

  const [selectionBox, setSelectionBox] = useState(null);
  const isSelecting = useRef(false);

  const [localDragGuides, setLocalDragGuides] = useState([]);

  const parallaxEnabled = Boolean(depthEffects?.parallaxEnabled && depthMapUrl);

  useImperativeHandle(
    forwardedRef,
    () => ({
      getStage: () => stageRef.current,
      exportImage: (pixelRatio = 2) => {
        const stage = stageRef.current;
        if (!stage) return null;
        return stage.toDataURL({ pixelRatio });
      },
      exportMask: (options) => maskLayerRef.current?.exportMask(options),
      clearMask: () => maskLayerRef.current?.clearMask(),
      hasMask: () => maskLayerRef.current?.hasMask?.() || false,
    }),
    []
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!parallaxEnabled) return;
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer || !stageSize.width || !stageSize.height) return;

      setMousePosition({
        x: pointer.x / stageSize.width,
        y: pointer.y / stageSize.height,
      });
    },
    [parallaxEnabled, stageSize.width, stageSize.height]
  );

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef?.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setStageSize({
        width: clientWidth || 800,
        height: clientHeight || 600,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [containerRef]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    const selectedNodes = [];
    if (selectedIds?.size > 0) {
      selectedIds.forEach((id) => {
        const node = stage.findOne(`#${id}`);
        if (node) selectedNodes.push(node);
      });
    }

    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, objects]);

  const handleStageClick = useCallback(
    (e) => {
      if (activeTool === 'erase') return;

      const isStage = e.target === e.target.getStage();
      const isCanvasBg = e.target.name && e.target.name() === 'canvas-bg';

      if (isStage || isCanvasBg) {
        onDeselect?.();
      }
    },
    [onDeselect, activeTool]
  );

  const getCanvasPoint = useCallback((stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pointer);
  }, []);

  const handleStageMouseDown = useCallback(
    (e) => {
      if (activeTool !== 'select') return;

      const isStage = e.target === e.target.getStage();
      const isCanvasBg = e.target.name && e.target.name() === 'canvas-bg';
      if (!isStage && !isCanvasBg) return;

      const stage = e.target.getStage();
      const pos = getCanvasPoint(stage);
      if (!pos) return;

      isSelecting.current = true;
      setSelectionBox({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    },
    [activeTool, getCanvasPoint]
  );

  const handleStageMouseMoveSelection = useCallback(
    (e) => {
      if (!isSelecting.current || !selectionBox) return;
      const stage = e.target.getStage();
      const pos = getCanvasPoint(stage);
      if (!pos) return;

      setSelectionBox((prev) =>
        prev ? { ...prev, x2: pos.x, y2: pos.y } : null
      );
    },
    [selectionBox, getCanvasPoint]
  );

  const handleStageMouseUp = useCallback(() => {
    if (!isSelecting.current || !selectionBox) {
      isSelecting.current = false;
      setSelectionBox(null);
      return;
    }

    isSelecting.current = false;

    const x1 = Math.min(selectionBox.x1, selectionBox.x2);
    const y1 = Math.min(selectionBox.y1, selectionBox.y2);
    const x2 = Math.max(selectionBox.x1, selectionBox.x2);
    const y2 = Math.max(selectionBox.y1, selectionBox.y2);

    const boxW = x2 - x1;
    const boxH = y2 - y1;

    if (boxW > 10 && boxH > 10 && onSelect) {
      objects.forEach((obj) => {
        const ox = obj.x || 0;
        const oy = obj.y || 0;
        const ow = obj.width || 0;
        const oh = obj.height || 0;

        const intersects =
          ox < x2 && ox + ow > x1 && oy < y2 && oy + oh > y1;

        if (intersects) {
          onSelect(obj.id, true);
        }
      });
    }

    setSelectionBox(null);
  }, [selectionBox, objects, onSelect]);

  const SNAP_THRESHOLD = 8;
  const GRID_SIZE = 100;

  const handleObjectDragMove = useCallback(
    (e) => {
      const node = e.target;
      const guides = [];

      const nodeX = node.x();
      const nodeY = node.y();
      const nodeW = node.width() * Math.abs(node.scaleX());
      const nodeH = node.height() * Math.abs(node.scaleY());
      const nodeCX = nodeX + nodeW / 2;
      const nodeCY = nodeY + nodeH / 2;

      const canvasCX = canvasWidth / 2;
      const canvasCY = canvasHeight / 2;

      // Snap to canvas center
      if (Math.abs(nodeCX - canvasCX) < SNAP_THRESHOLD) {
        guides.push({ orientation: 'vertical', position: canvasCX });
        node.x(canvasCX - nodeW / 2);
      }

      if (Math.abs(nodeCY - canvasCY) < SNAP_THRESHOLD) {
        guides.push({ orientation: 'horizontal', position: canvasCY });
        node.y(canvasCY - nodeH / 2);
      }

      // Snap to canvas edges
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

      // Snap to grid lines when grid is visible
      if (gridVisible) {
        const updatedX = node.x();
        const updatedY = node.y();

        // Snap left edge to nearest grid line
        const nearestGridX = Math.round(updatedX / GRID_SIZE) * GRID_SIZE;
        if (Math.abs(updatedX - nearestGridX) < SNAP_THRESHOLD) {
          node.x(nearestGridX);
          guides.push({ orientation: 'vertical', position: nearestGridX });
        }

        // Snap top edge to nearest grid line
        const nearestGridY = Math.round(updatedY / GRID_SIZE) * GRID_SIZE;
        if (Math.abs(updatedY - nearestGridY) < SNAP_THRESHOLD) {
          node.y(nearestGridY);
          guides.push({ orientation: 'horizontal', position: nearestGridY });
        }
      }

      setLocalDragGuides(guides);
    },
    [canvasWidth, canvasHeight, gridVisible]
  );

  const handleObjectDragEnd = useCallback(
    (id, changes) => {
      setLocalDragGuides([]);
      onDragEnd?.(id, changes);
    },
    [onDragEnd]
  );

  const handleObjectSelect = useCallback(
    (objId) => (e) => {
      e.cancelBubble = true;
      const shiftKey = e.evt?.shiftKey || false;
      onSelect?.(objId, shiftKey);
    },
    [onSelect]
  );

  const handleWheel = useCallback(
    (e) => {
      e.evt.preventDefault();
      if (!onZoom) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const oldScale = zoom;
      const newScale =
        e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const clampedScale = Math.max(0.1, Math.min(5, newScale));

      const mousePointTo = {
        x: (pointer.x - panX) / oldScale,
        y: (pointer.y - panY) / oldScale,
      };

      onZoom(clampedScale, {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
    },
    [zoom, panX, panY, onZoom]
  );

  const sortedObjects = [...objects].sort(
    (a, b) => (a.layerOrder || 0) - (b.layerOrder || 0)
  );

  const visibleObjects = sortedObjects.filter(
    (obj) => obj.isVisible || selectedIds.has(obj.id)
  );

  const renderableObjects = visibleObjects.filter(
    (obj) => !obj.variantGroupId || obj.isActiveVariant || selectedIds.has(obj.id)
  );

  const allGuides = [
    ...(snapGuides || []),
    ...localDragGuides,
  ];

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
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleStageMouseMoveSelection(e);
      }}
      onMouseDown={handleStageMouseDown}
      onMouseUp={handleStageMouseUp}
      draggable={activeTool === 'hand'}
      onDragEnd={(e) => {
        if (activeTool === 'hand') {
          onPan?.(e.target.x(), e.target.y());
        }
      }}
      style={{
        cursor:
          activeTool === 'hand'
            ? 'grab'
            : activeTool === 'erase'
              ? 'crosshair'
              : 'default',
      }}
    >
      <Layer>
        <Rect
          name="canvas-bg"
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill="#1a1a2e"
          listening
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

        {gridVisible &&
          Array.from({ length: Math.floor(canvasWidth / 100) }, (_, i) => (
            <Line
              key={`grid-v-${i}`}
              points={[(i + 1) * 100, 0, (i + 1) * 100, canvasHeight]}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              listening={false}
            />
          ))}

        {gridVisible &&
          Array.from({ length: Math.floor(canvasHeight / 100) }, (_, i) => (
            <Line
              key={`grid-h-${i}`}
              points={[0, (i + 1) * 100, canvasWidth, (i + 1) * 100]}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              listening={false}
            />
          ))}
      </Layer>

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

        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
            'top-center',
            'bottom-center',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
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

        <SnapGuides
          guides={allGuides}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          stroke="rgba(184, 150, 46, 0.5)"
        />

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

      <Layer listening={activeTool === 'erase'}>
        <MaskLayer
          ref={maskLayerRef}
          active={activeTool === 'erase'}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          brushSize={brushSize || 30}
          onMaskChange={onMaskChange}
          mode={maskMode}
        />
      </Layer>
    </Stage>
  );
});

export default StudioCanvas;