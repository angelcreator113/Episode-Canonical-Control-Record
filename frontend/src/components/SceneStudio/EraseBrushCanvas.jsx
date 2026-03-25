import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Eraser, Check, X, Loader, Minus, Plus, 
  Undo2, Redo2, Circle, Hexagon, Eye, EyeOff,
  Sliders, Sparkles, History, ChevronDown, ChevronUp
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
  onApply,
  onCancel,
  isProcessing,
  // New props for enhanced features
  variations = [],
  onSelectVariation,
  inpaintHistory = [],
  onRevert,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  
  // Basic drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Enhanced features state
  const [customPrompt, setCustomPrompt] = useState('');
  const [strength, setStrength] = useState(0.85);
  const [brushMode, setBrushMode] = useState('soft'); // 'soft' | 'hard'
  const [maskOpacity, setMaskOpacity] = useState(0.6);
  const [drawMode, setDrawMode] = useState('brush'); // 'brush' | 'lasso'
  const [lassoPoints, setLassoPoints] = useState([]);
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

    const ctx = canvas.getContext('2d');
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
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const x = (screenX - rect.left - panX) / zoom;
    const y = (screenY - rect.top - panY) / zoom;
    return { x, y };
  }, [zoom, panX, panY]);

  // Apply soft brush effect (gaussian blur on edges)
  const applySoftBrush = useCallback((ctx, x, y, size) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
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
      // Hard brush with sharp edges
      ctx.strokeStyle = 'white';
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

  // Draw lasso polygon
  const drawLasso = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || lassoPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    
    // Clear and redraw from last history state
    if (historyIndex >= 0 && strokeHistory[historyIndex]) {
      ctx.putImageData(strokeHistory[historyIndex], 0, 0);
    }

    // Draw the lasso path
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }, [lassoPoints, historyIndex, strokeHistory]);

  // Fill lasso polygon
  const fillLasso = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || lassoPoints.length < 3) return;

    const ctx = canvas.getContext('2d');
    
    // Restore last state first
    if (historyIndex >= 0 && strokeHistory[historyIndex]) {
      ctx.putImageData(strokeHistory[historyIndex], 0, 0);
    }

    // Fill the polygon
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    lassoPoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fill();

    setHasStrokes(true);
    setLassoPoints([]);
    saveToHistory();
  }, [lassoPoints, historyIndex, strokeHistory, saveToHistory]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    if (isProcessing) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (drawMode === 'lasso') {
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
        ctx.fillStyle = 'white';
      }
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      setHasStrokes(true);
    }
  }, [screenToCanvas, brushSize, brushMode, isProcessing, drawMode, applySoftBrush]);

  const handleMouseMove = useCallback((e) => {
    if (isProcessing) return;
    
    if (drawMode === 'lasso' && lassoPoints.length > 0) {
      drawLasso();
      return;
    }

    if (!isDrawing) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
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
    setStrokeHistory([]);
    setHistoryIndex(-1);
    saveToHistory();
  }, [canvasWidth, canvasHeight, saveToHistory]);

  // Apply the mask — export as data URL and call onApply with options
  const handleApply = useCallback(() => {
    if (!hasStrokes || isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export the mask as PNG data URL
    const maskDataUrl = canvas.toDataURL('image/png');
    
    // Call onApply with all options
    onApply(maskDataUrl, {
      prompt: customPrompt || 'Remove the selected area and fill with a natural continuation of the background',
      strength,
      variationCount,
    });
  }, [hasStrokes, isProcessing, onApply, customPrompt, strength, variationCount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === '[') {
        setBrushSize((prev) => Math.max(5, prev - 10));
      } else if (e.key === ']') {
        setBrushSize((prev) => Math.min(200, prev + 10));
      } else if (e.key === 'Escape') {
        if (lassoPoints.length > 0) {
          setLassoPoints([]);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, hasStrokes, isProcessing, handleApply, handleUndo, handleRedo, lassoPoints, drawMode, fillLasso]);

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
            cursor: isProcessing 
              ? 'wait' 
              : drawMode === 'lasso'
                ? 'crosshair'
                : `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2 - 1}" fill="${brushMode === 'soft' ? 'rgba(255,255,255,0.3)' : 'none'}" stroke="%23667eea" stroke-width="2"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair`,
          }}
        />
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

      {/* Controls panel */}
      <div className="erase-brush-controls">
        <div className="erase-brush-header">
          <Eraser size={14} />
          <span>Erase Tool</span>
        </div>

        {/* Drawing mode toggle */}
        <div className="erase-brush-mode-toggle">
          <button
            className={`erase-mode-btn ${drawMode === 'brush' ? 'active' : ''}`}
            onClick={() => setDrawMode('brush')}
            disabled={isProcessing}
            title="Brush mode (B)"
          >
            <Circle size={12} />
            <span>Brush</span>
          </button>
          <button
            className={`erase-mode-btn ${drawMode === 'lasso' ? 'active' : ''}`}
            onClick={() => setDrawMode('lasso')}
            disabled={isProcessing}
            title="Lasso mode (L)"
          >
            <Hexagon size={12} />
            <span>Lasso</span>
          </button>
        </div>

        {/* Instructions based on mode */}
        <div className="erase-brush-instructions">
          {drawMode === 'brush' 
            ? 'Paint over areas to remove. The AI will fill them intelligently.'
            : 'Click to add points. Double-click or press Enter to close the shape.'}
        </div>

        {/* Custom prompt input */}
        <div className="erase-brush-prompt-section">
          <label>Fill with (optional)</label>
          <div className="erase-prompt-input-wrapper">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., blue sky with clouds"
              disabled={isProcessing}
              className="erase-prompt-input"
            />
            <button
              className="erase-prompt-suggestions-btn"
              onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
              disabled={isProcessing}
            >
              <Sparkles size={12} />
            </button>
          </div>
          {showPromptSuggestions && (
            <div className="erase-prompt-suggestions">
              {promptSuggestions.map((suggestion, i) => (
                <button
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
        </div>

        {/* Brush size control (only for brush mode) */}
        {drawMode === 'brush' && (
          <div className="erase-brush-size-control">
            <label>Brush Size</label>
            <div className="erase-brush-size-row">
              <button
                className="erase-brush-size-btn"
                onClick={() => setBrushSize((prev) => Math.max(5, prev - 10))}
                disabled={isProcessing}
              >
                <Minus size={12} />
              </button>
              <input
                type="range"
                min="5"
                max="200"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                disabled={isProcessing}
              />
              <button
                className="erase-brush-size-btn"
                onClick={() => setBrushSize((prev) => Math.min(200, prev + 10))}
                disabled={isProcessing}
              >
                <Plus size={12} />
              </button>
              <span className="erase-brush-size-value">{brushSize}px</span>
            </div>

            {/* Soft/Hard brush toggle */}
            <div className="erase-brush-type-toggle">
              <button
                className={`erase-brush-type-btn ${brushMode === 'soft' ? 'active' : ''}`}
                onClick={() => setBrushMode('soft')}
                disabled={isProcessing}
              >
                Soft
              </button>
              <button
                className={`erase-brush-type-btn ${brushMode === 'hard' ? 'active' : ''}`}
                onClick={() => setBrushMode('hard')}
                disabled={isProcessing}
              >
                Hard
              </button>
            </div>
          </div>
        )}

        {/* Undo/Redo buttons */}
        <div className="erase-brush-undo-redo">
          <button
            className="erase-brush-action-btn"
            onClick={handleUndo}
            disabled={!canUndo || isProcessing}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            className="erase-brush-action-btn"
            onClick={handleRedo}
            disabled={!canRedo || isProcessing}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <span className="erase-brush-undo-count">
            {historyIndex > 0 ? `${historyIndex} stroke${historyIndex > 1 ? 's' : ''}` : ''}
          </span>
        </div>

        {/* Advanced options toggle */}
        <button
          className="erase-brush-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Sliders size={12} />
          <span>Advanced Options</span>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && (
          <div className="erase-brush-advanced">
            {/* Strength slider */}
            <div className="erase-brush-slider-group">
              <label>
                Strength
                <span className="erase-brush-slider-value">{Math.round(strength * 100)}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="100"
                value={strength * 100}
                onChange={(e) => setStrength(parseInt(e.target.value) / 100)}
                disabled={isProcessing}
              />
              <div className="erase-brush-slider-labels">
                <span>Subtle</span>
                <span>Strong</span>
              </div>
            </div>

            {/* Mask opacity slider */}
            <div className="erase-brush-slider-group">
              <label>
                Mask Opacity
                <span className="erase-brush-slider-value">{Math.round(maskOpacity * 100)}%</span>
              </label>
              <div className="erase-brush-opacity-row">
                <button
                  className="erase-brush-opacity-btn"
                  onClick={() => setMaskOpacity(maskOpacity > 0 ? 0 : 0.6)}
                >
                  {maskOpacity > 0 ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={maskOpacity * 100}
                  onChange={(e) => setMaskOpacity(parseInt(e.target.value) / 100)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Variation count */}
            <div className="erase-brush-slider-group">
              <label>
                Generate Variations
                <span className="erase-brush-slider-value">{variationCount}</span>
              </label>
              <input
                type="range"
                min="1"
                max="4"
                value={variationCount}
                onChange={(e) => setVariationCount(parseInt(e.target.value))}
                disabled={isProcessing}
              />
              <div className="erase-brush-slider-labels">
                <span>1 (fast)</span>
                <span>4 (best)</span>
              </div>
            </div>
          </div>
        )}

        {/* Inpaint history */}
        {inpaintHistory.length > 0 && (
          <>
            <button
              className="erase-brush-history-toggle"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History size={12} />
              <span>History ({inpaintHistory.length})</span>
              {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showHistory && (
              <div className="erase-brush-history">
                {inpaintHistory.map((item, i) => (
                  <div key={i} className="erase-history-item">
                    <img src={item.thumbnail} alt={`History ${i + 1}`} />
                    <div className="erase-history-info">
                      <span className="erase-history-time">{item.timestamp}</span>
                      <button
                        className="erase-history-revert"
                        onClick={() => onRevert?.(i)}
                        disabled={isProcessing}
                      >
                        Revert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="erase-brush-shortcuts">
          {drawMode === 'brush' 
            ? '[ / ] size • Ctrl+Z undo • B brush • L lasso'
            : 'Click to add points • Enter/double-click to close • Esc to cancel'}
        </div>

        <div className="erase-brush-actions">
          <button
            className="erase-brush-btn secondary"
            onClick={handleClear}
            disabled={!hasStrokes || isProcessing}
          >
            Clear
          </button>
          <button
            className="erase-brush-btn secondary"
            onClick={onCancel}
            disabled={isProcessing}
          >
            <X size={14} />
            Cancel
          </button>
          <button
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
                Apply{variationCount > 1 ? ` (${variationCount}×)` : ''}
              </>
            )}
          </button>
        </div>

        {isProcessing && (
          <div className="erase-brush-progress">
            {variationCount > 1 
              ? `Generating ${variationCount} variations... This may take 30-60 seconds.`
              : 'AI is removing the selected areas. This may take 10-30 seconds...'}
          </div>
        )}
      </div>
    </div>
  );
}
