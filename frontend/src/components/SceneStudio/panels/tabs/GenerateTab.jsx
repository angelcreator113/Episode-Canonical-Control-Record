import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Loader, Image, History, Wand2, Trash2, AlertCircle, CheckCircle, Scissors, RotateCcw, Info } from 'lucide-react';
import api from '../../../../services/api';

/**
 * GenerateTab — Enhanced AI object generation via DALL-E 3.
 * Features:
 * - Prompt enhancement with AI
 * - Background removal option
 * - Generation history with quick re-use
 * - Style hints with visual swatches
 * - Duplicate detection
 * - Improved error handling
 */

const STYLE_HINTS = [
  { label: 'Gold Ornate', color: '#D4AF37', desc: 'Luxurious gold accents' },
  { label: 'Crystal', color: '#E8E8F0', desc: 'Sparkling glass/crystal' },
  { label: 'Modern Minimal', color: '#F5F5F5', desc: 'Clean, simple lines' },
  { label: 'Vintage', color: '#D2B48C', desc: 'Aged, antique feel' },
  { label: 'Floral', color: '#FFB7C5', desc: 'Botanical patterns' },
  { label: 'Dark Gothic', color: '#2C2C2C', desc: 'Dramatic, moody' },
  { label: 'Pastel Soft', color: '#FFE4E9', desc: 'Gentle, dreamy tones' },
  { label: 'Pink Velvet', color: '#D87093', desc: 'Luxe pink textures' },
  { label: 'Wood Natural', color: '#8B7355', desc: 'Warm wood grains' },
];

const PROMPT_TIPS = [
  'Be specific: "ornate gold mirror with cherub details" > "mirror"',
  'Include materials: velvet, silk, marble, crystal, brass',
  'Add style: art deco, rococo, minimalist, bohemian',
  'Specify size context: bedside, floor-length, tabletop',
];

const STORAGE_KEY_PREFIX = 'studio-gen-history-';
const MAX_HISTORY = 20;

export default function GenerateTab({ sceneId, contextType, canvasWidth, canvasHeight, onAddAsset, focusTarget, onClearFocus }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);
  const promptRef = useRef(null);

  // Focus prompt textarea when requested
  useEffect(() => {
    if (focusTarget === 'generate-prompt' && promptRef.current) {
      promptRef.current.focus();
      if (onClearFocus) onClearFocus();
    }
  }, [focusTarget, onClearFocus]);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + sceneId);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, [sceneId]);

  // Check for duplicate prompt in recent history
  const isDuplicate = useMemo(() => {
    const normalized = prompt.trim().toLowerCase();
    return history.some(h => h.prompt.toLowerCase() === normalized);
  }, [prompt, history]);

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

  // AI prompt enhancement
  const handleEnhancePrompt = useCallback(async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setError(null);

    try {
      const { data } = await api.post('/api/v1/memories/ai/enhance-prompt', {
        prompt: prompt.trim(),
        context: 'scene_studio_object',
      });

      if (data.success && data.enhanced) {
        setPrompt(data.enhanced);
      }
    } catch (err) {
      console.error('Enhance error:', err);
      // Non-blocking - just continue with original prompt
    } finally {
      setIsEnhancing(false);
    }
  }, [prompt, isEnhancing]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setResults([]);
    setError(null);
    startTimer();

    try {
      // Optionally enhance prompt first
      let finalPrompt = prompt.trim();
      if (enhancePrompt && !isEnhancing) {
        try {
          const { data: enhanceData } = await api.post('/api/v1/memories/ai/enhance-prompt', {
            prompt: finalPrompt,
            context: 'scene_studio_object',
          });
          if (enhanceData.success && enhanceData.enhanced) {
            finalPrompt = enhanceData.enhanced;
          }
        } catch {}
      }

      const basePath = contextType === 'sceneSet' ? 'scene-sets' : 'scenes';
      const { data } = await api.post(`/api/v1/${basePath}/${sceneId}/generate-object`, {
        prompt: finalPrompt,
        remove_background: removeBackground,
        original_prompt: prompt.trim(),
      });

      if (data.success && data.data?.options) {
        setResults(data.data.options);

        // Save to history
        const newEntry = {
          id: Date.now(),
          prompt: prompt.trim(),
          options: data.data.options,
          at: Date.now(),
          bgRemoved: removeBackground,
        };
        setHistory((prev) => {
          const updated = [newEntry, ...prev.filter(h => h.prompt.toLowerCase() !== prompt.trim().toLowerCase())];
          const limited = updated.slice(0, MAX_HISTORY);
          try {
            localStorage.setItem(STORAGE_KEY_PREFIX + sceneId, JSON.stringify(limited));
          } catch {}
          return limited;
        });
      } else {
        setError('Generation failed. Please try a different prompt.');
      }
    } catch (err) {
      console.error('Generate error:', err);
      const msg = err.response?.data?.error || 'Generation failed.';
      const status = err.response?.status;
      // User-friendly error messages
      if (msg.includes('limit')) {
        setError('You\'ve reached the generation limit (20/hour). Try again in a few minutes.');
      } else if (msg.includes('in progress')) {
        setError('Another generation is in progress. Please wait for it to complete.');
      } else if (msg.includes('not configured') || msg.includes('OPENAI_API_KEY')) {
        setError('DALL-E image generation is not configured on this server. The OPENAI_API_KEY environment variable needs to be set.');
      } else if (status === 404) {
        setError('Generate endpoint not found. This feature may not be available for this context.');
      } else {
        setError(msg);
      }
    } finally {
      setIsGenerating(false);
      stopTimer();
    }
  }, [prompt, sceneId, isGenerating, removeBackground, enhancePrompt, isEnhancing]);

  const handleAddResult = useCallback((option) => {
    if (!onAddAsset) return;
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

  const loadFromHistory = (entry) => {
    setPrompt(entry.prompt);
    setResults(entry.options || []);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + sceneId);
    } catch {}
  };

  return (
    <div className="scene-studio-generate-tab">
      <div className="scene-studio-gen-header">
        <div className="scene-studio-section-label">AI Object Generator</div>
        <div className="scene-studio-gen-header-actions">
          <button
            className={`scene-studio-gen-icon-btn ${showTips ? 'active' : ''}`}
            onClick={() => setShowTips(!showTips)}
            title="Prompt tips"
          >
            <Info size={14} />
          </button>
          <button
            className={`scene-studio-gen-icon-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            title="Generation history"
          >
            <History size={14} />
            {history.length > 0 && <span className="scene-studio-gen-badge">{history.length}</span>}
          </button>
        </div>
      </div>

      {/* Tips panel */}
      {showTips && (
        <div className="scene-studio-gen-tips">
          {PROMPT_TIPS.map((tip, i) => (
            <div key={i} className="scene-studio-gen-tip">• {tip}</div>
          ))}
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="scene-studio-gen-history">
          <div className="scene-studio-gen-history-header">
            <span>Recent Generations</span>
            {history.length > 0 && (
              <button className="scene-studio-gen-clear-btn" onClick={clearHistory}>
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="scene-studio-gen-empty">No generation history yet</div>
          ) : (
            <div className="scene-studio-gen-history-list">
              {history.slice(0, 8).map((entry) => (
                <button
                  key={entry.id}
                  className="scene-studio-gen-history-item"
                  onClick={() => loadFromHistory(entry)}
                >
                  {entry.options?.[0]?.url && (
                    <img src={entry.options[0].url} alt="" className="scene-studio-gen-history-thumb" />
                  )}
                  <span className="scene-studio-gen-history-prompt">{entry.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt input */}
      <div className="scene-studio-gen-prompt-wrap">
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
        {prompt.trim() && !isGenerating && (
          <button
            className="scene-studio-gen-enhance-btn"
            onClick={handleEnhancePrompt}
            disabled={isEnhancing}
            title="Enhance prompt with AI"
          >
            {isEnhancing ? <Loader size={12} className="scene-studio-spin-icon" /> : <Wand2 size={12} />}
          </button>
        )}
      </div>

      {/* Duplicate warning */}
      {isDuplicate && !isGenerating && (
        <div className="scene-studio-gen-duplicate">
          <RotateCcw size={12} /> This prompt was generated before. Results are in history.
        </div>
      )}

      {/* Style hints with swatches */}
      <div className="scene-studio-gen-hints">
        {STYLE_HINTS.map((hint) => (
          <button
            key={hint.label}
            className="scene-studio-gen-hint-chip"
            onClick={() => appendHint(hint.label)}
            disabled={isGenerating}
            title={hint.desc}
          >
            <span
              className="scene-studio-gen-hint-swatch"
              style={{ background: hint.color }}
            />
            {hint.label}
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="scene-studio-gen-options">
        <label className="scene-studio-gen-option">
          <input
            type="checkbox"
            checked={removeBackground}
            onChange={(e) => setRemoveBackground(e.target.checked)}
            disabled={isGenerating}
          />
          <Scissors size={12} />
          <span>Remove background</span>
        </label>
        <label className="scene-studio-gen-option">
          <input
            type="checkbox"
            checked={enhancePrompt}
            onChange={(e) => setEnhancePrompt(e.target.checked)}
            disabled={isGenerating}
          />
          <Wand2 size={12} />
          <span>Auto-enhance prompt</span>
        </label>
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

      {error && (
        <div className="scene-studio-gen-error">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="scene-studio-gen-results">
          <div className="scene-studio-gen-results-header">
            <span className="scene-studio-section-label">Results — click to add</span>
            {results[0]?.background_removed && (
              <span className="scene-studio-gen-bg-badge">
                <CheckCircle size={10} /> BG Removed
              </span>
            )}
          </div>
          <div className="scene-studio-gen-grid">
            {results.map((option, i) => (
              <div
                key={option.asset_id || i}
                className="scene-studio-gen-result"
                onClick={() => handleAddResult(option)}
                title="Click to add to canvas"
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

      {/* Loading shimmer with preview text */}
      {isGenerating && (
        <div className="scene-studio-gen-results">
          <div className="scene-studio-gen-loading-text">
            <Sparkles size={12} /> Creating "{prompt.slice(0, 40)}{prompt.length > 40 ? '...' : ''}"
          </div>
          <div className="scene-studio-gen-grid">
            <div className="scene-studio-gen-shimmer" />
            <div className="scene-studio-gen-shimmer" />
          </div>
        </div>
      )}

      {/* Empty state guidance */}
      {!isGenerating && results.length === 0 && !error && (
        <div className="scene-studio-gen-empty-state">
          <Sparkles size={20} className="scene-studio-gen-empty-icon" />
          <div className="scene-studio-gen-empty-title">Generate AI Objects</div>
          <div className="scene-studio-gen-empty-desc">
            Describe furniture, decor, or props to create transparent overlays for your scene.
          </div>
          <div className="scene-studio-gen-empty-examples">
            <span onClick={() => setPrompt('ornate gold mirror with cherub details')}>ornate gold mirror</span>
            <span onClick={() => setPrompt('pink velvet armchair with gold legs')}>velvet armchair</span>
            <span onClick={() => setPrompt('crystal chandelier with soft glow')}>crystal chandelier</span>
          </div>
        </div>
      )}
    </div>
  );
}
