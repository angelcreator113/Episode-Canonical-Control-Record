/**
 * ScenePlanLoader — Script → Scene Composer Bridge
 * 
 * This component appears in Scene Composer when:
 *   1. Episode has no scenes yet (fresh episode)
 *   2. Episode has a script with beats
 * 
 * It offers to pre-populate scenes from the script's beat structure.
 * 
 * Location: frontend/src/components/ScenePlanLoader.jsx
 */

import React, { useState, useCallback } from 'react';
import scriptParseService from '../services/scriptParseService';

function ScenePlanLoader({ episodeId, episode, onApply, onSkip }) {
  const [mode, setMode] = useState('prompt'); // 'prompt' | 'preview' | 'paste' | 'loading' | 'error'
  const [scenePlan, setScenePlan] = useState(null);
  const [pastedScript, setPastedScript] = useState('');
  const [error, setError] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  // Try to parse from episode's saved script
  const handleParseFromEpisode = useCallback(async () => {
    setMode('loading');
    setError(null);
    try {
      const result = await scriptParseService.parseEpisodeScript(episodeId);
      if (result.success && result.scenePlan?.scenes?.length > 0) {
        setScenePlan(result.scenePlan);
        setMode('preview');
      } else {
        setError('No beats found in the episode script. Use ## BEAT: tags to define scenes.');
        setMode('paste');
      }
    } catch (err) {
      // No script saved — offer to paste one
      setMode('paste');
    }
  }, [episodeId]);

  // Parse from pasted text
  const handleParsePasted = useCallback(async () => {
    if (!pastedScript.trim()) return;
    setMode('loading');
    setError(null);
    try {
      const result = await scriptParseService.parseRaw(pastedScript, episode?.title);
      if (result.success && result.scenePlan?.scenes?.length > 0) {
        setScenePlan(result.scenePlan);
        setMode('preview');
      } else {
        setError('No beats found. Make sure your script uses ## BEAT: tags.');
        setMode('paste');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse script');
      setMode('paste');
    }
  }, [pastedScript, episode]);

  // Apply the scene plan — create real scenes in DB
  const handleApply = useCallback(async () => {
    setIsApplying(true);
    try {
      const result = await scriptParseService.applyScenePlan(episodeId, {
        content: pastedScript || undefined,
        clearExisting: true,
      });
      if (result.success) {
        onApply(result.scenePlan, result.scenes);
      } else {
        setError('Failed to create scenes');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply scene plan');
    } finally {
      setIsApplying(false);
    }
  }, [episodeId, pastedScript, onApply]);

  // ─── PROMPT MODE ───
  if (mode === 'prompt') {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>📜</div>
        <h3 style={styles.heading}>Build Scenes from Script</h3>
        <p style={styles.subtext}>
          This episode has no scenes yet. Want to auto-generate scenes from a script?
        </p>
        <div style={styles.buttonRow}>
          <button onClick={handleParseFromEpisode} style={styles.primaryButton}>
            📖 Load from Episode Script
          </button>
          <button onClick={() => setMode('paste')} style={styles.secondaryButton}>
            📝 Paste Script
          </button>
        </div>
        <button onClick={onSkip} style={styles.skipButton}>
          Skip — start with blank scenes
        </button>
      </div>
    );
  }

  // ─── LOADING ───
  if (mode === 'loading') {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.icon, animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={styles.subtext}>Parsing script beats...</p>
      </div>
    );
  }

  // ─── PASTE MODE ───
  if (mode === 'paste') {
    return (
      <div style={styles.container}>
        <h3 style={styles.heading}>Paste Your Script</h3>
        <p style={styles.subtext}>
          Use <code style={styles.code}>## BEAT: NAME</code> tags to define scenes.
        </p>
        {error && <div style={styles.error}>{error}</div>}
        <textarea
          value={pastedScript}
          onChange={(e) => setPastedScript(e.target.value)}
          placeholder={`## BEAT: OPENING RITUAL
[CHARACTERS: justawoman]
[DURATION: 8s]
[MOOD: calm]

(Headphones on. Login sequence.)
JUSTAWOMAN: "Let's see what today brings."

## BEAT: INTERRUPTION — INVITE
[CHARACTERS: lala]
[UI:OPEN MailPanel]
[DURATION: 10s]

LALA: "Oh... this is interesting."`}
          style={styles.textarea}
          rows={12}
        />
        <div style={styles.buttonRow}>
          <button
            onClick={handleParsePasted}
            disabled={!pastedScript.trim()}
            style={{
              ...styles.primaryButton,
              opacity: pastedScript.trim() ? 1 : 0.5,
            }}
          >
            🔍 Parse Beats
          </button>
          <button onClick={onSkip} style={styles.secondaryButton}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── PREVIEW MODE ───
  if (mode === 'preview' && scenePlan) {
    return (
      <div style={styles.container}>
        <h3 style={styles.heading}>Scene Plan Preview</h3>
        <div style={styles.statsRow}>
          <span style={styles.stat}>🎬 {scenePlan.totalScenes} scenes</span>
          <span style={styles.stat}>⏱️ {scenePlan.formattedDuration}</span>
          <span style={styles.stat}>💬 {scenePlan.metadata.totalDialogueLines} lines</span>
        </div>

        <div style={styles.sceneList}>
          {scenePlan.scenes.map((scene, i) => (
            <div key={i} style={styles.sceneCard}>
              <div style={styles.sceneHeader}>
                <span style={styles.sceneNumber}>{scene.scene_number}</span>
                <span style={styles.sceneTitle}>{scene.title}</span>
                <span style={styles.sceneDuration}>{scene.duration_seconds}s</span>
              </div>
              <div style={styles.sceneMeta}>
                {scene.characters_expected.map((c, j) => (
                  <span key={j} style={styles.charBadge}>
                    {c.emoji} {c.name}
                  </span>
                ))}
                {scene.ui_expected.map((ui, j) => (
                  <span key={`ui-${j}`} style={styles.uiBadge}>
                    📱 {ui}
                  </span>
                ))}
                {scene.location_hint && (
                  <span style={styles.locationBadge}>
                    📍 {scene.location_hint}
                  </span>
                )}
              </div>
              <div style={styles.sceneSubMeta}>
                <span style={styles.densityDot(scene.density)} />
                {scene.density} · {scene.mood}
                {scene.dialogue_count > 0 && ` · ${scene.dialogue_count} lines`}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.buttonRow}>
          <button
            onClick={handleApply}
            disabled={isApplying}
            style={styles.primaryButton}
          >
            {isApplying ? '⏳ Creating Scenes...' : `✅ Create ${scenePlan.totalScenes} Scenes`}
          </button>
          <button onClick={() => setMode('paste')} style={styles.secondaryButton}>
            ← Edit Script
          </button>
          <button onClick={onSkip} style={styles.skipButton}>
            Cancel
          </button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // ─── ERROR FALLBACK ───
  return (
    <div style={styles.container}>
      <div style={styles.error}>{error || 'Something went wrong'}</div>
      <button onClick={onSkip} style={styles.secondaryButton}>Close</button>
    </div>
  );
}

// ─── STYLES ───

const styles = {
  container: {
    background: 'rgba(15, 15, 25, 0.95)',
    border: '1px solid rgba(102, 126, 234, 0.25)',
    borderRadius: '12px',
    padding: '20px',
    margin: '12px 0',
    textAlign: 'center',
  },
  icon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  heading: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 6px 0',
  },
  subtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    margin: '0 0 16px 0',
    lineHeight: 1.4,
  },
  code: {
    background: 'rgba(102, 126, 234, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#667eea',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  primaryButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  skipButton: {
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  textarea: {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '12px',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  error: {
    background: 'rgba(255, 75, 75, 0.1)',
    border: '1px solid rgba(255, 75, 75, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ff4b4b',
    fontSize: '12px',
    marginBottom: '12px',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  stat: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    fontWeight: 500,
  },
  sceneList: {
    maxHeight: '300px',
    overflowY: 'auto',
    textAlign: 'left',
  },
  sceneCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '6px',
  },
  sceneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  sceneNumber: {
    background: 'rgba(102, 126, 234, 0.2)',
    color: '#667eea',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  sceneTitle: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    flex: 1,
  },
  sceneDuration: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
    fontWeight: 500,
  },
  sceneMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginBottom: '4px',
  },
  charBadge: {
    background: 'rgba(102, 126, 234, 0.12)',
    border: '1px solid rgba(102, 126, 234, 0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
  },
  uiBadge: {
    background: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    color: 'rgba(34, 197, 94, 0.8)',
  },
  locationBadge: {
    background: 'rgba(234, 179, 8, 0.12)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    color: 'rgba(234, 179, 8, 0.8)',
  },
  sceneSubMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '11px',
  },
  densityDot: (density) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: density === 'high' ? '#ff4b4b' : density === 'medium' ? '#eab308' : '#22c55e',
    flexShrink: 0,
  }),
};

export default ScenePlanLoader;
