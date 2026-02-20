/**
 * ScriptEditor v5 — Refined, Writer-Friendly, Story-First
 * 
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Toolbar: [beat ▾] [status] ── [Format] [Beats] │ [Save] │
 *   ├───────────────┬──────────────────────────────────────────┤
 *   │  OUTLINE      │  Beat Header (prev/next nav)            │
 *   │  • by act     │  Quick Insert Chips                     │
 *   │  • progress   │  ┌──── Line Numbers + Editor ────┐      │
 *   │  • colors     │  │ 1  ## BEAT: OPENING_RITUAL    │      │
 *   │               │  │ 2  Lala: "Bestie…"            │      │
 *   │               │  └───────────────────────────────┘      │
 *   │               │  Status Bar + Keyboard Hints            │
 *   └───────────────┴──────────────────────────────────────────┘
 * 
 * v5 Improvements:
 *   - Line numbers gutter alongside editor
 *   - Quick-insert chips for common dialogue / tags
 *   - Beat navigation (prev/next arrows)
 *   - Act-colored outline with progress dots
 *   - Prominent save button when unsaved
 *   - Empty state onboarding card
 *   - Keyboard shortcut hints in status bar
 *   - Overall visual polish + warmth
 * 
 * Replaces: ScriptEditor v4
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import api from '../services/api';
import useOrientation from '../hooks/useOrientation';
import './ScriptEditor.css';

// ─── BEAT TYPES ───
const BEAT_OPTIONS = [
  { value: 'OPENING_RITUAL', label: 'Opening Ritual', icon: '🎬', act: 'SETUP' },
  { value: 'CREATOR_WELCOME', label: 'Creator Welcome', icon: '👋', act: 'SETUP' },
  { value: 'INTERRUPTION', label: 'Interruption', icon: '📩', act: 'CONFLICT' },
  { value: 'REVEAL', label: 'Reveal', icon: '✨', act: 'CONFLICT' },
  { value: 'STAKES_INTENTION', label: 'Stakes + Intention', icon: '🎯', act: 'CONFLICT' },
  { value: 'TRANSFORMATION', label: 'Transformation', icon: '💫', act: 'CLIMAX' },
  { value: 'DELIVERABLE_CREATION', label: 'Deliverable Creation', icon: '🎨', act: 'CLIMAX' },
  { value: 'PAYOFF_CTA', label: 'Payoff + CTA', icon: '🎁', act: 'RESOLUTION' },
  { value: 'CLIFFHANGER', label: 'Cliffhanger', icon: '🔥', act: 'RESOLUTION' },
  { value: 'TRANSITION', label: 'Transition', icon: '🔄', act: 'SETUP' },
  { value: 'EVENT_TRAVEL', label: 'Event Travel', icon: '✈️', act: 'CONFLICT' },
  { value: 'EVENT_OUTCOME', label: 'Event Outcome', icon: '🏆', act: 'RESOLUTION' },
];

// ─── ACT COLORS ───
const ACT_COLORS = {
  SETUP: '#6366f1',
  CONFLICT: '#f59e0b',
  CLIMAX: '#ec4899',
  RESOLUTION: '#10b981',
};

const ACT_LABELS = {
  SETUP: '🟣 Setup',
  CONFLICT: '🟡 Conflict',
  CLIMAX: '🩷 Climax',
  RESOLUTION: '🟢 Resolution',
};

// ─── QUICK INSERT CHIPS (inline bar) ───
const QUICK_INSERTS = [
  { label: 'Lala:', insert: 'Lala: ""', cursorOffset: -1 },
  { label: 'Prime:', insert: 'Prime: ""', cursorOffset: -1 },
  { label: 'Guest:', insert: 'Guest: ""', cursorOffset: -1 },
  { label: '[UI]', insert: '[UI:OPEN ]', cursorOffset: -1 },
  { label: '[MAIL]', insert: '[MAIL: type=invite from="" prestige=4 cost=150]', cursorOffset: -30 },
  { label: '[SFX]', insert: '[UI:SFX ]', cursorOffset: -1 },
  { label: '## BEAT', insert: '\n## BEAT: ', cursorOffset: 0 },
  { label: '(Action)', insert: '()', cursorOffset: -1 },
];

const BEAT_MAP = Object.fromEntries(BEAT_OPTIONS.map(b => [b.value, b]));
const ACT_ORDER = ['SETUP', 'CONFLICT', 'CLIMAX', 'RESOLUTION'];

// ─── LINE NUMBERS COMPONENT ───
function LineNumbers({ content, scrollTop }) {
  const lines = content.split('\n');
  return (
    <div className="se-line-numbers" style={{ transform: `translateY(-${scrollTop}px)` }}>
      {lines.map((_, i) => (
        <div key={i} className="se-line-number">{i + 1}</div>
      ))}
    </div>
  );
}

// ─── QUICK TEMPLATES ───
const TEMPLATES = [
  { key: 'login', label: '🔐 Login Sequence', desc: 'Opening ritual with login UI flow',
    text: `## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me — I'm ready for a new slay."\n\n## BEAT: CREATOR_WELCOME\n[UI:OPEN LoginWindow]\n[UI:TYPE Username "JustAWomanInHerPrime"]\n[UI:TYPE Password "••••••"]\n[UI:CLICK LoginButton]\n[UI:SFX LoginSuccessDing]\nPrime: "Welcome back, besties — and bonjour to our new besties!"\n` },
  { key: 'mailInterrupt', label: '📩 Mail Interrupt', desc: 'Notification + mail panel flow',
    text: `## BEAT: INTERRUPTION #1\n[UI:NOTIFICATION MailDing]\nPrime: "Oh — Lala's got mail."\n[UI:CLICK MailIcon]\n[UI:OPEN MailPanel]\n[MAIL: type=invite from="EVENT_NAME" prestige=4 cost=150]\n[UI:DISPLAY InviteLetterOverlay]\nPrime: "Bestie. This is major."\n` },
  { key: 'voiceActivate', label: '🎤 Voice Activate', desc: 'Voice icon + Lala dialogue',
    text: `[UI:CLICK VoiceIcon]\n[UI:VOICE_ACTIVATE Lala]\nLala: "Bestie, this is IT. I need the perfect look."\n` },
  { key: 'checklist', label: '✅ Transformation', desc: 'Checklist overlay with closet browsing',
    text: `## BEAT: TRANSFORMATION\n[UI:DISPLAY ToDoListOverlay]\nPrime: "We're checking everything off — one by one."\n[UI:OPEN ClosetCategory Outfit]\n[UI:SCROLL ClosetItems x5]\n[UI:ADD Outfit ITEM_NAME]\n[UI:CHECK_ITEM Checklist:Outfit]\n[UI:OPEN ClosetCategory Accessories]\n[UI:SCROLL ClosetItems x3]\n[UI:ADD Accessory ITEM_NAME]\n[UI:CHECK_ITEM Checklist:Accessories]\n` },
  { key: 'reveal', label: '✨ Reveal', desc: 'Invite read-aloud beat',
    text: `## BEAT: REVEAL #1\nPrime: "(Reads invite out loud while it's on screen.)"\n` },
  { key: 'stakes', label: '🎯 Stakes + Intention', desc: 'Voice activate + character goal',
    text: `## BEAT: STAKES_INTENTION\n[UI:CLICK VoiceIcon]\n[UI:VOICE_ACTIVATE Lala]\nLala: "Bestie, this is IT. I need the perfect look."\n` },
  { key: 'cliffhanger', label: '🔥 Cliffhanger', desc: 'End-of-episode tease',
    text: `## BEAT: CLIFFHANGER\nLala: "Bestie… this is just the beginning."\nPrime: "Next invite? Bigger. Bougier. You have to be there."\n` },
  { key: 'payoff', label: '🎁 Payoff + CTA', desc: 'Rate prompt + community CTA',
    text: `## BEAT: PAYOFF_CTA\nPrime: "Rate this look 1–10 in the comments — and if you want your own moment, you know where to shop."\nLala: "Drop your look with #LalaStyle. I'll feature favorites."\n` },
];

// ─── UI TAG INSERTS ───
const UI_TAGS = [
  { label: 'Open', insert: '[UI:OPEN ]', group: 'Navigation' },
  { label: 'Close', insert: '[UI:CLOSE ]', group: 'Navigation' },
  { label: 'Click', insert: '[UI:CLICK ]', group: 'Interaction' },
  { label: 'Display', insert: '[UI:DISPLAY ]', group: 'Navigation' },
  { label: 'Hide', insert: '[UI:HIDE ]', group: 'Navigation' },
  { label: 'Type', insert: '[UI:TYPE Field "value"]', group: 'Interaction' },
  { label: 'Notification', insert: '[UI:NOTIFICATION ]', group: 'System' },
  { label: 'Voice Activate', insert: '[UI:VOICE_ACTIVATE Lala]', group: 'System' },
  { label: 'Scroll', insert: '[UI:SCROLL Target x5]', group: 'Interaction' },
  { label: 'Add Item', insert: '[UI:ADD Category ItemName]', group: 'Interaction' },
  { label: 'Check Item', insert: '[UI:CHECK_ITEM Checklist:Item]', group: 'Interaction' },
  { label: 'SFX', insert: '[UI:SFX SoundName]', group: 'System' },
  { label: 'Background', insert: '[UI:SET_BACKGROUND SceneName]', group: 'System' },
  { label: '📨 Mail', insert: '[MAIL: type=invite from="NAME" prestige=4 cost=150]', group: 'Content' },
  { label: '📊 Stat', insert: '[STAT: coins +100]', group: 'Content' },
];

// ─── NORMALIZER ───
function normalizeScript(raw) {
  let s = raw;
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  s = s.replace(/\bMe:\s*/g, 'Prime: ');
  const speakers = ['Lala:', 'Prime:', 'Guest:', 'Message:', 'System:'];
  for (const tok of speakers) {
    const re = new RegExp(`([^\\n])\\s*(?=${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    s = s.replace(re, '$1\n');
  }
  s = s.replace(/(\[[A-Z_]+:[^\]]*\])/gi, '\n$1\n');
  s = s.replace(/(\([^)]{3,}\))/g, '\n$1\n');
  s = s.replace(/(##\s*BEAT:[^\n]*)/gi, '\n\n$1\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ─── BEAT INFERENCE ───
function inferBeats(script) {
  if (/##\s*BEAT:/i.test(script)) return script;
  const lines = script.split('\n');
  const result = [];
  let currentBeat = null;
  let interruptionN = 0, revealN = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const low = line.trim().toLowerCase();
    let beat = null;
    if (i === 0 && !currentBeat) beat = low.startsWith('lala:') ? 'OPENING_RITUAL' : 'CREATOR_WELCOME';
    if (low.includes('[ui:open loginwindow]') || low.includes('loginwindow')) { if (currentBeat !== 'CREATOR_WELCOME') beat = 'CREATOR_WELCOME'; }
    if (low.includes('[ui:notification') || low.includes("lala's got mail") || low.includes('got mail')) { interruptionN++; beat = `INTERRUPTION #${interruptionN}`; }
    if (low.includes('[ui:display inviteletteroverlay]') || low.includes('reads invite') || low.includes('dearest lala') || low.includes('message reads')) { revealN++; beat = `REVEAL #${revealN}`; }
    if (low.includes('[ui:voice_activate') || low.includes('voice command') || low.includes('clicks voice')) { if (currentBeat !== 'STAKES_INTENTION') beat = 'STAKES_INTENTION'; }
    if (low.includes('[ui:open closetcategory') || low.includes('to-do list') || low.includes('checklist') || low.includes('todolistoverlay')) { if (currentBeat !== 'TRANSFORMATION') beat = 'TRANSFORMATION'; }
    if (low.includes('rate it') || low.includes('rate this') || low.includes('link in bio') || low.includes('#lalastyle')) { if (currentBeat !== 'PAYOFF_CTA') beat = 'PAYOFF_CTA'; }
    if (low.includes('to be continued') || low.includes('next invite') || low.includes('just the beginning') || low.includes('next episode')) { if (currentBeat !== 'CLIFFHANGER') beat = 'CLIFFHANGER'; }
    if (beat && beat !== currentBeat) { result.push(''); result.push(`## BEAT: ${beat}`); currentBeat = beat; }
    result.push(line);
  }
  return result.join('\n');
}

// ─── PARSE BEATS FROM SCRIPT ───
function parseBeatsFromScript(script) {
  if (!script) return [];
  const lines = script.split('\n');
  const beats = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^##\s*BEAT:\s*(.+)/i);
    if (m) {
      if (current) { current.endLine = i - 1; beats.push(current); }
      const raw = m[1].trim();
      const base = raw.replace(/\s*#\d+$/, '');
      const info = BEAT_MAP[base] || { icon: '📌', label: raw, act: 'SETUP' };
      current = { id: `beat-${beats.length}`, raw, base, label: info.label, icon: info.icon, act: info.act, startLine: i, endLine: null, lines: [], uiActions: [], eventMeta: [] };
    }
    if (current) {
      current.lines.push(line);
      // Parse UI actions
      const uiMatch = line.match(/^\[UI:(\w+)\s+(.*)\]$/);
      if (uiMatch) current.uiActions.push({ type: uiMatch[1], target: uiMatch[2].trim() });
      // Parse event metadata
      const evMatch = line.match(/^\[(EVENT|MAIL|STAT|EPISODE_INTENT):\s*(.*)\]$/);
      if (evMatch) current.eventMeta.push({ type: evMatch[1], value: evMatch[2].trim() });
    }
  }
  if (current) { current.endLine = lines.length - 1; beats.push(current); }

  // If no beats found, treat entire script as one block
  if (beats.length === 0 && script.trim()) {
    beats.push({ id: 'beat-0', raw: 'SCRIPT', base: 'SCRIPT', label: 'Full Script', icon: '📜', act: 'SETUP', startLine: 0, endLine: lines.length - 1, lines, uiActions: [], eventMeta: [] });
  }
  return beats;
}

// ─── DETECT BEAT STATUS ───
function getBeatStatus(beat) {
  const hasDialogue = beat.lines.some(l => /^(Lala|Prime|Guest|Message|System):/.test(l.trim()));
  const hasUI = beat.uiActions.length > 0;
  const hasMeta = beat.eventMeta.length > 0;
  if (!hasDialogue && beat.lines.filter(l => l.trim() && !l.startsWith('##')).length < 2) return 'warning';
  if (hasUI) return 'has-actions';
  return 'complete';
}


// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════

function ScriptEditor({ episodeId, episode, onScriptSaved }) {
  // ─── STATE ───
  const [scriptContent, setScriptContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Responsive
  const { isMobile, width: viewportWidth } = useOrientation();
  const isTablet = !isMobile && viewportWidth < 1024;

  // Outline — auto-collapse on mobile/tablet
  const [outlineCollapsed, setOutlineCollapsed] = useState(isMobile || viewportWidth < 768);
  const [outlineSearch, setOutlineSearch] = useState('');
  const [selectedBeatId, setSelectedBeatId] = useState(null);

  // Collapsible sections
  const [uiActionsOpen, setUiActionsOpen] = useState(false);
  const [eventMetaOpen, setEventMetaOpen] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('ui');

  // Command palette
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdHighlight, setCmdHighlight] = useState(0);

  // Overflow menu
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Line numbers sync
  const [editorScrollTop, setEditorScrollTop] = useState(0);

  const textareaRef = useRef(null);
  const initialLoadDone = useRef(false);
  const loadedEpisodeId = useRef(null);   // tracks which episode is loaded
  const cmdInputRef = useRef(null);

  // ─── LOAD (single effect — prevents bleed between episodes) ───
  useEffect(() => {
    // Reset everything when episodeId changes
    setScriptContent('');
    setHasUnsavedChanges(false);
    setSaveStatus('');
    setError(null);
    setSelectedBeatId(null);
    setShowAnalysis(false);
    setAnalysis(null);
    initialLoadDone.current = false;
    loadedEpisodeId.current = episodeId || null;

    if (!episodeId) return;

    const controller = new AbortController();

    // Prefer the prop if it matches
    if (episode?.script_content && (episode.id === episodeId)) {
      setScriptContent(episode.script_content);
      initialLoadDone.current = true;
    } else {
      api.get(`/api/v1/episodes/${episodeId}`, { signal: controller.signal })
        .then(res => {
          // Guard: only apply if this is still the active episode
          if (loadedEpisodeId.current !== episodeId) return;
          const ep = res.data?.data || res.data;
          if (ep?.script_content) setScriptContent(ep.script_content);
          initialLoadDone.current = true;
        })
        .catch(err => {
          if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
            console.error('Script load error:', err);
          }
        });
    }

    return () => controller.abort();   // cancel in-flight fetch on unmount / re-run
  }, [episodeId]);  // only episodeId — episode object changes must NOT re-trigger

  // ─── PARSED BEATS ───
  const beats = useMemo(() => parseBeatsFromScript(scriptContent), [scriptContent]);

  // Auto-select first beat
  useEffect(() => {
    if (beats.length > 0 && !selectedBeatId) setSelectedBeatId(beats[0].id);
  }, [beats, selectedBeatId]);

  const selectedBeat = beats.find(b => b.id === selectedBeatId) || beats[0] || null;

  // ─── GROUPED BEATS FOR OUTLINE ───
  const groupedBeats = useMemo(() => {
    const groups = {};
    for (const act of ACT_ORDER) groups[act] = [];
    for (const b of beats) {
      const act = b.act || 'SETUP';
      if (!groups[act]) groups[act] = [];
      groups[act].push(b);
    }
    return groups;
  }, [beats]);

  // Filtered beats
  const filteredBeats = useMemo(() => {
    if (!outlineSearch.trim()) return beats;
    const q = outlineSearch.toLowerCase();
    return beats.filter(b => b.label.toLowerCase().includes(q) || b.raw.toLowerCase().includes(q));
  }, [beats, outlineSearch]);

  // ─── HANDLERS ───
  const handleFormatScript = useCallback(() => {
    let f = normalizeScript(scriptContent);
    f = inferBeats(f);
    setScriptContent(f);
    setHasUnsavedChanges(true);
  }, [scriptContent]);

  const insertAtCursor = useCallback((text) => {
    const ta = textareaRef.current;
    if (!ta) { setScriptContent(prev => prev + '\n' + text + '\n'); setHasUnsavedChanges(true); return; }
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
    // Guard: refuse to save if the loaded episode doesn't match the current prop
    if (loadedEpisodeId.current !== episodeId) {
      console.warn('Save aborted — episode mismatch (loaded:', loadedEpisodeId.current, 'current:', episodeId, ')');
      return;
    }
    setIsSaving(true); setSaveStatus('Saving…'); setError(null);
    try {
      await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptContent });
      setSaveStatus('Saved'); setHasUnsavedChanges(false);
      if (onScriptSaved) onScriptSaved(scriptContent);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      setSaveStatus(''); setError('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally { setIsSaving(false); }
  }, [episodeId, scriptContent, onScriptSaved]);

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
      if (res.data.success) { setAnalysis(res.data.scenePlan); setShowAnalysis(true); }
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

  // ─── GENERATE BEAT STRUCTURE ───
  const [isGenerating, setIsGenerating] = useState(false);
  const handleGenerateBeats = useCallback(async () => {
    if (!episodeId) return;
    if (!window.confirm('This will replace your entire script with a fresh beat skeleton. Continue?')) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/generate-beats`);
      if (res.data.success) {
        setScriptContent(res.data.script);
        setHasUnsavedChanges(false); // already saved server-side
        setSelectedBeatId(null); // reset selection so first beat is auto-selected
        const src = res.data.source === 'world_event'
          ? `Generated from event: ${res.data.event_name}`
          : 'Generated basic 9-beat template';
        alert(`✅ ${res.data.beat_count} beats generated!\n${src}`);
      } else {
        setError(res.data.error || 'Generation failed');
      }
    } catch (err) {
      setError('Generate failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsGenerating(false);
    }
  }, [episodeId]);

  const handleAutofix = useCallback((w) => {
    if (!w.autofix?.available) return;
    let applied = false;
    if (w.autofix.action === 'insert_voice_activate' && w.at?.line) {
      const lines = scriptContent.split('\n');
      lines.splice(Math.max(0, w.at.line - 2), 0, '[UI:CLICK VoiceIcon]', '[UI:VOICE_ACTIVATE Lala]');
      setScriptContent(lines.join('\n')); setHasUnsavedChanges(true); applied = true;
    }
    if (w.autofix.action === 'insert_login_template') {
      const lb = '[UI:OPEN LoginWindow]\n[UI:TYPE Username "JustAWomanInHerPrime"]\n[UI:TYPE Password "••••••"]\n[UI:CLICK LoginButton]\n[UI:SFX LoginSuccessDing]';
      if (!scriptContent.includes('LoginWindow')) {
        const idx = scriptContent.indexOf('## BEAT:');
        if (idx >= 0) { const nl = scriptContent.indexOf('\n', idx) + 1; setScriptContent(scriptContent.substring(0, nl) + lb + '\n' + scriptContent.substring(nl)); }
        else setScriptContent(lb + '\n\n' + scriptContent);
        setHasUnsavedChanges(true); applied = true;
      }
    }
    if (applied && analysis) {
      setAnalysis(prev => ({ ...prev, warnings: (prev.warnings || []).filter(x => x !== w) }));
    }
  }, [scriptContent, analysis]);

  // ─── BEAT NAVIGATION ───
  const scrollToBeat = useCallback((beatId) => {
    setSelectedBeatId(beatId);
    const beat = beats.find(b => b.id === beatId);
    if (beat && textareaRef.current) {
      const lines = scriptContent.split('\n');
      let charPos = 0;
      for (let i = 0; i < beat.startLine; i++) charPos += lines[i].length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charPos, charPos);
      // Scroll textarea to show the beat
      const lineHeight = 25; // approximate
      textareaRef.current.scrollTop = Math.max(0, beat.startLine * lineHeight - 40);
    }
  }, [beats, scriptContent]);

  const navigateBeat = useCallback((dir) => {
    const idx = beats.findIndex(b => b.id === selectedBeatId);
    const next = idx + dir;
    if (next >= 0 && next < beats.length) scrollToBeat(beats[next].id);
  }, [beats, selectedBeatId, scrollToBeat]);

  // ─── KEYBOARD ───
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true); setCmdQuery(''); setCmdHighlight(0); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') { e.preventDefault(); navigateBeat(-1); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') { e.preventDefault(); navigateBeat(1); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleSave, navigateBeat]);

  // Focus command palette input
  useEffect(() => {
    if (cmdOpen && cmdInputRef.current) cmdInputRef.current.focus();
  }, [cmdOpen]);

  // Close overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const h = () => setOverflowOpen(false);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [overflowOpen]);

  // Auto-collapse outline when viewport shrinks below mobile breakpoint
  useEffect(() => {
    if (isMobile || viewportWidth < 768) setOutlineCollapsed(true);
  }, [isMobile, viewportWidth]);

  // ─── COMMAND PALETTE ITEMS ───
  const cmdItems = useMemo(() => {
    const items = [
      ...beats.map(b => ({ icon: b.icon, label: `Jump to: ${b.label}`, action: () => scrollToBeat(b.id) })),
      ...BEAT_OPTIONS.map(b => ({ icon: b.icon, label: `Add beat: ${b.label}`, action: () => insertAtCursor(`\n## BEAT: ${b.value}\n`) })),
      ...TEMPLATES.map(t => ({ icon: '📋', label: `Template: ${t.label}`, action: () => insertAtCursor(t.text) })),
      { icon: '✨', label: 'Format Script', shortcut: '', action: handleFormatScript },
      { icon: '🎬', label: 'Generate Beat Structure', action: handleGenerateBeats },
      { icon: '💾', label: 'Save', shortcut: 'Ctrl+S', action: handleSave },
      { icon: '🔍', label: 'Analyze Script', action: handleAnalyze },
      { icon: '🧰', label: 'Open Tools Panel', action: () => { setDrawerOpen(true); setCmdOpen(false); } },
    ];
    if (!cmdQuery.trim()) return items.slice(0, 12);
    const q = cmdQuery.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q));
  }, [cmdQuery, beats, scrollToBeat, insertAtCursor, handleFormatScript, handleSave, handleAnalyze]);

  // ─── DERIVED ───
  const lineCount = scriptContent.split('\n').length;
  const wordCount = scriptContent.trim() ? scriptContent.trim().split(/\s+/).length : 0;
  const beatCount = beats.length;
  const episodeStatus = episode?.status || 'draft';
  const charCount = scriptContent.length;
  const estDuration = Math.ceil(wordCount / 2.2);

  // Beat navigation helpers
  const currentBeatIndex = beats.findIndex(b => b.id === selectedBeatId);
  const hasPrevBeat = currentBeatIndex > 0;
  const hasNextBeat = currentBeatIndex < beats.length - 1;

  // Outline progress
  const completedBeats = beats.filter(b => getBeatStatus(b) === 'complete' || getBeatStatus(b) === 'has-actions').length;
  const progressPercent = beats.length > 0 ? Math.round((completedBeats / beats.length) * 100) : 0;

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="se-root">
      {/* ─── TOP TOOLBAR ─── */}
      <div className="se-toolbar">
        <div className="se-toolbar-left">
          <button
            className="se-outline-toggle-btn"
            onClick={() => setOutlineCollapsed(!outlineCollapsed)}
            title={outlineCollapsed ? 'Show outline' : 'Hide outline'}
          >
            {outlineCollapsed ? '☰' : '◁'}
          </button>
          <div className="se-toolbar-divider" />
          <select
            className="se-beat-select"
            value={selectedBeatId || ''}
            onChange={e => scrollToBeat(e.target.value)}
          >
            {beats.map(b => (
              <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
            ))}
          </select>
          <span className={`se-status-badge ${episodeStatus}`}>{episodeStatus}</span>
        </div>

        <div className="se-toolbar-center">
          <button className="se-btn-subtle" onClick={handleFormatScript} title="Auto-format and detect beats">
            ✨ Format
          </button>
          <button
            className="se-btn-accent"
            onClick={handleGenerateBeats}
            disabled={isGenerating}
            title="Replace script with fresh beat skeleton from world event"
          >
            {isGenerating ? '⏳ Generating…' : '🎬 Generate Beats'}
          </button>
        </div>
        <div className="se-toolbar-right">
          <div className={`se-save-group ${hasUnsavedChanges ? 'unsaved' : ''}`}>
            <div className={`se-save-indicator ${hasUnsavedChanges ? 'unsaved' : saveStatus ? 'saved' : ''}`}>
              {hasUnsavedChanges ? '● Unsaved changes' : saveStatus || '✓ Saved'}
            </div>
            <button
              className={`se-btn-save ${hasUnsavedChanges ? 'pulse' : ''}`}
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              title="Save script (Ctrl+S)"
            >
              {isSaving ? '⏳' : '💾'} Save
            </button>
          </div>
          <div className="se-toolbar-divider" />
          <button className="se-btn-primary" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? '⏳ Analyzing…' : '🔍 Analyze'}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="se-btn-overflow" onClick={(e) => { e.stopPropagation(); setOverflowOpen(!overflowOpen); }} title="More tools">⋯</button>
            {overflowOpen && (
              <div className="se-overflow-menu">
                <button className="se-overflow-item" onClick={() => { setDrawerOpen(true); setDrawerTab('ui'); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">📱</span> UI Tags
                </button>
                <button className="se-overflow-item" onClick={() => { setDrawerOpen(true); setDrawerTab('templates'); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">📋</span> Templates
                </button>
                <button className="se-overflow-item" onClick={() => { setDrawerOpen(true); setDrawerTab('variables'); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">🔤</span> Variables
                </button>
                <div className="se-overflow-divider" />
                <button className="se-overflow-item" onClick={() => { setCmdOpen(true); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">⌨️</span> Command Palette
                  <span className="se-overflow-shortcut">Ctrl+K</span>
                </button>
                <button className="se-overflow-item" onClick={() => { handleSendToSceneComposer(); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">🎬</span> Send to Scene Composer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="se-error-banner">
          ⚠️ {error}
          <button className="se-error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ─── MAIN BODY ─── */}
      <div className={`se-body ${isMobile ? 'se-body-mobile' : ''}`}>

        {/* Overlay backdrop when outline is open on small screens */}
        {(isMobile || viewportWidth < 768) && !outlineCollapsed && (
          <div className="se-outline-backdrop" onClick={() => setOutlineCollapsed(true)} />
        )}

        {/* ─── LEFT: STORY OUTLINE ─── */}
        <div className={`se-outline ${outlineCollapsed ? 'collapsed' : ''}`}>
          <div className="se-outline-header">
            <span className="se-outline-title">Story Outline</span>
            <span className="se-outline-beat-count">{beats.length} beats</span>
          </div>

          {/* Progress bar */}
          {beats.length > 0 && (
            <div className="se-outline-progress">
              <div className="se-outline-progress-bar">
                <div className="se-outline-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="se-outline-progress-label">{progressPercent}% complete</span>
            </div>
          )}

          <input
            className="se-outline-search"
            placeholder="Search beats…"
            value={outlineSearch}
            onChange={e => setOutlineSearch(e.target.value)}
          />
          <div className="se-outline-list">
            {outlineSearch.trim() ? (
              // Flat filtered list
              filteredBeats.length > 0 ? filteredBeats.map(b => (
                <div
                  key={b.id}
                  className={`se-outline-beat ${selectedBeatId === b.id ? 'active' : ''}`}
                  onClick={() => scrollToBeat(b.id)}
                >
                  <span className="se-outline-beat-dot" style={{ background: ACT_COLORS[b.act] || '#94a3b8' }} />
                  <span className="se-outline-beat-icon">{b.icon}</span>
                  <span className="se-outline-beat-label">{b.label}</span>
                  <span className={`se-outline-indicator ${getBeatStatus(b)}`}>
                    {getBeatStatus(b) === 'complete' ? '✓' : getBeatStatus(b) === 'warning' ? '⚠' : '●'}
                  </span>
                </div>
              )) : <div className="se-outline-empty">No beats match "{outlineSearch}"</div>
            ) : (
              // Grouped by act with act colors
              ACT_ORDER.map(act => {
                const actBeats = groupedBeats[act] || [];
                if (actBeats.length === 0) return null;
                return (
                  <div key={act} className="se-outline-act-group">
                    <div className="se-outline-group" style={{ borderLeftColor: ACT_COLORS[act] }}>
                      {ACT_LABELS[act] || act}
                      <span className="se-outline-group-count">{actBeats.length}</span>
                    </div>
                    {actBeats.map(b => (
                      <div
                        key={b.id}
                        className={`se-outline-beat ${selectedBeatId === b.id ? 'active' : ''}`}
                        onClick={() => scrollToBeat(b.id)}
                        style={selectedBeatId === b.id ? { borderLeftColor: ACT_COLORS[act] } : {}}
                      >
                        <span className="se-outline-beat-dot" style={{ background: ACT_COLORS[b.act] || '#94a3b8' }} />
                        <span className="se-outline-beat-icon">{b.icon}</span>
                        <span className="se-outline-beat-label">{b.label}</span>
                        <span className={`se-outline-indicator ${getBeatStatus(b)}`}>
                          {getBeatStatus(b) === 'complete' ? '✓' : getBeatStatus(b) === 'warning' ? '⚠' : '●'}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
            {beats.length === 0 && !outlineSearch.trim() && (
              <div className="se-outline-empty">
                <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📝</span>
                No beats detected yet.<br />
                Click <strong>Generate Beats</strong> or paste your script and click <strong>Format</strong>.
              </div>
            )}
          </div>
        </div>

        {/* ─── CENTER: EDITOR ─── */}
        <div className="se-editor-pane">
          {/* Beat context header with navigation */}
          {selectedBeat && selectedBeat.raw !== 'SCRIPT' && (
            <div className="se-editor-beat-header">
              <div className="se-editor-beat-nav-row">
                <button
                  className="se-beat-nav-btn"
                  onClick={() => navigateBeat(-1)}
                  disabled={!hasPrevBeat}
                  title="Previous beat (Ctrl+↑)"
                >
                  ◂ Prev
                </button>
                <h2 className="se-editor-beat-title">
                  <span className="se-beat-title-icon">{selectedBeat.icon}</span>
                  {selectedBeat.label}
                  <span className="se-beat-act-tag" style={{ background: ACT_COLORS[selectedBeat.act] + '18', color: ACT_COLORS[selectedBeat.act] }}>
                    {selectedBeat.act}
                  </span>
                </h2>
                <button
                  className="se-beat-nav-btn"
                  onClick={() => navigateBeat(1)}
                  disabled={!hasNextBeat}
                  title="Next beat (Ctrl+↓)"
                >
                  Next ▸
                </button>
              </div>
              <div className="se-editor-beat-meta">
                <span className="se-editor-meta-item">
                  <strong>{selectedBeat.lines.filter(l => l.trim() && !l.startsWith('##')).length}</strong> lines
                </span>
                <span className="se-editor-meta-item">
                  <strong>{selectedBeat.uiActions.length}</strong> UI actions
                </span>
                <span className="se-editor-meta-item">
                  <strong>{selectedBeat.lines.filter(l => /^(Lala|Prime|Guest):/.test(l.trim())).length}</strong> dialogue
                </span>
              </div>
            </div>
          )}

          {/* Quick insert chips */}
          <div className="se-quick-insert-bar">
            <span className="se-quick-insert-label">Insert:</span>
            {QUICK_INSERTS.map((chip, i) => (
              <button
                key={i}
                className="se-quick-insert-chip"
                onClick={() => insertAtCursor(chip.insert)}
                title={`Insert ${chip.label}`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Empty state onboarding */}
          {!scriptContent.trim() && (
            <div className="se-empty-state">
              <div className="se-empty-icon">📝</div>
              <h3 className="se-empty-title">Start Writing Your Episode</h3>
              <p className="se-empty-desc">
                Choose how you'd like to begin:
              </p>
              <div className="se-empty-actions">
                <button className="se-empty-action-btn primary" onClick={handleGenerateBeats}>
                  <span className="se-empty-action-icon">🎬</span>
                  <span>
                    <strong>Generate Beats</strong>
                    <small>Auto-create beat structure from the linked world event</small>
                  </span>
                </button>
                <button className="se-empty-action-btn" onClick={() => setDrawerOpen(true)}>
                  <span className="se-empty-action-icon">📋</span>
                  <span>
                    <strong>Use a Template</strong>
                    <small>Start from a pre-built scene template</small>
                  </span>
                </button>
                <button className="se-empty-action-btn" onClick={() => textareaRef.current?.focus()}>
                  <span className="se-empty-action-icon">✍️</span>
                  <span>
                    <strong>Write from Scratch</strong>
                    <small>Paste or type your script directly</small>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Script textarea with line numbers */}
          <div className="se-editor-textarea-wrap">
            {!isMobile && (
              <div className="se-line-numbers-gutter">
                <LineNumbers content={scriptContent || '\n'} scrollTop={editorScrollTop} />
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="se-editor-textarea"
              value={scriptContent}
              onChange={(e) => { setScriptContent(e.target.value); setHasUnsavedChanges(true); }}
              onScroll={(e) => setEditorScrollTop(e.target.scrollTop)}
              placeholder={`Start writing your episode script here…\n\nTip: Use "Generate Beats" above to auto-create structure,\nor paste your script and click "Format" to organize it.\n\nExample:\n\n## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me — Parisian tea party edition!"\n\n## BEAT: CREATOR_WELCOME\n[UI:OPEN LoginWindow]\nPrime: "Welcome back, besties!"`}
              spellCheck={false}
            />
          </div>

          {/* Collapsible: UI Actions */}
          {selectedBeat && selectedBeat.uiActions.length > 0 && (
            <div className="se-collapsible">
              <div className="se-collapsible-header" onClick={() => setUiActionsOpen(!uiActionsOpen)}>
                <span className="se-collapsible-title">
                  UI Actions <span className="se-collapsible-count">{selectedBeat.uiActions.length}</span>
                </span>
                <span className={`se-collapsible-arrow ${uiActionsOpen ? 'open' : ''}`}>▸</span>
              </div>
              {uiActionsOpen && (
                <div className="se-collapsible-body">
                  {selectedBeat.uiActions.map((a, i) => (
                    <div key={i} className="se-ui-action-row">
                      <span className="se-ui-action-type">{a.type}</span>
                      <span className="se-ui-action-target">{a.target}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsible: Event Metadata */}
          {selectedBeat && selectedBeat.eventMeta.length > 0 && (
            <div className="se-collapsible">
              <div className="se-collapsible-header" onClick={() => setEventMetaOpen(!eventMetaOpen)}>
                <span className="se-collapsible-title">
                  Event Metadata <span className="se-collapsible-count">{selectedBeat.eventMeta.length}</span>
                </span>
                <span className={`se-collapsible-arrow ${eventMetaOpen ? 'open' : ''}`}>▸</span>
              </div>
              {eventMetaOpen && (
                <div className="se-collapsible-body">
                  {selectedBeat.eventMeta.map((m, i) => (
                    <div key={i} className="se-meta-row">
                      <span className="se-meta-label">{m.type}</span>
                      <span className="se-meta-value">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status bar with keyboard hints */}
          <div className="se-status-bar">
            <div className="se-status-left">
              <span>{lineCount} lines</span>
              <span className="se-status-sep">·</span>
              <span>{wordCount} words</span>
              <span className="se-status-sep">·</span>
              <span>{beatCount} beats</span>
              <span className="se-status-sep">·</span>
              <span>~{estDuration}s est.</span>
            </div>
            <div className="se-status-right">
              <span className="se-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> Save</span>
              <span className="se-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>K</kbd> Commands</span>
              <span className="se-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>↑↓</kbd> Nav beats</span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: ANALYSIS PANEL ─── */}
        {showAnalysis && analysis && (
          <div className="se-analysis">
            <div className="se-analysis-header">
              <h3 className="se-analysis-title">📊 Analysis</h3>
              <button className="se-analysis-close" onClick={() => setShowAnalysis(false)}>✕</button>
            </div>

            <div className="se-analysis-stats">
              {[
                { v: analysis.totalScenes || analysis.metadata?.totalBeats || 0, l: 'Beats' },
                { v: analysis.formattedDuration || analysis.metadata?.formattedDuration || '0s', l: 'Duration' },
                { v: analysis.metadata?.totalDialogueLines || 0, l: 'Dialogue' },
                { v: analysis.metadata?.totalUiActions || analysis.ui_actions?.length || 0, l: 'UI Actions' },
              ].map((s, i) => (
                <div key={i} className="se-analysis-stat">
                  <div className="se-analysis-stat-val">{s.v}</div>
                  <div className="se-analysis-stat-lbl">{s.l}</div>
                </div>
              ))}
            </div>

            <div className="se-analysis-scroll">
              {analysis.warnings?.length > 0 && (
                <div className="se-analysis-section">
                  <h4 className="se-analysis-section-title">⚠️ Warnings</h4>
                  {analysis.warnings.map((w, i) => (
                    <div key={i} className="se-analysis-warning">
                      <span className="se-analysis-warning-text">{w.message}</span>
                      {w.autofix?.available && (
                        <button className="se-analysis-autofix-btn" onClick={() => handleAutofix(w)}>🔧 Auto-fix</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="se-analysis-section">
                <h4 className="se-analysis-section-title">🎬 Beat Structure</h4>
                {(analysis.beats || analysis.scenes || []).map((b, i) => {
                  const c = b.confidence || 'confident';
                  const ic = c === 'confident' ? '✓' : c === 'review' ? '⚠' : '❌';
                  return (
                    <div key={i} className="se-analysis-beat">
                      <div className="se-analysis-beat-row">
                        <span className={`se-analysis-beat-conf ${c}`}>{ic}</span>
                        <span className="se-analysis-beat-name">{b.title || b.type}</span>
                        <span className="se-analysis-beat-dur">{b.duration_s || b.duration_seconds}s</span>
                      </div>
                      <div className="se-analysis-beat-meta">
                        {(b.speakers || b.characters_expected || []).map((sp, j) => {
                          const n = typeof sp === 'string' ? sp : sp.name;
                          const e = typeof sp === 'string' ? '' : (sp.emoji || '');
                          return <span key={j} className="se-analysis-badge">{e} {n}</span>;
                        })}
                        {b.dialogue_count > 0 && <span className="se-analysis-badge dim">💬 {b.dialogue_count}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(analysis.ui_actions || []).length > 0 && (
                <div className="se-analysis-section">
                  <h4 className="se-analysis-section-title">📱 UI Actions</h4>
                  {(analysis.beats || analysis.scenes || []).map((b, i) => {
                    const acts = (analysis.ui_actions || []).filter(a => a.beat_temp_id === b.temp_id);
                    if (!acts.length) return null;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div className="se-analysis-ui-group-title">{b.title || b.type}</div>
                        {acts.map((a, j) => (
                          <div key={j} className="se-analysis-ui-row">
                            <span className="se-analysis-ui-type">{a.type.toUpperCase()}</span>
                            <span className="se-analysis-ui-target">{a.target}</span>
                            <span className="se-analysis-ui-dur">{a.duration_s}s</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="se-analysis-actions">
              <button className="se-analysis-scene-btn" onClick={handleSendToSceneComposer}>🎬 Send to Scene Composer</button>
              <button className="se-analysis-re-btn" onClick={handleAnalyze}>🔄 Re-analyze</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── TOOLS DRAWER (slide-over) ─── */}
      {drawerOpen && (
        <>
          <div className="se-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="se-drawer">
            <div className="se-drawer-header">
              <span className="se-drawer-title">🧰 Tools</span>
              <button className="se-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <div className="se-drawer-tabs">
              {[
                { key: 'ui', label: 'UI Tags' },
                { key: 'templates', label: 'Templates' },
                { key: 'variables', label: 'Variables' },
              ].map(t => (
                <button
                  key={t.key}
                  className={`se-drawer-tab ${drawerTab === t.key ? 'active' : ''}`}
                  onClick={() => setDrawerTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="se-drawer-body">
              {drawerTab === 'ui' && (
                <>
                  {['Navigation', 'Interaction', 'System', 'Content'].map(group => {
                    const items = UI_TAGS.filter(t => t.group === group);
                    if (!items.length) return null;
                    return (
                      <div key={group} className="se-drawer-section">
                        <div className="se-drawer-section-title">{group}</div>
                        <div className="se-drawer-grid">
                          {items.map(t => (
                            <button key={t.label} className="se-insert-btn" onClick={() => { insertAtCursor(t.insert); setDrawerOpen(false); }}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {drawerTab === 'templates' && (
                <div className="se-drawer-section">
                  {TEMPLATES.map(t => (
                    <div key={t.key} className="se-template-card" onClick={() => { insertAtCursor(t.text); setDrawerOpen(false); }}>
                      <div className="se-template-card-label">{t.label}</div>
                      <div className="se-template-card-desc">{t.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === 'variables' && (
                <div className="se-drawer-section">
                  <div className="se-drawer-section-title">Script Variables</div>
                  <div className="se-drawer-grid">
                    {[
                      { label: 'Episode Title', insert: '{episode.title}' },
                      { label: 'Episode Number', insert: '{episode.number}' },
                      { label: 'Character Name', insert: '{character.name}' },
                      { label: 'Event Name', insert: '{event.name}' },
                      { label: 'Prestige', insert: '{event.prestige}' },
                      { label: 'Cost', insert: '{event.cost}' },
                    ].map(v => (
                      <button key={v.label} className="se-insert-btn" onClick={() => { insertAtCursor(v.insert); setDrawerOpen(false); }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <div className="se-drawer-section-title" style={{ marginTop: 16 }}>Validation</div>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 8px' }}>
                    Use <strong>Analyze</strong> to validate your script structure, check for missing beats, and verify UI action coverage.
                  </p>
                  <button className="se-insert-btn" onClick={() => { handleAnalyze(); setDrawerOpen(false); }} style={{ width: '100%', textAlign: 'center' }}>
                    🔍 Run Validation
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── COMMAND PALETTE (Ctrl+K) ─── */}
      {cmdOpen && (
        <div className="se-cmd-overlay" onClick={() => setCmdOpen(false)}>
          <div className="se-cmd-palette" onClick={e => e.stopPropagation()}>
            <input
              ref={cmdInputRef}
              className="se-cmd-input"
              placeholder="Type a command… (jump to beat, add beat, insert template)"
              value={cmdQuery}
              onChange={e => { setCmdQuery(e.target.value); setCmdHighlight(0); }}
              onKeyDown={e => {
                if (e.key === 'Escape') setCmdOpen(false);
                if (e.key === 'ArrowDown') { e.preventDefault(); setCmdHighlight(h => Math.min(h + 1, cmdItems.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setCmdHighlight(h => Math.max(h - 1, 0)); }
                if (e.key === 'Enter' && cmdItems[cmdHighlight]) { cmdItems[cmdHighlight].action(); setCmdOpen(false); }
              }}
            />
            <div className="se-cmd-list">
              {cmdItems.length > 0 ? cmdItems.map((item, i) => (
                <div
                  key={i}
                  className={`se-cmd-item ${i === cmdHighlight ? 'highlighted' : ''}`}
                  onClick={() => { item.action(); setCmdOpen(false); }}
                  onMouseEnter={() => setCmdHighlight(i)}
                >
                  <span className="se-cmd-item-icon">{item.icon}</span>
                  <span className="se-cmd-item-label">{item.label}</span>
                  {item.shortcut && <span className="se-cmd-item-shortcut">{item.shortcut}</span>}
                </div>
              )) : (
                <div className="se-cmd-empty">No matching commands</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScriptEditor;
