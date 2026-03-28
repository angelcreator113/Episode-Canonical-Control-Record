import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
  Eraser, Check, X, Loader, Minus, Plus,
  Undo2, Redo2, Circle, Hexagon, Eye, EyeOff,
  Sliders, Sparkles, History, ChevronDown, ChevronUp,
  ImagePlus, Upload, MousePointer, FlipHorizontal, Scissors,
  Search
} from 'lucide-react';

/**
 * EraseBrushCanvas — Advanced overlay canvas for the erase/inpaint tool.
 *
 * Features:
 * - Custom fill prompt (describe what replaces erased area)
 * - Strength slider (0.5-1.0)
 * - Soft/hard brush toggle (feathered edges)
 * - Mask opacity slider
 * - Undo/redo for brush strokes
 * - Lasso selection mode (polygon mask)
 * - Multi-variation generation (2-4 options)
 * - Inpaint history with revert capability
 */

export default function EraseBrushCanvas({
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  backgroundUrl,
  backgroundLayout,
  onApply,
  onReplaceWithImage,
  onSegment,
  onMultiPointSegment,
  onTextSegment,
  onCancel,
  isProcessing,
  sceneId,
  showId,
  episodeId,
  onExtractSelection,
  // New props for enhanced features
  variations = [],
  onSelectVariation,
  inpaintHistory = [],
  onRevert,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileInputRef = useRef(null);
  const [removeBg, setRemoveBg] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const normalizeLibraryAsset = useCallback((asset) => {
    const thumbnailUrl = asset?.thumbnail_url
      || asset?.metadata?.thumbnail_url
      || asset?.s3_url_processed
      || asset?.s3_url_raw
      || null;
    const assetUrl = asset?.url
      || asset?.s3_url_processed
      || asset?.s3_url_raw
      || thumbnailUrl;

    return {
      ...asset,
      url: assetUrl,
      thumbnail_url: thumbnailUrl,
    };
  }, []);
  
  // Basic drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentClickPos, setSegmentClickPos] = useState(null); // { x, y } for loading indicator
  const [samPreviewUrl, setSamPreviewUrl] = useState(null); // preview before commit
  // Multi-point accumulation for smart select
  const [smartPoints, setSmartPoints] = useState([]); // [{x, y, label, canvasX, canvasY}]
  const [preSmartHistoryIndex, setPreSmartHistoryIndex] = useState(-1); // canvas state before first smart click
  const [smartFindQuery, setSmartFindQuery] = useState('');
  const [isSmartFinding, setIsSmartFinding] = useState(false);

  // Enhanced features state
  const [customPrompt, setCustomPrompt] = useState('');
  const [strength, setStrength] = useState(0.85);
  const [brushMode, setBrushMode] = useState('soft'); // 'soft' | 'hard'
  const [maskOpacity, setMaskOpacity] = useState(0.6);
  const [drawMode, setDrawModeRaw] = useState('brush'); // 'brush' | 'lasso' | 'smart'
  const [lassoPoints, setLassoPoints] = useState([]);

  // Switching modes clears any in-progress state
  const setDrawMode = useCallback((mode) => {
    setLassoPoints([]);
    if (mode !== 'smart') {
      setSmartPoints([]);
    }
    setCursorPos(null);
    setSmartPoints([]);
    setPreSmartHistoryIndex(-1);
    setDrawModeRaw(mode);
  }, []);
  const [variationCount, setVariationCount] = useState(1);
  
  // Undo/redo state - stores canvas ImageData snapshots
  const [strokeHistory, setStrokeHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);

  // Prompt suggestions based on common use cases
  const promptSuggestions = useMemo(() => [
    'Clean seamless background continuation',
    'Natural lighting and shadows',
    'Empty space matching surrounding',
    'Soft focused background blur',
    'Sky with clouds',
    'Greenery and foliage',
  ], []);

  // Initialize the overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Save initial empty state directly (avoid callback reference during init)
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    setStrokeHistory([imageData]);
    setHistoryIndex(0);
  }, [canvasWidth, canvasHeight]);

  // Save current canvas state to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    
    // Remove any redo states when new stroke is made
    const newHistory = strokeHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    
    // Limit history to 20 states
    if (newHistory.length > 20) newHistory.shift();
    
    setStrokeHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [canvasWidth, canvasHeight, strokeHistory, historyIndex]);

  // Undo last stroke
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newIndex = historyIndex - 1;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(strokeHistory[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    setHasStrokes(newIndex > 0);
  }, [historyIndex, strokeHistory]);

  // Redo stroke
  const handleRedo = useCallback(() => {
    if (historyIndex >= strokeHistory.length - 1) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newIndex = historyIndex + 1;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(strokeHistory[newIndex], 0, 0);
    setHistoryIndex(newIndex);
    setHasStrokes(true);
  }, [historyIndex, strokeHistory]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX, screenY) => {
    // Use the canvas element's own rect — getBoundingClientRect accounts
    // for CSS transforms (translate + scale) so we just need to map from
    // the displayed rect back to the canvas internal resolution.
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect() || overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const x = ((screenX - rect.left) / rect.width) * canvasWidth;
    const y = ((screenY - rect.top) / rect.height) * canvasHeight;
    return { x, y };
  }, [canvasWidth, canvasHeight]);

  // Visible mask color for display (red semi-transparent)
  const MASK_COLOR = 'rgba(220, 53, 53, 0.5)';
  const MASK_COLOR_SOLID = 'rgba(220, 53, 53, 0.8)';

  // Apply soft brush effect (gaussian blur on edges) — visible red for display
  const applySoftBrush = useCallback((ctx, x, y, size) => {
    const r = (size || 1) / 2;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) {
      return MASK_COLOR;
    }
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, MASK_COLOR_SOLID);
    gradient.addColorStop(0.5, MASK_COLOR);
    gradient.addColorStop(1, 'rgba(220, 53, 53, 0)');
    return gradient;
  }, []);

  // Draw a brush stroke segment
  const drawStroke = useCallback((fromX, fromY, toX, toY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (brushMode === 'soft') {
      // Soft brush with feathered edges
      ctx.globalCompositeOperation = 'source-over';
      const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;
        ctx.fillStyle = applySoftBrush(ctx, x, y, brushSize);
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Hard brush with sharp edges — visible red for display
      ctx.strokeStyle = MASK_COLOR;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    setHasStrokes(true);
  }, [brushSize, brushMode, applySoftBrush]);

  // Track cursor position for live lasso preview
  const [cursorPos, setCursorPos] = useState(null);

  // Animated lasso offset for marching ants effect
  const [lassoOffset, setLassoOffset] = useState(0);

  // Animate the lasso dash offset (marching ants)
  useEffect(() => {
    if (drawMode !== 'lasso' || lassoPoints.length === 0) return;
    const interval = setInterval(() => {
      setLassoOffset((prev) => (prev + 1) % 20);
    }, 50);
    return () => clearInterval(interval);
  }, [drawMode, lassoPoints.length]);

  // Draw lasso polygon with high visibility
  const drawLasso = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || lassoPoints.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    // Clear and redraw from last history state
    if (historyIndex >= 0 && strokeHistory[historyIndex]) {
      ctx.putImageData(strokeHistory[historyIndex], 0, 0);
    }

    // Live fill preview — show semi-transparent red inside the polygon
    if (lassoPoints.length >= 2) {
      ctx.save();
      ctx.fillStyle = 'rgba(220, 53, 53, 0.15)';
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
      if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw lasso path with double-stroke for visibility (white outline + colored inner)
    // Outer white stroke for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    if (cursorPos && lassoPoints.length > 0) {
      ctx.lineTo(cursorPos.x, cursorPos.y);
    }
    ctx.stroke();

    // Inner colored dashed stroke (marching ants)
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -lassoOffset;
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    if (cursorPos && lassoPoints.length > 0) {
      ctx.lineTo(cursorPos.x, cursorPos.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Draw point indicators at each lasso vertex
    lassoPoints.forEach((pt, i) => {
      // Outer white ring
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
      // Inner colored dot
      ctx.fillStyle = i === 0 ? '#22c55e' : '#667eea'; // Green for first point
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Point number
      if (lassoPoints.length > 2) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px DM Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), pt.x, pt.y);
      }
    });

    // Show "closing hint" when near first point — pulsing green ring
    if (lassoPoints.length >= 3 && cursorPos) {
      const first = lassoPoints[0];
      const dist = Math.hypot(cursorPos.x - first.x, cursorPos.y - first.y);
      if (dist < 30) {
        const proximity = 1 - (dist / 30); // 0 = far, 1 = on top
        const radius = 12 + proximity * 8; // grows from 12 to 20
        ctx.save();
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.4 + proximity * 0.6})`;
        ctx.lineWidth = 2 + proximity * 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(first.x, first.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Fill when very close
        if (dist < 15) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }, [lassoPoints, historyIndex, strokeHistory, cursorPos, lassoOffset]);

  // Fill lasso polygon
  const fillLasso = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || lassoPoints.length < 3) return;

    const ctx = canvas.getContext('2d');
    
    // Restore last state first
    if (historyIndex >= 0 && strokeHistory[historyIndex]) {
      ctx.putImageData(strokeHistory[historyIndex], 0, 0);
    }

    // Fill the polygon — visible red for display
    ctx.fillStyle = MASK_COLOR;
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fill();

    setHasStrokes(true);
    setLassoPoints([]);
    setCursorPos(null);
    saveToHistory();
  }, [lassoPoints, historyIndex, strokeHistory, saveToHistory]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    if (isProcessing || isSegmenting) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (drawMode === 'smart') {
      // Smart Select: accumulate points and send to SAM together
      // Normal click = include (label 1), Alt+click = exclude (label 0)
      const label = e.altKey ? 0 : 1;
      // Map canvas coords to source image coords (0-1 normalized).
      // Background uses cover-fit layout so may be offset/scaled within the canvas.
      let normalizedX, normalizedY;
      if (backgroundLayout?.drawWidth && backgroundLayout?.drawHeight) {
        normalizedX = (x - (backgroundLayout.drawX || 0)) / backgroundLayout.drawWidth;
        normalizedY = (y - (backgroundLayout.drawY || 0)) / backgroundLayout.drawHeight;
      } else {
        normalizedX = x / canvasWidth;
        normalizedY = y / canvasHeight;
      }
      if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) return;

      const newPoint = { x: normalizedX, y: normalizedY, label, canvasX: x, canvasY: y };
      const isFirstSmartClick = smartPoints.length === 0;
      const updatedPoints = [...smartPoints, newPoint];
      setSmartPoints(updatedPoints);

      // Remember canvas state before first smart click so we can restore on each refinement
      if (isFirstSmartClick) {
        setPreSmartHistoryIndex(historyIndex);
      }
      // Capture the baseline index to use in the async callback
      const baselineIndex = isFirstSmartClick ? historyIndex : preSmartHistoryIndex;

      // Auto-fire SAM with all accumulated points
      setSegmentClickPos({ x, y });
      setIsSegmenting(true);

      const segmentFn = updatedPoints.length > 1 && onMultiPointSegment
        ? () => onMultiPointSegment(
            updatedPoints.map((p) => ({ x: p.x, y: p.y })),
            updatedPoints.map((p) => p.label)
          )
        : () => onSegment?.(normalizedX, normalizedY);
      segmentFn()
        .then((maskImageUrl) => {
          if (!maskImageUrl) return;
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Always restore to the pre-SAM state (before first smart click)
            // This replaces the previous SAM mask instead of stacking
            if (baselineIndex >= 0 && strokeHistory[baselineIndex]) {
              ctx.putImageData(strokeHistory[baselineIndex], 0, 0);
            } else {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Draw SAM mask aligned to where the background image sits on the canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            // SAM mask covers the source image — draw it at the background's position
            const dx = backgroundLayout?.drawX || 0;
            const dy = backgroundLayout?.drawY || 0;
            const dw = backgroundLayout?.drawWidth || canvas.width;
            const dh = backgroundLayout?.drawHeight || canvas.height;
            tempCtx.drawImage(img, dx, dy, dw, dh);
            const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < maskData.data.length; i += 4) {
              if (maskData.data[i] > 128) {
                maskData.data[i] = 220;
                maskData.data[i + 1] = 53;
                maskData.data[i + 2] = 53;
                maskData.data[i + 3] = 128;
              } else {
                maskData.data[i + 3] = 0;
              }
            }
            tempCtx.putImageData(maskData, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tempCanvas, 0, 0);

            setHasStrokes(true);
            saveToHistory();
          };
          img.onerror = () => console.error('Failed to load SAM mask image');
          img.src = maskImageUrl;
        })
        .catch((err) => {
          console.error('Smart select failed:', err);
        })
        .finally(() => {
          setIsSegmenting(false);
          setSegmentClickPos(null);
        });
      return;
    }

    if (drawMode === 'lasso') {
      // Check if clicking near the first point to close the lasso
      if (lassoPoints.length >= 3) {
        const first = lassoPoints[0];
        const dist = Math.hypot(x - first.x, y - first.y);
        if (dist < 15) {
          fillLasso();
          return;
        }
      }
      // Add point to lasso
      setLassoPoints((prev) => [...prev, { x, y }]);
      return;
    }

    lastPosRef.current = { x, y };
    setIsDrawing(true);

    // Draw a dot for single clicks
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (brushMode === 'soft') {
        ctx.fillStyle = applySoftBrush(ctx, x, y, brushSize);
      } else {
        ctx.fillStyle = MASK_COLOR;
      }
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      setHasStrokes(true);
    }
  }, [screenToCanvas, brushSize, brushMode, isProcessing, isSegmenting, drawMode, applySoftBrush, lassoPoints, smartPoints, fillLasso, onSegment, canvasWidth, canvasHeight, saveToHistory]);

  const handleMouseMove = useCallback((e) => {
    if (isProcessing) return;
    
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    
    if (drawMode === 'lasso') {
      // Always update cursor position for live preview
      setCursorPos({ x, y });
      if (lassoPoints.length > 0) {
        drawLasso();
      }
      return;
    }

    if (!isDrawing) return;

    drawStroke(lastPosRef.current.x, lastPosRef.current.y, x, y);
    lastPosRef.current = { x, y };
  }, [isDrawing, screenToCanvas, drawStroke, isProcessing, drawMode, lassoPoints.length, drawLasso]);

  const handleMouseUp = useCallback(() => {
    if (drawMode === 'brush' && isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [drawMode, isDrawing, saveToHistory]);

  const handleMouseLeave = useCallback(() => {
    if (drawMode === 'lasso') {
      setCursorPos(null);
    }
    if (drawMode === 'brush' && isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [drawMode, isDrawing, saveToHistory]);

  // Double-click to close lasso
  const handleDoubleClick = useCallback(() => {
    if (drawMode === 'lasso' && lassoPoints.length >= 3) {
      fillLasso();
    }
  }, [drawMode, lassoPoints.length, fillLasso]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e) => {
    if (isProcessing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
    
    if (drawMode === 'lasso') {
      setLassoPoints((prev) => [...prev, { x, y }]);
      return;
    }
    
    lastPosRef.current = { x, y };
    setIsDrawing(true);
  }, [screenToCanvas, isProcessing, drawMode]);

  const handleTouchMove = useCallback((e) => {
    if (!isDrawing || isProcessing || drawMode === 'lasso') return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
    drawStroke(lastPosRef.current.x, lastPosRef.current.y, x, y);
    lastPosRef.current = { x, y };
  }, [isDrawing, screenToCanvas, drawStroke, isProcessing, drawMode]);

  const handleTouchEnd = useCallback(() => {
    if (drawMode === 'brush' && isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [drawMode, isDrawing, saveToHistory]);

  // Clear the mask
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    setHasStrokes(false);
    setLassoPoints([]);
    setSmartPoints([]);
    setCursorPos(null);
    setStrokeHistory([]);
    setHistoryIndex(-1);
    saveToHistory();
  }, [canvasWidth, canvasHeight, saveToHistory]);

  // Smart Find — text-based object detection
  const handleSmartFind = useCallback(async () => {
    if (!smartFindQuery.trim() || isSmartFinding || !onTextSegment) return;

    setIsSmartFinding(true);
    try {
      const maskImageUrl = await onTextSegment(smartFindQuery.trim());
      if (!maskImageUrl) return;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Convert SAM white-on-black mask to our red display color
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        const dx = backgroundLayout?.drawX || 0;
        const dy = backgroundLayout?.drawY || 0;
        const dw = backgroundLayout?.drawWidth || canvas.width;
        const dh = backgroundLayout?.drawHeight || canvas.height;
        tempCtx.drawImage(img, dx, dy, dw, dh);
        const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < maskData.data.length; i += 4) {
          if (maskData.data[i] > 128) {
            maskData.data[i] = 220;
            maskData.data[i + 1] = 53;
            maskData.data[i + 2] = 53;
            maskData.data[i + 3] = 128;
          } else {
            maskData.data[i + 3] = 0;
          }
        }
        tempCtx.putImageData(maskData, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);

        setHasStrokes(true);
        saveToHistory();
      };
      img.onerror = () => console.error('Failed to load text segment mask');
      img.src = maskImageUrl;
    } finally {
      setIsSmartFinding(false);
    }
  }, [smartFindQuery, isSmartFinding, onTextSegment, saveToHistory]);

  // Invert the selection — painted becomes unpainted and vice versa
  const handleInvertSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        // Was painted → make transparent
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        // Was empty → make red (painted)
        data[i] = 220;     // R
        data[i + 1] = 53;  // G
        data[i + 2] = 53;  // B
        data[i + 3] = 128; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setHasStrokes(true);
    saveToHistory();
  }, [saveToHistory]);

  // Grow/shrink the current mask selection by expanding or contracting painted pixels
  const adjustSelection = useCallback((direction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const src = imageData.data;

    // Create a copy to read from while writing to original
    const copy = new Uint8ClampedArray(src);
    const radius = 3; // pixels to grow/shrink by

    if (direction === 'grow') {
      // For each empty pixel, check if any neighbor within radius is painted
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (copy[idx + 3] > 10) continue; // already painted
          let found = false;
          for (let dy = -radius; dy <= radius && !found; dy++) {
            for (let dx = -radius; dx <= radius && !found; dx++) {
              if (dx * dx + dy * dy > radius * radius) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (copy[(ny * w + nx) * 4 + 3] > 10) found = true;
            }
          }
          if (found) {
            src[idx] = 220;
            src[idx + 1] = 53;
            src[idx + 2] = 53;
            src[idx + 3] = 128;
          }
        }
      }
    } else {
      // Shrink: for each painted pixel, check if any neighbor within radius is empty
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (copy[idx + 3] <= 10) continue; // already empty
          let foundEmpty = false;
          for (let dy = -radius; dy <= radius && !foundEmpty; dy++) {
            for (let dx = -radius; dx <= radius && !foundEmpty; dx++) {
              if (dx * dx + dy * dy > radius * radius) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) { foundEmpty = true; continue; }
              if (copy[(ny * w + nx) * 4 + 3] <= 10) foundEmpty = true;
            }
          }
          if (foundEmpty) {
            src[idx + 3] = 0;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  }, [saveToHistory]);

  // Export a proper white-on-black mask from the display canvas.
  // Display canvas uses visible red strokes; export converts any
  // painted pixel (alpha > 0) to white on a black background.
  const exportMaskDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Draw the display canvas to read its pixel data
    ctx.drawImage(canvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const data = imageData.data;

    // Convert: any pixel with alpha > 0 becomes white, else black
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) { // has some alpha = was painted
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
      } else {
        data[i] = 0;       // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return exportCanvas.toDataURL('image/png');
  }, []);

  // Apply the mask — export as data URL and call onApply with options
  const handleApply = useCallback(() => {
    if (!hasStrokes || isProcessing) return;

    const maskDataUrl = exportMaskDataUrl();
    if (!maskDataUrl) return;

    onApply(maskDataUrl, {
      prompt: customPrompt || undefined,
      strength,
      variationCount,
    });
  }, [hasStrokes, isProcessing, onApply, customPrompt, strength, variationCount, exportMaskDataUrl]);

  // Replace with image handler
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !hasStrokes || isProcessing) return;

    const maskDataUrl = exportMaskDataUrl();
    if (!maskDataUrl) return;
    const reader = new FileReader();
    reader.onload = () => {
      onReplaceWithImage?.(maskDataUrl, {
        imageDataUrl: reader.result,
        removeBg,
      });
    };
    reader.readAsDataURL(file);

    // Reset file input so the same file can be selected again
    e.target.value = '';
  }, [hasStrokes, isProcessing, onReplaceWithImage, removeBg, exportMaskDataUrl]);

  // Replace with library asset handler
  const handleLibraryAssetSelect = useCallback((asset) => {
    const assetUrl = asset?.url || asset?.thumbnail_url;
    if (!hasStrokes || isProcessing || !assetUrl) return;

    const maskDataUrl = exportMaskDataUrl();
    if (!maskDataUrl) return;

    onReplaceWithImage?.(maskDataUrl, {
      imageDataUrl: assetUrl,
      assetId: asset?.id || null,
      removeBg,
    });
    setShowImageMenu(false);
  }, [hasStrokes, isProcessing, onReplaceWithImage, removeBg, exportMaskDataUrl]);

  // Fetch library images when menu opens
  useEffect(() => {
    if (!showImageMenu || libraryImages.length > 0) return;
    let cancelled = false;
    setLibraryLoading(true);
    const params = { limit: 20 };
    if (showId) params.show_id = showId;
    if (episodeId) params.episode_id = episodeId;
    api.get('/api/v1/assets', { params })
      .then(({ data }) => {
        if (!cancelled) {
          const assets = (data.data || data.assets || [])
            .map(normalizeLibraryAsset)
            .filter((asset) => asset.url || asset.thumbnail_url);
          setLibraryImages(assets);
        }
      })
      .catch((err) => {
        console.warn('Library fetch failed:', err.message);
        if (!cancelled) setLibraryImages([]);
      })
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, [showImageMenu, libraryImages.length, libraryLoading, showId, episodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === '[') {
        setBrushSize((prev) => Math.max(5, prev - 10));
      } else if (e.key === ']') {
        setBrushSize((prev) => Math.min(200, prev + 10));
      } else if (e.key === 'Backspace' && drawMode === 'lasso' && lassoPoints.length > 0) {
        e.preventDefault();
        setLassoPoints((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        if (lassoPoints.length > 0) {
          setLassoPoints([]);
        } else if (samPreviewUrl) {
          setSamPreviewUrl(null);
        } else if (samPreviewUrl) {
          setSamPreviewUrl(null);
        } else {
          onCancel();
        }
      } else if (e.key === 'Enter' && hasStrokes && !isProcessing) {
        if (drawMode === 'lasso' && lassoPoints.length >= 3) {
          fillLasso();
        } else if (drawMode === 'brush') {
          handleApply();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'b' || e.key === 'B') {
        setDrawMode('brush');
      } else if (e.key === 'l' || e.key === 'L') {
        setDrawMode('lasso');
      } else if (e.key === 's' || e.key === 'S') {
        setDrawMode('smart');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, hasStrokes, isProcessing, handleApply, handleUndo, handleRedo, lassoPoints, smartPoints.length, drawMode, fillLasso, handleClear]);

  // Update lasso preview on points change
  useEffect(() => {
    if (drawMode === 'lasso' && lassoPoints.length > 0) {
      drawLasso();
    }
  }, [lassoPoints, drawMode, drawLasso]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < strokeHistory.length - 1;

  return (
    <div className="erase-brush-overlay" ref={overlayRef}>
      {/* The mask canvas (positioned to match the scene canvas) */}
      <div
        className="erase-brush-canvas-wrapper"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {/* Semi-transparent backdrop with adjustable opacity */}
        <div 
          className="erase-brush-backdrop" 
          style={{ opacity: maskOpacity }}
        />
        
        <canvas
          ref={canvasRef}
          className="erase-brush-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            cursor: isProcessing || isSegmenting
              ? 'wait'
              : drawMode === 'smart'
                ? 'crosshair'
                : drawMode === 'lasso'
                  ? 'crosshair'
                  : `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2 - 1}" fill="${brushMode === 'soft' ? 'rgba(255,255,255,0.3)' : 'none'}" stroke="%23667eea" stroke-width="2"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair`,
          }}
        />

        {/* Smart Select: loading indicator at click point */}
        {isSegmenting && segmentClickPos && (
          <div
            className="erase-segment-loading"
            style={{
              left: segmentClickPos.x,
              top: segmentClickPos.y,
            }}
          >
            <Loader size={20} className="erase-brush-spinner" />
          </div>
        )}

        {/* Smart Select: accumulated point indicators */}
        {drawMode === 'smart' && smartPoints.map((pt, i) => (
          <div
            key={i}
            className={`erase-smart-point ${pt.label === 1 ? 'include' : 'exclude'}`}
            style={{ left: pt.canvasX, top: pt.canvasY }}
            title={pt.label === 1 ? 'Include point' : 'Exclude point'}
          >
            {pt.label === 1 ? '+' : '−'}
          </div>
        ))}
      </div>

      {/* Variation picker overlay (when variations exist) */}
      {variations.length > 0 && (
        <div className="erase-variations-overlay">
          <div className="erase-variations-header">
            <Sparkles size={14} />
            <span>Select the best result</span>
          </div>
          <div className="erase-variations-grid">
            {variations.map((v, i) => (
              <button
                key={i}
                className="erase-variation-item"
                onClick={() => onSelectVariation?.(i)}
              >
                <img src={v.url} alt={`Variation ${i + 1}`} />
                {v.score && (
                  <span className="erase-variation-score">{Math.round(v.score * 100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input for Replace with Image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Bottom-docked toolbar */}
      <div className="erase-toolbar">
        {/* Row 1: Drawing tools */}
        <div className="erase-toolbar-row">
          <div className="erase-toolbar-group">
            <div className="erase-brush-mode-toggle">
              <button
                type="button"
                className={`erase-mode-btn ${drawMode === 'brush' ? 'active' : ''}`}
                onClick={() => setDrawMode('brush')}
                disabled={isProcessing}
                title="Brush mode (B)"
              >
                <Circle size={12} />
                <span>Brush</span>
              </button>
              <button
                type="button"
                className={`erase-mode-btn ${drawMode === 'lasso' ? 'active' : ''}`}
                onClick={() => setDrawMode('lasso')}
                disabled={isProcessing}
                title="Lasso mode (L)"
              >
                <Hexagon size={12} />
                <span>Lasso</span>
              </button>
              <button
                type="button"
                className={`erase-mode-btn ${drawMode === 'smart' ? 'active' : ''}`}
                onClick={() => setDrawMode('smart')}
                disabled={isProcessing}
                title="Smart Select — click on an object to auto-select it (S)"
              >
                <MousePointer size={12} />
                <span>Smart</span>
              </button>
            </div>
          </div>

          {drawMode === 'smart' && (
            <div className="erase-toolbar-group erase-smart-find">
              <div className="erase-smart-find-row">
                <Search size={12} className="erase-smart-find-icon" />
                <input
                  type="text"
                  value={smartFindQuery}
                  onChange={(e) => setSmartFindQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSmartFind(); }}
                  placeholder="Find object... (e.g. lamp, rug, chair)"
                  className="erase-smart-find-input"
                  disabled={isProcessing || isSmartFinding}
                />
                <button
                  type="button"
                  className="erase-smart-find-btn"
                  onClick={handleSmartFind}
                  disabled={!smartFindQuery.trim() || isProcessing || isSmartFinding}
                >
                  {isSmartFinding ? <Loader size={12} className="erase-brush-spinner" /> : 'Find'}
                </button>
              </div>
              {hasStrokes && (
                <div className="erase-smart-adjust-row">
                  <button
                    type="button"
                    className="erase-smart-adjust-btn"
                    onClick={() => adjustSelection('shrink')}
                    disabled={isProcessing || isSegmenting}
                    title="Shrink selection edges inward"
                  >
                    <Minus size={10} /> Shrink
                  </button>
                  <button
                    type="button"
                    className="erase-smart-adjust-btn"
                    onClick={() => adjustSelection('grow')}
                    disabled={isProcessing || isSegmenting}
                    title="Grow selection edges outward"
                  >
                    <Plus size={10} /> Grow
                  </button>
                  <span className="erase-smart-adjust-hint">or switch to Brush to paint</span>
                </div>
              )}
              {smartPoints.length > 0 && (
                <button
                  type="button"
                  className="erase-smart-adjust-btn"
                  onClick={() => setSmartPoints([])}
                  disabled={isProcessing || isSegmenting}
                  title="Clear all guide points"
                >
                  <X size={10} /> Clear points
                </button>
              )}
            </div>
          )}

          {drawMode === 'brush' && (
            <div className="erase-toolbar-group">
              <div className="erase-brush-size-row">
                <button type="button" className="erase-brush-size-btn" onClick={() => setBrushSize((prev) => Math.max(5, prev - 10))} disabled={isProcessing}>
                  <Minus size={12} />
                </button>
                <input type="range" min="5" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} disabled={isProcessing} />
                <button type="button" className="erase-brush-size-btn" onClick={() => setBrushSize((prev) => Math.min(200, prev + 10))} disabled={isProcessing}>
                  <Plus size={12} />
                </button>
                <span className="erase-brush-size-value">{brushSize}px</span>
              </div>
              <div className="erase-brush-type-toggle">
                <button type="button" className={`erase-brush-type-btn ${brushMode === 'soft' ? 'active' : ''}`} onClick={() => setBrushMode('soft')} disabled={isProcessing}>Soft</button>
                <button type="button" className={`erase-brush-type-btn ${brushMode === 'hard' ? 'active' : ''}`} onClick={() => setBrushMode('hard')} disabled={isProcessing}>Hard</button>
              </div>
            </div>
          )}

          <div className="erase-toolbar-group">
            <div className="erase-brush-undo-redo">
              <button type="button" className="erase-brush-action-btn" onClick={handleUndo} disabled={!canUndo || isProcessing} title="Undo (Ctrl+Z)">
                <Undo2 size={14} />
              </button>
              <button type="button" className="erase-brush-action-btn" onClick={handleRedo} disabled={!canRedo || isProcessing} title="Redo (Ctrl+Y)">
                <Redo2 size={14} />
              </button>
              {historyIndex > 0 && <span className="erase-brush-undo-count">{historyIndex}</span>}
            </div>

            {/* Invert selection */}
            <button
              type="button"
              className="erase-brush-action-btn"
              onClick={handleInvertSelection}
              disabled={!hasStrokes || isProcessing}
              title="Invert selection (select everything except painted area)"
            >
              <FlipHorizontal size={14} />
            </button>

            {/* Extract selection as movable object */}
            {onExtractSelection && (
              <button
                type="button"
                className="erase-brush-action-btn"
                onClick={() => {
                  if (!hasStrokes || isProcessing) return;
                  const maskDataUrl = exportMaskDataUrl();
                  if (maskDataUrl) onExtractSelection(maskDataUrl);
                }}
                disabled={!hasStrokes || isProcessing}
                title="Extract selected area as a movable object"
              >
                <Scissors size={14} />
              </button>
            )}
          </div>

          <div className="erase-toolbar-group">
            <button type="button" className="erase-brush-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Sliders size={12} />
              {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {maskOpacity > 0 ? (
              <button type="button" className="erase-brush-opacity-btn" onClick={() => setMaskOpacity(0)} title="Hide mask overlay">
                <Eye size={14} />
              </button>
            ) : (
              <button type="button" className="erase-brush-opacity-btn" onClick={() => setMaskOpacity(0.6)} title="Show mask overlay">
                <EyeOff size={14} />
              </button>
            )}
          </div>

          <div className="erase-toolbar-spacer" />

          <div className="erase-toolbar-group erase-toolbar-actions">
            <button type="button" className="erase-brush-btn secondary" onClick={handleClear} disabled={!hasStrokes || isProcessing}>Clear</button>
            <button type="button" className="erase-brush-btn secondary" onClick={onCancel} disabled={isProcessing}>
              <X size={14} /> Cancel
            </button>
          </div>
        </div>

        {/* Row 2: Fill options + Apply */}
        <div className="erase-toolbar-row erase-toolbar-fill-row">
          <div className="erase-toolbar-group erase-toolbar-fill">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && hasStrokes && !isProcessing) handleApply(); }}
              placeholder="Describe replacement (leave empty for AI fill)..."
              disabled={isProcessing}
              className="erase-prompt-input"
            />
            <button
              type="button"
              className="erase-prompt-suggestions-btn"
              onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
              disabled={isProcessing}
              title="Prompt suggestions"
            >
              <Sparkles size={12} />
            </button>
          </div>

          <div className="erase-toolbar-group erase-toolbar-actions">
            <div className="erase-image-picker">
              <button
                type="button"
                className="erase-brush-btn secondary"
                onClick={() => setShowImageMenu(!showImageMenu)}
                disabled={!hasStrokes || isProcessing}
                title="Replace masked area with an image — lasso one object at a time"
              >
                <ImagePlus size={14} />
                <span className="erase-btn-label">Use Image</span>
                <ChevronUp size={10} />
              </button>
              {showImageMenu && (
                <div className="erase-image-menu">
                  <div className="erase-image-menu-hint">Tip: Select one object at a time for best results</div>
                  <button
                    type="button"
                    className="erase-image-menu-item"
                    onClick={() => { fileInputRef.current?.click(); setShowImageMenu(false); }}
                  >
                    <Upload size={14} />
                    Upload File
                  </button>
                  <div className="erase-image-menu-divider" />
                  <div className="erase-image-menu-label">From Library</div>
                  {libraryLoading ? (
                    <div className="erase-image-menu-loading">Loading...</div>
                  ) : libraryImages.length > 0 ? (
                    <div className="erase-image-menu-grid">
                      {libraryImages.filter((a) => a.url || a.thumbnail_url).slice(0, 12).map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          className="erase-image-menu-thumb"
                          onClick={() => handleLibraryAssetSelect(asset)}
                          title={asset.label || asset.name || 'Library asset'}
                        >
                          <img src={asset.thumbnail_url || asset.url} alt={asset.label || 'Asset'} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="erase-image-menu-loading">No images in library</div>
                  )}
                </div>
              )}
            </div>
            <label className="erase-remove-bg-toggle" title="Remove background from replacement image before compositing">
              <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} disabled={isProcessing} />
              <span className="erase-remove-bg-label">Remove BG</span>
            </label>
            <button
              type="button"
              className="erase-brush-btn primary"
              onClick={handleApply}
              disabled={!hasStrokes || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader size={14} className="erase-brush-spinner" />
                  Processing...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Apply
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prompt suggestions dropdown */}
        {showPromptSuggestions && (
          <div className="erase-prompt-suggestions">
            {promptSuggestions.map((suggestion, i) => (
              <button
                type="button"
                key={i}
                className="erase-prompt-suggestion"
                onClick={() => {
                  setCustomPrompt(suggestion);
                  setShowPromptSuggestions(false);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Advanced options panel (slides up from toolbar) */}
        {showAdvanced && (
          <div className="erase-brush-advanced">
            <div className="erase-brush-slider-group">
              <label>Strength <span className="erase-brush-slider-value">{Math.round(strength * 100)}%</span></label>
              <input type="range" min="50" max="100" value={strength * 100} onChange={(e) => setStrength(parseInt(e.target.value) / 100)} disabled={isProcessing} />
            </div>
            <div className="erase-brush-slider-group">
              <label>Mask Opacity <span className="erase-brush-slider-value">{Math.round(maskOpacity * 100)}%</span></label>
              <input type="range" min="0" max="100" value={maskOpacity * 100} onChange={(e) => setMaskOpacity(parseInt(e.target.value) / 100)} disabled={isProcessing} />
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isSegmenting && (
          <div className="erase-brush-progress">AI is detecting the object... This may take a few seconds.</div>
        )}
        {isProcessing && (
          <div className="erase-brush-progress">AI is filling the selected area. This may take 10-30 seconds...</div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="erase-brush-shortcuts">
          {drawMode === 'smart'
            ? 'Click to include • Alt+click to exclude • Each click refines • B brush • L lasso'
            : drawMode === 'brush'
              ? '[ / ] size • Ctrl+Z undo • B brush • L lasso • S smart'
              : 'Click to add points • Backspace undo point • Enter close • Esc cancel'}
        </div>
      </div>
    </div>
  );
}
