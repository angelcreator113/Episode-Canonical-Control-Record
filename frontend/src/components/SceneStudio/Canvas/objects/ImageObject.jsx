import React, { useRef, useEffect } from 'react';
import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';

/**
 * ImageObject — Renders an image asset on the Konva canvas.
 * Handles loading, scaling, flip, crop, and visual effects
 * (shadow, blur, brightness) from styleData.
 *
 * Uses a Group with a transparent Rect hit region so the object is always
 * clickable, draggable, and selectable — even while the image is loading.
 */
export default function ImageObject({ obj, isSelected, onSelect, onTransformEnd, onDragEnd }) {
  const src = obj.assetUrl || '';
  const [image, imageStatus] = useImage(src);
  const imageRef = useRef(null);

  if (!obj.isVisible && !isSelected) return null;

  const w = obj.width || 200;
  const h = obj.height || 200;
  const scaleX = (obj.flipX ? -1 : 1) * (obj.scaleX || 1);
  const scaleY = (obj.flipY ? -1 : 1) * (obj.scaleY || 1);
  const style = obj.styleData || {};

  // Build Konva filters array based on styleData
  const filters = [];
  if (style.blur > 0) filters.push(Konva.Filters.Blur);
  if (style.brightness != null && style.brightness !== 100) filters.push(Konva.Filters.Brighten);

  // Apply filters when image or style changes
  useEffect(() => {
    if (imageRef.current && image) {
      imageRef.current.cache();
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [image, style.blur, style.brightness, style.shadow?.enabled]);

  // Shadow props from styleData
  const shadowProps = style.shadow?.enabled ? {
    shadowColor: style.shadow.color || 'rgba(0,0,0,0.3)',
    shadowBlur: style.shadow.blur || 8,
    shadowOffsetX: style.shadow.offsetX || 4,
    shadowOffsetY: style.shadow.offsetY || 4,
    shadowEnabled: true,
  } : {};

  // Blend mode via CSS globalCompositeOperation
  const blendMode = style.blendMode && style.blendMode !== 'normal'
    ? style.blendMode : undefined;

  return (
    <Group
      id={obj.id}
      name="studio-object"
      x={obj.x || 0}
      y={obj.y || 0}
      width={w}
      height={h}
      rotation={obj.rotation || 0}
      scaleX={scaleX}
      scaleY={scaleY}
      opacity={obj.opacity != null ? obj.opacity : 1}
      offsetX={obj.flipX ? w : 0}
      offsetY={obj.flipY ? h : 0}
      draggable={!obj.isLocked}
      listening={!obj.isLocked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        if (onDragEnd) {
          onDragEnd(obj.id, { x: e.target.x(), y: e.target.y() });
        }
      }}
      onTransformEnd={(e) => {
        if (onTransformEnd) {
          const node = e.target;
          onTransformEnd(obj.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(20, node.width() * Math.abs(node.scaleX())),
            height: Math.max(20, node.height() * Math.abs(node.scaleY())),
            rotation: node.rotation(),
          });
          node.scaleX(obj.flipX ? -1 : 1);
          node.scaleY(obj.flipY ? -1 : 1);
        }
      }}
    >
      {/* Hit region — always clickable even if image hasn't loaded */}
      <Rect width={w} height={h} fill="transparent" />

      {image ? (
        <KonvaImage
          ref={imageRef}
          image={image}
          width={w}
          height={h}
          listening={false}
          filters={filters.length > 0 ? filters : undefined}
          blurRadius={style.blur || 0}
          brightness={style.brightness != null ? (style.brightness - 100) / 100 : 0}
          globalCompositeOperation={blendMode}
          {...shadowProps}
          {...(obj.cropData ? {
            crop: {
              x: obj.cropData.x || 0,
              y: obj.cropData.y || 0,
              width: obj.cropData.width || w,
              height: obj.cropData.height || h,
            },
          } : {})}
        />
      ) : (
        <>
          <Rect
            width={w}
            height={h}
            fill={imageStatus === 'failed' ? 'rgba(220,53,53,0.08)' : 'rgba(184,150,46,0.06)'}
            stroke={imageStatus === 'failed' ? 'rgba(220,53,53,0.3)' : 'rgba(184,150,46,0.2)'}
            strokeWidth={1}
            dash={[4, 4]}
          />
          <Text
            text={imageStatus === 'failed' ? 'Image failed' : 'Loading...'}
            x={0}
            y={h / 2 - 6}
            width={w}
            align="center"
            fontSize={11}
            fontFamily="DM Mono, monospace"
            fill={imageStatus === 'failed' ? '#dc3535' : '#999'}
          />
        </>
      )}
    </Group>
  );
}
