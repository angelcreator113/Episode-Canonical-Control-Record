/**
 * ScriptEditor — Full Script Editor with Raw Mode + Analysis Panel
 * 
 * Replaces: EpisodeScripts.jsx (dialogue blocks)
 * 
 * Layout: Two-pane
 *   Left:  Raw script editor (textarea with toolbar)
 *   Right: Analysis results (beats, UI actions, warnings, metadata)
 * 
 * Features:
 *   - Full text editing (paste entire scripts)
 *   - Syntax-aware toolbar (insert beats, UI tags, mail tags)
 *   - Analyze button → parses beats, UI actions, warnings
 *   - Save to episode.script_content
 *   - "Send to Scene Composer" button
 *   - Quick templates (Login, Mail Interrupt, Voice Activate, Checklist)
 *   - Duration estimation from word count
 *   - Grammar warnings with autofix
 * 
 * Location: frontend/src/components/ScriptEditor.jsx
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import api from '../services/api';

// ─── BEAT TYPES ───
const BEAT_OPTIONS = [
  { value: 'OPENING_RITUAL', label: '🎬 Opening Ritual' },
  { value: 'CREATOR_WELCOME', label: '👋 Creator Welcome' },
  { value: 'INTERRUPTION', label: '📩 Interruption' },
  { value: 'REVEAL', label: '✨ Reveal' },
  { value: 'STAKES_INTENTION', label: '🎯 Stakes + Intention' },
  { value: 'TRANSFORMATION', label: '💫 Transformation' },
  { value: 'DELIVERABLE_CREATION', label: '🎨 Deliverable Creation' },
  { value: 'PAYOFF_CTA', label: '🎁 Payoff + CTA' },
  { value: 'CLIFFHANGER', label: '🔥 Cliffhanger' },
  { value: 'TRANSITION', label: '🔄 Transition' },
  { value: 'EVENT_TRAVEL', label: '✈️ Event Travel' },
  { value: 'EVENT_OUTCOME', label: '🏆 Event Outcome' },
];

// ─── QUICK TEMPLATES ───
const TEMPLATES = {
  login: {
    label: '🔐 Login Sequence',
    text: `## BEAT: OPENING_RITUAL
[UI:OPEN LoginWindow]
[UI:TYPE Username "JustAWomanInHerPrime"]
[UI:TYPE Password "••••••"]
[UI:CLICK LoginButton]
[UI:SFX LoginSuccessDing]
Prime: "Welcome back, besties — and bonjour to our new besties!"
`,
  },
  mailInterrupt: {
    label: '📩 Mail Interrupt',
    text: `## BEAT: INTERRUPTION #1
[UI:NOTIFICATION MailDing]
Prime: "Oh — Lala's got mail."
[UI:CLICK MailIcon]
[UI:OPEN MailPanel]
[MAIL: type=invite from="EVENT_NAME" prestige=4 cost=150]
[UI:DISPLAY InviteLetterOverlay]
Prime: "Bestie. This is major."
`,
  },
  voiceActivate: {
    label: '🎤 Voice Activate + Lala',
    text: `[UI:CLICK VoiceIcon]
[UI:VOICE_ACTIVATE Lala]
Lala: "Bestie, this is IT. I need the perfect look."
`,
  },
  checklist: {
    label: '✅ Transformation Checklist',
    text: `## BEAT: TRANSFORMATION
[UI:DISPLAY ToDoListOverlay]
Prime: "We're checking everything off — one by one."
[UI:OPEN ClosetCategory Outfit]
[UI:SCROLL ClosetItems x5]
[UI:ADD Outfit ITEM_NAME]
[UI:CHECK_ITEM Checklist:Outfit]
[UI:OPEN ClosetCategory Accessories]
[UI:SCROLL ClosetItems x3]
[UI:ADD Accessory ITEM_NAME]
[UI:CHECK_ITEM Checklist:Accessories]
`,
  },
  cliffhanger: {
    label: '🔥 Cliffhanger',
    text: `## BEAT: CLIFFHANGER
Lala: "Bestie… this is just the beginning."
Prime: "Next invite? Bigger. Bougier. You have to be there."
`,
  },
};

// ─── UI TAG INSERTS ───
const UI_TAGS = [
  { label: 'Open', insert: '[UI:OPEN ]' },
  { label: 'Close', insert: '[UI:CLOSE ]' },
  { label: 'Click', insert: '[UI:CLICK ]' },
  { label: 'Display', insert: '[UI:DISPLAY ]' },
  { label: 'Hide', insert: '[UI:HIDE ]' },
  { label: 'Type', insert: '[UI:TYPE Field "value"]' },
  { label: 'Notification', insert: '[UI:NOTIFICATION ]' },
  { label: 'Voice Activate', insert: '[UI:VOICE_ACTIVATE Lala]' },
  { label: 'Scroll', insert: '[UI:SCROLL Target x5]' },
  { label: 'Add Item', insert: '[UI:ADD Category ItemName]' },
  { label: 'Check Item', insert: '[UI:CHECK_ITEM Checklist:Item]' },
  { label: 'SFX', insert: '[UI:SFX SoundName]' },
  { label: 'Set Background', insert: '[UI:SET_BACKGROUND SceneName]' },
];


function ScriptEditor({ episodeId, episode, onScriptSaved }) {
  const [scriptContent, setScriptContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showToolbar, setShowToolbar] = useState('beats'); // 'beats' | 'ui' | 'templates'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const textareaRef = useRef(null);

  // Load existing script content
  useEffect(() => {
    if (episode?.script_content) {
      setScriptContent(episode.script_content);
    } else if (episodeId) {
      // Try loading from episode_scripts table
      loadScript();
    }
  }, [episode, episodeId]);

  const loadScript = async () => {
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}`);
      if (res.data?.script_content) {
        setScriptContent(res.data.script_content);
      }
    } catch (e) { /* episode might not have script yet */ }
  };

  // ─── INSERT AT CURSOR ───
  const insertAtCursor = useCallback((text) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = scriptContent.substring(0, start);
    const after = scriptContent.substring(end);
    
    // Add newlines if needed
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n');
    const needNewlineAfter = after.length > 0 && !after.startsWith('\n');
    
    const insert = (needNewlineBefore ? '\n' : '') + text + (needNewlineAfter ? '\n' : '');
    const newContent = before + insert + after;
    
    setScriptContent(newContent);
    setHasUnsavedChanges(true);

    // Set cursor position after insert
    setTimeout(() => {
      const cursorPos = start + insert.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 10);
  }, [scriptContent]);

  // ─── SAVE SCRIPT ───
  const handleSave = useCallback(async () => {
    if (!episodeId) return;
    setIsSaving(true);
    setSaveStatus('Saving...');
    setError(null);

    try {
      await api.put(`/api/v1/episodes/${episodeId}`, {
        script_content: scriptContent,
      });
      setSaveStatus('Saved ✓');
      setHasUnsavedChanges(false);
      if (onScriptSaved) onScriptSaved(scriptContent);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('');
      setError('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  }, [episodeId, scriptContent, onScriptSaved]);

  // Ctrl+S to save
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSave]);

  // ─── ANALYZE SCRIPT ───
  const handleAnalyze = useCallback(async () => {
    if (!scriptContent.trim()) {
      setError('Write or paste a script first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Save first
      if (episodeId && hasUnsavedChanges) {
        await api.put(`/api/v1/episodes/${episodeId}`, {
          script_content: scriptContent,
        });
        setHasUnsavedChanges(false);
      }

      // Parse
      const res = await api.post('/api/v1/scripts/parse', {
        content: scriptContent,
        title: episode?.title,
      });

      if (res.data.success) {
        setAnalysis(res.data.scenePlan);
        setShowRightPanel(true);
      } else {
        setError('Analysis failed: ' + (res.data.error || 'Unknown error'));
      }
    } catch (err) {
      setError('Analysis failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsAnalyzing(false);
    }
  }, [scriptContent, episodeId, episode, hasUnsavedChanges]);

  // ─── SEND TO SCENE COMPOSER ───
  const handleSendToSceneComposer = useCallback(async () => {
    if (!episodeId || !analysis) return;

    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/apply-scene-plan`, {
        content: scriptContent,
        clearExisting: true,
      });

      if (res.data.success) {
        alert(`✅ ${res.data.scenesCreated} scenes created! Open Scene Composer to build visuals.`);
      }
    } catch (err) {
      setError('Failed to create scenes: ' + (err.response?.data?.error || err.message));
    }
  }, [episodeId, analysis, scriptContent]);

  // ─── AUTOFIX ───
  const handleAutofix = useCallback((warning) => {
    if (!warning.autofix?.available) return;

    if (warning.autofix.action === 'insert_voice_activate' && warning.at?.line) {
      const lines = scriptContent.split('\n');
      const insertIndex = warning.at.line - 2; // Insert before the Lala line
      lines.splice(Math.max(0, insertIndex), 0, '[UI:CLICK VoiceIcon]', '[UI:VOICE_ACTIVATE Lala]');
      setScriptContent(lines.join('\n'));
      setHasUnsavedChanges(true);
    }

    if (warning.autofix.action === 'insert_login_template') {
      const loginBlock = TEMPLATES.login.text;
      if (!scriptContent.includes('LoginWindow')) {
        // Insert at the top or after first beat header
        const firstBeatIdx = scriptContent.indexOf('## BEAT:');
        if (firstBeatIdx >= 0) {
          const nextLineIdx = scriptContent.indexOf('\n', firstBeatIdx) + 1;
          const newContent = scriptContent.substring(0, nextLineIdx) + loginBlock + '\n' + scriptContent.substring(nextLineIdx);
          setScriptContent(newContent);
        } else {
          setScriptContent(loginBlock + '\n' + scriptContent);
        }
        setHasUnsavedChanges(true);
      }
    }
  }, [scriptContent]);

  // ─── LINE + WORD COUNT ───
  const lineCount = scriptContent.split('\n').length;
  const wordCount = scriptContent.trim() ? scriptContent.trim().split(/\s+/).length : 0;
  const beatCount = (scriptContent.match(/##\s*BEAT:/gi) || []).length;

  return (
    <div style={styles.container}>
      {/* ─── HEADER ─── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>📜</span>
          <h2 style={styles.headerTitle}>Script</h2>
          <span style={styles.headerSub}>Full episode script editor</span>
        </div>
        <div style={styles.headerRight}>
          {saveStatus && <span style={styles.saveStatus}>{saveStatus}</span>}
          {hasUnsavedChanges && <span style={styles.unsaved}>● Unsaved</span>}
          <button onClick={handleSave} disabled={isSaving} style={styles.saveBtn}>
            💾 Save{isSaving ? '...' : ''} <span style={styles.shortcut}>Ctrl+S</span>
          </button>
          <button onClick={handleAnalyze} disabled={isAnalyzing} style={styles.analyzeBtn}>
            {isAnalyzing ? '⏳ Analyzing...' : '🔍 Analyze Script'}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* ─── TWO-PANE LAYOUT ─── */}
      <div style={styles.twoPane}>
        {/* ─── LEFT: EDITOR ─── */}
        <div style={{ ...styles.leftPane, flex: showRightPanel ? '1 1 55%' : '1 1 100%' }}>
          
          {/* Toolbar */}
          <div style={styles.toolbar}>
            <div style={styles.toolbarTabs}>
              <button
                onClick={() => setShowToolbar('beats')}
                style={showToolbar === 'beats' ? styles.toolbarTabActive : styles.toolbarTab}
              >
                🎬 Beats
              </button>
              <button
                onClick={() => setShowToolbar('ui')}
                style={showToolbar === 'ui' ? styles.toolbarTabActive : styles.toolbarTab}
              >
                📱 UI Tags
              </button>
              <button
                onClick={() => setShowToolbar('templates')}
                style={showToolbar === 'templates' ? styles.toolbarTabActive : styles.toolbarTab}
              >
                📋 Templates
              </button>
            </div>

            <div style={styles.toolbarContent}>
              {showToolbar === 'beats' && (
                <div style={styles.toolbarRow}>
                  {BEAT_OPTIONS.map(beat => (
                    <button
                      key={beat.value}
                      onClick={() => insertAtCursor(`\n## BEAT: ${beat.value}\n`)}
                      style={styles.toolbarBtn}
                      title={`Insert ${beat.label} beat header`}
                    >
                      {beat.label}
                    </button>
                  ))}
                </div>
              )}

              {showToolbar === 'ui' && (
                <div style={styles.toolbarRow}>
                  {UI_TAGS.map(tag => (
                    <button
                      key={tag.label}
                      onClick={() => insertAtCursor(tag.insert)}
                      style={styles.toolbarBtn}
                      title={`Insert ${tag.insert}`}
                    >
                      {tag.label}
                    </button>
                  ))}
                  <button
                    onClick={() => insertAtCursor('[MAIL: type=invite from="NAME" prestige=4 cost=150]')}
                    style={styles.toolbarBtn}
                  >
                    📨 Mail Tag
                  </button>
                  <button
                    onClick={() => insertAtCursor('[STAT: coins +100]')}
                    style={styles.toolbarBtn}
                  >
                    📊 Stat Tag
                  </button>
                </div>
              )}

              {showToolbar === 'templates' && (
                <div style={styles.toolbarRow}>
                  {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                    <button
                      key={key}
                      onClick={() => insertAtCursor(tmpl.text)}
                      style={styles.templateBtn}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={scriptContent}
            onChange={(e) => {
              setScriptContent(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder={`Paste your full script here, or use the toolbar to build one.

Example:

## BEAT: OPENING_RITUAL
[UI:OPEN LoginWindow]
[UI:TYPE Username "JustAWomanInHerPrime"]
[UI:CLICK LoginButton]
Prime: "Welcome back, besties!"

## BEAT: INTERRUPTION #1
[UI:NOTIFICATION MailDing]
Prime: "Oh — Lala's got mail."
[UI:CLICK MailIcon]
[UI:OPEN MailPanel]

## BEAT: REVEAL #1
Prime: "Bestie. MAISON. BELLE."
[UI:CLICK VoiceIcon]
[UI:VOICE_ACTIVATE Lala]
Lala: "This is my moment!"

## BEAT: TRANSFORMATION
[UI:DISPLAY ToDoListOverlay]
[UI:OPEN ClosetCategory Outfit]
[UI:SCROLL ClosetItems x5]
[UI:ADD Outfit SoftPinkCorsetDress]
[UI:CHECK_ITEM Checklist:Outfit]

## BEAT: CLIFFHANGER
Lala: "Bestie… this is just the beginning."`}
            style={styles.textarea}
            spellCheck={false}
          />

          {/* Status bar */}
          <div style={styles.statusBar}>
            <span>{lineCount} lines</span>
            <span>{wordCount} words</span>
            <span>{beatCount} beats</span>
            <span>~{Math.ceil(wordCount / 2.2)}s dialogue</span>
          </div>
        </div>

        {/* ─── RIGHT: ANALYSIS PANEL ─── */}
        {showRightPanel && analysis && (
          <div style={styles.rightPane}>
            <div style={styles.rightHeader}>
              <h3 style={styles.rightTitle}>📊 Analysis</h3>
              <button onClick={() => setShowRightPanel(false)} style={styles.closePanel}>✕</button>
            </div>

            {/* Stats Overview */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{analysis.totalScenes || analysis.metadata?.totalBeats}</div>
                <div style={styles.statLabel}>Beats</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{analysis.formattedDuration || analysis.metadata?.formattedDuration}</div>
                <div style={styles.statLabel}>Duration</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{analysis.metadata?.totalDialogueLines || 0}</div>
                <div style={styles.statLabel}>Dialogue</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{analysis.metadata?.totalUiActions || analysis.ui_actions?.length || 0}</div>
                <div style={styles.statLabel}>UI Actions</div>
              </div>
            </div>

            {/* Warnings */}
            {analysis.warnings && analysis.warnings.length > 0 && (
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>⚠️ Warnings</h4>
                {analysis.warnings.map((w, i) => (
                  <div key={i} style={styles.warningCard}>
                    <div style={styles.warningText}>{w.message}</div>
                    {w.autofix?.available && (
                      <button
                        onClick={() => handleAutofix(w)}
                        style={styles.autofixBtn}
                      >
                        🔧 Auto-fix
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Beat Structure */}
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>🎬 Beat Structure</h4>
              {(analysis.beats || analysis.scenes || []).map((beat, i) => {
                const confidence = beat.confidence || 'confident';
                const icon = confidence === 'confident' ? '✓' : confidence === 'review' ? '⚠' : '❌';
                return (
                  <div key={i} style={styles.beatCard}>
                    <div style={styles.beatHeader}>
                      <span style={styles.beatConfidence(confidence)}>{icon}</span>
                      <span style={styles.beatName}>{beat.title || beat.type}</span>
                      <span style={styles.beatDuration}>{beat.duration_s || beat.duration_seconds}s</span>
                    </div>
                    <div style={styles.beatMeta}>
                      {(beat.speakers || beat.characters_expected || []).map((s, j) => {
                        const name = typeof s === 'string' ? s : s.name;
                        const emoji = typeof s === 'string' ? '' : (s.emoji || '');
                        return (
                          <span key={j} style={styles.speakerBadge}>{emoji} {name}</span>
                        );
                      })}
                      {beat.dialogue_count > 0 && (
                        <span style={styles.dialogueBadge}>💬 {beat.dialogue_count}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* UI Actions by Beat */}
            {(analysis.ui_actions || []).length > 0 && (
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>📱 UI Actions</h4>
                {(analysis.beats || analysis.scenes || []).map((beat, i) => {
                  const beatActions = (analysis.ui_actions || []).filter(
                    a => a.beat_temp_id === beat.temp_id
                  );
                  if (beatActions.length === 0) return null;
                  return (
                    <div key={i} style={styles.uiGroup}>
                      <div style={styles.uiGroupTitle}>{beat.title || beat.type}</div>
                      {beatActions.map((a, j) => (
                        <div key={j} style={styles.uiAction}>
                          <span style={styles.uiType}>{a.type.toUpperCase()}</span>
                          <span style={styles.uiTarget}>{a.target}</span>
                          <span style={styles.uiDuration}>{a.duration_s}s</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div style={styles.actionButtons}>
              <button onClick={handleSendToSceneComposer} style={styles.sceneComposerBtn}>
                🎬 Send to Scene Composer
              </button>
              <button onClick={handleAnalyze} style={styles.reanalyzeBtn}>
                🔄 Re-analyze
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── STYLES ───

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '600px',
    background: '#0f0f19',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    flexWrap: 'wrap',
    gap: '8px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerIcon: { fontSize: '20px' },
  headerTitle: { color: '#fff', fontSize: '16px', fontWeight: 700, margin: 0 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: '13px' },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  saveStatus: { color: '#22c55e', fontSize: '12px', fontWeight: 600 },
  unsaved: { color: '#eab308', fontSize: '12px' },
  saveBtn: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  shortcut: {
    fontSize: '10px',
    opacity: 0.5,
    background: 'rgba(255,255,255,0.1)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  analyzeBtn: {
    padding: '6px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'rgba(255, 75, 75, 0.1)',
    borderBottom: '1px solid rgba(255, 75, 75, 0.2)',
    color: '#ff4b4b',
    fontSize: '13px',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#ff4b4b',
    cursor: 'pointer',
    fontSize: '14px',
  },
  twoPane: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPane: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },

  // Toolbar
  toolbar: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  toolbarTabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  toolbarTab: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  toolbarTabActive: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    color: '#667eea',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    borderBottom: '2px solid #667eea',
  },
  toolbarContent: {
    padding: '6px 8px',
    maxHeight: '80px',
    overflowY: 'auto',
  },
  toolbarRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  toolbarBtn: {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  templateBtn: {
    padding: '6px 12px',
    background: 'rgba(102, 126, 234, 0.1)',
    border: '1px solid rgba(102, 126, 234, 0.25)',
    borderRadius: '6px',
    color: '#667eea',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Textarea
  textarea: {
    flex: 1,
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '16px',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    tabSize: 2,
  },

  // Status bar
  statusBar: {
    display: 'flex',
    gap: '16px',
    padding: '6px 16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
  },

  // Right pane
  rightPane: {
    flex: '0 0 45%',
    maxWidth: '45%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.02)',
  },
  rightHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rightTitle: { color: '#fff', fontSize: '14px', fontWeight: 700, margin: 0 },
  closePanel: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '16px',
    cursor: 'pointer',
  },

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    padding: '10px 14px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    padding: '8px',
    textAlign: 'center',
  },
  statValue: { color: '#fff', fontSize: '18px', fontWeight: 700 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' },

  // Sections
  section: {
    padding: '10px 14px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    overflowY: 'auto',
    flex: 1,
  },
  sectionTitle: { color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' },

  // Beat cards
  beatCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '4px',
  },
  beatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  beatConfidence: (level) => ({
    fontSize: '12px',
    color: level === 'confident' ? '#22c55e' : level === 'review' ? '#eab308' : '#ff4b4b',
    fontWeight: 700,
  }),
  beatName: { color: '#fff', fontSize: '13px', fontWeight: 600, flex: 1 },
  beatDuration: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
  beatMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  },
  speakerBadge: {
    background: 'rgba(102, 126, 234, 0.12)',
    border: '1px solid rgba(102, 126, 234, 0.2)',
    borderRadius: '4px',
    padding: '1px 6px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.6)',
  },
  dialogueBadge: {
    padding: '1px 6px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
  },

  // Warnings
  warningCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(234, 179, 8, 0.08)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
    borderRadius: '6px',
    marginBottom: '4px',
  },
  warningText: { color: '#eab308', fontSize: '12px', flex: 1 },
  autofixBtn: {
    padding: '3px 8px',
    background: 'rgba(234, 179, 8, 0.15)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderRadius: '4px',
    color: '#eab308',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginLeft: '8px',
  },

  // UI Actions
  uiGroup: { marginBottom: '8px' },
  uiGroupTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  uiAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 8px',
    marginBottom: '2px',
    fontSize: '12px',
  },
  uiType: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '90px',
  },
  uiTarget: { color: 'rgba(255,255,255,0.7)', flex: 1 },
  uiDuration: { color: 'rgba(255,255,255,0.3)', fontSize: '11px' },

  // Action buttons
  actionButtons: {
    padding: '12px 14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    gap: '8px',
  },
  sceneComposerBtn: {
    flex: 1,
    padding: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  reanalyzeBtn: {
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default ScriptEditor;
