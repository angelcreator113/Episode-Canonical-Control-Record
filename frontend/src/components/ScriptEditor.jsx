/**
 * ScriptEditor v4 — Calm, Structured, Story-First
 * 
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │ Script Toolbar (beat selector, status, save, tools) │
 *   ├───────────────┬─────────────────────────────────────┤
 *   │  OUTLINE      │  SCRIPT EDITOR                     │
 *   │  (left pane)  │  + collapsible UI Actions / Meta   │
 *   └───────────────┴─────────────────────────────────────┘
 * 
 * Features:
 *   - Story Outline (left pane, collapsible, grouped by act)
 *   - Clean editor with beat context header
 *   - Collapsible UI Actions & Event Metadata sections
 *   - Tools slide-over drawer (UI Tags, Templates, Variables)
 *   - Command Palette (Ctrl+K)
 *   - Keyboard navigation (Ctrl+↑/↓ to switch beats)
 *   - Auto-save indicator
 * 
 * Replaces: ScriptEditor v3
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import api from '../services/api';
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

const BEAT_MAP = Object.fromEntries(BEAT_OPTIONS.map(b => [b.value, b]));
const ACT_ORDER = ['SETUP', 'CONFLICT', 'CLIMAX', 'RESOLUTION'];

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

  // Outline
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
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

  const textareaRef = useRef(null);
  const initialLoadDone = useRef(false);
  const cmdInputRef = useRef(null);

  // ─── LOAD ───
  useEffect(() => {
    if (initialLoadDone.current) return;
    if (episode?.script_content) {
      setScriptContent(episode.script_content);
      initialLoadDone.current = true;
    } else if (episodeId) {
      api.get(`/api/v1/episodes/${episodeId}`).then(res => {
        const ep = res.data?.data || res.data;
        if (ep?.script_content) setScriptContent(ep.script_content);
        initialLoadDone.current = true;
      }).catch(() => {});
    }
  }, [episode, episodeId]);

  useEffect(() => { initialLoadDone.current = false; }, [episodeId]);

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

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="se-root">
      {/* ─── TOP TOOLBAR ─── */}
      <div className="se-toolbar">
        <div className="se-toolbar-left">
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
        <div className="se-toolbar-right">
          <button className="se-btn-subtle" onClick={handleGenerateBeats} disabled={isGenerating} title="Replace script with fresh beat skeleton">
            {isGenerating ? '⏳…' : '🎬 Generate Beats'}
          </button>
          <button className="se-btn-subtle" onClick={handleFormatScript}>Format</button>
          <div className={`se-save-indicator ${hasUnsavedChanges ? 'unsaved' : saveStatus ? 'saved' : ''}`}>
            {hasUnsavedChanges ? '● Unsaved' : saveStatus || 'Saved'}
            <span className="se-shortcut">Ctrl+S</span>
          </div>
          <button className="se-btn-primary" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? '⏳ Analyzing…' : 'Analyze'}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="se-btn-overflow" onClick={(e) => { e.stopPropagation(); setOverflowOpen(!overflowOpen); }}>⋯</button>
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
                <button className="se-overflow-item" onClick={() => { setCmdOpen(true); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">⌨️</span> Command Palette
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>Ctrl+K</span>
                </button>
                <button className="se-overflow-item" onClick={() => { handleSave(); setOverflowOpen(false); }}>
                  <span className="se-overflow-icon">💾</span> Save
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
      <div className="se-body">

        {/* ─── LEFT: STORY OUTLINE ─── */}
        <div className={`se-outline ${outlineCollapsed ? 'collapsed' : ''}`}>
          <div className="se-outline-header">
            <span className="se-outline-title">Story Outline</span>
            <button className="se-outline-collapse-btn" onClick={() => setOutlineCollapsed(true)} title="Collapse outline">◀</button>
          </div>
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
                  <span className="se-outline-beat-icon">{b.icon}</span>
                  <span className="se-outline-beat-label">{b.label}</span>
                  <span className={`se-outline-indicator ${getBeatStatus(b)}`}>
                    {getBeatStatus(b) === 'complete' ? '✓' : getBeatStatus(b) === 'warning' ? '⚠' : '●'}
                  </span>
                </div>
              )) : <div className="se-outline-empty">No beats match "{outlineSearch}"</div>
            ) : (
              // Grouped by act
              ACT_ORDER.map(act => {
                const actBeats = groupedBeats[act] || [];
                if (actBeats.length === 0) return null;
                return (
                  <div key={act}>
                    <div className="se-outline-group">{act}</div>
                    {actBeats.map(b => (
                      <div
                        key={b.id}
                        className={`se-outline-beat ${selectedBeatId === b.id ? 'active' : ''}`}
                        onClick={() => scrollToBeat(b.id)}
                      >
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
                No beats detected yet.<br />
                Paste your script and click <strong>Format</strong> to auto-detect beats.
              </div>
            )}
          </div>
        </div>

        {/* Expand button when collapsed */}
        {outlineCollapsed && (
          <button className="se-outline-expand-btn" onClick={() => setOutlineCollapsed(false)} title="Show outline">▶</button>
        )}

        {/* ─── CENTER: EDITOR ─── */}
        <div className="se-editor-pane">
          {/* Beat context header */}
          {selectedBeat && selectedBeat.raw !== 'SCRIPT' && (
            <div className="se-editor-beat-header">
              <h2 className="se-editor-beat-title">
                <span>{selectedBeat.icon}</span>
                {selectedBeat.label}
              </h2>
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
                <span className="se-editor-meta-item" style={{ color: '#cbd5e1' }}>•</span>
                <span className="se-editor-meta-item" style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
                  {selectedBeat.act}
                </span>
              </div>
            </div>
          )}

          {/* Script textarea */}
          <div className="se-editor-textarea-wrap">
            <textarea
              ref={textareaRef}
              className="se-editor-textarea"
              value={scriptContent}
              onChange={(e) => { setScriptContent(e.target.value); setHasUnsavedChanges(true); }}
              placeholder={`Paste your full script here, or use the toolbar above.\n\nTip: Paste messy scripts → click "Format" to auto-organize.\n\nExample:\n\n## BEAT: OPENING_RITUAL\nLala: "Bestie, come style me — Parisian tea party edition!"\n\n## BEAT: CREATOR_WELCOME\n[UI:OPEN LoginWindow]\nPrime: "Welcome back, besties!"`}
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

          {/* Status bar */}
          <div className="se-status-bar">
            <span>{lineCount} lines</span>
            <span>{wordCount} words</span>
            <span>{beatCount} beats</span>
            <span>~{Math.ceil(wordCount / 2.2)}s est.</span>
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
