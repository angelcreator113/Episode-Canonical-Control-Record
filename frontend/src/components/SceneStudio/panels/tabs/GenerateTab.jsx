import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Loader, Image, History, Wand2, Trash2, AlertCircle, CheckCircle, Scissors, RotateCcw, Info, Upload, RefreshCw, Frame, Palette, Crop, Layers } from 'lucide-react';
import api from '../../../../services/api';

/**
 * GenerateTab — AI object generation (DALL-E 3) + Image Transform (img2img).
 * Features:
 * - Generate mode: text prompt → new object from scratch
 * - Transform mode: existing image → transformed with AI (frame it, restyle, etc.)
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

const TRANSFORM_PRESETS = [
  { key: 'frame', icon: Frame, label: 'Frame It', prompt: 'Ornate decorative picture frame around this image, wall-mounted art piece, gallery presentation, transparent background', strength: 0.7 },
  { key: 'restyle', icon: Palette, label: 'Style Transfer', prompt: '', strength: 0.55 },
  { key: 'crop-shape', icon: Crop, label: 'Crop to Shape', prompt: 'Circular vignette crop with soft feathered edges, isolated on transparent background', strength: 0.6 },
  { key: 'matting', icon: Layers, label: 'Add Matting', prompt: 'Professional photo matting and mounting, shadow box presentation, museum-quality display, transparent background', strength: 0.65 },
];

export default function GenerateTab({ sceneId, contextType, canvasWidth, canvasHeight, onAddAsset, focusTarget, onClearFocus, showId, episodeId }) {
  const [mode, setMode] = useState('generate'); // 'generate' | 'transform'
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

  // Transform mode state
  const [sourceImageUrl, setSourceImageUrl] = useState(null);
  const [sourceImageThumb, setSourceImageThumb] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [transformStrength, setTransformStrength] = useState(0.65);
  const transformFileRef = useRef(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const libraryFetchedRef = useRef(false);

  // Fetch library assets when picker is opened
  useEffect(() => {
    if (!showLibraryPicker || libraryFetchedRef.current) return;
    libraryFetchedRef.current = true;
    setLibraryLoading(true);
    const params = { limit: 200 };
    if (showId) params.show_id = showId;
    if (episodeId) params.episode_id = episodeId;
    api.get('/api/v1/assets', { params })
      .then(({ data }) => {
        const raw = data?.data || data?.assets || [];
        const list = Array.isArray(raw) ? raw : [];
        const images = list.filter((a) => {
          if (a.type === 'video' || a.asset_type === 'video') return false;
          // Must have at least one usable URL
          const url = a.s3_url_processed || a.s3_url_raw || a.url || a.thumbnail_url;
          return !!url;
        });
        setLibraryAssets(images);
      })
      .catch((err) => console.error('Failed to load library:', err))
      .finally(() => setLibraryLoading(false));
  }, [showLibraryPicker, showId, episodeId]);

  const getAssetUrl = (asset) => asset.s3_url_processed || asset.s3_url_raw || asset.url || null;
  const getAssetThumb = (asset) => asset.thumbnail_url || asset.metadata?.thumbnail_url || getAssetUrl(asset);

  const handleSelectLibraryAsset = useCallback((asset) => {
    const url = getAssetUrl(asset);
    const thumb = getAssetThumb(asset);
    if (!url) return;
    setSourceImageUrl(url);
    setSourceImageThumb(thumb);
    setShowLibraryPicker(false);
  }, []);

  // Focus prompt textarea when requested, or pre-fill from smart suggestion
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget === 'generate-prompt' && promptRef.current) {
      promptRef.current.focus();
      if (onClearFocus) onClearFocus();
    } else if (focusTarget.startsWith('generate-prefill:') && promptRef.current) {
      const prefill = focusTarget.slice('generate-prefill:'.length);
      setPrompt(prefill);
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

        // Warn if background removal was requested but skipped
        if (removeBackground && data.data.options.some(o => !o.background_removed)) {
          setError('Background removal unavailable — REMOVEBG_API_KEY not configured. Objects generated without transparent background.');
        }

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

  // ── Transform mode handlers ──

  const handleTransformUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImageThumb(reader.result);
    };
    reader.readAsDataURL(file);
    // Upload the file to get a URL
    const formData = new FormData();
    formData.append('file', file);
    api.post(`/api/v1/assets/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(({ data }) => {
        const url = data?.data?.url || data?.data?.s3_url_raw || data?.url;
        if (url) setSourceImageUrl(url);
      })
      .catch((err) => {
        console.error('Upload failed:', err);
        setError('Failed to upload source image');
      });
  }, []);

  const handleSelectPreset = useCallback((preset) => {
    setActivePreset(preset.key);
    if (preset.prompt) {
      setPrompt(preset.prompt);
    }
    setTransformStrength(preset.strength);
  }, []);

  const handleTransform = useCallback(async () => {
    if (!sourceImageUrl || !prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setResults([]);
    setError(null);
    startTimer();

    try {
      const basePath = contextType === 'sceneSet' ? 'scene-sets' : 'scenes';
      const { data } = await api.post(`/api/v1/${basePath}/${sceneId}/transform-object`, {
        image_url: sourceImageUrl,
        prompt: prompt.trim(),
        strength: transformStrength,
        remove_background: removeBackground,
      });

      if (data.success && data.data?.options) {
        setResults(data.data.options);
        if (removeBackground && data.data.options.some(o => !o.background_removed)) {
          setError('Background removal unavailable — objects transformed without transparent background.');
        }
      } else {
        setError('Transform failed. Please try again.');
      }
    } catch (err) {
      console.error('Transform error:', err);
      const msg = err.response?.data?.error || 'Transform failed.';
      const status = err.response?.status;
      if (status === 429) {
        setError(msg.includes('limit') ? msg : 'Rate limit reached. Please wait a few minutes.');
      } else {
        setError(msg);
      }
    } finally {
      setIsGenerating(false);
      stopTimer();
    }
  }, [sourceImageUrl, prompt, isGenerating, contextType, sceneId, transformStrength, removeBackground]);

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
      {/* Mode toggle: Generate vs Transform */}
      <div className="scene-studio-gen-mode-toggle">
        <button
          type="button"
          className={`scene-studio-gen-mode-btn ${mode === 'generate' ? 'active' : ''}`}
          onClick={() => { setMode('generate'); setResults([]); setError(null); }}
        >
          <Sparkles size={12} /> Generate
        </button>
        <button
          type="button"
          className={`scene-studio-gen-mode-btn ${mode === 'transform' ? 'active' : ''}`}
          onClick={() => { setMode('transform'); setResults([]); setError(null); }}
        >
          <RefreshCw size={12} /> Transform
        </button>
      </div>

      <div className="scene-studio-gen-header">
        <div className="scene-studio-section-label">
          {mode === 'generate' ? 'AI Object Generator' : 'Image Transform'}
        </div>
        <div className="scene-studio-gen-header-actions">
          {mode === 'generate' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ═══ Transform Mode ═══ */}
      {mode === 'transform' && (
        <>
          {/* Source image picker */}
          <div className="scene-studio-transform-source">
            <input
              ref={transformFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleTransformUpload}
            />
            {sourceImageThumb ? (
              <div className="scene-studio-transform-preview">
                <img src={sourceImageThumb} alt="Source" />
                <div className="scene-studio-transform-preview-actions">
                  <button
                    type="button"
                    className="scene-studio-transform-change-btn"
                    onClick={() => transformFileRef.current?.click()}
                  >
                    <Upload size={10} /> Upload New
                  </button>
                  <button
                    type="button"
                    className="scene-studio-transform-change-btn"
                    onClick={() => setShowLibraryPicker(true)}
                  >
                    <Image size={10} /> Library
                  </button>
                </div>
              </div>
            ) : (
              <div className="scene-studio-transform-source-options">
                <button
                  type="button"
                  className="scene-studio-transform-upload"
                  onClick={() => transformFileRef.current?.click()}
                >
                  <Upload size={18} />
                  <span>Upload</span>
                  <span className="scene-studio-transform-hint">JPG, PNG</span>
                </button>
                <button
                  type="button"
                  className="scene-studio-transform-upload"
                  onClick={() => setShowLibraryPicker(true)}
                >
                  <Image size={18} />
                  <span>From Library</span>
                  <span className="scene-studio-transform-hint">Your assets</span>
                </button>
              </div>
            )}

            {/* Library asset picker grid */}
            {showLibraryPicker && (
              <div className="scene-studio-transform-library">
                <div className="scene-studio-transform-library-header">
                  <span>Choose from Library</span>
                  <button
                    type="button"
                    className="scene-studio-icon-btn"
                    onClick={() => setShowLibraryPicker(false)}
                  >
                    ×
                  </button>
                </div>
                {libraryLoading ? (
                  <div className="scene-studio-transform-library-loading">
                    <Loader size={14} className="scene-studio-spin-icon" /> Loading...
                  </div>
                ) : libraryAssets.length === 0 ? (
                  <div className="scene-studio-transform-library-loading">No images found</div>
                ) : (
                  <div className="scene-studio-transform-library-grid">
                    {libraryAssets.map((asset) => {
                      const thumbSrc = getAssetThumb(asset);
                      if (!thumbSrc) return null;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          className="scene-studio-transform-library-thumb"
                          onClick={() => handleSelectLibraryAsset(asset)}
                          title={asset.label || asset.name || 'Asset'}
                        >
                          <img
                            src={thumbSrc}
                            alt={asset.label || 'Asset'}
                            loading="lazy"
                            onError={(e) => {
                              // Try fallback URL before hiding
                              const fallback = asset.s3_url_raw || asset.s3_url_processed || asset.url;
                              if (fallback && e.target.src !== fallback) {
                                e.target.src = fallback;
                              } else {
                                e.target.parentElement.style.display = 'none';
                              }
                            }}
                          />
                          <span className="scene-studio-transform-library-label">
                            {asset.label || asset.usage_type || 'Asset'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Everything below hidden while library picker is open */}
          {!showLibraryPicker && (<>
          {/* Transform presets */}
          <div className="scene-studio-section-label" style={{ marginTop: 8 }}>Transformation</div>
          <div className="scene-studio-transform-presets">
            {TRANSFORM_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`scene-studio-transform-preset ${activePreset === preset.key ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                  disabled={isGenerating}
                >
                  <Icon size={14} />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom prompt */}
          <div className="scene-studio-gen-prompt-wrap" style={{ marginTop: 6 }}>
            <textarea
              ref={promptRef}
              className="scene-studio-gen-prompt"
              rows={2}
              placeholder={activePreset === 'restyle' ? 'Describe the style: "oil painting", "watercolor", "art deco"...' : 'Customize the transform or leave preset...'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleTransform();
                }
              }}
              disabled={isGenerating}
            />
          </div>

          {/* Strength slider */}
          <div className="scene-studio-transform-strength">
            <label>Transform strength</label>
            <input
              type="range"
              min="10"
              max="90"
              value={Math.round(transformStrength * 100)}
              onChange={(e) => setTransformStrength(parseInt(e.target.value) / 100)}
              disabled={isGenerating}
            />
            <span className="scene-studio-transform-strength-value">{Math.round(transformStrength * 100)}%</span>
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
          </div>

          {/* Transform button */}
          <button
            className="scene-studio-btn primary scene-studio-gen-btn"
            onClick={handleTransform}
            disabled={isGenerating || !sourceImageUrl || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader size={14} className="scene-studio-spin-icon" />
                <span>Transforming... {elapsed}s</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Transform</span>
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
                <span className="scene-studio-section-label">Result — click to add</span>
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
                      <img src={option.url} alt={`Result ${i + 1}`} />
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
              <div className="scene-studio-gen-loading-text">
                <RefreshCw size={12} className="scene-studio-spin-icon" /> Transforming image...
              </div>
              <div className="scene-studio-gen-grid">
                <div className="scene-studio-gen-shimmer" />
              </div>
            </div>
          )}

          </>)}

          {/* Empty guidance */}
          {!isGenerating && results.length === 0 && !error && !sourceImageUrl && !showLibraryPicker && (
            <div className="scene-studio-gen-empty-state">
              <div className="scene-studio-gen-empty-icon"><RefreshCw size={20} /></div>
              <div className="scene-studio-gen-empty-title">Transform Images</div>
              <div className="scene-studio-gen-empty-text">
                Upload an existing image and transform it — frame as wall art, apply style transfer, crop to shape, or add professional matting.
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Generate Mode ═══ */}
      {mode === 'generate' && (
        <>
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
          <div className="scene-studio-gen-empty-text">
            Describe furniture, decor, or props to create transparent overlays for your scene.
          </div>
          <div className="scene-studio-gen-empty-examples">
            <button type="button" onClick={() => setPrompt('ornate gold mirror with cherub details')}>ornate gold mirror</button>
            <button type="button" onClick={() => setPrompt('pink velvet armchair with gold legs')}>velvet armchair</button>
            <button type="button" onClick={() => setPrompt('crystal chandelier with soft glow')}>crystal chandelier</button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
