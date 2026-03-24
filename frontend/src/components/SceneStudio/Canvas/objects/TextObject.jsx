import React, { useRef, useEffect } from 'react';
import { Text } from 'react-konva';

/**
 * TextObject — Renders editable text on the Konva canvas.
 * Double-click to edit via a temporary HTML input overlay.
 */
export default function TextObject({ obj, isSelected, onSelect, onTransformEnd, onDragEnd, onUpdateObject }) {
  const textRef = useRef(null);

  if (!obj.isVisible && !isSelected) return null;

  const style = obj.styleData || {};

  const handleDblClick = () => {
    if (obj.isLocked || !onUpdateObject) return;

    const textNode = textRef.current;
    if (!textNode) return;

    const stage = textNode.getStage();
    const stageContainer = stage.container();
    const textPosition = textNode.getAbsolutePosition();

    // Create a temporary textarea over the text
    const textarea = document.createElement('textarea');
    stageContainer.parentNode.appendChild(textarea);

    textarea.value = style.textContent || '';
    textarea.style.position = 'absolute';
    textarea.style.top = `${textPosition.y}px`;
    textarea.style.left = `${textPosition.x}px`;
    textarea.style.width = `${(obj.width || 200)}px`;
    textarea.style.height = `${(obj.height || 40)}px`;
    textarea.style.fontSize = `${style.fontSize || 18}px`;
    textarea.style.fontFamily = style.fontFamily || 'Lora, serif';
    textarea.style.color = style.fill || '#FFFFFF';
    textarea.style.background = 'rgba(0,0,0,0.8)';
    textarea.style.border = '2px solid #667eea';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '4px';
    textarea.style.zIndex = '10000';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.focus();

    const finish = () => {
      onUpdateObject(obj.id, {
        styleData: { ...style, textContent: textarea.value },
      });
      textarea.remove();
    };

    textarea.addEventListener('blur', finish);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        textarea.blur();
      }
    });
  };

  return (
    <Text
      ref={textRef}
      id={obj.id}
      name="studio-object"
      text={style.textContent || 'Double-click to edit'}
      x={obj.x || 0}
      y={obj.y || 0}
      width={obj.width || 200}
      height={obj.height || undefined}
      rotation={obj.rotation || 0}
      fontSize={style.fontSize || 18}
      fontFamily={style.fontFamily || 'Lora, serif'}
      fontStyle={style.fontStyle || 'normal'}
      fill={style.fill || '#FFFFFF'}
      stroke={style.stroke || undefined}
      strokeWidth={style.strokeWidth || 0}
      align={style.align || 'left'}
      verticalAlign={style.verticalAlign || 'top'}
      opacity={obj.opacity != null ? obj.opacity : 1}
      draggable={!obj.isLocked}
      listening={!obj.isLocked}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
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
            rotation: node.rotation(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }
      }}
    />
  );
}
