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
 * Compute cover-fit draw parameters for an image onto a target rectangle.
 * Returns { x, y, w, h } so the image covers the entire target while
 * preserving aspect ratio (same as CSS object-fit: cover).
 */
function coverFit(imgW, imgH, targetW, targetH) {
  const imgRatio = imgW / imgH;
  const targetRatio = targetW / targetH;
  let w, h, x, y;

  if (imgRatio > targetRatio) {
    // Image is wider — fit height, crop sides
    h = targetH;
    w = targetH * imgRatio;
    x = (targetW - w) / 2;
    y = 0;
  } else {
    // Image is taller — fit width, crop top/bottom
    w = targetW;
    h = targetW / imgRatio;
    x = 0;
    y = (targetH - h) / 2;
  }

  return { x, y, w, h };
}

/**
 * Generate layer masks from a depth map image.
 * Returns an array of canvas elements representing each depth layer.
 *
 * Both the background and depth map are drawn using cover-fit so they
 * fill the canvas without stretching, matching BackgroundImage rendering.
 * Layer canvases are oversized by MAX_OFFSET on each edge so parallax
 * movement doesn't reveal empty gaps at the borders.
 */
function generateLayerMasks(depthImage, bgImage, width, height) {
  // Pad layers so parallax offset never reveals canvas edge
  const pad = MAX_OFFSET;
  const padW = width + pad * 2;
  const padH = height + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = padW;
  canvas.height = padH;
  const ctx = canvas.getContext('2d');

  // Draw depth map with cover-fit into the padded area
  const df = coverFit(depthImage.width, depthImage.height, padW, padH);
  ctx.drawImage(depthImage, df.x, df.y, df.w, df.h);
  const depthData = ctx.getImageData(0, 0, padW, padH);

  // Draw background with cover-fit into the same padded area
  const bf = coverFit(bgImage.width, bgImage.height, padW, padH);
  ctx.clearRect(0, 0, padW, padH);
  ctx.drawImage(bgImage, bf.x, bf.y, bf.w, bf.h);
  const bgData = ctx.getImageData(0, 0, padW, padH);

  const layers = [];
  const bandSize = 256 / NUM_LAYERS;

  for (let layer = 0; layer < NUM_LAYERS; layer++) {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = padW;
    layerCanvas.height = padH;
    const layerCtx = layerCanvas.getContext('2d');
    const layerImageData = layerCtx.createImageData(padW, padH);

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

/**
 * Apply CSS blur to a layer canvas and return a new blurred canvas.
 * Uses CanvasRenderingContext2D.filter for GPU-accelerated blur.
 */
function applyBlurToCanvas(sourceCanvas, blurRadius) {
  if (blurRadius <= 0) return sourceCanvas;

  const blurred = document.createElement('canvas');
  blurred.width = sourceCanvas.width;
  blurred.height = sourceCanvas.height;
  const ctx = blurred.getContext('2d');
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(sourceCanvas, 0, 0);
  return blurred;
}

/**
 * Compute per-layer blur amounts based on focus depth and blur intensity.
 *
 * focusDepth: 0–100 (maps to layer index space)
 * blurIntensity: 0–20 (max blur in px)
 *
 * Returns an array of blur radii (one per layer). The layer closest to
 * focusDepth gets 0 blur; others increase proportionally to their distance.
 */
function computeLayerBlurs(focusDepth, blurIntensity, numLayers) {
  if (blurIntensity <= 0) return new Array(numLayers).fill(0);

  // Map focusDepth (0–100) to a fractional layer index (0 to numLayers-1)
  const focusLayer = (focusDepth / 100) * (numLayers - 1);

  const blurs = [];
  for (let i = 0; i < numLayers; i++) {
    const distance = Math.abs(i - focusLayer) / (numLayers - 1);
    blurs.push(distance * blurIntensity);
  }
  return blurs;
}

export default function ParallaxLayer({
  bgSrc,
  depthMapSrc,
  width,
  height,
  isSelected,
  onClick,
  mousePosition, // { x: 0-1, y: 0-1 } normalized
  depthEffects,  // { focusDepth, blurIntensity }
}) {
  const [bgImage] = useImage(bgSrc);
  const [depthImage] = useImage(depthMapSrc);
  const [baseLayerCanvases, setBaseLayerCanvases] = useState([]);
  const [layerCanvases, setLayerCanvases] = useState([]);
  const processedRef = useRef(null);

  const focusDepth = depthEffects?.focusDepth ?? 50;
  const blurIntensity = depthEffects?.blurIntensity ?? 0;

  // Generate base layer masks when images load
  useEffect(() => {
    if (!bgImage || !depthImage) return;

    const key = `${bgSrc}-${depthMapSrc}-${width}-${height}`;
    if (processedRef.current === key) return;

    try {
      const layers = generateLayerMasks(depthImage, bgImage, width, height);
      setBaseLayerCanvases(layers);
      setLayerCanvases(layers);
      processedRef.current = key;
    } catch (err) {
      console.error('[ParallaxLayer] Failed to generate layers:', err);
    }
  }, [bgImage, depthImage, bgSrc, depthMapSrc, width, height]);

  // Apply DoF blur when focusDepth or blurIntensity changes
  useEffect(() => {
    if (baseLayerCanvases.length === 0) return;

    const blurs = computeLayerBlurs(focusDepth, blurIntensity, NUM_LAYERS);
    const blurred = baseLayerCanvases.map((canvas, i) =>
      applyBlurToCanvas(canvas, blurs[i])
    );
    setLayerCanvases(blurred);
  }, [baseLayerCanvases, focusDepth, blurIntensity]);

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

  // Layer canvases are padded by MAX_OFFSET on each side — shift back so
  // the visible region aligns with the canvas origin.
  const pad = MAX_OFFSET;
  const padW = width + pad * 2;
  const padH = height + pad * 2;

  return (
    <>
      {layerCanvases.map((canvas, i) => {
        // Layer 0 = farthest (least movement), Layer N-1 = closest (most movement)
        const depthFactor = i / (NUM_LAYERS - 1);
        const offsetX = -pad + mx * MAX_OFFSET * depthFactor;
        const offsetY = -pad + my * MAX_OFFSET * depthFactor;

        return (
          <KonvaImage
            key={`parallax-layer-${i}`}
            image={canvas}
            x={offsetX}
            y={offsetY}
            width={padW}
            height={padH}
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
