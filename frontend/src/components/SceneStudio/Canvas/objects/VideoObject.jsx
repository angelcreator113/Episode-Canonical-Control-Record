import React, { useRef, useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';

/**
 * VideoObject — Renders a video asset on the Konva canvas.
 * Uses a hidden HTML5 <video> element and draws frames to Konva Image.
 */
export default function VideoObject({ obj, isSelected, onSelect, onTransformEnd, onDragEnd }) {
  const videoRef = useRef(null);
  const [videoElement, setVideoElement] = useState(null);
  const animFrameRef = useRef(null);
  const imageRef = useRef(null);

  const src = obj.assetUrl || '';

  useEffect(() => {
    if (!src) return;

    const video = document.createElement('video');
    video.src = src;
    // Skip crossOrigin to avoid CORS failures on S3 videos
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    videoRef.current = video;

    video.addEventListener('loadeddata', () => {
      setVideoElement(video);
      video.play().catch(() => {});
    });

    return () => {
      video.pause();
      video.src = '';
      videoRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [src]);

  // Animation loop to redraw video frames
  useEffect(() => {
    if (!videoElement) return;

    let running = true;
    const animate = () => {
      if (!running) return;
      if (imageRef.current) {
        imageRef.current.getLayer()?.batchDraw();
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [videoElement]);

  if (!obj.isVisible && !isSelected) return null;

  return (
    <KonvaImage
      ref={imageRef}
      id={obj.id}
      name="studio-object"
      image={videoElement}
      x={obj.x || 0}
      y={obj.y || 0}
      width={obj.width || 320}
      height={obj.height || 180}
      rotation={obj.rotation || 0}
      scaleX={(obj.flipX ? -1 : 1) * (obj.scaleX || 1)}
      scaleY={(obj.flipY ? -1 : 1) * (obj.scaleY || 1)}
      opacity={obj.opacity != null ? obj.opacity : 1}
      offsetX={obj.flipX ? (obj.width || 320) : 0}
      offsetY={obj.flipY ? (obj.height || 180) : 0}
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
    />
  );
}
