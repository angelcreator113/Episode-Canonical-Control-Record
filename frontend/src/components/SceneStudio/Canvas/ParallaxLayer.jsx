import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

/**
 * ParallaxLayer — Depth-aware parallax background renderer.
 *
 * Splits the background image into depth-based layers using the depth map,
 * and offsets each layer based on mouse position to create a 3D parallax effect.
 *
 * The depth map is a grayscale image where:
 *   - White (255) = closest to camera (moves most)
 *   - Black (0) = farthest from camera (moves least)
 *
 * Layers are created by thresholding the depth map into N bands.
 * Each band is rendered with a different offset based on mouse position.
 */

const NUM_LAYERS = 5;
const MAX_OFFSET = 20; // max pixel displacement at edges

/**
 * Generate layer masks from a depth map image.
 * Returns an array of ImageData objects representing each depth layer.
 */
function generateLayerMasks(depthImage, bgImage, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw depth map and extract pixel data
  ctx.drawImage(depthImage, 0, 0, width, height);
  const depthData = ctx.getImageData(0, 0, width, height);

  // Draw background image
  ctx.drawImage(bgImage, 0, 0, width, height);
  const bgData = ctx.getImageData(0, 0, width, height);

  const layers = [];
  const bandSize = 256 / NUM_LAYERS;

  for (let layer = 0; layer < NUM_LAYERS; layer++) {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = width;
    layerCanvas.height = height;
    const layerCtx = layerCanvas.getContext('2d');
    const layerImageData = layerCtx.createImageData(width, height);

    const minDepth = layer * bandSize;
    const maxDepth = (layer + 1) * bandSize;

    for (let i = 0; i < depthData.data.length; i += 4) {
      const depthValue = depthData.data[i]; // red channel = grayscale depth

      if (depthValue >= minDepth && depthValue < maxDepth) {
        layerImageData.data[i] = bgData.data[i];       // R
        layerImageData.data[i + 1] = bgData.data[i + 1]; // G
        layerImageData.data[i + 2] = bgData.data[i + 2]; // B
        layerImageData.data[i + 3] = 255;                 // A
      } else {
        layerImageData.data[i + 3] = 0; // transparent
      }
    }

    layerCtx.putImageData(layerImageData, 0, 0);
    layers.push(layerCanvas);
  }

  return layers;
}

export default function ParallaxLayer({
  bgSrc,
  depthMapSrc,
  width,
  height,
  isSelected,
  onClick,
  mousePosition, // { x: 0-1, y: 0-1 } normalized
}) {
  const [bgImage] = useImage(bgSrc);
  const [depthImage] = useImage(depthMapSrc);
  const [layerCanvases, setLayerCanvases] = useState([]);
  const processedRef = useRef(null);

  // Generate layer masks when images load
  useEffect(() => {
    if (!bgImage || !depthImage) return;

    const key = `${bgSrc}-${depthMapSrc}-${width}-${height}`;
    if (processedRef.current === key) return;

    try {
      const layers = generateLayerMasks(depthImage, bgImage, width, height);
      setLayerCanvases(layers);
      processedRef.current = key;
    } catch (err) {
      console.error('[ParallaxLayer] Failed to generate layers:', err);
    }
  }, [bgImage, depthImage, bgSrc, depthMapSrc, width, height]);

  // Fallback: if no layers yet, just render the background image
  if (!layerCanvases.length) {
    if (!bgImage) return null;

    // Cover fit (same logic as BackgroundImage)
    const imgRatio = bgImage.width / bgImage.height;
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
        image={bgImage}
        x={drawX}
        y={drawY}
        width={drawW}
        height={drawH}
        listening={true}
        onClick={(e) => { e.cancelBubble = true; onClick?.(); }}
        onTap={(e) => { e.cancelBubble = true; onClick?.(); }}
      />
    );
  }

  // Compute per-layer offsets based on mouse position
  const mx = (mousePosition?.x ?? 0.5) - 0.5; // -0.5 to 0.5
  const my = (mousePosition?.y ?? 0.5) - 0.5;

  return (
    <>
      {layerCanvases.map((canvas, i) => {
        // Layer 0 = farthest (least movement), Layer N-1 = closest (most movement)
        const depthFactor = i / (NUM_LAYERS - 1);
        const offsetX = mx * MAX_OFFSET * depthFactor;
        const offsetY = my * MAX_OFFSET * depthFactor;

        return (
          <KonvaImage
            key={`parallax-layer-${i}`}
            image={canvas}
            x={offsetX}
            y={offsetY}
            width={width}
            height={height}
            listening={i === NUM_LAYERS - 1} // only topmost layer captures clicks
            onClick={(e) => {
              if (i === NUM_LAYERS - 1) {
                e.cancelBubble = true;
                onClick?.();
              }
            }}
            onTap={(e) => {
              if (i === NUM_LAYERS - 1) {
                e.cancelBubble = true;
                onClick?.();
              }
            }}
          />
        );
      })}
    </>
  );
}
