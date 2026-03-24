import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader, Image } from 'lucide-react';
import api from '../../../../services/api';

/**
 * GenerateTab — AI object generation via DALL-E 3.
 * User types a prompt, gets 2 transparent PNG options, clicks to place on canvas.
 */

const STYLE_HINTS = [
  'Gold Ornate',
  'Crystal',
  'Modern Minimal',
  'Vintage',
  'Floral',
  'Dark Gothic',
  'Pastel Soft',
];

export default function GenerateTab({ sceneId, canvasWidth, canvasHeight, onAddAsset, focusTarget, onClearFocus }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const promptRef = useRef(null);

  // Focus prompt textarea when requested
  useEffect(() => {
    if (focusTarget === 'generate-prompt' && promptRef.current) {
      promptRef.current.focus();
      if (onClearFocus) onClearFocus();
    }
  }, [focusTarget, onClearFocus]);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setResults([]);
    setError(null);
    startTimer();

    try {
      const { data } = await api.post(`/api/v1/scenes/${sceneId}/generate-object`, {
        prompt: prompt.trim(),
      });

      if (data.success && data.data?.options) {
        setResults(data.data.options);
        // Save to recent in localStorage
        try {
          const key = `studio-gen-${sceneId}`;
          const recent = JSON.parse(localStorage.getItem(key) || '[]');
          recent.unshift({ prompt: prompt.trim(), options: data.data.options, at: Date.now() });
          localStorage.setItem(key, JSON.stringify(recent.slice(0, 5)));
        } catch {}
      } else {
        setError('Generation failed. Please try again.');
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.response?.data?.error || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      stopTimer();
    }
  }, [prompt, sceneId, isGenerating]);

  const handleAddResult = useCallback((option) => {
    if (!onAddAsset) return;
    // Smart sizing: 25% of canvas width, preserve aspect ratio
    const cw = canvasWidth || 1920;
    const ch = canvasHeight || 1080;
    const srcW = option.width || 1024;
    const srcH = option.height || 1024;
    const aspect = srcW / srcH;
    let w = cw * 0.25;
    let h = w / aspect;
    if (h > ch * 0.35) { h = ch * 0.35; w = h * aspect; }

    onAddAsset({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      assetId: option.asset_id,
      assetUrl: option.url,
      x: Math.round(cw / 2 - w / 2),
      y: Math.round(ch / 2 - h / 2),
      width: Math.round(w),
      height: Math.round(h),
      rotation: 0,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      label: prompt.slice(0, 30) || 'AI Object',
      assetRole: 'ai_generated',
      usageType: 'overlay',
    });
  }, [prompt, canvasWidth, canvasHeight, onAddAsset]);

  const appendHint = (hint) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (trimmed.toLowerCase().includes(hint.toLowerCase())) return prev;
      return trimmed ? `${trimmed}, ${hint.toLowerCase()}` : hint.toLowerCase();
    });
  };

  return (
    <div className="scene-studio-generate-tab">
      <div className="scene-studio-section-label">AI Object Generator</div>

      {/* Prompt input */}
      <textarea
        ref={promptRef}
        className="scene-studio-gen-prompt"
        rows={3}
        placeholder='Describe an object, e.g. "ornate gold mirror" or "pink crystal chandelier"...'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleGenerate();
          }
        }}
        disabled={isGenerating}
      />

      {/* Style hints */}
      <div className="scene-studio-gen-hints">
        {STYLE_HINTS.map((hint) => (
          <button
            key={hint}
            className="scene-studio-gen-hint-chip"
            onClick={() => appendHint(hint)}
            disabled={isGenerating}
          >
            {hint}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        className="scene-studio-btn primary scene-studio-gen-btn"
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
      >
        {isGenerating ? (
          <>
            <Loader size={14} className="scene-studio-spin-icon" />
            <span>Generating... {elapsed}s</span>
          </>
        ) : (
          <>
            <Sparkles size={14} />
            <span>Generate</span>
          </>
        )}
      </button>

      {error && <div className="scene-studio-gen-error">{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="scene-studio-gen-results">
          <div className="scene-studio-section-label">Results — click to add</div>
          <div className="scene-studio-gen-grid">
            {results.map((option, i) => (
              <div
                key={option.asset_id || i}
                className="scene-studio-gen-result"
                onClick={() => handleAddResult(option)}
              >
                {option.url ? (
                  <img src={option.url} alt={`Option ${i + 1}`} />
                ) : (
                  <div className="scene-studio-no-thumb"><Image size={24} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading shimmer */}
      {isGenerating && (
        <div className="scene-studio-gen-results">
          <div className="scene-studio-gen-grid">
            <div className="scene-studio-gen-shimmer" />
            <div className="scene-studio-gen-shimmer" />
          </div>
        </div>
      )}
    </div>
  );
}
