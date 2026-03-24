import React from 'react';
import { Rect, Circle, Line, RegularPolygon } from 'react-konva';

/**
 * ShapeObject — Renders a shape (rectangle, circle, or line) on the Konva canvas.
 */
export default function ShapeObject({ obj, isSelected, onSelect, onTransformEnd, onDragEnd }) {
  if (!obj.isVisible && !isSelected) return null;

  const style = obj.styleData || {};
  const shapeType = style.shapeType || 'rect';

  const commonProps = {
    id: obj.id,
    name: 'studio-object',
    x: obj.x || 0,
    y: obj.y || 0,
    rotation: obj.rotation || 0,
    opacity: obj.opacity != null ? obj.opacity : 1,
    fill: style.fill || 'rgba(102, 126, 234, 0.3)',
    stroke: style.stroke || '#667eea',
    strokeWidth: style.strokeWidth || 2,
    draggable: !obj.isLocked,
    listening: !obj.isLocked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e) => {
      if (onDragEnd) {
        onDragEnd(obj.id, { x: e.target.x(), y: e.target.y() });
      }
    },
    onTransformEnd: (e) => {
      if (onTransformEnd) {
        const node = e.target;
        onTransformEnd(obj.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * Math.abs(node.scaleX())),
          height: Math.max(20, node.height() * Math.abs(node.scaleY())),
          rotation: node.rotation(),
        });
        node.scaleX(1);
        node.scaleY(1);
      }
    },
  };

  if (shapeType === 'circle') {
    const radius = Math.min(obj.width || 100, obj.height || 100) / 2;
    return (
      <Circle
        {...commonProps}
        radius={radius}
        offsetX={0}
        offsetY={0}
      />
    );
  }

  if (shapeType === 'star') {
    const radius = Math.min(obj.width || 150, obj.height || 150) / 2;
    return (
      <RegularPolygon
        {...commonProps}
        sides={style.numPoints || 5}
        radius={radius}
        innerRadius={style.innerRadius ? (radius * style.innerRadius / 100) : radius * 0.4}
      />
    );
  }

  if (shapeType === 'triangle') {
    const w = obj.width || 150;
    const h = obj.height || 130;
    return (
      <Line
        {...commonProps}
        points={[w / 2, 0, w, h, 0, h]}
        closed
        tension={0}
      />
    );
  }

  if (shapeType === 'line') {
    return (
      <Line
        {...commonProps}
        points={style.points || [0, 0, obj.width || 200, 0]}
        tension={style.tension || 0}
      />
    );
  }

  // Default: rectangle
  return (
    <Rect
      {...commonProps}
      width={obj.width || 200}
      height={obj.height || 120}
      cornerRadius={style.cornerRadius || 0}
    />
  );
}
