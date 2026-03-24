import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

/**
 * ImageObject — Renders an image asset on the Konva canvas.
 * Handles loading, scaling, flip, and crop.
 */
export default function ImageObject({ obj, isSelected, onSelect, onTransformEnd, onDragEnd }) {
  const src = obj.assetUrl || '';
  const [image] = useImage(src, 'anonymous');

  if (!obj.isVisible && !isSelected) return null;

  const scaleX = (obj.flipX ? -1 : 1) * (obj.scaleX || 1);
  const scaleY = (obj.flipY ? -1 : 1) * (obj.scaleY || 1);

  return (
    <KonvaImage
      id={obj.id}
      name="studio-object"
      image={image}
      x={obj.x || 0}
      y={obj.y || 0}
      width={obj.width || 200}
      height={obj.height || 200}
      rotation={obj.rotation || 0}
      scaleX={scaleX}
      scaleY={scaleY}
      opacity={obj.opacity != null ? obj.opacity : 1}
      offsetX={obj.flipX ? (obj.width || 200) : 0}
      offsetY={obj.flipY ? (obj.height || 200) : 0}
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
          // Reset scale after applying to width/height
          node.scaleX(obj.flipX ? -1 : 1);
          node.scaleY(obj.flipY ? -1 : 1);
        }
      }}
      // Crop support
      {...(obj.cropData ? {
        crop: {
          x: obj.cropData.x || 0,
          y: obj.cropData.y || 0,
          width: obj.cropData.width || (obj.width || 200),
          height: obj.cropData.height || (obj.height || 200),
        },
      } : {})}
    />
  );
}
