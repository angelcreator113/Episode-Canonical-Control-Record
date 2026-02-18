/**
 * ScriptEditor v3 — Light Theme + Format Script + Beat Inference
 * 
 * Changes from v2:
 *   - Light theme (white background, dark text)
 *   - "Format Script" button — normalizes messy pastes into clean lines
 *   - normalizeScript() — splits speakers, tags, and stage directions onto own lines
 *   - inferBeats() — auto-inserts ## BEAT: headers based on anchor detection
 *   - "Me:" → "Prime:" normalization
 * 
 * Replaces: frontend/src/components/ScriptEditor.jsx
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
    text: `## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me — I'm ready for a new slay."\n\n## BEAT: CREATOR_WELCOME\n[UI:OPEN LoginWindow]\n[UI:TYPE Username "JustAWomanInHerPrime"]\n[UI:TYPE Password "••••••"]\n[UI:CLICK LoginButton]\n[UI:SFX LoginSuccessDing]\nPrime: "Welcome back, besties — and bonjour to our new besties!"\n`,
  },
  mailInterrupt: {
    label: '📩 Mail Interrupt',
    text: `## BEAT: INTERRUPTION #1\n[UI:NOTIFICATION MailDing]\nPrime: "Oh — Lala's got mail."\n[UI:CLICK MailIcon]\n[UI:OPEN MailPanel]\n[MAIL: type=invite from="EVENT_NAME" prestige=4 cost=150]\n[UI:DISPLAY InviteLetterOverlay]\nPrime: "Bestie. This is major."\n`,
  },
  voiceActivate: {
    label: '🎤 Voice Activate + Lala',
    text: `[UI:CLICK VoiceIcon]\n[UI:VOICE_ACTIVATE Lala]\nLala: "Bestie, this is IT. I need the perfect look."\n`,
  },
  checklist: {
    label: '✅ Transformation Checklist',
    text: `## BEAT: TRANSFORMATION\n[UI:DISPLAY ToDoListOverlay]\nPrime: "We're checking everything off — one by one."\n[UI:OPEN ClosetCategory Outfit]\n[UI:SCROLL ClosetItems x5]\n[UI:ADD Outfit ITEM_NAME]\n[UI:CHECK_ITEM Checklist:Outfit]\n[UI:OPEN ClosetCategory Accessories]\n[UI:SCROLL ClosetItems x3]\n[UI:ADD Accessory ITEM_NAME]\n[UI:CHECK_ITEM Checklist:Accessories]\n`,
  },
  reveal: {
    label: '✨ Reveal',
    text: `## BEAT: REVEAL #1\nPrime: "(Reads invite out loud while it's on screen.)"\n`,
  },
  stakes: {
    label: '🎯 Stakes + Intention',
    text: `## BEAT: STAKES_INTENTION\n[UI:CLICK VoiceIcon]\n[UI:VOICE_ACTIVATE Lala]\nLala: "Bestie, this is IT. I need the perfect look."\n`,
  },
  cliffhanger: {
    label: '🔥 Cliffhanger',
    text: `## BEAT: CLIFFHANGER\nLala: "Bestie… this is just the beginning."\nPrime: "Next invite? Bigger. Bougier. You have to be there."\n`,
  },
  payoff: {
    label: '🎁 Payoff + CTA',
    text: `## BEAT: PAYOFF_CTA\nPrime: "Rate this look 1–10 in the comments — and if you want your own moment, you know where to shop."\nLala: "Drop your look with #LalaStyle. I'll feature favorites."\n`,
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
  { label: 'Background', insert: '[UI:SET_BACKGROUND SceneName]' },
  { label: '📨 Mail', insert: '[MAIL: type=invite from="NAME" prestige=4 cost=150]' },
  { label: '📊 Stat', insert: '[STAT: coins +100]' },
];


// ─── NORMALIZER ───

function normalizeScript(raw) {
  let s = raw;

  // Normalize smart quotes
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Me: → Prime:
  s = s.replace(/\bMe:\s*/g, 'Prime: ');

  // Newline before speaker labels mid-line
  const speakers = ['Lala:', 'Prime:', 'Guest:', 'Message:', 'System:'];
  for (const tok of speakers) {
    const re = new RegExp(`([^\\n])\\s*(?=${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    s = s.replace(re, '$1\n');
  }

  // Bracketed tags on their own line
  s = s.replace(/(\[[A-Z_]+:[^\]]*\])/gi, '\n$1\n');

  // Stage directions on their own line
  s = s.replace(/(\([^)]{3,}\))/g, '\n$1\n');

  // Beat headers on their own line
  s = s.replace(/(##\s*BEAT:[^\n]*)/gi, '\n\n$1\n');

  // Clean up blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}


// ─── BEAT INFERENCE ───

function inferBeats(script) {
  if (/##\s*BEAT:/i.test(script)) return script;

  const lines = script.split('\n');
  const result = [];
  let currentBeat = null;
  let interruptionN = 0;
  let revealN = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low = line.trim().toLowerCase();
    let beat = null;

    if (i === 0 && !currentBeat) {
      beat = low.startsWith('lala:') ? 'OPENING_RITUAL' : 'CREATOR_WELCOME';
    }
    if (low.includes('[ui:open loginwindow]') || low.includes('loginwindow')) {
      if (currentBeat !== 'CREATOR_WELCOME') beat = 'CREATOR_WELCOME';
    }
    if (low.includes('[ui:notification') || low.includes("lala's got mail") || low.includes('got mail')) {
      interruptionN++;
      beat = `INTERRUPTION #${interruptionN}`;
    }
    if (low.includes('[ui:display inviteletteroverlay]') || low.includes('reads invite') || low.includes('dearest lala') || low.includes('message reads')) {
      revealN++;
      beat = `REVEAL #${revealN}`;
    }
    if (low.includes('[ui:voice_activate') || low.includes('voice command') || low.includes('clicks voice')) {
      if (currentBeat !== 'STAKES_INTENTION') beat = 'STAKES_INTENTION';
    }
    if (low.includes('[ui:open closetcategory') || low.includes('to-do list') || low.includes('checklist') || low.includes('todolistoverlay')) {
      if (currentBeat !== 'TRANSFORMATION') beat = 'TRANSFORMATION';
    }
    if (low.includes('rate it') || low.includes('rate this') || low.includes('link in bio') || low.includes('#lalastyle')) {
      if (currentBeat !== 'PAYOFF_CTA') beat = 'PAYOFF_CTA';
    }
    if (low.includes('to be continued') || low.includes('next invite') || low.includes('just the beginning') || low.includes('next episode')) {
      if (currentBeat !== 'CLIFFHANGER') beat = 'CLIFFHANGER';
    }

    if (beat && beat !== currentBeat) {
      result.push('');
      result.push(`## BEAT: ${beat}`);
      currentBeat = beat;
    }
    result.push(line);
  }

  return result.join('\n');
}


function ScriptEditor({ episodeId, episode, onScriptSaved }) {
  const [scriptContent, setScriptContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showToolbar, setShowToolbar] = useState('beats');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (episode?.script_content) {
      setScriptContent(episode.script_content);
    } else if (episodeId) {
      api.get(`/api/v1/episodes/${episodeId}`).then(res => {
        if (res.data?.script_content) setScriptContent(res.data.script_content);
      }).catch(() => {});
    }
  }, [episode, episodeId]);

  const handleFormatScript = useCallback(() => {
    let f = normalizeScript(scriptContent);
    f = inferBeats(f);
    setScriptContent(f);
    setHasUnsavedChanges(true);
  }, [scriptContent]);

  const insertAtCursor = useCallback((text) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const before = scriptContent.substring(0, s), after = scriptContent.substring(e);
    const nl1 = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const nl2 = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
    const ins = nl1 + text + nl2;
    setScriptContent(before + ins + after);
    setHasUnsavedChanges(true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + ins.length, s + ins.length); }, 10);
  }, [scriptContent]);

  const handleSave = useCallback(async () => {
    if (!episodeId) return;
    setIsSaving(true); setSaveStatus('Saving...'); setError(null);
    try {
      await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptContent });
      setSaveStatus('Saved ✓'); setHasUnsavedChanges(false);
      if (onScriptSaved) onScriptSaved(scriptContent);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus(''); setError('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally { setIsSaving(false); }
  }, [episodeId, scriptContent, onScriptSaved]);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleSave]);

  const handleAnalyze = useCallback(async () => {
    if (!scriptContent.trim()) { setError('Write or paste a script first'); return; }
    setIsAnalyzing(true); setError(null);
    try {
      let c = normalizeScript(scriptContent);
      if (!/##\s*BEAT:/i.test(c)) c = inferBeats(c);
      if (episodeId && hasUnsavedChanges) {
        await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptContent });
        setHasUnsavedChanges(false);
      }
      const res = await api.post('/api/v1/scripts/parse', { content: c, title: episode?.title });
      if (res.data.success) { setAnalysis(res.data.scenePlan); setShowRightPanel(true); }
      else setError('Analysis failed: ' + (res.data.error || 'Unknown'));
    } catch (err) {
      setError('Analysis failed: ' + (err.response?.data?.error || err.message));
    } finally { setIsAnalyzing(false); }
  }, [scriptContent, episodeId, episode, hasUnsavedChanges]);

  const handleSendToSceneComposer = useCallback(async () => {
    if (!episodeId || !analysis) return;
    try {
      let c = normalizeScript(scriptContent);
      if (!/##\s*BEAT:/i.test(c)) c = inferBeats(c);
      const res = await api.post(`/api/v1/episodes/${episodeId}/apply-scene-plan`, { content: c, clearExisting: true });
      if (res.data.success) alert(`✅ ${res.data.scenesCreated} scenes created! Open Scene Composer to build visuals.`);
    } catch (err) { setError('Failed: ' + (err.response?.data?.error || err.message)); }
  }, [episodeId, analysis, scriptContent]);

  const handleAutofix = useCallback((w) => {
    if (!w.autofix?.available) return;
    if (w.autofix.action === 'insert_voice_activate' && w.at?.line) {
      const lines = scriptContent.split('\n');
      lines.splice(Math.max(0, w.at.line - 2), 0, '[UI:CLICK VoiceIcon]', '[UI:VOICE_ACTIVATE Lala]');
      setScriptContent(lines.join('\n')); setHasUnsavedChanges(true);
    }
    if (w.autofix.action === 'insert_login_template') {
      const lb = '[UI:OPEN LoginWindow]\n[UI:TYPE Username "JustAWomanInHerPrime"]\n[UI:TYPE Password "••••••"]\n[UI:CLICK LoginButton]\n[UI:SFX LoginSuccessDing]';
      if (!scriptContent.includes('LoginWindow')) {
        const idx = scriptContent.indexOf('## BEAT:');
        if (idx >= 0) { const nl = scriptContent.indexOf('\n', idx) + 1; setScriptContent(scriptContent.substring(0, nl) + lb + '\n' + scriptContent.substring(nl)); }
        else setScriptContent(lb + '\n\n' + scriptContent);
        setHasUnsavedChanges(true);
      }
    }
  }, [scriptContent]);

  const lineCount = scriptContent.split('\n').length;
  const wordCount = scriptContent.trim() ? scriptContent.trim().split(/\s+/).length : 0;
  const beatCount = (scriptContent.match(/##\s*BEAT:/gi) || []).length;

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 20 }}>📜</span>
          <h2 style={S.headerTitle}>Script</h2>
          <span style={S.headerSub}>Full episode script editor</span>
        </div>
        <div style={S.headerRight}>
          {saveStatus && <span style={S.saveStatus}>{saveStatus}</span>}
          {hasUnsavedChanges && <span style={S.unsaved}>● Unsaved</span>}
          <button onClick={handleFormatScript} style={S.formatBtn} title="Auto-format: splits speakers + tags onto separate lines, normalizes Me: → Prime:, infers beat headers">
            ✨ Format Script
          </button>
          <button onClick={handleSave} disabled={isSaving} style={S.saveBtn}>
            💾 Save <span style={S.shortcut}>Ctrl+S</span>
          </button>
          <button onClick={handleAnalyze} disabled={isAnalyzing} style={S.analyzeBtn}>
            {isAnalyzing ? '⏳ Analyzing...' : '🔍 Analyze Script'}
          </button>
        </div>
      </div>

      {error && (
        <div style={S.errorBanner}>⚠️ {error}<button onClick={() => setError(null)} style={S.errorClose}>✕</button></div>
      )}

      <div style={S.twoPane}>
        <div style={{ ...S.leftPane, flex: showRightPanel ? '1 1 55%' : '1 1 100%' }}>
          <div style={S.toolbar}>
            <div style={S.toolbarTabs}>
              {['beats', 'ui', 'templates'].map(tab => (
                <button key={tab} onClick={() => setShowToolbar(tab)} style={showToolbar === tab ? S.toolbarTabActive : S.toolbarTab}>
                  {tab === 'beats' ? '🎬 Beats' : tab === 'ui' ? '📱 UI Tags' : '📋 Templates'}
                </button>
              ))}
            </div>
            <div style={S.toolbarContent}>
              {showToolbar === 'beats' && (
                <div style={S.toolbarRow}>
                  {BEAT_OPTIONS.map(b => (
                    <button key={b.value} onClick={() => insertAtCursor(`\n## BEAT: ${b.value}\n`)} style={S.toolbarBtn}>{b.label}</button>
                  ))}
                </div>
              )}
              {showToolbar === 'ui' && (
                <div style={S.toolbarRow}>
                  {UI_TAGS.map(t => (
                    <button key={t.label} onClick={() => insertAtCursor(t.insert)} style={S.toolbarBtn}>{t.label}</button>
                  ))}
                </div>
              )}
              {showToolbar === 'templates' && (
                <div style={S.toolbarRow}>
                  {Object.entries(TEMPLATES).map(([k, t]) => (
                    <button key={k} onClick={() => insertAtCursor(t.text)} style={S.templateBtn}>{t.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={scriptContent}
            onChange={(e) => { setScriptContent(e.target.value); setHasUnsavedChanges(true); }}
            placeholder={`Paste your full script here, or use the toolbar above.\n\nTip: Paste messy scripts → click "✨ Format Script" to auto-organize.\n\nExample:\n\n## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me — Parisian tea party edition!"\n\n## BEAT: CREATOR_WELCOME\n[UI:OPEN LoginWindow]\n[UI:CLICK LoginButton]\nPrime: "Welcome back, besties!"\n\n## BEAT: INTERRUPTION #1\n[UI:NOTIFICATION MailDing]\nPrime: "Oh — Lala's got mail."\n[UI:CLICK MailIcon]\n[UI:OPEN MailPanel]`}
            style={S.textarea}
            spellCheck={false}
          />

          <div style={S.statusBar}>
            <span>{lineCount} lines</span>
            <span>{wordCount} words</span>
            <span>{beatCount} beats</span>
            <span>~{Math.ceil(wordCount / 2.2)}s est.</span>
          </div>
        </div>

        {showRightPanel && analysis && (
          <div style={S.rightPane}>
            <div style={S.rightHeader}>
              <h3 style={S.rightTitle}>📊 Analysis</h3>
              <button onClick={() => setShowRightPanel(false)} style={S.closePanel}>✕</button>
            </div>

            <div style={S.statsGrid}>
              {[
                { v: analysis.totalScenes || analysis.metadata?.totalBeats || 0, l: 'Beats' },
                { v: analysis.formattedDuration || analysis.metadata?.formattedDuration || '0s', l: 'Duration' },
                { v: analysis.metadata?.totalDialogueLines || 0, l: 'Dialogue' },
                { v: analysis.metadata?.totalUiActions || analysis.ui_actions?.length || 0, l: 'UI Actions' },
              ].map((s, i) => (
                <div key={i} style={S.statCard}><div style={S.statValue}>{s.v}</div><div style={S.statLabel}>{s.l}</div></div>
              ))}
            </div>

            <div style={S.rightScroll}>
              {analysis.warnings?.length > 0 && (
                <div style={S.section}>
                  <h4 style={S.sectionTitle}>⚠️ Warnings</h4>
                  {analysis.warnings.map((w, i) => (
                    <div key={i} style={S.warningCard}>
                      <div style={S.warningText}>{w.message}</div>
                      {w.autofix?.available && <button onClick={() => handleAutofix(w)} style={S.autofixBtn}>🔧 Auto-fix</button>}
                    </div>
                  ))}
                </div>
              )}

              <div style={S.section}>
                <h4 style={S.sectionTitle}>🎬 Beat Structure</h4>
                {(analysis.beats || analysis.scenes || []).map((b, i) => {
                  const c = b.confidence || 'confident';
                  const ic = c === 'confident' ? '✓' : c === 'review' ? '⚠' : '❌';
                  const cl = c === 'confident' ? '#16a34a' : c === 'review' ? '#ca8a04' : '#dc2626';
                  return (
                    <div key={i} style={S.beatCard}>
                      <div style={S.beatRow}>
                        <span style={{ color: cl, fontWeight: 700, fontSize: 13 }}>{ic}</span>
                        <span style={S.beatName}>{b.title || b.type}</span>
                        <span style={S.beatDur}>{b.duration_s || b.duration_seconds}s</span>
                      </div>
                      <div style={S.beatMeta}>
                        {(b.speakers || b.characters_expected || []).map((sp, j) => {
                          const n = typeof sp === 'string' ? sp : sp.name;
                          const e = typeof sp === 'string' ? '' : (sp.emoji || '');
                          return <span key={j} style={S.badge}>{e} {n}</span>;
                        })}
                        {b.dialogue_count > 0 && <span style={S.dimBadge}>💬 {b.dialogue_count}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(analysis.ui_actions || []).length > 0 && (
                <div style={S.section}>
                  <h4 style={S.sectionTitle}>📱 UI Actions</h4>
                  {(analysis.beats || analysis.scenes || []).map((b, i) => {
                    const acts = (analysis.ui_actions || []).filter(a => a.beat_temp_id === b.temp_id);
                    if (!acts.length) return null;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={S.uiGroupTitle}>{b.title || b.type}</div>
                        {acts.map((a, j) => (
                          <div key={j} style={S.uiRow}>
                            <span style={S.uiType}>{a.type.toUpperCase()}</span>
                            <span style={S.uiTarget}>{a.target}</span>
                            <span style={S.uiDur}>{a.duration_s}s</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={S.actions}>
              <button onClick={handleSendToSceneComposer} style={S.sceneBtn}>🎬 Send to Scene Composer</button>
              <button onClick={handleAnalyze} style={S.reBtn}>🔄 Re-analyze</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LIGHT THEME STYLES ───
const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc', flexWrap: 'wrap', gap: 8 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#1a1a2e', fontSize: 16, fontWeight: 700, margin: 0 },
  headerSub: { color: '#94a3b8', fontSize: 13 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  saveStatus: { color: '#16a34a', fontSize: 12, fontWeight: 600 },
  unsaved: { color: '#ca8a04', fontSize: 12 },
  formatBtn: { padding: '6px 12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6, color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, color: '#334155', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  shortcut: { fontSize: 10, opacity: 0.5, background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 },
  analyzeBtn: { padding: '6px 16px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  errorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626', fontSize: 13 },
  errorClose: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },
  twoPane: { display: 'flex', flex: 1, overflow: 'hidden' },
  leftPane: { display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #e2e8f0' },
  toolbar: { borderBottom: '1px solid #e2e8f0', background: '#fafbfc' },
  toolbarTabs: { display: 'flex', borderBottom: '1px solid #e2e8f0' },
  toolbarTab: { padding: '6px 14px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', borderBottom: '2px solid transparent' },
  toolbarTabActive: { padding: '6px 14px', background: 'transparent', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', fontWeight: 600, borderBottom: '2px solid #6366f1' },
  toolbarContent: { padding: '6px 8px', maxHeight: 80, overflowY: 'auto' },
  toolbarRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  toolbarBtn: { padding: '4px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, color: '#475569', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' },
  templateBtn: { padding: '6px 12px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, color: '#4338ca', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  textarea: { flex: 1, width: '100%', background: '#fff', border: 'none', color: '#1e293b', fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", fontSize: 13, lineHeight: '1.7', padding: 16, resize: 'none', outline: 'none', boxSizing: 'border-box' },
  statusBar: { display: 'flex', gap: 16, padding: '6px 16px', borderTop: '1px solid #e2e8f0', background: '#fafbfc', color: '#94a3b8', fontSize: 11 },
  rightPane: { flex: '0 0 45%', maxWidth: '45%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafbfc' },
  rightHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' },
  rightTitle: { color: '#1a1a2e', fontSize: 14, fontWeight: 700, margin: 0 },
  closePanel: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '10px 14px' },
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, textAlign: 'center' },
  statValue: { color: '#1a1a2e', fontSize: 18, fontWeight: 700 },
  statLabel: { color: '#94a3b8', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' },
  rightScroll: { flex: 1, overflowY: 'auto' },
  section: { padding: '10px 14px', borderTop: '1px solid #f1f5f9' },
  sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  beatCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', marginBottom: 4 },
  beatRow: { display: 'flex', alignItems: 'center', gap: 8 },
  beatName: { color: '#1a1a2e', fontSize: 13, fontWeight: 600, flex: 1 },
  beatDur: { color: '#94a3b8', fontSize: 12 },
  beatMeta: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  badge: { background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#4338ca' },
  dimBadge: { padding: '1px 6px', fontSize: 10, color: '#94a3b8' },
  warningCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, marginBottom: 4 },
  warningText: { color: '#92400e', fontSize: 12, flex: 1 },
  autofixBtn: { padding: '3px 8px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 4, color: '#92400e', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8 },
  uiGroupTitle: { color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' },
  uiRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', marginBottom: 2, fontSize: 12 },
  uiType: { color: '#16a34a', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, minWidth: 100 },
  uiTarget: { color: '#475569', flex: 1 },
  uiDur: { color: '#94a3b8', fontSize: 11 },
  actions: { padding: '12px 14px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 },
  sceneBtn: { flex: 1, padding: 10, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  reBtn: { padding: '10px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },
};

export default ScriptEditor;
